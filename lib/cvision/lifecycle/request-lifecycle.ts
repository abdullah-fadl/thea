import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Lifecycle — Request Lifecycle
 *
 * Handles the lifecycle of all request types: leaves, loans, letters, travel.
 * Wires requests into the workflow engine and dispatches events.
 */

import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { initializeLifecycle } from './init';
import { dispatchEvent, createEvent, type EventType } from '@/lib/cvision/events';

// ─── Request Created ──────────────────────────────────────────────

export async function onRequestCreated(
  db: Db,
  tenantId: string,
  resourceType: 'leave' | 'loan' | 'letter' | 'travel' | string,
  resourceId: string,
  requestData: Record<string, any>,
  userId: string,
): Promise<void> {
  initializeLifecycle();

  logger.info(`[Lifecycle] onRequestCreated: ${resourceType} ${resourceId}`);

  // 1. Try to start a workflow instance (if a template exists for this module)
  try {
    const template = await db.collection('cvision_workflow_templates').findOne({
      tenantId,
      sourceModule: resourceType,
      isActive: true,
    });

    if (template) {
      const { startInstance } = await import('@/lib/cvision/workflow-engine/workflow-engine');

      // Get user name for workflow
      let userName = userId;
      try {
        const emp = await db.collection('cvision_employees').findOne({
          tenantId,
          $or: [{ id: userId }, { employeeId: userId }],
        });
        if (emp) {
          userName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || userId;
        }
      } catch { /* use userId as fallback */ }

      const instanceId = await startInstance(db, tenantId, {
        workflowId: template.workflowId,
        triggeredBy: userId,
        triggeredByName: userName,
        sourceModule: resourceType,
        sourceId: resourceId,
      });
      logger.info(`[Lifecycle] Workflow ${instanceId} started for ${resourceType} ${resourceId}`);
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to start workflow for ${resourceType} ${resourceId}:`, err);
  }

  // 2. Dispatch event
  try {
    const eventType = `${resourceType}.requested` as EventType;
    await dispatchEvent(createEvent(
      tenantId,
      eventType,
      resourceType,
      resourceId,
      {
        ...requestData,
        employeeId: requestData.employeeId,
        employeeName: requestData.employeeName,
        managerId: requestData.managerId,
      },
      userId,
    ));
  } catch (err) {
    logger.error(`[Lifecycle] Failed to dispatch ${resourceType}.requested event:`, err);
  }
}

// ─── Request Approved ─────────────────────────────────────────────

export async function onRequestApproved(
  db: Db,
  tenantId: string,
  resourceType: 'leave' | 'loan' | 'letter' | 'travel' | string,
  resourceId: string,
  approverId: string,
  data?: Record<string, any>,
): Promise<void> {
  initializeLifecycle();

  logger.info(`[Lifecycle] onRequestApproved: ${resourceType} ${resourceId}`);

  // Resource-specific side effects
  try {
    switch (resourceType) {
      case 'leave': {
        // Move pending balance to used
        const leave = await db.collection('cvision_leaves').findOne({
          tenantId,
          $or: [
            { _id: resourceId },
            { id: resourceId },
          ],
        });
        const leaveType = leave?.leaveType || leave?.type;
        const leaveDays = leave?.days || leave?.totalDays;
        if (leave && leaveType !== 'UNPAID' && leaveDays) {
          // Atomic guard: only increment used if entitled - used >= leaveDays
          const balResult = await db.collection('cvision_leave_balances').updateOne(
            {
              tenantId,
              employeeId: leave.employeeId,
              year: new Date().getFullYear(),
              leaveType,
              $expr: { $gte: [{ $subtract: ['$entitled', '$used'] }, leaveDays] },
            },
            {
              $inc: {
                pending: -(leaveDays || 0),
                used: leaveDays || 0,
              },
              $set: { updatedAt: new Date() },
            },
          );
          if (balResult.matchedCount === 0) {
            logger.warn(`[Lifecycle] Leave balance insufficient or not found for ${leave.employeeId}, skipping update`);
          } else {
            logger.info(`[Lifecycle] Leave balance updated for ${leave.employeeId}: -${leaveDays} pending, +${leaveDays} used`);
          }
        }
        break;
      }

      case 'letter': {
        // Could trigger letter PDF generation here if needed
        // For now, letter generation is handled by the letter API itself
        break;
      }

      case 'travel':
      case 'loan':
      default:
        // Loan approval side effects are handled by the loans-engine itself
        // Travel has no additional side effects on approval
        break;
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to handle ${resourceType} approval side effects:`, err);
  }

  // Dispatch event
  try {
    const eventType = `${resourceType}.approved` as EventType;
    await dispatchEvent(createEvent(
      tenantId,
      eventType,
      resourceType,
      resourceId,
      {
        ...data,
        approverId,
      },
      approverId,
    ));
  } catch (err) {
    logger.error(`[Lifecycle] Failed to dispatch ${resourceType}.approved event:`, err);
  }
}

// ─── Request Rejected ─────────────────────────────────────────────

export async function onRequestRejected(
  db: Db,
  tenantId: string,
  resourceType: 'leave' | 'loan' | 'letter' | 'travel' | string,
  resourceId: string,
  rejectedBy: string,
  reason?: string,
): Promise<void> {
  initializeLifecycle();

  logger.info(`[Lifecycle] onRequestRejected: ${resourceType} ${resourceId}`);

  // Resource-specific side effects
  try {
    switch (resourceType) {
      case 'leave': {
        // Reverse pending balance
        const leave = await db.collection('cvision_leaves').findOne({
          tenantId,
          $or: [
            { _id: resourceId },
            { id: resourceId },
          ],
        });
        const rejLeaveType = leave?.leaveType || leave?.type;
        const rejLeaveDays = leave?.days || leave?.totalDays;
        if (leave && rejLeaveType !== 'UNPAID' && rejLeaveDays) {
          // Atomic guard: only decrement pending if pending >= rejLeaveDays
          await db.collection('cvision_leave_balances').updateOne(
            {
              tenantId,
              employeeId: leave.employeeId,
              year: new Date().getFullYear(),
              leaveType: rejLeaveType,
              pending: { $gte: rejLeaveDays },
            },
            {
              $inc: { pending: -(rejLeaveDays || 0) },
              $set: { updatedAt: new Date() },
            },
          );
          logger.info(`[Lifecycle] Leave pending balance reversed for ${leave.employeeId}`);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to handle ${resourceType} rejection side effects:`, err);
  }

  // Dispatch event
  try {
    const eventType = `${resourceType}.rejected` as EventType;
    await dispatchEvent(createEvent(
      tenantId,
      eventType,
      resourceType,
      resourceId,
      {
        rejectedBy,
        reason,
      },
      rejectedBy,
    ));
  } catch (err) {
    logger.error(`[Lifecycle] Failed to dispatch ${resourceType}.rejected event:`, err);
  }
}
