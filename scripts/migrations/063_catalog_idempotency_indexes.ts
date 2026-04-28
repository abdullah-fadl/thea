/**
 * Catalog Usage Idempotency Indexes
 *
 * Usage:
 *   TENANT_ID=xxx yarn tsx scripts/migrations/063_catalog_idempotency_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Catalog Idempotency Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  await db
    .collection('catalog_usage_idempotency')
    .createIndex({ tenantId: 1, requestId: 1, kind: 1 }, { unique: true });

  await db
    .collection('pricing_package_applications')
    .createIndex({ tenantId: 1, requestId: 1 }, { unique: true });

  console.log('✅ Idempotency indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Idempotency index init failed:', error);
  process.exit(1);
});
