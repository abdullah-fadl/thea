/**
 * Billing Lock Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/038_billing_lock_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Billing Lock Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const locks = db.collection('billing_lock');

  await locks.createIndex({ tenantId: 1, encounterCoreId: 1 }, { unique: true });
  await locks.createIndex({ tenantId: 1, isLocked: 1 });
  await locks.createIndex({ tenantId: 1, updatedAt: 1 });
  await locks.createIndex({ tenantId: 1, lastLockIdempotencyKey: 1 });
  await locks.createIndex({ tenantId: 1, lastUnlockIdempotencyKey: 1 });

  console.log('✅ Billing lock indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Billing lock index init failed:', error);
  process.exit(1);
});
