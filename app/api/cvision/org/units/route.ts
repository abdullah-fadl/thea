import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Organization Units API
 *
 * GET /api/cvision/org/units - List units (filterable by departmentId)
 * POST /api/cvision/org/units - Create unit
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canReadOrg, canWriteOrg } from '@/lib/cvision/authz/policy';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type { CVisionUnit } from '@/lib/cvision/types';
import { v4 as uuidv4 } from 'uuid';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function badRequest(code: string, message?: string) {
  return NextResponse.json({ code, message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const ctxResult = await requireCtx(request);
    if (ctxResult instanceof NextResponse) {
      return NextResponse.json({ items: [] });
    }
    const ctx = ctxResult;

    const policyResult = canReadOrg(ctx);
    const enforceResult = await enforce(policyResult, request, ctx);
    if (enforceResult) {
      return NextResponse.json({ items: [] });
    }

    const collection = await getCVisionCollection<CVisionUnit>(
      ctx.tenantId,
      'units'
    );

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const includeArchived = searchParams.get('includeArchived') === '1';

    const filterCriteria: any = includeArchived ? {} : { isArchived: false };
    if (departmentId) {
      filterCriteria.departmentId = departmentId;
    }

    const filter = createTenantFilter(ctx.tenantId, filterCriteria);

    const rows = await collection
      .find(filter)
      .sort({ name: 1 })
      .limit(1000)
      .toArray();

    const items = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      nameAr: row.nameAr || null,
      code: row.code || null,
      departmentId: row.departmentId,
      managerId: row.managerId || null,
      isArchived: row.isArchived || false,
      isActive: row.isActive !== false,
      sortOrder: row.sortOrder || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    const response = NextResponse.json({ items });
    response.headers.set('x-cvision-tenant', ctx.tenantId);
    response.headers.set('x-cvision-count', String(items.length));
    return response;
  } catch (error: any) {
    logger.error('[CVision Org Units GET]', error?.message || String(error));
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctxResult = await requireCtx(request);
    if (ctxResult instanceof NextResponse) {
      return ctxResult;
    }
    const ctx = ctxResult;

    const policyResult = canWriteOrg(ctx);
    const enforceResult = await enforce(policyResult, request, ctx);
    if (enforceResult) {
      return enforceResult;
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const nameAr = body?.nameAr ? String(body.nameAr).trim() : null;
    const code = body?.code ? String(body.code).trim() : null;
    const departmentId = String(body?.departmentId ?? '').trim();
    const managerId = body?.managerId ? String(body.managerId).trim() : null;

    if (!name) {
      return badRequest('NAME_REQUIRED', 'Unit name is required');
    }
    if (!departmentId) {
      return badRequest('DEPARTMENT_REQUIRED', 'Department ID is required');
    }

    const collection = await getCVisionCollection<CVisionUnit>(
      ctx.tenantId,
      'units'
    );

    // Code uniqueness per tenant
    if (code) {
      const exists = await collection.findOne(
        createTenantFilter(ctx.tenantId, { code })
      );
      if (exists) {
        return badRequest('CODE_ALREADY_EXISTS', `Unit code "${code}" already exists`);
      }
    }

    const now = new Date();
    const created: CVisionUnit = {
      id: uuidv4(),
      tenantId: ctx.tenantId,
      name,
      nameAr: nameAr || undefined,
      code: code || '',
      departmentId,
      managerId,
      isArchived: false,
      isActive: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId || 'unknown',
      updatedBy: ctx.userId || 'unknown',
    };

    await collection.insertOne(created);

    await logCVisionAudit(
      createCVisionAuditContext(
        {
          userId: ctx.userId,
          role: ctx.roles[0] || 'unknown',
          tenantId: ctx.tenantId,
          user: ctx.user,
        },
        request
      ),
      'unit_create',
      'unit',
      { resourceId: created.id, changes: { after: { name, code, departmentId } } }
    );

    return NextResponse.json({
      items: [{
        id: created.id,
        name: created.name,
        nameAr: created.nameAr || null,
        code: created.code || null,
        departmentId: created.departmentId,
        managerId: created.managerId || null,
        isActive: true,
        isArchived: false,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      }],
    }, { status: 201 });
  } catch (error: any) {
    logger.error('[CVision Org Units POST]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
