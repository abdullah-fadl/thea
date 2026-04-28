/**
 * Delete a medication from the catalog.
 * Tries medication_catalog first, then charge_catalog (itemType=MEDICATION).
 * Usage: npx tsx scripts/delete-medication.ts
 *        MED_CODE="MED-0001" npx tsx scripts/delete-medication.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import { prisma } from '../lib/db/prisma';

async function main() {
  const search = process.env.MED_CODE || process.env.MED_NAME || 'MED-0001';
  const isCode = !!process.env.MED_CODE || /^MED-\d+$/i.test(search);

  // Try medication_catalog first
  const medWhere = isCode
    ? { chargeCode: { equals: search, mode: 'insensitive' as const } }
    : {
        OR: [
          { genericName: { contains: search, mode: 'insensitive' as const } },
          { chargeCode: { contains: search, mode: 'insensitive' as const } },
        ],
      };
  const meds = await prisma.medicationCatalog.findMany({ where: medWhere });
  if (meds.length > 0) {
    const med = meds[0];
    console.log('Deleting from medication_catalog:', med.genericName, '-', med.chargeCode);
    await prisma.medicationCatalog.delete({ where: { id: med.id } });
    console.log('Deleted.');
    return;
  }

  // Fallback: delete from charge_catalog (MEDICATION type)
  const chargeWhere = isCode
    ? { itemType: 'MEDICATION', code: { equals: search, mode: 'insensitive' as const } }
    : { itemType: 'MEDICATION', name: { contains: search, mode: 'insensitive' as const } };
  const charges = await prisma.billingChargeCatalog.findMany({ where: chargeWhere });
  if (charges.length === 0) {
    console.error('Medication/charge not found:', search);
    process.exit(1);
  }
  const charge = charges[0];
  console.log('Deleting from charge_catalog:', charge.name, '-', charge.code);
  await prisma.billingChargeCatalog.delete({ where: { id: charge.id } });
  console.log('Deleted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
