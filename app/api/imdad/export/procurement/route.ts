/**
 * SCM Export — Purchase Orders
 *
 * GET /api/imdad/export/procurement — Export purchase orders with line items
 *
 * Query params:
 *   organizationId (required)  — UUID of the organization
 *   format                     — "json" | "csv" (default: "json")
 *   status                     — filter by PO status
 *   dateFrom                   — ISO date string, inclusive lower bound on createdAt
 *   dateTo                     — ISO date string, inclusive upper bound on createdAt
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
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Column definitions for CSV — one row per PO line
// ---------------------------------------------------------------------------

const CSV_COLUMNS: ExportColumn[] = [
  // PO header fields
  { key: 'poId', header: 'PO ID' },
  { key: 'poNumber', header: 'PO Number' },
  { key: 'status', header: 'Status' },
  { key: 'vendorName', header: 'Vendor' },
  { key: 'vendorCode', header: 'Vendor Code' },
  { key: 'currency', header: 'Currency' },
  { key: 'subtotal', header: 'Subtotal', transform: (v) => formatDecimalCell(v) },
  { key: 'taxAmount', header: 'Tax', transform: (v) => formatDecimalCell(v) },
  { key: 'totalAmount', header: 'Total', transform: (v) => formatDecimalCell(v) },
  { key: 'paymentTerms', header: 'Payment Terms' },
  { key: 'shippingMethod', header: 'Shipping Method' },
  { key: 'expectedDeliveryDate', header: 'Expected Delivery', transform: formatDateCell },
  { key: 'poCreatedAt', header: 'PO Created', transform: formatDateCell },
  // Line fields
  { key: 'lineNumber', header: 'Line #' },
  { key: 'itemId', header: 'Item ID' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'unitCost', header: 'Unit Cost', transform: (v) => formatDecimalCell(v) },
  { key: 'lineTaxAmount', header: 'Line Tax', transform: (v) => formatDecimalCell(v) },
  { key: 'totalCost', header: 'Line Total', transform: (v) => formatDecimalCell(v) },
  { key: 'batchNumber', header: 'Batch Number' },
  { key: 'expiryDate', header: 'Expiry Date', transform: formatDateCell },
  { key: 'receivedQty', header: 'Received Qty' },
  { key: 'lineNotes', header: 'Line Notes' },
];

// ---------------------------------------------------------------------------
// GET — Export purchase orders
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
      const { organizationId, format, status, dateFrom, dateTo } = parsed;

      const where: any = {
        tenantId,
        organizationId,
        isDeleted: false,
      };
      if (status) where.status = status;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      // Check count first
      const total = await prisma.imdadPurchaseOrder.count({ where });
      if (total > MAX_ROWS) {
        return NextResponse.json(
          {
            error: `Export limited to ${MAX_ROWS.toLocaleString()} rows. Found ${total.toLocaleString()} POs. Please apply date or status filters to reduce the result set.`,
          },
          { status: 400 },
        );
      }

      const orders = await prisma.imdadPurchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: MAX_ROWS,
        include: {
          lines: true,
          vendor: { select: { id: true, name: true, code: true } },
        } as any,
      });

      // -- JSON -----------------------------------------------------------------
      if (format === 'json') {
        const body = exportToJson(orders);
        return new NextResponse(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="purchase-orders-${organizationId}.json"`,
          },
        });
      }

      // -- CSV — flatten PO + lines into one row per line -----------------------
      const flatRows: Record<string, any>[] = [];
      for (const po of orders) {
        const poBase = {
          poId: po.id,
          poNumber: po.poNumber,
          status: po.status,
          vendorName: (po as any).vendor?.name ?? '',
          vendorCode: (po as any).vendor?.code ?? '',
          currency: po.currency,
          subtotal: po.subtotal,
          taxAmount: po.taxAmount,
          totalAmount: po.totalAmount,
          paymentTerms: po.paymentTerms,
          shippingMethod: po.shippingMethod,
          expectedDeliveryDate: po.expectedDeliveryDate,
          poCreatedAt: po.createdAt,
        };

        if ((po as any).lines.length === 0) {
          // PO with no lines — still include the header row
          flatRows.push(poBase);
        } else {
          for (const line of (po as any).lines) {
            flatRows.push({
              ...poBase,
              lineNumber: line.lineNumber,
              itemId: line.itemId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              lineTaxAmount: line.taxAmount,
              totalCost: line.totalCost,
              batchNumber: line.batchNumber,
              expiryDate: line.expiryDate,
              receivedQty: line.receivedQty,
              lineNotes: line.notes,
            });
          }
        }
      }

      const body = exportToCsv(flatRows, CSV_COLUMNS);
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="purchase-orders-${organizationId}.csv"`,
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
  { platformKey: 'imdad', permissionKey: 'imdad.procurement.purchase-orders.list' },
);
