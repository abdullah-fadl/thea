-- Drop 17 dead Imdad Prisma models + 4 orphaned enums.
-- Each table has zero application references via prisma.<camelCase>.* across
-- lib/, app/, scripts/, __tests__/, simulator/, contexts/, hooks/, components/.
-- Each table has zero incoming foreign-key constraints from any other table.
-- Each enum is now used only by tables in this drop list.
-- CASCADE handles the tenant FK constraint and indexes implicitly.

-- 1) Drop dead tables
DROP TABLE IF EXISTS "imdad_audit_log_partitions" CASCADE;
DROP TABLE IF EXISTS "imdad_delegation_chains" CASCADE;
DROP TABLE IF EXISTS "imdad_notification_preferences" CASCADE;
DROP TABLE IF EXISTS "imdad_notification_templates" CASCADE;
DROP TABLE IF EXISTS "imdad_permissions" CASCADE;
DROP TABLE IF EXISTS "imdad_pick_lines" CASCADE;
DROP TABLE IF EXISTS "imdad_print_templates" CASCADE;
DROP TABLE IF EXISTS "imdad_put_away_lines" CASCADE;
DROP TABLE IF EXISTS "imdad_put_away_rules" CASCADE;
DROP TABLE IF EXISTS "imdad_receiving_docks" CASCADE;
DROP TABLE IF EXISTS "imdad_stock_reservations" CASCADE;
DROP TABLE IF EXISTS "imdad_stock_transactions" CASCADE;
DROP TABLE IF EXISTS "imdad_units_of_measure" CASCADE;
DROP TABLE IF EXISTS "imdad_uom_conversions" CASCADE;
DROP TABLE IF EXISTS "imdad_vendor_contacts" CASCADE;
DROP TABLE IF EXISTS "imdad_vendor_documents" CASCADE;
DROP TABLE IF EXISTS "imdad_vendor_scorecards" CASCADE;

-- 2) Drop now-orphaned enums (each was only used by a dropped table)
DROP TYPE IF EXISTS "ImdadDelegationType";
DROP TYPE IF EXISTS "ImdadPermissionCategory";
DROP TYPE IF EXISTS "ImdadReceivingDockStatus";
DROP TYPE IF EXISTS "ImdadUoMType";
