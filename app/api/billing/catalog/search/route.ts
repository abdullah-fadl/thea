import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { normalizeArabicNumerals } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KIND_TO_ITEM_TYPE: Record<string, string> = {
  LAB: 'LAB_TEST',
  RAD: 'IMAGING',
  PROCEDURE: 'PROCEDURE',
};

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const kind = String(req.nextUrl.searchParams.get('kind') || '').trim().toUpperCase();
    const query = normalizeArabicNumerals(
      String(req.nextUrl.searchParams.get('query') || req.nextUrl.searchParams.get('q') || '').trim()
    );
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit')) || 20, 1), 50);

    const itemType = KIND_TO_ITEM_TYPE[kind];
    if (!itemType) {
      return NextResponse.json({ error: 'Invalid kind. Use LAB, RAD, or PROCEDURE.' }, { status: 400 });
    }

    const where: any = {
      tenantId,
      itemType,
      status: 'ACTIVE',
    };

    if (query && query.length >= 1) {
      where.OR = [
        { code: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ];
    }

    const raw = await prisma.billingChargeCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
      take: limit,
    });

    const items = raw.map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr || r.name,
      title: r.nameAr || r.name,
      basePrice: Number(r.basePrice || 0),
    }));

    return NextResponse.json({ items });
  }),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: [
      'billing.view',
      'opd.doctor.encounter.view',
      'opd.doctor.orders.create',
      'opd.nursing.edit',
    ],
  }
);
