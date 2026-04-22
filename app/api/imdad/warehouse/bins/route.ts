/**
 * SCM BC2 Warehouse — Bins
 *
 * GET  /api/imdad/warehouse/bins  — List bins with pagination, search, filters
 * POST /api/imdad/warehouse/bins  — Create a new bin
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';

// ---------------------------------------------------------------------------
// GET — List ImdadBin
// ---------------------------------------------------------------------------
export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const search = url.searchParams.get('search')?.trim() || '';
    const zoneId = url.searchParams.get('zoneId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const currentItemId = url.searchParams.get('currentItemId') || undefined;

    const where: any = { tenantId, isDeleted: false };

    if (zoneId) where.zoneId = zoneId;
    if (status) where.status = status;
    if (currentItemId) where.currentItemId = currentItemId;

    if (search) {
      where.OR = [
        { binCode: { contains: search, mode: 'insensitive' } },
        { binLabel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.imdadBin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.imdadBin.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.view' }
);

// ---------------------------------------------------------------------------
// POST — Create ImdadBin
// ---------------------------------------------------------------------------
const createBinSchema = z.object({
  zoneId: z.string().min(1, 'zoneId is required'),
  binCode: z.string().min(1, 'binCode is required'),
  organizationId: z.string().min(1, 'organizationId is required'),
  binLabel: z.string().optional(),
  binLabelAr: z.string().optional(),
  aisle: z.string().optional(),
  rack: z.string().optional(),
  shelf: z.string().optional(),
  position: z.string().optional(),
  barcode: z.string().optional(),
  widthCm: z.number().optional(),
  heightCm: z.number().optional(),
  depthCm: z.number().optional(),
  maxWeightKg: z.number().optional(),
  status: z.string().optional(),
  isMixedItem: z.boolean().optional(),
  cycleCountFrequency: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId }) => {
    const body = await req.json();
    const parsed = createBinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate binCode within tenant + zone
    const existing = await prisma.imdadBin.findFirst({
      where: {
        tenantId,
        zoneId: data.zoneId,
        binCode: data.binCode,
        isDeleted: false,
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Bin with this code already exists in this zone' },
        { status: 409 }
      );
    }

    const bin = await prisma.imdadBin.create({
      data: {
        tenantId,
        organizationId: data.organizationId,
        zoneId: data.zoneId,
        binCode: data.binCode,
        binLabel: data.binLabel,
        binLabelAr: data.binLabelAr,
        aisle: data.aisle,
        rack: data.rack,
        shelf: data.shelf,
        position: data.position,
        barcode: data.barcode,
        widthCm: data.widthCm,
        heightCm: data.heightCm,
        depthCm: data.depthCm,
        maxWeightKg: data.maxWeightKg,
        status: (data.status as any) ?? 'AVAILABLE',
        isMixedItem: data.isMixedItem ?? false,
        cycleCountFrequency: data.cycleCountFrequency as any,
        metadata: data.metadata ?? undefined,
        createdBy: userId,
      } as any,
    });

    await imdadAudit.log({
      tenantId,
      organizationId: data.organizationId,
      actorUserId: userId,
      action: 'CREATE',
      resourceType: 'BIN',
      resourceId: bin.id,
      boundedContext: 'BC2_WAREHOUSE',
      newData: bin as any,
      request: req,
    });

    return NextResponse.json({ data: bin }, { status: 201 });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.warehouse.create' }
);
