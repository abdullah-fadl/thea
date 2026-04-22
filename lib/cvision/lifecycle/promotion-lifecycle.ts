import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Lifecycle — Promotion Approved
 *
 * Orchestrates all post-promotion integrations:
 * updates employee record, compensation, contract, and dispatches events.
 */

import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { v4 as uuidv4 } from 'uuid';
import { initializeLifecycle } from './init';
import { dispatchEvent, createEvent } from '@/lib/cvision/events';

interface PromotionRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  newJobTitleId?: string;
  newGradeId?: string;
  newPositionId?: string;
  newDepartmentId?: string;
  newBasicSalary?: number;
  newHousingAllowance?: number;
  newTransportAllowance?: number;
  newOtherAllowances?: number;
  effectiveDate?: Date | string;
  promotionNumber?: string;
  [key: string]: any;
}

export async function onPromotionApproved(
  db: Db,
  tenantId: string,
  promotionRecord: PromotionRecord,
  approverId: string,
): Promise<void> {
  initializeLifecycle();

  const { employeeId } = promotionRecord;
  logger.info(`[Lifecycle] onPromotionApproved: ${employeeId}, promotion=${promotionRecord.id}`);

  const effectiveDate = promotionRecord.effectiveDate
    ? new Date(promotionRecord.effectiveDate)
    : new Date();

  // 1. Update employee record with new position data
  try {
    const employeeUpdates: Record<string, any> = {
      updatedAt: new Date(),
      updatedBy: approverId,
    };

    if (promotionRecord.newJobTitleId) employeeUpdates.jobTitleId = promotionRecord.newJobTitleId;
    if (promotionRecord.newGradeId) employeeUpdates.gradeId = promotionRecord.newGradeId;
    if (promotionRecord.newPositionId) employeeUpdates.positionId = promotionRecord.newPositionId;
    if (promotionRecord.newDepartmentId) employeeUpdates.departmentId = promotionRecord.newDepartmentId;

    await db.collection('cvision_employees').updateOne(
      { tenantId, $or: [{ id: employeeId }, { employeeId }] },
      { $set: employeeUpdates },
    );
    logger.info(`[Lifecycle] Employee record updated for promotion ${employeeId}`);
  } catch (err) {
    logger.error(`[Lifecycle] Failed to update employee for promotion ${employeeId}:`, err);
  }

  // 2. Create new compensation record
  try {
    const basicSalary = promotionRecord.newBasicSalary || 0;
    const housingAllowance = promotionRecord.newHousingAllowance || 0;
    const transportAllowance = promotionRecord.newTransportAllowance || 0;
    const otherAllowances = promotionRecord.newOtherAllowances || 0;

    if (basicSalary > 0) {
      // Mark previous compensation as inactive
      await db.collection('cvision_compensation').updateMany(
        { tenantId, employeeId, status: 'ACTIVE' },
        { $set: { status: 'SUPERSEDED', supersededAt: new Date() } },
      );

      // Insert new compensation record
      await db.collection('cvision_compensation').insertOne({
        tenantId,
        employeeId,
        effectiveDate,
        basicSalary,
        housingAllowance,
        transportAllowance,
        otherAllowances,
        totalPackage: basicSalary + housingAllowance + transportAllowance + otherAllowances,
        currency: 'SAR',
        status: 'ACTIVE',
        source: 'PROMOTION',
        sourceId: promotionRecord.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: approverId,
      });
      logger.info(`[Lifecycle] Compensation updated for promotion ${employeeId}`);
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to update compensation for promotion ${employeeId}:`, err);
  }

  // 3. Create contract addendum
  try {
    const currentContract = await db.collection('cvision_contracts').findOne({
      tenantId,
      employeeId,
      status: 'ACTIVE',
    });

    if (currentContract) {
      const addendum = {
        id: uuidv4(),
        tenantId,
        employeeId,
        parentContractId: currentContract.id,
        type: 'ADDENDUM',
        status: 'ACTIVE',
        startDate: effectiveDate,
        reason: 'PROMOTION',
        promotionId: promotionRecord.id,
        changes: {
          jobTitleId: promotionRecord.newJobTitleId,
          gradeId: promotionRecord.newGradeId,
          basicSalary: promotionRecord.newBasicSalary,
          housingAllowance: promotionRecord.newHousingAllowance,
          transportAllowance: promotionRecord.newTransportAllowance,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: approverId,
      };

      await db.collection('cvision_contracts').insertOne(addendum);
      logger.info(`[Lifecycle] Contract addendum created for promotion ${employeeId}`);
    }
  } catch (err) {
    logger.error(`[Lifecycle] Failed to create contract addendum for ${employeeId}:`, err);
  }

  // 4. Dispatch event (fire-and-forget)
  try {
    await dispatchEvent(createEvent(
      tenantId,
      'employee.updated' as any,
      'promotion',
      promotionRecord.id,
      {
        employeeId,
        employeeName: promotionRecord.employeeName,
        promotionNumber: promotionRecord.promotionNumber,
        newJobTitleId: promotionRecord.newJobTitleId,
        newGradeId: promotionRecord.newGradeId,
        effectiveDate,
      },
      approverId,
    ));
  } catch (err) {
    logger.error(`[Lifecycle] Failed to dispatch promotion event:`, err);
  }
}
