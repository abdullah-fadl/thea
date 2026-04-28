import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Quick Hire API
 *
 * POST /api/cvision/recruitment/candidates/:id/quick-hire
 *
 * Simple hiring flow - converts a candidate directly to an employee
 * without requiring requisitions or position slots.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  findById,
  createTenantFilter,
  generateSequenceNumber,
} from '@/lib/cvision/db';
import { onEmployeeCreated } from '@/lib/cvision/lifecycle/employee-created';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS, SEQUENCE_PREFIXES } from '@/lib/cvision/constants';
import type {
  CVisionCandidate,
  CVisionEmployee,
  CVisionContract,
} from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const quickHireSchema = z.object({
  startDate: z.string(),
  basicSalary: z.number().min(0),
  housingAllowance: z.number().min(0).optional().default(0),
  transportAllowance: z.number().min(0).optional().default(0),
  departmentId: z.string().optional(),
  jobTitleId: z.string().optional(),
});

export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params || {};
      const candidateId = resolvedParams?.id as string;

      if (!candidateId) {
        return NextResponse.json(
          { error: 'Candidate ID is required', code: 'MISSING_ID' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = quickHireSchema.parse(body);

      // 1) Get candidate
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

      if (candidate.status === 'hired' || candidate.status === 'HIRED' || candidate.employeeId) {
        return NextResponse.json(
          { error: 'Candidate has already been hired', code: 'ALREADY_HIRED' },
          { status: 400 }
        );
      }

      // 2) Create Employee
      const now = new Date();
      const startDate = new Date(data.startDate);

      // Parse name
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
        departmentId: data.departmentId || null,
        jobTitleId: data.jobTitleId || null,
        positionId: null, // No position slot required
        gradeId: null,
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

      // 3) Create Contract
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
        endDate: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year default
        basicSalary: data.basicSalary,
        housingAllowance: data.housingAllowance || 0,
        transportAllowance: data.transportAllowance || 0,
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

      // 3.5) Create Profile Sections with initial data
      const profileSectionsCollection = await getCVisionCollection<any>(
        tenantId,
        'employeeProfileSections'
      );

      // PERSONAL section
      await profileSectionsCollection.insertOne({
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
      });

      // EMPLOYMENT section
      await profileSectionsCollection.insertOne({
        id: uuidv4(),
        tenantId,
        employeeId: employee.id,
        sectionKey: 'EMPLOYMENT',
        schemaVersion: 1,
        dataJson: {
          departmentId: data.departmentId || null,
          jobTitleId: data.jobTitleId || null,
          positionId: null,
          managerEmployeeId: null,
          gradeId: null,
          hiredAt: startDate.toISOString(),
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });

      // FINANCIAL section
      await profileSectionsCollection.insertOne({
        id: uuidv4(),
        tenantId,
        employeeId: employee.id,
        sectionKey: 'FINANCIAL',
        schemaVersion: 1,
        dataJson: {
          basicSalary: data.basicSalary,
          housingAllowance: data.housingAllowance || 0,
          transportAllowance: data.transportAllowance || 0,
          bankName: null,
          bankAccountNumber: null,
          iban: null,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });

      // CONTRACT section
      const probationEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days per Saudi labor law
      await profileSectionsCollection.insertOne({
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
          probationEndDate: probationEndDate.toISOString(),
          vacationDaysPerYear: 21,
        },
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });

      // 4) Update Candidate to hired
      await candidateCollection.updateOne(
        createTenantFilter(tenantId, { id: candidateId }),
        {
          $set: {
            status: 'HIRED',
            hiredAt: now,
            employeeId: employee.id,
            statusChangedAt: now,
            updatedAt: now,
            updatedBy: userId,
          },
        }
      );

      // 5) Audit
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'candidate_quick_hire',
        'candidate',
        {
          resourceId: candidateId,
          changes: {
            before: { status: candidate.status },
            after: { status: 'hired', employeeId: employee.id },
          },
          metadata: {
            employeeNo,
            contractId: contract.id,
            basicSalary: data.basicSalary,
          },
        }
      );

      // 6) Trigger lifecycle hooks (onboarding, leave balances, compensation, notifications)
      try {
        const db = await getCVisionDb(tenantId);
        await onEmployeeCreated(db, tenantId, {
          ...employee,
          currentContractId: contract.id,
        }, userId);
      } catch (lifecycleErr) {
        logger.error('[CVision Quick Hire] Lifecycle hooks failed (non-blocking):', lifecycleErr);
      }

      logger.info('[CVision Quick Hire] Success:', {
        tenantId,
        candidateId,
        employeeId: employee.id,
        employeeNo,
        contractId: contract.id,
      });

      return NextResponse.json({
        success: true,
        employee: {
          id: employee.id,
          employeeNo: employee.employeeNo,
          fullName: employee.fullName,
        },
        contract: {
          id: contract.id,
          contractNo: contract.contractNo,
        },
        message: 'Candidate hired successfully!',
      }, { status: 201 });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Quick Hire]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
