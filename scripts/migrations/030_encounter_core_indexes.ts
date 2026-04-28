/**
 * Encounter Core Indexes (Phase X)
 *
 * Ensures unique core encounters per source and per id.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/030_encounter_core_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Encounter Core Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const encounters = db.collection('encounter_core');

  await encounters.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await encounters.createIndex(
    { tenantId: 1, 'source.system': 1, 'source.sourceId': 1 },
    { unique: true }
  );
  await encounters.createIndex({ tenantId: 1, patientId: 1, status: 1 });
  await encounters.createIndex({ tenantId: 1, createdAt: 1, _id: 1 });

  console.log('✅ Encounter core indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Encounter core index migration failed:', error);
  process.exit(1);
});
