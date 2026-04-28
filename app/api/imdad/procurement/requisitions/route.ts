/**
 * SCM BC3 Procurement — Purchase Requisitions
 *
 * GET  /api/imdad/procurement/requisitions — List PRs with filters
 * POST /api/imdad/procurement/requisitions — Create PR with lines
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List purchase requisitions
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  requestedBy: z.string().uuid().optional(),
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
      const { page, limit, status, departmentId, requestedBy, organizationId, startDate, endDate } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (departmentId) where.departmentId = departmentId;
      if (requestedBy) where.requestedBy = requestedBy;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [data, total] = await Promise.all([
        prisma.imdadPurchaseRequisition.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { lines: true } as any,
        }),
        prisma.imdadPurchaseRequisition.count({ where }),
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
// POST — Create purchase requisition
// ---------------------------------------------------------------------------

const prLineSchema = z.object({
  itemId: z.string().uuid(),
  itemCode: z.string().optional(),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  estimatedUnitPrice: z.number().nonnegative().optional(),
  specifications: z.string().optional(),
  notes: z.string().optional(),
});

const createPrSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  requiredDate: z.string().optional(),
  justification: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(prLineSchema).min(1, 'At least one line item is required'),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createPrSchema.parse(body);

      // Generate PR number: count existing PRs to ensure uniqueness
      const year = new Date().getFullYear();
      const prefix = 'PR-';
      const padLen = 6;

      // Count existing PRs for this tenant+year to find next available number
      const existingCount = await prisma.imdadPurchaseRequisition.count({
        where: {
          tenantId,
          prNumber: { startsWith: `${prefix}${year}-` },
        },
      });
      const nextValue = existingCount + 1;
      const prNumber = `${prefix}${year}-${String(nextValue).padStart(padLen, '0')}`;

      // Also update the sequence counter to stay in sync
      await prisma.imdadSequenceCounter.upsert({
        where: {
          tenantId_organizationId_sequenceType_fiscalYear: {
            tenantId,
            organizationId: parsed.organizationId,
            sequenceType: 'PR',
            fiscalYear: year,
          },
        },
        create: {
          tenantId,
          organizationId: parsed.organizationId,
          sequenceType: 'PR',
          prefix,
          currentValue: nextValue,
          fiscalYear: year,
        } as any,
        update: {
          currentValue: nextValue,
        },
      });

      const pr = await prisma.imdadPurchaseRequisition.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          prNumber,
          status: 'DRAFT' as any,
          departmentId: parsed.departmentId,
          requestedBy: userId,
          priority: parsed.priority,
          requiredDate: parsed.requiredDate ? new Date(parsed.requiredDate) : undefined,
          justification: parsed.justification,
          notes: parsed.notes,
          createdBy: userId,
          updatedBy: userId,
          lines: {
            create: parsed.lines.map((line, idx) => ({
              tenantId,
              organizationId: parsed.organizationId,
              lineNumber: idx + 1,
              itemId: line.itemId,
              quantity: line.quantity,
              estimatedUnitCost: line.estimatedUnitPrice,
              estimatedTotal: line.estimatedUnitPrice
                ? line.quantity * line.estimatedUnitPrice
                : undefined,
              notes: line.notes,
            })),
          },
        } as any,
        include: { lines: true } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'purchase_requisition',
        resourceId: pr.id,
        boundedContext: 'BC3_PROCUREMENT',
        newData: pr as any,
        request: req,
      });

      return NextResponse.json({ data: pr }, { status: 201 });
    } catch (error) {
      console.error('[Requisitions POST] Error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.pr.create' }
);
