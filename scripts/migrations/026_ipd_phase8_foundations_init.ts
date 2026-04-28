/**
 * IPD Phase 8 Foundations Init Migration
 *
 * Creates indexes for Phase 8 medication workflow collections.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/026_ipd_phase8_foundations_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 8 Foundations Init');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const medOrders = db.collection(IPD_COLLECTIONS.medOrders);
  await medOrders.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await medOrders.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });
  await medOrders.createIndex({ tenantId: 1, episodeId: 1, status: 1 });
  await medOrders.createIndex({ tenantId: 1, episodeId: 1, drugNameNormalized: 1, route: 1, type: 1, schedule: 1 });

  const medVerifications = db.collection(IPD_COLLECTIONS.medVerifications);
  await medVerifications.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await medVerifications.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });
  await medVerifications.createIndex({ tenantId: 1, orderId: 1, createdAt: -1 });
  await medVerifications.createIndex({ tenantId: 1, orderId: 1, decision: 1 });

  const marEvents = db.collection(IPD_COLLECTIONS.marEvents);
  await marEvents.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await marEvents.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });
  await marEvents.createIndex({ tenantId: 1, orderId: 1, scheduledFor: 1, action: 1 });

  console.log('✅ Phase 8 indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Phase 8 init failed:', error);
  process.exit(1);
});

