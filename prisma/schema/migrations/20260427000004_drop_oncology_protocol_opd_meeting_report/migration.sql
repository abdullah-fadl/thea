-- Drop two dead Thea Health Prisma models verified as zero-rows in the live DB.
-- Each model had: zero `prisma.<camel>.*` calls, zero raw-SQL refs against its
-- snake_case table name (one wipe-all-data.sql entry was also removed),
-- zero TS-type usages, and SELECT COUNT(*) returned 0 on the live Supabase
-- instance during Stage C C9 verification.
--
-- CASCADE handles the tenant FK constraint and (for oncology_protocols) the
-- patient FK from OncologyPatient that we removed in oncology.prisma.

DROP TABLE IF EXISTS "oncology_protocols" CASCADE;
DROP TABLE IF EXISTS "opd_meeting_reports" CASCADE;
