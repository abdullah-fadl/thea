/**
 * IPD Phase 6.2 Nursing Init Migration
 *
 * Creates indexes for ipd_vitals and ipd_nursing_notes.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/023_ipd_phase6_nursing_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 6.2 Nursing Init');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const vitals = db.collection(IPD_COLLECTIONS.vitals);
  await vitals.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await vitals.createIndex({ tenantId: 1, episodeId: 1, recordedAt: -1 });
  await vitals.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });

  const nursingNotes = db.collection(IPD_COLLECTIONS.nursingNotes);
  await nursingNotes.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await nursingNotes.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });

  console.log('✅ IPD nursing indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ IPD Phase 6.2 init failed:', error);
  process.exit(1);
});

