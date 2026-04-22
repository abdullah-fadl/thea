/**
 * SCM BC5 Clinical — Single Formulary Item
 *
 * GET    /api/imdad/clinical/formulary/:id — Get formulary item
 * PUT    /api/imdad/clinical/formulary/:id — Update formulary item (optimistic locking)
 * DELETE /api/imdad/clinical/formulary/:id — Soft delete formulary item
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single formulary item
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const formularyItem = await prisma.imdadFormularyItem.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!formularyItem) {
        return NextResponse.json({ error: 'Formulary item not found' }, { status: 404 });
      }

      return NextResponse.json({ data: formularyItem });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.formulary.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update formulary item with optimistic locking
// ---------------------------------------------------------------------------

const updateFormularySchema = z.object({
  version: z.number().int(),
  itemCode: z.string().min(1).max(50).optional(),
  itemName: z.string().min(1).optional(),
  genericName: z.string().optional(),
  genericNameAr: z.string().optional(),
  therapeuticClass: z.string().optional(),
  formularyCategory: z.string().optional(),
  formularyStatus: z.string().optional(),
  isControlled: z.boolean().optional(),
  controlSchedule: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  approvalLevel: z.string().optional(),
  maxDailyDose: z.string().optional(),
  maxOrderQty: z.string().optional(),
  indications: z.string().optional(),
  indicationsAr: z.string().optional(),
  contraindications: z.string().optional(),
  sideEffects: z.string().optional(),
  interactions: z.string().optional(),
  storageInstructions: z.string().optional(),
  unitPrice: z.string().optional(),
  insuranceCovered: z.boolean().optional(),
  committeeApproval: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateFormularySchema.parse(body);

      const { version, unitPrice, maxOrderQty, ...updates } = parsed;

      const existing = await prisma.imdadFormularyItem.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Formulary item not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — formulary item was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const formularyItem = await prisma.imdadFormularyItem.update({
        where: { id },
        data: {
          ...updates,
          unitPrice: unitPrice || undefined,
          maxOrderQty: maxOrderQty || undefined,
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
        resourceType: 'FORMULARY_ITEM',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: existing as any,
        newData: formularyItem as any,
        request: req,
      });

      return NextResponse.json({ data: formularyItem });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.formulary.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete formulary item
// ---------------------------------------------------------------------------

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const existing = await prisma.imdadFormularyItem.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Formulary item not found' }, { status: 404 });
      }

      const formularyItem = await prisma.imdadFormularyItem.update({
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
        resourceType: 'FORMULARY_ITEM',
        resourceId: id,
        boundedContext: 'BC5_CLINICAL',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: formularyItem });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.formulary.update' }
);
