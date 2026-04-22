import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { emitNotificationToRole } from '@/lib/notifications/emit';
import { ensureTasksWriteAllowed } from '@/lib/core/guards/tasksGuard';
import { logger } from '@/lib/monitoring/logger';

const TASK_TYPE_BY_KIND: Record<string, string> = {
  LAB: 'COLLECT_SPECIMEN',
  RADIOLOGY: 'PREP_FOR_RAD',
  PROCEDURE: 'PREP_FOR_PROCEDURE',
};

export async function ensureTasksFromOrder(args: {
  db?: unknown; // ignored — kept for backward compat
  tenantId: string;
  orderId: string;
  userId?: string | null;
  userEmail?: string | null;
}) {
  const { tenantId, orderId, userId, userEmail } = args;

  const order = await prisma.ordersHub.findFirst({
    where: { tenantId, id: orderId },
  });
  if (!order) {
    return { skipped: true, reason: 'ORDER_NOT_FOUND' };
  }

  const encounterCoreId = String(order.encounterCoreId || '');
  const guard = await ensureTasksWriteAllowed({ tenantId, encounterCoreId });
  if (guard) {
    return { skipped: true, reason: 'GUARD_BLOCKED' };
  }

  let existing: Record<string, unknown> | null = null;
  try {
    existing = await prisma.clinicalTask.findFirst({
      where: {
        tenantId,
        source: { path: ['system'], equals: 'orders_hub' },
        AND: {
          source: { path: ['sourceId'], equals: orderId },
        },
      },
    });
  } catch (error) {
    logger.error('Failed to check existing ClinicalTask', { category: 'clinical', orderId, error });
  }
  if (existing) {
    return { noOp: true, task: existing };
  }

  const kind = String(order.kind || '').toUpperCase();
  const taskType = TASK_TYPE_BY_KIND[kind] || 'GENERAL_TASK';
  const title = `${kind || 'ORDER'}: ${order.orderName || order.orderCode || orderId.slice(0, 8)}`;
  const now = new Date();

  const task = {
    id: uuidv4(),
    tenantId,
    encounterCoreId,
    source: { system: 'orders_hub', sourceId: orderId },
    taskType,
    title,
    priority: String(order.priority || 'ROUTINE').toUpperCase(),
    status: 'OPEN',
    createdAt: now,
    dueAt: null as Date | null,
    assignedToUserId: null as string | null,
    claimedAt: null as Date | null,
    startedAt: null as Date | null,
    completedAt: null as Date | null,
    notDoneReason: null as string | null,
    cancelReason: null as string | null,
    idempotencyKey: null as string | null,
    createdByUserId: userId || null,
  };

  try {
    await prisma.clinicalTask.create({ data: task });
  } catch (error) {
    logger.error('Failed to create ClinicalTask', { category: 'clinical', orderId, error });
  }

  try {
    await prisma.clinicalTaskEvent.create({
      data: {
        id: uuidv4(),
        tenantId,
        taskId: task.id,
        eventType: 'CREATE',
        createdAt: now,
        actorUserId: userId || null,
        payload: { source: task.source, status: task.status },
      },
    });
  } catch (error) {
    logger.error('Failed to create ClinicalTaskEvent', { category: 'clinical', taskId: task.id, error });
  }

  await createAuditLog(
    'clinical_task',
    task.id,
    'CREATE',
    userId || 'system',
    userEmail || undefined,
    { after: task },
    tenantId
  );

  try {
    await emitNotificationToRole({
      db: undefined, // db param ignored in migrated code
      tenantId,
      recipientRole: 'charge',
      scope: 'ORDERS',
      kind: 'TASK_CREATED',
      severity: 'INFO',
      title: 'New task created',
      message: task.title || 'Clinical task created',
      entity: {
        type: 'clinical_task',
        id: task.id,
        encounterCoreId,
        link: '/tasks',
        taskId: task.id,
      },
      dedupeKey: `task:${task.id}:charge`,
      actorUserId: userId || null,
      actorUserEmail: userEmail || null,
    });
  } catch {
    // notification emit may fail if not yet migrated
  }

  return { task };
}
