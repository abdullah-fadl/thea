/**
 * IPD Phase 8.3 MAR Idempotency Index
 *
 * Creates a unique index for MAR events per order/scheduled/action.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/029_ipd_phase8_mar_idempotency.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 8.3 MAR Idempotency');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const marEvents = db.collection(IPD_COLLECTIONS.marEvents);
  await marEvents.createIndex({ tenantId: 1, orderId: 1, scheduledFor: 1, action: 1 }, { unique: true });

  console.log('✅ MAR idempotency index ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ MAR idempotency init failed:', error);
  process.exit(1);
});

