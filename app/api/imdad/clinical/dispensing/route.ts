/**
 * SCM BC5 Clinical — Dispense Requests
 *
 * GET  /api/imdad/clinical/dispensing — List dispense requests with pagination, search, filters
 * POST /api/imdad/clinical/dispensing — Create dispense request header
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List dispense requests (includes lines)
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  patientId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  priority: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, patientId, departmentId, orderId, priority } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (patientId) where.patientId = patientId;
      if (departmentId) where.departmentId = departmentId;
      if (orderId) where.orderId = orderId;
      if (priority) where.priority = priority;
      if (search) {
        where.OR = [
          { dispenseNumber: { contains: search, mode: 'insensitive' } },
          { patientMrn: { contains: search, mode: 'insensitive' } },
          { patientName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadDispenseRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { lines: true } as any,
        }),
        prisma.imdadDispenseRequest.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.dispensing.list' }
);

// ---------------------------------------------------------------------------
// POST — Create dispense request (header only)
// ---------------------------------------------------------------------------

const createDispenseSchema = z.object({
  organizationId: z.string().uuid(),
  dispenseNumber: z.string().min(1).max(50),
  orderType: z.string().min(1),
  departmentId: z.string().uuid(),
  patientId: z.string().uuid().optional(),
  patientMrn: z.string().optional(),
  patientName: z.string().optional(),
  encounterId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  priority: z.string().optional(),
  requestedBy: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createDispenseSchema.parse(body);

      // Duplicate check: dispenseNumber must be unique within tenant+org
      const existing = await prisma.imdadDispenseRequest.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, dispenseNumber: parsed.dispenseNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Dispense request with this number already exists' }, { status: 409 });
      }

      const dispenseRequest = await prisma.imdadDispenseRequest.create({
        data: {
          tenantId,
          organizationId: parsed.organizationId,
          dispenseNumber: parsed.dispenseNumber,
          orderType: parsed.orderType,
          departmentId: parsed.departmentId,
          patientId: parsed.patientId,
          patientMrn: parsed.patientMrn,
          patientName: parsed.patientName,
          orderId: parsed.orderId,
          priority: parsed.priority || 'ROUTINE',
          status: 'PENDING',
          notes: parsed.notes,
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
        resourceType: 'DISPENSE_REQUEST',
        resourceId: dispenseRequest.id,
        boundedContext: 'BC5_CLINICAL',
        newData: dispenseRequest as any,
        request: req,
      });

      return NextResponse.json({ data: dispenseRequest }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.clinical.dispensing.create' }
);
