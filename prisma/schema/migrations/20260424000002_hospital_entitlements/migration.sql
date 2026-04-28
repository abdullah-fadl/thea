-- Phase 2.1: hospital-level platform entitlements
-- One row per hospital; NULL columns mean "fall back to tenant-level".
-- When FF_HOSPITAL_ENTITLEMENT is ON, isPlatformEnabled() checks this table
-- before the tenant-level entitlements; when it is OFF the table is ignored.
-- Apply with: npx prisma migrate deploy
-- Never run prisma migrate dev against the production database.

CREATE TABLE "hospital_entitlements" (
    "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
    "hospitalId"         UUID        NOT NULL,
    "tenantId"           UUID        NOT NULL,
    "entitlementSam"     BOOLEAN,
    "entitlementHealth"  BOOLEAN,
    "entitlementEdrac"   BOOLEAN,
    "entitlementCvision" BOOLEAN,
    "entitlementImdad"   BOOLEAN,
    "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedBy"          TEXT,

    CONSTRAINT "hospital_entitlements_pkey" PRIMARY KEY ("id")
);

-- Each hospital has at most one entitlement row
CREATE UNIQUE INDEX "hospital_entitlements_hospitalId_key"
    ON "hospital_entitlements"("hospitalId");

-- Lookup by tenant (used during backfill and by isPlatformEnabled fallback scan)
CREATE INDEX "hospital_entitlements_tenantId_idx"
    ON "hospital_entitlements"("tenantId");

-- Cascade-delete when the hospital is removed
ALTER TABLE "hospital_entitlements"
    ADD CONSTRAINT "hospital_entitlements_hospitalId_fkey"
    FOREIGN KEY ("hospitalId")
    REFERENCES "hospitals"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
