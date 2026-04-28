import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Operating hours: 06:00 to 22:00 (16 hours)
const OP_START_HOUR = 6;
const OP_END_HOUR = 22;
const OP_TOTAL_MINUTES = (OP_END_HOUR - OP_START_HOUR) * 60; // 960 min

interface ScheduledItem {
  id: string;
  orderId: string;
  patientName: string;
  patientMasterId: string;
  procedureName: string;
  procedureCode: string;
  status: string;
  currentStep: string | null;
  scheduledDate: Date | null;
  scheduledStartTime: Date | null;
  scheduledEndTime: Date | null;
  estimatedDurationMin: number | null;
  roomName: string;
  priority: string;
  caseType: string;
  surgeonName: string;
  anesthesiologistName: string;
  asaClass: string;
  team: { surgeon: string; anesthesiologist: string; scrubNurse: string; circulatingNurse: string } | null;
  createdAt: Date;
}

// ── GET: Fetch schedule for a date ──
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  const url = new URL(req.url);
  const dateStr = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const endDateStr = url.searchParams.get('endDate') || dateStr;

  // Parse date range
  const startDate = new Date(dateStr + 'T00:00:00Z');
  const endDate = new Date(endDateStr + 'T23:59:59Z');

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
  }

  // Fetch all cases scheduled in date range
  const cases = await prisma.orCase.findMany({
    where: {
      tenantId,
      scheduledDate: { gte: startDate, lte: endDate },
      status: { not: 'CANCELLED' },
    },
    orderBy: { scheduledStartTime: 'asc' },
    take: 500,
  });

  // Also fetch unscheduled OPEN cases (for the sidebar panel)
  const unscheduledCases = await prisma.orCase.findMany({
    where: {
      tenantId,
      scheduledDate: null,
      status: 'OPEN',
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Enrich with patient names (from orders or patientMaster)
  const patientIds = [...cases, ...unscheduledCases]
    .map((c) => c.patientMasterId)
    .filter(Boolean) as string[];
  const uniquePatientIds = [...new Set(patientIds)];

  const patientLookup: Record<string, string> = {};
  if (uniquePatientIds.length > 0) {
    const patients = await prisma.patientMaster.findMany({
      where: { tenantId, id: { in: uniquePatientIds } },
      select: { id: true, fullName: true },
    });
    for (const p of patients) patientLookup[p.id] = p.fullName || '';
  }

  // Fetch surgical teams for scheduled cases
  const caseIds = cases.map((c) => c.id);
  const teams = caseIds.length > 0
    ? await prisma.orSurgicalTeam.findMany({
        where: { tenantId, caseId: { in: caseIds } },
      })
    : [];
  const teamLookup: Record<string, typeof teams[number]> = {};
  for (const t of teams) teamLookup[t.caseId] = t;

  // Fetch latest event step for each case
  const latestEvents = caseIds.length > 0
    ? await prisma.orCaseEvent.findMany({
        where: { tenantId, caseId: { in: caseIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['caseId'],
      })
    : [];
  const stepLookup: Record<string, string> = {};
  for (const ev of latestEvents) stepLookup[ev.caseId] = ev.step;

  // Map scheduled cases
  const scheduledItems: ScheduledItem[] = cases.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    patientName: patientLookup[c.patientMasterId || ''] || '',
    patientMasterId: c.patientMasterId || '',
    procedureName: c.procedureName || '',
    procedureCode: c.procedureCode || '',
    status: c.status,
    currentStep: stepLookup[c.id] || null,
    // Scheduling
    scheduledDate: c.scheduledDate,
    scheduledStartTime: c.scheduledStartTime,
    scheduledEndTime: c.scheduledEndTime,
    estimatedDurationMin: c.estimatedDurationMin,
    roomName: c.roomName || '',
    priority: c.priority,
    caseType: c.caseType || '',
    surgeonName: c.surgeonName || '',
    anesthesiologistName: c.anesthesiologistName || '',
    asaClass: c.asaClass || '',
    // Team
    team: teamLookup[c.id] ? {
      surgeon: teamLookup[c.id].surgeon,
      anesthesiologist: teamLookup[c.id].anesthesiologist,
      scrubNurse: teamLookup[c.id].scrubNurse,
      circulatingNurse: teamLookup[c.id].circulatingNurse,
    } : null,
    createdAt: c.createdAt,
  }));

  // Map unscheduled cases
  const unscheduledItems = unscheduledCases.map((c) => ({
    id: c.id,
    orderId: c.orderId,
    patientName: patientLookup[c.patientMasterId || ''] || '',
    patientMasterId: c.patientMasterId || '',
    procedureName: c.procedureName || '',
    status: c.status,
    priority: c.priority,
    caseType: c.caseType || '',
    surgeonName: c.surgeonName || '',
    estimatedDurationMin: c.estimatedDurationMin,
    createdAt: c.createdAt,
  }));

  // Group by room
  const roomSet = new Set<string>();
  for (const c of scheduledItems) if (c.roomName) roomSet.add(c.roomName);
  const rooms: string[] = [...roomSet].sort();
  const byRoom: Record<string, ScheduledItem[]> = {};
  for (const room of rooms) {
    byRoom[room] = scheduledItems.filter((c) => c.roomName === room);
  }

  // Conflict detection: check overlapping cases in same room
  const conflicts: { room: string; case1Id: string; case2Id: string; case1Name: string; case2Name: string }[] = [];
  for (const room of rooms) {
    const roomCases = byRoom[room] || [];
    for (let i = 0; i < roomCases.length; i++) {
      for (let j = i + 1; j < roomCases.length; j++) {
        const a = roomCases[i];
        const b = roomCases[j];
        if (a.scheduledStartTime && a.scheduledEndTime && b.scheduledStartTime && b.scheduledEndTime) {
          const aStart = new Date(a.scheduledStartTime).getTime();
          const aEnd = new Date(a.scheduledEndTime).getTime();
          const bStart = new Date(b.scheduledStartTime).getTime();
          const bEnd = new Date(b.scheduledEndTime).getTime();
          if (aStart < bEnd && bStart < aEnd) {
            conflicts.push({
              room,
              case1Id: a.id, case2Id: b.id,
              case1Name: a.procedureName, case2Name: b.procedureName,
            });
          }
        }
      }
    }
  }

  // KPIs
  const totalCases = scheduledItems.length;
  const roomsActive = rooms.length;
  const emergencies = scheduledItems.filter((c) => c.priority === 'EMERGENCY').length;

  // Utilization: sum of scheduled minutes / (rooms × operating hours)
  let totalScheduledMin = 0;
  for (const c of scheduledItems) {
    if (c.estimatedDurationMin) totalScheduledMin += c.estimatedDurationMin;
    else if (c.scheduledStartTime && c.scheduledEndTime) {
      const diff = new Date(c.scheduledEndTime).getTime() - new Date(c.scheduledStartTime).getTime();
      totalScheduledMin += diff / 60000;
    }
  }
  const maxCapacityMin = Math.max(roomsActive, 1) * OP_TOTAL_MINUTES;
  const utilization = maxCapacityMin > 0 ? Math.round((totalScheduledMin / maxCapacityMin) * 100) : 0;

  return NextResponse.json({
    date: dateStr,
    endDate: endDateStr,
    scheduled: scheduledItems,
    unscheduled: unscheduledItems,
    byRoom,
    rooms,
    conflicts,
    kpis: { totalCases, roomsActive, emergencies, utilization },
  });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' }
);

// ── POST: Schedule a case (assign date/time/room) ──
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {

  const body = await req.json();
  const {
    caseId, scheduledDate, scheduledStartTime, scheduledEndTime,
    estimatedDurationMin, roomName, priority, caseType, surgeonName,
    anesthesiologistName, asaClass,
  } = body;

  if (!caseId) {
    return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
  }
  if (!scheduledDate || !scheduledStartTime || !roomName) {
    return NextResponse.json({ error: 'scheduledDate, scheduledStartTime, and roomName are required' }, { status: 400 });
  }

  // Verify case exists
  const orCase = await prisma.orCase.findFirst({ where: { tenantId, id: caseId } });
  if (!orCase) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  }

  // Parse times
  const startTime = new Date(scheduledStartTime);
  let endTime: Date | null = null;
  if (scheduledEndTime) {
    endTime = new Date(scheduledEndTime);
  } else if (estimatedDurationMin) {
    endTime = new Date(startTime.getTime() + estimatedDurationMin * 60000);
  }

  // Conflict detection: check for overlapping cases in same room on same date
  if (endTime) {
    const overlapping = await prisma.orCase.findMany({
      where: {
        tenantId,
        roomName,
        scheduledDate: new Date(scheduledDate),
        status: { not: 'CANCELLED' },
        id: { not: caseId },
        scheduledStartTime: { lt: endTime },
        scheduledEndTime: { gt: startTime },
      },
    });

    if (overlapping.length > 0) {
      return NextResponse.json({
        error: 'Time conflict detected',
        conflictsWith: overlapping.map((c) => ({
          id: c.id,
          procedureName: c.procedureName,
          startTime: c.scheduledStartTime,
          endTime: c.scheduledEndTime,
        })),
      }, { status: 409 });
    }
  }

  // Update case with scheduling info
  const updated = await prisma.orCase.update({
    where: { id: caseId },
    data: {
      scheduledDate: new Date(scheduledDate),
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      estimatedDurationMin: estimatedDurationMin || null,
      roomName,
      priority: priority || 'ELECTIVE',
      caseType: caseType || null,
      surgeonName: surgeonName || null,
      anesthesiologistName: anesthesiologistName || null,
      asaClass: asaClass || null,
    },
  });

  return NextResponse.json({ success: true, case: updated });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' }
);
