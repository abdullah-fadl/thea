-- Extend PxCase with full case-management columns and add timeline (PxComment)
-- + visit-experience (PxVisitExperience) sibling tables for the Patient
-- Experience module build (4 pages, 10 API routes).
--
-- Strictly additive: no existing column is dropped or retyped. Safe to run
-- against an existing px_cases table. New tables use IF NOT EXISTS so the
-- migration is idempotent at table-create time.

-- ── 1. PxCase additive columns ────────────────────────────────────────────
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "caseNumber"        SERIAL;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "patientId"         UUID;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "categoryKey"       TEXT;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "subjectName"       TEXT;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "subjectMrn"        TEXT;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "contactPhone"      TEXT;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "contactEmail"      TEXT;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "assigneeUserId"    UUID;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "createdByUserId"   UUID;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "satisfactionScore" INTEGER;
ALTER TABLE "px_cases" ADD COLUMN IF NOT EXISTS "resolutionNotes"   TEXT;

-- caseNumber must be globally unique (matches @unique on the Prisma model).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname  = 'px_cases_caseNumber_key'
    ) THEN
        ALTER TABLE "px_cases"
            ADD CONSTRAINT "px_cases_caseNumber_key" UNIQUE ("caseNumber");
    END IF;
END$$;

-- New supporting indexes for filterable columns.
CREATE INDEX IF NOT EXISTS "px_cases_tenantId_categoryKey_idx"
    ON "px_cases" ("tenantId", "categoryKey");
CREATE INDEX IF NOT EXISTS "px_cases_tenantId_assigneeUserId_idx"
    ON "px_cases" ("tenantId", "assigneeUserId");
CREATE INDEX IF NOT EXISTS "px_cases_tenantId_createdAt_idx"
    ON "px_cases" ("tenantId", "createdAt");

-- ── 2. PxComment (case timeline) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "px_comments" (
    "id"            UUID                       PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"      UUID                       NOT NULL,
    "caseId"        UUID                       NOT NULL,
    "authorUserId"  UUID,
    "authorName"    TEXT,
    "kind"          TEXT                       NOT NULL DEFAULT 'COMMENT',
    "body"          TEXT                       NOT NULL,
    "metadata"      JSONB,
    "createdAt"     TIMESTAMPTZ                NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'px_comments_caseId_fkey'
    ) THEN
        ALTER TABLE "px_comments"
            ADD CONSTRAINT "px_comments_caseId_fkey"
            FOREIGN KEY ("caseId") REFERENCES "px_cases"("id") ON DELETE CASCADE;
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS "px_comments_tenantId_idx"
    ON "px_comments" ("tenantId");
CREATE INDEX IF NOT EXISTS "px_comments_caseId_createdAt_idx"
    ON "px_comments" ("caseId", "createdAt");

-- ── 3. PxVisitExperience (visit-level satisfaction signal) ───────────────
CREATE TABLE IF NOT EXISTS "px_visit_experiences" (
    "id"                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId"          UUID         NOT NULL,
    "visitId"           UUID,
    "patientId"         UUID,
    "patientName"       TEXT,
    "patientMrn"        TEXT,
    "departmentKey"     TEXT,
    "visitDate"         TIMESTAMPTZ,
    "satisfactionScore" INTEGER,
    "sentiment"         TEXT,
    "hasComplaint"      BOOLEAN      NOT NULL DEFAULT FALSE,
    "feedbackText"      TEXT,
    "recordedByUserId"  UUID,
    "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'px_visit_experiences_tenantId_fkey'
    ) THEN
        ALTER TABLE "px_visit_experiences"
            ADD CONSTRAINT "px_visit_experiences_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id");
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS "px_visit_experiences_tenantId_idx"
    ON "px_visit_experiences" ("tenantId");
CREATE INDEX IF NOT EXISTS "px_visit_experiences_tenantId_visitDate_idx"
    ON "px_visit_experiences" ("tenantId", "visitDate");
CREATE INDEX IF NOT EXISTS "px_visit_experiences_tenantId_departmentKey_idx"
    ON "px_visit_experiences" ("tenantId", "departmentKey");
CREATE INDEX IF NOT EXISTS "px_visit_experiences_tenantId_sentiment_idx"
    ON "px_visit_experiences" ("tenantId", "sentiment");
