/**
 * scripts/propose-orphan-cleanup.ts
 *
 * Phase 3.3 — Read-only orphan analysis and remediation proposals.
 *
 * Lists the first 50 orphaned (employeeId, orphanUserId) pairs and prints
 * three proposed remediation actions with the exact SQL the operator would run.
 * This script NEVER executes any mutations — it only prints.
 *
 * Run audit first:
 *   npx tsx scripts/audit-cvision-employee-user-fk.ts
 *
 * Then, if GATE: FAIL, run this script:
 *   npx tsx scripts/propose-orphan-cleanup.ts
 *
 * Requires DATABASE_URL or DIRECT_URL in environment / .env.local.
 * Read-only — zero writes.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function buildPrisma(): PrismaClient {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set');
  }
  const adapter = new PrismaPg({ connectionString, max: 3 });
  return new PrismaClient({ adapter });
}

interface OrphanRow {
  id:         string;
  employeeNo: string;
  firstName:  string;
  lastName:   string;
  email:      string | null;
  status:     string;
  userId:     string;
}

async function fetchOrphans(prisma: PrismaClient): Promise<OrphanRow[]> {
  return prisma.$queryRaw<OrphanRow[]>`
    SELECT
      e.id,
      e."employeeNo",
      e."firstName",
      e."lastName",
      e.email,
      e.status,
      e."userId"
    FROM cvision_employees e
    WHERE e."userId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = e."userId"
      )
    ORDER BY e."employeeNo"
    LIMIT 50
  `;
}

async function countOrphans(prisma: PrismaClient): Promise<number> {
  const [row] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) AS count
    FROM cvision_employees e
    WHERE e."userId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = e."userId"
      )
  `;
  return Number(row.count);
}

function printProposals(orphans: OrphanRow[], totalOrphans: number): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Phase 3.3 — Orphan Cleanup Proposals (READ-ONLY)    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Total orphaned rows: ${totalOrphans}`);
  if (totalOrphans > 50) {
    console.log(`  (Showing first 50 of ${totalOrphans})`);
  }
  console.log('');

  if (orphans.length === 0) {
    console.log('  No orphans found. Run the audit script to confirm GATE: PASS.');
    console.log('');
    return;
  }

  console.log('  Orphaned employees:');
  console.log('  ─────────────────────────────────────────────────────────────────────────────');
  console.log('  #   employeeId                             employeeNo  status       orphanUserId');
  console.log('  ─────────────────────────────────────────────────────────────────────────────');
  orphans.forEach((row, i) => {
    const idx        = String(i + 1).padStart(3);
    const empId      = row.id.padEnd(38);
    const empNo      = row.employeeNo.padEnd(11);
    const status     = row.status.padEnd(12);
    const orphanUid  = row.userId;
    console.log(`  ${idx} ${empId} ${empNo} ${status} ${orphanUid}`);
  });
  console.log('  ─────────────────────────────────────────────────────────────────────────────');
  console.log('');

  // ─── Proposal A: set userId = NULL ──────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  PROPOSAL A — Set orphaned userId values to NULL (recommended for D-6)');
  console.log('');
  console.log('  Rationale: D-6 states that resigned/historical employees MAY have');
  console.log('  userId = NULL. If the auth user account no longer exists, clearing');
  console.log('  the FK reference is the safest fix.');
  console.log('');
  console.log('  SQL to execute manually (after reviewing the list above):');
  console.log('');
  console.log('    UPDATE cvision_employees');
  console.log('    SET "userId" = NULL,');
  console.log('        "updatedAt" = now()');
  console.log('    WHERE "userId" IS NOT NULL');
  console.log('      AND NOT EXISTS (');
  console.log('        SELECT 1 FROM users u WHERE u.id = cvision_employees."userId"');
  console.log('      );');
  console.log('');

  // ─── Proposal B: create missing User rows ───────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  PROPOSAL B — Create missing User rows from employee data');
  console.log('');
  console.log('  Rationale: If the employee account was accidentally removed from users');
  console.log('  but the employee is still active, recreating the user row preserves the');
  console.log('  link. Only viable if you have enough data (email, tenantId, role).');
  console.log('');
  console.log('  ⚠️  Review each orphan above individually before running this template.');
  console.log('  ⚠️  Replace <ROLE>, <TENANT_ID>, and <HASHED_PASSWORD> as appropriate.');
  console.log('');
  console.log('  SQL template (run once per orphan; substitute actual values):');
  console.log('');
  console.log("    INSERT INTO users (id, \"tenantId\", email, password, \"firstName\",");
  console.log("                      \"lastName\", role, \"isActive\", \"createdAt\", \"updatedAt\")");
  console.log("    VALUES (");
  console.log("      '<orphanUserId>',          -- use the EXACT UUID from the list above");
  console.log("      '<TENANT_ID>',             -- tenant this employee belongs to");
  console.log("      '<employee_email>',         -- from cvision_employees.email");
  console.log("      '<HASHED_PASSWORD>',        -- bcrypt hash of a temporary password");
  console.log("      '<firstName>',             -- from cvision_employees.firstName");
  console.log("      '<lastName>',              -- from cvision_employees.lastName");
  console.log("      '<ROLE>',                  -- e.g. 'staff'");
  console.log("      true,                      -- isActive");
  console.log("      now(),");
  console.log("      now()");
  console.log("    )");
  console.log("    ON CONFLICT (id) DO NOTHING;");
  console.log('');

  // ─── Proposal C: abort ──────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  PROPOSAL C — Abort and investigate further');
  console.log('');
  console.log('  If you are unsure about any orphaned row, stop here. Investigate each');
  console.log('  employee record manually using their employeeNo and orphanUserId.');
  console.log('  Do NOT proceed to VALIDATE CONSTRAINT until all orphans are resolved.');
  console.log('');
  console.log('  After any manual fix, re-run the audit to confirm GATE: PASS:');
  console.log('    npx tsx scripts/audit-cvision-employee-user-fk.ts');
  console.log('');
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  ⚠️  THIS SCRIPT EXECUTED NO WRITES. All actions above are proposals only.');
  console.log('');
}

async function main(): Promise<void> {
  const prisma = buildPrisma();
  try {
    console.log('[propose] Connecting to database...');
    const [orphans, totalOrphans] = await Promise.all([
      fetchOrphans(prisma),
      countOrphans(prisma),
    ]);
    printProposals(orphans, totalOrphans);
    process.exit(0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[propose] Fatal error:', err);
  process.exit(2);
});
