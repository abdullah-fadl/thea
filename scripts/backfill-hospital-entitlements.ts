/**
 * Backfill Hospital Entitlements — Phase 2.1
 *
 * For every existing Hospital, creates one HospitalEntitlement row that mirrors
 * the parent tenant's current entitlement flags. This means that after the
 * backfill, flipping FF_HOSPITAL_ENTITLEMENT=true changes nothing semantically:
 * every hospital inherits exactly what its tenant already had.
 *
 * Hospitals that already have a row are skipped (idempotent).
 *
 * Usage:
 *   npx tsx scripts/backfill-hospital-entitlements.ts
 *
 * Prerequisites:
 *   - MIGRATION_URL / DIRECT_URL / DATABASE_URL set in .env.local
 *   - migration 20260424000002_hospital_entitlements already applied
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const connectionString =
  process.env.MIGRATION_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL/DIRECT_URL/MIGRATION_URL is not set in .env.local');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('\n🏥 Backfill Hospital Entitlements — Phase 2.1\n');

  // Load all hospitals with their tenant entitlements in one query
  const hospitals = await prisma.hospital.findMany({
    select: {
      id: true,
      tenantId: true,
      name: true,
      tenant: {
        select: {
          entitlementSam: true,
          entitlementHealth: true,
          entitlementEdrac: true,
          entitlementCvision: true,
          entitlementScm: true,
        },
      },
    },
  });

  console.log(`   Found ${hospitals.length} hospital(s) to process.\n`);

  let created = 0;
  let skipped = 0;

  for (const hospital of hospitals) {
    const existing = await prisma.hospitalEntitlement.findUnique({
      where: { hospitalId: hospital.id },
    });

    if (existing) {
      console.log(`   ⏭  Skipped "${hospital.name}" — row already exists`);
      skipped++;
      continue;
    }

    await prisma.hospitalEntitlement.create({
      data: {
        hospitalId: hospital.id,
        tenantId: hospital.tenantId,
        entitlementSam: hospital.tenant.entitlementSam,
        entitlementHealth: hospital.tenant.entitlementHealth,
        entitlementEdrac: hospital.tenant.entitlementEdrac,
        entitlementCvision: hospital.tenant.entitlementCvision,
        entitlementImdad: hospital.tenant.entitlementScm,
      },
    });

    console.log(`   ✅ Created entitlement row for "${hospital.name}"`);
    created++;
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Backfill complete: ${created} created, ${skipped} skipped`);
  console.log('═'.repeat(50));
  console.log('\n⚠️  Remember: flip FF_HOSPITAL_ENTITLEMENT only after this script runs.\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
