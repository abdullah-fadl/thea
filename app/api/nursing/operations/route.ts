import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId } from '@/lib/tenant';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  // Get tenantId from session (SINGLE SOURCE OF TRUTH)
  const tenantIdResult = await requireTenantId(request);
  if (tenantIdResult instanceof NextResponse) {
    return tenantIdResult;
  }
  const tenantId = tenantIdResult;

  // Get auth context
  const authContext = await requireAuthContext(request);
  if (authContext instanceof NextResponse) {
    return authContext;
  }

  const { searchParams } = new URL(request.url);
  const shift = searchParams.get('shift') || 'ALL';
  const department = searchParams.get('department') || 'all';
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const targetDate = new Date(date);
  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  // ── 1. Fetch nursing assignments that cover the requested date ──
  const assignmentWhere: any = {
    tenantId,
    weekStartDate: { lte: dayEnd },
    weekEndDate: { gte: dayStart },
  };

  const allAssignments = await (prisma as unknown as Record<string, { findMany: Function }>).nursingAssignment.findMany({
    where: assignmentWhere,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Filter by shift if not ALL — inspect each assignment's JSON schedule
  let filteredAssignments = allAssignments;
  if (shift !== 'ALL') {
    filteredAssignments = allAssignments.filter((a: any) => {
      if (!a.assignments || typeof a.assignments !== 'object') return true;
      // assignments JSON may contain per-day shift info, e.g. { "2024-01-15": "DAY" }
      const dayKey = date; // YYYY-MM-DD
      const assignedShift = a.assignments[dayKey];
      if (!assignedShift) return true; // include if no specific shift data
      return String(assignedShift).toUpperCase() === shift.toUpperCase();
    });
  }

  // Filter by department if specified — check assignment metadata or position
  if (department !== 'all') {
    filteredAssignments = filteredAssignments.filter((a: any) => {
      const assignmentDept =
        a.assignments?.department || a.position || '';
      return (
        String(assignmentDept).toLowerCase() === department.toLowerCase()
      );
    });
  }

  // ── 2. Fetch clinical tasks for the tenant on the target date ──
  const [completedTaskCount, pendingTaskCount, urgentPendingCount] =
    await Promise.all([
      prisma.clinicalTask.count({
        where: {
          tenantId,
          status: 'DONE',
          completedAt: { gte: dayStart, lte: dayEnd },
        },
      }),
      prisma.clinicalTask.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'CLAIMED', 'IN_PROGRESS'] },
          createdAt: { lte: dayEnd },
        },
      }),
      prisma.clinicalTask.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'CLAIMED', 'IN_PROGRESS'] },
          priority: { in: ['URGENT', 'HIGH'] },
          createdAt: { lte: dayEnd },
        },
      }),
    ]);

  // ── 3. Calculate average response time for completed tasks today ──
  const completedTasksToday = await prisma.clinicalTask.findMany({
    where: {
      tenantId,
      status: 'DONE',
      completedAt: { gte: dayStart, lte: dayEnd },
    },
    select: { createdAt: true, completedAt: true, claimedAt: true },
    take: 200,
  });

  let avgResponseMinutes = 0;
  if (completedTasksToday.length > 0) {
    const totalMinutes = completedTasksToday.reduce((sum: number, t: any) => {
      // Response time = time from creation (or claim) to completion
      const start = t.claimedAt || t.createdAt;
      const end = t.completedAt;
      if (!start || !end) return sum;
      const diffMs = new Date(end).getTime() - new Date(start).getTime();
      return sum + Math.max(0, diffMs / 60000);
    }, 0);
    avgResponseMinutes = Math.round(totalMinutes / completedTasksToday.length);
  }

  // ── 4. Check for pre-aggregated shift metrics (faster if available) ──
  let shiftMetric: any = null;
  try {
    const shiftMetricWhere: any = {
      tenantId,
      date: dayStart,
    };
    if (shift !== 'ALL') shiftMetricWhere.shift = shift.toUpperCase();
    if (department !== 'all') shiftMetricWhere.department = department;

    shiftMetric = await (prisma as unknown as Record<string, { findFirst: Function }>).nursingShiftMetric.findFirst({
      where: shiftMetricWhere,
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    // NursingShiftMetric may not exist yet — continue with computed values
  }

  // ── 5. Compute metrics ─────────────────────────────────────────
  const totalNursesOnDuty =
    shiftMetric?.nursesOnDuty ?? filteredAssignments.length;

  const patientCount = shiftMetric?.patientCount ?? 0;

  const patientNurseRatio =
    totalNursesOnDuty > 0
      ? `${patientCount}:${totalNursesOnDuty}`
      : '0:0';

  const criticalAlerts =
    shiftMetric?.criticalAlerts ?? urgentPendingCount;

  const avgResponseTime =
    shiftMetric?.avgResponseMin != null
      ? `${Math.round(shiftMetric.avgResponseMin)} min`
      : avgResponseMinutes > 0
        ? `${avgResponseMinutes} min`
        : '0 min';

  const metrics = {
    totalNursesOnDuty,
    patientNurseRatio,
    completedTasks: shiftMetric?.completedTasks ?? completedTaskCount,
    pendingTasks: shiftMetric?.pendingTasks ?? pendingTaskCount,
    criticalAlerts,
    avgResponseTime,
  };

  // ── 6. Shape assignments for the frontend ──────────────────────
  const assignments = filteredAssignments.map((a: any) => ({
    id: a.id,
    nurseId: a.nurseId,
    nurseName: a.nurseName,
    employeeId: a.employeeId,
    position: a.position,
    isTeamLeader: a.isTeamLeader,
    isChargeNurse: a.isChargeNurse,
    totalWeeklyHours: a.totalWeeklyHours ?? 0,
    targetWeeklyHours: a.targetWeeklyHours ?? 0,
    overtimeHours: a.overtimeHours ?? 0,
    undertimeHours: a.undertimeHours ?? 0,
    assignments: a.assignments,
    weekStartDate: a.weekStartDate,
    weekEndDate: a.weekEndDate,
  }));

  return NextResponse.json({
    assignments,
    metrics,
    filters: { shift, department, date },
  });
});
