/**
 * SCM BC3 Procurement — Delivery Tracking
 *
 * GET  /api/imdad/procurement/deliveries — List deliveries with filters
 * POST /api/imdad/procurement/deliveries — Create a delivery record linked to a PO
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List deliveries
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  purchaseOrderId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  carrierId: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, purchaseOrderId, vendorId, carrierId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
      if (vendorId) where.vendorId = vendorId;
      if (carrierId) where.carrierId = carrierId;
      if (search) {
        where.OR = [
          { deliveryNumber: { contains: search, mode: 'insensitive' } },
          { trackingNumber: { contains: search, mode: 'insensitive' } },
          { carrierName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        (prisma as any).imdadDelivery.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        (prisma as any).imdadDelivery.count({ where }),
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
// POST — Create delivery record
// ---------------------------------------------------------------------------

const createDeliverySchema = z.object({
  organizationId: z.string().uuid(),
  purchaseOrderId: z.string().uuid(),
  purchaseOrderNumber: z.string().optional(),
  vendorId: z.string().uuid(),
  vendorName: z.string().min(1),
  carrierId: z.string().optional(),
  carrierName: z.string().optional(),
  trackingNumber: z.string().optional(),
  shippingMethod: z.string().optional(),
  estimatedDepartureDate: z.string().optional(),
  estimatedArrivalDate: z.string().optional(),
  actualDepartureDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  receivingLocationId: z.string().uuid().optional(),
  weight: z.number().nonnegative().optional(),
  weightUnit: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createDeliverySchema.parse(body);

      // Generate delivery number atomically
      const year = new Date().getFullYear();
      const counter = await prisma.imdadSequenceCounter.upsert({
        where: {
          tenantId_organizationId_sequenceType_fiscalYear: {
            tenantId,
            organizationId: parsed.organizationId,
            sequenceType: 'DEL',
            fiscalYear: year,
          },
        },
        create: {
          tenantId,
          organizationId: parsed.organizationId,
          sequenceType: 'DEL',
          prefix: 'DEL-',
          currentValue: 1,
          fiscalYear: year,
        } as any,
        update: { currentValue: { increment: 1 } },
      });

      const deliveryNumber = `${counter.prefix}${year}-${String(counter.currentValue).padStart(6, '0')}`;

      // Validate the PO exists
      const po = await prisma.imdadPurchaseOrder.findFirst({
        where: { id: parsed.purchaseOrderId, tenantId, isDeleted: false },
        select: { id: true, poNumber: true, status: true },
      });
      if (!po) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }

      const delivery = await (prisma as any).imdadDelivery.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          deliveryNumber,
          purchaseOrderId: parsed.purchaseOrderId,
          purchaseOrderNumber: parsed.purchaseOrderNumber || po.poNumber,
          vendorId: parsed.vendorId,
          vendorName: parsed.vendorName,
          carrierId: parsed.carrierId,
          carrierName: parsed.carrierName,
          trackingNumber: parsed.trackingNumber,
          shippingMethod: parsed.shippingMethod,
          estimatedDepartureDate: parsed.estimatedDepartureDate ? new Date(parsed.estimatedDepartureDate) : undefined,
          estimatedArrivalDate: parsed.estimatedArrivalDate ? new Date(parsed.estimatedArrivalDate) : undefined,
          actualDepartureDate: parsed.actualDepartureDate ? new Date(parsed.actualDepartureDate) : undefined,
          shippingAddress: parsed.shippingAddress,
          receivingLocationId: parsed.receivingLocationId,
          weight: parsed.weight,
          weightUnit: parsed.weightUnit,
          notes: parsed.notes,
          status: 'CREATED',
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'DELIVERY',
        resourceId: delivery.id,
        boundedContext: 'BC3_PROCUREMENT',
        newData: delivery as any,
        request: req,
      });

      return NextResponse.json({ data: delivery }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.delivery.create' }
);
