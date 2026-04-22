import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Hire Candidate from Requisition API
 *
 * POST /api/cvision/recruitment/requisitions/:id/hire
 *
 * Hires a candidate and fills a vacant slot in the requisition.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
  generateSequenceNumber,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS, SEQUENCE_PREFIXES } from '@/lib/cvision/constants';
import type {
  CVisionCandidate,
  CVisionEmployee,
  CVisionBudgetedPosition,
  CVisionDepartment,
  CVisionJobTitle,
  CVisionPositionSlot,
  CVisionJobRequisition,
} from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const hireSchema = z.object({
  candidateId: z.string().uuid(),
  slotId: z.string().uuid(),
  startDate: z.string().datetime().optional(),
});

export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params || {};
      const requisitionId = resolvedParams?.id as string;

      if (!requisitionId) {
        return NextResponse.json(
          { error: 'Requisition ID is required', code: 'MISSING_ID' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = hireSchema.parse(body);

      // 1) Validate requisition
      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      const requisition = await findById(requisitionCollection, tenantId, requisitionId);

      if (!requisition) {
        return NextResponse.json(
          { error: 'Requisition not found', code: 'REQUISITION_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (requisition.status !== 'open') {
        return NextResponse.json(
          { error: 'Requisition is not open for hiring', code: 'REQUISITION_NOT_OPEN' },
          { status: 400 }
        );
      }

      // 2) Validate candidate
      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );
      const candidate = await findById(candidateCollection, tenantId, data.candidateId);

      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found', code: 'CANDIDATE_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (candidate.status === 'hired' || candidate.employeeId) {
        return NextResponse.json(
          { error: 'Candidate has already been hired', code: 'ALREADY_HIRED' },
          { status: 400 }
        );
      }

      // 3) Validate slot
      const slotCollection = await getCVisionCollection<CVisionPositionSlot>(
        tenantId,
        'positionSlots'
      );
      const slot = await findById(slotCollection, tenantId, data.slotId);

      if (!slot) {
        return NextResponse.json(
          { error: 'Position slot not found', code: 'SLOT_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (slot.status !== 'VACANT') {
        return NextResponse.json(
          { error: 'Slot is not vacant', code: 'SLOT_NOT_VACANT' },
          { status: 400 }
        );
      }

      // Verify slot belongs to this requisition
      if (slot.requisitionId !== requisitionId) {
        return NextResponse.json(
          { error: 'Slot does not belong to this requisition', code: 'SLOT_MISMATCH' },
          { status: 400 }
        );
      }

      // 4) Get position details
      const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );
      const position = await findById(positionCollection, tenantId, slot.positionId);

      if (!position || !position.isActive) {
        return NextResponse.json(
          { error: 'Position not found or inactive', code: 'POSITION_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Get department and job title
      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const department = await findById(deptCollection, tenantId, position.departmentId);

      const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );
      const jobTitle = await findById(jobTitleCollection, tenantId, position.jobTitleId);

      // 5) Create Employee
      const now = new Date();
      const startDate = data.startDate ? new Date(data.startDate) : now;

      const nameParts = candidate.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || candidate.fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      const employeeNo = await generateSequenceNumber(
        tenantId,
        SEQUENCE_PREFIXES.employee
      );

      const employeeCollection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee: CVisionEmployee = {
        id: uuidv4(),
        tenantId,
        employeeNo,
        firstName,
        lastName,
        fullName: candidate.fullName,
        email: candidate.email || null,
        phone: candidate.phone || null,
        departmentId: position.departmentId,
        jobTitleId: position.jobTitleId,
        positionId: slot.positionId,
        gradeId: position.gradeId || null,
        status: 'PROBATION',
        statusEffectiveAt: startDate,
        hiredAt: startDate,
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await employeeCollection.insertOne(employee);

      // 6) Update Slot to FILLED
      await slotCollection.updateOne(
        createTenantFilter(tenantId, { id: data.slotId }),
        {
          $set: {
            status: 'FILLED',
            employeeId: employee.id,
            candidateId: data.candidateId,
            filledAt: now,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // 7) Update Candidate to hired
      await candidateCollection.updateOne(
        createTenantFilter(tenantId, { id: data.candidateId }),
        {
          $set: {
            status: 'hired',
            hiredAt: now,
            employeeId: employee.id,
            statusChangedAt: now,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // 8) Audit
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_hire',
        'candidate',
        {
          resourceId: data.candidateId,
          changes: {
            before: { status: candidate.status },
            after: { status: 'hired', employeeId: employee.id },
          },
          metadata: {
            requisitionId,
            slotId: data.slotId,
            employeeNo,
          },
        }
      );

      logger.info('[CVision Hire from Requisition] Success:', {
        tenantId,
        requisitionId,
        candidateId: data.candidateId,
        slotId: data.slotId,
        employeeId: employee.id,
      });

      return NextResponse.json({
        success: true,
        employee: {
          id: employee.id,
          employeeNo: employee.employeeNo,
          fullName: employee.fullName,
          departmentName: department?.name,
          jobTitleName: jobTitle?.name,
        },
        message: 'Candidate hired successfully',
      }, { status: 201 });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Hire from Requisition]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
