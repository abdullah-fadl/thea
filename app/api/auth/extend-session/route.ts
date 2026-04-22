import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/core/errors';
import { getSessionData } from '@/lib/auth/sessionHelpers';
import { generateToken } from '@/lib/auth';
import { normalizeRole } from '@/lib/auth/normalizeRole';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveEntitlements } from '@/lib/entitlements';
import { setAccessTokenCookie } from '@/lib/core/auth/refreshToken';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const sessionData = await getSessionData(request);
  if (!(sessionData as any)?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { id: (sessionData as any).userId },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeTenantId = sessionData.activeTenantId || sessionData.tenantId || user.tenantId;
  const userRole = normalizeRole(user.role);
  const isOwnerRole = userRole === 'thea-owner';
  const effectiveEntitlements = isOwnerRole
    ? { sam: true, health: true, edrac: true, cvision: true, imdad: true }
    : activeTenantId
      ? await getEffectiveEntitlements(activeTenantId, user.id)
      : { sam: false, health: false, edrac: false, cvision: false, imdad: false };

  const accessToken = generateToken({
    userId: user.id,
    email: user.email,
    role: normalizeRole(user.role) as any,
    sessionId: sessionData.sessionId,
    activeTenantId,
    entitlements: effectiveEntitlements,
  });

  const response = NextResponse.json({ success: true, extended: true });
  const isProduction = process.env.NODE_ENV === 'production';
  setAccessTokenCookie(response, accessToken, isProduction);

  logger.info('[AUTH] Session extended', { category: 'auth', userId: user.id });

  return response;
});
