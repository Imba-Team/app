-- Add a free-text bio column to the user table for public profiles.
-- Nullable so existing rows aren't forced to backfill.

ALTER TABLE "user"
  ADD COLUMN "bio" TEXT;
