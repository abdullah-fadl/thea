/**
 * Clinical Infra Public IDs Migration
 *
 * - Creates unique indexes for shortCode (tenant-scoped)
 * - Creates public_id_counters collection index
 * - Backfills shortCode for existing clinical infra docs
 * - Adds employeeNo unique index for users
 *
 * Usage:
 *   CLINICAL_INFRA_TENANT_ID=xxx yarn tsx scripts/migrations/057_clinical_infra_public_ids.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { CLINICAL_INFRA_COLLECTIONS } from '../../lib/clinicalInfra/collections';
import { allocateShortCode, PUBLIC_ID_COLLECTION } from '../../lib/clinicalInfra/publicIds';

const TENANT_ID = process.env.CLINICAL_INFRA_TENANT_ID || process.env.TENANT_ID || 'test';

const ENTITY_MAP = [
  { entityType: 'clinical_infra_facility', collection: CLINICAL_INFRA_COLLECTIONS.facilities },
  { entityType: 'clinical_infra_unit', collection: CLINICAL_INFRA_COLLECTIONS.units },
  { entityType: 'clinical_infra_floor', collection: CLINICAL_INFRA_COLLECTIONS.floors },
  { entityType: 'clinical_infra_room', collection: CLINICAL_INFRA_COLLECTIONS.rooms },
  { entityType: 'clinical_infra_bed', collection: CLINICAL_INFRA_COLLECTIONS.beds },
  { entityType: 'clinical_infra_clinic', collection: CLINICAL_INFRA_COLLECTIONS.clinics },
  { entityType: 'clinical_infra_specialty', collection: CLINICAL_INFRA_COLLECTIONS.specialties },
  { entityType: 'clinical_infra_provider', collection: CLINICAL_INFRA_COLLECTIONS.providers },
];

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Clinical Infra Public IDs Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  await db.collection(PUBLIC_ID_COLLECTION).createIndex(
    { tenantId: 1, entityType: 1 },
    { unique: true }
  );

  for (const { collection } of ENTITY_MAP) {
    await db.collection(collection).createIndex(
      { tenantId: 1, shortCode: 1 },
      { unique: true, partialFilterExpression: { shortCode: { $type: 'string' } } }
    );
  }

  await db.collection('users').createIndex(
    { tenantId: 1, employeeNo: 1 },
    { unique: true, partialFilterExpression: { employeeNo: { $type: 'string' } } }
  );

  for (const { entityType, collection } of ENTITY_MAP) {
    const col = db.collection(collection);
    const cursor = col.find(
      {
        tenantId: TENANT_ID,
        $or: [{ shortCode: { $exists: false } }, { shortCode: null }, { shortCode: '' }],
      },
      { projection: { _id: 0, id: 1 } }
    );
    let updated = 0;
    for await (const doc of cursor) {
      const shortCode = await allocateShortCode({ db, tenantId: TENANT_ID, entityType });
      if (!shortCode) continue;
      await col.updateOne(
        { tenantId: TENANT_ID, id: doc.id },
        { $set: { shortCode } }
      );
      updated += 1;
    }
    console.log(`✓ ${collection}: backfilled ${updated} record(s)`);
  }

  console.log('✅ Clinical Infra public IDs ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});

