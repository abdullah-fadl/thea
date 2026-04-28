-- Phase 3.2 — Core Unit unification table
-- ADDITIVE ONLY: no DROP, RENAME, TRUNCATE, or NOT NULL on existing columns.
-- Do NOT apply until FF_UNIT_DUAL_WRITE cutover is explicitly scheduled.

CREATE TABLE "core_units" (
    "id"                          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "tenantId"                    UUID         NOT NULL,
    "hospitalId"                  UUID,
    "departmentId"                UUID,
    "code"                        TEXT         NOT NULL,
    "name"                        TEXT         NOT NULL,
    "nameAr"                      TEXT,
    "type"                        TEXT         NOT NULL DEFAULT 'clinical',
    "legacyClinicalInfraUnitId"   TEXT,
    "legacyCvisionUnitId"         TEXT,
    "metadata"                    JSONB,
    "createdAt"                   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    "updatedAt"                   TIMESTAMPTZ  NOT NULL,
    "createdBy"                   TEXT,
    "updatedBy"                   TEXT,

    CONSTRAINT "core_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "core_units_tenantId_code_key"
    ON "core_units"("tenantId", "code");

CREATE INDEX "core_units_tenantId_idx"
    ON "core_units"("tenantId");

CREATE INDEX "core_units_tenantId_type_idx"
    ON "core_units"("tenantId", "type");

CREATE INDEX "core_units_legacyClinicalInfraUnitId_idx"
    ON "core_units"("legacyClinicalInfraUnitId");

CREATE INDEX "core_units_legacyCvisionUnitId_idx"
    ON "core_units"("legacyCvisionUnitId");

ALTER TABLE "core_units"
    ADD CONSTRAINT "core_units_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "core_units"
    ADD CONSTRAINT "core_units_hospitalId_fkey"
    FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "core_units"
    ADD CONSTRAINT "core_units_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "core_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
