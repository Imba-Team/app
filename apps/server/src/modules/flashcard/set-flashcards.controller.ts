import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import * as multer from 'multer';

import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Role, Roles } from 'src/common/decorators/roles.decorator';
import { IUser } from 'src/common/interfaces/user.interface';
import { ResponseDto } from 'src/common/interfaces/response.dto';
import { JwtGuard } from 'src/guards/jwt.guard';
import { RolesGuard } from 'src/guards/roles.guard';

import { CreateFlashcardDto } from './dtos/create-flashcard.dto';
import {
  CsvImportRequestDto,
  CsvImportResponseDto,
  CsvPreviewResponseDto,
} from './dtos/csv-import.dto';
import { FlashcardResponseDto } from './dtos/flashcard-response.dto';
import { CSV_MAX_BYTES, CsvImportService } from './csv-import.service';
import { FlashcardService } from './flashcard.service';

type MulterFile = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const ALLOWED_CSV_MIMES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
]);

const csvMulterOptions: multer.Options = {
  storage: multer.memoryStorage(),
  limits: { fileSize: CSV_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype;
    const isCsvExt = file.originalname.toLowerCase().endsWith('.csv');
    if (ALLOWED_CSV_MIMES.has(mime) || isCsvExt) {
      cb(null, true);
    } else {
      throw new BadRequestException('Only CSV files are accepted');
    }
  },
};

@ApiTags('Flashcards')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.USER, Role.ADMIN)
@Controller('study-sets')
export class SetFlashcardsController {
  constructor(
    private readonly flashcardService: FlashcardService,
    private readonly csvImportService: CsvImportService,
  ) {}

  @Post(':setId/cards')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a flashcard in a study set' })
  @ApiBody({ type: CreateFlashcardDto })
  async create(
    @CurrentUser() user: IUser,
    @Param('setId') setId: string,
    @Body() dto: CreateFlashcardDto,
  ): Promise<ResponseDto<FlashcardResponseDto>> {
    const data = await this.flashcardService.create(user.id, setId, dto);
    return { ok: true, message: 'Flashcard created', data };
  }

  @Get(':setId/cards')
  @HttpCode(200)
  @ApiOperation({ summary: 'List flashcards in a study set' })
  async list(
    @CurrentUser() user: IUser,
    @Param('setId') setId: string,
  ): Promise<ResponseDto<FlashcardResponseDto[]>> {
    const data = await this.flashcardService.list(user.id, setId);
    return { ok: true, message: 'Flashcards retrieved', data };
  }

  @Post(':setId/cards/import/preview')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Preview a CSV before importing — returns headers, first 5 data rows, and a suggested column mapping',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiQuery({ name: 'delimiter', required: false })
  @UseInterceptors(FileInterceptor('file', csvMulterOptions))
  async previewCsv(
    @CurrentUser() user: IUser,
    @Param('setId') setId: string,
    @UploadedFile() file: MulterFile,
    @Query('delimiter') delimiter?: string,
  ): Promise<ResponseDto<CsvPreviewResponseDto>> {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    const data = await this.csvImportService.preview(
      user.id,
      setId,
      file.buffer,
      delimiter,
    );
    return { ok: true, message: 'CSV preview generated', data };
  }

  @Post(':setId/cards/import')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Import flashcards from a CSV using the supplied column mapping',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'request'],
      properties: {
        file: { type: 'string', format: 'binary' },
        request: {
          type: 'string',
          description: 'JSON-stringified CsvImportRequestDto',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', csvMulterOptions))
  async importCsv(
    @CurrentUser() user: IUser,
    @Param('setId') setId: string,
    @UploadedFile() file: MulterFile,
    @Body('request') rawRequest: string,
  ): Promise<ResponseDto<CsvImportResponseDto>> {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    if (!rawRequest) {
      throw new BadRequestException('request body is required');
    }

    let request: CsvImportRequestDto;
    try {
      request = JSON.parse(rawRequest) as CsvImportRequestDto;
    } catch {
      throw new BadRequestException('request must be valid JSON');
    }

    if (!request.mapping || typeof request.hasHeader !== 'boolean') {
      throw new BadRequestException(
        'request must include mapping and hasHeader',
      );
    }

    const data = await this.csvImportService.import(
      user.id,
      setId,
      file.buffer,
      request,
    );
    return { ok: true, message: 'CSV import complete', data };
  }
}
