/**
 * SCM Export — Inventory Items
 *
 * GET /api/imdad/export/inventory — Export item master data with stock levels
 *
 * Query params:
 *   organizationId (required)  — UUID of the organization
 *   format                     — "json" | "csv" (default: "json")
 *   status                     — filter by item status
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
});

// ---------------------------------------------------------------------------
// Column definitions for CSV
// ---------------------------------------------------------------------------

const CSV_COLUMNS: ExportColumn[] = [
  { key: 'id', header: 'ID' },
  { key: 'code', header: 'Code' },
  { key: 'barcode', header: 'Barcode' },
  { key: 'gtin', header: 'GTIN' },
  { key: 'name', header: 'Name' },
  { key: 'nameAr', header: 'Name (AR)' },
  { key: 'itemType', header: 'Item Type' },
  { key: 'categoryId', header: 'Category ID' },
  { key: 'subcategory', header: 'Sub Category' },
  { key: 'genericName', header: 'Generic Name' },
  { key: 'brandName', header: 'Brand Name' },
  { key: 'status', header: 'Status' },
  { key: 'standardCost', header: 'Standard Cost', transform: (v) => formatDecimalCell(v) },
  { key: 'lastPurchaseCost', header: 'Last Purchase Cost', transform: (v) => formatDecimalCell(v) },
  { key: 'weightedAvgCost', header: 'Weighted Avg Cost', transform: (v) => formatDecimalCell(v) },
  { key: 'requiresSerialTracking', header: 'Serial Tracked' },
  { key: 'requiresBatchTracking', header: 'Batch Tracked' },
  { key: 'requiresColdChain', header: 'Cold Chain Required' },
  { key: 'isCritical', header: 'Critical Item' },
  { key: 'isControlled', header: 'Controlled Substance' },
  { key: 'expiryTracked', header: 'Expiry Tracked' },
  { key: 'minShelfLifeDays', header: 'Min Shelf Life (Days)' },
  { key: 'manufacturer', header: 'Manufacturer' },
  { key: 'countryOfOrigin', header: 'Country of Origin' },
  { key: 'sfdaRegistration', header: 'SFDA Registration' },
  { key: 'formularyStatus', header: 'Formulary Status' },
  { key: 'abcClassification', header: 'ABC Classification' },
  { key: 'description', header: 'Description' },
  { key: 'createdAt', header: 'Created At', transform: formatDateCell },
  { key: 'updatedAt', header: 'Updated At', transform: formatDateCell },
];

// ---------------------------------------------------------------------------
// GET — Export inventory items
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
      const { organizationId, format, status } = parsed;

      const where: any = {
        tenantId,
        organizationId,
        isDeleted: false,
      };
      if (status) where.status = status;

      // Check count first to enforce limit
      const total = await prisma.imdadItemMaster.count({ where });
      if (total > MAX_ROWS) {
        return NextResponse.json(
          {
            error: `Export limited to ${MAX_ROWS.toLocaleString()} rows. Found ${total.toLocaleString()}. Please apply filters to reduce the result set.`,
          },
          { status: 400 },
        );
      }

      const items = await prisma.imdadItemMaster.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MAX_ROWS,
      });

      // -- JSON -----------------------------------------------------------------
      if (format === 'json') {
        const body = exportToJson(items);
        return new NextResponse(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="inventory-items-${organizationId}.json"`,
          },
        });
      }

      // -- CSV ------------------------------------------------------------------
      const body = exportToCsv(items, CSV_COLUMNS);
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="inventory-items-${organizationId}.csv"`,
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
  { platformKey: 'imdad', permissionKey: 'imdad.inventory.items.list' },
);
