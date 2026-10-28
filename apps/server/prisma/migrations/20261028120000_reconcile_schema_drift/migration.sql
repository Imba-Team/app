-- Reconcile the migration history with schema.prisma (MIM-54).
--
-- Earlier hand-written migrations used TypeORM-style names and DB-level
-- defaults that schema.prisma doesn't declare, so `prisma migrate diff
-- --from-migrations --to-schema-datamodel` was never empty. Nothing here
-- changes behaviour: it renames constraints/indexes to Prisma's names and
-- aligns column defaults. Every step is guarded so the migration is safe on
-- databases that were created or patched some other way (e.g. `db push`).

-- Prisma generates ids client-side (@default(uuid())); drop the DB defaults.
ALTER TABLE "user" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "card_attempt" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "test_matching_pair" ALTER COLUMN "id" DROP DEFAULT;

-- Columns the app always sets explicitly.
ALTER TABLE "test_attempt" ALTER COLUMN "questionCount" DROP DEFAULT;
ALTER TABLE "test_question_attempt"
  ALTER COLUMN "questionType" DROP DEFAULT,
  ALTER COLUMN "promptText" DROP DEFAULT,
  ALTER COLUMN "expectedAnswer" DROP DEFAULT,
  ALTER COLUMN "answerDirection" DROP DEFAULT,
  ALTER COLUMN "orderIndex" DROP DEFAULT;
ALTER TABLE "user_set_preferences" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "user_test_preferences" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- schema.prisma says false; SetPreferencesService already writes false.
ALTER TABLE "user_set_preferences" ALTER COLUMN "autoAdvance" SET DEFAULT false;

DO $reconcile$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_refresh_token') THEN
    ALTER TABLE "refresh_token" RENAME CONSTRAINT "PK_refresh_token" TO "refresh_token_pkey";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_set_userId_fkey') THEN
    ALTER TABLE "study_set" RENAME CONSTRAINT "study_set_userId_fkey" TO "study_set_ownerId_fkey";
  END IF;

  -- Same columns and ON DELETE CASCADE; Prisma's name and ON UPDATE CASCADE.
  ALTER TABLE "refresh_token" DROP CONSTRAINT IF EXISTS "FK_refresh_token_user";
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refresh_token_userId_fkey') THEN
    ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$reconcile$;

ALTER INDEX IF EXISTS "IX_refresh_token_expiresAt" RENAME TO "refresh_token_expiresAt_idx";
ALTER INDEX IF EXISTS "IX_refresh_token_familyId" RENAME TO "refresh_token_familyId_idx";
ALTER INDEX IF EXISTS "IX_refresh_token_userId" RENAME TO "refresh_token_userId_idx";
ALTER INDEX IF EXISTS "UQ_refresh_token_hash" RENAME TO "refresh_token_tokenHash_key";
ALTER INDEX IF EXISTS "UQ_user_googleProviderId" RENAME TO "user_googleProviderId_key";
