import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const addCodeBlueSchema = z.object({
  nurseId: z.string(),
  day: z.string(),
  weekStart: z.string(),
  codeBlue: z.object({
    role: z.string(),
    startTime: z.string(),
    endTime: z.string(),
  }),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('nursing.scheduling.codeblue')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = addCodeBlueSchema.parse(body);

    // Find the schedule
    const schedule = await prisma.nursingAssignment.findFirst({
      where: {
        tenantId,
        nurseId: data.nurseId,
        weekStartDate: data.weekStart,
      },
    }) as Record<string, unknown> | null;

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found. Please refresh the page.' },
        { status: 404 }
      );
    }

    // Update schedule: add code blue to correct day
    const assignments = Array.isArray(schedule.assignments) ? [...schedule.assignments] : [];
    const dayIndex = assignments.findIndex((a: any) => a.day === data.day);
    if (dayIndex >= 0) {
      const dayAssignment = { ...assignments[dayIndex] };
      dayAssignment.codeBlue = Array.isArray(dayAssignment.codeBlue) ? [...dayAssignment.codeBlue, data.codeBlue] : [data.codeBlue];
      assignments[dayIndex] = dayAssignment;
    }

    await prisma.nursingAssignment.update({
      where: { id: schedule.id as string },
      data: {
        assignments: assignments as any,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Add Code Blue error', { category: 'api', error });

    // [SEC-06]
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add Code Blue assignment' },
      { status: 500 }
    );
  }
}), { tenantScoped: true, permissionKey: 'nursing.scheduling.codeblue' }
);
