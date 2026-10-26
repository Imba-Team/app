-- Learn "match the pairs" warm-up toggle (MIM-20). On by default; the
-- warm-up is practice only, so no attempt data is involved.
ALTER TABLE "user_set_preferences"
  ADD COLUMN "matchingEnabled" BOOLEAN NOT NULL DEFAULT true;
