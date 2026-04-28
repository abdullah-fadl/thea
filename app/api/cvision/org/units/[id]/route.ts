import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Organization Unit Detail API
 *
 * PATCH /api/cvision/org/units/:id - Update unit
 * DELETE /api/cvision/org/units/:id - Archive unit
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCtx, enforce } from '@/lib/cvision/authz/enforce';
import { canWriteOrg } from '@/lib/cvision/authz/policy';
import { getCVisionCollection, createTenantFilter, findById } from '@/lib/cvision/db';
import type { CVisionUnit } from '@/lib/cvision/types';
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

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

    const name = body?.name != null ? String(body.name).trim() : undefined;
    const nameAr = body?.nameAr != null ? String(body.nameAr).trim() : undefined;
    const code = body?.code != null ? String(body.code).trim() : undefined;
    const departmentId = body?.departmentId != null ? String(body.departmentId).trim() : undefined;
    const managerId = body?.managerId !== undefined ? (body.managerId ? String(body.managerId).trim() : null) : undefined;
    const isArchived = body?.isArchived !== undefined ? Boolean(body.isArchived) : undefined;
    const sortOrder = body?.sortOrder !== undefined ? Number(body.sortOrder) : undefined;

    if (name === '') {
      return badRequest('NAME_REQUIRED');
    }

    const collection = await getCVisionCollection<CVisionUnit>(
      ctx.tenantId,
      'units'
    );

    const current = await findById(collection, ctx.tenantId, id);
    if (!current) {
      return notFound();
    }

    if (current.isArchived && isArchived !== false) {
      return badRequest('UNIT_ARCHIVED');
    }

    // Code uniqueness check
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
    if (name !== undefined) updateData.name = name;
    if (nameAr !== undefined) updateData.nameAr = nameAr || null;
    if (code !== undefined) updateData.code = code || null;
    if (departmentId !== undefined) updateData.departmentId = departmentId;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    await collection.updateOne(
      createTenantFilter(ctx.tenantId, { id }),
      { $set: updateData }
    );

    const updated = await findById(collection, ctx.tenantId, id);

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
      'unit_update',
      'unit',
      {
        resourceId: id,
        changes: {
          before: { name: current.name, code: current.code, departmentId: current.departmentId },
          after: { name: updated?.name, code: updated?.code, departmentId: updated?.departmentId },
        },
      }
    );

    return NextResponse.json({
      data: {
        id: updated?.id,
        name: updated?.name,
        nameAr: (updated as Record<string, unknown>)?.nameAr || null,
        code: updated?.code || null,
        departmentId: updated?.departmentId,
        managerId: (updated as Record<string, unknown>)?.managerId || null,
        isArchived: updated?.isArchived,
        isActive: updated?.isActive,
        sortOrder: (updated as Record<string, unknown>)?.sortOrder || 0,
        createdAt: updated?.createdAt,
        updatedAt: updated?.updatedAt,
      },
    });
  } catch (error: any) {
    logger.error('[CVision Org Units PATCH]', error?.message || String(error));
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
      return ctxResult;
    }
    const ctx = ctxResult;

    const policyResult = canWriteOrg(ctx);
    const enforceResult = await enforce(policyResult, request, ctx);
    if (enforceResult) {
      return enforceResult;
    }

    const collection = await getCVisionCollection<CVisionUnit>(
      ctx.tenantId,
      'units'
    );

    const current = await findById(collection, ctx.tenantId, id);
    if (!current) {
      return notFound();
    }

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
      'unit_archive',
      'unit',
      { resourceId: id, changes: { after: { isArchived: true } } }
    );

    return NextResponse.json({ data: { ok: true } });
  } catch (error: any) {
    logger.error('[CVision Org Units DELETE]', error?.message || String(error));
    return NextResponse.json(
      { error: 'Internal server error', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
