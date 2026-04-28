import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.BILLING_TENANT_ID || process.env.TENANT_ID || 'test';
const COUNTER_COLLECTION = 'medication_catalog_counters';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Medication Catalog Schema Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const catalog = db.collection('medication_catalog');

  await db.collection(COUNTER_COLLECTION).createIndex({ tenantId: 1 }, { unique: true });
  await catalog.createIndex({ tenantId: 1, code: 1 }, { unique: true });
  await catalog.createIndex({ tenantId: 1, genericName: 1 });
  await catalog.createIndex({ tenantId: 1, chargeCode: 1 });
  await catalog.createIndex({ tenantId: 1, isControlled: 1 });

  console.log('✅ Medication catalog indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Medication catalog migration failed:', error);
  process.exit(1);
});
