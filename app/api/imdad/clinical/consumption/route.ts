/**
 * SCM BC5 Clinical — Consumption Logs (Append-Only)
 *
 * GET  /api/imdad/clinical/consumption — List consumption logs with pagination, search, filters
 * POST /api/imdad/clinical/consumption — Create consumption log entry
 *
 * NOTE: This is an APPEND-ONLY resource. No PUT, PATCH, or DELETE operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List consumption logs
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
  consumptionType: z.string().optional(),
  patientId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, departmentId, itemId, consumptionType, patientId, dateFrom, dateTo } = parsed;

      const where: any = { tenantId };
      if (organizationId) where.organizationId = organizationId;
      if (departmentId) where.departmentId = departmentId;
      if (itemId) where.itemId = itemId;
      if (consumptionType) where.consumptionType = consumptionType;
      if (patientId) where.patientId = patientId;
      if (dateFrom || dateTo) {
        where.consumedAt = {};
        if (dateFrom) where.consumedAt.gte = new Date(dateFrom);
        if (dateTo) where.consumedAt.lte = new Date(dateTo);
      }
      if (search) {
        where.OR = [
          { itemName: { contains: search, mode: 'insensitive' } },
          { itemCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadConsumptionLog.findMany({
          where,
          orderBy: { consumedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadConsumptionLog.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.consumption.list' }
);

// ---------------------------------------------------------------------------
// POST — Create consumption log entry (append-only)
// ---------------------------------------------------------------------------

const createConsumptionSchema = z.object({
  organizationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  locationId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  consumptionType: z.string().min(1),
  consumedBy: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  patientMrn: z.string().optional(),
  patientName: z.string().optional(),
  encounterId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createConsumptionSchema.parse(body);

      const consumptionLog = await prisma.imdadConsumptionLog.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          departmentId: parsed.departmentId,
          locationId: parsed.locationId,
          itemId: parsed.itemId,
          itemCode: parsed.itemCode,
          itemName: parsed.itemName,
          quantity: parsed.quantity,
          unitOfMeasure: parsed.unitOfMeasure,
          consumptionType: parsed.consumptionType,
          consumedBy: parsed.consumedBy,
          consumedAt: new Date(),
          patientId: parsed.patientId,
          encounterId: parsed.encounterId,
          batchLotId: parsed.batchNumber ? undefined : undefined,
          notes: parsed.notes,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'CONSUMPTION_LOG',
        resourceId: consumptionLog.id,
        boundedContext: 'BC5_CLINICAL',
        newData: consumptionLog as any,
        request: req,
      });

      return NextResponse.json({ data: consumptionLog }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.consumption.create' }
);
