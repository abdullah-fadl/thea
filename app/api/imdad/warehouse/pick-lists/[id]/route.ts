/**
 * SCM BC2 Warehouse — Single Pick List
 *
 * GET    /api/imdad/warehouse/pick-lists/[id] — Get pick list with lines
 * PATCH  /api/imdad/warehouse/pick-lists/[id] — Update status or assign picker (version check)
 * DELETE /api/imdad/warehouse/pick-lists/[id] — Soft-delete pick list
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single pick list with lines
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const pickList = await prisma.imdadPickList.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!pickList) {
        return NextResponse.json({ error: 'Pick list not found' }, { status: 404 });
      }

      return NextResponse.json({ data: pickList });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// PATCH — Update status or assign picker with version check
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  version: z.number().int({ message: 'version is required for optimistic locking' }),
  action: z.enum(['assign', 'start', 'complete', 'cancel']).optional(),
  assignedTo: z.string().uuid().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const VALID_STATUS_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  assign:   { from: ['PENDING'],      to: 'ASSIGNED' },
  start:    { from: ['ASSIGNED'],      to: 'IN_PROGRESS' },
  complete: { from: ['IN_PROGRESS'],   to: 'COMPLETED' },
  cancel:   { from: ['PENDING', 'ASSIGNED'], to: 'CANCELLED' },
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const existing = await prisma.imdadPickList.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Pick list not found' }, { status: 404 });
      }

      if (existing.version !== parsed.data.version) {
        return NextResponse.json(
          { error: 'Conflict: record was modified by another user. Please refresh and retry.' },
          { status: 409 }
        );
      }

      const updateData: any = {
        version: { increment: 1 },
        updatedBy: userId,
      };

      // Handle action-based status transition
      if (parsed.data.action) {
        const transition = VALID_STATUS_TRANSITIONS[parsed.data.action];
        if (!transition.from.includes(existing.status)) {
          return NextResponse.json(
            { error: `Cannot ${parsed.data.action} — current status is ${existing.status}, expected one of: ${transition.from.join(', ')}` },
            { status: 400 }
          );
        }
        updateData.status = transition.to;

        if (parsed.data.action === 'assign' && parsed.data.assignedTo) {
          updateData.assignedTo = parsed.data.assignedTo;
          updateData.assignedAt = new Date();
        } else if (parsed.data.action === 'start') {
          updateData.startedAt = new Date();
        } else if (parsed.data.action === 'complete') {
          updateData.completedAt = new Date();
        }
      }

      // Handle direct assignedTo update (without action)
      if (!parsed.data.action && parsed.data.assignedTo) {
        updateData.assignedTo = parsed.data.assignedTo;
        updateData.assignedAt = new Date();
      }

      if (parsed.data.notes !== undefined) {
        updateData.notes = parsed.data.notes;
      }

      const updated = await prisma.imdadPickList.update({
        where: { id },
        data: updateData,
        include: { lines: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'PICK_LIST',
        resourceId: id,
        boundedContext: 'BC2_WAREHOUSE',
        previousData: { status: existing.status, assignedTo: existing.assignedTo },
        newData: { status: updated.status, assignedTo: updated.assignedTo, action: parsed.data.action },
        request: req,
      });

      return NextResponse.json({ data: updated });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.pick.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadPickList
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const body = await req.json().catch(() => ({}));
      const version = body?.version;

      const existing = await prisma.imdadPickList.findFirst({
        where: { id, tenantId, isDeleted: false },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Pick list not found' }, { status: 404 });
      }

      if (version !== undefined && existing.version !== version) {
        return NextResponse.json(
          { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
          { status: 409 }
        );
      }

      const pickList = await prisma.imdadPickList.update({
        where: { id },
        data: {
          isDeleted: true,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'PICK_LIST',
        resourceId: pickList.id,
        boundedContext: 'BC2_WAREHOUSE',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: { id: pickList.id, deleted: true } });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.pick.delete' }
);
