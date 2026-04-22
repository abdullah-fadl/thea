/**
 * Orders Hub Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/034_orders_hub_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Orders Hub Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const orders = db.collection('orders_hub');
  const events = db.collection('order_events');
  const results = db.collection('order_results');
  const acks = db.collection('order_result_acks');

  await orders.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await orders.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: 1 });
  await orders.createIndex({ tenantId: 1, departmentKey: 1, status: 1, createdAt: 1 });
  await orders.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true });

  await events.createIndex({ tenantId: 1, encounterCoreId: 1, time: 1 });
  await events.createIndex({ tenantId: 1, orderId: 1, time: 1 });

  await results.createIndex({ tenantId: 1, orderId: 1, createdAt: 1 });
  await acks.createIndex({ tenantId: 1, orderId: 1, userId: 1 }, { unique: true });

  console.log('✅ Orders Hub indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Orders Hub index init failed:', error);
  process.exit(1);
});
