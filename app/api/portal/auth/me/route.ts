import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalAuth, validatePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const payload = requirePortalAuth(request);
  if (payload instanceof NextResponse) return payload;

  const sessionCheck = await validatePortalSession(payload.tenantId, payload.sessionId);
  if (!sessionCheck.valid) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });

  if (!portalUser) {
    return NextResponse.json({ error: 'Portal user not found' }, { status: 404 });
  }

  return NextResponse.json({
    portalUser: {
      id: portalUser.id,
      mobile: portalUser.mobile,
      patientMasterId: portalUser.patientMasterId || null,
    },
    tenantId: payload.tenantId,
  });
});
