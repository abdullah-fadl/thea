import { NextRequest, NextResponse } from 'next/server';
import { clearPortalCookie, requirePortalSession } from '@/lib/portal/auth';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const tenant = await prisma.tenant.findFirst({ where: { tenantId: payload.tenantId } });
  if (tenant) {
    await prisma.patientPortalSession.deleteMany({
      where: { id: payload.sessionId, tenantId: tenant.id },
    });
  }

  const response = NextResponse.json({ success: true });
  clearPortalCookie(response);
  return response;
});
