import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { comparePassword, generateToken } from '@/lib/auth';
import { createSession, deleteUserSessions } from '@/lib/auth/sessions';
import { User } from '@/lib/models/User';
// cookie serialize import removed — cookie is now set only by setAccessTokenCookie
import { env } from '@/lib/env';
import { getEffectiveEntitlements } from '@/lib/entitlements';
import { bootstrapTheaOwner } from '@/lib/system/bootstrap';
import { createRefreshToken, setRefreshTokenCookie, setAccessTokenCookie } from '@/lib/core/auth/refreshToken';
import { saveSessionState, restoreSessionState } from '@/lib/core/auth/sessionRestore';
import { checkAccountLocked, clearFailedLogins, recordFailedLogin } from '@/lib/auth/loginAttempts';
import { checkRateLimitRedis } from '@/lib/security/rateLimit';
import { sanitizeErrorForUser } from '@/lib/utils/errorHandler';
import { generateTempToken } from '@/lib/auth/twoFactor';
import { isPasswordExpired } from '@/lib/security/passwordPolicy';
import { normalizeRole } from '@/lib/auth/normalizeRole';
import { validateBody } from '@/lib/validation/helpers';
import { loginSchema } from '@/lib/validation/auth.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

function getEmailCandidates(input: string): string[] {
  const normalized = input.trim().toLowerCase();
  return [normalized];
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const v = validateBody(body, loginSchema);
    if ('error' in v) return v.error;
    const { email, password, tenantId } = v.data;
    const emailCandidates = getEmailCandidates(email);

    // IP-based rate limiting: max 20 login attempts per IP per 5 minutes
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const ipRateLimit = await checkRateLimitRedis(`login:ip:${clientIp}`, 20, 5 * 60 * 1000);
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts from this IP. Please try again later.' },
        { status: 429 }
      );
    }

    const normalizedOwnerEmails = new Set(
      [
        process.env.THEA_OWNER_EMAIL,
        'owner@thea.com.sa',
        'thea@thea.com.sa',
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
    );

    for (const candidate of emailCandidates) {
      const { locked, remainingMs } = await checkAccountLocked(null, candidate);
      if (locked) {
        const minutes = Math.ceil((remainingMs || 0) / 60000);
        await createAuditLog('auth', candidate, 'login_blocked_locked', null, candidate, { reason: 'account_locked', remainingMs }, undefined, request).catch(() => {});
        return NextResponse.json(
          { error: `Account locked. Try again in ${minutes} minutes.` },
          { status: 429 }
        );
      }
    }

    // Search for user in PostgreSQL (single database)
    let user: User | null = null;
    let userTenantId: string | undefined = undefined;

    for (const candidate of emailCandidates) {
      const dbUser = await prisma.user.findFirst({
        where: {
          email: { equals: candidate, mode: 'insensitive' },
        },
      });
      if (dbUser) {
        user = {
          ...dbUser,
          role: normalizeRole(dbUser.role),
          tenantId: dbUser.tenantId || undefined,
        } as unknown as User;

        // Resolve tenant key from tenant UUID
        if (dbUser.tenantId) {
          const tenant = await prisma.tenant.findFirst({
            where: { id: dbUser.tenantId },
            select: { tenantId: true },
          });
          userTenantId = tenant?.tenantId || undefined;
        }
        logger.info('Found user', { category: 'auth', email: dbUser.email, tenantId: userTenantId || 'none' });
        break;
      }
    }

    if (userTenantId && user && !user.tenantId) {
      user.tenantId = userTenantId;
    }

    if (!user || user.isActive === false) {
      await recordFailedLogin(null, emailCandidates[0]);
      await createAuditLog('auth', emailCandidates[0], 'login_failed', null, emailCandidates[0], { reason: user ? 'account_inactive' : 'user_not_found', ip: clientIp }, undefined, request).catch(() => {});
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (user.role !== 'thea-owner' && !tenantId) {
      return NextResponse.json(
        { error: 'Tenant selection is required for this user' },
        { status: 400 }
      );
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      await recordFailedLogin(null, emailCandidates[0]);
      await createAuditLog('auth', user.id, 'login_failed', user.id, user.email, { reason: 'invalid_password', ip: clientIp }, undefined, request).catch(() => {});
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Validate tenantId if provided
    let tenant: Record<string, unknown> | null = null;
    let activeTenantId: string | undefined = undefined;

    if (tenantId) {
      // Only search by UUID `id` if the value looks like a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
      const tenantRow = await prisma.tenant.findFirst({
        where: isUuid
          ? { OR: [{ tenantId }, { id: tenantId }] }
          : { tenantId },
      });

      if (!tenantRow) {
        return NextResponse.json(
          { error: 'Invalid tenant selected' },
          { status: 400 }
        );
      }
      tenant = tenantRow as any;

      const actualTenantId = (tenant as any).tenantId || tenantId;
      activeTenantId = actualTenantId as string;

      // Check subscription contract
      const { checkSubscription } = await import('@/lib/core/subscription/engine');
      let subscriptionCheck = await checkSubscription(actualTenantId as string);

      // Auto-create subscription if needed
      if (!subscriptionCheck.allowed && subscriptionCheck.reason?.includes('No subscription contract found') && (tenant as any).status === 'ACTIVE') {
        logger.info('Auto-creating subscription contract for tenant', { category: 'auth', tenantId: actualTenantId });

        const now = new Date();
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const t = tenant as any;

        await prisma.subscriptionContract.create({
          data: {
            tenantId: t.id as string,
            status: 'active',
            enabledSam: (t.entitlementSam as boolean) || true,
            enabledTheaHealth: (t.entitlementHealth as boolean) || true,
            enabledCvision: (t.entitlementCvision as boolean) || false,
            enabledEdrac: (t.entitlementEdrac as boolean) || false,
            enabledImdad: (t.entitlementScm as boolean) || false,
            maxUsers: (t.maxUsers as number) || 100,
            currentUsers: 0,
            planType: (t.planType as string)?.toLowerCase() || 'enterprise',
            enabledFeatures: {},
            storageLimit: BigInt(1000000000),
            subscriptionStartsAt: now,
            subscriptionEndsAt: (t.subscriptionEndsAt as Date) || oneYearFromNow,
            gracePeriodEnabled: (t.gracePeriodEnabled as boolean) || false,
          },
        });
        logger.info('Created subscription contract for tenant', { category: 'auth', tenantId: actualTenantId });
        subscriptionCheck = await checkSubscription(actualTenantId as string);
      }

      if (!subscriptionCheck.allowed) {
        return NextResponse.json(
          {
            error: subscriptionCheck.reason || 'Subscription issue',
            message: subscriptionCheck.reason || 'Subscription expired. Please contact administration.'
          },
          { status: 403 }
        );
      }

      if ((tenant as any).status === 'BLOCKED') {
        return NextResponse.json(
          {
            error: 'Account blocked',
            message: 'This tenant account has been blocked. Please contact support.'
          },
          { status: 403 }
        );
      }

      // For normal users: must match user's tenant
      if (user.role !== 'thea-owner') {
        let userTenantMatches = false;

        if (user.tenantId === actualTenantId || user.tenantId === (tenant as any).id) {
          userTenantMatches = true;
        } else if (user.tenantId) {
          const isUserTenantUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.tenantId);
          const userTenant = await prisma.tenant.findFirst({
            where: isUserTenantUuid
              ? { OR: [{ tenantId: user.tenantId }, { id: user.tenantId }] }
              : { tenantId: user.tenantId },
            select: { tenantId: true },
          });
          if (userTenant && userTenant.tenantId === actualTenantId) {
            userTenantMatches = true;
          }
        }

        if (!userTenantMatches) {
          return NextResponse.json(
            { error: 'Invalid tenant selected for this user' },
            { status: 403 }
          );
        }
      }

      activeTenantId = actualTenantId as string;
    } else if (user.role === 'thea-owner') {
      activeTenantId = undefined;
    }

    if (user.twoFactorEnabled) {
      const tempToken = generateTempToken({ userId: user.id, activeTenantId: activeTenantId || null });
      return NextResponse.json({
        requires2FA: true,
        tempToken,
        message: 'Please enter your 2FA code',
      });
    }

    // Check forced password change or expired password
    const requiresPasswordChange =
      (user as unknown as Record<string, unknown>).forcePasswordChange === true ||
      isPasswordExpired((user as unknown as Record<string, unknown>).passwordChangedAt as Date | undefined);

    // Invalidate all previous sessions
    await deleteUserSessions(user.id);

    // Clear failed login attempts on successful login
    await clearFailedLogins(null, emailCandidates[0]);

    // Bootstrap Thea Owner
    const wasPromoted = await bootstrapTheaOwner(user.id, user.email);

    if (wasPromoted) {
      const currentUser = await prisma.user.findFirst({ where: { id: user.id } });
      if (currentUser) {
        user = {
          ...currentUser,
          role: normalizeRole(currentUser.role),
          tenantId: currentUser.tenantId || undefined,
        } as unknown as User;
        logger.info('User logged in (promoted to thea-owner)', { category: 'auth', email: user.email, role: user.role });
      }
    } else {
      logger.info('User logged in', { category: 'auth', email: user.email, role: user.role });
    }

    const userAgent = request.headers.get('user-agent') || undefined;
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               undefined;

    const isOwnerRole = user.role === 'thea-owner';
    const sessionTenantId = isOwnerRole
      ? activeTenantId || undefined
      : (user.tenantId && user.tenantId !== 'default' ? user.tenantId : undefined);
    const sessionId = await createSession(user.id, userAgent, ip, sessionTenantId, activeTenantId);

    // Owner (project creator) always gets all entitlements
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
      entitlements: effectiveEntitlements,
    });

    const refreshToken = await createRefreshToken(user.id, userAgent, ip);

    const lastRoute = request.nextUrl.searchParams.get('redirect') || undefined;
    const platformKey = request.nextUrl.searchParams.get('platform') || undefined;
    await saveSessionState(user.id, {
      lastRoute,
      lastPlatformKey: platformKey as string | undefined,
      lastTenantId: activeTenantId,
    });

    const restoreRoute = await restoreSessionState(user.id);
    const redirectTo = lastRoute || restoreRoute || '/platforms';

    // Audit successful login
    await createAuditLog('auth', user.id, 'login_success', user.id, user.email, {
      role: user.role, tenantId: activeTenantId, ip: clientIp, requiresPasswordChange,
    }, activeTenantId, request).catch(() => {});

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      requiresPasswordChange,
      redirectTo: requiresPasswordChange ? '/settings/security?force=password' : redirectTo,
    });

    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000';
    const isProduction = protocol === 'https';
    setAccessTokenCookie(response, accessToken, isProduction);
    setRefreshTokenCookie(response, refreshToken, isProduction);

    // Cookie already set by setAccessTokenCookie above — do NOT overwrite with longer maxAge

    return response;
  } catch (error) {
    logger.error('Login error', { category: 'auth', error });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: sanitizeErrorForUser(error),
        message: env.isDev ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
});
