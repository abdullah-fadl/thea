import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as any)?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await prisma.erNotification.updateMany({
    where: { tenantId, readAt: null },
    data: { readAt: new Date(), readByUserId: userId },
  });

  return NextResponse.json({ success: true, updated: result.count });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
