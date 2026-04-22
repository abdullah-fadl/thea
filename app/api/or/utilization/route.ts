import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler, BadRequestError } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// =============================================================================
// GET /api/or/utilization
// List utilization snapshots with optional date range and room filter.
// If ?summary=true, return aggregated metrics across the date range.
// =============================================================================

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const roomName = url.searchParams.get('roomName');
    const summary = url.searchParams.get('summary') === 'true';

    // Build where clause
    const where: any = { tenantId };

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.snapshotDate = dateFilter;
    }
    if (roomName) {
      where.roomName = roomName;
    }

    const snapshots = await prisma.orUtilizationSnapshot.findMany({
      where,
      orderBy: { snapshotDate: 'desc' },
      take: 365,
    });

    if (summary) {
      // Aggregate metrics across all returned snapshots
      const total = snapshots.length;
      if (total === 0) {
        return NextResponse.json({
          summary: {
            avgUtilization: 0,
            totalCasesScheduled: 0,
            totalCasesCompleted: 0,
            totalCasesCancelled: 0,
            avgTurnoverMinutes: 0,
            firstCaseOnTimeRate: 0,
            totalOvertime: 0,
            totalDelayMinutes: 0,
            snapshotCount: 0,
          },
          snapshots: [],
        });
      }

      let sumUtilization = 0;
      let totalCasesScheduled = 0;
      let totalCasesCompleted = 0;
      let totalCasesCancelled = 0;
      let sumTurnover = 0;
      let turnoverCount = 0;
      let onTimeCount = 0;
      let onTimeTotal = 0;
      let totalOvertime = 0;
      let totalDelayMinutes = 0;

      for (const snap of snapshots) {
        sumUtilization += snap.utilizationPct ?? 0;
        totalCasesScheduled += snap.casesScheduled ?? 0;
        totalCasesCompleted += snap.casesCompleted ?? 0;
        totalCasesCancelled += snap.casesCancelled ?? 0;
        if (snap.avgTurnoverMinutes != null) {
          sumTurnover += snap.avgTurnoverMinutes;
          turnoverCount++;
        }
        if (snap.firstCaseOnTime != null) {
          onTimeTotal++;
          if (snap.firstCaseOnTime) onTimeCount++;
        }
        totalOvertime += snap.overtime ?? 0;
        totalDelayMinutes += snap.delayMinutes ?? 0;
      }

      // Compute room-level breakdown
      const roomMap = new Map<string, { utilSum: number; count: number; cases: number; turnoverSum: number; turnoverN: number; onTime: number; onTimeN: number; cancelled: number }>();
      for (const snap of snapshots) {
        const rn = snap.roomName || 'Unknown';
        const existing = roomMap.get(rn) || { utilSum: 0, count: 0, cases: 0, turnoverSum: 0, turnoverN: 0, onTime: 0, onTimeN: 0, cancelled: 0 };
        existing.utilSum += snap.utilizationPct ?? 0;
        existing.count++;
        existing.cases += snap.casesCompleted ?? 0;
        if (snap.avgTurnoverMinutes != null) {
          existing.turnoverSum += snap.avgTurnoverMinutes;
          existing.turnoverN++;
        }
        if (snap.firstCaseOnTime != null) {
          existing.onTimeN++;
          if (snap.firstCaseOnTime) existing.onTime++;
        }
        existing.cancelled += snap.casesCancelled ?? 0;
        roomMap.set(rn, existing);
      }

      const roomBreakdown = Array.from(roomMap.entries()).map(([room, data]) => ({
        roomName: room,
        avgUtilization: Math.round((data.utilSum / data.count) * 10) / 10,
        totalCases: data.cases,
        avgTurnover: data.turnoverN > 0 ? Math.round((data.turnoverSum / data.turnoverN) * 10) / 10 : 0,
        onTimeRate: data.onTimeN > 0 ? Math.round((data.onTime / data.onTimeN) * 100 * 10) / 10 : 0,
        cancellationRate: data.cases + data.cancelled > 0
          ? Math.round((data.cancelled / (data.cases + data.cancelled)) * 100 * 10) / 10
          : 0,
      }));

      return NextResponse.json({
        summary: {
          avgUtilization: Math.round((sumUtilization / total) * 10) / 10,
          totalCasesScheduled,
          totalCasesCompleted,
          totalCasesCancelled,
          avgTurnoverMinutes: turnoverCount > 0 ? Math.round((sumTurnover / turnoverCount) * 10) / 10 : 0,
          firstCaseOnTimeRate: onTimeTotal > 0 ? Math.round((onTimeCount / onTimeTotal) * 100 * 10) / 10 : 0,
          totalOvertime,
          totalDelayMinutes,
          snapshotCount: total,
        },
        roomBreakdown,
        snapshots,
      });
    }

    return NextResponse.json({ snapshots });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.view' },
);

// =============================================================================
// POST /api/or/utilization
// Generate a utilization snapshot for a specific date and room (or all rooms).
// Computes metrics from OrCase data for that day.
// =============================================================================

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json();
    const { date, roomName } = body;

    if (!date) {
      throw new BadRequestError('date is required (YYYY-MM-DD)');
    }

    const snapshotDate = new Date(date);
    snapshotDate.setHours(0, 0, 0, 0);
    const dayEnd = new Date(snapshotDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Determine which rooms to process
    let rooms: string[] = [];
    if (roomName) {
      rooms = [roomName];
    } else {
      // Get all unique room names from cases on this date
      const casesForDate = await prisma.orCase.findMany({
        where: {
          tenantId,
          scheduledDate: { gte: snapshotDate, lte: dayEnd },
          roomName: { not: null },
        },
        select: { roomName: true },
        distinct: ['roomName'],
      });
      rooms = casesForDate.map((c: { roomName: string | null }) => c.roomName).filter(Boolean) as string[];
      if (rooms.length === 0) {
        return NextResponse.json({ message: 'No OR cases found for this date', snapshots: [] });
      }
    }

    const createdSnapshots = [];

    for (const room of rooms) {
      // Fetch all cases for this date and room
      const cases = await prisma.orCase.findMany({
        where: {
          tenantId,
          scheduledDate: { gte: snapshotDate, lte: dayEnd },
          roomName: room,
        },
        orderBy: { scheduledStartTime: 'asc' },
        take: 100,
      });

      // Fetch events for these cases to get actual start/end times
      const caseIds = cases.map((c: { id: string }) => c.id);
      const events = caseIds.length > 0
        ? await prisma.orCaseEvent.findMany({
            where: { tenantId, caseId: { in: caseIds } },
            orderBy: { createdAt: 'asc' },
          })
        : [];

      // Build event map: caseId -> events
      const eventMap = new Map<string, Array<{ step: string; createdAt: Date }>>();
      for (const ev of events) {
        const list = eventMap.get(ev.caseId) || [];
        list.push(ev);
        eventMap.set(ev.caseId, list);
      }

      // Default OR slot: 8 hours (480 min) - 07:00 to 15:00
      const totalSlotMinutes = 480;
      const casesScheduled = cases.length;
      const casesCompleted = cases.filter((c: { status: string }) => c.status === 'COMPLETED').length;
      const casesCancelled = cases.filter((c: { status: string }) => c.status === 'CANCELLED').length;

      // Calculate actual minutes used and turnover times
      let totalActualMinutes = 0;
      let totalBookedMinutes = 0;
      let turnovers: number[] = [];
      let delayMinutes = 0;
      let firstCaseOnTime: boolean | null = null;
      const caseDetails: Array<any> = [];
      let previousEndTime: Date | null = null;

      for (const orCase of cases) {
        // Booked duration
        if (orCase.scheduledStartTime && orCase.scheduledEndTime) {
          const booked = (new Date(orCase.scheduledEndTime).getTime() - new Date(orCase.scheduledStartTime).getTime()) / 60000;
          totalBookedMinutes += Math.max(0, booked);
        } else if (orCase.estimatedDurationMin) {
          totalBookedMinutes += orCase.estimatedDurationMin;
        }

        // Get actual start and end from events
        const caseEvents = eventMap.get(orCase.id) || [];
        const intraOpEvent = caseEvents.find((e: { step: string }) => e.step === 'INTRA_OP');
        const postOpEvent = caseEvents.find((e: { step: string }) => e.step === 'POST_OP');
        const recoveryEvent = caseEvents.find((e: { step: string }) => e.step === 'RECOVERY');

        const actualStart = intraOpEvent ? new Date(intraOpEvent.createdAt) : null;
        const actualEnd = recoveryEvent
          ? new Date(recoveryEvent.createdAt)
          : postOpEvent
          ? new Date(postOpEvent.createdAt)
          : null;

        let durationMin = 0;
        if (actualStart && actualEnd) {
          durationMin = Math.round((actualEnd.getTime() - actualStart.getTime()) / 60000);
          totalActualMinutes += Math.max(0, durationMin);
        }

        // First case on time check
        if (firstCaseOnTime === null && orCase.scheduledStartTime && actualStart) {
          const scheduledStart = new Date(orCase.scheduledStartTime);
          const diffMin = (actualStart.getTime() - scheduledStart.getTime()) / 60000;
          firstCaseOnTime = diffMin <= 5; // within 5 minutes considered on time
          if (diffMin > 0) delayMinutes += Math.round(diffMin);
        } else if (orCase.scheduledStartTime && actualStart) {
          const scheduledStart = new Date(orCase.scheduledStartTime);
          const diffMin = (actualStart.getTime() - scheduledStart.getTime()) / 60000;
          if (diffMin > 0) delayMinutes += Math.round(diffMin);
        }

        // Turnover from previous case
        if (previousEndTime && actualStart) {
          const turnover = Math.round((actualStart.getTime() - previousEndTime.getTime()) / 60000);
          if (turnover >= 0 && turnover < 180) {
            turnovers.push(turnover);
          }
        }
        if (actualEnd) previousEndTime = actualEnd;

        caseDetails.push({
          caseId: orCase.id,
          procedure: orCase.procedureName || 'Unknown',
          surgeon: orCase.surgeonName || '',
          scheduledStart: orCase.scheduledStartTime,
          scheduledEnd: orCase.scheduledEndTime,
          actualStart: actualStart?.toISOString() || null,
          actualEnd: actualEnd?.toISOString() || null,
          durationMin,
          status: orCase.status,
        });
      }

      const avgTurnoverMinutes = turnovers.length > 0
        ? Math.round((turnovers.reduce((a, b) => a + b, 0) / turnovers.length) * 10) / 10
        : null;

      const utilizationPct = totalSlotMinutes > 0
        ? Math.round((totalActualMinutes / totalSlotMinutes) * 100 * 10) / 10
        : 0;

      // Overtime: actual minutes beyond slot
      const overtime = Math.max(0, totalActualMinutes - totalSlotMinutes);

      // Upsert the snapshot (unique on tenantId + snapshotDate + roomName)
      const snapshot = await prisma.orUtilizationSnapshot.upsert({
        where: {
          tenantId_snapshotDate_roomName: {
            tenantId,
            snapshotDate,
            roomName: room,
          },
        },
        update: {
          totalSlotMinutes,
          bookedMinutes: Math.round(totalBookedMinutes),
          actualMinutes: totalActualMinutes,
          casesScheduled,
          casesCompleted,
          casesCancelled,
          avgTurnoverMinutes,
          firstCaseOnTime,
          delayMinutes,
          utilizationPct,
          overtime,
          details: caseDetails,
        },
        create: {
          tenantId,
          snapshotDate,
          roomName: room,
          totalSlotMinutes,
          bookedMinutes: Math.round(totalBookedMinutes),
          actualMinutes: totalActualMinutes,
          casesScheduled,
          casesCompleted,
          casesCancelled,
          avgTurnoverMinutes,
          firstCaseOnTime,
          delayMinutes,
          utilizationPct,
          overtime,
          details: caseDetails,
        },
      });

      createdSnapshots.push(snapshot);
    }

    return NextResponse.json({ snapshots: createdSnapshots });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'or.manage' },
);
