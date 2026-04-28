/**
 * scripts/backfill-core-units.ts
 *
 * Phase 3.2 — Idempotent backfill of core_units from ClinicalInfraUnit (Health)
 * and CvisionUnit (HR/CVision) legacy tables.
 *
 * Usage:
 *   npx tsx scripts/backfill-core-units.ts
 *
 * Requires DATABASE_URL / DIRECT_URL in .env.local (or environment).
 *
 * Rules:
 * - Safe to re-run: upserts converge to the same state on every run.
 * - Does NOT modify or delete any legacy rows.
 * - Skips ClinicalInfraUnit rows with no shortCode (no canonical code available).
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
    // Pass 1 — ClinicalInfraUnit → type='clinical'
    // -------------------------------------------------------------------------
    console.log('[backfill] Pass 1: ClinicalInfraUnit → core_units (type=clinical)');

    const healthUnits = await prisma.clinicalInfraUnit.findMany({
      select: { id: true, tenantId: true, shortCode: true, name: true },
    });

    console.log(`[backfill] Found ${healthUnits.length} ClinicalInfraUnit rows`);

    for (const unit of healthUnits) {
      // Skip rows with no shortCode — no canonical code to index on
      if (!unit.shortCode) {
        report.rows_skipped++;
        continue;
      }

      const code = unit.shortCode;

      const existing = await prisma.coreUnit.findUnique({
        where: { tenantId_code: { tenantId: unit.tenantId, code } },
        select: { id: true, legacyClinicalInfraUnitId: true },
      });

      if (existing?.legacyClinicalInfraUnitId === unit.id) {
        report.rows_skipped++;
        continue;
      }

      if (existing) {
        // Existing core row for same (tenantId, code) — update ClinicalInfra back-link only
        await prisma.coreUnit.update({
          where: { id: existing.id },
          data: { legacyClinicalInfraUnitId: unit.id, updatedBy: 'backfill-script' },
        });
        report.rows_merged++;
        continue;
      }

      await prisma.coreUnit.create({
        data: {
          tenantId:                  unit.tenantId,
          code,
          name:                      unit.name,
          type:                      'clinical',
          legacyClinicalInfraUnitId: unit.id,
          createdBy:                 'backfill-script',
          updatedBy:                 'backfill-script',
        },
      });
      report.rows_new++;
    }

    // -------------------------------------------------------------------------
    // Pass 2 — CvisionUnit → type='hr', merge to 'both' if ClinicalInfra exists
    // -------------------------------------------------------------------------
    console.log('[backfill] Pass 2: CvisionUnit → core_units (type=hr/both)');

    const cvisionUnits = await prisma.cvisionUnit.findMany({
      select: { id: true, tenantId: true, code: true, name: true, nameAr: true },
    });

    console.log(`[backfill] Found ${cvisionUnits.length} CvisionUnit rows`);

    for (const unit of cvisionUnits) {
      const existing = await prisma.coreUnit.findUnique({
        where: { tenantId_code: { tenantId: unit.tenantId, code: unit.code } },
        select: { id: true, type: true, legacyCvisionUnitId: true },
      });

      if (existing?.legacyCvisionUnitId === unit.id) {
        report.rows_skipped++;
        continue;
      }

      if (existing) {
        // Merge: upgrade type to 'both' and set CVision back-link
        await prisma.coreUnit.update({
          where: { id: existing.id },
          data: {
            legacyCvisionUnitId: unit.id,
            type:                'both',
            nameAr:              unit.nameAr ?? undefined,
            updatedBy:           'backfill-script',
          },
        });
        console.log(`[backfill] Merged (tenantId=${unit.tenantId}, code=${unit.code}) → type=both`);
        report.rows_merged++;
        continue;
      }

      await prisma.coreUnit.create({
        data: {
          tenantId:            unit.tenantId,
          code:                unit.code,
          name:                unit.name,
          nameAr:              unit.nameAr ?? null,
          type:                'hr',
          legacyCvisionUnitId: unit.id,
          createdBy:           'backfill-script',
          updatedBy:           'backfill-script',
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
