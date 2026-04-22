import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Stats = { avg: number | null; p50: number | null; p90: number | null; count: number };

function toDateOrNull(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function minutesDiff(a: any, b: any): number | null {
  const da = a ? new Date(a) : null;
  const db2 = b ? new Date(b) : null;
  if (!da || !db2) return null;
  const ta = da.getTime();
  const tb = db2.getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.max(0, Math.floor((tb - ta) / 60000));
}

function percentileNearestRank(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx] ?? null;
}

function computeStats(values: Array<number | null | undefined>): Stats {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  const count = nums.length;
  if (!count) return { avg: null, p50: null, p90: null, count: 0 };
  const avg = Math.round((nums.reduce((s, n) => s + n, 0) / count) * 10) / 10;
  return {
    avg,
    p50: percentileNearestRank(nums, 50),
    p90: percentileNearestRank(nums, 90),
    count,
  };
}

function triageThresholdMinutes(triageLevel: any): number {
  const n = Number(triageLevel);
  if (n === 1) return 15;
  if (n === 2) return 30;
  return 60;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const url = new URL(req.url);
  const toParam = url.searchParams.get('to');
  const fromParam = url.searchParams.get('from');

  const now = new Date();
  const to = toDateOrNull(toParam) || now;
  const from = toDateOrNull(fromParam) || new Date(to.getTime() - 24 * 60 * 60000);
  if (from.getTime() > to.getTime()) {
    return NextResponse.json({ error: '`from` must be <= `to`' }, { status: 400 });
  }

  // Task metrics (windowed by startedAt/completedAt)
  const startedTasks = await prisma.erTask.findMany({
    where: { tenantId, startedAt: { gte: from, lte: to } },
    select: { createdAt: true, startedAt: true },
    take: 10000,
  });
  const timeToStartMins = (startedTasks || []).map((t: any) => minutesDiff(t.createdAt, t.startedAt));

  const completedTasks = await prisma.erTask.findMany({
    where: { tenantId, completedAt: { gte: from, lte: to }, startedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
    take: 10000,
  });
  const timeToCompleteMins = (completedTasks || []).map((t: any) => minutesDiff(t.startedAt, t.completedAt));

  // Overdue snapshot at `to` for tasks created during window still pending
  const pendingTasksAtTo = await prisma.erTask.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lte: to },
      status: { in: ['ORDERED', 'IN_PROGRESS'] },
    },
    select: { createdAt: true, status: true },
    take: 20000,
  });

  const totalPending = pendingTasksAtTo.length;
  const overdueCount = pendingTasksAtTo.filter((t: any) => {
    const age = minutesDiff(t.createdAt, to);
    const s = String(t.status || '');
    if (typeof age !== 'number') return false;
    return (s === 'ORDERED' && age > 30) || (s === 'IN_PROGRESS' && age > 60);
  }).length;
  const overduePct = totalPending ? Math.round((overdueCount / totalPending) * 1000) / 10 : 0;

  // Vitals overdue snapshot at `to` for encounters in window (startedAt in range)
  const encs = await prisma.erEncounter.findMany({
    where: { tenantId, startedAt: { gte: from, lte: to } },
    select: { id: true, triageLevel: true },
    take: 5000,
  });
  const encounterIds = encs.map((e: any) => e.id).filter(Boolean);

  let vitalsConsidered = 0;
  let vitalsOverdueCount = 0;

  if (encounterIds.length) {
    const triageDocs = await prisma.erTriageAssessment.findMany({
      where: { encounterId: { in: encounterIds } },
      select: { id: true, encounterId: true, triageEndAt: true },
    });

    const triageIdByEncounter = new Map<string, string>();
    const triageEndByEncounter = new Map<string, any>();
    for (const t of triageDocs) {
      if (t?.encounterId && t?.id) triageIdByEncounter.set(String(t.encounterId), String(t.id));
      if (t?.encounterId) triageEndByEncounter.set(String(t.encounterId), t.triageEndAt || null);
    }

    const triageIds = Array.from(new Set(triageDocs.map((t: any) => t.id).filter(Boolean)));

    // For triage completion audits, query audit logs
    const triageCompletionAudits = triageIds.length
      ? await prisma.auditLog.findMany({
          where: {
            tenantId,
            resourceType: 'triage',
            resourceId: { in: triageIds },
            timestamp: { lte: to },
          },
          select: { resourceId: true, timestamp: true, metadata: true },
          orderBy: { timestamp: 'asc' },
        })
      : [];

    // Filter to only those with after.triageEndAt != null and take first per resourceId
    const triageCompletedAtByTriageId = new Map<string, any>();
    for (const a of triageCompletionAudits) {
      const meta = a.metadata as Record<string, unknown>;
      if ((meta as any)?.after?.triageEndAt != null && !triageCompletedAtByTriageId.has(String(a.resourceId))) {
        triageCompletedAtByTriageId.set(String(a.resourceId), a.timestamp);
      }
    }

    // Latest observation per encounter
    const allObs = await prisma.erObservation.findMany({
      where: { tenantId, encounterId: { in: encounterIds }, createdAt: { lte: to } },
      select: { encounterId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const latestObsAtByEncounter = new Map<string, any>();
    for (const o of allObs) {
      if (!latestObsAtByEncounter.has(String(o.encounterId))) {
        latestObsAtByEncounter.set(String(o.encounterId), o.createdAt);
      }
    }

    for (const e of encs) {
      const id = String(e.id);
      const triageId = triageIdByEncounter.get(id) || null;
      const triageCompletedAt =
        (triageId && triageCompletedAtByTriageId.get(triageId)) || triageEndByEncounter.get(id) || null;
      const latestObservationAt = latestObsAtByEncounter.get(id) || null;
      const baseline = latestObservationAt || triageCompletedAt;
      if (!baseline) continue;
      vitalsConsidered += 1;
      const thresh = triageThresholdMinutes(e.triageLevel);
      const age = minutesDiff(baseline, to);
      if (typeof age === 'number' && age > thresh) vitalsOverdueCount += 1;
    }
  }

  const vitalsOverduePct = vitalsConsidered ? Math.round((vitalsOverdueCount / vitalsConsidered) * 1000) / 10 : 0;

  // Workload per nurse (audit-first for tasks; direct for observations)
  const taskCompleteAudits = await prisma.auditLog.findMany({
    where: {
      tenantId,
      resourceType: 'task',
      action: 'COMPLETE',
      timestamp: { gte: from, lte: to },
    },
    select: { actorUserId: true },
    take: 10000,
  });

  // Group by userId for task completes
  const taskCompleteCounts = new Map<string, number>();
  for (const a of taskCompleteAudits) {
    const uid = String(a.actorUserId || '');
    if (!uid) continue;
    taskCompleteCounts.set(uid, (taskCompleteCounts.get(uid) || 0) + 1);
  }

  const obsInRange = await prisma.erObservation.findMany({
    where: { tenantId, createdAt: { gte: from, lte: to } },
    select: { createdByUserId: true },
    take: 10000,
  });

  const obsCountByUser = new Map<string, number>();
  for (const o of obsInRange) {
    const uid = String((o as Record<string, unknown>).createdByUserId || '');
    if (!uid) continue;
    obsCountByUser.set(uid, (obsCountByUser.get(uid) || 0) + 1);
  }

  const byUser = new Map<string, { userId: string; tasksCompleted: number; observationsRecorded: number }>();
  for (const [id, count] of taskCompleteCounts) {
    byUser.set(id, { userId: id, tasksCompleted: count, observationsRecorded: 0 });
  }
  for (const [id, count] of obsCountByUser) {
    const cur = byUser.get(id) || { userId: id, tasksCompleted: 0, observationsRecorded: 0 };
    cur.observationsRecorded = count;
    byUser.set(id, cur);
  }

  const userIds = Array.from(byUser.keys());
  const userDocs = userIds.length
    ? await prisma.user.findMany({
        where: { tenantId, id: { in: userIds } },
        select: { id: true, email: true, firstName: true, lastName: true },
      })
    : [];
  const displayById = new Map<string, string>();
  for (const u of userDocs) {
    const name = `${String(u.firstName || '').trim()} ${String(u.lastName || '').trim()}`.trim();
    displayById.set(String(u.id), name || String(u.email || '').trim() || String(u.id));
  }

  const workload = Array.from(byUser.values())
    .map((w) => ({ ...w, display: displayById.get(w.userId) || w.userId }))
    .sort((a, b) => (b.tasksCompleted + b.observationsRecorded) - (a.tasksCompleted + a.observationsRecorded));

  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    tasks: {
      timeToStartMinutes: computeStats(timeToStartMins),
      timeToCompleteMinutes: computeStats(timeToCompleteMins),
      overdueSnapshot: { totalPending, overdueCount, overduePct },
    },
    vitals: {
      overdueSnapshot: { encountersConsidered: vitalsConsidered, overdueCount: vitalsOverdueCount, overduePct: vitalsOverduePct },
    },
    workload: { items: workload },
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
