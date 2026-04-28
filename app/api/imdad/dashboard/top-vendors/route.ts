/**
 * SCM Dashboard — Top Vendors
 *
 * GET /api/imdad/dashboard/top-vendors — Top 10 vendors by total PO value
 *
 * Uses raw SQL to bypass Prisma model/relation issues and query data directly.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

interface VendorRow {
  vendor_id: string;
  vendor_name: string;
  vendor_name_ar: string | null;
  total_value: string | number;
  po_count: string | number | bigint;
}

export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    try {
      const rows = await prisma.$queryRaw<VendorRow[]>(
        Prisma.sql`SELECT
           v.id AS vendor_id,
           v.name AS vendor_name,
           v."nameAr" AS vendor_name_ar,
           COALESCE(SUM(po."totalAmount"), 0)::text AS total_value,
           COUNT(po.id)::bigint AS po_count
         FROM imdad_purchase_orders po
         JOIN imdad_vendors v ON v.id = po."vendorId"
         WHERE po."tenantId" = ${tenantId}::uuid
           AND po."isDeleted" = false
           AND po.status NOT IN ('DRAFT', 'CANCELLED')
         GROUP BY v.id, v.name, v."nameAr"
         ORDER BY SUM(po."totalAmount") DESC
         LIMIT 10`
      );

      const data = rows.map((row) => ({
        vendorId: row.vendor_id,
        vendorName: row.vendor_name,
        vendorNameAr: row.vendor_name_ar ?? row.vendor_name,
        totalValue: Math.round(Number(row.total_value ?? 0)),
        poCount: Number(row.po_count ?? 0),
      }));

      return NextResponse.json({ data });
    } catch (err: any) {
      console.error('[IMDAD] top-vendors error:', err?.message || err);
      return NextResponse.json({
        data: [],
        _error: process.env.NODE_ENV === 'development' ? err?.message : undefined,
      });
    }
  },
  {
    tenantScoped: true,
    platformKey: 'imdad',
    permissionKey: 'imdad.dashboard.view',
  },
);
