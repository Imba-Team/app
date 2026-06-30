-- Add optional content fields used by the card editor.
-- Nullable so existing rows aren't forced to backfill.

ALTER TABLE "flashcard"
  ADD COLUMN "example"  TEXT,
  ADD COLUMN "phonetic" TEXT;
