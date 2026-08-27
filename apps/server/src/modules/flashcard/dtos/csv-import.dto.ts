import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Column-index mapping. Indices are 0-based and refer to the position
 * of each column in the parsed CSV (after any header row).
 */
export class CsvFieldMappingDto {
  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  term!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  definition!: number;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @Min(0)
  @IsOptional()
  example?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsInt()
  @Min(0)
  @IsOptional()
  phonetic?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsInt()
  @Min(0)
  @IsOptional()
  hint?: number;
}

export class CsvImportRequestDto {
  @ApiProperty({ type: CsvFieldMappingDto })
  @ValidateNested()
  @Type(() => CsvFieldMappingDto)
  mapping!: CsvFieldMappingDto;

  @ApiProperty({ example: true })
  @IsBoolean()
  hasHeader!: boolean;

  @ApiPropertyOptional({ example: ',' })
  @IsString()
  @IsOptional()
  delimiter?: string;
}

export class CsvPreviewRequestDto {
  @ApiPropertyOptional({ example: ',' })
  @IsString()
  @IsOptional()
  delimiter?: string;
}

export class CsvPreviewResponseDto {
  @ApiProperty({ type: [String], example: ['Term', 'Definition', 'Example'] })
  headers!: string[];

  @ApiProperty({
    description:
      'First N data rows of the CSV — each row is an array of cell strings, parallel to "headers".',
    isArray: true,
    example: [
      ['Photosynthesis', 'Converts sunlight to energy', 'Plants do it'],
    ],
  })
  sample!: string[][];

  @ApiProperty({ example: 42 })
  totalRows!: number;

  @ApiProperty({ example: true })
  hasHeader!: boolean;

  @ApiProperty({ example: ',' })
  delimiter!: string;

  @ApiProperty({
    description:
      'Best-effort column-index suggestion derived from header names. Empty when no confident match was found.',
    example: { term: 0, definition: 1, example: 2 },
  })
  suggestedMapping!: Partial<{
    term: number;
    definition: number;
    example: number;
    phonetic: number;
    hint: number;
  }>;
}

export class CsvImportErrorDto {
  @ApiProperty({ example: 7 })
  row!: number;

  @ApiProperty({ example: 'term is required' })
  message!: string;
}

export class CsvImportResponseDto {
  @ApiProperty({ example: 198 })
  importedCount!: number;

  @ApiProperty({ example: 2 })
  skippedCount!: number;

  @ApiProperty({ example: 200 })
  totalRows!: number;

  @ApiProperty({ type: [CsvImportErrorDto] })
  errors!: CsvImportErrorDto[];
}
