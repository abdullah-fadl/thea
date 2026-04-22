import { v4 as uuidv4 } from 'uuid';
import { prisma, prismaModel } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { logger } from '@/lib/monitoring/logger';

export async function appendTaskEvent(args: {
  db?: any; // ignored — kept for backward compat
  tenantId: string;
  taskId: string;
  eventType: string;
  actorUserId: string | null;
  payload?: Record<string, any> | null;
}) {
  const { tenantId, taskId, eventType, actorUserId, payload } = args;
  const now = new Date();
  const event = {
    id: uuidv4(),
    tenantId,
    taskId,
    eventType,
    createdAt: now,
    actorUserId,
    payload: payload || null,
  };

  try {
    await prismaModel('clinicalTaskEvent').create({ data: event });
  } catch (error) {
    logger.error('Failed to create ClinicalTaskEvent', { category: 'clinical', taskId, error });
  }

  return event;
}

export async function auditTask(args: {
  tenantId: string;
  taskId: string;
  action: string;
  userId: string | null;
  userEmail?: string | null;
  changes?: Record<string, any>;
}) {
  const { tenantId, taskId, action, userId, userEmail, changes } = args;
  await createAuditLog('clinical_task', taskId, action, userId || 'system', userEmail, changes || {}, tenantId);
}
