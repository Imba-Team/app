export const STORAGE_CLIENT = 'STORAGE_CLIENT';

/**
 * Logical buckets the app uses. The actual MinIO bucket name is shared
 * (MINIO_BUCKET env), and these strings are prefixes inside that bucket
 * so we don't need per-bucket policies in MinIO Console.
 */
export const StoragePrefix = {
  AVATARS: 'avatars',
  STUDY_SET_AUDIO: 'study-set-audio',
  AI_GENERATION: 'ai-generation',
} as const;

export type StoragePrefixValue =
  (typeof StoragePrefix)[keyof typeof StoragePrefix];
