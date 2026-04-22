/**
 * SCM BC3 Procurement — Purchase Orders
 *
 * GET  /api/imdad/procurement/purchase-orders — List POs with filters
 * POST /api/imdad/procurement/purchase-orders — Create PO with lines
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List purchase orders
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, status, vendorId, organizationId, startDate, endDate } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (vendorId) where.vendorId = vendorId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [data, total] = await Promise.all([
        prisma.imdadPurchaseOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            lines: true,
            vendor: { select: { id: true, name: true, code: true } },
          } as any,
        }),
        prisma.imdadPurchaseOrder.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.view' }
);

// ---------------------------------------------------------------------------
// POST — Create purchase order
// ---------------------------------------------------------------------------

const poLineSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  uomId: z.string().uuid().optional(),
  taxAmount: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

const createPoSchema = z.object({
  organizationId: z.string().uuid(),
  vendorId: z.string().uuid(),
  prId: z.string().uuid().optional(),
  currency: z.string().default('SAR'),
  paymentTerms: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  deliveryAddress: z.string().optional(),
  shippingMethod: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(poLineSchema).min(1, 'At least one line item is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createPoSchema.parse(body);

      // Calculate line totals
      const linesWithTotals = parsed.lines.map((line) => {
        const totalCost = line.quantity * line.unitCost;
        const lineTaxAmount = line.taxAmount || 0;
        return { ...line, totalCost, lineTaxAmount };
      });

      const subtotal = linesWithTotals.reduce((sum, l) => sum + l.totalCost, 0);
      const taxAmount = linesWithTotals.reduce((sum, l) => sum + l.lineTaxAmount, 0);
      const totalAmount = subtotal + taxAmount;

      // Generate PO number atomically using sequence counter inside a transaction
      const year = new Date().getFullYear();
      const poPrefix = 'PO-';
      const poPadLen = 6;

      const po = await prisma.$transaction(async (tx) => {
        // Atomically increment the sequence counter
        const counter = await tx.imdadSequenceCounter.upsert({
          where: {
            tenantId_organizationId_sequenceType_fiscalYear: {
              tenantId,
              organizationId: parsed.organizationId,
              sequenceType: 'PO',
              fiscalYear: year,
            },
          },
          create: {
            tenantId,
            organizationId: parsed.organizationId,
            sequenceType: 'PO',
            prefix: poPrefix,
            currentValue: 1,
            fiscalYear: year,
          } as any,
          update: {
            currentValue: { increment: 1 },
          },
        });

        const poNumber = `${poPrefix}${year}-${String(counter.currentValue).padStart(poPadLen, '0')}`;

        return tx.imdadPurchaseOrder.create({
          data: {
            tenantId,
            organizationId: parsed.organizationId,
            poNumber,
            status: 'DRAFT',
            vendorId: parsed.vendorId,
            prId: parsed.prId,
            currency: parsed.currency,
            paymentTerms: parsed.paymentTerms,
            expectedDeliveryDate: parsed.expectedDeliveryDate
              ? new Date(parsed.expectedDeliveryDate)
              : undefined,
            deliveryAddress: parsed.deliveryAddress,
            shippingMethod: parsed.shippingMethod,
            notes: parsed.notes,
            subtotal,
            taxAmount,
            totalAmount,
            createdBy: userId,
            updatedBy: userId,
            lines: {
              create: linesWithTotals.map((line, idx) => ({
                tenantId,
                organizationId: parsed.organizationId,
                lineNumber: idx + 1,
                itemId: line.itemId,
                quantity: line.quantity,
                unitCost: line.unitCost,
                totalCost: line.totalCost,
                taxAmount: line.lineTaxAmount,
                uomId: line.uomId,
                notes: line.notes,
              })),
            },
          } as any,
          include: { lines: true } as any,
        });
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'purchase_order',
        resourceId: po.id,
        boundedContext: 'BC3_PROCUREMENT',
        newData: po as any,
        request: req,
      });

      return NextResponse.json({ data: po }, { status: 201 });
    } catch (error) {
      console.error('[PurchaseOrders POST] Error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.po.create' }
);
