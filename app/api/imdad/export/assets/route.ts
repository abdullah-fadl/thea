/**
 * SCM Export — Asset Register
 *
 * GET /api/imdad/export/assets — Export asset register
 *
 * Query params:
 *   organizationId (required)  — UUID of the organization
 *   format                     — "json" | "csv" (default: "json")
 *   status                     — filter by asset status
 *   category                   — filter by assetCategory
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import {
  exportToJson,
  exportToCsv,
  formatDateCell,
  formatDecimalCell,
  type ExportColumn,
} from '@/lib/imdad/export';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 10_000;

const querySchema = z.object({
  organizationId: z.string().uuid('organizationId must be a valid UUID'),
  format: z.enum(['json', 'csv']).default('json'),
  status: z.string().optional(),
  category: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Column definitions for CSV
// ---------------------------------------------------------------------------

const CSV_COLUMNS: ExportColumn[] = [
  { key: 'id', header: 'ID' },
  { key: 'assetTag', header: 'Asset Tag' },
  { key: 'assetName', header: 'Asset Name' },
  { key: 'assetNameAr', header: 'Asset Name (AR)' },
  { key: 'assetCategory', header: 'Category' },
  { key: 'assetSubCategory', header: 'Sub Category' },
  { key: 'status', header: 'Status' },
  { key: 'serialNumber', header: 'Serial Number' },
  { key: 'barcode', header: 'Barcode' },
  { key: 'modelNumber', header: 'Model Number' },
  { key: 'manufacturer', header: 'Manufacturer' },
  { key: 'brand', header: 'Brand' },
  { key: 'vendorName', header: 'Vendor' },
  // Location
  { key: 'buildingFloor', header: 'Building / Floor' },
  { key: 'roomNumber', header: 'Room' },
  // Procurement
  { key: 'purchaseDate', header: 'Purchase Date', transform: formatDateCell },
  { key: 'purchaseCost', header: 'Purchase Cost', transform: (v) => formatDecimalCell(v) },
  { key: 'warrantyStartDate', header: 'Warranty Start', transform: formatDateCell },
  { key: 'warrantyEndDate', header: 'Warranty End', transform: formatDateCell },
  { key: 'warrantyProvider', header: 'Warranty Provider' },
  // Lifecycle
  { key: 'commissionDate', header: 'Commission Date', transform: formatDateCell },
  { key: 'expectedLifeYears', header: 'Expected Life (Years)' },
  { key: 'decommissionDate', header: 'Decommission Date', transform: formatDateCell },
  // Depreciation
  { key: 'depreciationMethod', header: 'Depreciation Method' },
  { key: 'salvageValue', header: 'Salvage Value', transform: (v) => formatDecimalCell(v) },
  { key: 'currentBookValue', header: 'Book Value', transform: (v) => formatDecimalCell(v) },
  // Maintenance
  { key: 'maintenanceFrequencyDays', header: 'Maintenance Freq (Days)' },
  { key: 'lastMaintenanceDate', header: 'Last Maintenance', transform: formatDateCell },
  { key: 'nextMaintenanceDate', header: 'Next Maintenance', transform: formatDateCell },
  { key: 'calibrationFrequencyDays', header: 'Calibration Freq (Days)' },
  { key: 'lastCalibrationDate', header: 'Last Calibration', transform: formatDateCell },
  { key: 'nextCalibrationDate', header: 'Next Calibration', transform: formatDateCell },
  // Risk
  { key: 'criticalityLevel', header: 'Criticality' },
  { key: 'riskClassification', header: 'Risk Classification' },
  // Custodian
  { key: 'custodianName', header: 'Custodian' },
  { key: 'notes', header: 'Notes' },
  { key: 'createdAt', header: 'Created At', transform: formatDateCell },
  { key: 'updatedAt', header: 'Updated At', transform: formatDateCell },
];

// ---------------------------------------------------------------------------
// GET — Export asset register
// ---------------------------------------------------------------------------

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    try {
      const url = new URL(req.url);
      const params: Record<string, string> = {};
      url.searchParams.forEach((v, k) => {
        params[k] = v;
      });

      const parsed = querySchema.parse(params);
      const { organizationId, format, status, category } = parsed;

      const where: any = {
        tenantId,
        organizationId,
        isDeleted: false,
      };
      if (status) where.status = status;
      if (category) where.assetCategory = category;

      // Enforce row limit
      const total = await prisma.imdadAsset.count({ where });
      if (total > MAX_ROWS) {
        return NextResponse.json(
          {
            error: `Export limited to ${MAX_ROWS.toLocaleString()} rows. Found ${total.toLocaleString()} assets. Please apply status or category filters to reduce the result set.`,
          },
          { status: 400 },
        );
      }

      const assets = await prisma.imdadAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MAX_ROWS,
      });

      // -- JSON -----------------------------------------------------------------
      if (format === 'json') {
        const body = exportToJson(assets);
        return new NextResponse(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="asset-register-${organizationId}.json"`,
          },
        });
      }

      // -- CSV ------------------------------------------------------------------
      const body = exportToCsv(assets, CSV_COLUMNS);
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="asset-register-${organizationId}.csv"`,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation Error', fields: error.issues.map((i: any) => ({ path: i.path, message: i.message })) },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
  },
  { platformKey: 'imdad', permissionKey: 'imdad.assets.register.list' },
);
