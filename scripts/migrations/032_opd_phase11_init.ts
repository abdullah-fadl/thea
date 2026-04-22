/**
 * OPD Phase 11 Init Migration
 *
 * Creates indexes for OPD core collections.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/032_opd_phase11_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('OPD Phase 11 Init');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const opdEncounters = db.collection('opd_encounters');
  const opdVisitNotes = db.collection('opd_visit_notes');
  const opdOrders = db.collection('opd_orders');
  const encounterCore = db.collection('encounter_core');

  await opdEncounters.createIndex({ tenantId: 1, encounterCoreId: 1 }, { unique: true });
  await opdVisitNotes.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: 1 });
  await opdOrders.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: 1 });
  await opdOrders.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await encounterCore.createIndex(
    { tenantId: 1, patientId: 1, encounterType: 1, status: 1 },
    { unique: true, partialFilterExpression: { encounterType: 'OPD', status: 'ACTIVE' } }
  );

  console.log('✅ OPD Phase 11 indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ OPD Phase 11 init failed:', error);
  process.exit(1);
});
