import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { z } from 'zod';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const bodySchema = z.object({
  notificationId: z.string().min(1, 'notificationId is required'),
}).passthrough();

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }) => {

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as any)?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const notificationId = String(v.data.notificationId).trim();

  const existing = await prisma.erNotification.findFirst({
    where: { tenantId, id: notificationId },
  });
  if (!existing) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });

  if (existing.readAt) return NextResponse.json({ success: true, unchanged: true });

  await prisma.erNotification.update({
    where: { id: notificationId },
    data: { readAt: new Date(), readByUserId: userId },
  });

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'er.board.view' }
);
