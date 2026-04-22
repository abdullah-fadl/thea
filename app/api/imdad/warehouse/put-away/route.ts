/**
 * SCM BC2 Warehouse — Put-Away Tasks
 *
 * GET  /api/imdad/warehouse/put-away — List put-away tasks with filters
 * POST /api/imdad/warehouse/put-away — Create put-away task with lines
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List put-away tasks
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
      const grnId = url.searchParams.get('grnId') || undefined;
      const assignedTo = url.searchParams.get('assignedTo') || undefined;

      const where: any = { tenantId, isDeleted: false };

      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (grnId) where.grnId = grnId;
      if (assignedTo) where.assignedTo = assignedTo;

      if (search) {
        where.OR = [
          { taskNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadPutAwayTask.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { lines: true } as any,
        }),
        prisma.imdadPutAwayTask.count({ where }),
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
// POST — Create put-away task with lines
// ---------------------------------------------------------------------------

const putAwayLineSchema = z.object({
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  targetBinId: z.string().uuid(),
  lineNumber: z.number().int().positive(),
  lotNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

const createPutAwaySchema = z.object({
  taskNumber: z.string().min(1, 'taskNumber is required'),
  grnId: z.string().uuid('grnId must be a valid UUID'),
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  assignedTo: z.string().uuid().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(putAwayLineSchema).min(1, 'At least one line is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createPutAwaySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const data = parsed.data;

      // Check duplicate taskNumber within tenant + org
      const existing = await prisma.imdadPutAwayTask.findFirst({
        where: {
          tenantId,
          organizationId: data.organizationId,
          taskNumber: data.taskNumber,
          isDeleted: false,
        },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Put-away task with this number already exists' },
          { status: 409 }
        );
      }

      const task = await prisma.$transaction(async (tx) => {
        return tx.imdadPutAwayTask.create({
          data: {
            tenantId,
            organizationId: data.organizationId,
            taskNumber: data.taskNumber,
            grnId: data.grnId,
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
                quantity: line.quantity,
                unitOfMeasure: line.unitOfMeasure,
                targetBinId: line.targetBinId,
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
        resourceType: 'PUT_AWAY_TASK',
        resourceId: task.id,
        boundedContext: 'BC2_WAREHOUSE',
        newData: task as any,
        request: req,
      });

      return NextResponse.json({ data: task }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.putaway.create' }
);
