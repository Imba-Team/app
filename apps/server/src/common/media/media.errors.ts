import { BadRequestException } from '@nestjs/common';

/**
 * Machine-readable error codes surfaced to the client so the frontend
 * can localise the message + drive UX (which field to highlight, whether
 * to offer a retry, etc.) without string-matching English copy.
 */
export const MediaErrorCode = {
  TOO_LARGE: 'MEDIA_TOO_LARGE',
  UNRECOGNIZED: 'MEDIA_UNRECOGNIZED_FORMAT',
  MIME_NOT_ALLOWED: 'MEDIA_MIME_NOT_ALLOWED',
  MIME_MISMATCH: 'MEDIA_MIME_MISMATCH',
  INVALID_IMAGE: 'MEDIA_INVALID_IMAGE',
  DIMENSIONS_EXCEEDED: 'MEDIA_DIMENSIONS_EXCEEDED',
  MISSING_FILE: 'MEDIA_MISSING_FILE',
} as const;

export type MediaErrorCodeValue =
  (typeof MediaErrorCode)[keyof typeof MediaErrorCode];

/**
 * Every media rejection is a 400 (client fault). We embed a stable code
 * so the response envelope stays parseable regardless of translated
 * message copy.
 */
export class MediaValidationException extends BadRequestException {
  constructor(
    public readonly code: MediaErrorCodeValue,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details });
  }
}
