-- Phase 3.3 — Staff Identity FK VALIDATE CONSTRAINT
--
-- ⚠️  DO NOT APPLY THIS FILE via prisma migrate deploy.
-- ⚠️  Run it MANUALLY with psql (or your DB client) AFTER:
--       1. Migration 20260424000004_staff_identity_fk_not_valid is applied.
--       2. npx tsx scripts/audit-cvision-employee-user-fk.ts outputs GATE: PASS.
--       3. All orphaned userId values have been resolved (count = 0).
--
-- What this does:
--   Triggers PostgreSQL to scan cvision_employees and verify that every
--   non-NULL userId references a real row in users.id. Until this step runs,
--   the NOT VALID constraint only guards NEW writes — historical rows remain
--   unvalidated.
--
-- If validation fails:
--   The command raises a constraint violation listing the first offending row.
--   Re-run the audit, remediate the remaining orphans, and retry.
--
-- After this succeeds:
--   Set THEA_FF_STAFF_FK_ENFORCED=true in the environment to enable the
--   Prisma @relation accessor (user: User?) on CvisionEmployee.

ALTER TABLE "cvision_employees"
  VALIDATE CONSTRAINT "cvision_employees_userId_fkey";
