import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Lifecycle — Employee Created
 *
 * Orchestrates all post-creation integrations when a new employee is added.
 * Called once after the employee record + contract + status history are created.
 */

import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { initializeLifecycle } from './init';
import { dispatchEvent, createEvent } from '@/lib/cvision/events';
import { createOnboarding } from '@/lib/cvision/employees/onboarding-engine';

interface EmployeeData {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  departmentId: string;
  jobTitleId: string;
  nationality?: string | null;
  hiredAt?: Date | null;
  currentContractId?: string;
  [key: string]: any;
}

export async function onEmployeeCreated(
  db: Db,
  tenantId: string,
  employee: EmployeeData,
  userId: string,
): Promise<void> {
  initializeLifecycle();

  const employeeId = employee.id;
  const employeeName = `${employee.firstName} ${employee.lastName}`.trim();

  logger.info(`[Lifecycle] onEmployeeCreated: ${employeeName} (${employeeId})`);

  // ─── Critical operations (awaited) ─────────────────────────────

  // 1. Start onboarding process
  try {
    await createOnboarding(db, tenantId, employeeId);
    logger.info(`[Lifecycle] Onboarding started for ${employeeId}`);
  } catch (err) {
    logger.error(`[Lifecycle] Failed to start onboarding for ${employeeId}:`, err);
  }

  // 2. Initialize leave balances (annual + sick for current year)
  try {
    const currentYear = new Date().getFullYear();
    const leaveTypes = [
      { leaveType: 'ANNUAL', entitled: 21 },
      { leaveType: 'SICK_PAID_FULL', entitled: 30 },
      { leaveType: 'SICK_PAID_75', entitled: 60 },
      { leaveType: 'SICK_UNPAID', entitled: 90 },
      // Saudi Labor Law special leave entitlements
      { leaveType: 'MATERNITY', entitled: 70 },
      { leaveType: 'HAJJ', entitled: 10 },
      { leaveType: 'MARRIAGE', entitled: 5 },
      { leaveType: 'BEREAVEMENT', entitled: 5 },
      { leaveType: 'PATERNITY', entitled: 3 },
    ];

    const balanceDocs = leaveTypes.map(lt => ({
      tenantId,
      employeeId,
      year: currentYear,
      leaveType: lt.leaveType,
      entitled: lt.entitled,
      used: 0,
      pending: 0,
      carriedOver: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await db.collection('cvision_leave_balances').insertMany(balanceDocs);
    logger.info(`[Lifecycle] Leave balances initialized for ${employeeId}`);
  } catch (err) {
    logger.error(`[Lifecycle] Failed to initialize leave balances for ${employeeId}:`, err);
  }

  // 3. Initialize default compensation record from contract
  try {
    if (employee.currentContractId) {
      const contract = await db.collection('cvision_contracts').findOne({
        tenantId,
        id: employee.currentContractId,
      });

      if (contract) {
        await db.collection('cvision_compensation').insertOne({
          tenantId,
          employeeId,
          effectiveDate: employee.hiredAt || new Date(),
          basicSalary: contract.basicSalary || 0,
          housingAllowance: contract.housingAllowance || 0,
          transportAllowance: contract.transportAllowance || 0,
          otherAllowances: contract.otherAllowances || 0,
          totalPackage: (contract.basicSalary || 0) + (contract.housingAllowance || 0)
            + (contract.transportAllowance || 0) + (contract.otherAllowances || 0),
          currency: 'SAR',
          status: 'ACTIVE',
          source: 'INITIAL_HIRE',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: userId,
        });
        logger.info(`[Lifecycle] Compensation record created for ${employeeId}`);
      }
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to create compensation for ${employeeId}:`, err);
  }

  // ─── Non-critical operations (fire-and-forget) ─────────────────

  const nonCriticalOps = [
    // 4. Update department headcount
    (async () => {
      await db.collection('cvision_departments').updateOne(
        { tenantId, id: employee.departmentId },
        { $inc: { headcount: 1 }, $set: { updatedAt: new Date() } },
      );
    })(),

    // 5. Index employee for search
    (async () => {
      await db.collection('cvision_search_index').insertOne({
        tenantId,
        entityType: 'employee',
        entityId: employeeId,
        searchText: `${employeeName} ${employee.email || ''} ${employee.phone || ''}`.toLowerCase(),
        metadata: {
          name: employeeName,
          departmentId: employee.departmentId,
          jobTitleId: employee.jobTitleId,
          status: 'PROBATION',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    })(),

    // 6. Dispatch event (triggers notifications, webhooks, SMS via event handlers)
    (async () => {
      await dispatchEvent(createEvent(
        tenantId,
        'employee.created',
        'employee',
        employeeId,
        {
          name: employeeName,
          email: employee.email,
          phone: employee.phone,
          departmentId: employee.departmentId,
          jobTitleId: employee.jobTitleId,
        },
        userId,
      ));
    })(),
  ];

  // Fire all non-critical operations without blocking
  const results = await Promise.allSettled(nonCriticalOps);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    logger.warn(`[Lifecycle] ${failures.length} non-critical ops failed for onEmployeeCreated:`,
      failures.map(f => (f as PromiseRejectedResult).reason?.message || f));
  }
}
