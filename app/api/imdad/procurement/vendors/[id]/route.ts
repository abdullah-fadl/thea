/**
 * SCM BC3 Procurement — Single Vendor
 *
 * GET    /api/imdad/procurement/vendors/:id — Get vendor with contacts & documents
 * PUT    /api/imdad/procurement/vendors/:id — Update vendor (optimistic locking)
 * DELETE /api/imdad/procurement/vendors/:id — Soft delete vendor
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single vendor with relations
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const vendor = await prisma.imdadVendor.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          contacts: { where: { isDeleted: false } },
          documents: { where: { isDeleted: false } },
        } as any,
      });

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      return NextResponse.json({ data: vendor });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update vendor with optimistic locking
// ---------------------------------------------------------------------------

const updateVendorSchema = z.object({
  version: z.number().int(),
  name: z.string().min(1).max(255).optional(),
  nameAr: z.string().optional(),
  country: z.string().min(2).max(3).optional(),
  type: z.string().optional(),
  tier: z.string().optional(),
  paymentTerms: z.string().optional(),
  status: z.string().optional(),
  taxId: z.string().optional(),
  currency: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateVendorSchema.parse(body);

      const { version, ...updates } = parsed;

      const existing = await prisma.imdadVendor.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — vendor was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const vendor = await prisma.imdadVendor.update({
        where: { id },
        data: {
          ...updates,
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
        resourceType: 'vendor',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: existing as any,
        newData: vendor as any,
        request: req,
      });

      return NextResponse.json({ data: vendor });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.vendor.edit' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete vendor
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const existing = await prisma.imdadVendor.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      await prisma.imdadVendor.update({
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
        resourceType: 'vendor',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.vendor.delete' }
);
