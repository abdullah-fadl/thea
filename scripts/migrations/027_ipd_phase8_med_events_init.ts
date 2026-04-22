/**
 * IPD Phase 8.1 Med Order Events Init Migration
 *
 * Creates indexes for ipd_med_order_events.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/027_ipd_phase8_med_events_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 8.1 Med Order Events Init');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const medOrderEvents = db.collection(IPD_COLLECTIONS.medOrderEvents);
  await medOrderEvents.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await medOrderEvents.createIndex({ tenantId: 1, orderId: 1, createdAt: -1 });
  await medOrderEvents.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });
  await medOrderEvents.createIndex({ tenantId: 1, orderId: 1, status: 1 });

  console.log('✅ Med order events indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Med order events init failed:', error);
  process.exit(1);
});

