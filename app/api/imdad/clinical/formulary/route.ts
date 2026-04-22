/**
 * SCM BC5 Clinical — Formulary Items
 *
 * GET  /api/imdad/clinical/formulary — List formulary items with pagination, search, filters
 * POST /api/imdad/clinical/formulary — Create formulary item
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List formulary items
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  formularyStatus: z.string().optional(),
  therapeuticClass: z.string().optional(),
  isControlled: z.coerce.boolean().optional(),
  itemCode: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, formularyStatus, therapeuticClass, isControlled, itemCode } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (formularyStatus) where.formularyStatus = formularyStatus;
      if (therapeuticClass) where.therapeuticClass = therapeuticClass;
      if (isControlled !== undefined) where.isControlled = isControlled;
      if (itemCode) where.itemCode = itemCode;
      if (search) {
        where.OR = [
          { itemName: { contains: search, mode: 'insensitive' } },
          { genericName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadFormularyItem.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadFormularyItem.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.formulary.list' }
);

// ---------------------------------------------------------------------------
// POST — Create formulary item
// ---------------------------------------------------------------------------

const createFormularySchema = z.object({
  organizationId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemCode: z.string().min(1).max(50),
  itemName: z.string().min(1),
  genericName: z.string().optional(),
  genericNameAr: z.string().optional(),
  therapeuticClass: z.string().optional(),
  formularyCategory: z.string().optional(),
  formularyStatus: z.string().optional(),
  isControlled: z.boolean().optional(),
  controlSchedule: z.string().optional(),
  requiresApproval: z.boolean().optional(),
  approvalLevel: z.string().optional(),
  maxDailyDose: z.string().optional(),
  maxOrderQty: z.string().optional(),
  indications: z.string().optional(),
  indicationsAr: z.string().optional(),
  contraindications: z.string().optional(),
  sideEffects: z.string().optional(),
  interactions: z.string().optional(),
  storageInstructions: z.string().optional(),
  unitPrice: z.string().optional(),
  insuranceCovered: z.boolean().optional(),
  committeeApproval: z.boolean().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createFormularySchema.parse(body);

      // Duplicate check: itemId must be unique within tenant+org
      const existing = await prisma.imdadFormularyItem.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, itemId: parsed.itemId, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Formulary item for this item already exists in the organization' }, { status: 409 });
      }

      const { unitPrice, maxOrderQty, ...rest } = parsed;

      const formularyItem = await prisma.imdadFormularyItem.create({
        data: {
          tenantId,
          ...rest,
          formularyStatus: (parsed.formularyStatus || 'ACTIVE') as any,
          isControlled: parsed.isControlled ?? false,
          requiresApproval: parsed.requiresApproval ?? false,
          insuranceCovered: parsed.insuranceCovered ?? true,
          committeeApproval: parsed.committeeApproval ?? false,
          unitPrice: unitPrice || undefined,
          maxOrderQty: maxOrderQty || undefined,
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
        resourceType: 'FORMULARY_ITEM',
        resourceId: formularyItem.id,
        boundedContext: 'BC5_CLINICAL',
        newData: formularyItem as any,
        request: req,
      });

      return NextResponse.json({ data: formularyItem }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.formulary.create' }
);
