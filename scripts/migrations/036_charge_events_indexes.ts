/**
 * Charge Events Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/036_charge_events_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Charge Events Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const events = db.collection('charge_events');

  await events.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: 1 });
  await events.createIndex({ tenantId: 1, status: 1, departmentKey: 1 });
  await events.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
  await events.createIndex(
    {
      tenantId: 1,
      status: 1,
      'source.type': 1,
      'source.orderId': 1,
      'source.orderItemId': 1,
      chargeCatalogId: 1,
    },
    {
      unique: true,
      partialFilterExpression: { status: 'ACTIVE', 'source.type': 'ORDER' },
    }
  );

  console.log('✅ Charge events indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Charge events index init failed:', error);
  process.exit(1);
});
