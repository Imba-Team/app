/** Which flow applied an SM-2 rating. Stored on `SrsReviewLog.source`. */
export type SrsReviewSource = 'SRS' | 'LEARN' | 'TEST';

/** Context the caller passes so `applyReviewByCard` can log the review. */
export interface SrsReviewLogContext {
  setId: string;
  source: Exclude<SrsReviewSource, 'SRS'>;
}
