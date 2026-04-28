import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as any)?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const notifications = await prisma.erNotification.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      encounter: {
        select: { id: true },
      },
    },
  });

  const items = notifications.map((n: any) => ({
    id: n.id,
    type: n.type,
    encounterId: n.encounterId,
    visitNumber: null,
    message: n.message,
    severity: n.severity,
    createdAt: n.createdAt,
    createdBySystem: n.createdBySystem,
    readAt: n.readAt,
    readByUserId: n.readByUserId,
  }));

  const unreadCount = await prisma.erNotification.count({
    where: { tenantId, readAt: null },
  });

  return NextResponse.json({ items, unreadCount });
}), {
  tenantScoped: true,
  platformKey: 'thea_health',
  permissionKey: 'er.board.view',
  softFailResponse: () => NextResponse.json({ items: [], unreadCount: 0 }),
});
