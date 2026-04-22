/**
 * SCM BC7 Asset Management — Single Asset Disposal
 *
 * GET    /api/imdad/assets/disposals/:id — Get disposal detail
 * PUT    /api/imdad/assets/disposals/:id — Update disposal (optimistic locking)
 * DELETE /api/imdad/assets/disposals/:id — Soft delete disposal
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single disposal detail
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const disposal = await prisma.imdadAssetDisposal.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!disposal) {
        return NextResponse.json({ error: 'Disposal not found' }, { status: 404 });
      }

      return NextResponse.json({ data: disposal });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.disposals.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update disposal with optimistic locking
// ---------------------------------------------------------------------------

const updateDisposalSchema = z.object({
  version: z.number().int(),
  disposalMethod: z.string().optional(),
  disposalDate: z.string().optional(),
  disposalReason: z.string().optional(),
  disposalReasonAr: z.string().optional(),
  processedBy: z.string().uuid().optional(),
  approvedBy: z.string().uuid().optional(),
  approvedAt: z.string().optional(),
  bookValueAtDisposal: z.string().optional(),
  proceedsAmount: z.string().optional(),
  gainLoss: z.string().optional(),
  recipientName: z.string().optional(),
  recipientContact: z.string().optional(),
  disposalCertificate: z.string().optional(),
  hazmatDisposal: z.boolean().optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateDisposalSchema.parse(body);

      const {
        version, disposalDate, approvedAt,
        bookValueAtDisposal, proceedsAmount, gainLoss,
        ...updates
      } = parsed;

      const existing = await prisma.imdadAssetDisposal.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Disposal not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — disposal was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const disposal = await prisma.imdadAssetDisposal.update({
        where: { id },
        data: {
          ...updates,
          disposalDate: disposalDate ? new Date(disposalDate) : undefined,
          approvedAt: approvedAt ? new Date(approvedAt) : undefined,
          bookValueAtDisposal: bookValueAtDisposal || undefined,
          proceedsAmount: proceedsAmount || undefined,
          gainLoss: gainLoss || undefined,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'ASSET_DISPOSAL',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: existing as any,
        newData: disposal as any,
        request: req,
      });

      return NextResponse.json({ data: disposal });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.disposals.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft-delete disposal record
// ---------------------------------------------------------------------------

const deleteDisposalSchema = z.object({
  version: z.number().int(),
});

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = deleteDisposalSchema.parse(body);

      const existing = await prisma.imdadAssetDisposal.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Disposal not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — disposal was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      await prisma.imdadAssetDisposal.update({
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
        resourceType: 'ASSET_DISPOSAL',
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
  { platformKey: 'imdad', permissionKey: 'imdad.assets.disposals.update' }
);
