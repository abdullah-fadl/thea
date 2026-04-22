import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';


export const dynamic = 'force-dynamic';
export const revalidate = 0;
const addTaskSchema = z.object({
  nurseId: z.string(),
  day: z.string(),
  weekStart: z.string(),
  task: z.object({
    taskType: z.string(),
    doctorId: z.string().optional(),
    roomId: z.string().optional(),
    startTime: z.string(),
    endTime: z.string(),
    notes: z.string().optional(),
    isFullSchedule: z.boolean().optional(),
  }),
});

export const POST = withAuthTenant(
  withErrorHandler(async (req, { user, tenantId, userId, role, permissions }) => {
  try {
    // Authorization check - admin or supervisor
    if (!['admin', 'supervisor'].includes(role) && !permissions.includes('nursing.scheduling.task')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data = addTaskSchema.parse(body);

    // Get doctor name if covering doctor with tenant isolation
    let doctorName;
    if (data.task.doctorId) {
      const doctor = await prisma.user.findFirst({
        where: { tenantId: tenantId ?? undefined, id: data.task.doctorId },
      });
      doctorName = doctor?.displayName || [doctor?.firstName, doctor?.lastName].filter(Boolean).join(' ');
    }

    const taskBlock = {
      id: crypto.randomUUID(),
      ...data.task,
      doctorName,
    };

    // Calculate hours
    const [startHour, startMin] = data.task.startTime.split(':').map(Number);
    const [endHour, endMin] = data.task.endTime.split(':').map(Number);
    const hours = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;

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

    // Update schedule: add task to correct day and update hours
    const assignments = Array.isArray(schedule.assignments) ? [...schedule.assignments] : [];
    const dayIndex = assignments.findIndex((a: any) => a.day === data.day);
    if (dayIndex >= 0) {
      const dayAssignment = { ...assignments[dayIndex] };
      dayAssignment.tasks = Array.isArray(dayAssignment.tasks) ? [...dayAssignment.tasks, taskBlock] : [taskBlock];
      dayAssignment.totalHours = (dayAssignment.totalHours || 0) + hours;
      assignments[dayIndex] = dayAssignment;
    }

    const totalWeeklyHours = (Number(schedule.totalWeeklyHours) || 0) + hours;
    const targetWeeklyHours = Number(schedule.targetWeeklyHours) || 40;
    const overtime = Math.max(0, totalWeeklyHours - targetWeeklyHours);
    const undertime = Math.max(0, targetWeeklyHours - totalWeeklyHours);

    await prisma.nursingAssignment.update({
      where: { id: schedule.id as string },
      data: {
        assignments,
        totalWeeklyHours,
        overtimeHours: overtime,
        undertimeHours: undertime,
      },
    });

    return NextResponse.json({ success: true, task: taskBlock });
  } catch (error) {
    logger.error('Add task error', { category: 'api', error });

    // [SEC-06]
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add task' },
      { status: 500 }
    );
  }
}), { tenantScoped: true, permissionKey: 'nursing.scheduling.task' }
);
