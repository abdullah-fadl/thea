/**
 * IPD Phase 6.3 Med Orders Init Migration
 *
 * Creates indexes for ipd_med_orders.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/024_ipd_phase6_meds_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 6.3 Med Orders Init');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const medOrders = db.collection(IPD_COLLECTIONS.medOrders);
  await medOrders.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await medOrders.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });
  await medOrders.createIndex({ tenantId: 1, episodeId: 1, drugNameNormalized: 1, route: 1, timing: 1 });

  console.log('✅ IPD med orders indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ IPD Phase 6.3 init failed:', error);
  process.exit(1);
});

