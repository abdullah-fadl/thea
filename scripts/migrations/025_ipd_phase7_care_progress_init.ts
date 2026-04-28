/**
 * IPD Phase 7 Care Plans & Daily Progress Init Migration
 *
 * Creates indexes for care plans and daily progress collections.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/025_ipd_phase7_care_progress_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 7 Init');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const carePlans = db.collection(IPD_COLLECTIONS.carePlans);
  await carePlans.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await carePlans.createIndex({ tenantId: 1, episodeId: 1, status: 1 });
  await carePlans.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });

  const doctorProgress = db.collection(IPD_COLLECTIONS.doctorDailyProgress);
  await doctorProgress.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await doctorProgress.createIndex(
    { tenantId: 1, episodeId: 1, date: 1, createdByUserId: 1 },
    { unique: true }
  );
  await doctorProgress.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });

  const nursingProgress = db.collection(IPD_COLLECTIONS.nursingDailyProgress);
  await nursingProgress.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await nursingProgress.createIndex(
    { tenantId: 1, episodeId: 1, date: 1, createdByUserId: 1 },
    { unique: true }
  );
  await nursingProgress.createIndex({ tenantId: 1, episodeId: 1, createdAt: -1 });

  console.log('✅ IPD Phase 7 indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ IPD Phase 7 init failed:', error);
  process.exit(1);
});

