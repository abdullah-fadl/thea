/**
 * ER Init Migration
 *
 * Creates ER collections indexes and default integration settings.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/020_er_init.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { ER_COLLECTIONS } from '../../lib/er/constants';
import { randomUUID } from 'crypto';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ER Init Migration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  console.log('✅ Connected to tenant DB');

  const patients = db.collection(ER_COLLECTIONS.patients);
  const encounters = db.collection(ER_COLLECTIONS.encounters);
  const triage = db.collection(ER_COLLECTIONS.triage);
  const beds = db.collection(ER_COLLECTIONS.beds);
  const bedAssignments = db.collection(ER_COLLECTIONS.bedAssignments);
  const staffAssignments = db.collection(ER_COLLECTIONS.staffAssignments);
  const integrationSettings = db.collection(ER_COLLECTIONS.integrationSettings);
  const dispositions = db.collection(ER_COLLECTIONS.dispositions);
  const tasks = db.collection(ER_COLLECTIONS.tasks);
  const admissionHandovers = db.collection(ER_COLLECTIONS.admissionHandovers);

  await patients.createIndex({ tenantId: 1, mrn: 1 }, { unique: true, partialFilterExpression: { mrn: { $type: 'string' } } });
  await patients.createIndex({ tenantId: 1, tempMrn: 1 }, { unique: true, partialFilterExpression: { tempMrn: { $type: 'string' } } });
  await patients.createIndex({ tenantId: 1, fullName: 1 });

  await encounters.createIndex({ tenantId: 1, status: 1 });
  await encounters.createIndex({ tenantId: 1, startedAt: -1 });
  await encounters.createIndex({ patientId: 1 });

  await triage.createIndex({ encounterId: 1 }, { unique: true });

  await beds.createIndex({ tenantId: 1, zone: 1, bedLabel: 1 }, { unique: true });
  await beds.createIndex({ tenantId: 1, state: 1 });

  await bedAssignments.createIndex({ encounterId: 1, unassignedAt: 1 });
  await bedAssignments.createIndex({ bedId: 1, unassignedAt: 1 });

  // Ensure at most one ACTIVE staff assignment per encounter+role.
  // Prevents duplicate active PRIMARY_DOCTOR / PRIMARY_NURSE, even under concurrent requests.
  await staffAssignments.createIndex(
    { encounterId: 1, role: 1, unassignedAt: 1 },
    { unique: true, partialFilterExpression: { unassignedAt: null } }
  );
  await staffAssignments.createIndex({ userId: 1, unassignedAt: 1 });

  await dispositions.createIndex({ tenantId: 1, encounterId: 1 }, { unique: true });
  await tasks.createIndex({ tenantId: 1, encounterId: 1, createdAt: -1 });
  await tasks.createIndex({ tenantId: 1, status: 1 });

  // Admission Bridge: one immutable handoff per encounter
  await admissionHandovers.createIndex({ tenantId: 1, encounterId: 1 }, { unique: true });
  await admissionHandovers.createIndex({ tenantId: 1, createdAt: -1 });

  await integrationSettings.createIndex({ tenantId: 1 }, { unique: true });
  const existingIntegration = await integrationSettings.findOne({ tenantId: TENANT_ID });
  if (!existingIntegration) {
    await integrationSettings.insertOne({
      id: randomUUID(),
      tenantId: TENANT_ID,
      samEnabled: false,
      samSecret: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✓ Created default integration settings (samEnabled=false)');
  }

  console.log('✅ ER indexes ensured');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

run().catch((error) => {
  console.error('❌ ER init migration failed:', error);
  process.exit(1);
});
