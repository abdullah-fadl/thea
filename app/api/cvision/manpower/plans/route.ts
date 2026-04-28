import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Manpower Plans API
 * GET /api/cvision/manpower/plans - List manpower plans
 * POST /api/cvision/manpower/plans - Create manpower plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionManpowerPlan, CVisionDepartmentPosition, CVisionEmployee } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteEmployee } from '@/lib/cvision/authz/policy';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createPlanSchema = z.object({
  departmentId: z.string().uuid(),
  positionId: z.string().uuid(),
  budgetedHeadcount: z.number().int().min(0),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

// GET - List manpower plans
export const GET = withAuthTenant(
  async (request, { tenantId, userId }, params) => {
    try {
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult;
      }
      const ctx = ctxResult;

      const { searchParams } = new URL(request.url);
      const departmentId = searchParams.get('departmentId') || undefined;
      const positionId = searchParams.get('positionId') || undefined;
      const asOfParam = searchParams.get('asOf');
      const asOf = asOfParam ? new Date(asOfParam) : new Date();

      const collection = await getCVisionCollection<CVisionManpowerPlan>(
        tenantId,
        'manpowerPlans'
      );

      // Build filter
      const filter: any = createTenantFilter(tenantId);
      if (departmentId) filter.departmentId = departmentId;
      if (positionId) filter.positionId = positionId;

      // Filter by effective date: effectiveFrom <= asOf AND (effectiveTo IS NULL OR effectiveTo >= asOf)
      filter.effectiveFrom = { $lte: asOf };
      filter.$or = [
        { effectiveTo: null },
        { effectiveTo: { $exists: false } },
        { effectiveTo: { $gte: asOf } },
      ];

      // Get all matching plans
      const plans = await collection.find(filter).limit(5000).toArray();

      // For each dept+position combination, get the latest plan (highest effectiveFrom)
      const planMap = new Map<string, CVisionManpowerPlan>();
      for (const plan of plans) {
        const key = `${plan.departmentId}:${plan.positionId}`;
        const existing = planMap.get(key);
        if (!existing || plan.effectiveFrom > existing.effectiveFrom) {
          planMap.set(key, plan);
        }
      }

      return NextResponse.json({
        success: true,
        asOf: asOf.toISOString(),
        plans: Array.from(planMap.values()),
      });
    } catch (error: any) {
      logger.error('[CVision Manpower Plans GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST - Create manpower plan
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

      const body = await request.json();
      const data = createPlanSchema.parse(body);

      // Verify department-position assignment exists, create if not
      const assignmentCollection = await getCVisionCollection<CVisionDepartmentPosition>(
        tenantId,
        'departmentPositions'
      );

      let assignment = await assignmentCollection.findOne(
        createTenantFilter(tenantId, {
          departmentId: data.departmentId,
          positionId: data.positionId,
          isActive: true,
        })
      );

      // Auto-create assignment if it doesn't exist
      if (!assignment) {
        const now = new Date();
        const newAssignment: CVisionDepartmentPosition = {
          id: uuidv4(),
          tenantId,
          departmentId: data.departmentId,
          positionId: data.positionId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
        };
        const insertResult = await assignmentCollection.insertOne(newAssignment);
        assignment = { ...newAssignment, _id: insertResult.insertedId };

        if (process.env.NODE_ENV === 'development') {
          logger.info('[Manpower Plans] Auto-created department-position assignment:', {
            departmentId: data.departmentId,
            positionId: data.positionId,
          });
        }
      }

      // Check for overlapping effective periods
      const planCollection = await getCVisionCollection<CVisionManpowerPlan>(
        tenantId,
        'manpowerPlans'
      );

      const overlappingPlans = await planCollection.find({
        ...createTenantFilter(tenantId, {
          departmentId: data.departmentId,
          positionId: data.positionId,
        }),
        $or: [
          // Plan starts before new plan ends and ends after new plan starts
          {
            effectiveFrom: { $lte: data.effectiveTo || new Date('2099-12-31') },
            $or: [
              { effectiveTo: null },
              { effectiveTo: { $exists: false } },
              { effectiveTo: { $gte: data.effectiveFrom } },
            ],
          },
        ],
      }).limit(5000).toArray();

      if (overlappingPlans.length > 0) {
        return NextResponse.json(
          {
            error: 'Overlapping plan exists',
            message: `A plan already exists for this department+position with overlapping effective period`,
            overlappingPlans: overlappingPlans.map(p => ({
              id: p.id,
              effectiveFrom: p.effectiveFrom,
              effectiveTo: p.effectiveTo,
            })),
          },
          { status: 400 }
        );
      }

      // Create plan
      const now = new Date();
      const plan: CVisionManpowerPlan = {
        id: uuidv4(),
        tenantId,
        departmentId: data.departmentId,
        positionId: data.positionId,
        budgetedHeadcount: data.budgetedHeadcount,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo || null,
        note: data.note || null,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await planCollection.insertOne(plan);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'manpower_plan_create',
        'manpower_plan',
        {
          resourceId: plan.id,
          changes: {
            after: {
              departmentId: data.departmentId,
              positionId: data.positionId,
              budgetedHeadcount: data.budgetedHeadcount,
              effectiveFrom: data.effectiveFrom,
              effectiveTo: data.effectiveTo,
            },
          },
        }
      );

      return NextResponse.json(
        { success: true, plan },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Manpower Plans POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
