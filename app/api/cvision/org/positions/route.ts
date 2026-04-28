import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Organization Positions API
 * 
 * GET /api/cvision/org/positions - List all positions
 * 
 * Returns: [{ id, title, departmentId? }]
 * If positions table not ready yet, returns empty array or seed list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { enforce } from '@/lib/cvision/authz/enforce';
import { canReadOrg } from '@/lib/cvision/authz/policy';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { CVisionDepartmentPosition, CVisionPositionType } from '@/lib/cvision/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const ctxResult = await requireCtx(request);
    if (ctxResult instanceof NextResponse) {
      // On auth error, return empty array to avoid breaking pages
      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Org Positions GET] Auth error:', ctxResult.status);
      }
      return NextResponse.json({ items: [] });
    }
    const ctx = ctxResult;

    // Enforce read permission
    const policyResult = canReadOrg(ctx);
    const enforceResult = await enforce(policyResult, request, ctx);
    if (enforceResult) {
      // On permission denied, return empty array to avoid breaking pages
      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Org Positions GET] Permission denied:', {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          roles: ctx.roles,
          reason: policyResult.reason,
        });
      }
      return NextResponse.json({ items: [] });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const includeArchived = searchParams.get('includeArchived') === '1';

    // Try to get positions from positionTypes collection
    const positionCollection = await getCVisionCollection(
      ctx.tenantId,
      'positionTypes'
    );

    // Build filter
    const filter: Record<string, any> = createTenantFilter(ctx.tenantId, {});
    
    if (!includeArchived) {
      filter.isArchived = { $ne: true };
    }
    
    if (departmentId) {
      // If departmentId provided, get positions assigned to that department via departmentPositions junction
      const assignmentCollection = await getCVisionCollection<CVisionDepartmentPosition>(
        ctx.tenantId,
        'departmentPositions'
      );

      const assignments = await assignmentCollection
        .find(createTenantFilter(ctx.tenantId, {
          departmentId,
          isActive: true
        }))
        .limit(5000)
        .toArray();

      const positionIds = assignments.map(a => a.positionId);
      
      if (positionIds.length === 0) {
        return NextResponse.json({ items: [] });
      }
      
      filter.id = { $in: positionIds };
    }

    const rows = await positionCollection
      .find(filter)
      .sort({ title: 1 })
      .limit(5000)
      .toArray();

    // Map to ensure consistent shape: [{ id, title, departmentId? }]
    const items = rows.map((row: any) => ({
      id: row.id,
      title: row.title || row.name,
      code: row.code || null,
      departmentId: departmentId || row.departmentId || null, // Include if filtered by department
    }));

    // Dev-only debug logging
    const isDebug = process.env.NODE_ENV === 'development' || 
                    new URL(request.url).searchParams.get('debug') === '1';
    
    if (isDebug) {
      logger.info('[CVision Org Positions GET] Debug:', {
        tenantId: ctx.tenantId,
        count: items.length,
        departmentId,
        sample: items.slice(0, 2).map(p => p.title),
        userId: ctx.userId,
        roles: ctx.roles,
      });
    }

    // Build response with meta (dev-only or ?debug=1)
    const responseBody: any = { items };
    if (isDebug) {
      responseBody.meta = {
        tenantIdResolved: ctx.tenantId,
        count: items.length,
        departmentId,
        userId: ctx.userId,
        roles: ctx.roles,
      };
    }

    const response = NextResponse.json(responseBody);
    response.headers.set('x-cvision-tenant', ctx.tenantId);
    response.headers.set('x-cvision-count', String(items.length));
    return response;
  } catch (error: any) {
    // Always return 200 with empty array on error to avoid breaking pages
    logger.error('[CVision Org Positions GET]', error?.message || String(error));
    return NextResponse.json({ items: [] });
  }
}
