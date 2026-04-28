/**
 * scripts/backfill-core-departments.ts
 *
 * Phase 3.1 — Idempotent backfill of core_departments from Health (departments)
 * and CVision (cvision_departments) legacy tables.
 *
 * Usage:
 *   npx tsx scripts/backfill-core-departments.ts
 *
 * Requires DATABASE_URL / DIRECT_URL in .env.local (or environment).
 *
 * Rules:
 * - Safe to re-run: upserts converge to the same state on every run.
 * - Does NOT modify or delete any legacy rows.
 * - Reports: rows_new, rows_merged, rows_skipped, elapsed_ms.
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

interface Report {
  rows_new:     number;
  rows_merged:  number;
  rows_skipped: number;
  elapsed_ms:   number;
}

async function main(): Promise<void> {
  const prisma = buildPrisma();
  const startAt = Date.now();

  const report: Report = { rows_new: 0, rows_merged: 0, rows_skipped: 0, elapsed_ms: 0 };

  try {
    // -------------------------------------------------------------------------
    // Pass 1 — Health departments → type='clinical'
    // -------------------------------------------------------------------------
    console.log('[backfill] Pass 1: Health departments → core_departments (type=clinical)');

    const healthDepts = await prisma.department.findMany({
      select: { id: true, tenantId: true, code: true, name: true, isActive: true },
    });

    console.log(`[backfill] Found ${healthDepts.length} Health department rows`);

    for (const dept of healthDepts) {
      const existing = await prisma.coreDepartment.findUnique({
        where: { tenantId_code: { tenantId: dept.tenantId, code: dept.code } },
        select: { id: true, legacyHealthDepartmentId: true },
      });

      if (existing?.legacyHealthDepartmentId === dept.id) {
        report.rows_skipped++;
        continue;
      }

      if (existing) {
        // Existing core row for same (tenantId, code) — update Health back-link only
        await prisma.coreDepartment.update({
          where: { id: existing.id },
          data: { legacyHealthDepartmentId: dept.id, updatedBy: 'backfill-script' },
        });
        report.rows_merged++;
        continue;
      }

      await prisma.coreDepartment.create({
        data: {
          tenantId:                 dept.tenantId,
          code:                     dept.code,
          name:                     dept.name,
          type:                     'clinical',
          legacyHealthDepartmentId: dept.id,
          createdBy:                'backfill-script',
          updatedBy:                'backfill-script',
        },
      });
      report.rows_new++;
    }

    // -------------------------------------------------------------------------
    // Pass 2 — CVision departments → type='hr', merge to 'both' if Health exists
    // -------------------------------------------------------------------------
    console.log('[backfill] Pass 2: CVision departments → core_departments (type=hr/both)');

    const cvisionDepts = await prisma.cvisionDepartment.findMany({
      select: { id: true, tenantId: true, code: true, name: true, nameAr: true },
    });

    console.log(`[backfill] Found ${cvisionDepts.length} CVision department rows`);

    for (const dept of cvisionDepts) {
      const existing = await prisma.coreDepartment.findUnique({
        where: { tenantId_code: { tenantId: dept.tenantId, code: dept.code } },
        select: { id: true, type: true, legacyCvisionDepartmentId: true },
      });

      if (existing?.legacyCvisionDepartmentId === dept.id) {
        report.rows_skipped++;
        continue;
      }

      if (existing) {
        // Merge: upgrade type to 'both' and set CVision back-link
        await prisma.coreDepartment.update({
          where: { id: existing.id },
          data: {
            legacyCvisionDepartmentId: dept.id,
            type:      'both',
            nameAr:    dept.nameAr ?? undefined,
            updatedBy: 'backfill-script',
          },
        });
        console.log(`[backfill] Merged (tenantId=${dept.tenantId}, code=${dept.code}) → type=both`);
        report.rows_merged++;
        continue;
      }

      await prisma.coreDepartment.create({
        data: {
          tenantId:                  dept.tenantId,
          code:                      dept.code,
          name:                      dept.name,
          nameAr:                    dept.nameAr ?? null,
          type:                      'hr',
          legacyCvisionDepartmentId: dept.id,
          createdBy:                 'backfill-script',
          updatedBy:                 'backfill-script',
        },
      });
      report.rows_new++;
    }

  } finally {
    await prisma.$disconnect();
  }

  report.elapsed_ms = Date.now() - startAt;

  console.log('\n[backfill] ── Final Report ────────────────────────────');
  console.log(`  rows_new:     ${report.rows_new}`);
  console.log(`  rows_merged:  ${report.rows_merged}`);
  console.log(`  rows_skipped: ${report.rows_skipped}`);
  console.log(`  elapsed_ms:   ${report.elapsed_ms}`);
  console.log('[backfill] ────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('[backfill] Fatal error:', err);
  process.exit(1);
});
