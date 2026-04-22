/**
 * Clinical Handover Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/049_handover_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Clinical Handover Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const handovers = db.collection('clinical_handover');
  await handovers.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: 1 });
  await handovers.createIndex({ tenantId: 1, episodeId: 1, createdAt: 1 });
  await handovers.createIndex({ tenantId: 1, status: 1 });
  await handovers.createIndex({ tenantId: 1, toUserId: 1 });
  await handovers.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

  console.log('✅ Clinical handover indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Clinical handover index init failed:', error);
  process.exit(1);
});
