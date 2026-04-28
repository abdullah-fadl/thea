-- Phase 3.3 — Staff Identity FK (NOT VALID)
-- ADDITIVE ONLY: no DROP, RENAME, TRUNCATE, or DELETE.
--
-- Why NOT VALID?
--   Adding a plain FOREIGN KEY scans the entire table and locks it until
--   validation completes. NOT VALID skips that scan, so the ALTER is near-
--   instant with no table lock. Existing rows are NOT checked by this step.
--
-- Why DEFERRABLE INITIALLY DEFERRED?
--   Violations surface at transaction COMMIT rather than at the individual
--   INSERT/UPDATE statement, giving callers a chance to satisfy the constraint
--   within the same transaction (e.g. insert User first, then insert Employee).
--
-- What this does NOT do:
--   - Does NOT validate existing rows (that is Migration 2 — manual/validate_staff_fk.sql).
--   - Does NOT add any column or index — userId and its index already exist.
--
-- Run order:
--   1. Apply this migration (prisma migrate deploy).
--   2. Run npx tsx scripts/audit-cvision-employee-user-fk.ts — must output GATE: PASS.
--   3. If orphans > 0, run scripts/propose-orphan-cleanup.ts and remediate manually.
--   4. When GATE: PASS, apply prisma/schema/migrations/manual/validate_staff_fk.sql.
--   5. Set THEA_FF_STAFF_FK_ENFORCED=true in environment.

ALTER TABLE "cvision_employees"
  ADD CONSTRAINT "cvision_employees_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;
