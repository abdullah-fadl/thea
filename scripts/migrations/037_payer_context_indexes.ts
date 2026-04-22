/**
 * Payer Context Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/037_payer_context_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Payer Context Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const payer = db.collection('payer_context');

  await payer.createIndex({ tenantId: 1, encounterCoreId: 1 }, { unique: true });
  await payer.createIndex({ tenantId: 1, mode: 1 });
  await payer.createIndex({ tenantId: 1, insuranceCompanyId: 1 });
  await payer.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true });

  console.log('✅ Payer context indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Payer context index init failed:', error);
  process.exit(1);
});
