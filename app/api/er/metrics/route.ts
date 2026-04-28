import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { computeErMetrics } from '@/lib/er/metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FINAL_STATUSES = ['DISCHARGED', 'ADMITTED', 'TRANSFERRED'] as const;

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  const url = new URL(req.url);
  const fromParam = parseDateParam(url.searchParams.get('from'));
  const toParam = parseDateParam(url.searchParams.get('to'));

  const to = toParam || new Date();
  const from = fromParam || new Date(to.getTime() - 24 * 60 * 60 * 1000);

  // Fetch encounters in date range
  const encounters = await prisma.erEncounter.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      closedAt: true,
      triageLevel: true,
    },
    take: 5000,
  });

  const encounterIds = encounters.map((e) => e.id).filter(Boolean);

  // Fetch first bed assignment per encounter
  const bedAssignedAtByEncounterId = new Map<string, Date>();
  if (encounterIds.length) {
    const bedAssignments = await prisma.erBedAssignment.findMany({
      where: { encounterId: { in: encounterIds } },
      select: { encounterId: true, assignedAt: true },
      orderBy: { assignedAt: 'asc' },
    });
    // Keep only the first per encounter
    for (const ba of bedAssignments) {
      if (!bedAssignedAtByEncounterId.has(ba.encounterId)) {
        bedAssignedAtByEncounterId.set(ba.encounterId, ba.assignedAt);
      }
    }
  }

  // Fetch dispositions
  const dispositionByEncounterId = new Map<string, string>();
  if (encounterIds.length) {
    const dispositions = await prisma.erDisposition.findMany({
      where: { encounterId: { in: encounterIds } },
      select: { encounterId: true, type: true },
    });
    for (const d of dispositions) {
      dispositionByEncounterId.set(d.encounterId, d.type);
    }
  }

  // Fetch audit logs for triage completion and finalization timestamps
  const triageCompletedAtByEncounterId = new Map<string, Date>();
  const finalizedAtByEncounterId = new Map<string, Date>();

  if (encounterIds.length) {
    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        OR: [
          { resourceType: 'triage', resourceId: { in: encounterIds } },
          { resourceType: 'encounter', resourceId: { in: encounterIds } },
        ],
      },
      select: { resourceType: true, resourceId: true, timestamp: true, metadata: true },
      orderBy: { timestamp: 'asc' },
      take: 10000,
    });

    for (const log of logs) {
      const details = (log.metadata as Record<string, unknown>);
      if (log.resourceType === 'triage') {
        const encounterId = String((details?.after as any)?.encounterId || log.resourceId || '');
        if (!encounterId || triageCompletedAtByEncounterId.has(encounterId)) continue;
        const triageEndAt = (details?.after as any)?.triageEndAt ? new Date((details?.after as any).triageEndAt) : null;
        if (triageEndAt && !Number.isNaN(triageEndAt.getTime())) {
          triageCompletedAtByEncounterId.set(encounterId, triageEndAt);
        } else if (log.timestamp) {
          triageCompletedAtByEncounterId.set(encounterId, log.timestamp);
        }
      }

      if (log.resourceType === 'encounter') {
        const encounterId = String(log.resourceId || '');
        if (!encounterId || finalizedAtByEncounterId.has(encounterId)) continue;
        const afterStatus = String((details?.after as any)?.status || '');
        const beforeStatus = String((details?.before as any)?.status || '');
        if (!(FINAL_STATUSES as readonly string[]).includes(afterStatus)) continue;
        if (beforeStatus && beforeStatus === afterStatus) continue;
        if (log.timestamp) {
          finalizedAtByEncounterId.set(encounterId, log.timestamp);
        }
      }
    }
  }

  // Fetch extra encounter fields via raw query (seenByDoctorAt, ordersStartedAt, etc. not in Prisma schema)
  const extraFields = new Map<string, any>();
  if (encounterIds.length) {
    const placeholders = encounterIds.map((_, i) => `$${i + 1}`).join(', ');
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, "seenByDoctorAt", "ordersStartedAt", "resultsPendingAt", "decisionAt"
       FROM er_encounters WHERE id IN (${placeholders})`,
      ...encounterIds
    );
    for (const row of rows) {
      extraFields.set(String(row.id), row);
    }
  }

  const mapped = encounters.map((e: any) => {
    const id = String(e.id || '');
    const extra = extraFields.get(id) || {};
    const finalizedAt = finalizedAtByEncounterId.get(id) || (e.closedAt ? new Date(e.closedAt) : null);
    const triageCompletedAt = triageCompletedAtByEncounterId.get(id) || null;

    return {
      createdAt: e.createdAt,
      triageCompletedAt,
      bedAssignedAt: bedAssignedAtByEncounterId.get(id) || null,
      seenByDoctorAt: extra.seenByDoctorAt || null,
      ordersStartedAt: extra.ordersStartedAt || null,
      resultsPendingAt: extra.resultsPendingAt || null,
      decisionAt: extra.decisionAt || null,
      finalizedAt,
      dispositionType: dispositionByEncounterId.get(id) || null,
      finalStatus: e.status || null,
    };
  });

  const result = computeErMetrics({ from, to, encounters: mapped });
  return NextResponse.json(result);
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
