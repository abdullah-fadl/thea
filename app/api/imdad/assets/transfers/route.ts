/**
 * SCM BC7 Asset Management — Asset Transfers
 *
 * GET  /api/imdad/assets/transfers — List transfers with pagination, search, filters
 * POST /api/imdad/assets/transfers — Create a new asset transfer request
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List transfers
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  fromDepartmentId: z.string().uuid().optional(),
  toDepartmentId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, fromDepartmentId, toDepartmentId, assetId } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (fromDepartmentId) where.fromDepartmentId = fromDepartmentId;
      if (toDepartmentId) where.toDepartmentId = toDepartmentId;
      if (assetId) where.assetId = assetId;
      if (search) {
        where.OR = [
          { transferNumber: { contains: search, mode: 'insensitive' } },
          { assetTag: { contains: search, mode: 'insensitive' } },
          { assetName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadAssetTransfer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadAssetTransfer.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.assets.transfers.list' }
);

// ---------------------------------------------------------------------------
// POST — Create asset transfer request
// ---------------------------------------------------------------------------

const createTransferSchema = z.object({
  organizationId: z.string().uuid(),
  transferNumber: z.string().min(1).max(50),
  assetId: z.string().uuid(),
  assetTag: z.string().min(1),
  assetName: z.string().min(1),
  fromDepartmentId: z.string().uuid(),
  fromDepartmentName: z.string().optional(),
  fromLocationId: z.string().uuid().optional(),
  toDepartmentId: z.string().uuid(),
  toDepartmentName: z.string().optional(),
  toLocationId: z.string().uuid().optional(),
  transferDate: z.string().min(1),
  reason: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedByUserId: z.string().uuid().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createTransferSchema.parse(body);

      // Duplicate check: transferNumber must be unique within tenant+org
      const existing = await prisma.imdadAssetTransfer.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, transferNumber: parsed.transferNumber, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Transfer with this number already exists' }, { status: 409 });
      }

      const { transferDate, priority: _priority, requestedByUserId, requestedBy, ...rest } = parsed;

      const transfer = await prisma.imdadAssetTransfer.create({
        data: {
          tenantId,
          ...rest,
          transferDate: new Date(transferDate),
          requestedBy: requestedByUserId || userId,
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
        resourceType: 'ASSET_TRANSFER',
        resourceId: transfer.id,
        boundedContext: 'BC7_ASSETS',
        newData: transfer as any,
        request: req,
      });

      return NextResponse.json({ data: transfer }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.transfers.create' }
);
