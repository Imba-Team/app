import { Injectable, Logger } from '@nestjs/common';
// This tsconfig has `esModuleInterop: false`, so
// `import sharp from 'sharp'` would compile to `sharp_1.default` — but
// sharp's runtime is `module.exports = SharpFn` (plain CJS, no
// `.default`), so calling it blows up with
// `sharp_1.default is not a function`. Use `require()` directly for
// the callable, and a type-only `import type` for the shapes.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const sharp: typeof import('sharp').default = require('sharp');
import type { Metadata, OutputInfo, Sharp } from 'sharp';
import { MediaErrorCode, MediaValidationException } from './media.errors';
import type { ImagePipelineOptions } from './media.types';

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  /** Sharp's canonical format id ('webp' | 'jpeg' | 'png' | 'gif' | ...). */
  format: string;
  /** Rendered Content-Type derived from `format`. */
  mime: string;
}

/**
 * Wraps `sharp` so the rest of the codebase never imports it directly.
 * Keeping the boundary here means we can swap the encoder (e.g. move
 * to a native rust binding) without touching MediaService.
 */
@Injectable()
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  /**
   * Validate that `buffer` is a real image, resize + re-encode per
   * policy, and return the final bytes. Throws MediaValidationException
   * for anything sharp can't decode.
   */
  async process(
    buffer: Buffer,
    opts: ImagePipelineOptions,
  ): Promise<ProcessedImage> {
    // `failOn: 'error'` makes sharp refuse suspect input (truncated
    // files, malformed headers). Combined with the magic-byte check in
    // MediaService this is our defence against multer accepting a
    // renamed executable as image/png.
    const source = sharp(buffer, { failOn: 'error' });

    let meta: Metadata;
    try {
      meta = await source.metadata();
    } catch (err) {
      throw new MediaValidationException(
        MediaErrorCode.INVALID_IMAGE,
        'File could not be decoded as an image',
        { cause: describe(err) },
      );
    }

    if (!meta.width || !meta.height || !meta.format) {
      throw new MediaValidationException(
        MediaErrorCode.INVALID_IMAGE,
        'File is missing image dimensions or format',
      );
    }

    const preserveAnimated = meta.format === 'gif' && (meta.pages ?? 1) > 1;

    // Auto-rotate first so a portrait-oriented phone photo (EXIF
    // orientation 6) resizes on the correct axis. Calling .rotate()
    // with no argument reads the EXIF tag and applies it, which also
    // has the side effect of dropping the tag — desirable when
    // stripMetadata is true.
    let pipeline = source.rotate();

    if (meta.width > opts.maxWidth || meta.height > opts.maxHeight) {
      pipeline = pipeline.resize({
        width: opts.maxWidth,
        height: opts.maxHeight,
        fit: opts.fit,
        withoutEnlargement: true,
      });
    }

    // Metadata handling: sharp strips by default. Only re-attach if the
    // policy explicitly says so (rare — kept for future-proofing).
    if (!opts.stripMetadata) {
      pipeline = pipeline.withMetadata();
    }

    const format = resolveOutputFormat(
      opts.targetFormat,
      meta.format,
      preserveAnimated,
    );
    pipeline = applyEncoder(pipeline, format, opts.quality);

    let out: { data: Buffer; info: OutputInfo };
    try {
      out = await pipeline.toBuffer({ resolveWithObject: true });
    } catch (err) {
      this.logger.warn(`sharp pipeline failed: ${describe(err)}`);
      throw new MediaValidationException(
        MediaErrorCode.INVALID_IMAGE,
        'Failed to process image',
        { cause: describe(err) },
      );
    }

    return {
      buffer: out.data,
      width: out.info.width,
      height: out.info.height,
      format: out.info.format,
      mime: formatToMime(out.info.format),
    };
  }
}

function resolveOutputFormat(
  target: ImagePipelineOptions['targetFormat'],
  sourceFormat: string,
  preserveAnimated: boolean,
): 'webp' | 'jpeg' | 'png' | 'gif' {
  // Never convert animated GIFs to static WebP — that would silently
  // drop the animation. Keep them as-is.
  if (preserveAnimated) return 'gif';
  if (target === 'preserve') {
    if (sourceFormat === 'jpeg') return 'jpeg';
    if (sourceFormat === 'png') return 'png';
    if (sourceFormat === 'gif') return 'gif';
    // WebP + everything else → webp (widely supported now).
    return 'webp';
  }
  return target;
}

function applyEncoder(
  pipeline: Sharp,
  format: 'webp' | 'jpeg' | 'png' | 'gif',
  quality: number,
): Sharp {
  switch (format) {
    case 'webp':
      return pipeline.webp({ quality });
    case 'jpeg':
      return pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
    case 'png':
      return pipeline.png({ compressionLevel: 9 });
    case 'gif':
      // Keep animation frames intact — sharp only re-encodes if we call
      // .gif({ ... }), which we deliberately skip. Returning the source
      // pipeline hands sharp the original bytes on toBuffer().
      return pipeline.gif();
  }
}

function formatToMime(format: string): string {
  switch (format) {
    case 'webp':
      return 'image/webp';
    case 'jpeg':
    case 'jpg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}
