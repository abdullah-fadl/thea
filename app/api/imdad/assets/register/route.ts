/**
 * SCM BC7 Asset Management — Asset Register
 *
 * GET  /api/imdad/assets/register — List assets with pagination, search, filters
 * POST /api/imdad/assets/register — Create a new asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — List assets
// ---------------------------------------------------------------------------

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().optional(),
  assetCategory: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  criticalityLevel: z.string().optional(),
});

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });

      const parsed = listQuerySchema.parse(params);
      const { page, limit, search, organizationId, status, assetCategory, departmentId, vendorId, criticalityLevel } = parsed;

      const where: any = { tenantId, isDeleted: false };
      if (organizationId) where.organizationId = organizationId;
      if (status) where.status = status;
      if (assetCategory) where.assetCategory = assetCategory;
      if (departmentId) where.departmentId = departmentId;
      if (vendorId) where.vendorId = vendorId;
      if (criticalityLevel) where.criticalityLevel = criticalityLevel;
      if (search) {
        where.OR = [
          { assetTag: { contains: search, mode: 'insensitive' } },
          { assetName: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        prisma.imdadAsset.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.imdadAsset.count({ where }),
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
  { platformKey: 'imdad', permissionKey: 'imdad.assets.register.list' }
);

// ---------------------------------------------------------------------------
// POST — Create asset
// ---------------------------------------------------------------------------

const createAssetSchema = z.object({
  organizationId: z.string().uuid(),
  assetTag: z.string().min(1).max(50),
  assetName: z.string().min(1).max(200),
  assetNameAr: z.string().optional(),
  assetCategory: z.string().min(1),
  assetSubCategory: z.string().optional(),
  serialNumber: z.string().optional(),
  barcode: z.string().optional(),
  modelNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  brand: z.string().optional(),
  vendorId: z.string().uuid().optional(),
  vendorName: z.string().optional(),
  // Location
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  buildingFloor: z.string().optional(),
  roomNumber: z.string().optional(),
  // Procurement
  purchaseOrderId: z.string().uuid().optional(),
  purchaseDate: z.string().optional(),
  purchaseCost: z.string().optional(),
  warrantyStartDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  warrantyProvider: z.string().optional(),
  // Lifecycle
  commissionDate: z.string().optional(),
  expectedLifeYears: z.number().int().optional(),
  decommissionDate: z.string().optional(),
  // Depreciation
  depreciationMethod: z.string().optional(),
  salvageValue: z.string().optional(),
  currentBookValue: z.string().optional(),
  // Maintenance schedule
  maintenanceFrequencyDays: z.number().int().optional(),
  lastMaintenanceDate: z.string().optional(),
  nextMaintenanceDate: z.string().optional(),
  calibrationFrequencyDays: z.number().int().optional(),
  lastCalibrationDate: z.string().optional(),
  nextCalibrationDate: z.string().optional(),
  // Risk
  criticalityLevel: z.string().optional(),
  riskClassification: z.string().optional(),
  // Custodian
  custodianUserId: z.string().uuid().optional(),
  custodianName: z.string().optional(),
  notes: z.string().optional(),
});

export const POST = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const body = await req.json();
      const parsed = createAssetSchema.parse(body);

      // Duplicate check: assetTag must be unique within tenant+org
      const existing = await prisma.imdadAsset.findFirst({
        where: { tenantId, organizationId: parsed.organizationId, assetTag: parsed.assetTag, isDeleted: false },
      });
      if (existing) {
        return NextResponse.json({ error: 'Asset with this tag already exists' }, { status: 409 });
      }

      const {
        purchaseDate, warrantyStartDate, warrantyEndDate,
        commissionDate, decommissionDate, lastMaintenanceDate, nextMaintenanceDate,
        lastCalibrationDate, nextCalibrationDate, purchaseCost,
        salvageValue, currentBookValue, ...rest
      } = parsed;

      const asset = await prisma.imdadAsset.create({
        data: {
          tenantId,
          ...rest,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          warrantyStartDate: warrantyStartDate ? new Date(warrantyStartDate) : undefined,
          warrantyEndDate: warrantyEndDate ? new Date(warrantyEndDate) : undefined,
          commissionDate: commissionDate ? new Date(commissionDate) : undefined,
          decommissionDate: decommissionDate ? new Date(decommissionDate) : undefined,
          lastMaintenanceDate: lastMaintenanceDate ? new Date(lastMaintenanceDate) : undefined,
          nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : undefined,
          lastCalibrationDate: lastCalibrationDate ? new Date(lastCalibrationDate) : undefined,
          nextCalibrationDate: nextCalibrationDate ? new Date(nextCalibrationDate) : undefined,
          purchaseCost: purchaseCost || undefined,
          salvageValue: salvageValue || undefined,
          currentBookValue: currentBookValue || undefined,
          status: 'IN_SERVICE',
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
        resourceType: 'ASSET',
        resourceId: asset.id,
        boundedContext: 'BC7_ASSETS',
        newData: asset as any,
        request: req,
      });

      return NextResponse.json({ data: asset }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.register.create' }
);
