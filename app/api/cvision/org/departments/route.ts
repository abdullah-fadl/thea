import { logger } from '@/lib/monitoring/logger';
import { compareLegacyCvisionToCore } from '@/lib/core/departments/shadowRead';
/**
 * CVision Organization Departments API
 * 
 * GET /api/cvision/org/departments - List departments
 * POST /api/cvision/org/departments - Create department
 * 
 * Response shape: { data: T[] } (consistent across app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { enforce } from '@/lib/cvision/authz/enforce';
import { canReadOrg, canWriteOrg } from '@/lib/cvision/authz/policy';
import { getCVisionCollection, createTenantFilter, findById } from '@/lib/cvision/db';
import type { CVisionDepartment } from '@/lib/cvision/types';
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
      // Return the actual auth error (401/403) so callers can detect and retry
      return ctxResult;
    }
    const ctx = ctxResult;

    // Enforce read permission
    const policyResult = canReadOrg(ctx);
    const enforceResult = await enforce(policyResult, request, ctx);
    if (enforceResult) {
      // Return the actual permission error (403) so callers can detect and retry
      return enforceResult;
    }

    const collection = await getCVisionCollection<CVisionDepartment>(
      ctx.tenantId,
      'departments'
    );

    // Check if includeArchived param is set
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === '1';

    // Build filter: exclude archived unless explicitly requested.
    // Use $ne: true instead of isArchived: false so rows where
    // isArchived is NULL (migration gap) are still included.
    const filter = createTenantFilter(ctx.tenantId, includeArchived ? {} : { isArchived: { $ne: true } });

    const rows = await collection
      .find(
        filter,
        { projection: { id: 1, name: 1, nameAr: 1, code: 1, parentId: 1, managerId: 1, createdAt: 1, updatedAt: 1, isArchived: 1, isActive: 1 } }
      )
      .sort({ name: 1 })
      .limit(500)
      .toArray();

    // Shadow-read: compare each legacy row against core_departments (fire-and-forget)
    for (const row of rows) {
      if (row.id && row.code) {
        void compareLegacyCvisionToCore({
          id:       String(row.id),
          tenantId: ctx.tenantId,
          code:     String(row.code),
          name:     String(row.name || ''),
          nameAr:   row.nameAr ? String(row.nameAr) : null,
        }).catch(() => {});
      }
    }

    // Bootstrap: If tenant has 0 departments, create a default "General" department
    if (rows.length === 0 && !includeArchived) {
      const now = new Date();
      const defaultDept: CVisionDepartment = {
        id: uuidv4(),
        tenantId: ctx.tenantId,
        name: 'General',
        code: 'GEN',
        isArchived: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId || 'system',
        updatedBy: ctx.userId || 'system',
      };

      await collection.insertOne(defaultDept);

      // Return the newly created department
      const items = [{
        id: defaultDept.id,
        name: defaultDept.name,
        nameAr: defaultDept.nameAr || null,
        code: defaultDept.code || null,
        parentId: null,
        isArchived: defaultDept.isArchived || false,
        isActive: defaultDept.isActive !== false,
        createdAt: defaultDept.createdAt,
        updatedAt: defaultDept.updatedAt,
      }];

      if (process.env.NODE_ENV === 'development') {
        logger.info('[CVision Org Departments GET] Created default "General" department for tenant:', ctx.tenantId);
      }

      const response = NextResponse.json({ items });
      response.headers.set('x-cvision-tenant', ctx.tenantId);
      response.headers.set('x-cvision-count', '1');
      return response;
    }

    // Map to ensure consistent shape: { items: [...] }
    // Return format: [{ id, name, nameAr?, code?, parentId? }] as per PR-D0 requirements
    const items = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      nameAr: row.nameAr || null,
      code: row.code || null,
      parentId: row.parentId || null,
      managerId: row.managerId || null,
      isArchived: row.isArchived || false,
      isActive: row.isActive !== false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    // Dev-only debug logging
    const isDebug = process.env.NODE_ENV === 'development' || 
                    new URL(request.url).searchParams.get('debug') === '1';
    
    if (isDebug) {
      logger.info('[CVision Org Departments GET] Debug:', {
        tenantId: ctx.tenantId,
        count: items.length,
        sample: items.slice(0, 2).map(d => d.name),
        userId: ctx.userId,
        roles: ctx.roles,
        collectionName: 'departments',
        dbName: `thea_tenant__${ctx.tenantId}`,
      });
    }

    // Build response with meta (dev-only or ?debug=1)
    const responseBody: any = { items };
    if (isDebug) {
      responseBody.meta = {
        tenantIdResolved: ctx.tenantId,
        collectionNameOrModel: 'departments',
        count: items.length,
        userId: ctx.userId,
        roles: ctx.roles,
      };
    }

    const response = NextResponse.json(responseBody);
    // Add headers for debugging
    response.headers.set('x-cvision-tenant', ctx.tenantId);
    response.headers.set('x-cvision-count', String(items.length));
    response.headers.set('x-cvision-collection', 'departments');
    return response;
  } catch (error: any) {
    logger.error('[CVision Org Departments GET]', error?.message || String(error));
    return NextResponse.json(
      { items: [], error: 'Internal server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctxResult = await requireCtx(request);
    if (ctxResult instanceof NextResponse) {
      return ctxResult; // 401
    }
    const ctx = ctxResult;

    // Enforce write permission
    const policyResult = canWriteOrg(ctx);
    const enforceResult = await enforce(policyResult, request, ctx);
    if (enforceResult) {
      return enforceResult; // 403
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? '').trim();
    const nameAr = body?.nameAr ? String(body.nameAr).trim() : null;
    const code = body?.code ? String(body.code).trim() : null;
    const managerId = body?.managerId ? String(body.managerId).trim() : null;

    if (!name) {
      return badRequest('NAME_REQUIRED', 'Department name is required');
    }

    const collection = await getCVisionCollection<CVisionDepartment>(
      ctx.tenantId,
      'departments'
    );

    // Optional: code uniqueness per tenant (if you use code)
    if (code) {
      const exists = await collection.findOne(
        createTenantFilter(ctx.tenantId, { code })
      );
      if (exists) {
        return NextResponse.json(
          {
            code: 'CODE_ALREADY_EXISTS',
            message: `Department code "${code}" already exists`,
            existing: { id: exists.id, name: exists.name, code: exists.code || code },
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const created: CVisionDepartment = {
      id: uuidv4(),
      tenantId: ctx.tenantId,
      name,
      nameAr: nameAr || undefined,
      code: code || '',
      managerId,
      isArchived: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId || 'unknown',
      updatedBy: ctx.userId || 'unknown',
    };

    await collection.insertOne(created);

    // Audit log
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
      'department_create',
      'department',
      { resourceId: created.id, changes: { after: { name, code } } }
    );

    return NextResponse.json({
      items: [{
        id: created.id,
        name: created.name,
        code: created.code || null,
        managerId: created.managerId || null,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      }],
    }, { status: 201 });
  } catch (error: any) {
    logger.error('[CVision Org Departments POST]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
