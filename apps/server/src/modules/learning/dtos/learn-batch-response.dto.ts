import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export type LearnPromptType = 'LEARN_MC' | 'LEARN_WRITTEN';

export class LearnBatchCardDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  cardId!: string;

  @ApiProperty({ description: 'The term shown to the learner as the prompt.' })
  @Expose()
  term!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Optional hint attached to the card. Frontend only shows this if the learner clicks the hint button.',
  })
  @Expose()
  hint!: string | null;

  @ApiProperty({
    enum: ['LEARN_MC', 'LEARN_WRITTEN'],
    description:
      "How the frontend should prompt: multiple choice (recognition) or free-text (recall). Chosen server-side based on the learner's current mastery streak.",
  })
  @Expose()
  promptType!: LearnPromptType;

  @ApiPropertyOptional({
    description:
      'Four shuffled options for LEARN_MC prompts. Undefined for LEARN_WRITTEN.',
    type: [String],
  })
  @Expose()
  choices?: string[];

  @ApiPropertyOptional({
    description:
      'Index of the correct choice for LEARN_MC prompts. Same trust model as Flashcard Mode — the client uses this to render feedback.',
  })
  @Expose()
  correctChoiceIndex?: number;
}

export class LearnBatchResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  sessionId!: string;

  @ApiProperty({ type: [LearnBatchCardDto] })
  @Expose()
  @Type(() => LearnBatchCardDto)
  cards!: LearnBatchCardDto[];

  @ApiProperty({
    description:
      'True if more non-mastered cards remain in the set beyond this batch. When false, all cards have reached MASTERED and the frontend can offer a completion screen.',
  })
  @Expose()
  hasMoreCards!: boolean;
}
