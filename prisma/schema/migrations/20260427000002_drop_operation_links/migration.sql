-- Drop the dead `operation_links` table backing the unused OperationLink Prisma model.
-- Confirmed dead: zero references via prisma.operationLink.* anywhere in the codebase.
-- The live SAM helper (lib/sam/operationLinks.ts) targets a different table
-- (`operation_documents`) via raw SQL — see TODO at lib/sam/operationLinks.ts:6.
-- Drop FK constraint first, then indexes, then the table itself.

ALTER TABLE IF EXISTS "operation_links" DROP CONSTRAINT IF EXISTS "operation_links_tenantId_fkey";
DROP INDEX IF EXISTS "operation_links_tenantId_idx";
DROP INDEX IF EXISTS "operation_links_tenantId_documentId_idx";
DROP INDEX IF EXISTS "operation_links_tenantId_operationId_idx";
DROP TABLE IF EXISTS "operation_links";
