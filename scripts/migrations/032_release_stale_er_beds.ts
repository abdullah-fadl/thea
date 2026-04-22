/**
 * Release stale ER bed assignments for finalized encounters.
 *
 * Criteria:
 * - Encounter status in {ADMITTED, TRANSFERRED, DISCHARGED} OR admission handoff exists
 * - Active bed_assignment exists (unassignedAt null)
 *
 * Idempotent: safe to re-run.
 * Usage:
 *   ER_TENANT_ID=xxx yarn tsx scripts/migrations/032_release_stale_er_beds.ts
 */

import { getTenantDbByKey } from '../../lib/db/tenantDb';
import { getErCollections } from '../../lib/er/db';
import { writeErAuditLog } from '../../lib/er/audit';

const TENANT_ID = process.env.ER_TENANT_ID || 'test';

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Release stale ER bed assignments');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Tenant: ${TENANT_ID}`);

  const db = await getTenantDbByKey(TENANT_ID);
  const { encounters, admissionHandovers, beds, bedAssignments } = getErCollections(db);

  const finalizedEncounters = await encounters
    .find(
      { tenantId: TENANT_ID, status: { $in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGED'] } },
      { projection: { _id: 0, id: 1 } }
    )
    .toArray();

  const handoffEncounters = await admissionHandovers
    .find({ tenantId: TENANT_ID }, { projection: { _id: 0, encounterId: 1 } })
    .toArray();

  const encounterIds = new Set<string>();
  finalizedEncounters.forEach((e) => encounterIds.add(String(e.id || '')));
  handoffEncounters.forEach((h) => encounterIds.add(String(h.encounterId || '')));

  const sortedEncounterIds = Array.from(encounterIds).filter(Boolean).sort();
  if (!sortedEncounterIds.length) {
    console.log('✅ No finalized encounters found.');
    return;
  }

  let releasedCount = 0;
  for (const encounterId of sortedEncounterIds) {
    const activeAssignment = await bedAssignments.findOne({ encounterId, unassignedAt: null });
    if (!activeAssignment) continue;

    const now = new Date();
    await bedAssignments.updateOne(
      { id: activeAssignment.id, encounterId },
      { $set: { unassignedAt: now } }
    );

    const bedId = String(activeAssignment.bedId || '').trim();
    if (bedId) {
      await beds.updateOne({ tenantId: TENANT_ID, id: bedId }, { $set: { state: 'VACANT', updatedAt: now } });
    }

    await writeErAuditLog({
      db,
      tenantId: TENANT_ID,
      userId: 'system',
      entityType: 'bed_assignment',
      entityId: activeAssignment.id,
      action: 'RELEASE',
      before: activeAssignment,
      after: { ...activeAssignment, unassignedAt: now, bedId: bedId || null },
      ip: null,
    });
    releasedCount += 1;
  }

  console.log(`✅ Released ${releasedCount} stale bed assignment(s).`);
}

run().catch((error) => {
  console.error('❌ Stale bed release failed:', error);
  process.exit(1);
});
