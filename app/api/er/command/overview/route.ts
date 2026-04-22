import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { diffMinutes } from '@/lib/er/metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINAL_STATUSES = new Set(['DISCHARGED', 'ADMITTED', 'TRANSFERRED', 'CANCELLED']);
const FINAL_STATUSES_FOR_FINALIZED_AT = new Set(['DISCHARGED', 'ADMITTED', 'TRANSFERRED']);

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function percentileNearestRank(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const pct = Math.min(100, Math.max(0, p));
  const rank = Math.ceil((pct / 100) * sortedAsc.length);
  const idx = Math.max(0, Math.min(sortedAsc.length - 1, rank - 1));
  return sortedAsc[idx] ?? null;
}

function median(values: number[]): number | null {
  const cleaned = values.filter((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  return percentileNearestRank(cleaned, 50);
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

type StageKey =
  | 'REGISTERED'
  | 'TRIAGE_IN_PROGRESS'
  | 'TRIAGE_COMPLETED'
  | 'BED_ASSIGNED'
  | 'SEEN'
  | 'ORDERS_IN_PROGRESS'
  | 'RESULTS_PENDING'
  | 'DECISION'
  | 'FINAL';

function stageFor(e: any): { stage: StageKey; startedAt: Date | null } {
  const createdAt = safeDate(e.createdAt);
  const triageStartAt = safeDate(e.triageStartAt);
  const triageCompletedAt = safeDate(e.triageCompletedAt);
  const bedAssignedAt = safeDate(e.bedAssignedAt);
  const seenByDoctorAt = safeDate(e.seenByDoctorAt);
  const ordersStartedAt = safeDate(e.ordersStartedAt);
  const resultsPendingAt = safeDate(e.resultsPendingAt);
  const decisionAt = safeDate(e.decisionAt);
  const finalizedAt = safeDate(e.finalizedAt) || safeDate(e.closedAt);

  const status = String(e.status || '');
  if (FINAL_STATUSES.has(status)) return { stage: 'FINAL', startedAt: finalizedAt || createdAt };
  if (status === 'DECISION' || decisionAt) return { stage: 'DECISION', startedAt: decisionAt || resultsPendingAt || createdAt };
  if (status === 'RESULTS_PENDING' || resultsPendingAt) return { stage: 'RESULTS_PENDING', startedAt: resultsPendingAt || ordersStartedAt || createdAt };
  if (status === 'ORDERS_IN_PROGRESS' || ordersStartedAt) return { stage: 'ORDERS_IN_PROGRESS', startedAt: ordersStartedAt || seenByDoctorAt || createdAt };
  if (seenByDoctorAt) return { stage: 'SEEN', startedAt: seenByDoctorAt || bedAssignedAt || createdAt };
  if (bedAssignedAt) return { stage: 'BED_ASSIGNED', startedAt: bedAssignedAt || triageCompletedAt || createdAt };
  if (triageCompletedAt) return { stage: 'TRIAGE_COMPLETED', startedAt: triageCompletedAt || triageStartAt || createdAt };
  if (triageStartAt) return { stage: 'TRIAGE_IN_PROGRESS', startedAt: triageStartAt || createdAt };
  return { stage: 'REGISTERED', startedAt: createdAt };
}

function computeOverdueVitals(args: { triageLevel: unknown; vitalsBaselineAt: Date | null; now: Date }) {
  const lvl = Number(args.triageLevel);
  const threshold = lvl === 1 ? 15 : lvl === 2 ? 30 : 60;
  const age = args.vitalsBaselineAt ? diffMinutes(args.vitalsBaselineAt, args.now) : null;
  return Boolean(typeof age === 'number' && age > threshold);
}

function computeTaskOverdueCount(args: { pendingTasks: Array<{ status: string; createdAt: Date }>; now: Date }) {
  const now = args.now;
  const pending = Array.isArray(args.pendingTasks) ? args.pendingTasks : [];
  let overdue = 0;
  for (const t of pending) {
    const createdAt = safeDate(t.createdAt);
    const age = createdAt ? diffMinutes(createdAt, now) : null;
    const status = String(t.status || '');
    if (typeof age !== 'number') continue;
    if (status === 'ORDERED' && age > 30) overdue += 1;
    if (status === 'IN_PROGRESS' && age > 60) overdue += 1;
  }
  return overdue;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as unknown as { role?: string })?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const fromParam = parseDateParam(url.searchParams.get('from'));
  const toParam = parseDateParam(url.searchParams.get('to'));
  const to = toParam || new Date();
  const from = fromParam || new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const demoRequested = url.searchParams.get('demo') === '1';
  const demoMode = false; // demo mode requires admin role (backdoor removed)
  const asOf = demoMode ? to : new Date();

  // Build base query for active encounters
  const baseWhere: any = {
    tenantId,
    status: { notIn: Array.from(FINAL_STATUSES) },
  };
  if (demoMode) {
    baseWhere.createdAt = { gte: from, lte: to };
  }

  const active = await prisma.erEncounter.findMany({
    where: baseWhere,
    select: {
      id: true,
      patientId: true,
      status: true,
      triageLevel: true,
      chiefComplaint: true,
      createdAt: true,
      closedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  const activeIds = active.map((e) => e.id).filter(Boolean);
  const patientIds = active.map((e) => e.patientId).filter(Boolean);

  // Fetch extra encounter fields not in Prisma schema
  const extraFieldsMap = new Map<string, any>();
  if (activeIds.length) {
    const placeholders = activeIds.map((_, i) => `$${i + 1}`).join(', ');
    const rows: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT id, "visitNumber", "seenByDoctorAt", "ordersStartedAt", "resultsPendingAt", "decisionAt"
       FROM er_encounters WHERE id IN (${placeholders})`,
      ...activeIds
    );
    for (const row of rows) extraFieldsMap.set(String(row.id), row);
  }

  // Fetch patients
  const patientById = new Map<string, { id: string; fullName: string | null; mrn: string | null }>();
  if (patientIds.length) {
    const pats = await prisma.patientMaster.findMany({
      where: { id: { in: Array.from(new Set(patientIds)) } },
      select: { id: true, fullName: true, mrn: true },
    });
    for (const p of pats) patientById.set(p.id, p);
  }

  // Fetch triage records
  const triageByEncounterId = new Map<string, { id: string; encounterId: string; triageStartAt: Date | null; triageEndAt: Date | null }>();
  if (activeIds.length) {
    const triageDocs = await prisma.erTriageAssessment.findMany({
      where: { encounterId: { in: activeIds } },
      select: { id: true, encounterId: true, triageStartAt: true, triageEndAt: true },
    });
    for (const t of triageDocs) triageByEncounterId.set(t.encounterId, t);
  }

  // Audit-derived triageCompletedAt + finalizedAt
  const triageCompletedAtByEncounterId = new Map<string, Date>();
  const finalizedAtByEncounterId = new Map<string, Date>();
  if (activeIds.length) {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(demoMode ? { timestamp: { lte: to } } : {}),
        OR: [
          { resourceType: 'triage', resourceId: { in: activeIds } },
          { resourceType: 'encounter', resourceId: { in: activeIds } },
        ],
      },
      select: { resourceType: true, resourceId: true, timestamp: true, metadata: true },
      orderBy: { timestamp: 'asc' },
    });

    for (const log of logs) {
      const details = (log.metadata as any);
      if (log.resourceType === 'triage') {
        const encounterId = String(details?.after?.encounterId || log.resourceId || '');
        if (!encounterId || triageCompletedAtByEncounterId.has(encounterId)) continue;
        if (!details?.after?.triageEndAt) continue;
        const triageEndAt = new Date(details.after.triageEndAt);
        if (!Number.isNaN(triageEndAt.getTime())) {
          triageCompletedAtByEncounterId.set(encounterId, triageEndAt);
        } else if (log.timestamp) {
          triageCompletedAtByEncounterId.set(encounterId, log.timestamp);
        }
      }
      if (log.resourceType === 'encounter') {
        const encounterId = String(log.resourceId || '');
        if (!encounterId || finalizedAtByEncounterId.has(encounterId)) continue;
        const afterStatus = String(details?.after?.status || '');
        const beforeStatus = String(details?.before?.status || '');
        if (!FINAL_STATUSES_FOR_FINALIZED_AT.has(afterStatus)) continue;
        if (beforeStatus && beforeStatus === afterStatus) continue;
        if (log.timestamp) finalizedAtByEncounterId.set(encounterId, log.timestamp);
      }
    }
  }

  // First bed assignment per encounter
  const bedAssignedAtByEncounterId = new Map<string, Date>();
  const bedLabelByEncounterId = new Map<string, string | null>();
  if (activeIds.length) {
    const bedAssignments = await prisma.erBedAssignment.findMany({
      where: {
        encounterId: { in: activeIds },
        ...(demoMode ? { assignedAt: { lte: to } } : {}),
      },
      select: { encounterId: true, assignedAt: true, bedId: true },
      orderBy: { assignedAt: 'asc' },
    });

    // Group by encounter and keep first
    const firstByEncounter = new Map<string, { encounterId: string; assignedAt: Date; bedId: string | null }>();
    for (const ba of bedAssignments) {
      if (!firstByEncounter.has(ba.encounterId)) {
        firstByEncounter.set(ba.encounterId, ba);
      }
    }

    const bedIds = Array.from(new Set(
      Array.from(firstByEncounter.values()).map((b) => b.bedId).filter(Boolean)
    ));
    const bedById = new Map<string, { id: string; zone: string | null; bedLabel: string | null }>();
    if (bedIds.length) {
      const beds = await prisma.erBed.findMany({
        where: { id: { in: bedIds } },
        select: { id: true, zone: true, bedLabel: true },
      });
      for (const b of beds) bedById.set(b.id, b);
    }

    for (const [encounterId, ba] of firstByEncounter) {
      bedAssignedAtByEncounterId.set(encounterId, ba.assignedAt);
      const bed = bedById.get(ba.bedId);
      bedLabelByEncounterId.set(encounterId, bed?.zone && bed?.bedLabel ? `${bed.zone}-${bed.bedLabel}` : null);
    }
  }

  // Primary nurse display
  const primaryNurseUserIdByEncounterId = new Map<string, string | null>();
  if (activeIds.length) {
    const ass = await prisma.erStaffAssignment.findMany({
      where: { encounterId: { in: activeIds }, role: 'PRIMARY_NURSE' as any, unassignedAt: null },
      select: { encounterId: true, userId: true },
    });
    const userIds = ass.map((a) => a.userId).filter(Boolean);
    const userDocs = userIds.length
      ? await prisma.user.findMany({
          where: { tenantId, id: { in: Array.from(new Set(userIds)) } },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : [];
    const displayByUserId = new Map<string, string>();
    for (const u of userDocs) {
      const name = `${String(u.firstName || '').trim()} ${String(u.lastName || '').trim()}`.trim();
      displayByUserId.set(u.id, name || String(u.email || '').trim() || u.id);
    }
    for (const a of ass) {
      const uid = a.userId;
      primaryNurseUserIdByEncounterId.set(a.encounterId, displayByUserId.get(uid) || uid || null);
    }
  }

  // Latest observation time per encounter
  const latestObsAtByEncounterId = new Map<string, Date>();
  if (activeIds.length) {
    const observations = await prisma.erObservation.findMany({
      where: {
        encounterId: { in: activeIds },
        ...(demoMode ? { createdAt: { lte: to } } : {}),
      },
      select: { encounterId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    // Keep only the latest per encounter
    for (const obs of observations) {
      if (!latestObsAtByEncounterId.has(obs.encounterId)) {
        latestObsAtByEncounterId.set(obs.encounterId, obs.createdAt);
      }
    }
  }

  // Pending tasks and unacked DONE tasks per encounter
  const pendingTasksByEncounterId = new Map<string, Array<{ status: string; createdAt: Date }>>();
  const unackedDoneCountByEncounterId = new Map<string, number>();
  if (activeIds.length) {
    const taskDocs = await prisma.erTask.findMany({
      where: {
        encounterId: { in: activeIds },
        ...(demoMode ? { createdAt: { lte: to } } : {}),
      },
      select: { encounterId: true, status: true, createdAt: true, title: true },
    });
    for (const t of taskDocs) {
      const eid = t.encounterId;
      if (!eid) continue;
      if (t.status === 'ORDERED' || t.status === 'IN_PROGRESS') {
        const arr = pendingTasksByEncounterId.get(eid) || [];
        arr.push({ status: t.status, createdAt: t.createdAt });
        pendingTasksByEncounterId.set(eid, arr);
      }
      if (t.status === 'DONE' && !(t as unknown as { resultAcknowledgedAt?: Date }).resultAcknowledgedAt) {
        unackedDoneCountByEncounterId.set(eid, (unackedDoneCountByEncounterId.get(eid) || 0) + 1);
      }
    }
  }

  // Open escalations/transfers counts
  const openEscalationsCount = await prisma.erEscalation.count({
    where: {
      encounter: { tenantId },
      status: 'OPEN',
      ...(demoMode ? { createdAt: { gte: from, lte: to } } : {}),
    },
  });
  const openTransferCount = await prisma.erNursingTransferRequest.count({
    where: {
      tenantId,
      status: 'OPEN',
      ...(demoMode ? { createdAt: { gte: from, lte: to } } : {}),
    },
  });

  // Compose encounter summaries + stage ages + derived flags
  const summaries = active.map((e) => {
    const encounterId = String(e.id || '');
    const extra = extraFieldsMap.get(encounterId) || {};
    const patient = patientById.get(String(e.patientId || '')) || {} as any;
    const mrn = patient.mrn || null;
    const triageDoc = triageByEncounterId.get(encounterId) || null;
    const triageCompletedAt = triageCompletedAtByEncounterId.get(encounterId) || null;
    const bedAssignedAt = bedAssignedAtByEncounterId.get(encounterId) || null;
    const bedLabel = bedLabelByEncounterId.get(encounterId) || null;
    const primaryNurseDisplay = primaryNurseUserIdByEncounterId.get(encounterId) || null;

    const pendingTasks = pendingTasksByEncounterId.get(encounterId) || [];
    const tasksOverdueCount = computeTaskOverdueCount({ pendingTasks, now: asOf });
    const tasksOverdue = tasksOverdueCount > 0;

    const vitalsBaselineAt = latestObsAtByEncounterId.get(encounterId) || triageCompletedAt;
    const vitalsOverdue = computeOverdueVitals({ triageLevel: e.triageLevel, vitalsBaselineAt, now: asOf });

    const sepsisText = `${String(e.chiefComplaint || '')} ${String((triageDoc as any)?.notes || '')}`.toLowerCase();
    const sepsisSuspected = sepsisText.includes('sepsis');

    const { stage, startedAt } = stageFor({
      ...e,
      ...extra,
      triageStartAt: triageDoc?.triageStartAt,
      triageCompletedAt,
      bedAssignedAt,
      triageEndAt: triageDoc?.triageEndAt,
    });
    const ageMinutes = startedAt ? diffMinutes(startedAt, asOf) : diffMinutes(e.createdAt, asOf);

    return {
      encounterId,
      visitNumber: extra.visitNumber || null,
      patientName: (patient as any).fullName || 'Unknown',
      mrn,
      triageLevel: e.triageLevel ?? null,
      status: e.status || null,
      bedLabel,
      primaryNurseDisplay,
      triageCompletedAt,
      bedAssignedAt,
      seenByDoctorAt: extra.seenByDoctorAt || null,
      resultsPendingAt: extra.resultsPendingAt || null,
      stage,
      stageAgeMinutes: ageMinutes == null ? null : Math.floor(ageMinutes),
      vitalsOverdue,
      tasksOverdue,
      tasksOverdueCount,
      unackedResultsCount: unackedDoneCountByEncounterId.get(encounterId) || 0,
      sepsisSuspected,
    };
  });

  // Header counts (active)
  const totalActiveEncounters = summaries.length;
  const waitingForTriage = summaries.filter((s) => s.stage === 'REGISTERED' || s.stage === 'TRIAGE_IN_PROGRESS').length;
  const waitingForBed = summaries.filter((s) => Boolean(s.triageCompletedAt) && !s.bedAssignedAt).length;
  const waitingForDoctor = summaries.filter((s) => Boolean(s.bedAssignedAt) && !s.seenByDoctorAt).length;
  const waitingForResults =
    summaries.filter((s) => String(s.status) === 'RESULTS_PENDING' && (s.unackedResultsCount || 0) > 0).length;
  const decisionPending = summaries.filter((s) => String(s.status) === 'DECISION').length;
  const overdueVitalsCount = summaries.filter((s) => s.vitalsOverdue).length;
  const overdueTasksCount = summaries.filter((s) => s.tasksOverdue).length;

  // Stage table: count + median age
  const stages: StageKey[] = [
    'REGISTERED', 'TRIAGE_IN_PROGRESS', 'TRIAGE_COMPLETED', 'BED_ASSIGNED',
    'SEEN', 'ORDERS_IN_PROGRESS', 'RESULTS_PENDING', 'DECISION', 'FINAL',
  ];
  const stageSummary = stages.map((key) => {
    const rows = summaries.filter((s) => s.stage === key);
    const ages = rows.map((r) => Number(r.stageAgeMinutes)).filter((n) => Number.isFinite(n));
    return { stage: key, count: rows.length, medianAgeMinutes: median(ages) };
  });

  // Bottlenecks lists (top 10, oldest first)
  const sortDescByAge = <T extends { stageAgeMinutes?: number | null }>(arr: T[]) => arr.slice().sort((a, b) => (b.stageAgeMinutes || 0) - (a.stageAgeMinutes || 0));

  const longestWaitingTriage = sortDescByAge(summaries.filter((s) => !s.triageCompletedAt)).slice(0, 10);
  const longestWaitingBed = sortDescByAge(summaries.filter((s) => Boolean(s.triageCompletedAt) && !s.bedAssignedAt)).slice(0, 10);
  const longestWaitingDoctor = sortDescByAge(summaries.filter((s) => Boolean(s.bedAssignedAt) && !s.seenByDoctorAt)).slice(0, 10);
  const longestWaitingResultsReview = sortDescByAge(
    summaries.filter((s) => String(s.status) === 'RESULTS_PENDING' && (s.unackedResultsCount || 0) > 0)
  ).slice(0, 10);

  // SLA breaches in window
  const windowEncounters = await prisma.erEncounter.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to } },
    select: { id: true, status: true, createdAt: true, closedAt: true, triageLevel: true },
    take: 5000,
  });
  const windowIds = windowEncounters.map((e) => e.id).filter(Boolean);

  // Extra fields for window encounters
  const windowExtraMap = new Map<string, any>();
  if (windowIds.length) {
    const ph = windowIds.map((_, i) => `$${i + 1}`).join(', ');
    const rows: Array<any> = await prisma.$queryRawUnsafe(
      `SELECT id, "seenByDoctorAt" FROM er_encounters WHERE id IN (${ph})`,
      ...windowIds
    );
    for (const row of rows) windowExtraMap.set(String(row.id), row);
  }

  // First bed assignment for window encounters
  const windowBedAssignedAt = new Map<string, Date>();
  if (windowIds.length) {
    const bas = await prisma.erBedAssignment.findMany({
      where: { encounterId: { in: windowIds } },
      select: { encounterId: true, assignedAt: true },
      orderBy: { assignedAt: 'asc' },
    });
    for (const ba of bas) {
      if (!windowBedAssignedAt.has(ba.encounterId)) {
        windowBedAssignedAt.set(ba.encounterId, ba.assignedAt);
      }
    }
  }

  // Audit logs for window
  const triageCompletedAtWindow = new Map<string, Date>();
  const finalizedAtWindow = new Map<string, Date>();
  if (windowIds.length) {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        OR: [
          { resourceType: 'triage', resourceId: { in: windowIds } },
          { resourceType: 'encounter', resourceId: { in: windowIds } },
        ],
      },
      select: { resourceType: true, resourceId: true, timestamp: true, metadata: true },
      orderBy: { timestamp: 'asc' },
    });

    for (const log of logs) {
      const details = (log.metadata as any);
      if (log.resourceType === 'triage') {
        const encounterId = String(details?.after?.encounterId || log.resourceId || '');
        if (!encounterId || triageCompletedAtWindow.has(encounterId)) continue;
        if (!details?.after?.triageEndAt) continue;
        const triageEndAt = new Date(details.after.triageEndAt);
        if (!Number.isNaN(triageEndAt.getTime())) triageCompletedAtWindow.set(encounterId, triageEndAt);
        else if (log.timestamp) triageCompletedAtWindow.set(encounterId, log.timestamp);
      }
      if (log.resourceType === 'encounter') {
        const encounterId = String(log.resourceId || '');
        if (!encounterId || finalizedAtWindow.has(encounterId)) continue;
        const afterStatus = String(details?.after?.status || '');
        const beforeStatus = String(details?.before?.status || '');
        if (!FINAL_STATUSES_FOR_FINALIZED_AT.has(afterStatus)) continue;
        if (beforeStatus && beforeStatus === afterStatus) continue;
        if (log.timestamp) finalizedAtWindow.set(encounterId, log.timestamp);
      }
    }
  }

  const doorToTriageEligible: Array<{ id: string; dur: number }> = [];
  const doorToTriageBreaches: Array<{ id: string; dur: number }> = [];
  const bedToSeenEligible: Array<{ id: string; dur: number }> = [];
  const bedToSeenBreaches: Array<{ id: string; dur: number }> = [];
  const losAdmitEligible: Array<{ id: string; dur: number }> = [];
  const losAdmitBreaches: Array<{ id: string; dur: number }> = [];

  for (const e of windowEncounters) {
    const id = e.id;
    const triageCompletedAt = triageCompletedAtWindow.get(id) || null;
    const bedAssignedAt = windowBedAssignedAt.get(id) || null;
    const extra = windowExtraMap.get(id) || {};
    const seenByDoctorAt = safeDate(extra.seenByDoctorAt);
    const finalizedAt = finalizedAtWindow.get(id) || (e.closedAt ? new Date(e.closedAt) : null);

    if (triageCompletedAt && triageCompletedAt >= from && triageCompletedAt <= to) {
      const dur = diffMinutes(e.createdAt, triageCompletedAt);
      if (dur != null) {
        doorToTriageEligible.push({ id, dur });
        if (dur > 10) doorToTriageBreaches.push({ id, dur });
      }
    }

    if (bedAssignedAt && seenByDoctorAt && seenByDoctorAt >= from && seenByDoctorAt <= to) {
      const dur = diffMinutes(bedAssignedAt, seenByDoctorAt);
      if (dur != null) {
        bedToSeenEligible.push({ id, dur });
        if (dur > 15) bedToSeenBreaches.push({ id, dur });
      }
    }

    if (String(e.status) === 'ADMITTED' && finalizedAt && finalizedAt >= from && finalizedAt <= to) {
      const dur = diffMinutes(e.createdAt, finalizedAt);
      if (dur != null) {
        losAdmitEligible.push({ id, dur });
        if (dur > 240) losAdmitBreaches.push({ id, dur });
      }
    }
  }

  const pct = (breaches: unknown[], eligible: unknown[]) => {
    const denom = eligible.length || 0;
    if (!denom) return 0;
    return Math.round((breaches.length / denom) * 1000) / 10;
  };

  // Active breach list (current)
  const activeBreaches = sortDescByAge(
    summaries
      .flatMap((s) => {
        const rows: Array<typeof s & { breachType: string; breachAgeMinutes: number; stageAgeMinutes?: number | null }> = [];
        const createdAt = safeDate(active.find((e) => e.id === s.encounterId)?.createdAt);
        const now = asOf;
        if (!s.triageCompletedAt && createdAt) {
          const age = diffMinutes(createdAt, now);
          if (typeof age === 'number' && age > 10) rows.push({ ...s, breachType: 'Door\u2192Triage', breachAgeMinutes: Math.floor(age) });
        }
        if (s.bedAssignedAt && !s.seenByDoctorAt) {
          const age = diffMinutes(s.bedAssignedAt, now);
          if (typeof age === 'number' && age > 15) rows.push({ ...s, breachType: 'Bed\u2192Seen', breachAgeMinutes: Math.floor(age) });
        }
        if (String(s.status) === 'DECISION' && createdAt) {
          const age = diffMinutes(createdAt, now);
          if (typeof age === 'number' && age > 240) rows.push({ ...s, breachType: 'LOS (Admit)', breachAgeMinutes: Math.floor(age) });
        }
        return rows;
      })
      .sort((a, b) => (b.breachAgeMinutes || 0) - (a.breachAgeMinutes || 0))
      .slice(0, 10)
  ).slice(0, 10);

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    demoMode: Boolean(demoMode),
    headerCounts: {
      totalActiveEncounters,
      waitingForTriage,
      waitingForBed,
      waitingForDoctor,
      waitingForResults,
      decisionPending,
      openEscalationsCount,
      overdueVitalsCount,
      overdueTasksCount,
      openTransferCount,
    },
    stageSummary,
    bottlenecks: {
      longestWaitingTriage,
      longestWaitingBed,
      longestWaitingDoctor,
      longestWaitingResultsReview,
    },
    sla: {
      doorToTriage: { targetMin: 10, eligible: doorToTriageEligible.length, breaches: doorToTriageBreaches.length, breachPct: pct(doorToTriageBreaches, doorToTriageEligible) },
      bedToSeen: { targetMin: 15, eligible: bedToSeenEligible.length, breaches: bedToSeenBreaches.length, breachPct: pct(bedToSeenBreaches, bedToSeenEligible) },
      losAdmit: { targetMin: 240, eligible: losAdmitEligible.length, breaches: losAdmitBreaches.length, breachPct: pct(losAdmitBreaches, losAdmitEligible) },
      activeBreaches,
    },
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
