/**
 * Clinical Tasks Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/048_clinical_tasks_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Clinical Tasks Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const tasks = db.collection('clinical_tasks');
  await tasks.createIndex({ tenantId: 1, encounterCoreId: 1, status: 1 });
  await tasks.createIndex({ tenantId: 1, 'source.system': 1, 'source.sourceId': 1 }, { unique: true });
  await tasks.createIndex({ tenantId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

  const events = db.collection('clinical_task_events');
  await events.createIndex({ tenantId: 1, taskId: 1, createdAt: 1, _id: 1 });

  console.log('✅ Clinical tasks indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Clinical tasks index init failed:', error);
  process.exit(1);
});
