/**
 * OPD Indexes
 *
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/066_opd_indexes.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('OPD Indexes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  // ── opd_bookings ──
  const bookings = db.collection('opd_bookings');
  await bookings.createIndex({ tenantId: 1, date: 1, clinicId: 1, status: 1 });
  await bookings.createIndex({ tenantId: 1, status: 1, checkedInAt: 1 });
  await bookings.createIndex({ tenantId: 1, encounterCoreId: 1 });
  await bookings.createIndex({ tenantId: 1, patientMasterId: 1, date: -1 });
  await bookings.createIndex({ tenantId: 1, resourceId: 1, date: 1 });
  await bookings.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  console.log('✅ opd_bookings indexes ensured');

  // ── opd_encounters ──
  const encounters = db.collection('opd_encounters');
  await encounters.createIndex({ tenantId: 1, encounterCoreId: 1 }, { unique: true });
  await encounters.createIndex({ tenantId: 1, opdFlowState: 1, updatedAt: -1 });
  await encounters.createIndex({ tenantId: 1, patientId: 1, createdAt: -1 });
  await encounters.createIndex({ tenantId: 1, status: 1, opdFlowState: 1 });
  await encounters.createIndex({ tenantId: 1, priority: 1, 'opdTimestamps.arrivedAt': 1 });
  console.log('✅ opd_encounters indexes ensured');

  // ── encounter_core ──
  const core = db.collection('encounter_core');
  await core.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await core.createIndex({ tenantId: 1, patientId: 1, encounterType: 1, createdAt: -1 });
  await core.createIndex({ tenantId: 1, status: 1, encounterType: 1 });
  console.log('✅ encounter_core indexes ensured');

  // ── opd_orders ──
  const orders = db.collection('opd_orders');
  await orders.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await orders.createIndex({ tenantId: 1, encounterCoreId: 1, createdAt: -1 });
  await orders.createIndex({ tenantId: 1, status: 1 });
  console.log('✅ opd_orders indexes ensured');

  // ── opd_waiting_list (deprecated but still used) ──
  const waitingList = db.collection('opd_waiting_list');
  await waitingList.createIndex({ tenantId: 1, date: 1, status: 1 });
  await waitingList.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  console.log('✅ opd_waiting_list indexes ensured');

  // ── patient_master (support OPD lookups) ──
  const patients = db.collection('patient_master');
  await patients.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await patients.createIndex({ tenantId: 1, 'links.mrn': 1 });
  await patients.createIndex({ tenantId: 1, mobile: 1 });
  await patients.createIndex({ tenantId: 1, nationalId: 1 }, { sparse: true });
  console.log('✅ patient_master indexes ensured');

  // ── scheduling_resources ──
  const resources = db.collection('scheduling_resources');
  await resources.createIndex({ tenantId: 1, id: 1 }, { unique: true });
  await resources.createIndex({ tenantId: 1, 'resourceRef.providerId': 1 });
  console.log('✅ scheduling_resources indexes ensured');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ All OPD indexes created successfully');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ OPD index creation failed:', error);
  process.exit(1);
});
