import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/requireAuth';
import { getActiveTenantId } from '@/lib/auth/sessionHelpers';
import type { Nurse } from '@/lib/models/Nurse';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const GET = withErrorHandler(async (request: NextRequest) => {
  // SINGLE SOURCE OF TRUTH: Get activeTenantId from session
  const activeTenantId = await getActiveTenantId(request);
  if (!activeTenantId) {
    return NextResponse.json(
      { error: 'Tenant not selected. Please log in again.' },
      { status: 400 }
    );
  }

  // Authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get('departmentId');
  const weekStart = searchParams.get('weekStart');

  if (!departmentId || !weekStart) {
    return NextResponse.json(
      { error: 'Department ID and week start date are required' },
      { status: 400 }
    );
  }

  // Get nurses for the department - WITH tenant isolation
  const nurses = await prisma.user.findMany({
    where: {
      tenantId: activeTenantId,
      department: departmentId,
      isActive: true,
      role: { contains: 'nurse' },
    },
    take: 500,
  }) as Record<string, unknown>[];

  // Get or create schedules for the week - WITH tenant isolation
  const schedules = [];

  for (const nurse of nurses) {
    // Try to find existing schedule - WITH tenant isolation
    let schedule = await prisma.nursingAssignment.findFirst({
      where: {
        tenantId: activeTenantId,
        nurseId: nurse.id,
        weekStartDate: weekStart,
      },
    }) as Record<string, unknown> | null;

    // Create and INSERT schedule if doesn't exist
    if (!schedule) {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      schedule = await prisma.nursingAssignment.create({
        data: {
          id: `${nurse.id}-${weekStart}`,
          tenantId: activeTenantId,
          nurseId: nurse.id as string,
          nurseName: nurse.name as string,
          employeeId: nurse.employeeId as string,
          position: nurse.position as string,
          isTeamLeader: (nurse.isTeamLeader as boolean) || false,
          isChargeNurse: (nurse.isChargeNurse as boolean) || false,
          weekStartDate: weekStart,
          weekEndDate: weekEnd.toISOString().split('T')[0],
          assignments: [
            { day: 'Saturday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Sunday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Monday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Tuesday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Wednesday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Thursday', tasks: [], codeBlue: [], totalHours: 0 },
            { day: 'Friday', tasks: [], codeBlue: [], totalHours: 0 },
          ],
          totalWeeklyHours: 0,
          targetWeeklyHours: (nurse.targetWeeklyHours as number) || 40,
          overtimeHours: 0,
          undertimeHours: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    schedules.push(schedule);
  }

  return NextResponse.json({ schedules });
});
