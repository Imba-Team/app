import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { LoggerService } from 'src/common/logger/logger.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { StudySetService } from 'src/modules/study-set/study-set.service';

import {
  CsvFieldMappingDto,
  CsvImportErrorDto,
  CsvImportRequestDto,
  CsvImportResponseDto,
  CsvPreviewResponseDto,
} from './dtos/csv-import.dto';

export const CSV_MAX_BYTES = 5 * 1024 * 1024;
export const CSV_MAX_ROWS = 1000;
const PREVIEW_SAMPLE_SIZE = 5;
const TERM_MAX_LEN = 500;
const DEFINITION_MAX_LEN = 5000;
const ERRORS_RESPONSE_CAP = 50;

const HEADER_SYNONYMS: Record<keyof CsvFieldMappingDto, string[]> = {
  term: ['term', 'word', 'front', 'question', 'vocab', 'vocabulary'],
  definition: ['definition', 'meaning', 'back', 'answer', 'translation', 'def'],
  example: ['example', 'sentence', 'usage', 'context'],
  phonetic: ['phonetic', 'pronunciation', 'ipa', 'phonetics'],
  hint: ['hint', 'note', 'notes', 'memo', 'tip'],
};

type ParsedCsv = {
  rows: string[][];
  delimiter: string;
};

@Injectable()
export class CsvImportService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly studySetService: StudySetService,
  ) {
    this.logger.setContext(CsvImportService.name);
  }

  async preview(
    userId: string,
    studySetId: string,
    fileBuffer: Buffer,
    overrideDelimiter?: string,
  ): Promise<CsvPreviewResponseDto> {
    await this.ensureCanEdit(userId, studySetId);

    const { rows, delimiter } = this.parseBuffer(fileBuffer, overrideDelimiter);
    if (!rows.length) {
      throw new BadRequestException('CSV file is empty');
    }

    const hasHeader = this.guessHasHeader(rows);
    const headers = hasHeader
      ? rows[0].map((h) => h.trim())
      : rows[0].map((_, i) => `Column ${i + 1}`);
    const dataRows = hasHeader ? rows.slice(1) : rows;
    const sample = dataRows.slice(0, PREVIEW_SAMPLE_SIZE);

    return {
      headers,
      sample,
      totalRows: dataRows.length,
      hasHeader,
      delimiter,
      suggestedMapping: this.suggestMapping(headers, hasHeader),
    };
  }

  async import(
    userId: string,
    studySetId: string,
    fileBuffer: Buffer,
    request: CsvImportRequestDto,
  ): Promise<CsvImportResponseDto> {
    await this.ensureCanEdit(userId, studySetId);

    const { rows } = this.parseBuffer(fileBuffer, request.delimiter);
    const dataRows = request.hasHeader ? rows.slice(1) : rows;

    if (!dataRows.length) {
      return { importedCount: 0, skippedCount: 0, totalRows: 0, errors: [] };
    }
    if (dataRows.length > CSV_MAX_ROWS) {
      throw new BadRequestException(
        `CSV has ${dataRows.length} rows; the maximum is ${CSV_MAX_ROWS}`,
      );
    }

    const errors: CsvImportErrorDto[] = [];
    const toCreate: Array<{
      studySetId: string;
      term: string;
      definition: string;
      example?: string;
      phonetic?: string;
      hint?: string;
      orderIndex: number;
    }> = [];

    // Header rows shift the reported row numbers by 1 so users can map errors
    // back to lines in their spreadsheet.
    const rowOffset = request.hasHeader ? 2 : 1;
    const baseOrderIndex = await this.nextOrderIndex(studySetId);

    dataRows.forEach((row, i) => {
      const displayRow = i + rowOffset;
      const term = this.cell(row, request.mapping.term);
      const definition = this.cell(row, request.mapping.definition);

      if (!term) {
        errors.push({ row: displayRow, message: 'term is required' });
        return;
      }
      if (!definition) {
        errors.push({ row: displayRow, message: 'definition is required' });
        return;
      }
      if (term.length > TERM_MAX_LEN) {
        errors.push({
          row: displayRow,
          message: `term exceeds ${TERM_MAX_LEN} characters`,
        });
        return;
      }
      if (definition.length > DEFINITION_MAX_LEN) {
        errors.push({
          row: displayRow,
          message: `definition exceeds ${DEFINITION_MAX_LEN} characters`,
        });
        return;
      }

      toCreate.push({
        studySetId,
        term,
        definition,
        example: this.optionalCell(row, request.mapping.example),
        phonetic: this.optionalCell(row, request.mapping.phonetic),
        hint: this.optionalCell(row, request.mapping.hint),
        orderIndex: baseOrderIndex + toCreate.length,
      });
    });

    if (toCreate.length) {
      await this.prisma.flashcard.createMany({ data: toCreate });
      this.logger.log(
        `CSV import: studySetId=${studySetId}, imported=${toCreate.length}, skipped=${errors.length}`,
      );
    }

    return {
      importedCount: toCreate.length,
      skippedCount: errors.length,
      totalRows: dataRows.length,
      errors: errors.slice(0, ERRORS_RESPONSE_CAP),
    };
  }

  private parseBuffer(buffer: Buffer, overrideDelimiter?: string): ParsedCsv {
    if (buffer.length > CSV_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds ${CSV_MAX_BYTES / 1024 / 1024}MB limit`,
      );
    }

    const delimiter = overrideDelimiter ?? this.detectDelimiter(buffer);

    try {
      const rows = parse(buffer, {
        delimiter,
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true,
        trim: false,
      });
      return { rows, delimiter };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid CSV';
      throw new BadRequestException(`Failed to parse CSV: ${message}`);
    }
  }

  /**
   * Sniff the most likely delimiter from the first non-empty line. CSV files
   * exported from European spreadsheet apps use ';', tab-separated exports
   * use '\t', the rest are comma.
   */
  private detectDelimiter(buffer: Buffer): string {
    const head = buffer
      .toString('utf8', 0, Math.min(buffer.length, 4096))
      .replace(/^\uFEFF/, '');
    const firstLine = head.split(/\r?\n/).find((l) => l.length > 0) ?? '';
    const counts = {
      ',': (firstLine.match(/,/g) ?? []).length,
      ';': (firstLine.match(/;/g) ?? []).length,
      '\t': (firstLine.match(/\t/g) ?? []).length,
      '|': (firstLine.match(/\|/g) ?? []).length,
    };
    const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return winner[1] > 0 ? winner[0] : ',';
  }

  /**
   * Treat the first row as headers when none of its cells parse as numbers
   * and at least one cell looks like a typical column label (alphabetic).
   */
  private guessHasHeader(rows: string[][]): boolean {
    if (!rows.length) return false;
    const first = rows[0];
    const allLookHeadery = first.every((cell) => {
      const trimmed = cell.trim();
      if (!trimmed) return false;
      if (!Number.isNaN(Number(trimmed))) return false;
      return /[a-zA-Z]/.test(trimmed);
    });
    return allLookHeadery;
  }

  private suggestMapping(
    headers: string[],
    hasHeader: boolean,
  ): CsvPreviewResponseDto['suggestedMapping'] {
    if (!hasHeader) {
      // Two-column files almost always go term, definition.
      if (headers.length >= 2) return { term: 0, definition: 1 };
      return {};
    }

    const normalised = headers.map((h) => h.trim().toLowerCase());
    const suggested: CsvPreviewResponseDto['suggestedMapping'] = {};
    const used = new Set<number>();

    (Object.keys(HEADER_SYNONYMS) as Array<keyof CsvFieldMappingDto>).forEach(
      (field) => {
        const synonyms = HEADER_SYNONYMS[field];
        const idx = normalised.findIndex(
          (h, i) => !used.has(i) && synonyms.includes(h),
        );
        if (idx >= 0) {
          suggested[field] = idx;
          used.add(idx);
        }
      },
    );

    return suggested;
  }

  private cell(row: string[], index: number): string {
    return (row[index] ?? '').trim();
  }

  private optionalCell(row: string[], index?: number): string | undefined {
    if (index === undefined) return undefined;
    const value = this.cell(row, index);
    return value.length ? value : undefined;
  }

  private async nextOrderIndex(studySetId: string): Promise<number> {
    const last = await this.prisma.flashcard.findFirst({
      where: { studySetId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });
    return last ? last.orderIndex + 1 : 0;
  }

  private async ensureCanEdit(userId: string, studySetId: string) {
    const allowed = await this.studySetService.canEdit(userId, studySetId);
    if (!allowed) {
      throw new ForbiddenException(
        'You can only import cards into your own study sets',
      );
    }
  }
}
