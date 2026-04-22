import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Lifecycle — Employee Departed
 *
 * Orchestrates all post-departure integrations when an employee
 * is resigned or terminated. Handles offboarding, cancellations,
 * and org chart updates.
 */

import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { initializeLifecycle } from './init';
import { dispatchEvent, createEvent } from '@/lib/cvision/events';
import { initiateOffboarding } from '@/lib/cvision/employees/offboarding-engine';
import { cancelAllAssignments as cancelTransportAssignments } from '@/lib/cvision/transport/transport-engine';

export async function onEmployeeDeparted(
  db: Db,
  tenantId: string,
  employeeId: string,
  departureType: 'RESIGNED' | 'TERMINATED' | string,
  userId: string,
  reason?: string,
): Promise<void> {
  initializeLifecycle();

  logger.info(`[Lifecycle] onEmployeeDeparted: ${employeeId} (${departureType})`);

  // Fetch employee data for context
  let employee: any = null;
  try {
    employee = await db.collection('cvision_employees').findOne({
      tenantId,
      $or: [{ id: employeeId }, { employeeId: employeeId }],
    });
  } catch (err) {
    logger.error(`[Lifecycle] Failed to fetch employee ${employeeId}:`, err);
  }

  const employeeName = employee
    ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
    : employeeId;

  // ─── Critical operations (awaited) ─────────────────────────────

  // 1. Initiate offboarding process
  try {
    const lastWorkingDay = new Date();
    lastWorkingDay.setDate(lastWorkingDay.getDate() + 30); // Default 30-day notice
    await initiateOffboarding(db, tenantId, {
      employeeId,
      type: departureType,
      reason: reason || `Employee ${departureType.toLowerCase()}`,
      lastWorkingDay: lastWorkingDay.toISOString(),
      initiatedBy: userId,
    });
    logger.info(`[Lifecycle] Offboarding initiated for ${employeeId}`);
  } catch (err) {
    logger.error(`[Lifecycle] Failed to initiate offboarding for ${employeeId}:`, err);
  }

  // 2. Cancel all pending leave requests
  try {
    const cancelResult = await db.collection('cvision_leaves').updateMany(
      { tenantId, employeeId, status: 'PENDING', deletedAt: null },
      {
        $set: {
          status: 'CANCELLED',
          cancelReason: `Employee ${departureType.toLowerCase()}`,
          updatedAt: new Date(),
        },
      },
    );
    if (cancelResult.modifiedCount > 0) {
      logger.info(`[Lifecycle] Cancelled ${cancelResult.modifiedCount} pending leave(s) for ${employeeId}`);
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to cancel leaves for ${employeeId}:`, err);
  }

  // 3. Cancel pending loan requests
  try {
    const loanResult = await db.collection('cvision_loans').updateMany(
      { tenantId, employeeId, status: { $in: ['PENDING', 'PENDING_APPROVAL'] } },
      {
        $set: {
          status: 'CANCELLED',
          cancelReason: `Employee ${departureType.toLowerCase()}`,
          updatedAt: new Date(),
        },
      },
    );
    if (loanResult.modifiedCount > 0) {
      logger.info(`[Lifecycle] Cancelled ${loanResult.modifiedCount} pending loan(s) for ${employeeId}`);
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to cancel loans for ${employeeId}:`, err);
  }

  // ─── Non-critical operations (fire-and-forget) ─────────────────

  const nonCriticalOps = [
    // 4. Cancel transport assignments
    (async () => {
      const cancelled = await cancelTransportAssignments(db, tenantId, employeeId, userId);
      if (cancelled > 0) {
        logger.info(`[Lifecycle] Cancelled ${cancelled} transport assignment(s) for ${employeeId}`);
      }
    })(),

    // 5. Cancel active workflow instances
    (async () => {
      const wfResult = await db.collection('cvision_workflow_instances').updateMany(
        {
          tenantId,
          triggeredBy: employeeId,
          status: { $nin: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
        },
        {
          $set: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelReason: `Employee ${departureType.toLowerCase()}`,
          },
        },
      );
      if (wfResult.modifiedCount > 0) {
        logger.info(`[Lifecycle] Cancelled ${wfResult.modifiedCount} workflow(s) for ${employeeId}`);
      }
    })(),

    // 6. Cancel active delegations
    (async () => {
      const delResult = await db.collection('cvision_delegations').updateMany(
        { tenantId, delegatorId: employeeId, $or: [{ isActive: true }, { status: 'ACTIVE' }, { status: 'PENDING' }] },
        { $set: { isActive: false, status: 'REVOKED', endedAt: new Date(), endReason: 'EMPLOYEE_DEPARTURE', updatedAt: new Date() } },
      );
      if (delResult.modifiedCount > 0) {
        logger.info(`[Lifecycle] Cancelled ${delResult.modifiedCount} delegation(s) for ${employeeId}`);
      }
    })(),

    // 7. Update succession plans — mark position as needing attention
    (async () => {
      await db.collection('cvision_succession_plans').updateMany(
        { tenantId, incumbentId: employeeId },
        {
          $set: {
            positionStatus: 'VACANT',
            vacatedAt: new Date(),
            vacatedReason: departureType,
            updatedAt: new Date(),
          },
        },
      );
    })(),

    // 8. Decrement department headcount
    (async () => {
      if (employee?.departmentId) {
        await db.collection('cvision_departments').updateOne(
          { tenantId, id: employee.departmentId },
          { $inc: { headcount: -1 }, $set: { updatedAt: new Date() } },
        );
      }
    })(),

    // 9. Update search index
    (async () => {
      await db.collection('cvision_search_index').updateOne(
        { tenantId, entityType: 'employee', entityId: employeeId },
        {
          $set: {
            'metadata.status': departureType,
            updatedAt: new Date(),
          },
        },
      );
    })(),

    // 10. Dispatch event (triggers notifications, webhooks via event handlers)
    (async () => {
      const eventType = departureType === 'RESIGNED' ? 'employee.resigned' : 'employee.terminated';
      await dispatchEvent(createEvent(
        tenantId,
        eventType as any,
        'employee',
        employeeId,
        {
          name: employeeName,
          departureType,
          reason,
          departmentId: employee?.departmentId,
        },
        userId,
      ));
    })(),
  ];

  const results = await Promise.allSettled(nonCriticalOps);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn(`[Lifecycle] ${failures.length} non-critical ops failed for onEmployeeDeparted:`,
      failures.map(f => (f as PromiseRejectedResult).reason?.message || f));
  }
}
