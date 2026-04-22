import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {
  if (!canAccessChargeConsole({ email: user?.email, tenantId, role: user?.role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const routeParams = (await params) || {};
  const handoffId = String((routeParams as any).handoffId || '').trim();
  if (!handoffId) {
    return NextResponse.json({ error: 'handoffId is required' }, { status: 400 });
  }

  const handoff = await prisma.erAdmissionHandover.findFirst({
    where: { id: handoffId },
  });
  if (!handoff) {
    return NextResponse.json({ error: 'Handoff not found' }, { status: 404 });
  }

  return NextResponse.json({ handoff });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'handover.view' }
);
