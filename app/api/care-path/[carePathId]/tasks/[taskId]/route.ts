import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { syncTaskToModules } from '@/lib/clinical/carePathSync';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

// PATCH /api/care-path/[carePathId]/tasks/[taskId]
// Update task status (mark done, missed, held, etc.)
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const segments = req.nextUrl.pathname.split('/');
    const taskIdIndex = segments.indexOf('tasks') + 1;
    const carePathIdIndex = segments.indexOf('care-path') + 1;
    const taskId = segments[taskIdIndex];
    const carePathId = segments[carePathIdIndex];

    if (!taskId || !carePathId) {
      return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
    }

    const body = await req.json();
    const {
      status,
      resultData,
      missedReason,
      missedReasonText,
      witnessUserId,
      witnessName,
    } = body;

    const validStatuses = ['PENDING', 'IN_PROGRESS', 'DONE', 'MISSED', 'HELD', 'REFUSED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const task = await prisma.carePathTask.findFirst({
      where: { id: taskId, carePathId, tenantId },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;

      if (status === 'IN_PROGRESS' && !task.startedAt) {
        updateData.startedAt = new Date();
      }

      if (status === 'DONE') {
        updateData.completedAt = new Date();
        updateData.completedByUserId = userId;
        updateData.completedByName = user?.firstName
          ? `${user.firstName} ${user.lastName ?? ''}`.trim()
          : undefined;
      }

      if (status === 'MISSED' || status === 'HELD' || status === 'REFUSED') {
        updateData.missedReason = missedReason;
        updateData.missedReasonText = missedReasonText;
      }
    }

    if (resultData) {
      updateData.resultData = resultData;
    }

    if (witnessUserId) {
      updateData.witnessUserId = witnessUserId;
      updateData.witnessName = witnessName;
    }

    const updated = await prisma.carePathTask.update({
      where: { id: taskId },
      data: updateData,
    });

    // Sync completed tasks to their respective modules
    if (status === 'DONE') {
      syncTaskToModules(prisma, {
        tenantId,
        taskId,
        carePathId,
        category: task.category,
        status: 'DONE',
        resultData: resultData ?? (updated.resultData as Record<string, unknown>),
        completedByUserId: userId,
        completedByName: user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : null,
        sourceOrderId: task.sourceOrderId,
        sourcePrescriptionId: task.sourcePrescriptionId,
      }).catch(err => logger.error('[CarePathSync] Failed to sync task to modules', { category: 'clinical', error: err instanceof Error ? err : undefined }));
    }

    // Update shift completion counts
    if (status && task.shiftId) {
      const shiftTasks = await prisma.carePathTask.findMany({
        where: { shiftId: task.shiftId },
        select: { status: true },
      });

      const completed = shiftTasks.filter(t => t.status === 'DONE').length;
      const missed = shiftTasks.filter(t => ['MISSED', 'REFUSED'].includes(t.status)).length;
      const held = shiftTasks.filter(t => t.status === 'HELD').length;

      await prisma.carePathShift.update({
        where: { id: task.shiftId },
        data: { completedTasks: completed, missedTasks: missed, heldTasks: held },
      });

      // Update overall path completion
      const allTasks = await prisma.carePathTask.findMany({
        where: { carePathId },
        select: { status: true },
      });
      const total = allTasks.length;
      const done = allTasks.filter(t => t.status === 'DONE').length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      await prisma.dailyCarePath.update({
        where: { id: carePathId },
        data: { completionPct: pct },
      });
    }

    return NextResponse.json({ task: updated });
  }),
  { tenantScoped: true, permissionKey: 'nursing.care_path.manage' }
);
