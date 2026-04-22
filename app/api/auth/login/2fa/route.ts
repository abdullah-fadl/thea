import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { comparePassword, generateToken } from '@/lib/auth';
import { createSession, deleteUserSessions } from '@/lib/auth/sessions';
import { createRefreshToken, setAccessTokenCookie, setRefreshTokenCookie } from '@/lib/core/auth/refreshToken';
import { saveSessionState, restoreSessionState } from '@/lib/core/auth/sessionRestore';
import { getEffectiveEntitlements } from '@/lib/entitlements';
import { verify2FAToken, verifyTempToken } from '@/lib/auth/twoFactor';
import { bootstrapTheaOwner } from '@/lib/system/bootstrap';
import { User } from '@/lib/models/User';
import { serialize } from 'cookie';
import { normalizeRole } from '@/lib/auth/normalizeRole';
import { validateBody } from '@/lib/validation/helpers';
import { twoFactorLoginSchema } from '@/lib/validation/auth.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
  let body: any;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const v = validateBody(body, twoFactorLoginSchema);
  if ('error' in v) return v.error;
  const { tempToken, token } = v.data;

  const temp = verifyTempToken(tempToken);
  if (!temp?.userId) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  // Search for user in PostgreSQL (single database)
  const dbUser = await prisma.user.findFirst({
    where: { id: temp.userId },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let user: User = {
    ...dbUser,
    role: normalizeRole(dbUser.role) as string,
    tenantId: dbUser.tenantId || undefined,
  } as unknown as User;

  const isTokenValid = verify2FAToken(String(token || ''), user.twoFactorSecret);
  let backupCodeUsed = false;

  if (!isTokenValid) {
    const backupCodes = Array.isArray(user.twoFactorBackupCodes) ? user.twoFactorBackupCodes : [];
    for (const code of backupCodes) {
      if (code?.used) continue;
      const match = await comparePassword(String(token || ''), code.hash);
      if (match) {
        // Mark backup code as used in the JSON array
        const updatedCodes = backupCodes.map((c: any) =>
          c.hash === code.hash ? { ...c, used: true } : c
        );
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorBackupCodes: updatedCodes as Prisma.InputJsonValue },
        });
        backupCodeUsed = true;
        break;
      }
    }
    if (!backupCodeUsed) {
      return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 400 });
    }
  }

  // Invalidate all previous sessions (single active session enforcement)
  await deleteUserSessions(user.id);

  const wasPromoted = await bootstrapTheaOwner(user.id, user.email);
  if (wasPromoted) {
    const currentUser = await prisma.user.findFirst({ where: { id: user.id } });
    if (currentUser) {
      user = {
        ...currentUser,
        role: normalizeRole(currentUser.role) as string,
        tenantId: currentUser.tenantId || undefined,
      } as unknown as User;
    }
  }

  const userAgent = request.headers.get('user-agent') || undefined;
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

  const activeTenantId = temp.activeTenantId || undefined;
  const sessionId = await createSession(user.id, userAgent, ip, user.tenantId || undefined, activeTenantId);

  // Owner always gets all entitlements
  const isOwnerRole = user.role === 'thea-owner';
  const effectiveEntitlements = isOwnerRole
    ? { sam: true, health: true, edrac: true, cvision: true, imdad: true }
    : activeTenantId
      ? await getEffectiveEntitlements(activeTenantId, user.id)
      : { sam: false, health: false, edrac: false, cvision: false, imdad: false };

  const accessToken = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionId,
    activeTenantId,
    twoFactorVerified: true,
    entitlements: effectiveEntitlements,
  });

  const refreshToken = await createRefreshToken(user.id, userAgent, ip);

  const restoreRoute = await restoreSessionState(user.id);
  const redirectTo = restoreRoute || '/platforms';

  const response = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    redirectTo,
  });

  const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
  const isProduction = protocol === 'https';
  setAccessTokenCookie(response, accessToken, isProduction);
  setRefreshTokenCookie(response, refreshToken, isProduction);

  const isSecure = protocol === 'https';
  const cookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict' as const,
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  };
  response.headers.set('Set-Cookie', serialize('auth-token', accessToken, cookieOptions));

  await saveSessionState(user.id, {
    lastRoute: undefined,
    lastPlatformKey: undefined,
    lastTenantId: activeTenantId,
  });

  return response;
});
