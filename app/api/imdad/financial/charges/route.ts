/**
 * SCM BC4 Financial — Charge Captures
 *
 * GET  /api/imdad/financial/charges — List charge captures with filters
 * POST /api/imdad/financial/charges — Create charge capture with items
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadChargeCapture
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const chargeType = url.searchParams.get('chargeType') || undefined;
    const costCenterId = url.searchParams.get('costCenterId') || undefined;
    const organizationId = url.searchParams.get('organizationId') || undefined;
    const startDate = url.searchParams.get('startDate') || undefined;
    const endDate = url.searchParams.get('endDate') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (organizationId) where.organizationId = organizationId;
    if (chargeType) where.chargeType = chargeType;
    if (costCenterId) where.costCenterId = costCenterId;
    if (startDate || endDate) {
      where.chargeDate = {};
      if (startDate) where.chargeDate.gte = new Date(startDate);
      if (endDate) where.chargeDate.lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      prisma.imdadChargeCapture.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: { where: { isDeleted: false } as any, orderBy: { lineNumber: 'asc' } } } as any,
      }),
      prisma.imdadChargeCapture.count({ where }),
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
// POST — Create ImdadChargeCapture with items
// ---------------------------------------------------------------------------
const chargeItemSchema = z.object({
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  unitCost: z.number().min(0),
  batchLotId: z.string().uuid().optional(),
  serialNumber: z.string().optional(),
  inventoryTransactionId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const createChargeSchema = z.object({
  organizationId: z.string().uuid(),
  chargeType: z.enum([
    'CONSUMPTION',
    'REQUISITION',
    'PO_RECEIPT',
    'RETURN_CREDIT',
    'ADJUSTMENT',
    'WASTE',
    'INTERDEPT',
  ]),
  chargeDate: z.string().datetime(),
  costCenterId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  budgetId: z.string().uuid().optional(),
  budgetLineId: z.string().uuid().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  items: z.array(chargeItemSchema).min(1, 'At least one item is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createChargeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Auto-generate charge number: count existing charges to ensure uniqueness
    const year = new Date().getFullYear();
    const chgPrefix = 'CHG-';
    const existingChgCount = await prisma.imdadChargeCapture.count({
      where: {
        tenantId,
        chargeNumber: { startsWith: `${chgPrefix}${year}-` },
      },
    });
    const nextChgValue = existingChgCount + 1;
    const chargeNumber = `${chgPrefix}${year}-${String(nextChgValue).padStart(6, '0')}`;

    // Sync sequence counter
    await prisma.imdadSequenceCounter.upsert({
      where: {
        tenantId_organizationId_sequenceType_fiscalYear: {
          tenantId,
          organizationId: data.organizationId,
          sequenceType: 'CHG',
          fiscalYear: year,
        },
      },
      create: {
        tenantId,
        organizationId: data.organizationId,
        sequenceType: 'CHG',
        prefix: chgPrefix,
        currentValue: nextChgValue,
        fiscalYear: year,
      } as any,
      update: { currentValue: nextChgValue },
    });

    // Calculate totalAmount from items
    const totalAmount = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );

    try {
      const charge = await prisma.imdadChargeCapture.create({
        data: {
          tenantId,
          organizationId: data.organizationId,
          chargeNumber,
          chargeType: data.chargeType,
          chargeDate: new Date(data.chargeDate),
          costCenterId: data.costCenterId,
          departmentId: data.departmentId,
          locationId: data.locationId,
          patientId: data.patientId,
          encounterId: data.encounterId,
          budgetId: data.budgetId,
          budgetLineId: data.budgetLineId,
          totalAmount,
          currency: data.currency,
          notes: data.notes,
          metadata: data.metadata,
          createdBy: userId,
          updatedBy: userId,
          items: {
            create: data.items.map((item, idx) => ({
              tenantId,
              organizationId: data.organizationId,
              lineNumber: idx + 1,
              itemId: item.itemId,
              itemCode: item.itemCode,
              itemName: item.itemName,
              quantity: item.quantity,
              unitOfMeasure: item.unitOfMeasure,
              unitCost: item.unitCost,
              totalCost: item.quantity * item.unitCost,
              batchLotId: item.batchLotId,
              serialNumber: item.serialNumber,
              inventoryTransactionId: item.inventoryTransactionId,
              notes: item.notes,
              createdBy: userId,
            })),
          },
        } as any,
        include: { items: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        action: 'CREATE',
        resourceType: 'charge_capture',
        resourceId: charge.id,
        boundedContext: 'BC4_FINANCIAL',
        newData: { chargeNumber, totalAmount, itemCount: data.items.length },
        request: req,
      });

      return NextResponse.json({ charge }, { status: 201 });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return NextResponse.json(
          { error: 'Charge number already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.financial.charge.create' }
);
