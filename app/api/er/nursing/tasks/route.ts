import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  const url = new URL(req.url);
  const showAllRequested = url.searchParams.get('showAll') === '1';
  const showAll = false; // showAll requires admin role

  // Get all tasks for tenant
  const allTasks = await prisma.erTask.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  if (!allTasks.length) {
    return NextResponse.json({ items: [], showAllEnabled: showAll });
  }

  const encounterIds = Array.from(new Set(allTasks.map((t: any) => t.encounterId).filter(Boolean)));

  // Parallel lookups
  const [encounters, staffAssignments, patients, bedAssignments] = await Promise.all([
    prisma.erEncounter.findMany({
      where: { id: { in: encounterIds } },
      select: { id: true, patientId: true },
    }),
    prisma.erStaffAssignment.findMany({
      where: {
        encounterId: { in: encounterIds },
        role: 'PRIMARY_NURSE',
        unassignedAt: null,
      },
      select: { encounterId: true, userId: true },
    }),
    // Will fetch patients after we know patientIds
    [] as Record<string, unknown>[],
    prisma.erBedAssignment.findMany({
      where: { encounterId: { in: encounterIds }, unassignedAt: null },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  const encounterMap = new Map(encounters.map((e) => [e.id, e]));
  const nurseByEncounter = new Map<string, string>();
  for (const sa of staffAssignments) {
    nurseByEncounter.set(sa.encounterId, sa.userId);
  }

  // Fetch patients
  const patientIds = Array.from(new Set(encounters.map((e: any) => e.patientId).filter(Boolean)));
  const patientRows = patientIds.length
    ? await prisma.patientMaster.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, fullName: true, mrn: true },
      })
    : [];
  const patientMap = new Map(patientRows.map((p) => [p.id, p]));

  // Bed lookup
  const bedIdByEncounter = new Map<string, string>();
  for (const ba of bedAssignments) {
    if (!bedIdByEncounter.has(ba.encounterId)) {
      bedIdByEncounter.set(ba.encounterId, ba.bedId);
    }
  }
  const allBedIds = Array.from(new Set(bedAssignments.map((ba) => ba.bedId)));
  const beds = allBedIds.length
    ? await prisma.erBed.findMany({ where: { id: { in: allBedIds } }, select: { id: true, zone: true, bedLabel: true } })
    : [];
  const bedMap = new Map(beds.map((b) => [b.id, b]));

  // Filter tasks based on assignment
  let filteredTasks = allTasks;
  if (!showAll) {
    filteredTasks = allTasks.filter((t: any) => {
      const isAssignedToMe = nurseByEncounter.get(t.encounterId) === userId;
      return isAssignedToMe;
    });
  }

  const now = Date.now();
  const out = filteredTasks.map((t: any) => {
    const encounter = encounterMap.get(t.encounterId);
    const patient = encounter ? patientMap.get(encounter.patientId) : null;
    const bedId = bedIdByEncounter.get(t.encounterId);
    const bed = bedId ? bedMap.get(bedId) : null;
    const isAssignedToMe = nurseByEncounter.get(t.encounterId) === userId;

    const createdAt = t.createdAt ? new Date(t.createdAt) : null;
    const ageMinutes =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? Math.max(0, Math.floor((now - createdAt.getTime()) / 60000))
        : null;
    const status = String(t.status || '');
    const isOverdue =
      typeof ageMinutes === 'number' &&
      ((status === 'ORDERED' && ageMinutes > 30) || (status === 'IN_PROGRESS' && ageMinutes > 60));

    const bedLabel = bed?.zone && bed?.bedLabel ? `${bed.zone}-${bed.bedLabel}` : null;

    return {
      taskId: t.id,
      encounterId: t.encounterId,
      visitNumber: null,
      taskName: t.label || 'Task',
      kind: t.kind || null,
      status: t.status || null,
      createdAt: t.createdAt || null,
      patientName: patient?.fullName || 'Unknown',
      mrn: patient?.mrn || null,
      tempMrn: null,
      respiratoryDecision: (encounter as Record<string, unknown>)?.respiratoryDecision || null,
      bedLabel,
      isAssignedToMe,
      ageMinutes,
      isOverdue,
    };
  });

  return NextResponse.json({ items: out, showAllEnabled: showAll });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
