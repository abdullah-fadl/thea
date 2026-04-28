/**
 * SCM BC5 Clinical — Patient Returns
 *
 * GET  /api/imdad/clinical/returns — List patient returns with pagination, search, filters
 * POST /api/imdad/clinical/returns — Create patient return
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { stockMutate } from '@/lib/imdad/stockMutate';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List patient returns
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  reason: z.string().optional(),
  patientId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  dispenseRequestId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, reason, patientId, departmentId, dispenseRequestId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (reason) where.reason = reason;
      if (patientId) where.patientId = patientId;
      if (departmentId) where.departmentId = departmentId;
      if (dispenseRequestId) where.dispenseRequestId = dispenseRequestId;
      if (search) {
        where.OR = [
          { returnNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadPatientReturn.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadPatientReturn.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.returns.list' }
);

// ---------------------------------------------------------------------------
// POST — Create patient return
// ---------------------------------------------------------------------------

const createReturnSchema = z.object({
  organizationId: z.string().uuid(),
  returnNumber: z.string().min(1).max(50),
  reason: z.string().min(1),
  departmentId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  returnedBy: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  patientMrn: z.string().optional(),
  patientName: z.string().optional(),
  encounterId: z.string().uuid().optional(),
  dispenseRequestId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  lotNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createReturnSchema.parse(body);

      // Duplicate check: returnNumber must be unique within tenant+org
      const existing = await prisma.imdadPatientReturn.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, returnNumber: parsed.returnNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Patient return with this number already exists' }, { status: 409 });
      }

      const patientReturn = await prisma.imdadPatientReturn.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          returnNumber: parsed.returnNumber,
          reason: parsed.reason as any,
          departmentId: parsed.departmentId,
          itemId: parsed.itemId,
          itemCode: parsed.itemCode,
          itemName: parsed.itemName,
          quantity: parsed.quantity,
          unitOfMeasure: parsed.unitOfMeasure,
          returnedBy: parsed.returnedBy,
          patientId: parsed.patientId,
          patientMrn: parsed.patientMrn,
          patientName: parsed.patientName,
          dispenseRequestId: parsed.dispenseRequestId,
          batchNumber: parsed.batchNumber,
          notes: parsed.notes,
          createdBy: userId,
          updatedBy: userId,
        } as any,
      });

      // Credit returned stock back to inventory
      const locationId = (parsed as any).locationId || parsed.departmentId;
      if (locationId && parsed.itemId && parsed.quantity > 0) {
        const stockResult = await stockMutate({
          tenantId,
          organizationId: parsed.organizationId,
          itemId: parsed.itemId,
          locationId,
          delta: Math.round(parsed.quantity),
          reason: `Patient return — ${parsed.returnNumber}`,
          userId,
          referenceType: 'patient_return',
          referenceId: patientReturn.id,
          batchNumber: parsed.batchNumber || undefined,
        });

        if (!stockResult.success) {
          console.error('[Clinical Returns] Stock credit failed:', stockResult.error);
        }
      }

      await imdadAudit.log({
        tenantId,
        organizationId: parsed.organizationId,
        actorUserId: userId,
        actorRole: role,
        action: 'CREATE',
        resourceType: 'PATIENT_RETURN',
        resourceId: patientReturn.id,
        boundedContext: 'BC5_CLINICAL',
        newData: patientReturn as any,
        request: req,
      });

      return NextResponse.json({ data: patientReturn }, { status: 201 });
    } catch (error) {
      console.error('[Clinical Returns POST] Error:', error);
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.returns.create' }
);
