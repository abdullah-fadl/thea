/**
 * SCM BC3 Procurement — Single Purchase Order
 *
 * GET   /api/imdad/procurement/purchase-orders/:id — Get PO with lines & vendor
 * PUT   /api/imdad/procurement/purchase-orders/:id — Update PO (DRAFT only)
 * PATCH /api/imdad/procurement/purchase-orders/:id — Status transitions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';
import { shadowEvaluate } from '@/lib/policy';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single PO with lines and vendor
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const po = await prisma.imdadPurchaseOrder.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: {
          lines: true,
          vendor: true,
        } as any,
      });

      if (!po) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }

      void shadowEvaluate({ legacyDecision: 'allow', action: 'View', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role: role ?? '', hospitalId: '' } }, resource: { id, type: 'Thea::ImdadPurchaseOrder', attrs: { tenantId, organizationId: String((po as any)?.organizationId ?? ''), status: String((po as any)?.status ?? ''), amount: Math.round(Number((po as any)?.totalAmount ?? 0)) } } });

      return NextResponse.json({ data: po });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update PO (DRAFT only, optimistic locking, recalculate totals)
// ---------------------------------------------------------------------------

const poLineSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  uomId: z.string().uuid().optional(),
  taxAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const updatePoSchema = z.object({
  version: z.number().int(),
  vendorId: z.string().uuid().optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  shippingMethod: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(poLineSchema).min(1).optional(),
});

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updatePoSchema.parse(body);

      const existing = await prisma.imdadPurchaseOrder.findFirst({
        where: { id, tenantId, isDeleted: false },
        include: { lines: true } as any,
      });

      if (!existing) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }

      if (existing.status !== 'DRAFT') {
        return NextResponse.json(
          { error: 'Only DRAFT purchase orders can be updated' },
          { status: 400 }
        );
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — purchase order was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const { version, lines, ...updates } = parsed;

      const po = await prisma.$transaction(async (tx) => {
        let totals: any = {};

        if (lines) {
          // Delete existing lines and recreate
          await tx.imdadPurchaseOrderLine.deleteMany({
            where: { poId: id },
          });

          const linesWithTotals = lines.map((line) => {
            const totalCost = line.quantity * line.unitCost;
            const lineTaxAmount = line.taxAmount || 0;
            return { ...line, totalCost, lineTaxAmount };
          });

          await tx.imdadPurchaseOrderLine.createMany({
            data: linesWithTotals.map((line, idx) => ({
              tenantId,
              organizationId: existing.organizationId,
              poId: id,
              lineNumber: idx + 1,
              itemId: line.itemId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              totalCost: line.totalCost,
              taxAmount: line.lineTaxAmount,
              uomId: line.uomId,
              notes: line.notes,
            } as any)),
          });

          totals = {
            subtotal: linesWithTotals.reduce((s, l) => s + l.totalCost, 0),
            taxAmount: linesWithTotals.reduce((s, l) => s + l.lineTaxAmount, 0),
            totalAmount: linesWithTotals.reduce((s, l) => s + l.totalCost + l.lineTaxAmount, 0),
          };
        }

        return tx.imdadPurchaseOrder.update({
          where: { id },
          data: {
            ...updates,
            ...totals,
            expectedDeliveryDate: updates.expectedDeliveryDate
              ? new Date(updates.expectedDeliveryDate)
              : undefined,
            version: { increment: 1 },
            updatedBy: userId,
          },
          include: { lines: true } as any,
        });
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'purchase_order',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: existing as any,
        newData: po as any,
        request: req,
      });

      return NextResponse.json({ data: po });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.po.edit' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions (submit / approve / send / cancel)
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  action: z.enum(['submit', 'approve', 'send', 'cancel']),
  version: z.number().int(),
  cancellationReason: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  submit:  { from: ['DRAFT'], to: 'PENDING_APPROVAL' },
  approve: { from: ['PENDING_APPROVAL'], to: 'APPROVED' },
  send:    { from: ['APPROVED'], to: 'SENT' },
  cancel:  { from: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'], to: 'CANCELLED' },
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = patchSchema.parse(body);

      const existing = await prisma.imdadPurchaseOrder.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict', message: 'Record was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const transition = VALID_TRANSITIONS[parsed.action];
      if (!transition.from.includes(existing.status)) {
        return NextResponse.json(
          { error: `Cannot ${parsed.action} — current status is ${existing.status}, expected one of: ${transition.from.join(', ')}` },
          { status: 400 }
        );
      }

      if (parsed.action === 'cancel' && !parsed.cancellationReason) {
        return NextResponse.json(
          { error: 'cancellationReason is required when cancelling a purchase order' },
          { status: 400 }
        );
      }

      const updateData: any = {
        status: transition.to,
        version: { increment: 1 },
        updatedBy: userId,
      };

      if (parsed.action === 'submit') {
        updateData.orderDate = new Date();
      } else if (parsed.action === 'send') {
        updateData.sentAt = new Date();
      } else if (parsed.action === 'cancel') {
        updateData.closedAt = new Date();
        updateData.notes = parsed.cancellationReason
          ? `[CANCELLED] ${parsed.cancellationReason}`
          : existing.notes;
      }

      const po = await prisma.imdadPurchaseOrder.update({
        where: { id, version: existing.version },
        data: updateData,
        include: { lines: true } as any,
      });

      void shadowEvaluate({ legacyDecision: 'allow', action: parsed.action === 'approve' ? 'Approve' : 'Update', principal: { id: userId, type: 'Thea::User', attrs: { tenantId, role: role ?? '', hospitalId: '' } }, resource: { id, type: 'Thea::ImdadPurchaseOrder', attrs: { tenantId, organizationId: String((existing as any)?.organizationId ?? ''), status: String((po as any)?.status ?? ''), amount: Math.round(Number((existing as any)?.totalAmount ?? 0)) } } });

      const auditActionMap: Record<string, 'SUBMIT' | 'APPROVE' | 'UPDATE'> = {
        submit: 'SUBMIT',
        approve: 'APPROVE',
        send: 'UPDATE',
        cancel: 'UPDATE',
      };

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: auditActionMap[parsed.action],
        resourceType: 'purchase_order',
        resourceId: id,
        boundedContext: 'BC3_PROCUREMENT',
        previousData: { status: existing.status },
        newData: { status: po.status, action: parsed.action },
        request: req,
      });

      return NextResponse.json({ data: po });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.po.approve' }
);
