import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Department Positions API
 * GET /api/cvision/org/departments/:id/positions - List positions assigned to department
 * POST /api/cvision/org/departments/:id/positions - Assign position to department
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  findById,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionDepartment, CVisionPositionType, CVisionDepartmentPosition, CVisionEmployee } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteEmployee } from '@/lib/cvision/authz/policy';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const assignPositionSchema = z.object({
  positionId: z.string().uuid(),
});

// GET - List positions assigned to department
export const GET = withAuthTenant(
  async (request, { tenantId, userId }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }

      // Resolve params (withAuthTenant may pass Promise in Next.js 15)
      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams?.id as string;

      if (!departmentId) {
        return NextResponse.json(
          { error: 'Department ID is required' },
          { status: 400 }
        );
      }

      // Verify department exists
      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const department = await findById(deptCollection, tenantId, departmentId);
      if (!department) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }

      // Get department-position assignments
      const assignmentCollection = await getCVisionCollection<CVisionDepartmentPosition>(
        tenantId,
        'departmentPositions'
      );

      const assignments = await assignmentCollection
        .find(createTenantFilter(tenantId, { departmentId, isActive: true }))
        .toArray();

      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Department Positions GET] Found assignments:', assignments.length, 'for department:', departmentId);
      }

      // Get position details
      const positionCollection = await getCVisionCollection<CVisionPositionType>(
        tenantId,
        'positionTypes'
      );

      const positions = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            const position = await findById(positionCollection, tenantId, assignment.positionId);
            return {
              assignmentId: assignment.id,
              position: position || null,
              assignedAt: assignment.createdAt,
            };
          } catch (error: any) {
            logger.error('[CVision Department Positions GET] Error loading position:', {
              assignmentId: assignment.id,
              positionId: assignment.positionId,
              error: error.message,
            });
            return {
              assignmentId: assignment.id,
              position: null,
              assignedAt: assignment.createdAt,
            };
          }
        })
      );

      const validPositions = positions.filter(p => p.position !== null);

      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Department Positions GET] Returning positions:', validPositions.length);
      }

      // Return simplified format for easier consumption
      // Format: [{ id, code, title }] as per PR-D0 requirements
      const items = validPositions.map(p => ({
        id: p.position?.id,
        code: p.position?.code || null,
        title: p.position?.title,
        // Also include legacy fields for backward compatibility
        positionId: p.position?.id,
        positionTitle: p.position?.title,
        positionCode: p.position?.code,
      }));

      return NextResponse.json({
        success: true,
        departmentId,
        positions: validPositions,
        items, // Simplified format: [{ id, code, title }]
      });
    } catch (error: any) {
      logger.error('[CVision Department Positions GET]', error?.message || String(error), error?.stack);
      return NextResponse.json(
        { 
          error: 'Internal server error', 
          message: error.message,
          code: 'DEPARTMENT_POSITIONS_ERROR',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST - Assign position to department
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }
      const ctx = ctxResult;

      // Enforce write policy
      const writePolicy = canWriteEmployee(ctx, { tenantId } as unknown as CVisionEmployee);
      const writeEnforceResult = await enforce(writePolicy, request, ctx);
      if (writeEnforceResult) {
        return writeEnforceResult;
      }

      // Resolve params (withAuthTenant may pass Promise in Next.js 15)
      const resolvedParams = params instanceof Promise ? await params : params;
      const departmentId = resolvedParams?.id as string;

      if (!departmentId) {
        return NextResponse.json(
          { error: 'Department ID is required' },
          { status: 400 }
        );
      }

      const body = await request.json();
      const data = assignPositionSchema.parse(body);

      // Verify department exists
      const deptCollection = await getCVisionCollection<CVisionDepartment>(
        tenantId,
        'departments'
      );
      const department = await findById(deptCollection, tenantId, departmentId);
      if (!department) {
        return NextResponse.json(
          { error: 'Department not found' },
          { status: 404 }
        );
      }

      // Verify position exists
      const positionCollection = await getCVisionCollection<CVisionPositionType>(
        tenantId,
        'positionTypes'
      );
      const position = await findById(positionCollection, tenantId, data.positionId);
      if (!position) {
        return NextResponse.json(
          { error: 'Position not found' },
          { status: 404 }
        );
      }

      // Check if assignment already exists
      const assignmentCollection = await getCVisionCollection<CVisionDepartmentPosition>(
        tenantId,
        'departmentPositions'
      );

      const existing = await assignmentCollection.findOne(
        createTenantFilter(tenantId, {
          departmentId,
          positionId: data.positionId,
        })
      );

      if (existing) {
        // Reactivate if archived
        if (!existing.isActive) {
          await assignmentCollection.updateOne(
            createTenantFilter(tenantId, { id: existing.id }),
            {
              $set: {
                isActive: true,
                updatedAt: new Date(),
                updatedBy: userId,
              },
            }
          );
          return NextResponse.json({
            success: true,
            assignment: { ...existing, isActive: true },
            message: 'Position assignment reactivated',
          });
        }
        return NextResponse.json(
          { error: 'Position is already assigned to this department' },
          { status: 400 }
        );
      }

      // Create assignment
      const now = new Date();
      const assignment: CVisionDepartmentPosition = {
        id: uuidv4(),
        tenantId,
        departmentId,
        positionId: data.positionId,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await assignmentCollection.insertOne(assignment);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'department_position_assign',
        'department_position',
        {
          resourceId: assignment.id,
          changes: {
            after: {
              departmentId,
              positionId: data.positionId,
              positionCode: position.code,
              positionTitle: position.title,
            },
          },
        }
      );

      return NextResponse.json(
        { success: true, assignment },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Department Positions POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
