/**
 * SCM BC7 Asset Management — Maintenance Orders
 *
 * GET  /api/imdad/assets/maintenance — List maintenance orders with pagination, search, filters
 * POST /api/imdad/assets/maintenance — Create a new maintenance order
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List maintenance orders
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  maintenanceType: z.string().optional(),
  assetId: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  priority: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, maintenanceType, assetId, assignedTo, priority } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (maintenanceType) where.maintenanceType = maintenanceType;
      if (assetId) where.assetId = assetId;
      if (assignedTo) where.assignedTo = assignedTo;
      if (priority) where.priority = priority;
      if (search) {
        where.OR = [
          { orderNumber: { contains: search, mode: 'insensitive' } },
          { assetTag: { contains: search, mode: 'insensitive' } },
          { assetName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadMaintenanceOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadMaintenanceOrder.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.assets.maintenance.list' }
);

// ---------------------------------------------------------------------------
// POST — Create maintenance order
// ---------------------------------------------------------------------------

const createMaintenanceSchema = z.object({
  organizationId: z.string().uuid(),
  orderNumber: z.string().min(1).max(50),
  assetId: z.string().uuid(),
  assetTag: z.string().optional(),
  assetName: z.string().optional(),
  maintenanceType: z.string().min(1),
  priority: z.string().optional(),
  scheduledDate: z.string().min(1),
  description: z.string().min(1),
  descriptionAr: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  assignedTeam: z.string().optional(),
  externalVendorId: z.string().uuid().optional(),
  externalVendorName: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createMaintenanceSchema.parse(body);

      // Duplicate check: orderNumber must be unique within tenant+org
      const existing = await prisma.imdadMaintenanceOrder.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, orderNumber: parsed.orderNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Maintenance order with this number already exists' }, { status: 409 });
      }

      const { scheduledDate, ...rest } = parsed;

      const order = await prisma.imdadMaintenanceOrder.create({
        data: {
          tenantId,
          ...rest,
          scheduledDate: new Date(scheduledDate),
          status: 'SCHEDULED',
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
        resourceType: 'MAINTENANCE_ORDER',
        resourceId: order.id,
        boundedContext: 'BC7_ASSETS',
        newData: order as any,
        request: req,
      });

      return NextResponse.json({ data: order }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.maintenance.create' }
);
