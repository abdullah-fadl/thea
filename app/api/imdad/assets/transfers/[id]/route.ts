/**
 * SCM BC7 Asset Management — Single Asset Transfer
 *
 * GET    /api/imdad/assets/transfers/:id — Get transfer detail
 * PUT    /api/imdad/assets/transfers/:id — Update transfer (optimistic locking)
 * PATCH  /api/imdad/assets/transfers/:id — Status transition (PENDING->APPROVED->COMPLETED or PENDING->REJECTED)
 * DELETE /api/imdad/assets/transfers/:id — Soft delete (only PENDING transfers)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single transfer detail
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const transfer = await prisma.imdadAssetTransfer.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!transfer) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }

      return NextResponse.json({ data: transfer });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.transfers.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update transfer with optimistic locking
// ---------------------------------------------------------------------------

const updateTransferSchema = z.object({
  version: z.number().int(),
  fromDepartmentId: z.string().uuid().optional(),
  fromDepartmentName: z.string().optional(),
  fromLocationId: z.string().uuid().optional(),
  toDepartmentId: z.string().uuid().optional(),
  toDepartmentName: z.string().optional(),
  toLocationId: z.string().uuid().optional(),
  transferDate: z.string().optional(),
  reason: z.string().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateTransferSchema.parse(body);

      const { version, transferDate, ...updates } = parsed;

      const existing = await prisma.imdadAssetTransfer.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — transfer was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const transfer = await prisma.imdadAssetTransfer.update({
        where: { id },
        data: {
          ...updates,
          transferDate: transferDate ? new Date(transferDate) : undefined,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'ASSET_TRANSFER',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: existing as any,
        newData: transfer as any,
        request: req,
      });

      return NextResponse.json({ data: transfer });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.transfers.update' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transition
// Allowed flows: PENDING -> APPROVED -> COMPLETED
//                PENDING -> REJECTED
// On completion: update asset locationId, departmentId, custodianUserId
// ---------------------------------------------------------------------------

const statusTransitionSchema = z.object({
  version: z.number().int(),
  status: z.enum(['APPROVED', 'COMPLETED', 'REJECTED']),
  notes: z.string().optional(),
  newCustodianUserId: z.string().uuid().optional(),
  newCustodianName: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['COMPLETED'],
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = statusTransitionSchema.parse(body);

      const existing = await prisma.imdadAssetTransfer.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — transfer was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const allowed = VALID_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(parsed.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${existing.status} to ${parsed.status}` },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: parsed.status,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.notes) updateData.notes = parsed.notes;

      if (parsed.status === 'APPROVED') {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }

      if (parsed.status === 'REJECTED') {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }

      const transfer = await prisma.$transaction(async (tx) => {
        const updated = await tx.imdadAssetTransfer.update({
          where: { id },
          data: updateData,
        });

        // On completion: update asset location, department, and custodian
        if (parsed.status === 'COMPLETED' && existing.assetId) {
          const assetUpdate: any = {
            departmentId: existing.toDepartmentId,
            updatedBy: userId,
            version: { increment: 1 },
          };

          if (existing.toLocationId) {
            assetUpdate.locationId = existing.toLocationId;
          }

          if (parsed.newCustodianUserId) {
            assetUpdate.custodianUserId = parsed.newCustodianUserId;
            assetUpdate.custodianName = parsed.newCustodianName;
          }

          await tx.imdadAsset.update({
            where: { id: existing.assetId },
            data: assetUpdate,
          });
        }

        return updated;
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'ASSET_TRANSFER',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: { status: existing.status },
        newData: { status: parsed.status },
        request: req,
      });

      return NextResponse.json({ data: transfer });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.transfers.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete transfer (only allowed for PENDING transfers)
// ---------------------------------------------------------------------------

const deleteTransferSchema = z.object({
  version: z.number().int(),
});

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = deleteTransferSchema.parse(body);

      const existing = await prisma.imdadAssetTransfer.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }

      if (existing.status !== 'PENDING') {
        return NextResponse.json(
          { error: 'Only pending transfers can be deleted' },
          { status: 400 }
        );
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — transfer was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      await prisma.imdadAssetTransfer.update({
        where: { id },
        data: {
          isDeleted: true,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'ASSET_TRANSFER',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.transfers.update' }
);
