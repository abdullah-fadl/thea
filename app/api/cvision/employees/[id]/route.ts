import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Employee by ID API
 * GET /api/cvision/employees/[id] - Get employee
 * PUT /api/cvision/employees/[id] - Update employee
 * DELETE /api/cvision/employees/[id] - Archive employee (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  softDelete,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
  computeChanges,
} from '@/lib/cvision/audit';
import { updateEmployeeSchema } from '@/lib/cvision/validation';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionEmployee, CVisionBaseRecord } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadEmployee, canWriteEmployee } from '@/lib/cvision/authz/policy';
import { filterEmployeeData } from '@/lib/cvision/auth/field-permissions';
import { shadowEvaluate } from '@/lib/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Get employee by ID
export const GET = withAuthTenant(
  async (request, { tenantId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const employee = await findById(collection, tenantId, id);

      if (!employee) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Consistency guard (dev-only): Check for divergence between root and profile sections
      if (process.env.NODE_ENV === 'development') {
        interface ProfileSection extends CVisionBaseRecord {
          employeeId: string;
          sectionKey: string;
          dataJson?: any;
        }
        const sectionCollection = await getCVisionCollection<ProfileSection>(tenantId, 'employeeProfileSections');
        const employmentSection = await sectionCollection.findOne(
          createTenantFilter(tenantId, { employeeId: id, sectionKey: 'EMPLOYMENT' })
        );

        if (employmentSection?.dataJson) {
          const profileDeptId = employmentSection.dataJson.departmentId;
          const profilePositionId = employmentSection.dataJson.positionId;
          
          if (profileDeptId && profileDeptId !== employee.departmentId) {
            logger.warn('[CVision Consistency Guard] Department divergence detected:', {
              employeeId: id,
              rootDepartmentId: employee.departmentId,
              profileDepartmentId: profileDeptId,
              message: 'Profile section departmentId differs from root. Root is canonical.',
            });
          }
          
          if (profilePositionId !== undefined && profilePositionId !== employee.positionId) {
            logger.warn('[CVision Consistency Guard] Position divergence detected:', {
              employeeId: id,
              rootPositionId: employee.positionId,
              profilePositionId: profilePositionId,
              message: 'Profile section positionId differs from root. Root is canonical.',
            });
          }
        }
      }

      // Enforce read policy
      const readPolicy = canReadEmployee(ctx, employee);
      const enforceResult = await enforce(readPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      void shadowEvaluate({ legacyDecision: 'allow', action: 'View', principal: { id: String(ctx.userId ?? ''), type: 'Thea::User', attrs: { tenantId, role: role ?? '', hospitalId: '' } }, resource: { id, type: 'Thea::CvisionEmployee', attrs: { tenantId, organizationId: String((employee as any)?.organizationId ?? ''), status: String((employee as any)?.status ?? '') } } });

      const isOwnProfile = !!ctx.employeeId && ctx.employeeId === id;
      const filtered = filterEmployeeData(employee as Record<string, unknown>, ctx.cvisionRole, isOwnProfile);

      return NextResponse.json({ success: true, employee: filtered });
    } catch (error: any) {
      logger.error('[CVision Employee GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// PUT - Update employee
export const PUT = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = updateEmployeeSchema.parse(body);

      const collection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      // Enforce write policy
      const writePolicy = canWriteEmployee(ctx, existing);
      const enforceResult = await enforce(writePolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      // Field-level write protection: strip fields the user cannot edit
      const { canEditField } = await import('@/lib/cvision/auth/field-permissions');
      const isOwnProfile = !!ctx.employeeId && ctx.employeeId === id;
      for (const key of Object.keys(data)) {
        if (!canEditField(key, ctx.cvisionRole, isOwnProfile)) {
          delete (data as Record<string, unknown>)[key];
        }
      }

      // Check email uniqueness if changing
      if (data.email && data.email !== existing.email) {
        const existingEmail = await collection.findOne(
          createTenantFilter(tenantId, { email: data.email, id: { $ne: id } } as Record<string, unknown>)
        );
        if (existingEmail) {
          return NextResponse.json(
            { error: 'Email already in use by another employee' },
            { status: 400 }
          );
        }
      }

      // Validate department if changing
      const finalDepartmentId = data.departmentId || existing.departmentId;
      if (data.departmentId && data.departmentId !== existing.departmentId) {
        const deptCollection = await getCVisionCollection(tenantId, 'departments');
        const department = await deptCollection.findOne(
          createTenantFilter(tenantId, { id: data.departmentId })
        );
        if (!department) {
          return NextResponse.json(
            { error: 'Department not found' },
            { status: 400 }
          );
        }
      }

      // Validate positionId if provided or if department changed
      const finalPositionId = data.positionId !== undefined ? data.positionId : existing.positionId;
      
      // Log before/after for diagnostics (dev mode)
      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Employee Update] Employment section update:', {
          employeeId: id,
          before: {
            departmentId: existing.departmentId,
            positionId: existing.positionId,
          },
          after: {
            departmentId: finalDepartmentId,
            positionId: finalPositionId,
          },
        });
      }
      
      if (finalPositionId) {
        // Verify position exists — check both budgetedPositions (primary) and positionTypes (legacy)
        interface PositionType extends CVisionBaseRecord {
          code?: string;
          title?: string;
          positionCode?: string;
          departmentId?: string;
        }
        const budgetedPosCollection = await getCVisionCollection<PositionType>(tenantId, 'budgetedPositions');
        let position = await budgetedPosCollection.findOne(
          createTenantFilter(tenantId, { id: finalPositionId })
        );

        if (!position) {
          // Fallback to legacy positionTypes collection
          const legacyPosCollection = await getCVisionCollection<PositionType>(tenantId, 'positionTypes');
          position = await legacyPosCollection.findOne(
            createTenantFilter(tenantId, { id: finalPositionId })
          );
        }

        if (!position) {
          return NextResponse.json(
            { error: 'Position not found' },
            { status: 400 }
          );
        }

        // For budgeted positions, verify departmentId matches directly
        if (position.departmentId && position.departmentId !== finalDepartmentId) {
          return NextResponse.json(
            {
              error: 'Position does not belong to the selected department',
              code: 'POSITION_DEPARTMENT_MISMATCH',
              message: `Position ${position.positionCode || position.code || position.id} does not belong to the selected department.`,
            },
            { status: 400 }
          );
        }

        // For legacy positions without departmentId, check departmentPositions assignment
        if (!position.departmentId) {
          const assignmentCollection = await getCVisionCollection(tenantId, 'departmentPositions');
          const assignment = await assignmentCollection.findOne(
            createTenantFilter(tenantId, {
              departmentId: finalDepartmentId,
              positionId: finalPositionId,
              isActive: true,
            })
          );
          if (!assignment) {
            return NextResponse.json(
              {
                error: 'Position must be assigned to the selected department',
                code: 'POSITION_NOT_ASSIGNED_TO_DEPARTMENT',
                message: `Position ${position.code || position.id} (${position.title || 'Unknown'}) is not assigned to department ${finalDepartmentId}. Assign it in the department detail page first.`,
              },
              { status: 400 }
            );
          }
        }
      }

      // CRITICAL: Status changes must go through the dedicated status endpoint
      // (e.g., /api/cvision/employees/[id]/status). Allowing status updates here
      // would bypass transition validation and could reactivate terminated employees.
      if ('status' in data) {
        delete (data as Record<string, unknown>).status;
      }

      // Normalize gender enum for PG (CvisionGender expects MALE/FEMALE/OTHER)
      const normalizedData: any = { ...data };
      if (normalizedData.gender) {
        const g = String(normalizedData.gender).toUpperCase();
        const VALID_GENDERS = ['MALE', 'FEMALE', 'OTHER'];
        normalizedData.gender = VALID_GENDERS.includes(g) ? g : 'OTHER';
      }

      const updateData = {
        ...normalizedData,
        updatedAt: new Date(),
        updatedBy: userId,
      };

      await collection.updateOne(
        createTenantFilter(tenantId, { id }),
        { $set: updateData }
      );

      const updated = await findById(collection, tenantId, id);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'employee_update',
        'employee',
        {
          resourceId: id,
          changes: computeChanges(existing, updated!),
        }
      );

      return NextResponse.json({ success: true, employee: updated });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Employee PUT]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);

// PATCH - Alias for PUT (REST compliance)
export const PATCH = PUT;

// DELETE - Archive employee (soft delete)
export const DELETE = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const resolvedParams = await params;
      const id = resolvedParams?.id as string;

      if (!id) {
        return NextResponse.json(
          { error: 'Employee ID is required' },
          { status: 400 }
        );
      }

      const collection = await getCVisionCollection<CVisionEmployee>(
        tenantId,
        'employees'
      );

      const existing = await findById(collection, tenantId, id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }

      const success = await softDelete(collection, tenantId, id, userId);

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to archive employee' },
          { status: 500 }
        );
      }

      // Trigger departure lifecycle (cancel pending leaves, revoke access, etc.)
      try {
        const { onEmployeeDeparted } = await import('@/lib/cvision/lifecycle/employee-departed');
        const { getCVisionDb } = await import('@/lib/cvision/db');
        const db = await getCVisionDb(tenantId);
        await onEmployeeDeparted(db, tenantId, id, (existing as any)?.status || 'TERMINATED', userId || 'system');
      } catch (lifecycleErr: any) {
        // Log but don't fail the DELETE — the soft-delete already succeeded
        logger.error('[CVision Employee DELETE] Departure lifecycle error:', lifecycleErr?.message || String(lifecycleErr));
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'employee_archive',
        'employee',
        { resourceId: id }
      );

      return NextResponse.json({ success: true });
    } catch (error: any) {
      logger.error('[CVision Employee DELETE]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_DELETE }
);
