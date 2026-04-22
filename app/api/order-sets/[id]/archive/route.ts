import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isPrivileged(role: string, user: any, _tenantId: string) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  return roleLower.includes('admin') || roleLower.includes('charge');
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!isPrivileged(String(role || ''), user, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = String((params as Record<string, string>)?.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const existing = await prisma.orderSet.findFirst({
    where: { tenantId, id },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Order set not found' }, { status: 404 });
  }

  if ((existing as Record<string, unknown>).status === 'ARCHIVED') {
    return NextResponse.json({ success: true, noOp: true, orderSet: existing });
  }

  const now = new Date();
  await prisma.orderSet.updateMany({
    where: { tenantId, id },
    data: { status: 'ARCHIVED', updatedAt: now },
  });

  const orderSet = { ...existing, status: 'ARCHIVED', updatedAt: now };

  await createAuditLog(
    'order_set',
    id,
    'ARCHIVE',
    userId || 'system',
    user?.email,
    { before: existing, after: orderSet },
    tenantId
  );

  return NextResponse.json({ success: true, orderSet });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);
