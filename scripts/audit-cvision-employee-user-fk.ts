/**
 * scripts/audit-cvision-employee-user-fk.ts
 *
 * Phase 3.3 — Read-only audit of cvision_employees.userId integrity.
 *
 * Queries four counts needed to gate the FK constraint addition:
 *   1. Total rows in cvision_employees.
 *   2. Rows where userId IS NULL (allowed per D-6 — resigned/historical employees).
 *   3. Rows where userId IS NOT NULL AND matches a row in users (valid references).
 *   4. Rows where userId IS NOT NULL AND has NO match in users (orphans — must be 0 before FK).
 *
 * GATE: PASS when orphans = 0. FAIL when orphans > 0.
 *
 * Usage:
 *   npx tsx scripts/audit-cvision-employee-user-fk.ts
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

interface AuditResult {
  total:        number;
  nullUserId:   number;
  validUserId:  number;
  orphanUserId: number;
  gatePass:     boolean;
}

async function runAudit(prisma: PrismaClient): Promise<AuditResult> {
  const [[totalRow], [nullRow], [validRow], [orphanRow]] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM cvision_employees
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM cvision_employees
      WHERE "userId" IS NULL
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM cvision_employees e
      JOIN users u ON e."userId" = u.id
    `,
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM cvision_employees e
      WHERE e."userId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM users u WHERE u.id = e."userId"
        )
    `,
  ]);

  const total        = Number(totalRow.count);
  const nullUserId   = Number(nullRow.count);
  const validUserId  = Number(validRow.count);
  const orphanUserId = Number(orphanRow.count);

  return {
    total,
    nullUserId,
    validUserId,
    orphanUserId,
    gatePass: orphanUserId === 0,
  };
}

function printReport(result: AuditResult): void {
  const line = (label: string, value: number | string) =>
    console.log(`  ${label.padEnd(32)} ${value}`);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Phase 3.3 — Staff Identity FK Audit Report          ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  cvision_employees');
  console.log('  ─────────────────────────────────────────────────────');
  line('Total rows:',             result.total);
  line('userId IS NULL:',         result.nullUserId);
  line('userId valid (→ users):', result.validUserId);
  line('userId orphaned (BAD):',  result.orphanUserId);
  console.log('  ─────────────────────────────────────────────────────');
  console.log('');

  if (result.gatePass) {
    console.log('  GATE: ✅ PASS');
    console.log('  No orphaned userId values found.');
    console.log('  Safe to add NOT VALID constraint (Migration 1).');
    console.log('  After cleanup + re-audit, run VALIDATE CONSTRAINT (Migration 2).');
  } else {
    console.log('  GATE: ❌ FAIL');
    console.log(`  ${result.orphanUserId} orphaned userId value(s) found.`);
    console.log('  Run scripts/propose-orphan-cleanup.ts for remediation options.');
    console.log('  Do NOT proceed to VALIDATE CONSTRAINT until orphan count = 0.');
  }

  console.log('');
}

async function main(): Promise<void> {
  const prisma = buildPrisma();
  try {
    console.log('[audit] Connecting to database...');
    const result = await runAudit(prisma);
    printReport(result);
    process.exit(result.gatePass ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[audit] Fatal error:', err);
  process.exit(2);
});
