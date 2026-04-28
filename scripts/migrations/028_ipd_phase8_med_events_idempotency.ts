/**
 * IPD Phase 8.1 Med Order Events Idempotency Index
 *
 * Creates a unique index to prevent duplicate status events.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/028_ipd_phase8_med_events_idempotency.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 8.1 Med Events Idempotency');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const medOrderEvents = db.collection(IPD_COLLECTIONS.medOrderEvents);
  await medOrderEvents.createIndex({ tenantId: 1, orderId: 1, status: 1 }, { unique: true });

  console.log('✅ Med order events idempotency index ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Med events idempotency init failed:', error);
  process.exit(1);
});

