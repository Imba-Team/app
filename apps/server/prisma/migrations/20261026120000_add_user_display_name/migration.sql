-- Separate, free-form display name. Nullable: existing users keep showing
-- their username (the response DTO falls back to it) until they set one.
ALTER TABLE "user" ADD COLUMN "displayName" VARCHAR;
