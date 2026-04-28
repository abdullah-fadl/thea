-- Phase 3.1 — Core Department unification table
-- ADDITIVE ONLY: no DROP, RENAME, TRUNCATE, or NOT NULL on existing columns.
-- Do NOT apply until FF_DEPARTMENT_DUAL_WRITE cutover is explicitly scheduled.

CREATE TABLE "core_departments" (
    "id"                          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"                    UUID         NOT NULL,
    "hospitalId"                  UUID,
    "code"                        TEXT         NOT NULL,
    "name"                        TEXT         NOT NULL,
    "nameAr"                      TEXT,
    "type"                        TEXT         NOT NULL DEFAULT 'clinical',
    "legacyHealthDepartmentId"    TEXT,
    "legacyCvisionDepartmentId"   TEXT,
    "metadata"                    JSONB,
    "createdAt"                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"                   TIMESTAMPTZ  NOT NULL,
    "createdBy"                   TEXT,
    "updatedBy"                   TEXT,

    CONSTRAINT "core_departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "core_departments_tenantId_code_key"
    ON "core_departments"("tenantId", "code");

CREATE INDEX "core_departments_tenantId_idx"
    ON "core_departments"("tenantId");

CREATE INDEX "core_departments_tenantId_type_idx"
    ON "core_departments"("tenantId", "type");

CREATE INDEX "core_departments_legacyHealthDepartmentId_idx"
    ON "core_departments"("legacyHealthDepartmentId");

CREATE INDEX "core_departments_legacyCvisionDepartmentId_idx"
    ON "core_departments"("legacyCvisionDepartmentId");

ALTER TABLE "core_departments"
    ADD CONSTRAINT "core_departments_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core_departments"
    ADD CONSTRAINT "core_departments_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
