import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const idsParam = String(req.nextUrl.searchParams.get('ids') || '').trim();
  const ids = idsParam
    ? Array.from(new Set(idsParam.split(',').map((id) => id.trim()).filter(Boolean)))
    : [];
  if (!ids.length) {
    return NextResponse.json({ items: [] });
  }

  // Resolve tenant UUID from key
  const tenant = await prisma.tenant.findFirst({
    where: tenantWhere(tenantId),
    select: { id: true },
  });
  const tenantUuid = tenant?.id || tenantId;

  const users = await prisma.user.findMany({
    where: {
      tenantId: tenantUuid,
      id: { in: ids },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  const items = users.map((u) => {
    const name = `${String(u.firstName || '').trim()} ${String(u.lastName || '').trim()}`.trim();
    const display = name || String(u.email || '').trim() || String(u.id || '').trim();
    return { id: u.id, display };
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'tasks.queue.view' }
);
