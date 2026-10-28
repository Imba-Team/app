/**
 * Maximum lengths for user free text, shared by DTO validators and the
 * CSV importer (which bypasses the ValidationPipe). Generous on purpose:
 * they exist to stop abuse (multi-megabyte titles), not to constrain
 * normal content.
 */
export const textLimits = {
  cardTerm: 500,
  cardDefinition: 5000,
  cardExample: 1000,
  cardPhonetic: 200,
  cardHint: 500,
  assetRef: 2048,
  setTitle: 200,
  setDescription: 2000,
  language: 50,
  tagName: 50,
  maxTags: 10,
  displayName: 50,
  searchQuery: 200,
} as const;

/**
 * A stored image reference: either an absolute http(s) URL or a storage
 * object name such as `images/abc.jpg`. Rejects other schemes
 * (`javascript:`, `data:`, …) so the value is safe in an `<img src>`.
 */
export const assetRefPattern = /^(https?:\/\/\S+|[A-Za-z0-9][\w\-./]*)$/;

/** Display names and usernames never need angle brackets. */
export const noAngleBracketsPattern = /^[^<>]*$/;
