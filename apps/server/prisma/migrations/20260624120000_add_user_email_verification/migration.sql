-- Add email verification tracking to the user table.
-- Existing users are treated as already verified so the migration is non-breaking
-- (only registrations occurring AFTER this migration go through the verify flow).

ALTER TABLE "user"
  ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verifiedAt"    TIMESTAMP(6);

UPDATE "user"
SET    "emailVerified" = true,
       "verifiedAt"    = COALESCE("createdAt", NOW())
WHERE  "emailVerified" = false;
