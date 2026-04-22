import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const encounterType = String(params.get('encounterType') || '').trim().toUpperCase();
  const encounterId = String(params.get('encounterId') || '').trim();
  if (!encounterType || !encounterId) {
    return NextResponse.json({ error: 'encounterType and encounterId are required' }, { status: 400 });
  }

  const encounterRefKey = `${encounterType}:${encounterId}`;
  const items = await prisma.orderSetApplication.findMany({
    where: { tenantId, encounterRefKey },
    orderBy: { appliedAt: 'asc' },
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);
