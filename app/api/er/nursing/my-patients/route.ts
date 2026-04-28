import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { bucket30Min, createErNotificationsDeduped } from '@/lib/er/notifications';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isDevAccount(_email: string | null | undefined): boolean {
  return false; // backdoor removed
}

function triageThresholdMinutes(triageLevel: unknown): number {
  const n = Number(triageLevel);
  if (n === 1) return 15;
  if (n === 2) return 30;
  return 60;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {
  const url = new URL(req.url);
  const showAllRequested = url.searchParams.get('showAll') === '1';
  const showAll = false; // showAll requires admin role

  // Get all encounters for tenant
  const allEncounters = await prisma.erEncounter.findMany({
    where: { tenantId },
    orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });

  if (!allEncounters.length) {
    return NextResponse.json({ items: [], showAllEnabled: showAll });
  }

  const encounterIds = allEncounters.map((e) => e.id);

  // Get staff assignments for PRIMARY_NURSE
  const staffAssignments = await prisma.erStaffAssignment.findMany({
    where: {
      encounterId: { in: encounterIds },
      role: 'PRIMARY_NURSE',
      unassignedAt: null,
    },
  });

  const nurseByEncounter = new Map<string, string>();
  for (const sa of staffAssignments) {
    nurseByEncounter.set(sa.encounterId, sa.userId);
  }

  // Filter encounters based on assignment
  let filteredEncounters = allEncounters;
  if (!showAll) {
    filteredEncounters = allEncounters.filter((e) => nurseByEncounter.get(e.id) === userId);
  }

  if (!filteredEncounters.length) {
    return NextResponse.json({ items: [], showAllEnabled: showAll });
  }

  const filteredIds = filteredEncounters.map((e) => e.id);
  const patientIds = filteredEncounters.map((e) => e.patientId).filter(Boolean);

  // Parallel lookups
  const [patients, triageDocs, bedAssignments, pendingTasks, allTasks, latestObs, openEscalations, openTransferReqs, triageAudits] = await Promise.all([
    patientIds.length ? prisma.patientMaster.findMany({
      where: { id: { in: patientIds } },
      select: { id: true, fullName: true, mrn: true },
    }) : [],
    prisma.erTriageAssessment.findMany({
      where: { encounterId: { in: filteredIds } },
      select: { id: true, encounterId: true, triageEndAt: true, notes: true, allergiesShort: true, chronicShort: true },
    }),
    prisma.erBedAssignment.findMany({
      where: { encounterId: { in: filteredIds }, unassignedAt: null },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.erTask.findMany({
      where: { encounterId: { in: filteredIds }, status: { in: ['ORDERED', 'IN_PROGRESS'] } },
      select: { encounterId: true, status: true, createdAt: true },
    }),
    prisma.erTask.findMany({
      where: { encounterId: { in: filteredIds }, orderSetKey: { not: null } },
      select: { encounterId: true, orderSetKey: true, status: true },
    }),
    prisma.erObservation.findMany({
      where: { tenantId, encounterId: { in: filteredIds } },
      select: { encounterId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.erEscalation.findMany({
      where: { tenantId, encounterId: { in: filteredIds }, status: 'OPEN' },
      select: { encounterId: true },
    }),
    prisma.erNursingTransferRequest.findMany({
      where: { tenantId, encounterId: { in: filteredIds }, status: 'OPEN' },
      select: { encounterId: true, id: true },
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId,
        resourceType: 'triage',
      },
      select: { resourceId: true, timestamp: true, metadata: true },
      orderBy: { timestamp: 'asc' },
      take: 5000,
    }),
  ]);

  // Build maps
  const patientMap = new Map<string, { id: string; fullName: string; mrn: string }>((patients as { id: string; fullName: string; mrn: string }[]).map((p) => [p.id, p]));

  const triageByEncounter = new Map<string, (typeof triageDocs)[0]>();
  for (const t of triageDocs) {
    triageByEncounter.set(t.encounterId, t);
  }

  const bedIdsByEncounter = new Map<string, string>();
  for (const ba of bedAssignments) {
    if (!bedIdsByEncounter.has(ba.encounterId)) {
      bedIdsByEncounter.set(ba.encounterId, ba.bedId);
    }
  }

  // Fetch beds
  const allBedIds = Array.from(new Set(bedAssignments.map((ba) => ba.bedId)));
  const beds = allBedIds.length
    ? await prisma.erBed.findMany({ where: { id: { in: allBedIds } }, select: { id: true, zone: true, bedLabel: true } })
    : [];
  const bedMap = new Map(beds.map((b) => [b.id, b]));

  // Pending tasks by encounter
  const pendingTasksByEnc = new Map<string, (typeof pendingTasks)>();
  for (const t of pendingTasks) {
    const arr = pendingTasksByEnc.get(t.encounterId) || [];
    arr.push(t);
    pendingTasksByEnc.set(t.encounterId, arr);
  }

  // Latest observation by encounter
  const latestObsByEnc = new Map<string, Date>();
  for (const o of latestObs) {
    if (!latestObsByEnc.has(o.encounterId)) {
      latestObsByEnc.set(o.encounterId, o.createdAt);
    }
  }

  // Open escalations by encounter
  const escalationByEnc = new Set(openEscalations.map((e) => e.encounterId));

  // Open transfer requests by encounter
  const transferReqByEnc = new Map<string, string>();
  for (const tr of openTransferReqs) {
    transferReqByEnc.set(tr.encounterId, tr.id);
  }

  // Sepsis order sets by encounter
  const sepsisSetByEnc = new Set<string>();
  for (const t of allTasks) {
    if ((t as Record<string, unknown>).orderSetKey === 'SEPSIS') sepsisSetByEnc.add(t.encounterId);
  }

  // Triage completion audits
  const triageCompletedAtById = new Map<string, Date>();
  for (const a of triageAudits) {
    const meta = a.metadata as Record<string, any> | null;
    if (meta?.after?.triageEndAt != null && !triageCompletedAtById.has(String(a.resourceId))) {
      triageCompletedAtById.set(String(a.resourceId), a.timestamp);
    }
  }

  const nowDate = new Date();
  const nowMs = nowDate.getTime();

  const items = filteredEncounters.map((enc) => {
    const patient = patientMap.get(enc.patientId);
    const triageDoc = triageByEncounter.get(enc.id);
    const bedId = bedIdsByEncounter.get(enc.id);
    const bed = bedId ? bedMap.get(bedId) : null;
    const pending = pendingTasksByEnc.get(enc.id) || [];

    const triageCompletedAt = triageDoc
      ? (triageCompletedAtById.get(triageDoc.id) || triageDoc.triageEndAt || null)
      : null;
    const latestObservationAt = latestObsByEnc.get(enc.id) || null;
    const vitalsBaselineAt = latestObservationAt || triageCompletedAt;
    const vitalsThresholdMinutes = triageThresholdMinutes(enc.triageLevel);

    let vitalsOverdueByMinutes: number | null = null;
    if (vitalsBaselineAt) {
      const baseMs = new Date(vitalsBaselineAt).getTime();
      if (Number.isFinite(baseMs)) {
        const diffMin = Math.floor((nowMs - baseMs) / 60000);
        vitalsOverdueByMinutes = Math.max(0, diffMin - vitalsThresholdMinutes);
      }
    }

    const pendingTasksCount = pending.length;
    const tasksOverdueCount = pending.filter((t) => {
      const createdAt = t.createdAt ? new Date(t.createdAt).getTime() : nowMs;
      const ageMin = Math.floor((nowMs - createdAt) / 60000);
      return (t.status === 'ORDERED' && ageMin > 30) || (t.status === 'IN_PROGRESS' && ageMin > 60);
    }).length;

    const vitalsOverdue = typeof vitalsOverdueByMinutes === 'number' && vitalsOverdueByMinutes > 0;
    const tasksOverdue = tasksOverdueCount > 0;
    const hasOpenEscalation = escalationByEnc.has(enc.id);
    const hasOpenTransferRequest = transferReqByEnc.has(enc.id);
    const sepsisSuspectedByOrderSet = sepsisSetByEnc.has(enc.id);

    // Text-based sepsis detection
    const sepsisText = [
      enc.chiefComplaint || '',
      triageDoc?.notes || '',
      triageDoc?.allergiesShort || '',
      triageDoc?.chronicShort || '',
    ].join(' ').toLowerCase();
    const sepsisSuspectedByText = /sepsis/.test(sepsisText);

    const bedLabel = bed?.zone && bed?.bedLabel ? `${bed.zone}-${bed.bedLabel}` : null;

    return {
      encounterId: enc.id,
      visitNumber: enc.visitNumber || null,
      status: enc.status,
      triageLevel: enc.triageLevel || null,
      triageCompletedAt: triageCompletedAt || null,
      patientName: patient?.fullName || 'Unknown',
      mrn: patient?.mrn || null,
      tempMrn: null,
      respiratoryDecision: (enc as any).respiratoryDecision || null,
      bedLabel,
      pendingTasksCount,
      vitalsOverdue,
      vitalsOverdueByMinutes,
      tasksOverdue,
      tasksOverdueCount,
      hasOpenEscalation,
      hasOpenTransferRequest,
      sepsisSuspected: sepsisSuspectedByText || sepsisSuspectedByOrderSet,
    };
  });

  // Overdue notifications (anti-spam): dedupeKey = `${type}:${encounterId}:${bucket}`
  try {
    const bucket = bucket30Min(new Date());
    const notifItems: Array<{ type: string; encounterId: string; dedupeKey: string }> = [];
    for (const row of items || []) {
      const encounterId = String(row.encounterId || '').trim();
      if (!encounterId) continue;
      if (row.vitalsOverdue) {
        notifItems.push({
          type: 'OVERDUE_VITALS',
          encounterId,
          dedupeKey: `OVERDUE_VITALS:${encounterId}:${bucket}`,
        });
      }
      if (row.tasksOverdue) {
        notifItems.push({
          type: 'OVERDUE_TASKS',
          encounterId,
          dedupeKey: `OVERDUE_TASKS:${encounterId}:${bucket}`,
        });
      }
    }
    if (notifItems.length) {
      await createErNotificationsDeduped({ tenantId, items: notifItems as any });
    }
  } catch {
    // best-effort only (do not break nursing worklist)
  }

  return NextResponse.json({ items, showAllEnabled: showAll });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
