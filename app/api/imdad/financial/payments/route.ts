/**
 * SCM BC4 Financial — Payment Batches
 *
 * GET  /api/imdad/financial/payments — List payment batches with filters
 * POST /api/imdad/financial/payments — Create payment in PENDING status
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadPaymentBatch
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const status = url.searchParams.get('status') || undefined;
    const vendorId = url.searchParams.get('vendorId') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const paymentMethod = url.searchParams.get('paymentMethod') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (search) {
      where.OR = [
        { batchNumber: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.imdadPaymentBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { invoice: { select: { invoiceNumber: true, totalAmount: true, status: true } as any } } as any,
      }),
      prisma.imdadPaymentBatch.count({ where }),
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
// POST — Create ImdadPaymentBatch
// ---------------------------------------------------------------------------
const createPaymentSchema = z.object({
  organizationId: z.string().uuid(),
  paymentDate: z.string().datetime(),
  vendorId: z.string().uuid(),
  vendorName: z.string().min(1),
  invoiceId: z.string().uuid(),
  invoiceNumber: z.string().min(1),
  paymentMethod: z.enum([
    'BANK_TRANSFER',
    'CHECK',
    'ELECTRONIC',
    'CREDIT_CARD',
    'CASH',
  ]),
  paymentReference: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  bankAccountCode: z.string().optional(),
  bankName: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate invoice exists
    const invoice = await prisma.imdadInvoice.findFirst({
      where: { id: data.invoiceId, tenantId, isDeleted: false },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate amount is positive
    if (data.amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Validate invoice is in a payable status
    const payableStatuses = ['APPROVED', 'PARTIALLY_PAID'];
    if (!payableStatuses.includes(invoice.status)) {
      return NextResponse.json(
        { error: `Invoice is not payable (current status: ${invoice.status})` },
        { status: 400 }
      );
    }

    // Validate amount does not exceed invoice balance
    if (data.amount > Number(invoice.balanceDue)) {
      return NextResponse.json(
        {
          error: `Payment amount (${data.amount}) exceeds invoice balance due (${invoice.balanceDue})`,
        },
        { status: 400 }
      );
    }

    // Auto-generate batch number
    const year = new Date().getFullYear();
    const counter = await prisma.imdadSequenceCounter.upsert({
      where: {
        tenantId_organizationId_sequenceType_fiscalYear: {
          tenantId,
          organizationId: data.organizationId,
          sequenceType: 'PAY',
          fiscalYear: year,
        },
      },
      create: {
        tenantId,
        organizationId: data.organizationId,
        sequenceType: 'PAY',
        prefix: 'PAY-',
        currentValue: 1,
        fiscalYear: year,
      } as any,
      update: { currentValue: { increment: 1 } },
    });

    const batchNumber = `PAY-${year}-${String(counter.currentValue).padStart(6, '0')}`;

    try {
      // Create payment and update invoice paidAmount in a transaction
      const [payment] = await prisma.$transaction([
        prisma.imdadPaymentBatch.create({
          data: {
            tenantId,
            organizationId: data.organizationId,
            batchNumber,
            paymentDate: new Date(data.paymentDate),
            vendorId: data.vendorId,
            vendorName: data.vendorName,
            invoiceId: data.invoiceId,
            invoiceNumber: data.invoiceNumber,
            paymentMethod: data.paymentMethod,
            paymentReference: data.paymentReference,
            amount: data.amount,
            currency: data.currency,
            bankAccountCode: data.bankAccountCode,
            bankName: data.bankName,
            status: 'PENDING',
            notes: data.notes,
            metadata: data.metadata,
            createdBy: userId,
            updatedBy: userId,
          } as any,
        }),
        prisma.imdadInvoice.update({
          where: { id: data.invoiceId },
          data: {
            paidAmount: { increment: data.amount },
            balanceDue: { decrement: data.amount },
            updatedBy: userId,
          },
        }),
      ]);

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'payment_batch',
        resourceId: payment.id,
        boundedContext: 'BC4_FINANCIAL',
        newData: { batchNumber, amount: data.amount, invoiceId: data.invoiceId },
        request: req,
      });

      return NextResponse.json({ payment }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Payment batch number already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.payment.create' }
);
