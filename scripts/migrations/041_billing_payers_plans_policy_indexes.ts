/**
 * Billing Payers/Plans/Policy Rules Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/041_billing_payers_plans_policy_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Billing Payers/Plans/Policy Rules Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const payers = db.collection('billing_payers');
  const plans = db.collection('billing_plans');
  const rules = db.collection('billing_policy_rules');

  await payers.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  await payers.createIndex({ tenantId: 1, status: 1 });
  await payers.createIndex({ tenantId: 1, createdAt: 1 });

  await plans.createIndex({ tenantId: 1, payerId: 1, planCode: 1 }, { unique: true });
  await plans.createIndex({ tenantId: 1, payerId: 1, status: 1 });
  await plans.createIndex({ tenantId: 1, createdAt: 1 });

  await rules.createIndex({ tenantId: 1, ruleKey: 1 }, { unique: true });
  await rules.createIndex({ tenantId: 1, payerId: 1, planId: 1 });
  await rules.createIndex({ tenantId: 1, ruleType: 1, status: 1 });
  await rules.createIndex({ tenantId: 1, createdAt: 1 });

  console.log('✅ Billing payers/plans/policy rules indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Billing indexes init failed:', error);
  process.exit(1);
});
