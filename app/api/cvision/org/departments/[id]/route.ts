import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Organization Department Detail API
 * 
 * GET /api/cvision/org/departments/:id - Get department
 * PATCH /api/cvision/org/departments/:id - Update department
 * DELETE /api/cvision/org/departments/:id - Archive department
 * 
 * Response shape: { data: T } (consistent across app)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCtx } from '@/lib/cvision/authz/enforce';
import { enforce } from '@/lib/cvision/authz/enforce';
import { canWriteOrg } from '@/lib/cvision/authz/policy';
import { getCVisionCollection, createTenantFilter, findById } from '@/lib/cvision/db';
import type { CVisionDepartment } from '@/lib/cvision/types';
import {
  logCVisionAudit,
  createCVisionAuditContext,
} from '@/lib/cvision/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function notFound() {
  return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });
}

function badRequest(code: string) {
  return NextResponse.json({ code }, { status: 400 });
}

// GET - Get department (delegate to main route for now)
export { GET } from '../../../departments/[id]/route';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

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

    const name = body?.name != null ? String(body.name).trim() : undefined;
    const nameAr = body?.nameAr != null ? String(body.nameAr).trim() : undefined;
    const code = body?.code != null ? String(body.code).trim() : undefined;
    const isArchived = body?.isArchived !== undefined ? Boolean(body.isArchived) : undefined;

    if (name === '') {
      return badRequest('NAME_REQUIRED');
    }

    const collection = await getCVisionCollection<CVisionDepartment>(
      ctx.tenantId,
      'departments'
    );

    const current = await findById(collection, ctx.tenantId, id);
    if (!current) {
      return notFound();
    }
    // Allow updating archived departments only if unarchiving
    if (current.isArchived && isArchived !== false) {
      return badRequest('DEPARTMENT_ARCHIVED');
    }

    // code uniqueness check if provided
    if (code && code.length > 0) {
      const exists = await collection.findOne(
        createTenantFilter(ctx.tenantId, { code, id: { $ne: id } })
      );
      if (exists) {
        return badRequest('CODE_ALREADY_EXISTS');
      }
    }

    const updateData: any = {
      updatedBy: ctx.userId || 'unknown',
      updatedAt: new Date(),
    };
    if (name !== undefined) {
      updateData.name = name;
    }
    if (nameAr !== undefined) {
      updateData.nameAr = nameAr || null;
    }
    if (code !== undefined) {
      updateData.code = code || null;
    }
    if (isArchived !== undefined) {
      updateData.isArchived = isArchived;
    }

    await collection.updateOne(
      createTenantFilter(ctx.tenantId, { id }),
      { $set: updateData }
    );

    const updated = await findById(collection, ctx.tenantId, id);

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
      'department_update',
      'department',
      {
        resourceId: id,
        changes: {
          before: { name: current.name, code: current.code },
          after: { name: updated?.name, code: updated?.code },
        },
      }
    );

    return NextResponse.json({
      data: {
        id: updated?.id,
        name: updated?.name,
        code: updated?.code || null,
        createdAt: updated?.createdAt,
        updatedAt: updated?.updatedAt,
      },
    });
  } catch (error: any) {
    logger.error('[CVision Org Departments PATCH]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

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

    const collection = await getCVisionCollection<CVisionDepartment>(
      ctx.tenantId,
      'departments'
    );

    const current = await findById(collection, ctx.tenantId, id);
    if (!current) {
      return notFound();
    }

    // Soft archive
    await collection.updateOne(
      createTenantFilter(ctx.tenantId, { id }),
      {
        $set: {
          isArchived: true,
          updatedBy: ctx.userId || 'unknown',
          updatedAt: new Date(),
        },
      }
    );

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
      'department_archive',
      'department',
      { resourceId: id, changes: { after: { isArchived: true } } }
    );

    return NextResponse.json({ data: { ok: true } });
  } catch (error: any) {
    logger.error('[CVision Org Departments DELETE]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
