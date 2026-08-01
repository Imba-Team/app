/**
 * Shared types + policy presets for the media pipeline.
 *
 * A `MediaPolicy` is the declarative contract for a single kind of
 * upload (avatar, generic image, audio, document). Adding a new kind
 * means adding a policy here — the multer factory, validator, and
 * MediaService all read from the policy, so no controller code has to
 * change once wired.
 */

export type MediaKind = 'avatar' | 'image' | 'audio' | 'document';

export type TargetImageFormat = 'webp' | 'jpeg' | 'png' | 'preserve';
export type ImageFit = 'cover' | 'contain' | 'inside';

export interface ImagePipelineOptions {
  /** Hard cap on output width in pixels. Larger inputs get resized down. */
  maxWidth: number;
  /** Hard cap on output height in pixels. */
  maxHeight: number;
  /**
   * Format the pipeline re-encodes to. `preserve` keeps the source
   * format (useful for GIF where WebP conversion would strip animation).
   */
  targetFormat: TargetImageFormat;
  /**
   * Whether to strip EXIF / ICC / XMP metadata. Defaults to true for
   * user-uploaded content since EXIF may leak GPS coordinates.
   */
  stripMetadata: boolean;
  /**
   * How the resize interprets the max dimensions. Avatars use `cover`
   * to always fill a square; generic images use `inside` to keep aspect
   * ratio without upscaling.
   */
  fit: ImageFit;
  /** Encoder quality (1-100). Ignored for `preserve` / lossless formats. */
  quality: number;
}

export interface MediaPolicy {
  kind: MediaKind;
  /** Object-storage prefix ("avatars", "images", ...). */
  prefix: string;
  /** Hard cap on the *incoming* file size, enforced pre-processing. */
  maxBytes: number;
  /**
   * Allowed **declared** mime types. Still cross-checked against the
   * file's magic bytes — an attacker cannot bypass this by lying about
   * Content-Type in the multipart headers.
   */
  allowedMimes: readonly string[];
  /** Present iff `kind` implies image processing (avatar, image). */
  image?: ImagePipelineOptions;
}

export interface UploadImageInput {
  /** Raw bytes from multer. */
  buffer: Buffer;
  /** Client-supplied filename. Only used to derive the fallback extension. */
  originalName: string;
  /** Client-declared mime type. Verified against magic bytes. */
  declaredMime: string;
  /**
   * Optional owning entity id (usually a user id). Included in the key
   * so uploads are auditable + sortable per-owner in the object store.
   */
  ownerId?: string;
}

export interface MediaObject {
  /**
   * The stable, backend-agnostic identifier — this is what you store
   * on your domain records (e.g. User.profilePicture). Format:
   * `<prefix>/<optional-owner-id>/<content-hash>.<ext>`.
   */
  objectName: string;
  /** Absolute URL the browser can hit. Built from objectName + public host. */
  url: string;
  /** Content-Type persisted with the object in storage. */
  mime: string;
  /** Byte length of the *stored* bytes (post-processing, not pre). */
  size: number;
  width?: number;
  height?: number;
  /** Sharp-reported output format ('webp' | 'jpeg' | 'png' | 'gif'). */
  format?: string;
  /** sha256 hex prefix of the stored bytes — same input → same key. */
  hash: string;
}

/**
 * -- POLICIES --------------------------------------------------------
 *
 * These are the source of truth for what the app accepts. Tune here,
 * not in individual controllers.
 */

const IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const AvatarPolicy: MediaPolicy = {
  kind: 'avatar',
  prefix: 'avatars',
  maxBytes: 5 * 1024 * 1024, // 5 MB
  allowedMimes: IMAGE_MIMES,
  image: {
    maxWidth: 512,
    maxHeight: 512,
    targetFormat: 'webp',
    stripMetadata: true,
    fit: 'cover',
    quality: 85,
  },
};

export const ImagePolicy: MediaPolicy = {
  kind: 'image',
  prefix: 'images',
  maxBytes: 10 * 1024 * 1024, // 10 MB
  allowedMimes: IMAGE_MIMES,
  image: {
    maxWidth: 2048,
    maxHeight: 2048,
    targetFormat: 'webp',
    stripMetadata: true,
    fit: 'inside',
    quality: 82,
  },
};
