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

  const claimId = String(req.nextUrl.pathname.split('/').pop() || '').trim();
  if (!claimId) {
    return NextResponse.json({ error: 'claimId is required' }, { status: 400 });
  }

  const claim = await prisma.billingClaim.findFirst({
    where: { tenantId, id: claimId },
  });
  if (!claim) {
    return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
  }

  const events = await prisma.billingClaimEvent.findMany({
    where: { tenantId, claimId },
    orderBy: [{ createdAt: 'asc' }],
    take: 100,
  });

  return NextResponse.json({ claim, events });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
