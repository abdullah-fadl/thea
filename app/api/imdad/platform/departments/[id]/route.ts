/**
 * SCM BC9 Platform — Department Detail
 *
 * GET    /api/imdad/platform/departments/[id] — Single department with users
 * PUT    /api/imdad/platform/departments/[id] — Update department (optimistic locking)
 * DELETE /api/imdad/platform/departments/[id] — Soft delete department
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single department with users
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const department = await prisma.imdadDepartment.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        departmentUsers: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
        },
      } as any,
    });

    if (!department) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ department });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update department (optimistic locking)
// ---------------------------------------------------------------------------
const updateDepartmentSchema = z.object({
  version: z.number().int(),
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  nameAr: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  costCenterId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateDepartmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.imdadDepartment.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (existing.version !== data.version) {
      return NextResponse.json(
        { error: 'Optimistic locking conflict — department was modified by another user' },
        { status: 409 }
      );
    }

    const updateData: any = { ...data };
    delete updateData.version;
    updateData.updatedBy = userId;

    try {
      const updated = await prisma.imdadDepartment.update({
        where: { id, version: existing.version },
        data: { ...updateData, version: { increment: 1 } },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId,
        actorUserId: userId,
        action: 'UPDATE',
        resourceType: 'department',
        resourceId: id,
        boundedContext: 'BC9_PLATFORM',
        previousData: existing as any,
        newData: updated as any,
        request: req,
      });

      return NextResponse.json({ department: updated });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return NextResponse.json(
          { error: 'Optimistic locking conflict' },
          { status: 409 }
        );
      }
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Department code already exists for this organization' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.department.edit' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete department
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    const existing = await prisma.imdadDepartment.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const updated = await prisma.imdadDepartment.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: 'DELETE',
      resourceType: 'department',
      resourceId: id,
      boundedContext: 'BC9_PLATFORM',
      previousData: existing as any,
      request: req,
    });

    return NextResponse.json({ success: true, id });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.admin.department.delete' }
);
