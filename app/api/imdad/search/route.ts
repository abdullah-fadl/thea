/**
 * SCM Global Search — Unified search across all SCM modules
 *
 * GET /api/imdad/search?q=<term>&type=<optional filter>
 *
 * Searches concurrently across: Items, Vendors, Purchase Orders, Assets, Warehouses.
 * Returns unified results grouped by category, max 10 per category, 30 total.
 * Uses raw SQL for maximum reliability with 1.7M+ items.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  url: string;
}

const MAX_PER_CATEGORY = 10;

export const GET = withAuthTenant(
  async (req, { tenantId }) => {
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim() || '';

    if (q.length < 1) {
      return NextResponse.json({ results: [], total: 0, query: q });
    }

    const pattern = `%${q}%`;
    const results: SearchResult[] = [];

    // NOTE: Prisma v7 PrismaPg adapter has issues with parameterized LIMIT,
    // so we inline the safe integer LIMIT value directly in the SQL string.
    const LIM = MAX_PER_CATEGORY;

    try {
      // Search items (1.7M+ rows — use ILIKE with LIMIT for speed)
      const items: any[] = await prisma.$queryRaw(
        Prisma.sql`SELECT id, code, barcode, name, "nameAr", "itemType"::text as "itemType",
                manufacturer, "genericName", description
         FROM imdad_item_masters
         WHERE "tenantId" = ${tenantId} AND "isDeleted" = false
           AND (name ILIKE ${pattern} OR "nameAr" ILIKE ${pattern} OR code ILIKE ${pattern}
                OR barcode ILIKE ${pattern} OR manufacturer ILIKE ${pattern} OR "genericName" ILIKE ${pattern})
         ORDER BY name ASC
         LIMIT ${MAX_PER_CATEGORY}`
      );
      for (const item of items) {
        // Build a rich subtitle: code | manufacturer | type | barcode
        const parts = [item.code];
        if (item.manufacturer) parts.push(item.manufacturer);
        parts.push(item.itemType?.replace(/_/g, ' '));
        if (item.barcode) parts.push(`BC: ${item.barcode}`);
        results.push({
          type: 'items',
          id: item.id,
          title: item.genericName && item.genericName !== item.name
            ? `${item.name} — ${item.genericName}`
            : item.name,
          subtitle: parts.join(' | '),
          icon: 'Package',
          url: `/imdad/inventory/items?selected=${item.id}`,
        });
      }
    } catch (err: any) {
      console.error('[IMDAD Search] items error:', err.message);
    }

    try {
      // Search vendors
      const vendors: any[] = await prisma.$queryRaw(
        Prisma.sql`SELECT id, code, name, "nameAr", type::text as type, "contactEmail", "contactPhone", city
         FROM imdad_vendors
         WHERE "tenantId" = ${tenantId} AND "isDeleted" = false
           AND (name ILIKE ${pattern} OR "nameAr" ILIKE ${pattern} OR code ILIKE ${pattern})
         ORDER BY name ASC
         LIMIT ${MAX_PER_CATEGORY}`
      );
      for (const v of vendors) {
        const parts = [v.code, v.type?.replace(/_/g, ' ')];
        if (v.city) parts.push(v.city);
        if (v.contactEmail) parts.push(v.contactEmail);
        results.push({
          type: 'vendors',
          id: v.id,
          title: v.name,
          subtitle: parts.join(' | '),
          icon: 'Users',
          url: `/imdad/procurement/vendors?selected=${v.id}`,
        });
      }
    } catch (err: any) {
      console.error('[IMDAD Search] vendors error:', err.message);
    }

    try {
      // Search purchase orders
      const pos: any[] = await prisma.$queryRaw(
        Prisma.sql`SELECT po.id, po."poNumber", po.status::text as status, po."totalAmount"::text as "totalAmount", v.name as "vendorName"
         FROM imdad_purchase_orders po
         LEFT JOIN imdad_vendors v ON po."vendorId" = v.id
         WHERE po."tenantId" = ${tenantId} AND po."isDeleted" = false
           AND po."poNumber" ILIKE ${pattern}
         ORDER BY po."createdAt" DESC
         LIMIT ${MAX_PER_CATEGORY}`
      );
      for (const po of pos) {
        results.push({
          type: 'purchase-orders',
          id: po.id,
          title: po.poNumber,
          subtitle: `${po.status} — ${po.vendorName || ''}`,
          icon: 'FileText',
          url: `/imdad/procurement/purchase-orders?selected=${po.id}`,
        });
      }
    } catch (err: any) {
      console.error('[IMDAD Search] purchase-orders error:', err.message);
    }

    try {
      // Search assets
      const assets: any[] = await prisma.$queryRaw(
        Prisma.sql`SELECT id, "assetTag", "assetName", "assetNameAr", "assetCategory",
                manufacturer, "modelNumber", "serialNumber", barcode
         FROM imdad_assets
         WHERE "tenantId" = ${tenantId} AND "isDeleted" = false
           AND ("assetName" ILIKE ${pattern} OR "assetNameAr" ILIKE ${pattern} OR "assetTag" ILIKE ${pattern}
                OR "serialNumber" ILIKE ${pattern} OR manufacturer ILIKE ${pattern} OR barcode ILIKE ${pattern})
         ORDER BY "assetName" ASC
         LIMIT ${MAX_PER_CATEGORY}`
      );
      for (const a of assets) {
        const parts = [a.assetTag, a.assetCategory];
        if (a.manufacturer) parts.push(a.manufacturer);
        if (a.modelNumber) parts.push(a.modelNumber);
        if (a.serialNumber) parts.push(`S/N: ${a.serialNumber}`);
        if (a.barcode) parts.push(`BC: ${a.barcode}`);
        results.push({
          type: 'assets',
          id: a.id,
          title: a.assetName,
          subtitle: parts.join(' | '),
          icon: 'HardDrive',
          url: `/imdad/assets/register?selected=${a.id}`,
        });
      }
    } catch (err: any) {
      console.error('[IMDAD Search] assets error:', err.message);
    }

    try {
      // Search warehouses
      const warehouses: any[] = await prisma.$queryRaw(
        Prisma.sql`SELECT id, "warehouseCode", "warehouseName", "warehouseNameAr", "facilityType"::text as "facilityType"
         FROM imdad_warehouses
         WHERE "tenantId" = ${tenantId} AND "isDeleted" = false
           AND ("warehouseName" ILIKE ${pattern} OR "warehouseNameAr" ILIKE ${pattern} OR "warehouseCode" ILIKE ${pattern})
         ORDER BY "warehouseName" ASC
         LIMIT ${MAX_PER_CATEGORY}`
      );
      for (const w of warehouses) {
        results.push({
          type: 'warehouses',
          id: w.id,
          title: w.warehouseName,
          subtitle: `${w.warehouseCode} — ${w.facilityType}`,
          icon: 'Warehouse',
          url: `/imdad/warehouse/warehouses?selected=${w.id}`,
        });
      }
    } catch (err: any) {
      console.error('[IMDAD Search] warehouses error:', err.message);
    }

    return NextResponse.json({
      results: results.slice(0, 30),
      total: results.length,
      query: q,
    });
  },
  { platformKey: 'imdad', permissionKey: 'imdad.dashboard.view' }
);
