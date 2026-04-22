/**
 * Department Entry Indexes (Phase Y)
 *
 * Ensures at most one active entry per encounter/department.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/031_department_entry_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Department Entry Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const entries = db.collection('department_entries');

  await entries.createIndex({ tenantId: 1, encounterCoreId: 1, departmentKey: 1, createdAt: 1 });
  await entries.createIndex(
    { tenantId: 1, encounterCoreId: 1, departmentKey: 1, status: 1, exitedAt: 1 },
    {
      unique: true,
      partialFilterExpression: { status: 'IN', exitedAt: null },
    }
  );

  console.log('✅ Department entry indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Department entry index migration failed:', error);
  process.exit(1);
});
