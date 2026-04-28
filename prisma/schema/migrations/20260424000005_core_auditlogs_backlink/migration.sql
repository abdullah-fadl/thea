-- Phase 3.4: Add back-link from audit_logs to cvision_audit_logs
-- Additive only: no DROP, RENAME TABLE, TRUNCATE, or DELETE FROM.
-- Not applied automatically — run `npx prisma migrate deploy` when ready.
-- See NOTES.md §Phase 3.4 for the deployment runbook.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS legacy_cvision_audit_log_id UUID;

CREATE INDEX IF NOT EXISTS audit_logs_legacy_cvision_audit_log_id_idx
  ON audit_logs (legacy_cvision_audit_log_id);
