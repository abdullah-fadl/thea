/**
 * Death & Mortuary Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/043_death_mortuary_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Death & Mortuary Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const declarations = db.collection('death_declarations');
  const cases = db.collection('mortuary_cases');

  await declarations.createIndex({ tenantId: 1, encounterCoreId: 1 }, { unique: true });
  await declarations.createIndex({ tenantId: 1, createdAt: -1 });

  await cases.createIndex({ tenantId: 1, encounterCoreId: 1 }, { unique: true });
  await cases.createIndex({ tenantId: 1, bodyTagNumber: 1 }, { unique: true });
  await cases.createIndex({ tenantId: 1, createdAt: -1 });

  console.log('✅ Death & Mortuary indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Death & Mortuary index init failed:', error);
  process.exit(1);
});
