/**
 * SCM BC2 Warehouse — Pick Lists
 *
 * GET  /api/imdad/warehouse/pick-lists — List pick lists with filters
 * POST /api/imdad/warehouse/pick-lists — Create pick list with lines
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List pick lists
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
      const sourceType = url.searchParams.get('sourceType') || undefined;
      const assignedTo = url.searchParams.get('assignedTo') || undefined;

      const where: any = { tenantId, isDeleted: false };

      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (sourceType) where.sourceType = sourceType;
      if (assignedTo) where.assignedTo = assignedTo;

      if (search) {
        where.OR = [
          { pickNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadPickList.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { lines: true } as any,
        }),
        prisma.imdadPickList.count({ where }),
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
// POST — Create pick list with lines
// ---------------------------------------------------------------------------

const pickLineSchema = z.object({
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  requestedQty: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  sourceBinId: z.string().uuid(),
  lineNumber: z.number().int().positive(),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

const createPickListSchema = z.object({
  pickNumber: z.string().min(1, 'pickNumber is required'),
  sourceType: z.string().min(1, 'sourceType is required'),
  sourceId: z.string().uuid('sourceId must be a valid UUID'),
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  assignedTo: z.string().uuid().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(pickLineSchema).min(1, 'At least one line is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createPickListSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // Check duplicate pickNumber within tenant + org
      const existing = await prisma.imdadPickList.findFirst({
        where: {
          tenantId,
          organizationId: data.organizationId,
          pickNumber: data.pickNumber,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Pick list with this number already exists' },
          { status: 409 }
        );
      }

      const pickList = await prisma.$transaction(async (tx) => {
        return tx.imdadPickList.create({
          data: {
            tenantId,
            organizationId: data.organizationId,
            pickNumber: data.pickNumber,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            assignedTo: data.assignedTo,
            status: 'PENDING',
            priority: data.priority,
            notes: data.notes,
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
                sourceBinId: line.sourceBinId,
                serialNumber: line.serialNumber,
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
        resourceType: 'PICK_LIST',
        resourceId: pickList.id,
        boundedContext: 'BC2_WAREHOUSE',
        newData: pickList as any,
        request: req,
      });

      return NextResponse.json({ data: pickList }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.pick.create' }
);
