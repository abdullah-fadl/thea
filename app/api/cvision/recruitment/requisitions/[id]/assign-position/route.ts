import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Requisition Assign Position API (PR-B)
 * 
 * POST /api/cvision/recruitment/requisitions/:id/assign-position
 * 
 * Assigns organization structure (departmentId, jobTitleId, positionId) to a requisition.
 * Validates hierarchy before assignment.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
  computeChanges,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionJobRequisition,
  CVisionDepartment,
  CVisionJobTitle,
  CVisionBudgetedPosition,
} from '@/lib/cvision/types';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const assignPositionSchema = z.object({
  departmentId: z.string().uuid(),
  jobTitleId: z.string().uuid(),
  positionId: z.string().uuid(),
});

// POST - Assign position to requisition
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = params instanceof Promise ? await params : params || {};
      const requisitionId = resolvedParams?.id as string;

      if (!requisitionId) {
        return NextResponse.json(
          { error: 'Requisition ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = assignPositionSchema.parse(body);

      // 1) Validate requisition exists and is tenant-scoped
      const requisitionCollection = await getCVisionCollection<CVisionJobRequisition>(
        tenantId,
        'jobRequisitions'
      );
      const requisition = await findById(requisitionCollection, tenantId, requisitionId);
      
      if (!requisition) {
        return NextResponse.json(
          { error: 'Requisition not found' },
          { status: 404 }
        );
      }

      // Can only assign position to draft requisitions
      if (requisition.status !== 'DRAFT' && requisition.status !== 'draft') {
        return NextResponse.json(
          { error: 'Can only assign position to draft requisitions' },
          { status: 400 }
        );
      }

      // 2) Validate department exists
      const departmentCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const department = await findById(departmentCollection, tenantId, data.departmentId);
      
      if (!department) {
        return NextResponse.json(
          { error: 'Department not found', code: 'DEPARTMENT_NOT_FOUND' },
          { status: 404 }
        );
      }

      // 3) Validate jobTitle exists and jobTitle.departmentId == departmentId
      const jobTitleCollection = await getCVisionCollection<CVisionJobTitle>(
        tenantId,
        'jobTitles'
      );
      const jobTitle = await findById(jobTitleCollection, tenantId, data.jobTitleId);
      
      if (!jobTitle) {
        return NextResponse.json(
          { error: 'Job title not found', code: 'JOB_TITLE_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (jobTitle.departmentId !== data.departmentId) {
        return NextResponse.json(
          {
            error: 'Job title does not belong to the specified department',
            code: 'HIERARCHY_MISMATCH',
            jobTitleDepartmentId: jobTitle.departmentId,
            providedDepartmentId: data.departmentId,
          },
          { status: 400 }
        );
      }

      // 4) Validate position exists and position.jobTitleId == jobTitleId
      const positionCollection = await getCVisionCollection<CVisionBudgetedPosition>(
        tenantId,
        'budgetedPositions'
      );
      const position = await findById(positionCollection, tenantId, data.positionId);
      
      if (!position) {
        return NextResponse.json(
          { error: 'Position not found', code: 'POSITION_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (position.jobTitleId !== data.jobTitleId) {
        return NextResponse.json(
          {
            error: 'Position does not belong to the specified job title',
            code: 'HIERARCHY_MISMATCH',
            positionJobTitleId: position.jobTitleId,
            providedJobTitleId: data.jobTitleId,
          },
          { status: 400 }
        );
      }

      if (position.departmentId !== data.departmentId) {
        return NextResponse.json(
          {
            error: 'Position does not belong to the specified department',
            code: 'HIERARCHY_MISMATCH',
            positionDepartmentId: position.departmentId,
            providedDepartmentId: data.departmentId,
          },
          { status: 400 }
        );
      }

      // 5) Update requisition
      const now = new Date();
      const updateData = {
        departmentId: data.departmentId,
        jobTitleId: data.jobTitleId,
        positionId: data.positionId,
        updatedAt: now,
        updatedBy: userId,
      };

      await requisitionCollection.updateOne(
        createTenantFilter(tenantId, { id: requisitionId }),
        { $set: updateData }
      );

      const updated = await findById(requisitionCollection, tenantId, requisitionId);

      // 6) Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'CVISION_REQUISITION_POSITION_ASSIGNED',
        'requisition',
        {
          resourceId: requisitionId,
          changes: {
            before: {
              departmentId: requisition.departmentId,
              jobTitleId: requisition.jobTitleId,
              positionId: requisition.positionId,
            },
            after: {
              departmentId: data.departmentId,
              jobTitleId: data.jobTitleId,
              positionId: data.positionId,
            },
          },
          metadata: {
            departmentId: data.departmentId,
            jobTitleId: data.jobTitleId,
            positionId: data.positionId,
            positionCode: position.positionCode,
          },
        }
      );

      return NextResponse.json({
        success: true,
        requisition: updated,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Assign Position]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE }
);
