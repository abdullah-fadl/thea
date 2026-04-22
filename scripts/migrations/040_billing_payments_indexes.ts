/**
 * Billing Payments Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/040_billing_payments_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Billing Payments Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const payments = db.collection('billing_payments');

  await payments.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: 1 });
  await payments.createIndex({ tenantId: 1, encounterCoreId: 1, idempotencyKey: 1 }, { unique: true });
  await payments.createIndex({ tenantId: 1, status: 1 });

  console.log('✅ Billing payments indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Billing payments index init failed:', error);
  process.exit(1);
});
