import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { ErStaffAssignmentRole } from '@prisma/client';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as unknown as Record<string, unknown>)?.role as string })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch encounters with related data
  const encountersList = await prisma.erEncounter.findMany({
    where: { tenantId },
    orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
    include: {
      patient: {
        select: { id: true, fullName: true, mrn: true },
      },
      triage: true,
      bedAssignments: {
        where: { unassignedAt: null },
        orderBy: { assignedAt: 'desc' },
        take: 1,
        include: {
          bed: { select: { id: true, zone: true, bedLabel: true } },
        },
      },
      staffAssignments: {
        where: { role: ErStaffAssignmentRole.PRIMARY_NURSE, unassignedAt: null },
        take: 1,
      },
      tasks: {
        select: { id: true, status: true, createdAt: true, title: true },
      },
      escalations: {
        where: { status: 'open' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
      nursingTransferRequests: {
        where: { status: 'OPEN' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true },
      },
      observations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  // Fetch triage audit logs for triageCompletedAt
  const encounterIds = encountersList.map((e) => e.id).filter(Boolean);
  const triageIds = encountersList
    .map((e: any) => e.triage?.id)
    .filter(Boolean) as string[];

  const triageCompletedAtMap = new Map<string, Date>();
  if (triageIds.length) {
    const triageLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        resourceType: 'triage',
        resourceId: { in: triageIds },
      },
      select: { resourceId: true, timestamp: true, metadata: true },
      orderBy: { timestamp: 'asc' },
    });
    for (const log of triageLogs) {
      const details = (log.metadata as Record<string, any>);
      if (!details?.after?.triageEndAt) continue;
      // Map triage id back to encounter id
      const encounterId = String(details?.after?.encounterId || '');
      if (!encounterId || triageCompletedAtMap.has(encounterId)) continue;
      const triageEndAt = new Date(details.after.triageEndAt);
      if (!Number.isNaN(triageEndAt.getTime())) {
        triageCompletedAtMap.set(encounterId, triageEndAt);
      } else if (log.timestamp) {
        triageCompletedAtMap.set(encounterId, log.timestamp);
      }
    }
  }

  // Fetch primary nurse user details
  const nurseUserIds = encountersList
    .map((e: any) => e.staffAssignments?.[0]?.userId)
    .filter(Boolean) as string[];
  const nurseUserMap = new Map<string, any>();
  if (nurseUserIds.length) {
    const nurseUsers = await prisma.user.findMany({
      where: { tenantId, id: { in: Array.from(new Set(nurseUserIds)) } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    for (const u of nurseUsers) {
      nurseUserMap.set(u.id, u);
    }
  }

  // Check for sepsis-related tasks
  const sepsisSetByEncounter = new Map<string, boolean>();
  if (encounterIds.length) {
    const sepsisTasks: any[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT "encounterId" FROM er_tasks WHERE "encounterId" = ANY($1) AND "tenantId" = $2 AND "orderSetKey" = 'SEPSIS'`,
      encounterIds, tenantId
    );
    for (const t of sepsisTasks) {
      sepsisSetByEncounter.set(t.encounterId, true);
    }
  }

  const now = new Date();

  const formattedEncounters = encountersList.map((encounter: any) => {
    const encounterId = encounter.id;
    const bedAssignment = encounter.bedAssignments?.[0] || null;
    const bed = bedAssignment?.bed || null;
    const primaryNurseAssignment = encounter.staffAssignments?.[0] || null;
    const nurseUser = primaryNurseAssignment ? nurseUserMap.get(primaryNurseAssignment.userId) : null;

    const pendingTasks = (encounter.tasks || []).filter(
      (t: any) => t.status === 'ORDERED' || t.status === 'IN_PROGRESS'
    );

    // Triage completed at
    const triageCompletedAt = triageCompletedAtMap.get(encounterId) || encounter.triage?.triageEndAt || null;

    // Latest observation
    const latestObservationAt = encounter.observations?.[0]?.createdAt || null;

    // Vitals overdue calculation
    const vitalsBaselineAt = latestObservationAt || triageCompletedAt;
    let vitalsOverdueByMinutes: number | null = null;
    if (vitalsBaselineAt) {
      const triageLevel = encounter.triageLevel;
      const threshold = triageLevel === 1 ? 15 : triageLevel === 2 ? 30 : 60;
      const ageMs = now.getTime() - new Date(vitalsBaselineAt).getTime();
      const ageMin = ageMs / 60000;
      vitalsOverdueByMinutes = Math.max(0, ageMin - threshold);
    }
    const vitalsOverdue = typeof vitalsOverdueByMinutes === 'number' && vitalsOverdueByMinutes > 0;

    // Task overdue calculation
    let tasksOverdueCount = 0;
    for (const t of pendingTasks) {
      const createdAt = t.createdAt ? new Date(t.createdAt) : null;
      if (!createdAt) continue;
      const ageMs = now.getTime() - createdAt.getTime();
      const ageMin = ageMs / 60000;
      if (t.status === 'ORDERED' && ageMin > 30) tasksOverdueCount++;
      if (t.status === 'IN_PROGRESS' && ageMin > 60) tasksOverdueCount++;
    }
    const tasksOverdue = tasksOverdueCount > 0;

    // Sepsis detection
    const sepsisText = `${encounter.chiefComplaint || ''} ${encounter.triage?.notes || ''} ${encounter.triage?.onset || ''} ${encounter.triage?.allergiesShort || ''} ${encounter.triage?.chronicShort || ''}`.toLowerCase();
    const sepsisSuspectedByText = sepsisText.includes('sepsis');
    const sepsisSuspectedByOrderSet = sepsisSetByEncounter.get(encounterId) || false;

    // Primary nurse display
    let primaryNurseDisplay = null;
    if (nurseUser) {
      const name = `${String(nurseUser.firstName || '').trim()} ${String(nurseUser.lastName || '').trim()}`.trim();
      primaryNurseDisplay = name || nurseUser.email || primaryNurseAssignment?.userId || null;
    } else if (primaryNurseAssignment) {
      primaryNurseDisplay = primaryNurseAssignment.userId;
    }

    // Bed label
    const bedLabel = bed?.zone && bed?.bedLabel ? `${bed.zone}-${bed.bedLabel}` : null;

    return {
      encounterId,
      visitNumber: encounter.visitNumber ?? null,
      status: encounter.status,
      triageLevel: encounter.triageLevel ?? null,
      patientName: encounter.patient?.fullName || 'Unknown',
      mrn: encounter.patient?.mrn ?? null,
      tempMrn: null,
      bedLabel,
      primaryNurseDisplay,
      vitalsOverdue,
      tasksOverdue,
      hasOpenEscalation: (encounter.escalations?.length || 0) > 0,
      hasOpenTransferRequest: (encounter.nursingTransferRequests?.length || 0) > 0,
      sepsisSuspected: sepsisSuspectedByText || sepsisSuspectedByOrderSet,
    };
  });

  // Fetch open escalations with patient info
  const openEscalations = await prisma.erEscalation.findMany({
    where: { encounter: { tenantId }, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      encounter: {
        select: {
          id: true,
          patient: { select: { fullName: true, mrn: true } },
        },
      },
    },
  });

  const formattedEscalations = openEscalations.map((esc: any) => ({
    id: esc.id,
    encounterId: esc.encounterId,
    urgency: esc.level,
    reason: esc.reason,
    note: esc.resolution,
    status: esc.status,
    createdAt: esc.createdAt,
    patientName: esc.encounter?.patient?.fullName || 'Unknown',
    mrn: esc.encounter?.patient?.mrn ?? null,
    tempMrn: null,
  }));

  // Fetch open transfer requests with patient info
  const openTransferRequests = await prisma.erNursingTransferRequest.findMany({
    where: { tenantId, status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      encounter: {
        select: {
          id: true,
          patient: { select: { fullName: true, mrn: true } },
        },
      },
    },
  });

  // Fetch user info for requestedBy
  const requestedByUserIds = openTransferRequests
    .map((r: any) => r.fromNurseId)
    .filter(Boolean);
  const requestedByUserMap = new Map<string, any>();
  if (requestedByUserIds.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(new Set(requestedByUserIds)) } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    for (const u of users) requestedByUserMap.set(u.id, u);
  }

  const transferNormalized = openTransferRequests.map((r: any) => {
    const requestedByUser = requestedByUserMap.get(r.fromNurseId);
    const requestedByName = requestedByUser
      ? `${String(requestedByUser.firstName || '').trim()} ${String(requestedByUser.lastName || '').trim()}`.trim()
      : '';
    const requestedByEmail = requestedByUser?.email || null;

    return {
      id: r.id,
      encounterId: r.encounterId,
      status: r.status,
      urgency: r.priority,
      reason: r.reason,
      createdAt: r.createdAt,
      requestedByUserId: r.fromNurseId,
      requestedByName,
      requestedByEmail,
      patientName: r.encounter?.patient?.fullName || 'Unknown',
      mrn: r.encounter?.patient?.mrn ?? null,
      tempMrn: null,
      requestedByDisplay:
        requestedByName.trim() ||
        String(requestedByEmail || '').trim() ||
        String(r.fromNurseId || '').trim() ||
        '\u2014',
    };
  });

  const counts = {
    encounters: formattedEncounters.length,
    openEscalations: formattedEscalations.length,
    openTransferRequests: transferNormalized.length,
    overdueEncounters: formattedEncounters.filter((e: any) => e.vitalsOverdue || e.tasksOverdue).length,
    sepsisSuspected: formattedEncounters.filter((e: any) => e.sepsisSuspected).length,
  };

  return NextResponse.json({
    counts,
    encounters: formattedEncounters,
    openEscalations: formattedEscalations,
    openTransferRequests: transferNormalized,
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
