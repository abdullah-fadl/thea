import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function roleKey(role: string, user: any) {
  const roleLower = String(role || user?.role || '').toLowerCase();
  if (roleLower.includes('doctor') || roleLower.includes('physician')) return 'doctor';
  if (roleLower.includes('nurse') || roleLower.includes('nursing')) return 'nurse';
  return roleLower;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, role, user }) => {

  const currentRole = roleKey(String(role || ''), user);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const open = await prisma.clinicalHandover.findMany({
    where: {
      tenantId,
      status: 'OPEN',
      OR: [
        { toUserId: userId },
        { toUserId: null, toRole: currentRole },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const recent = await prisma.clinicalHandover.findMany({
    where: {
      tenantId,
      status: 'FINALIZED',
      finalizedAt: { gte: since },
      OR: [
        { toUserId: userId },
        { toUserId: null, toRole: currentRole },
      ],
    },
    orderBy: { finalizedAt: 'desc' },
  });

  return NextResponse.json({ open, recent });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'handover.view' }
);
