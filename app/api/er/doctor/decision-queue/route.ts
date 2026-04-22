import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DECISION_STATUSES = ['SEEN_BY_DOCTOR', 'ORDERS_IN_PROGRESS', 'RESULTS_PENDING', 'DECISION'];
const FINAL_STATUSES = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'CANCELLED'];

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  const url = new URL(req.url);
  const showAllRequested = url.searchParams.get('showAll') === '1';
  const showAll = false; // showAll requires admin role

  // 1. Fetch encounters in decision-relevant statuses (not final)
  const encounters = await prisma.erEncounter.findMany({
    where: {
      tenantId,
      status: { in: DECISION_STATUSES.filter(s => !FINAL_STATUSES.includes(s)) } as any,
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  if (encounters.length === 0) {
    return NextResponse.json({ items: [], showAllEnabled: showAll });
  }

  const encounterIds = encounters.map(e => e.id);

  // 2. Batch-load all related data in parallel
  const [
    allStaffAssignments,
    allPatients,
    allTriage,
    allBedAssignments,
    allTasks,
    allObservations,
    allEscalations,
    allTransferRequests,
    allAuditLogs,
  ] = await Promise.all([
    prisma.erStaffAssignment.findMany({
      where: { encounterId: { in: encounterIds }, role: 'PRIMARY_DOCTOR', unassignedAt: null },
    }),
    prisma.patientMaster.findMany({
      where: { id: { in: encounters.map(e => e.patientId) } },
    }),
    prisma.erTriageAssessment.findMany({
      where: { encounterId: { in: encounterIds } },
    }),
    prisma.erBedAssignment.findMany({
      where: { encounterId: { in: encounterIds }, unassignedAt: null },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.erTask.findMany({
      where: { encounterId: { in: encounterIds } },
      select: { id: true, encounterId: true, status: true, createdAt: true, completedAt: true },
    }),
    prisma.erObservation.findMany({
      where: { encounterId: { in: encounterIds } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.erEscalation.findMany({
      where: { encounterId: { in: encounterIds }, status: 'OPEN' },
    }),
    prisma.erNursingTransferRequest.findMany({
      where: { encounterId: { in: encounterIds }, tenantId, status: 'OPEN' },
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId,
        resourceType: 'triage',
        metadata: { path: ['after', 'triageEndAt'], not: 'null' },
      },
      orderBy: { timestamp: 'asc' },
      take: 5000,
    }),
  ]);

  // Load beds for active bed assignments
  const bedIds = [...new Set(allBedAssignments.map(ba => ba.bedId))];
  const allBeds = bedIds.length > 0
    ? await prisma.erBed.findMany({ where: { id: { in: bedIds } } })
    : [];

  // Build lookup maps
  const patientMap = new Map(allPatients.map(p => [p.id, p]));
  const triageMap = new Map(allTriage.map(t => [t.encounterId, t]));
  const bedMap = new Map(allBeds.map(b => [b.id, b]));

  // Group by encounterId
  const staffByEncounter = new Map<string, typeof allStaffAssignments>();
  for (const sa of allStaffAssignments) {
    const arr = staffByEncounter.get(sa.encounterId) || [];
    arr.push(sa);
    staffByEncounter.set(sa.encounterId, arr);
  }

  const bedAssignByEncounter = new Map<string, typeof allBedAssignments[0]>();
  for (const ba of allBedAssignments) {
    // First one wins (ordered by assignedAt desc)
    if (!bedAssignByEncounter.has(ba.encounterId)) {
      bedAssignByEncounter.set(ba.encounterId, ba);
    }
  }

  const tasksByEncounter = new Map<string, typeof allTasks>();
  for (const t of allTasks) {
    const arr = tasksByEncounter.get(t.encounterId) || [];
    arr.push(t);
    tasksByEncounter.set(t.encounterId, arr);
  }

  const latestObsByEncounter = new Map<string, Date>();
  for (const o of allObservations) {
    if (!latestObsByEncounter.has(o.encounterId)) {
      latestObsByEncounter.set(o.encounterId, o.createdAt);
    }
  }

  const escalationByEncounter = new Set(allEscalations.map(e => e.encounterId));
  const transferByEncounter = new Set(allTransferRequests.map(t => t.encounterId));

  // Build triage completion audit map (triageId -> earliest timestamp)
  const triageAuditMap = new Map<string, Date>();
  for (const al of allAuditLogs) {
    const triageId = al.resourceId;
    if (triageId && !triageAuditMap.has(triageId)) {
      triageAuditMap.set(triageId, al.timestamp);
    }
  }

  const now = Date.now();

  // 3. Build result items with application-level computation
  const items: any[] = [];
  for (const enc of encounters) {
    const encAny = enc as Record<string, unknown>;
    const doctorAssignments = staffByEncounter.get(enc.id) || [];
    const isMyPrimaryDoctor = showAll || doctorAssignments.some(a => a.userId === userId);
    const isSeenByDoctor = String(encAny.seenByDoctorUserId || '') === userId;

    if (!showAll && !isMyPrimaryDoctor && !isSeenByDoctor) continue;

    const patient = patientMap.get(enc.patientId);
    const triageDoc = triageMap.get(enc.id);
    const bedAssignment = bedAssignByEncounter.get(enc.id);
    const bed = bedAssignment ? bedMap.get(bedAssignment.bedId) : null;
    const encTasks = tasksByEncounter.get(enc.id) || [];

    const unackedResultsCount = encTasks.filter(t => {
      const tRec = t as Record<string, unknown>;
      return tRec.status === 'DONE' && !tRec.resultAcknowledgedAt;
    }).length;

    const pendingTasksCount = encTasks.filter(t =>
      ['ORDERED', 'IN_PROGRESS'].includes(t.status)
    ).length;

    const tasksOverdueCount = encTasks.filter(t => {
      if (!['ORDERED', 'IN_PROGRESS'].includes(t.status)) return false;
      const created = t.createdAt ? new Date(t.createdAt).getTime() : now;
      const ageMin = (now - created) / 60000;
      if (t.status === 'ORDERED' && ageMin > 30) return true;
      if (t.status === 'IN_PROGRESS' && ageMin > 60) return true;
      return false;
    }).length;

    // Vitals overdue calculation
    const triageCompletedAt = triageDoc ? triageAuditMap.get(triageDoc.id) || null : null;
    const latestObsAt = latestObsByEncounter.get(enc.id) || null;
    const vitalsBaselineAt = latestObsAt || triageCompletedAt;
    const triageLevel = enc.triageLevel;
    const vitalsThresholdMinutes = triageLevel === 1 ? 15 : triageLevel === 2 ? 30 : 60;

    let vitalsOverdueByMinutes: number | null = null;
    if (vitalsBaselineAt) {
      const elapsed = (now - new Date(vitalsBaselineAt).getTime()) / 60000;
      vitalsOverdueByMinutes = Math.max(0, elapsed - vitalsThresholdMinutes);
    }

    const status = String(enc.status);

    items.push({
      encounterId: enc.id,
      visitNumber: encAny.visitNumber ?? null,
      patientName: patient?.fullName || 'Unknown',
      mrn: patient?.mrn ?? null,
      tempMrn: (patient as Record<string, unknown> | undefined)?.tempMrn ?? null,
      bedLabel: bed ? `${bed.zone}-${bed.bedLabel}` : null,
      status,
      unackedResultsCount,
      pendingTasksCount,
      hasOpenEscalation: escalationByEncounter.has(enc.id),
      vitalsOverdue: (vitalsOverdueByMinutes ?? 0) > 0,
      tasksOverdue: tasksOverdueCount > 0,
      transferRequested: transferByEncounter.has(enc.id),
      readyForDecision: status === 'DECISION' && unackedResultsCount === 0 && pendingTasksCount === 0,
      blocked: unackedResultsCount > 0 || pendingTasksCount > 0,
      moveToDecisionSuggested: status !== 'DECISION' && unackedResultsCount === 0 && pendingTasksCount === 0,
    });
  }

  return NextResponse.json({ items, showAllEnabled: showAll });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
