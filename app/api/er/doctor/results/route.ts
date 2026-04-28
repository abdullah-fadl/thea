import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  const url = new URL(req.url);
  const showAllRequested = url.searchParams.get('showAll') === '1';
  const showAll = false; // showAll requires admin role
  const showAcked24h = url.searchParams.get('showAcked') === '1';

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Fetch DONE tasks, optionally including recently-acked ones
  const taskWhere: any = { status: 'DONE' };
  if (!showAcked24h) {
    taskWhere.OR = [
      { resultAcknowledgedAt: null },
    ];
  } else {
    taskWhere.OR = [
      { resultAcknowledgedAt: null },
      { resultAcknowledgedAt: { gte: since } },
    ];
  }

  // Note: tenantId is on the encounter, not on the task directly.
  // We'll filter by tenantId via encounters below.
  const tasks = await prisma.erTask.findMany({
    where: taskWhere,
    orderBy: [{ completedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: 800,
  });

  if (tasks.length === 0) {
    return NextResponse.json({ items: [], showAllEnabled: showAll });
  }

  const encounterIds = [...new Set(tasks.map(t => t.encounterId))];

  // 2. Fetch encounters for tenant scoping
  const encounters = await prisma.erEncounter.findMany({
    where: { tenantId, id: { in: encounterIds } },
  });
  const encounterMap = new Map(encounters.map(e => [e.id, e]));

  // Filter tasks to only those whose encounter belongs to this tenant
  const tenantTasks = tasks.filter(t => encounterMap.has(t.encounterId));
  if (tenantTasks.length === 0) {
    return NextResponse.json({ items: [], showAllEnabled: showAll });
  }

  const tenantEncounterIds = [...new Set(tenantTasks.map(t => t.encounterId))];

  // 3. Batch-load related data
  const [allStaffAssignments, allPatients, allBedAssignments] = await Promise.all([
    prisma.erStaffAssignment.findMany({
      where: { encounterId: { in: tenantEncounterIds }, role: 'PRIMARY_DOCTOR', unassignedAt: null },
    }),
    prisma.patientMaster.findMany({
      where: { id: { in: encounters.filter(e => tenantEncounterIds.includes(e.id)).map(e => e.patientId) } },
    }),
    prisma.erBedAssignment.findMany({
      where: { encounterId: { in: tenantEncounterIds }, unassignedAt: null },
      orderBy: { assignedAt: 'desc' },
    }),
  ]);

  const bedIds = [...new Set(allBedAssignments.map(ba => ba.bedId))];
  const allBeds = bedIds.length > 0
    ? await prisma.erBed.findMany({ where: { id: { in: bedIds } } })
    : [];

  // Build lookup maps
  const patientMap = new Map(allPatients.map(p => [p.id, p]));
  const bedMap = new Map(allBeds.map(b => [b.id, b]));

  const staffByEncounter = new Map<string, typeof allStaffAssignments>();
  for (const sa of allStaffAssignments) {
    const arr = staffByEncounter.get(sa.encounterId) || [];
    arr.push(sa);
    staffByEncounter.set(sa.encounterId, arr);
  }

  const bedAssignByEncounter = new Map<string, typeof allBedAssignments[0]>();
  for (const ba of allBedAssignments) {
    if (!bedAssignByEncounter.has(ba.encounterId)) {
      bedAssignByEncounter.set(ba.encounterId, ba);
    }
  }

  // 4. Build result items with doctor-of-record filtering
  const nowMs = Date.now();
  interface ResultItem {
    taskId: string;
    encounterId: string;
    visitNumber: string | null;
    taskName: string;
    kind: string | null;
    status: string | null;
    orderSetKey: string | null;
    createdAt: Date | null;
    completedAt: Date | null;
    resultAcknowledgedAt: Date | null;
    patientName: string;
    mrn: string | null;
    tempMrn: unknown;
    bedLabel: string | null;
    ageMinutes: number | null;
    needsAck: boolean;
  }
  const items: ResultItem[] = [];

  for (const task of tenantTasks) {
    const encounter = encounterMap.get(task.encounterId);
    if (!encounter) continue;

    // Doctor-of-record check
    if (!showAll) {
      const doctorAssignments = staffByEncounter.get(task.encounterId) || [];
      const isMyDoctor = doctorAssignments.some(a => a.userId === userId);
      const isSeenByDoctor = String((encounter as Record<string, unknown>).seenByDoctorUserId || '') === userId;
      if (!isMyDoctor && !isSeenByDoctor) continue;
    }

    const patient = patientMap.get(encounter.patientId);
    const bedAssignment = bedAssignByEncounter.get(task.encounterId);
    const bed = bedAssignment ? bedMap.get(bedAssignment.bedId) : null;

    const completedAt = task.completedAt ? new Date(task.completedAt) : null;
    const createdAt = task.createdAt ? new Date(task.createdAt) : null;
    const base = completedAt && !Number.isNaN(completedAt.getTime()) ? completedAt : createdAt;
    const ageMinutes =
      base && !Number.isNaN(base.getTime()) ? Math.max(0, Math.floor((nowMs - base.getTime()) / 60000)) : null;
    const needsAck = task.status === 'DONE' && !task.resultAcknowledgedAt;

    items.push({
      taskId: task.id,
      encounterId: task.encounterId,
      visitNumber: encounter.visitNumber ?? null,
      taskName: task.label || task.title || 'Task',
      kind: task.taskType ?? null,
      status: task.status ?? null,
      orderSetKey: task.orderSetKey ?? null,
      createdAt: task.createdAt ?? null,
      completedAt: task.completedAt ?? null,
      resultAcknowledgedAt: task.resultAcknowledgedAt ?? null,
      patientName: patient?.fullName || 'Unknown',
      mrn: patient?.mrn ?? null,
      tempMrn: (patient as Record<string, unknown> | undefined)?.tempMrn ?? null,
      bedLabel: bed ? `${bed.zone}-${bed.bedLabel}` : null,
      ageMinutes,
      needsAck,
    });
  }

  // Default sort: needsAck first, then by age
  items.sort((a, b) => {
    const an = a.needsAck ? 1 : 0;
    const bn = b.needsAck ? 1 : 0;
    if (an !== bn) return bn - an;
    return (b.ageMinutes || 0) - (a.ageMinutes || 0);
  });

  return NextResponse.json({ items: items.slice(0, 500), showAllEnabled: showAll });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
