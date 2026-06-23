-- 1) Rename study_set ownership column
ALTER TABLE "study_set"
  RENAME COLUMN "userId" TO "ownerId";

-- 2) Remove owner collaborator rows to avoid duplicate ownership state
DELETE FROM "study_set_collaborator"
WHERE "role" = 'OWNER';

-- 3) Replace collaborator enum to remove OWNER safely in PostgreSQL
ALTER TYPE "CollaboratorRole" RENAME TO "CollaboratorRole_old";
CREATE TYPE "CollaboratorRole" AS ENUM ('EDITOR', 'VIEWER');

ALTER TABLE "study_set_collaborator"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "CollaboratorRole"
  USING ("role"::text::"CollaboratorRole"),
  ALTER COLUMN "role" SET DEFAULT 'VIEWER';

DROP TYPE "CollaboratorRole_old";

-- 4) Prevent owner from being persisted as a collaborator for the same study set.
-- CHECK constraints cannot use subqueries in PostgreSQL, so use a constraint trigger.
CREATE OR REPLACE FUNCTION enforce_no_owner_as_collaborator()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "study_set" s
    WHERE s."id" = NEW."studySetId"
      AND s."ownerId" = NEW."userId"
  ) THEN
    RAISE EXCEPTION
      'Study set owner cannot be added as collaborator (studySetId=%, userId=%)',
      NEW."studySetId", NEW."userId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_no_owner_as_collaborator ON "study_set_collaborator";
CREATE CONSTRAINT TRIGGER trg_no_owner_as_collaborator
AFTER INSERT OR UPDATE ON "study_set_collaborator"
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW
EXECUTE FUNCTION enforce_no_owner_as_collaborator();
