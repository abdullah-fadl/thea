/**
 * Charge Catalog Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/035_charge_catalog_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Charge Catalog Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const catalog = db.collection('charge_catalog');

  await catalog.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  await catalog.createIndex({ tenantId: 1, status: 1 });
  await catalog.createIndex({ tenantId: 1, departmentDomain: 1 });
  await catalog.createIndex({ tenantId: 1, applicability: 1 });
  await catalog.createIndex({ tenantId: 1, itemType: 1 });

  console.log('✅ Charge catalog indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Charge catalog index init failed:', error);
  process.exit(1);
});
