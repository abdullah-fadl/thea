/**
 * SCM BC5 Clinical — Patient Charges
 *
 * GET  /api/imdad/clinical/charges — List patient charges with pagination, search, filters
 * POST /api/imdad/clinical/charges — Create patient charge
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
const Decimal = Prisma.Decimal;

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List patient charges
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  patientId: z.string().uuid().optional(),
  encounterId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  itemId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, patientId, encounterId, departmentId, itemId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (patientId) where.patientId = patientId;
      if (encounterId) where.encounterId = encounterId;
      if (departmentId) where.departmentId = departmentId;
      if (itemId) where.itemId = itemId;
      if (search) {
        where.OR = [
          { chargeNumber: { contains: search, mode: 'insensitive' } },
          { patientMrn: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadPatientCharge.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadPatientCharge.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.charges.list' }
);

// ---------------------------------------------------------------------------
// POST — Create patient charge
// ---------------------------------------------------------------------------

const createChargeSchema = z.object({
  organizationId: z.string().uuid(),
  chargeNumber: z.string().min(1).max(50),
  patientId: z.string().uuid(),
  itemId: z.string().uuid(),
  itemCode: z.string().min(1),
  itemName: z.string().min(1),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1),
  unitPrice: z.string().or(z.number()),
  totalAmount: z.string().or(z.number()),
  netAmount: z.string().or(z.number()),
  departmentId: z.string().uuid(),
  chargedBy: z.string().uuid(),
  patientMrn: z.string().optional(),
  patientName: z.string().optional(),
  encounterId: z.string().uuid().optional(),
  discountAmount: z.string().or(z.number()).optional(),
  taxAmount: z.string().or(z.number()).optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createChargeSchema.parse(body);

      // Duplicate check: chargeNumber must be unique within tenant+org
      const existing = await prisma.imdadPatientCharge.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, chargeNumber: parsed.chargeNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Patient charge with this number already exists' }, { status: 409 });
      }

      const patientCharge = await prisma.imdadPatientCharge.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          chargeNumber: parsed.chargeNumber,
          patientId: parsed.patientId,
          patientMrn: parsed.patientMrn,
          patientName: parsed.patientName,
          encounterId: parsed.encounterId,
          itemId: parsed.itemId,
          itemCode: parsed.itemCode,
          itemName: parsed.itemName,
          quantity: parsed.quantity,
          unitOfMeasure: parsed.unitOfMeasure,
          unitPrice: new Decimal(String(parsed.unitPrice)),
          totalAmount: new Decimal(String(parsed.totalAmount)),
          discountAmount: parsed.discountAmount ? new Decimal(String(parsed.discountAmount)) : undefined,
          // taxAmount not in model
          netAmount: new Decimal(String(parsed.netAmount)),
          departmentId: parsed.departmentId,
          chargedBy: parsed.chargedBy,
          status: 'PENDING',
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
        resourceType: 'PATIENT_CHARGE',
        resourceId: patientCharge.id,
        boundedContext: 'BC5_CLINICAL',
        newData: patientCharge as any,
        request: req,
      });

      return NextResponse.json({ data: patientCharge }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.charges.create' }
);
