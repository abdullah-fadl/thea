import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Positions API
 * GET /api/cvision/positions - List positions
 * POST /api/cvision/positions - Create position
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  paginatedList,
  createTenantFilter,
} from '@/lib/cvision/db';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionPositionType } from '@/lib/cvision/types';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canListEmployees, canWriteEmployee } from '@/lib/cvision/authz/policy';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createPositionSchema = z.object({
  code: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
});

const updatePositionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET - List positions
export const GET = withAuthTenant(
  async (request, { tenantId, userId }, params) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Enforce list policy (positions are readable by all authenticated users)
      // For now, allow all authenticated users to list positions
      // OWNER override is handled in enforce() if needed

      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search') || undefined;
      const isActive = searchParams.get('isActive');
      const activeFilter = isActive === 'false' ? false : isActive === 'true' ? true : undefined;

      const collection = await getCVisionCollection<CVisionPositionType>(
        tenantId,
        'positionTypes'
      );

      const additionalFilter: any = {};
      if (activeFilter !== undefined) {
        additionalFilter.isActive = activeFilter;
      }

      const listParams = {
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '100'),
        search,
      };

      const result = await paginatedList(
        collection,
        tenantId,
        listParams,
        Object.keys(additionalFilter).length > 0 ? additionalFilter : undefined
      );

      // Standardize response shape: { items: [...] }
      const items = (result.data || []).map((pos: any) => ({
        id: pos.id,
        title: pos.title,
        code: pos.code || null,
      }));

      return NextResponse.json({ items });
    } catch (error: any) {
      logger.error('[CVision Positions GET]', error?.message || String(error), error?.stack);
      // Return empty array on error to avoid breaking pages
      return NextResponse.json({ items: [] });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// POST - Create position
export const POST = withAuthTenant(
  async (request, { tenantId, userId, role, user }) => {
    try {
      // Build authz context
      const ctxResult = await requireCtx(request);
      if (ctxResult instanceof NextResponse) {
        return ctxResult; // 401 or 403
      }
      const ctx = ctxResult;

      // Enforce write policy (OWNER override handled in enforce)
      const writePolicy = canWriteEmployee(ctx, { tenantId } as any);
      const writeEnforceResult = await enforce(writePolicy, request, ctx);
      if (writeEnforceResult) {
        return writeEnforceResult; // 403
      }

      const body = await request.json();
      const data = createPositionSchema.parse(body);

      const collection = await getCVisionCollection<CVisionPositionType>(
        tenantId,
        'positionTypes'
      );

      // Check if code already exists
      const existing = await collection.findOne(
        createTenantFilter(tenantId, { code: data.code })
      );

      if (existing) {
        return NextResponse.json(
          { error: 'Position with this code already exists' },
          { status: 400 }
        );
      }

      const now = new Date();
      const position: CVisionPositionType = {
        id: uuidv4(),
        tenantId,
        code: data.code,
        title: data.title,
        description: data.description || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await collection.insertOne(position);

      // Audit log
      await logCVisionAudit(
        createCVisionAuditContext({ userId, role, tenantId, user }, request),
        'position_create',
        'position',
        {
          resourceId: position.id,
          changes: { after: { code: data.code, title: data.title } },
        }
      );

      return NextResponse.json(
        { success: true, position },
        { status: 201 }
      );
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Validation error', details: error.errors },
          { status: 400 }
        );
      }
      logger.error('[CVision Positions POST]', error?.message || String(error));
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
