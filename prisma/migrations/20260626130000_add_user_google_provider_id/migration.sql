-- Add Google OAuth identity column to the user table.
-- Nullable + unique: at most one Mimir account can claim a given Google
-- subject id, but the column stays empty for users who only authenticate
-- via email + password.

ALTER TABLE "user"
  ADD COLUMN "googleProviderId" TEXT;

CREATE UNIQUE INDEX "UQ_user_googleProviderId"
  ON "user" ("googleProviderId");
