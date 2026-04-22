/**
 * IPD Phase 5.1 Init Migration (fresh; read-only episode)
 *
 * Creates Phase 5.1 collections indexes.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/021_ipd_phase5_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { IPD_COLLECTIONS } from '../../lib/ipd/constants';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('IPD Phase 5.1 Init Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const admissionIntakes = db.collection(IPD_COLLECTIONS.admissionIntakes);
  const episodes = db.collection(IPD_COLLECTIONS.episodes);

  await admissionIntakes.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await admissionIntakes.createIndex({ tenantId: 1, handoffId: 1 }, { unique: true });
  await admissionIntakes.createIndex({ tenantId: 1, createdAt: -1 });

  await episodes.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await episodes.createIndex({ tenantId: 1, 'source.handoffId': 1 }, { unique: true });
  await episodes.createIndex({ tenantId: 1, createdAt: -1 });

  console.log('✅ IPD Phase 5.1 indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ IPD Phase 5.1 init migration failed:', error);
  process.exit(1);
});

