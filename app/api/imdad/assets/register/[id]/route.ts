/**
 * SCM BC7 Asset Management — Single Asset
 *
 * GET    /api/imdad/assets/register/:id — Get asset detail
 * PUT    /api/imdad/assets/register/:id — Update asset (optimistic locking)
 * DELETE /api/imdad/assets/register/:id — Soft delete asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { imdadAudit } from '@/lib/imdad/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET — Single asset detail
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;

      const asset = await prisma.imdadAsset.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!asset) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      return NextResponse.json({ data: asset });
    } catch (error) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.register.view' }
);

// ---------------------------------------------------------------------------
// PUT — Update asset with optimistic locking
// ---------------------------------------------------------------------------

const updateAssetSchema = z.object({
  version: z.number().int(),
  assetName: z.string().min(1).max(200).optional(),
  assetNameAr: z.string().optional(),
  assetCategory: z.string().optional(),
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
  status: z.string().optional(),
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

export const PUT = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = updateAssetSchema.parse(body);

      const {
        version, purchaseDate, warrantyStartDate, warrantyEndDate,
        commissionDate, decommissionDate,
        lastMaintenanceDate, nextMaintenanceDate,
        lastCalibrationDate, nextCalibrationDate,
        purchaseCost, salvageValue, currentBookValue,
        ...updates
      } = parsed;

      const existing = await prisma.imdadAsset.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      if (existing.version !== version) {
        return NextResponse.json(
          { error: 'Conflict — asset was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const asset = await prisma.imdadAsset.update({
        where: { id },
        data: {
          ...updates,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          warrantyStartDate: warrantyStartDate ? new Date(warrantyStartDate) : undefined,
          warrantyEndDate: warrantyEndDate ? new Date(warrantyEndDate) : undefined,
          commissionDate: commissionDate ? new Date(commissionDate) : undefined,
          decommissionDate: decommissionDate ? new Date(decommissionDate) : undefined,
          lastMaintenanceDate: lastMaintenanceDate ? new Date(lastMaintenanceDate) : undefined,
          nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : undefined,
          lastCalibrationDate: lastCalibrationDate ? new Date(lastCalibrationDate) : undefined,
          nextCalibrationDate: nextCalibrationDate ? new Date(nextCalibrationDate) : undefined,
          purchaseCost: purchaseCost ? purchaseCost : undefined,
          salvageValue: salvageValue || undefined,
          currentBookValue: currentBookValue || undefined,
          version: { increment: 1 },
          updatedBy: userId,
        } as any,
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'UPDATE',
        resourceType: 'ASSET',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: existing as any,
        newData: asset as any,
        request: req,
      });

      return NextResponse.json({ data: asset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.register.update' }
);

// ---------------------------------------------------------------------------
// DELETE — Soft delete asset
// ---------------------------------------------------------------------------

const deleteAssetSchema = z.object({
  version: z.number().int(),
});

export const DELETE = withAuthTenant(
  async (req, { tenantId, userId, role }) => {
    try {
      const id = req.nextUrl.pathname.split('/').pop()!;
      const body = await req.json();
      const parsed = deleteAssetSchema.parse(body);

      const existing = await prisma.imdadAsset.findFirst({
        where: { id, tenantId, isDeleted: false },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      if (existing.version !== parsed.version) {
        return NextResponse.json(
          { error: 'Conflict — asset was modified by another user. Please refresh and try again.' },
          { status: 409 }
        );
      }

      const asset = await prisma.imdadAsset.update({
        where: { id },
        data: {
          isDeleted: true,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });

      await imdadAudit.log({
        tenantId,
        organizationId: existing.organizationId || undefined,
        actorUserId: userId,
        actorRole: role,
        action: 'DELETE',
        resourceType: 'ASSET',
        resourceId: id,
        boundedContext: 'BC7_ASSETS',
        previousData: existing as any,
        request: req,
      });

      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) }, { status: 400 });
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.register.update' }
);
