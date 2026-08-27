import * as multer from 'multer';
import { MediaErrorCode, MediaValidationException } from './media.errors';
import type { MediaPolicy } from './media.types';

/**
 * Build multer options from a MediaPolicy. Use with
 * `@UseInterceptors(FileInterceptor('file', buildMulterOptions(policy)))`
 * — this keeps every media endpoint's multer wiring identical, so tuning
 * limits or mime allowlists happens in `media.types.ts` and nowhere else.
 *
 * Notes:
 * - Memory storage is intentional: MediaService needs the raw buffer to
 *   hash + re-encode. For very large uploads (audio/video) we'd swap
 *   this for `multer.diskStorage()` and stream from disk.
 * - `fileFilter` gates on the *declared* mimetype; MediaService then
 *   double-checks by sniffing the actual bytes. Both layers matter:
 *   fileFilter rejects fast (no bytes uploaded past the limit) but is
 *   trust-the-client; the sniff step catches spoofs after the fact.
 */
export function buildMulterOptions(policy: MediaPolicy): multer.Options {
  return {
    storage: multer.memoryStorage(),
    limits: { fileSize: policy.maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (policy.allowedMimes.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      // multer 2.x tightened the cb signature to accept only null as
      // the error slot, so we signal rejection by throwing — Nest's
      // exception filter catches the MediaValidationException and
      // formats it into the standard 400 envelope.
      throw new MediaValidationException(
        MediaErrorCode.MIME_NOT_ALLOWED,
        `Allowed types: ${policy.allowedMimes.join(', ')}`,
        { declaredMime: file.mimetype },
      );
    },
  };
}

/**
 * Shape of the multer file we hand off to MediaService. Kept as a
 * lightweight interface rather than pulling in `Express.Multer.File`
 * so controllers can stay decoupled from express types.
 */
export interface UploadedMediaFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}
