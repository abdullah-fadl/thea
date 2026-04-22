import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateTriageCompletionInput } from '@/lib/er/triage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  // [P-01] Fetch encounters with limit to prevent unbounded memory usage
  const encounters = await prisma.erEncounter.findMany({
    where: { tenantId, status: { notIn: ['DISCHARGED', 'CANCELLED', 'TRANSFERRED', 'ADMITTED'] } },
    take: 500,
    include: {
      patient: {
        select: { id: true, fullName: true, mrn: true, gender: true },
      },
      triage: true,
      bedAssignments: {
        where: { unassignedAt: null },
        take: 1,
        include: {
          bed: { select: { id: true, bedLabel: true, zone: true } },
        },
      },
      staffAssignments: {
        where: { unassignedAt: null },
      },
    },
  });

  const encounterIds = encounters.map((e) => e.id).filter(Boolean);

  // Fetch audit logs for status timestamps
  const statusLogMap = new Map<string, Map<string, Date>>();
  if (encounterIds.length) {
    const statusTargets = ['WAITING_BED', 'IN_BED', 'SEEN_BY_DOCTOR', 'ORDERS_IN_PROGRESS', 'DECISION'];
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        resourceType: 'encounter',
        resourceId: { in: encounterIds },
      },
      select: { resourceId: true, timestamp: true, metadata: true },
      orderBy: { timestamp: 'desc' },
      // [P-04] Reduced from 5000 to 2000 to prevent excessive memory usage
      take: 2000,
    });

    for (const log of logs) {
      const encounterId = String(log.resourceId || '');
      const details = (log.metadata as Record<string, unknown>);
      const status = String((details as any)?.after?.status || '').trim().toUpperCase();
      if (!encounterId || !status || !statusTargets.includes(status)) continue;
      const ts = log.timestamp ? new Date(log.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      if (!statusLogMap.has(encounterId)) statusLogMap.set(encounterId, new Map());
      const byStatus = statusLogMap.get(encounterId)!;
      if (!byStatus.has(status)) {
        byStatus.set(status, ts);
      }
    }
  }

  const items = encounters.map((encounter: any) => {
    const staffAssignments = encounter.staffAssignments || [];
    const doctor = staffAssignments.find((item: any) => item.role === 'PRIMARY_DOCTOR');
    const nurse = staffAssignments.find((item: any) => item.role === 'PRIMARY_NURSE');
    const bedAssignment = encounter.bedAssignments?.[0] || null;
    const bed = bedAssignment?.bed || null;

    const triageMissing = validateTriageCompletionInput({
      chiefComplaint: encounter.chiefComplaint,
      vitals: {
        systolic: encounter.triage?.vitals?.systolic ?? null,
        diastolic: encounter.triage?.vitals?.diastolic ?? null,
        HR: encounter.triage?.vitals?.HR ?? null,
        RR: encounter.triage?.vitals?.RR ?? null,
        TEMP: encounter.triage?.vitals?.TEMP ?? null,
        SPO2: encounter.triage?.vitals?.SPO2 ?? null,
      },
      triageLevel: encounter.triageLevel ?? null,
    }).missing;

    const status = String(encounter.status || '').trim().toUpperCase();
    const createdAt = encounter.createdAt ? new Date(encounter.createdAt) : null;
    const arrivedAt = encounter.arrivedAt ? new Date(encounter.arrivedAt) : null;
    const statusTimes = statusLogMap.get(String(encounter.id || '')) || new Map<string, Date>();
    const lastStatusChangedAt = (key: string) => statusTimes.get(key) || null;
    const bedAssignedAt = bedAssignment?.assignedAt ? new Date(bedAssignment.assignedAt) : null;
    const seenAt = encounter.seenByDoctorAt ? new Date(encounter.seenByDoctorAt) : null;
    const firstOrderAt = encounter.firstOrderAt
      ? new Date(encounter.firstOrderAt)
      : encounter.ordersStartedAt
      ? new Date(encounter.ordersStartedAt)
      : null;
    const decisionAt = encounter.decisionAt ? new Date(encounter.decisionAt) : null;
    const triageCompletedAt = encounter.triage?.triageEndAt ? new Date(encounter.triage.triageEndAt) : null;
    const stageBaseStart = arrivedAt || createdAt;
    let stageLabel = 'WAITING';
    let stageStartedAt = stageBaseStart;
    const hasBed = Boolean(bed?.bedLabel || bedAssignment?.bedId);
    if (!hasBed && (status === 'TRIAGE_COMPLETED' || status === 'TRIAGED' || status === 'WAITING_BED')) {
      stageLabel = 'WAITING_BED';
      stageStartedAt = lastStatusChangedAt('WAITING_BED') || triageCompletedAt || stageBaseStart;
    } else if (status === 'WAITING_BED') {
      stageLabel = 'WAITING_BED';
      stageStartedAt = lastStatusChangedAt('WAITING_BED') || stageBaseStart;
    } else if (status === 'IN_BED') {
      stageLabel = 'IN_BED';
      stageStartedAt = bedAssignedAt || lastStatusChangedAt('IN_BED') || stageBaseStart;
    } else if (status === 'SEEN_BY_DOCTOR') {
      stageLabel = 'SEEN';
      stageStartedAt = seenAt || lastStatusChangedAt('SEEN_BY_DOCTOR') || stageBaseStart;
    } else if (status === 'ORDERS_IN_PROGRESS' || status === 'RESULTS_PENDING') {
      stageLabel = 'PENDING_RESULTS';
      stageStartedAt = firstOrderAt || lastStatusChangedAt('ORDERS_IN_PROGRESS') || stageBaseStart;
    } else if (status === 'DECISION' || ['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'DEATH'].includes(status)) {
      stageLabel = 'DISPO';
      stageStartedAt = lastStatusChangedAt('DECISION') || decisionAt || stageBaseStart;
    }

    return {
      id: encounter.id,
      visitNumber: encounter.visitNumber || null,
      patientName: encounter.patient?.fullName || 'Unknown',
      mrn: encounter.patient?.mrn || 'N/A',
      tempMrn: null,
      patientGender: encounter.patient?.gender || encounter.sex || encounter.patientSex || null,
      status: encounter.status,
      stageLabel,
      stageStartedAt: stageStartedAt ? stageStartedAt.toISOString() : null,
      triageLevel: encounter.triageLevel ?? null,
      triageComplete: Boolean(encounter.triageCompletedAt) || Boolean(encounter.triage?.triageEndAt),
      triageMissing,
      bedLabel: bed?.bedLabel || null,
      bedZone: bed?.zone || null,
      doctorId: doctor?.userId || null,
      nurseId: nurse?.userId || null,
      paymentStatus: encounter.paymentStatus,
      arrivalMethod: encounter.arrivalMethod,
      critical: Boolean((encounter.triage as Record<string, unknown>)?.critical),
      respiratoryDecision: encounter.respiratoryDecision || null,
      startedAt: encounter.startedAt,
    };
  });

  items.sort((a, b) => {
    const aLevel = a.triageLevel ?? 99;
    const bLevel = b.triageLevel ?? 99;
    if (aLevel !== bLevel) return aLevel - bLevel;
    return (new Date(a.startedAt).getTime() || 0) - (new Date(b.startedAt).getTime() || 0);
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
