/**
 * IPD Phase 6.1 Orders Init Migration
 *
 * Creates indexes for ipd_orders collection.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/022_ipd_phase6_orders_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 6.1 Orders Init');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const orders = db.collection(IPD_COLLECTIONS.orders);
  await orders.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await orders.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });
  await orders.createIndex({ tenantId: 1, status: 1 });

  console.log('✅ IPD orders indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ IPD Phase 6.1 init failed:', error);
  process.exit(1);
});

