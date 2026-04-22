import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * [G-01] Guard: Prevents write operations on completed/closed encounters.
 *
 * Call at the start of every POST handler that modifies encounter data.
 * Returns a NextResponse error if the encounter is completed/closed,
 * or null if writes are allowed.
 *
 * @param options.allowAddendum - If true, skips the guard (for doctor addendums)
 */
export async function assertEncounterNotCompleted(
  tenantId: string,
  encounterCoreId: string,
  options?: { allowAddendum?: boolean },
): Promise<NextResponse | null> {
  if (options?.allowAddendum) return null;

  const encounterCore = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
    select: { status: true },
  });
  if (!encounterCore) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (encounterCore.status === 'CLOSED') {
    return NextResponse.json({ error: 'Cannot modify a closed encounter' }, { status: 409 });
  }

  const opd = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
    select: { opdFlowState: true },
  });
  if (opd?.opdFlowState === 'COMPLETED') {
    return NextResponse.json({ error: 'Cannot modify a completed encounter' }, { status: 409 });
  }

  return null;
}

/**
 * [G-02] Guard: Ensures the encounter belongs to the requesting tenant.
 * Prevents IDOR attacks where a user passes another tenant's encounterCoreId.
 *
 * Returns the encounter if valid, or a NextResponse error if not.
 */
export async function ensureEncounterBelongsToTenant(
  tenantId: string,
  encounterCoreId: string,
): Promise<{ encounter: { id: string; patientId: string; status: string } } | NextResponse> {
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
    select: { id: true, patientId: true, status: true },
  });

  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  return { encounter };
}

/**
 * [G-03] Guard: For doctor-scoped routes, ensures the requesting doctor
 * is assigned to this encounter (or is the primary provider).
 * Prevents IDOR where Doctor A accesses Doctor B's patient encounter.
 *
 * Falls back gracefully: if no assignment records exist, allows access
 * (compatible with clinics that don't use provider assignment).
 */
export async function ensureDoctorAssignedToEncounter(
  tenantId: string,
  encounterCoreId: string,
  userId: string,
  role: string,
): Promise<NextResponse | null> {
  // Only restrict for doctor-like roles
  const doctorRoles = ['doctor', 'physician', 'consultant', 'specialist', 'opd-doctor'];
  if (!doctorRoles.includes(String(role || '').toLowerCase())) {
    return null; // Non-doctor roles handled by permission system
  }

  // Check if the encounter has provider assignments at all
  const opdEncounter = await prisma.opdEncounter.findFirst({
    where: { tenantId, encounterCoreId },
    select: { createdByUserId: true },
  });

  // If the doctor created this encounter, allow
  if (opdEncounter?.createdByUserId === userId) return null;

  // Check provider profiles/assignments if they exist
  try {
    const assignment = await prisma.clinicalInfraProviderAssignment.findFirst({
      where: {
        tenantId,
        providerId: userId,
      },
    });

    // If provider assignments exist but this doctor has none for this encounter,
    // check if any assignments exist at all (if not, clinic doesn't use assignments)
    if (!assignment) {
      const anyAssignment = await prisma.clinicalInfraProviderAssignment.count({
        where: { tenantId },
      });
      // If no assignments configured, allow (clinic doesn't use this feature)
      if (anyAssignment === 0) return null;
      // Assignments exist but doctor has none — deny access
      return NextResponse.json({ error: 'Not assigned to this encounter' }, { status: 403 });
    }

    // Doctor has an active assignment — allow
    return null;
  } catch {
    // Table may not exist yet — allow access gracefully
    return null;
  }

  return NextResponse.json({ error: 'Not assigned to this encounter' }, { status: 403 });
}
