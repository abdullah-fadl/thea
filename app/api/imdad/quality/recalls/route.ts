/**
 * SCM BC6 Quality — Recalls
 *
 * GET  /api/imdad/quality/recalls — List recalls with pagination, search, filters
 * POST /api/imdad/quality/recalls — Create recall with initial actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List recalls
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  itemId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, severity, itemId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (severity) where.severity = severity;
      if (itemId) where.itemId = itemId;
      if (search) {
        where.OR = [
          { recallNumber: { contains: search, mode: 'insensitive' } },
          { itemName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadRecall.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadRecall.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.quality.view' }
);

// ---------------------------------------------------------------------------
// POST — Create recall with initial actions
// ---------------------------------------------------------------------------

const recallActionSchema = z.object({
  actionNumber: z.number().int().min(1),
  actionType: z.string().min(1),
  description: z.string().min(1),
  locationId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

const createRecallSchema = z.object({
  organizationId: z.string().uuid(),
  recallNumber: z.string().min(1).max(50),
  severity: z.string().min(1),
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  recallReason: z.string().min(1),
  initiatedBy: z.string().uuid(),
  initiatedAt: z.string(),
  batchNumbers: z.array(z.string()).optional(),
  quantityAffected: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  actions: z.array(recallActionSchema).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createRecallSchema.parse(body);

      const { actions, ...headerData } = parsed;

      // Duplicate check: recallNumber must be unique within tenant+org
      const existing = await prisma.imdadRecall.findFirst({
        where: { tenantId, organizationId: headerData.organizationId, recallNumber: headerData.recallNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Recall with this number already exists' }, { status: 409 });
      }

      const recall = await prisma.$transaction(async (tx) => {
        const header = await tx.imdadRecall.create({
          data: {
            tenantId,
            organizationId: headerData.organizationId,
            recallNumber: headerData.recallNumber,
            severity: headerData.severity as any,
            itemId: headerData.itemId,
            itemCode: headerData.itemCode,
            itemName: headerData.itemName,
            recallReason: headerData.recallReason,
            initiatedBy: headerData.initiatedBy,
            initiatedAt: new Date(headerData.initiatedAt),
            batchNumbers: headerData.batchNumbers ?? [],
            quantityAffected: headerData.quantityAffected,
            notes: headerData.notes,
            status: 'INITIATED' as any,
            createdBy: userId,
            updatedBy: userId,
          } as any,
        });

        if (actions && actions.length > 0) {
          await tx.imdadRecallAction.createMany({
            data: actions.map((action) => ({
              tenantId,
              organizationId: headerData.organizationId,
              recallId: header.id,
              actionNumber: action.actionNumber,
              actionType: action.actionType,
              description: action.description,
              locationId: action.locationId,
              assignedTo: action.assignedTo,
              status: 'PENDING',
            })) as any,
          });
        }

        return tx.imdadRecall.findFirst({
          where: { id: header.id },
          include: { actions: true } as any,
        });
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'RECALL',
        resourceId: recall!.id,
        boundedContext: 'BC6_QUALITY',
        newData: recall as any,
        request: req,
      });

      return NextResponse.json({ data: recall }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.recall.create' }
);
