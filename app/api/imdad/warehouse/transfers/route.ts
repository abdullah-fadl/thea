/**
 * SCM BC2 Warehouse — Transfer Requests
 *
 * GET  /api/imdad/warehouse/transfers — List transfer requests with filters
 * POST /api/imdad/warehouse/transfers — Create transfer request with lines
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List transfer requests
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
      const search = url.searchParams.get('search')?.trim() || '';
      const organizationId = url.searchParams.get('organizationId') || undefined;
      const status = url.searchParams.get('status') || undefined;
      const transferType = url.searchParams.get('transferType') || undefined;
      const sourceLocationId = url.searchParams.get('sourceLocationId') || undefined;
      const destLocationId = url.searchParams.get('destLocationId') || undefined;

      const where: any = { tenantId, isDeleted: false };

      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (transferType) where.transferType = transferType;
      if (sourceLocationId) where.sourceLocationId = sourceLocationId;
      if (destLocationId) where.destLocationId = destLocationId;

      if (search) {
        where.OR = [
          { transferNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadTransferRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { lines: true } as any,
        }),
        prisma.imdadTransferRequest.count({ where }),
      ]);

      return NextResponse.json({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// POST — Create transfer request with lines
// ---------------------------------------------------------------------------

const transferLineSchema = z.object({
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  requestedQty: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  lineNumber: z.number().int().positive(),
  notes: z.string().optional(),
});

const createTransferSchema = z.object({
  transferNumber: z.string().min(1, 'transferNumber is required'),
  transferType: z.string().min(1, 'transferType is required'),
  sourceLocationId: z.string().uuid('sourceLocationId must be a valid UUID'),
  destLocationId: z.string().uuid('destLocationId must be a valid UUID'),
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  requestedBy: z.string().uuid('requestedBy must be a valid UUID'),
  priority: z.string().optional(),
  notes: z.string().optional(),
  requiredDate: z.string().optional(),
  lines: z.array(transferLineSchema).min(1, 'At least one line is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createTransferSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // Check duplicate transferNumber within tenant + org
      const existing = await prisma.imdadTransferRequest.findFirst({
        where: {
          tenantId,
          organizationId: data.organizationId,
          transferNumber: data.transferNumber,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Transfer request with this number already exists' },
          { status: 409 }
        );
      }

      const transfer = await prisma.$transaction(async (tx) => {
        return tx.imdadTransferRequest.create({
          data: {
            tenantId,
            organizationId: data.organizationId,
            transferNumber: data.transferNumber,
            transferType: data.transferType as any,
            sourceLocationId: data.sourceLocationId,
            destLocationId: data.destLocationId,
            requestedBy: data.requestedBy,
            status: 'DRAFT',
            priority: data.priority,
            notes: data.notes,
            requiredByDate: data.requiredDate ? new Date(data.requiredDate) : undefined,
            createdBy: userId,
            updatedBy: userId,
            lines: {
              create: data.lines.map((line) => ({
                tenantId,
                organizationId: data.organizationId,
                lineNumber: line.lineNumber,
                itemId: line.itemId,
                itemCode: line.itemCode,
                itemName: line.itemName,
                requestedQty: line.requestedQty,
                unitOfMeasure: line.unitOfMeasure,
                notes: line.notes,
              })),
            },
          } as any,
          include: { lines: true } as any,
        });
      });

      await imdadAudit.log({
        tenantId,
        organizationId: data.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'TRANSFER_REQUEST',
        resourceId: transfer.id,
        boundedContext: 'BC2_WAREHOUSE',
        newData: transfer as any,
        request: req,
      });

      return NextResponse.json({ data: transfer }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.transfer.create' }
);
