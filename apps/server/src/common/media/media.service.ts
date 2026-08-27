import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { extname } from 'path';
import { StorageService } from '../storage/storage.service';
import { ImageProcessor } from './image.processor';
import { MediaErrorCode, MediaValidationException } from './media.errors';
import {
  AvatarPolicy,
  type MediaObject,
  type MediaPolicy,
  type UploadImageInput,
} from './media.types';

/**
 * MediaService is the app-facing entry point for anything file-shaped
 * that lives in object storage. It layers policy enforcement, magic-
 * byte validation, image normalization, and content-hash keying on top
 * of the raw StorageService.
 *
 * Domain controllers should call this — not StorageService directly —
 * so validation and processing stay uniform across use cases.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly imageProcessor: ImageProcessor,
  ) {}

  /**
   * Upload an image after validating + normalising it against `policy`.
   * Steps:
   *   1. Reject if the buffer is empty or above the byte cap.
   *   2. Reject if the client-declared mime isn't in the allowlist.
   *   3. Sniff magic bytes; reject if they disagree with the declared mime.
   *   4. Feed sharp to auto-orient, resize, strip EXIF, re-encode.
   *   5. Hash the output → content-addressable key. Two identical
   *      uploads land on the same key (no wasted storage) *and* the URL
   *      is safe to cache forever.
   *   6. Push to storage. Return the canonical MediaObject.
   *
   * Never mutates external state on failure — a rejected upload leaves
   * nothing in the bucket and doesn't touch the caller's DB.
   */
  async uploadImage(
    input: UploadImageInput,
    policy: MediaPolicy,
  ): Promise<MediaObject> {
    if (!policy.image) {
      throw new Error(
        `Policy "${policy.kind}" has no image pipeline configured`,
      );
    }
    if (!input.buffer || input.buffer.length === 0) {
      throw new MediaValidationException(
        MediaErrorCode.MISSING_FILE,
        'File is empty or missing',
      );
    }
    if (input.buffer.length > policy.maxBytes) {
      throw new MediaValidationException(
        MediaErrorCode.TOO_LARGE,
        `File exceeds the ${formatBytes(policy.maxBytes)} limit`,
        { maxBytes: policy.maxBytes, actualBytes: input.buffer.length },
      );
    }

    // Declared vs. actual mime: multer trusts the client-provided
    // header, so we also sniff the first bytes ourselves.
    if (!policy.allowedMimes.includes(input.declaredMime)) {
      throw new MediaValidationException(
        MediaErrorCode.MIME_NOT_ALLOWED,
        `Allowed types: ${policy.allowedMimes.join(', ')}`,
        { declaredMime: input.declaredMime },
      );
    }
    const sniffed = sniffImageMime(input.buffer);
    if (!sniffed) {
      throw new MediaValidationException(
        MediaErrorCode.UNRECOGNIZED,
        'File signature does not match a supported image format',
      );
    }
    if (!policy.allowedMimes.includes(sniffed)) {
      throw new MediaValidationException(
        MediaErrorCode.MIME_MISMATCH,
        `File contents indicate ${sniffed}, which is not allowed`,
        { declaredMime: input.declaredMime, actualMime: sniffed },
      );
    }

    const processed = await this.imageProcessor.process(
      input.buffer,
      policy.image,
    );

    // Enforce output dimension caps as a defensive check — sharp will
    // usually honor them but a `preserve`-format branch that skips
    // resize could theoretically produce larger output.
    if (
      processed.width > policy.image.maxWidth ||
      processed.height > policy.image.maxHeight
    ) {
      throw new MediaValidationException(
        MediaErrorCode.DIMENSIONS_EXCEEDED,
        `Processed image exceeds ${policy.image.maxWidth}x${policy.image.maxHeight}`,
      );
    }

    // Content-hash based key. Truncating to 32 hex chars keeps the URL
    // short while retaining ~128 bits of entropy — collision-free for
    // practical purposes.
    const hash = crypto
      .createHash('sha256')
      .update(processed.buffer)
      .digest('hex')
      .slice(0, 32);
    const ext = formatToExt(processed.format);
    const keySegments = [input.ownerId, `${hash}.${ext}`].filter(
      Boolean,
    ) as string[];
    const key = keySegments.join('/');

    const uploadResult = await this.storage.upload({
      prefix: policy.prefix,
      key,
      body: processed.buffer,
      originalName: input.originalName,
      mimeType: processed.mime,
    });

    return {
      objectName: uploadResult.objectName,
      url: uploadResult.url,
      mime: processed.mime,
      size: processed.buffer.length,
      width: processed.width,
      height: processed.height,
      format: processed.format,
      hash,
    };
  }

  /**
   * Thin convenience wrapper around uploadImage() for the avatar use
   * case — every controller that touches profile pictures should go
   * through here so the policy is enforced in exactly one place.
   */
  async uploadAvatar(
    userId: string,
    buffer: Buffer,
    originalName: string,
    declaredMime: string,
  ): Promise<MediaObject> {
    return this.uploadImage(
      { buffer, originalName, declaredMime, ownerId: userId },
      AvatarPolicy,
    );
  }

  /**
   * Remove an object by its stored name. Best-effort (see
   * StorageService.delete). Safe to call with a value read from a
   * user record: legacy full URLs are parsed back to the object name
   * before delegating.
   */
  async delete(objectNameOrUrl: string | null | undefined): Promise<void> {
    if (!objectNameOrUrl) return;
    const objectName = this.toObjectName(objectNameOrUrl);
    if (!objectName) return;
    await this.storage.delete(objectName);
  }

  /**
   * Convert a stored value into the URL the browser should fetch.
   * Handles both formats we may find in the DB:
   *   - new records: objectName like "avatars/{userId}/{hash}.webp"
   *   - legacy records: absolute URL (kept for backward compat with
   *     rows written before the media module existed)
   */
  resolveUrl(objectNameOrUrl?: string | null): string | null {
    if (!objectNameOrUrl) return null;
    if (isAbsoluteUrl(objectNameOrUrl)) return objectNameOrUrl;
    return this.storage.buildPublicUrl(objectNameOrUrl);
  }

  /**
   * Inverse of resolveUrl(): given whatever is stored on the record,
   * produce the object name we can hand to storage.delete(). Returns
   * null for legacy URLs whose bucket + prefix we can't recover.
   */
  private toObjectName(value: string): string | null {
    if (!isAbsoluteUrl(value)) return value;
    // Try to parse `<publicUrl>/<bucket>/<objectName>` back into just
    // the objectName. The parts before /<bucket>/ vary between dev and
    // CDN hosts, so we anchor on the known prefix set.
    const knownPrefixes = ['/avatars/', '/images/', '/study-set-audio/'];
    for (const p of knownPrefixes) {
      const idx = value.indexOf(p);
      if (idx >= 0) return value.slice(idx + 1);
    }
    return null;
  }
}

/**
 * Sniff the first 12 bytes to detect PNG / JPEG / GIF / WebP. This is
 * cheap, dependency-free, and blocks the "rename malware.exe → me.png"
 * attack that would otherwise slip past multer.
 */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // PNG:  89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // GIF:  47 49 46 38 (37|39) 61  →  "GIF87a" / "GIF89a"
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return 'image/gif';
  }
  // WebP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

function formatToExt(format: string): string {
  switch (format) {
    case 'jpeg':
    case 'jpg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'gif':
      return 'gif';
    case 'webp':
      return 'webp';
    default:
      return format;
  }
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// Kept for symmetry with future non-image kinds — currently unused.
export { extname };
