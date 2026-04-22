/**
 * Order Context Links Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/045_order_context_links_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Order Context Links Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const links = db.collection('order_context_links');
  await links.createIndex({ tenantId: 1, orderId: 1 }, { unique: true });
  await links.createIndex({ tenantId: 1, encounterCoreId: 1 });
  await links.createIndex({ tenantId: 1, noteId: 1 });
  await links.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

  console.log('✅ Order context links indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Order context links index init failed:', error);
  process.exit(1);
});
