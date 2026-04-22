/**
 * SCM Dashboard — Inventory by Category
 *
 * GET /api/imdad/dashboard/inventory-by-category — Inventory value grouped by item type
 *
 * Uses raw SQL to bypass Prisma model/relation issues and query data directly.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

interface CategoryRow {
  category: string;
  value: string | number;
  item_count: string | number | bigint;
}

const CATEGORY_AR: Record<string, string> = {
  PHARMACEUTICAL: 'أدوية',
  MEDICAL_SUPPLY: 'مستلزمات طبية',
  MEDICAL_DEVICE: 'أجهزة طبية',
  CONSUMABLE: 'مستهلكات',
  IMPLANT: 'غرسات',
  REAGENT: 'كواشف',
  GENERAL: 'عام',
  SURGICAL: 'جراحي',
  LABORATORY: 'مختبر',
  OFFICE: 'مكتبي',
  FOOD_SERVICE: 'خدمات غذائية',
  MAINTENANCE: 'صيانة',
  IT_EQUIPMENT: 'أجهزة تقنية',
  FURNITURE: 'أثاث',
  LINEN: 'ملابس ومفروشات',
  CLEANING: 'تنظيف',
};

export const GET = withAuthTenant(
  async (_req, { tenantId }) => {
    try {
      const rows = await prisma.$queryRaw<CategoryRow[]>(
        Prisma.sql`SELECT
           COALESCE(im."itemType"::text, 'GENERAL') AS category,
           COALESCE(SUM(il."currentStock" * COALESCE(im."standardCost", 0)), 0)::text AS value,
           COUNT(DISTINCT il.id)::bigint AS item_count
         FROM imdad_item_locations il
         JOIN imdad_item_masters im ON im.id = il."itemId"
         WHERE il."tenantId" = ${tenantId}::uuid
           AND il."isDeleted" = false
         GROUP BY im."itemType"
         ORDER BY value DESC`
      );

      const data = rows.map((row) => ({
        category: row.category,
        categoryAr: CATEGORY_AR[row.category] ?? row.category,
        value: Math.round(Number(row.value ?? 0)),
        itemCount: Number(row.item_count ?? 0),
      }));

      return NextResponse.json({ data });
    } catch (err: any) {
      console.error('[IMDAD] inventory-by-category error:', err?.message || err);
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
