/**
 * Results & Attachments Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/046_results_attachments_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Results & Attachments Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const results = db.collection('order_results');
  await results.createIndex({ tenantId: 1, orderId: 1, createdAt: 1 });
  await results.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

  const acks = db.collection('result_acks');
  await acks.createIndex({ tenantId: 1, orderResultId: 1, userId: 1 }, { unique: true });
  await acks.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

  const attachments = db.collection('attachments');
  await attachments.createIndex({ tenantId: 1, entityType: 1, entityId: 1, createdAt: 1 });
  await attachments.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

  console.log('✅ Results & attachments indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Results & attachments index init failed:', error);
  process.exit(1);
});
