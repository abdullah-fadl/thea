import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { runConsultationPricingMigration } from '../../lib/system/consultationPricingMigration';

const TENANT_ID = process.env.TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Consultation Pricing Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const result = await runConsultationPricingMigration(db, TENANT_ID);
  if (result.skipped) {
    console.log('ℹ️ Migration already applied. Skipping.');
  } else {
    console.log('✅ Migration completed.');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ Consultation pricing migration failed:', error);
  process.exit(1);
});
