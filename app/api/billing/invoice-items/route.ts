import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';
import { normalizeArabicNumerals } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CHARGE_ITEM_TYPES = new Set([
  'IMAGING',
  'LAB_TEST',
  'PROCEDURE',
  'MEDICATION',
  'SUPPLY',
  'BED',
  'SERVICE',
  'VISIT',
]);
const SERVICE_TYPES = new Set(['VISIT', 'BED_DAY', 'NURSING']);
const CATALOG_MAP: Record<string, string | string[]> = {
  all: 'all',
  services: 'services',
  imaging: 'IMAGING',
  lab: 'LAB_TEST',
  procedure: 'PROCEDURE',
  medication: 'MEDICATION',
  supply: 'SUPPLY',
};

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
    if (!canAccessBilling({ email: user?.email, tenantId, role })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const catalogType = String(
      req.nextUrl.searchParams.get('catalog') || req.nextUrl.searchParams.get('catalogType') || 'all'
    )
      .trim()
      .toLowerCase();
    const search = normalizeArabicNumerals(
      String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim()
    );
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '50'), 100);

    const items: any[] = [];
    const resolvedCatalog = CATALOG_MAP[catalogType] ?? 'all';

    // 1. Service catalog (VISIT, BED_DAY, NURSING - exclude CONSULTATION)
    // service_catalog has no Prisma model yet — use raw SQL
    if (resolvedCatalog === 'all' || resolvedCatalog === 'services') {
      const serviceTypes = Array.from(SERVICE_TYPES);
      let query = `
        SELECT * FROM "service_catalog"
        WHERE "tenantId" = $1::uuid
          AND "serviceType" = ANY($2::text[])
          AND ("status" IS NULL OR "status" != 'INACTIVE')
      `;
      const params: any[] = [tenantId, serviceTypes];
      let paramIndex = 3;

      if (search) {
        query += ` AND (
          "code" ILIKE $${paramIndex}
          OR "name" ILIKE $${paramIndex}
          OR "nameAr" ILIKE $${paramIndex}
          OR "nameEn" ILIKE $${paramIndex}
        )`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      query += ` ORDER BY "code" ASC LIMIT $${paramIndex}`;
      params.push(limit);

      const services: any[] = await prisma.$queryRawUnsafe(query, ...params);

      for (const s of services) {
        items.push({
          id: `svc:${s.id}`,
          code: s.code,
          name: s.nameAr || s.nameEn || s.name,
          nameAr: s.nameAr,
          nameEn: s.nameEn || s.name,
          basePrice: s.basePrice ?? s.price ?? 0,
          price: s.basePrice ?? s.price ?? 0,
          itemType: s.serviceType,
          source: 'service',
        });
      }
    }

    // 2. Charge catalog (IMAGING, LAB_TEST, PROCEDURE, MEDICATION, SUPPLY, etc.)
    if (resolvedCatalog === 'all' || (typeof resolvedCatalog === 'string' && CHARGE_ITEM_TYPES.has(resolvedCatalog))) {
      const chargeWhere: any = {
        tenantId,
        status: { not: 'INACTIVE' },
      };
      if (typeof resolvedCatalog === 'string' && resolvedCatalog !== 'all') {
        chargeWhere.itemType = resolvedCatalog;
      } else if (resolvedCatalog === 'all') {
        chargeWhere.itemType = { in: Array.from(CHARGE_ITEM_TYPES) };
      }
      if (search) {
        chargeWhere.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }
      const charges = await prisma.billingChargeCatalog.findMany({
        where: chargeWhere,
        orderBy: { code: 'asc' },
        take: limit,
      });

      for (const c of charges) {
        items.push({
          id: `chg:${c.id}`,
          code: c.code,
          name: c.name,
          nameAr: c.nameAr || c.name,
          nameEn: c.name,
          basePrice: c.basePrice ?? 0,
          price: c.basePrice ?? 0,
          itemType: c.itemType,
          source: 'charge',
        });
      }
    }

    // Sort by code, limit total
    items.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
    const limited = items.slice(0, limit);

    return NextResponse.json({ items: limited });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
