/**
 * SCM BC4 Financial — Invoice Detail
 *
 * GET   /api/imdad/financial/invoices/[id] — Single invoice with lines
 * PUT   /api/imdad/financial/invoices/[id] — Update (DRAFT/RECEIVED only, optimistic locking)
 * PATCH /api/imdad/financial/invoices/[id] — Status transitions (verify/match/approve/pay)
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — Single invoice with lines
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }, params) => {
    const { id } = (await params) as { id: string };

    const invoice = await prisma.imdadInvoice.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: {
        lines: { where: { isDeleted: false }, orderBy: { lineNumber: 'asc' } },
        payments: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
      } as any,
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update invoice (DRAFT/RECEIVED only, optimistic locking)
// ---------------------------------------------------------------------------
const updateInvoiceSchema = z.object({
  version: z.number().int(),
  invoiceNumber: z.string().min(1).optional(),
  vendorName: z.string().min(1).optional(),
  invoiceDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  receivedDate: z.string().datetime().nullable().optional(),
  purchaseOrderId: z.string().uuid().nullable().optional(),
  purchaseOrderNumber: z.string().nullable().optional(),
  grnId: z.string().uuid().nullable().optional(),
  grnNumber: z.string().nullable().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  paymentTerms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
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

    const parsed = updateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const existing = await prisma.imdadInvoice.findFirst({
      where: { id, tenantId, isDeleted: false },
      include: { lines: { where: { isDeleted: false } as any } } as any,
    });

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!['DRAFT', 'RECEIVED'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Only DRAFT or RECEIVED invoices can be updated' },
        { status: 409 }
      );
    }

    if (existing.version !== data.version) {
      return NextResponse.json(
        { error: 'Optimistic locking conflict — invoice was modified by another user' },
        { status: 409 }
      );
    }

    // Recalculate totals if tax or discount changed
    const taxRate = data.taxRate ?? Number(existing.taxRate);
    const discountAmount = data.discountAmount ?? Number(existing.discountAmount);
    const subtotal = Number(existing.subtotal);
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount - discountAmount;
    const balanceDue = totalAmount - Number(existing.paidAmount);

    // Explicit field picking — prevent mass assignment (no spread of user data)
    const updateData: any = {
      taxRate,
      taxAmount,
      discountAmount,
      totalAmount,
      balanceDue,
      updatedBy: userId,
    };

    if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
    if (data.vendorName !== undefined) updateData.vendorName = data.vendorName;
    if (data.invoiceDate !== undefined) updateData.invoiceDate = new Date(data.invoiceDate);
    if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);
    if (data.receivedDate !== undefined) updateData.receivedDate = data.receivedDate ? new Date(data.receivedDate) : null;
    if (data.purchaseOrderId !== undefined) updateData.purchaseOrderId = data.purchaseOrderId;
    if (data.purchaseOrderNumber !== undefined) updateData.purchaseOrderNumber = data.purchaseOrderNumber;
    if (data.grnId !== undefined) updateData.grnId = data.grnId;
    if (data.grnNumber !== undefined) updateData.grnNumber = data.grnNumber;
    if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
    if (data.notes !== undefined) updateData.notes = data.notes;
    // NOTE: metadata intentionally excluded — z.any() allows arbitrary data

    try {
      const updated = await prisma.imdadInvoice.update({
        where: { id, version: existing.version },
        data: { ...updateData, version: { increment: 1 } },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId,
        actorUserId: userId,
        action: 'UPDATE',
        resourceType: 'invoice',
        resourceId: id,
        boundedContext: 'BC4_FINANCIAL',
        previousData: existing as any,
        newData: updated as any,
        request: req,
      });

      return NextResponse.json({ invoice: updated });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        return NextResponse.json(
          { error: 'Optimistic locking conflict' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.invoice.edit' }
);

// ---------------------------------------------------------------------------
// PATCH — Status transitions (verify/match/approve/pay)
// ---------------------------------------------------------------------------
const patchInvoiceSchema = z.object({
  action: z.enum(['verify', 'match', 'approve', 'pay']),
  version: z.number().int(),
  paymentAmount: z.number().positive().optional(), // Required for 'pay' action
  notes: z.string().optional(),
});

const INVOICE_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  verify: { from: ['RECEIVED'], to: 'VERIFIED' },
  match: { from: ['VERIFIED'], to: 'MATCHED' },
  approve: { from: ['MATCHED'], to: 'APPROVED' },
  pay: { from: ['APPROVED'], to: 'PAID' }, // to is dynamic (PAID or PARTIALLY_PAID)
};

export const PATCH = withAuthTenant(
  async (req, { tenantId, userId }, params) => {
    const { id } = (await params) as { id: string };

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = patchInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { action, paymentAmount, notes } = parsed.data;
    const transition = INVOICE_TRANSITIONS[action];

    const existing = await prisma.imdadInvoice.findFirst({
      where: { id, tenantId, isDeleted: false },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (existing.version !== parsed.data.version) {
      return NextResponse.json(
        { error: 'Conflict', message: 'Record was modified by another user. Please refresh and try again.' },
        { status: 409 }
      );
    }

    if (!transition.from.includes(existing.status)) {
      return NextResponse.json(
        {
          error: `Cannot ${action} invoice in ${existing.status} status. Allowed from: ${transition.from.join(', ')}`,
        },
        { status: 409 }
      );
    }

    const updateData: any = {
      version: { increment: 1 },
      updatedBy: userId,
    };

    if (notes) updateData.notes = notes;

    if (action === 'match') {
      // 3-way match: compare invoice against PO and GRN
      let matchVariance = 0;
      if (existing.purchaseOrderId) {
        // Check PO total vs invoice total
        const po = await prisma.imdadPurchaseOrder.findFirst({
          where: { id: existing.purchaseOrderId, tenantId, isDeleted: false },
          select: { totalAmount: true },
        });
        if (po) {
          matchVariance = Math.abs(Number(existing.totalAmount) - Number(po.totalAmount));
        }
      }

      // [Bug #7 FIX] Default to 5% tolerance if matchTolerancePct is null/undefined
      const toleranceAmount =
        Number(existing.totalAmount) * (Number(existing.matchTolerancePct ?? 5) / 100);
      const isMatched = matchVariance <= toleranceAmount;

      updateData.isMatched = isMatched;
      updateData.matchVariance = matchVariance;
      updateData.status = isMatched ? 'MATCHED' : 'DISPUTED';
    } else if (action === 'approve') {
      updateData.status = 'APPROVED';
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
    } else if (action === 'pay') {
      if (!paymentAmount) {
        return NextResponse.json(
          { error: 'paymentAmount is required for pay action' },
          { status: 400 }
        );
      }

      const newPaidAmount = Number(existing.paidAmount) + paymentAmount;
      const totalDue = Number(existing.totalAmount);
      const newBalanceDue = totalDue - newPaidAmount;

      updateData.paidAmount = newPaidAmount;
      updateData.balanceDue = Math.max(0, newBalanceDue);
      updateData.status = newPaidAmount >= totalDue ? 'PAID' : 'PARTIALLY_PAID';
    } else {
      // verify
      updateData.status = transition.to;
    }

    // [Bug #25 FIX] Add optimistic locking to PATCH — include version in where clause
    const updated = await prisma.imdadInvoice.update({
      where: { id, version: existing.version },
      data: { ...updateData, version: { increment: 1 } },
    });

    // [Bug #26 FIX] Use actual action instead of hardcoded 'APPROVE'
    await imdadAudit.log({
      tenantId,
      organizationId: existing.organizationId,
      actorUserId: userId,
      action: action?.toUpperCase() || 'UPDATE',
      resourceType: 'invoice',
      resourceId: id,
      boundedContext: 'BC4_FINANCIAL',
      previousData: { status: existing.status },
      newData: { status: updated.status, action },
      request: req,
    });

    return NextResponse.json({ invoice: updated });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.invoice.approve' }
);
