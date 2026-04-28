/**
 * Clinical Notes Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/044_clinical_notes_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Clinical Notes Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const notes = db.collection('clinical_notes');
  await notes.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: 1 });
  await notes.createIndex({ tenantId: 1, patientMasterId: 1, createdAt: 1 });
  await notes.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

  console.log('✅ Clinical notes indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Clinical notes index init failed:', error);
  process.exit(1);
});
