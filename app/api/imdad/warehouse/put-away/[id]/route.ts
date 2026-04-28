/**
 * SCM BC2 Warehouse — Single Put-Away Task
 *
 * GET    /api/imdad/warehouse/put-away/[id] — Get put-away task with lines
 * PATCH  /api/imdad/warehouse/put-away/[id] — Update status (version check)
 * DELETE /api/imdad/warehouse/put-away/[id] — Soft-delete put-away task
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single put-away task with lines
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const task = await prisma.imdadPutAwayTask.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!task) {
        return NextResponse.json({ error: 'Put-away task not found' }, { status: 404 });
      }

      return NextResponse.json({ data: task });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// PATCH — Update status with version check
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  action: z.enum(['assign', 'start', 'complete']),
  version: z.number().int({ message: 'version is required for optimistic locking' }),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  assign:   { from: ['PENDING'],      to: 'ASSIGNED' },
  start:    { from: ['ASSIGNED'],      to: 'IN_PROGRESS' },
  complete: { from: ['IN_PROGRESS'],   to: 'COMPLETED' },
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

      const existing = await prisma.imdadPutAwayTask.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Put-away task not found' }, { status: 404 });
      }

      if (existing.version !== parsed.data.version) {
        return NextResponse.json(
          { error: 'Conflict: record was modified by another user. Please refresh and retry.' },
          { status: 409 }
        );
      }

      const transition = VALID_TRANSITIONS[parsed.data.action];
      if (!transition.from.includes(existing.status)) {
        return NextResponse.json(
          { error: `Cannot ${parsed.data.action} — current status is ${existing.status}, expected one of: ${transition.from.join(', ')}` },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: transition.to,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.data.action === 'assign') {
        if (parsed.data.assignedTo) {
          updateData.assignedTo = parsed.data.assignedTo;
        }
        updateData.assignedAt = new Date();
      } else if (parsed.data.action === 'start') {
        updateData.startedAt = new Date();
      } else if (parsed.data.action === 'complete') {
        updateData.completedAt = new Date();
      }

      if (parsed.data.notes !== undefined) {
        updateData.notes = parsed.data.notes;
      }

      const updated = await prisma.imdadPutAwayTask.update({
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
        resourceType: 'PUT_AWAY_TASK',
        resourceId: id,
        boundedContext: 'BC2_WAREHOUSE',
        previousData: { status: existing.status },
        newData: { status: updated.status, action: parsed.data.action },
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
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.putaway.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadPutAwayTask
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const body = await req.json().catch(() => ({}));
      const version = body?.version;

      const existing = await prisma.imdadPutAwayTask.findFirst({
        where: { id, tenantId, isDeleted: false },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Put-away task not found' }, { status: 404 });
      }

      if (version !== undefined && existing.version !== version) {
        return NextResponse.json(
          { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
          { status: 409 }
        );
      }

      const task = await prisma.imdadPutAwayTask.update({
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
        resourceType: 'PUT_AWAY_TASK',
        resourceId: task.id,
        boundedContext: 'BC2_WAREHOUSE',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: { id: task.id, deleted: true } });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.putaway.delete' }
);
