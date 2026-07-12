import { z } from 'zod';

/**
 * Zod schemas mirroring the backend DTOs.
 *
 * Source of truth: `Mimir_TDD_v1.md` §5 (Prisma schema) + §7 (DTOs).
 * When the backend spec ships, these become mirrors of the generated OpenAPI types
 * in `@mimir/api-client`. Keep these as thin as possible — they exist for client-side
 * form validation only, not for defining the API contract.
 */

// -------- Enums --------

export const UserRole = z.enum(['REGISTERED', 'TEACHER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRole>;

export const Visibility = z.enum(['PRIVATE', 'FOLLOWERS', 'PUBLIC']);
export type Visibility = z.infer<typeof Visibility>;

export const CardMasteryStatus = z.enum(['NEW', 'LEARNING', 'MASTERED']);
export type CardMasteryStatus = z.infer<typeof CardMasteryStatus>;

// -------- Auth --------

export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export const PasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase letter')
  .regex(/[0-9]/, 'At least one number')
  .regex(/[^A-Za-z0-9]/, 'At least one special character');

export const UsernameSchema = z
  .string()
  .trim()
  .min(3, 'At least 3 characters')
  .max(30, 'Max 30 characters')
  .regex(/^[a-z0-9_.-]+$/i, 'Letters, numbers, dot, dash, underscore only');

// API payload — mirrors backend RegisterRequestDto.
export const RegisterInput = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  username: UsernameSchema,
});
export type RegisterInput = z.infer<typeof RegisterInput>;

// Form-level schema — adds confirm + TOS consent (SRS §6.3). The confirmPassword
// and tos fields never hit the wire; stripped before submission.
export const RegisterFormInput = RegisterInput.extend({
  confirmPassword: z.string().min(1, 'Confirm your password'),
  tos: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms' }),
  }),
}).refine((v) => v.password === v.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});
export type RegisterFormInput = z.infer<typeof RegisterFormInput>;

export const LoginInput = z.object({
  email: EmailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginInput>;

export const ForgotPasswordInput = z.object({
  email: EmailSchema,
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInput>;

export const ResetPasswordFormInput = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });
export type ResetPasswordFormInput = z.infer<typeof ResetPasswordFormInput>;

// -------- Study Set / Card --------

export const CardFields = z.object({
  term: z.string().trim().min(1).max(500),
  definition: z.string().trim().min(1).max(2000),
  phonetic: z.string().trim().max(200).optional(),
  example: z.string().trim().max(500).optional(),
  synonyms: z.array(z.string().trim()).max(10).default([]),
  translations: z.record(z.string().length(2), z.string()).optional(),
  notes: z.string().trim().max(500).optional(),
});
export type CardFields = z.infer<typeof CardFields>;

export const CreateSetInput = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional(),
  languageFrom: z.string().min(2).max(5),
  languageTo: z.string().min(2).max(5).optional(),
  visibility: Visibility.default('PRIVATE'),
  category: z.string().trim().max(100).optional(),
  tags: z.array(z.string().trim().max(50)).max(20).default([]),
});
export type CreateSetInput = z.infer<typeof CreateSetInput>;

// -------- Learning session answer ingest (TDD §7 + §8a) --------

export const AnswerSchema = z.object({
  cardId: z.string().uuid(),
  mode: z.enum(['FLASHCARDS', 'LEARN', 'WRITE', 'SPELL', 'TEST', 'MATCH', 'AI_BLANK', 'AI_GUESS']),
  correct: z.boolean(),
  usedHint: z.boolean().default(false),
  elapsedMs: z.number().int().nonnegative().max(600_000),
});
export type AnswerInput = z.infer<typeof AnswerSchema>;
