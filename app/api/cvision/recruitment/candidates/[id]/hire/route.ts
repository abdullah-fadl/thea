import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Hire Candidate API (PR-E: Hire Flow)
 * 
 * POST /api/cvision/recruitment/candidates/:id/hire
 * 
 * Converts a Candidate into an Employee, assigns a Position, and consumes a budgeted slot.
 * This is the ONLY way to create employees from recruitment.
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
  CVisionContract,
  CVisionBudgetedPosition,
  CVisionDepartment,
  CVisionJobTitle,
  CVisionPositionSlot,
} from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteEmployee } from '@/lib/cvision/authz/policy';
import { onEmployeeCreated } from '@/lib/cvision/lifecycle/employee-created';
import { getCVisionDb } from '@/lib/cvision/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const hireCandidateSchema = z.object({
  slotId: z.string().uuid(), // PR-B: Use slotId instead of positionId
  startDate: z.string().datetime().optional(),
  gradeId: z.string().uuid().nullable().optional(),
  basicSalary: z.number().min(0).optional().default(0),
  housingAllowance: z.number().min(0).optional().default(0),
  transportAllowance: z.number().min(0).optional().default(0),
});

// POST - Hire candidate (convert to employee)
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }
      const ctx = ctxResult;

      // Enforce write permission
      const writePolicy = canWriteEmployee(ctx, { tenantId } as unknown as CVisionEmployee);
      const enforceResult = await enforce(writePolicy, request, ctx);
      if (enforceResult) {
        return enforceResult;
      }

      const resolvedParams = params instanceof Promise ? await params : params || {};
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required', code: 'MISSING_CANDIDATE_ID' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = hireCandidateSchema.parse(body);

      // 1) Validate candidate exists and not already hired
      const candidateCollection = await getCVisionCollection<CVisionCandidate>(
        tenantId,
        'candidates'
      );
      const candidate = await findById(candidateCollection, tenantId, candidateId);

      if (!candidate) {
        return NextResponse.json(
          { error: 'Candidate not found', code: 'CANDIDATE_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Check if already hired
      if (candidate.status === 'hired' || candidate.status === 'HIRED' || candidate.employeeId) {
        return NextResponse.json(
          { 
            error: 'Candidate has already been hired', 
            code: 'ALREADY_HIRED',
            employeeId: candidate.employeeId || null,
          },
          { status: 400 }
        );
      }

      // 2) Validate slot exists and is VACANT (PR-B: Use slotId)
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
          { 
            error: 'Slot is not vacant', 
            code: 'SLOT_NOT_VACANT',
            currentStatus: slot.status,
          },
          { status: 400 }
        );
      }

      // Optional: Verify slot belongs to candidate's requisition (if requisitionId exists)
      if (candidate.requisitionId && slot.requisitionId && slot.requisitionId !== candidate.requisitionId) {
        // Allow but log warning (flexible matching)
        logger.warn('[CVision Hire] Slot requisitionId mismatch:', {
          slotRequisitionId: slot.requisitionId,
          candidateRequisitionId: candidate.requisitionId,
        });
      }

      // 3) Get position budget from slot
      const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );
      const position = await findById(positionCollection, tenantId, slot.positionId);

      if (!position || !position.isActive) {
        return NextResponse.json(
          { error: 'Position budget not found or inactive', code: 'POSITION_NOT_FOUND' },
          { status: 404 }
        );
      }

      // Get department and job title from position
      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const department = await findById(deptCollection, tenantId, position.departmentId);
      
      if (!department) {
        return NextResponse.json(
          { error: 'Department not found for position', code: 'DEPARTMENT_NOT_FOUND' },
          { status: 404 }
        );
      }

      const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );
      const jobTitle = await findById(jobTitleCollection, tenantId, position.jobTitleId);
      
      if (!jobTitle) {
        return NextResponse.json(
          { error: 'Job title not found for position', code: 'JOB_TITLE_NOT_FOUND' },
          { status: 404 }
        );
      }

      // 4) Create Employee
      const now = new Date();
      const startDate = data.startDate ? new Date(data.startDate) : now;
      
      // Parse fullName into firstName and lastName
      const nameParts = candidate.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || candidate.fullName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Generate employee number
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
        positionId: slot.positionId, // Link to position budget
        gradeId: data.gradeId || position.gradeId || null,
        status: 'PROBATION', // Default status
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

      // 4) Update Slot to FILLED (PR-B: Atomic slot fill)
      await slotCollection.updateOne(
        createTenantFilter(tenantId, { id: data.slotId }),
        {
          $set: {
            status: 'FILLED',
            employeeId: employee.id,
            filledAt: now,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // 5) Update Candidate
      const candidateUpdate = {
        status: 'HIRED' as const,
        hiredAt: now,
        employeeId: employee.id,
        statusChangedAt: now,
        updatedAt: now,
        updatedBy: userId,
      };

      await candidateCollection.updateOne(
        createTenantFilter(tenantId, { id: candidateId }),
        { $set: candidateUpdate }
      );

      // 5b) Create Contract
      const contractCollection = await getCVisionCollection<CVisionContract>(
        tenantId,
        'contracts'
      );

      const contractNo = await generateSequenceNumber(
        tenantId,
        SEQUENCE_PREFIXES.contract || 'CON'
      );

      const contract: CVisionContract = {
        id: uuidv4(),
        tenantId,
        contractNo,
        employeeId: employee.id,
        type: 'FIXED_TERM',
        startDate,
        endDate: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000),
        basicSalary: data.basicSalary,
        housingAllowance: data.housingAllowance,
        transportAllowance: data.transportAllowance,
        otherAllowances: 0,
        vacationDaysPerYear: 21,
        status: 'ACTIVE',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await contractCollection.insertOne(contract);

      // 5c) Create Profile Sections with initial data
      const profileSectionsCollection = await getCVisionCollection<any>(
        tenantId,
        'employeeProfileSections'
      );

      await profileSectionsCollection.insertMany([
        {
          id: uuidv4(),
          tenantId,
          employeeId: employee.id,
          sectionKey: 'PERSONAL',
          schemaVersion: 1,
          dataJson: {
            firstName,
            lastName,
            fullName: candidate.fullName,
            email: candidate.email || null,
            phone: candidate.phone || null,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        },
        {
          id: uuidv4(),
          tenantId,
          employeeId: employee.id,
          sectionKey: 'EMPLOYMENT',
          schemaVersion: 1,
          dataJson: {
            departmentId: position.departmentId,
            jobTitleId: position.jobTitleId,
            positionId: slot.positionId,
            managerEmployeeId: null,
            gradeId: data.gradeId || position.gradeId || null,
            hiredAt: startDate.toISOString(),
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        },
        {
          id: uuidv4(),
          tenantId,
          employeeId: employee.id,
          sectionKey: 'FINANCIAL',
          schemaVersion: 1,
          dataJson: {
            basicSalary: data.basicSalary,
            housingAllowance: data.housingAllowance,
            transportAllowance: data.transportAllowance,
            bankName: null,
            bankAccountNumber: null,
            iban: null,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        },
        {
          id: uuidv4(),
          tenantId,
          employeeId: employee.id,
          sectionKey: 'CONTRACT',
          schemaVersion: 1,
          dataJson: {
            contractId: contract.id,
            contractNo: contract.contractNo,
            contractType: 'FIXED_TERM',
            startDate: startDate.toISOString(),
            endDate: contract.endDate?.toISOString() || null,
            probationEndDate: new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            vacationDaysPerYear: 21,
          },
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        },
      ]);

      // 6) Audit the operation
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_hire',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            before: { status: candidate.status, employeeId: null },
            after: { status: 'hired', employeeId: employee.id },
          },
          metadata: {
            slotId: data.slotId,
            positionId: slot.positionId,
            departmentId: position.departmentId,
            jobTitleId: position.jobTitleId,
            gradeId: data.gradeId || position.gradeId,
            startDate: startDate.toISOString(),
          },
        }
      );

      // Also audit employee creation
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'employee_create',
        'employee',
        {
          resourceId: employee.id,
          changes: {
            after: {
              employeeNo,
              fullName: employee.fullName,
              departmentId: employee.departmentId,
              positionId: employee.positionId,
              status: employee.status,
            },
          },
          metadata: {
            hiredFromCandidate: candidateId,
          },
        }
      );

      // 7) Trigger lifecycle hooks (onboarding, leave balances, compensation, notifications)
      try {
        const db = await getCVisionDb(tenantId);
        await onEmployeeCreated(db, tenantId, {
          ...employee,
          currentContractId: contract.id,
        }, userId);
      } catch (lifecycleErr) {
        logger.error('[CVision Hire] Lifecycle hooks failed (non-blocking):', lifecycleErr);
      }

      logger.info('[CVision Hire Candidate] Success:', {
        tenantId,
        candidateId,
        employeeId: employee.id,
        slotId: data.slotId,
        positionId: slot.positionId,
      });

      return NextResponse.json({
        success: true,
        employee,
        candidate: {
          ...candidate,
          ...candidateUpdate,
        },
        message: 'Candidate hired successfully',
      }, { status: 201 });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors, code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
      logger.error('[CVision Hire Candidate]', error?.message || String(error), error?.stack);
      return NextResponse.json(
        { error: 'Internal server error', message: error.message, code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
