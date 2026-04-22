/**
 * SCM BC3 Procurement — Goods Receiving Notes (GRN)
 *
 * GET  /api/imdad/procurement/grn — List GRNs with filters
 * POST /api/imdad/procurement/grn — Create GRN linked to PO
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List GRNs
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, status, vendorId, purchaseOrderId, organizationId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (vendorId) where.vendorId = vendorId;
      if (purchaseOrderId) where.poId = purchaseOrderId;

      const [data, total] = await Promise.all([
        prisma.imdadGoodsReceivingNote.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            lines: true,
            purchaseOrder: { select: { id: true, poNumber: true } },
          } as any,
        }),
        prisma.imdadGoodsReceivingNote.count({ where }),
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
// POST — Create GRN
// ---------------------------------------------------------------------------

const grnLineSchema = z.object({
  purchaseOrderLineId: z.string().uuid().optional(),
  itemId: z.string().uuid(),
  itemCode: z.string().optional(),
  itemName: z.string().min(1),
  orderedQuantity: z.number().nonnegative(),
  receivedQuantity: z.number().nonnegative().default(0),
  unitOfMeasure: z.string().min(1),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  locationId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const createGrnSchema = z.object({
  organizationId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
  vendorId: z.string().uuid(),
  receivingLocationId: z.string().uuid().optional(),
  notes: z.string().optional(),
  lines: z.array(grnLineSchema).min(1, 'At least one line item is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createGrnSchema.parse(body);

      // Generate GRN number atomically using sequence counter inside a transaction
      const year = new Date().getFullYear();
      const grnPrefix = 'GRN-';
      const grnPadLen = 6;

      const grn = await prisma.$transaction(async (tx) => {
        // Atomically increment the sequence counter
        const counter = await tx.imdadSequenceCounter.upsert({
          where: {
            tenantId_organizationId_sequenceType_fiscalYear: {
              tenantId,
              organizationId: parsed.organizationId,
              sequenceType: 'GRN',
              fiscalYear: year,
            },
          },
          create: {
            tenantId,
            organizationId: parsed.organizationId,
            sequenceType: 'GRN',
            prefix: grnPrefix,
            currentValue: 1,
            fiscalYear: year,
          } as any,
          update: {
            currentValue: { increment: 1 },
          },
        });

        const grnNumber = `${grnPrefix}${year}-${String(counter.currentValue).padStart(grnPadLen, '0')}`;

        return tx.imdadGoodsReceivingNote.create({
          data: {
            tenantId,
            organizationId: parsed.organizationId,
            grnNumber,
            status: 'DRAFT' as any,
            poId: parsed.purchaseOrderId,
            vendorId: parsed.vendorId,
            receivedBy: userId,
            notes: parsed.notes,
            lines: {
              create: parsed.lines.map((line, idx) => ({
                tenantId,
                organizationId: parsed.organizationId,
                lineNumber: idx + 1,
                poLineId: line.purchaseOrderLineId,
                itemId: line.itemId,
                orderedQty: line.orderedQuantity,
                receivedQty: line.receivedQuantity,
                batchNumber: line.batchNumber,
                expiryDate: line.expiryDate ? new Date(line.expiryDate) : undefined,
                locationId: line.locationId,
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
        resourceType: 'goods_receiving_note',
        resourceId: grn.id,
        boundedContext: 'BC3_PROCUREMENT',
        newData: grn as any,
        request: req,
      });

      return NextResponse.json({ data: grn }, { status: 201 });
    } catch (error) {
      console.error('[GRN POST] Error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.grn.create' }
);
