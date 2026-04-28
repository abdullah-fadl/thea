/**
 * Order Sets Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/047_order_sets_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Order Sets Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const sets = db.collection('order_sets');
  await sets.createIndex(
    { tenantId: 1, name: 1, scope: 1 },
    { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
  );

  const items = db.collection('order_set_items');
  await items.createIndex({ tenantId: 1, orderSetId: 1, position: 1, _id: 1 });

  const applications = db.collection('order_set_applications');
  await applications.createIndex({ tenantId: 1, orderSetId: 1, encounterRefKey: 1 }, { unique: true });
  await applications.createIndex({ tenantId: 1, encounterRefKey: 1, appliedAt: 1 });

  console.log('✅ Order sets indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Order sets index init failed:', error);
  process.exit(1);
});
