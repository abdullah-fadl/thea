import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }) => {

  const params = req.nextUrl.searchParams;
  const department = String(params.get('department') || '').trim();

  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: (user as any)?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const where: any = { tenantId };
  if (department) {
    where.department = { equals: department, mode: 'insensitive' };
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, email: true, firstName: true, lastName: true, role: true, department: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }, { email: 'asc' }],
    take: 500,
  });

  const items = (users || []).map((u: any) => {
    const name = `${String(u.firstName || '').trim()} ${String(u.lastName || '').trim()}`.trim();
    const display = name || String(u.email || '').trim() || String(u.id || '').trim();
    return {
      id: u.id,
      email: u.email || null,
      display,
      role: u.role || null,
      department: u.department || null,
    };
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

