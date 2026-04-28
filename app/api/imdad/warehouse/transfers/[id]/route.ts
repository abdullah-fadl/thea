/**
 * SCM BC2 Warehouse — Single Transfer Request
 *
 * GET    /api/imdad/warehouse/transfers/[id] — Get transfer with lines
 * PUT    /api/imdad/warehouse/transfers/[id] — Update transfer header (version check)
 * PATCH  /api/imdad/warehouse/transfers/[id] — Status transitions (version check)
 * DELETE /api/imdad/warehouse/transfers/[id] — Soft-delete transfer request
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single transfer request with lines
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const transfer = await prisma.imdadTransferRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!transfer) {
        return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
      }

      return NextResponse.json({ data: transfer });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update transfer header with optimistic locking
// ---------------------------------------------------------------------------

const updateTransferSchema = z.object({
  version: z.number().int({ message: 'version is required for optimistic locking' }),
  transferType: z.string().optional(),
  sourceLocationId: z.string().uuid().optional(),
  destLocationId: z.string().uuid().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
  requiredDate: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateTransferSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const { version, ...updateFields } = parsed.data;

      const existing = await prisma.imdadTransferRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict: record was modified by another user. Please refresh and retry.' },
          { status: 409 }
        );
      }

      const updated = await prisma.imdadTransferRequest.update({
        where: { id },
        data: {
          ...updateFields,
          requiredByDate: updateFields.requiredDate ? new Date(updateFields.requiredDate) : undefined,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
        include: { lines: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'TRANSFER_REQUEST',
        resourceId: id,
        boundedContext: 'BC2_WAREHOUSE',
        previousData: existing as any,
        newData: updated as any,
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
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.transfer.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions with version check
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  action: z.enum([
    'request', 'approve', 'reject', 'ship', 'receive', 'complete', 'cancel',
  ]),
  version: z.number().int(),
  reason: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  request:  { from: ['DRAFT'],      to: 'REQUESTED' },
  approve:  { from: ['REQUESTED'],  to: 'APPROVED' },
  reject:   { from: ['REQUESTED'],  to: 'REJECTED' },
  ship:     { from: ['APPROVED'],   to: 'IN_TRANSIT' },
  receive:  { from: ['IN_TRANSIT'], to: 'RECEIVED' },
  complete: { from: ['RECEIVED'],   to: 'COMPLETED' },
  cancel:   { from: ['DRAFT', 'REQUESTED', 'APPROVED'], to: 'CANCELLED' },
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

      const existing = await prisma.imdadTransferRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
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

      if (parsed.data.action === 'approve') {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      } else if (parsed.data.action === 'reject') {
        updateData.rejectedBy = userId;
        updateData.rejectedAt = new Date();
        updateData.rejectionReason = parsed.data.reason;
      } else if (parsed.data.action === 'receive') {
        updateData.receivedBy = userId;
        updateData.receivedAt = new Date();
      } else if (parsed.data.action === 'complete') {
        updateData.completedAt = new Date();
      } else if (parsed.data.action === 'cancel') {
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = parsed.data.reason;
      }

      const updated = await prisma.imdadTransferRequest.update({
        where: { id },
        data: updateData as any,
        include: { lines: true } as any,
      });

      const auditActionMap: Record<string, string> = {
        request: 'SUBMIT',
        approve: 'APPROVE',
        reject: 'REJECT',
        ship: 'TRANSFER',
        receive: 'RECEIVE',
        complete: 'UPDATE',
        cancel: 'UPDATE',
      };

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: (auditActionMap[parsed.data.action] || 'UPDATE') as any,
        resourceType: 'TRANSFER_REQUEST',
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
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.transfer.approve' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete ImdadTransferRequest
// ---------------------------------------------------------------------------
export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const body = await req.json().catch(() => ({}));
      const version = body?.version;

      const existing = await prisma.imdadTransferRequest.findFirst({
        where: { id, tenantId, isDeleted: false },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Transfer request not found' }, { status: 404 });
      }

      if (version !== undefined && existing.version !== version) {
        return NextResponse.json(
          { error: 'Version conflict — record was modified by another user', currentVersion: existing.version },
          { status: 409 }
        );
      }

      const transfer = await prisma.imdadTransferRequest.update({
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
        resourceType: 'TRANSFER_REQUEST',
        resourceId: transfer.id,
        boundedContext: 'BC2_WAREHOUSE',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: { id: transfer.id, deleted: true } });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.transfer.delete' }
);
