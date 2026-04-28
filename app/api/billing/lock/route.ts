import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const lock = await prisma.billingLock.findUnique({
    where: { tenantId_encounterCoreId: { tenantId, encounterCoreId } },
  });

  return NextResponse.json({ lock: lock || null });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
