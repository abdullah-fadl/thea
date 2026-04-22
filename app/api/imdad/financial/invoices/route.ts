/**
 * SCM BC4 Financial — Invoices
 *
 * GET  /api/imdad/financial/invoices — List invoices with filters
 * POST /api/imdad/financial/invoices — Create invoice in DRAFT status with lines
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadInvoice
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status') || undefined;
    const vendorId = url.searchParams.get('vendorId') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const isMatched = url.searchParams.get('isMatched');
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (isMatched !== null && isMatched !== undefined && isMatched !== '') {
      where.isMatched = isMatched === 'true';
    }
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.imdadInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadInvoice.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadInvoice with lines
// ---------------------------------------------------------------------------
const invoiceLineSchema = z.object({
  itemId: z.string().uuid().optional(),
  itemCode: z.string().optional(),
  description: z.string().min(1),
  descriptionAr: z.string().optional(),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().optional(),
  unitPrice: z.number().min(0),
  taxAmount: z.number().min(0).optional(),
  poLineId: z.string().uuid().optional(),
  poLineNumber: z.number().int().optional(),
  grnLineId: z.string().uuid().optional(),
  grnLineNumber: z.number().int().optional(),
  notes: z.string().optional(),
});

const createInvoiceSchema = z.object({
  organizationId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  vendorId: z.string().uuid(),
  vendorName: z.string().min(1),
  invoiceDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  receivedDate: z.string().datetime().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  purchaseOrderNumber: z.string().optional(),
  grnId: z.string().uuid().optional(),
  grnNumber: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  attachmentIds: z.array(z.string()).optional(),
  lines: z.array(invoiceLineSchema).min(1, 'At least one line is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const taxRate = data.taxRate ?? 15;
    const discountAmount = data.discountAmount ?? 0;

    // Auto-generate internal number using atomic sequence counter (prevents race conditions)
    const year = new Date().getFullYear();
    const invPrefix = 'INV-';

    const counter = await prisma.imdadSequenceCounter.upsert({
      where: {
        tenantId_organizationId_sequenceType_fiscalYear: {
          tenantId,
          organizationId: data.organizationId,
          sequenceType: 'INV',
          fiscalYear: year,
        },
      },
      create: {
        tenantId,
        organizationId: data.organizationId,
        sequenceType: 'INV',
        prefix: invPrefix,
        currentValue: 1,
        fiscalYear: year,
      } as any,
      update: { currentValue: { increment: 1 } },
    });

    const internalNumber = `${invPrefix}${year}-${String(counter.currentValue).padStart(6, '0')}`;

    // Calculate totals from lines
    const subtotal = data.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0
    );
    const lineTaxTotal = data.lines.reduce(
      (sum, line) => sum + (line.taxAmount ?? 0),
      0
    );
    const taxAmount = lineTaxTotal > 0 ? lineTaxTotal : subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount - discountAmount;
    const balanceDue = totalAmount;

    try {
      const invoice = await prisma.imdadInvoice.create({
        data: {
          tenantId,
          organizationId: data.organizationId,
          invoiceNumber: data.invoiceNumber,
          internalNumber,
          vendorId: data.vendorId,
          vendorName: data.vendorName,
          invoiceDate: new Date(data.invoiceDate),
          dueDate: new Date(data.dueDate),
          receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined,
          purchaseOrderId: data.purchaseOrderId,
          purchaseOrderNumber: data.purchaseOrderNumber,
          grnId: data.grnId,
          grnNumber: data.grnNumber,
          subtotal,
          taxAmount,
          taxRate,
          discountAmount,
          totalAmount,
          paidAmount: 0,
          balanceDue,
          currency: data.currency,
          paymentTerms: data.paymentTerms,
          notes: data.notes,
          metadata: data.metadata,
          attachmentIds: data.attachmentIds || [],
          status: 'DRAFT',
          createdBy: userId,
          updatedBy: userId,
          lines: {
            create: data.lines.map((line, idx) => ({
              tenantId,
              organizationId: data.organizationId,
              lineNumber: idx + 1,
              itemId: line.itemId,
              itemCode: line.itemCode,
              description: line.description,
              descriptionAr: line.descriptionAr,
              quantity: line.quantity,
              unitOfMeasure: line.unitOfMeasure,
              unitPrice: line.unitPrice,
              lineTotal: line.quantity * line.unitPrice,
              taxAmount: line.taxAmount ?? 0,
              poLineId: line.poLineId,
              poLineNumber: line.poLineNumber,
              grnLineId: line.grnLineId,
              grnLineNumber: line.grnLineNumber,
              notes: line.notes,
              createdBy: userId,
            })),
          },
        } as any,
        include: { lines: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'invoice',
        resourceId: invoice.id,
        boundedContext: 'BC4_FINANCIAL',
        newData: { internalNumber, vendorId: data.vendorId, totalAmount, lineCount: data.lines.length },
        request: req,
      });

      return NextResponse.json({ invoice }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Invoice number already exists for this organization' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.invoice.create' }
);
