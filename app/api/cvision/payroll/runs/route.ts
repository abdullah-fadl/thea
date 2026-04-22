import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Payroll Runs API
 * POST /api/cvision/payroll/runs - Create payroll run
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  generateSequenceNumber,
  paginatedList,
} from '@/lib/cvision/db';
import { paginationSchema } from '@/lib/cvision/validation';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS, SEQUENCE_PREFIXES } from '@/lib/cvision/constants';
import type {
  CVisionPayrollRun,
  CVisionEmployee,
} from '@/lib/cvision/types';
import { z } from 'zod';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canAccessPayroll } from '@/lib/cvision/authz/policy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createPayrollRunSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
});

// GET - List payroll runs
export const GET = withAuthTenant(
  async (request, { tenantId, userId, role }) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Enforce payroll access (HR_ADMIN/CVISION_ADMIN only)
      const payrollPolicy = canAccessPayroll(ctx);
      const enforceResult = await enforce(payrollPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      const { searchParams } = new URL(request.url);
      const params = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
        sortBy: searchParams.get('sortBy') || 'createdAt',
        sortOrder: searchParams.get('sortOrder') || 'desc',
      });

      const collection = await getCVisionCollection<CVisionPayrollRun>(
        tenantId,
        'payrollRuns'
      );

      const result = await paginatedList(
        collection,
        tenantId,
        params
      );

      return NextResponse.json({
        success: true,
        runs: result.data,
        ...result,
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Runs GET]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_READ }
);

// POST - Create payroll run
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Enforce payroll access (HR_ADMIN/CVISION_ADMIN only)
      const payrollPolicy = canAccessPayroll(ctx);
      const enforceResult = await enforce(payrollPolicy, request, ctx);
      if (enforceResult) {
        return enforceResult; // 403
      }

      const body = await request.json();
      const data = createPayrollRunSchema.parse(body);

      const collection = await getCVisionCollection<CVisionPayrollRun>(
        tenantId,
        'payrollRuns'
      );

      // Check if run already exists for this period and status
      const existingRun = await collection.findOne(
        createTenantFilter(tenantId, {
          period: data.period,
          status: { $in: ['DRAFT', 'DRY_RUN', 'APPROVED'] },
        })
      );

      if (existingRun) {
        return NextResponse.json(
          {
            error: 'Payroll run already exists',
            message: `A payroll run for period ${data.period} already exists with status ${existingRun.status}`,
            existingRun: {
              id: existingRun.id,
              status: existingRun.status,
            },
          },
          { status: 409 }
        );
      }

      const now = new Date();
      const run: CVisionPayrollRun = {
        id: uuidv4(),
        tenantId,
        period: data.period,
        status: 'DRAFT',
        totals: {
          totalGross: 0,
          totalNet: 0,
          employeeCount: 0,
        },
        isArchived: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      const insertResult = await collection.insertOne(run);

      // If insertOne returned acknowledged: false, the row was NOT persisted.
      // This happens when raw SQL fails (column mismatch, enum cast error, etc.).
      // Return 500 so the caller knows the payroll run was not created.
      if (!insertResult.acknowledged) {
        logger.error('[CVision Payroll Runs POST] insertOne acknowledged=false', {
          id: run.id,
          tenantId,
          period: data.period,
        });
        return NextResponse.json(
          {
            error: 'Database error',
            message: 'Failed to persist payroll run. Please try again.',
          },
          { status: 500 }
        );
      }

      // Verify the run was actually persisted by reading it back
      const verifyRun = await collection.findOne(
        createTenantFilter(tenantId, { id: run.id })
      );
      if (!verifyRun) {
        logger.error('[CVision Payroll Runs POST] post-insert verify failed', {
          id: run.id,
          tenantId,
          period: data.period,
        });
        return NextResponse.json(
          {
            error: 'Database error',
            message: 'Payroll run was not persisted. Please try again.',
          },
          { status: 500 }
        );
      }

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role: role || 'unknown', tenantId, user }, request),
        'payroll_run_create',
        'PAYROLL_RUN',
        {
          resourceId: run.id,
          metadata: { period: data.period },
        }
      );

      return NextResponse.json({
        success: true,
        run: verifyRun,
      });
    } catch (error: any) {
      logger.error('[CVision Payroll Runs POST]', error?.message || String(error));
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PAYROLL_WRITE }
);
