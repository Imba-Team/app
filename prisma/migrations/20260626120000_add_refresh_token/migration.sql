-- Refresh token storage for the rotating-refresh-token JWT flow.
-- Tokens are stored hashed (sha-256, hex) — never the raw value.
-- familyId groups every token in a rotation chain so a single replay can
-- revoke the whole chain.

CREATE TABLE "refresh_token" (
  "id"                UUID         NOT NULL,
  "userId"            UUID         NOT NULL,
  "tokenHash"         TEXT         NOT NULL,
  "familyId"          UUID         NOT NULL,
  "parentId"          UUID,
  "expiresAt"         TIMESTAMP(6) NOT NULL,
  "revokedAt"         TIMESTAMP(6),
  "replacedByTokenId" UUID,
  "userAgent"         TEXT,
  "ipAddress"         TEXT,
  "createdAt"         TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PK_refresh_token"        PRIMARY KEY ("id"),
  CONSTRAINT "UQ_refresh_token_hash"   UNIQUE ("tokenHash"),
  CONSTRAINT "FK_refresh_token_user"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX "IX_refresh_token_userId"    ON "refresh_token" ("userId");
CREATE INDEX "IX_refresh_token_familyId"  ON "refresh_token" ("familyId");
CREATE INDEX "IX_refresh_token_expiresAt" ON "refresh_token" ("expiresAt");
