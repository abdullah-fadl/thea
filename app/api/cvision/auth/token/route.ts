import { logger } from '@/lib/monitoring/logger';
/**
 * CVision API Token Endpoint
 *
 * Bearer-token auth for API / mobile clients.
 * Does NOT interfere with the existing cookie-based web session.
 *
 * POST actions:
 *   login       — validate credentials → { accessToken, refreshToken }
 *   refresh     — rotate refresh token → new { accessToken, refreshToken }
 *   logout      — revoke one refresh token
 *   logout-all  — revoke all sessions for user
 *
 * GET actions:
 *   verify      — check access token validity (Authorization header)
 *   sessions    — list active API sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPlatformCollection } from '@/lib/db/platformDb';
import { getCVisionDb } from '@/lib/cvision/db';
import { comparePassword } from '@/lib/auth';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  getActiveSessions,
  extractBearerToken,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '@/lib/cvision/auth/jwt-engine';
import type { User } from '@/lib/models/User';

export const dynamic = 'force-dynamic';

function ok(data: any) {
  return NextResponse.json({ success: true, ...data });
}
function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

// ─── Shared: find user by email scoped to a specific tenant ──
//
// SECURITY: tenantId is REQUIRED. Cross-tenant scanning has been removed
// to prevent a user from one tenant authenticating against another tenant's
// data (cross-tenant login leakage). Callers must supply tenantId explicitly
// from the request body or a verified platform context — never by discovery.

async function findUserByEmail(
  email: string,
  tenantId: string,
): Promise<{ user: User; tenantId: string } | null> {
  // 1. Platform DB — for platform-level accounts (e.g. owner users)
  //    Only accepted when the stored user belongs to the requested tenant.
  try {
    const col = await getPlatformCollection('users');
    const user = (await col.findOne({ email, tenantId })) as User | null;
    if (user && user.isActive) {
      return { user, tenantId };
    }
  } catch { /* continue */ }

  // 2. Specified tenant DB — the only tenant searched
  try {
    const db = await getCVisionDb(tenantId);
    const user = (await db.collection('users').findOne({ email })) as User | null;
    if (user && user.isActive) return { user, tenantId };
  } catch { /* continue */ }

  return null;
}

// ─── GET ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'verify';

  try {
    if (action === 'verify') {
      const token = extractBearerToken(request.headers.get('authorization'));
      if (!token) return fail('Missing Authorization: Bearer <token> header', 401);

      const payload = verifyToken(token, 'access');
      if (!payload) return fail('Invalid or expired access token', 401);

      return ok({
        valid: true,
        user: {
          userId: payload.userId,
          tenantId: payload.tenantId,
          email: payload.email,
          role: payload.role,
          name: payload.name,
        },
        expiresAt: new Date(payload.exp * 1000).toISOString(),
      });
    }

    if (action === 'sessions') {
      const token = extractBearerToken(request.headers.get('authorization'));
      if (!token) return fail('Missing Authorization header', 401);

      const payload = verifyToken(token, 'access');
      if (!payload) return fail('Invalid or expired access token', 401);

      const sessions = await getActiveSessions(payload.tenantId, payload.userId);
      return ok({
        sessions: sessions.map((s) => ({
          id: s._id?.toString(),
          deviceInfo: s.deviceInfo,
          ipAddress: s.ipAddress,
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt,
          expiresAt: s.expiresAt,
        })),
      });
    }

    return fail(`Unknown GET action: ${action}`);
  } catch (err: any) {
    logger.error('[CVision Token API GET]', err);
    return fail(err.message || 'Internal error', 500);
  }
}

// ─── POST ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    switch (action) {
      // ── Login ──────────────────────────────────────────────
      case 'login': {
        const { email, password, tenantId } = body;
        if (!email || !password) return fail('email and password required');

        // SECURITY: tenantId is mandatory — without it we cannot scope the
        // user lookup to the correct tenant, which would risk cross-tenant
        // login leakage.
        if (!tenantId) return fail('tenantId is required', 400);

        // ── Brute-force protection ──────────────────────────
        // SECURITY: if the rate-limit or lock check itself throws an error
        // we must NOT proceed with the login — fail closed (return 429).
        // Silently swallowing the error would let an attacker bypass
        // brute-force protection by inducing transient DB failures.
        try {
          const { checkRateLimit, isAccountLocked } = await import('@/lib/cvision/auth/security-engine');
          const rateCheck = await checkRateLimit(ip);
          if (!rateCheck.allowed) {
            return NextResponse.json(
              { success: false, error: 'Too many login attempts. Please try again later.', retryAfter: rateCheck.retryAfterSeconds },
              { status: 429 },
            );
          }
          const lockCheck = await isAccountLocked(email);
          if (lockCheck.locked) {
            return NextResponse.json(
              { success: false, error: `Account is temporarily locked. Try again in ${lockCheck.remainingMinutes} minutes.`, lockedUntil: lockCheck.lockedUntil },
              { status: 423 },
            );
          }
        } catch (secErr) {
          logger.error('[CVision Token] Security check failed — blocking login as fail-safe:', secErr);
          return NextResponse.json(
            { success: false, error: 'Service temporarily unavailable. Please try again later.' },
            { status: 429 },
          );
        }

        const found = await findUserByEmail(email, tenantId);
        if (!found) {
          try {
            const { recordLoginAttempt } = await import('@/lib/cvision/auth/security-engine');
            await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false, failReason: 'USER_NOT_FOUND', tenantId, timestamp: new Date() });
          } catch { /* non-blocking */ }
          return fail('Invalid credentials', 401);
        }

        const { user, tenantId: resolvedTenantId } = found;

        if (!user.password) return fail('Invalid credentials', 401);
        const valid = await comparePassword(password, user.password);
        if (!valid) {
          try {
            const { recordLoginAttempt } = await import('@/lib/cvision/auth/security-engine');
            await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: false, failReason: 'INVALID_PASSWORD', tenantId: resolvedTenantId, timestamp: new Date() });
          } catch { /* non-blocking */ }
          return fail('Invalid credentials', 401);
        }

        if (!resolvedTenantId) return fail('Tenant could not be resolved. Provide tenantId.', 400);

        const tokenUser = {
          userId: user.id,
          tenantId: resolvedTenantId,
          email: user.email,
          role: user.role,
          name: user.firstName
            ? `${user.firstName} ${user.lastName || ''}`.trim()
            : user.email,
        };

        const accessToken = generateAccessToken(tokenUser);
        const refreshToken = generateRefreshToken({
          userId: user.id,
          tenantId: resolvedTenantId,
        });

        await storeRefreshToken(resolvedTenantId, user.id, refreshToken, userAgent, ip);

        try {
          const { recordLoginAttempt } = await import('@/lib/cvision/auth/security-engine');
          await recordLoginAttempt({ email, ipAddress: ip, userAgent, success: true, tenantId: resolvedTenantId, timestamp: new Date() });
        } catch { /* non-blocking */ }

        // Also set refresh token as httpOnly cookie for browser convenience
        const isSecure = request.url.startsWith('https');
        const response = ok({
          accessToken,
          refreshToken,
          expiresIn: ACCESS_TOKEN_EXPIRY,
          refreshExpiresIn: REFRESH_TOKEN_EXPIRY,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: tokenUser.name,
            tenantId: resolvedTenantId,
          },
        });

        response.cookies.set('cvision-refresh-token', refreshToken, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: REFRESH_TOKEN_EXPIRY,
        });

        return response;
      }

      // ── Refresh ────────────────────────────────────────────
      case 'refresh': {
        const refreshToken =
          body.refreshToken ||
          request.cookies.get('cvision-refresh-token')?.value;

        if (!refreshToken) return fail('refreshToken required', 401);

        const payload = verifyToken(refreshToken, 'refresh');
        if (!payload) return fail('Invalid or expired refresh token', 401);

        const isValid = await validateRefreshToken(payload.tenantId, refreshToken);
        if (!isValid) return fail('Refresh token revoked or not found', 401);

        let userName = payload.name || '';
        let userEmail = payload.email || '';
        let userRole = payload.role || '';

        // Try to load user from DB for fresh info
        try {
          const db = await getCVisionDb(payload.tenantId);
          const user = (await db.collection('users').findOne({ id: payload.userId })) as User | null;
          if (user) {
            userName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email;
            userEmail = user.email;
            userRole = user.role;
          }
        } catch { /* use payload data */ }

        // Revoke old, issue new tokens
        await revokeRefreshToken(payload.tenantId, refreshToken);

        const newAccess = generateAccessToken({
          userId: payload.userId,
          tenantId: payload.tenantId,
          email: userEmail,
          role: userRole,
          name: userName,
        });

        const newRefresh = generateRefreshToken({
          userId: payload.userId,
          tenantId: payload.tenantId,
        });

        await storeRefreshToken(payload.tenantId, payload.userId, newRefresh, userAgent, ip);

        const isSecure = request.url.startsWith('https');
        const response = ok({
          accessToken: newAccess,
          refreshToken: newRefresh,
          expiresIn: ACCESS_TOKEN_EXPIRY,
          refreshExpiresIn: REFRESH_TOKEN_EXPIRY,
        });

        response.cookies.set('cvision-refresh-token', newRefresh, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'lax',
          path: '/',
          maxAge: REFRESH_TOKEN_EXPIRY,
        });

        return response;
      }

      // ── Logout (single session) ────────────────────────────
      case 'logout': {
        const refreshToken =
          body.refreshToken ||
          request.cookies.get('cvision-refresh-token')?.value;

        if (refreshToken) {
          const payload = verifyToken(refreshToken, 'refresh');
          if (payload) {
            await revokeRefreshToken(payload.tenantId, refreshToken);
          }
        }

        const response = ok({ loggedOut: true });
        response.cookies.set('cvision-refresh-token', '', {
          httpOnly: true,
          path: '/',
          maxAge: 0,
        });
        return response;
      }

      // ── Logout all sessions ────────────────────────────────
      case 'logout-all': {
        const token = extractBearerToken(request.headers.get('authorization'));
        if (!token) return fail('Authorization header required', 401);

        const payload = verifyToken(token, 'access');
        if (!payload) return fail('Invalid access token', 401);

        const count = await revokeAllUserTokens(payload.tenantId, payload.userId);

        const response = ok({ revokedSessions: count });
        response.cookies.set('cvision-refresh-token', '', {
          httpOnly: true,
          path: '/',
          maxAge: 0,
        });
        return response;
      }

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    logger.error('[CVision Token API POST]', err);
    return fail(err.message || 'Internal error', 500);
  }
}
