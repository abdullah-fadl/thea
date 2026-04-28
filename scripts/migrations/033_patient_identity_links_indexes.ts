/**
 * Patient Identity Links Indexes
 *
 * Ensures deterministic, idempotent linking for ER unknown identities.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/033_patient_identity_links_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Patient Identity Links Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const links = db.collection('patient_identity_links');

  await links.createIndex({ tenantId: 1, sourceSystem: 1, sourceEncounterId: 1 }, { unique: true, sparse: true });
  await links.createIndex({ tenantId: 1, sourceSystem: 1, sourceTempMrn: 1 }, { unique: true, sparse: true });
  await links.createIndex({ tenantId: 1, patientMasterId: 1, createdAt: 1 });

  console.log('✅ Patient identity link indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Patient identity links index migration failed:', error);
  process.exit(1);
});
