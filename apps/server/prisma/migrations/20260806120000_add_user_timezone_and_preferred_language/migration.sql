-- Add per-user timezone (IANA name) and preferred UI language.
-- Both default to safe values so existing rows are backfilled cleanly.

ALTER TABLE "user"
  ADD COLUMN "timezone" VARCHAR NOT NULL DEFAULT 'UTC',
  ADD COLUMN "preferredLanguage" VARCHAR NOT NULL DEFAULT 'en';
