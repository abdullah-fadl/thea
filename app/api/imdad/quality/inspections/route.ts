/**
 * SCM BC6 Quality — Quality Inspections
 *
 * GET  /api/imdad/quality/inspections — List inspections with pagination, search, filters
 * POST /api/imdad/quality/inspections — Create inspection with optional checklist items
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List quality inspections
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  inspectionType: z.string().optional(),
  itemId: z.string().uuid().optional(),
  batchLotId: z.string().uuid().optional(),
  referenceType: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, inspectionType, itemId, batchLotId, referenceType } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (inspectionType) where.inspectionType = inspectionType;
      if (itemId) where.itemId = itemId;
      if (batchLotId) where.batchLotId = batchLotId;
      if (referenceType) where.referenceType = referenceType;
      if (search) {
        where.OR = [
          { inspectionNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadQualityInspection.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadQualityInspection.count({ where }),
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
// POST — Create quality inspection with optional checklist items
// ---------------------------------------------------------------------------

const checklistItemSchema = z.object({
  checkNumber: z.number().int().min(1),
  checkName: z.string().min(1),
  checkCategory: z.string().optional(),
  specification: z.string().optional(),
  tolerance: z.string().optional(),
});

const createInspectionSchema = z.object({
  organizationId: z.string().uuid(),
  inspectionNumber: z.string().min(1).max(50),
  inspectionType: z.string().min(1),
  referenceType: z.string().min(1),
  referenceId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  itemCode: z.string().optional(),
  itemName: z.string().optional(),
  batchLotId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  scheduledDate: z.string().optional(),
  inspectorId: z.string().uuid().optional(),
  notes: z.string().optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createInspectionSchema.parse(body);

      const { checklistItems, ...headerData } = parsed;

      // Duplicate check: inspectionNumber must be unique within tenant+org
      const existing = await prisma.imdadQualityInspection.findFirst({
        where: { tenantId, organizationId: headerData.organizationId, inspectionNumber: headerData.inspectionNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Inspection with this number already exists' }, { status: 409 });
      }

      const inspection = await prisma.$transaction(async (tx) => {
        const header = await tx.imdadQualityInspection.create({
          data: {
            tenantId,
            organizationId: headerData.organizationId,
            inspectionNumber: headerData.inspectionNumber,
            inspectionType: headerData.inspectionType as any,
            referenceType: headerData.referenceType,
            referenceId: headerData.referenceId,
            itemId: headerData.itemId,
            itemCode: headerData.itemCode,
            itemName: headerData.itemName,
            batchLotId: headerData.batchLotId,
            batchNumber: headerData.batchNumber,
            scheduledDate: headerData.scheduledDate ? new Date(headerData.scheduledDate) : undefined,
            inspectorId: headerData.inspectorId,
            notes: headerData.notes,
            status: 'SCHEDULED' as any,
            createdBy: userId,
            updatedBy: userId,
          } as any,
        });

        if (checklistItems && checklistItems.length > 0) {
          await tx.imdadInspectionChecklist.createMany({
            data: checklistItems.map((item) => ({
              tenantId,
              organizationId: headerData.organizationId,
              inspectionId: header.id,
              checkNumber: item.checkNumber,
              checkName: item.checkName,
              checkCategory: item.checkCategory,
              specification: item.specification,
              tolerance: item.tolerance,
              result: 'PENDING',
            })) as any,
          });
        }

        return tx.imdadQualityInspection.findFirst({
          where: { id: header.id },
          include: { checklistItems: true } as any,
        });
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'QUALITY_INSPECTION',
        resourceId: inspection!.id,
        boundedContext: 'BC6_QUALITY',
        newData: inspection as any,
        request: req,
      });

      return NextResponse.json({ data: inspection }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.quality.create' }
);
