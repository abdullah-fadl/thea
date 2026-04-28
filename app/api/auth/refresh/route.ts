/**
 * Refresh Token API
 *
 * Endpoint to refresh access token using refresh token
 */

import { NextRequest, NextResponse } from 'next/server';
import { refreshAccessToken } from '@/lib/core/auth/refreshToken';
import { setAccessTokenCookie, setRefreshTokenCookie } from '@/lib/core/auth/refreshToken';
import { prisma } from '@/lib/db/prisma';
import { generateToken } from '@/lib/auth';
import { getEffectiveEntitlements } from '@/lib/entitlements';
import { getSessionData } from '@/lib/auth/sessionHelpers';
import { normalizeRole } from '@/lib/auth/normalizeRole';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
    const refreshToken = request.cookies.get('refresh-token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'No refresh token found' },
        { status: 401 }
      );
    }

    // Refresh access token
    const result = await refreshAccessToken(refreshToken, request);

    if (!result) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Load user data from Prisma
    const user = await prisma.user.findFirst({
      where: { id: result.userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'User not found or inactive' },
        { status: 401 }
      );
    }

    // Get session data for tenant context
    const sessionData = await getSessionData(request);
    const activeTenantId = sessionData?.activeTenantId || sessionData?.tenantId || user.tenantId;

    // Get effective entitlements — owner always gets all
    const userRole = normalizeRole(user.role);
    const isOwnerRole = userRole === 'thea-owner';
    const effectiveEntitlements = isOwnerRole
      ? { sam: true, health: true, edrac: true, cvision: true, imdad: true }
      : activeTenantId
        ? await getEffectiveEntitlements(activeTenantId, user.id)
        : { sam: false, health: false, edrac: false, cvision: false, imdad: false };

    // Generate new access token with full user data
    const accessToken = generateToken({
      userId: user.id,
      email: user.email,
      role: normalizeRole(user.role) as any,
      sessionId: sessionData?.sessionId,
      activeTenantId,
      entitlements: effectiveEntitlements,
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });

    // Set cookies
    const isProduction = process.env.NODE_ENV === 'production';
    setAccessTokenCookie(response, accessToken, isProduction);

    // Optionally set new refresh token if rotated
    if (result.newRefreshToken) {
      setRefreshTokenCookie(response, result.newRefreshToken, isProduction);
    }

    return response;
});
