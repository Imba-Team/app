-- Baseline: the schema as it was before the first tracked migration
-- (20260422120000_study_set_owner_refactor). The early tables were created
-- by TypeORM and later adopted by Prisma, so the migration history had no
-- CREATE TABLE statements and `prisma migrate deploy` failed on an empty
-- database (MIM-54).
--
-- Generated with
--   prisma migrate diff --from-empty --to-schema-datamodel <schema.prisma at 64365d6^> --script
--
-- Databases created before this baseline existed (e.g. production) already
-- have these tables. The guard below turns the migration into a no-op there,
-- so `prisma migrate deploy` just records it as applied — no manual
-- `prisma migrate resolve` needed.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $baseline$
BEGIN
IF to_regclass('public."user"') IS NOT NULL THEN
  RAISE NOTICE 'baseline: tables already exist, skipping';
  RETURN;
END IF;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "StudySetVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');

-- CreateEnum
CREATE TYPE "StudySessionMode" AS ENUM ('FLASHCARD', 'LEARN', 'TEST', 'MATCH');

-- CreateEnum
CREATE TYPE "CollaboratorRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR NOT NULL,
    "username" VARCHAR,
    "password" TEXT NOT NULL,
    "status" VARCHAR,
    "role" VARCHAR NOT NULL DEFAULT 'user',
    "profilePicture" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_set" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "StudySetVisibility" NOT NULL DEFAULT 'PUBLIC',
    "language" TEXT,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_9ffbc0a95bdd09c53487260fba9" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard" (
    "id" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "hint" TEXT,
    "status" TEXT,
    "studySetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_e0aba0501d3bc532951efc9f791" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard_user_state" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "flashcardId" UUID NOT NULL,
    "nextReviewAt" TIMESTAMP(3),
    "intervalDays" INTEGER NOT NULL DEFAULT 1,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_616340a0e26f88788bcf446b11b" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studySetId" UUID NOT NULL,
    "cardsStudied" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "incorrectAnswers" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "mode" "StudySessionMode" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PK_d09225f8e9d2b6682e3b13c46e0" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_study_set" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studySetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_3f3f685650d3229b9517ebdc278" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studySetId" UUID NOT NULL,
    "parentCommentId" UUID,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_0b0e4bbc8415ec426f87f3a88e2" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_set_collaborator" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studySetId" UUID NOT NULL,
    "role" "CollaboratorRole" NOT NULL DEFAULT 'VIEWER',

    CONSTRAINT "PK_60ff544bfe147cbe883f4aa87de" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled folder',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_6278a41a706740c94c02e288df8" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_study_set" (
    "id" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "studySetId" UUID NOT NULL,

    CONSTRAINT "PK_9553258bfa14b6f6cae98bac7c5" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_8e4052373c579afc1471f526760" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_set_tag" (
    "id" UUID NOT NULL,
    "studySetId" UUID NOT NULL,
    "tagId" UUID NOT NULL,

    CONSTRAINT "PK_64842c32f244afa237bbc2ce4c8" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "studySetId" UUID NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PK_e9fb46f732ef63877b65484637a" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_question_attempt" (
    "id" UUID NOT NULL,
    "testAttemptId" UUID NOT NULL,
    "flashcardId" UUID NOT NULL,
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_4b0beed24cd6196f6c6905183e2" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_links" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PK_6c609d48037f164e7ae5b744b18" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UQ_e12875dfb3b1d92d7d7c5377e22" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UQ_78a916df40e02a9deb1c4b75edb" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "study_set_slug_key" ON "study_set"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "flashcard_user_state_userId_flashcardId_key" ON "flashcard_user_state"("userId", "flashcardId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_study_set_userId_studySetId_key" ON "favorite_study_set"("userId", "studySetId");

-- CreateIndex
CREATE UNIQUE INDEX "study_set_collaborator_userId_studySetId_key" ON "study_set_collaborator"("userId", "studySetId");

-- CreateIndex
CREATE UNIQUE INDEX "folder_study_set_folderId_studySetId_key" ON "folder_study_set"("folderId", "studySetId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_name_key" ON "tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tag_slug_key" ON "tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "study_set_tag_studySetId_tagId_key" ON "study_set_tag"("studySetId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_key_key" ON "magic_links"("key");

-- AddForeignKey
ALTER TABLE "study_set" ADD CONSTRAINT "study_set_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_user_state" ADD CONSTRAINT "flashcard_user_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_user_state" ADD CONSTRAINT "flashcard_user_state_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "flashcard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session" ADD CONSTRAINT "study_session_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_study_set" ADD CONSTRAINT "favorite_study_set_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_study_set" ADD CONSTRAINT "favorite_study_set_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_set_collaborator" ADD CONSTRAINT "study_set_collaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_set_collaborator" ADD CONSTRAINT "study_set_collaborator_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder" ADD CONSTRAINT "folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_study_set" ADD CONSTRAINT "folder_study_set_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_study_set" ADD CONSTRAINT "folder_study_set_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_set_tag" ADD CONSTRAINT "study_set_tag_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_set_tag" ADD CONSTRAINT "study_set_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt" ADD CONSTRAINT "test_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt" ADD CONSTRAINT "test_attempt_studySetId_fkey" FOREIGN KEY ("studySetId") REFERENCES "study_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_question_attempt" ADD CONSTRAINT "test_question_attempt_testAttemptId_fkey" FOREIGN KEY ("testAttemptId") REFERENCES "test_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_question_attempt" ADD CONSTRAINT "test_question_attempt_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "flashcard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


END
$baseline$;
