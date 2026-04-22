import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { cached } from '@/lib/cache';
import { CacheKeys, CacheTTL } from '@/lib/cache/keys';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEPARTMENT_KEYS = new Set([
  'OPD',
  'LABORATORY',
  'RADIOLOGY',
  'OPERATING_ROOM',
  'CATH_LAB',
  'PHYSIOTHERAPY',
  'DELIVERY',
  'CRITICAL_CARE',
  'MORTUARY',
]);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const encounterCoreId = String(params.get('encounterCoreId') || '').trim();
  const departmentKeyRaw = String(params.get('departmentKey') || '').trim().toUpperCase();

  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }
  if (departmentKeyRaw && !DEPARTMENT_KEYS.has(departmentKeyRaw)) {
    return NextResponse.json({ error: 'Invalid departmentKey' }, { status: 400 });
  }

  // Resolve tenant UUID from tenant key
  const tenant = await prisma.tenant.findFirst({ where: { tenantId } });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const cacheKey = `${CacheKeys.activeDepartments(tenantId)}:${encounterCoreId}:${departmentKeyRaw}`;
  const result = await cached(cacheKey, async () => {
    const items = await prisma.departmentEntry.findMany({
      where: {
        tenantId: tenant.id,
        encounterCoreId,
        status: 'IN',
        exitedAt: null,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    let latestEntry = null;
    if (departmentKeyRaw) {
      latestEntry = await prisma.departmentEntry.findFirst({
        where: {
          tenantId: tenant.id,
          encounterCoreId,
          departmentKey: departmentKeyRaw,
        },
        orderBy: [{ enteredAt: 'desc' }, { createdAt: 'desc' }],
      });
    }

    return { items, latestEntry };
  }, CacheTTL.DEPARTMENTS);

  return NextResponse.json(result);
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'registration.view' }
);
