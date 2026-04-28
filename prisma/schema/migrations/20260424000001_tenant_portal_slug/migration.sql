-- Phase 1: patient portal slug routing
-- Adds a unique, nullable slug column to tenants for slug-based portal routing.
-- Apply in production with: npx prisma migrate deploy
-- Never run prisma migrate dev against the production database.

ALTER TABLE "tenants" ADD COLUMN "portalSlug" TEXT;
CREATE UNIQUE INDEX "tenants_portalSlug_key" ON "tenants"("portalSlug");
