import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { verifyTokenEdge, TokenPayload } from '@/lib/auth/edge';
import { ACTIVE_PLATFORM_COOKIE } from '@/lib/shell/platform';
import { validateBody } from '@/lib/validation/helpers';
import { platformSetSchema } from '@/lib/validation/platform.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/platform/switch
 * Safely switches platform by updating activePlatform cookie
 * Validates that user is entitled to the requested platform
 * 
 * Body: { platform: 'sam' | 'health' }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const v = validateBody(body, platformSetSchema);
    if ('error' in v) return v.error;
    const { platform } = v.data;

    // Get entitlements from JWT token (computed at login)
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload = await verifyTokenEdge(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // For owner roles, always grant all entitlements regardless of token
    if (payload.role === 'thea-owner') {
      const effectiveEntitlements = { sam: true, health: true, edrac: true, cvision: true, imdad: true };
      logger.debug('Owner detected, granting all entitlements', { category: 'api', route: '/api/platform/switch' });

      // Check if user is entitled to the requested platform
      const isEntitled =
        (platform === 'sam' && effectiveEntitlements.sam) ||
        (platform === 'health' && effectiveEntitlements.health) ||
        (platform === 'cvision' && effectiveEntitlements.cvision) ||
        (platform === 'imdad' && effectiveEntitlements.imdad);

      if (!isEntitled) {
        logger.warn('Access denied for thea-owner (should not happen)', { category: 'api', route: '/api/platform/switch', platform });
        return NextResponse.json(
          { error: 'Forbidden', message: 'You are not entitled to access this platform' },
          { status: 403 }
        );
      }

      // Create response
      const response = NextResponse.json({ ok: true, platform });

      // Set activePlatform cookie (use same secure setting as auth cookie)
      const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
      const isSecure = protocol === 'https';
      response.headers.set(
        'Set-Cookie',
        serialize(ACTIVE_PLATFORM_COOKIE, platform, {
          httpOnly: true,
          secure: isSecure,
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
        })
      );

      // Optionally set thea_last_platform cookie (non-httpOnly for client-side access)
      response.headers.append(
        'Set-Cookie',
        serialize('thea_last_platform', platform, {
          httpOnly: false, // Allow client-side access for UI display
          secure: isSecure,
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60, // 30 days
          path: '/',
        })
      );

      return response;
    }

    // For non-owner users, check entitlements from token or DB
    // If entitlements are not in token, fetch from DB (fallback for old tokens)
    let effectiveEntitlements = payload.entitlements;
    if (!effectiveEntitlements) {
      logger.debug('Entitlements not in token, fetching from DB', { category: 'api', route: '/api/platform/switch' });
      const { getTenantEntitlements, getUserPlatformAccess, computeEffectiveEntitlements } = await import('@/lib/entitlements');
      
      // Get tenantId from auth context (more reliable)
      const authContext = await requireAuthContext(request, true);
      if (authContext instanceof NextResponse) {
        logger.error('Failed to get auth context', { category: 'api', route: '/api/platform/switch', status: authContext.status });
        // If auth context fails, allow for owner, otherwise default to both
        const role = payload.role as TokenPayload['role'];
        effectiveEntitlements = role === 'thea-owner'
          ? { sam: true, health: true, edrac: true, cvision: true, imdad: true }
          : { sam: true, health: true, edrac: false, cvision: false, imdad: false };
      } else {
        const tenantId = authContext.tenantId;
        logger.debug('Got tenantId from auth context', { category: 'api', route: '/api/platform/switch', tenantId });

        if (tenantId && tenantId !== 'platform') {
          try {
            const tenantEntitlements = await getTenantEntitlements(tenantId);
            const userPlatformAccess = await getUserPlatformAccess(payload.userId, tenantId);
            effectiveEntitlements = tenantEntitlements
              ? computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess)
              : {
                  sam: true,
                  health: true,
                  edrac: false,
                  cvision: false,
                  imdad: false,
                };
            logger.debug('Computed entitlements', { category: 'api', route: '/api/platform/switch', entitlements: effectiveEntitlements });
          } catch (error) {
            logger.error('Error fetching entitlements', { category: 'api', route: '/api/platform/switch', error });
            // Fallback to default
            const role = payload.role as TokenPayload['role'];
            effectiveEntitlements = role === 'thea-owner'
              ? { sam: true, health: true, edrac: true, cvision: true, imdad: true }
              : { sam: true, health: true, edrac: false, cvision: false, imdad: false };
          }
        } else {
          // No tenant or platform context - allow all for owner, otherwise default to both
          logger.debug('No tenantId or platform context, using defaults', { category: 'api', route: '/api/platform/switch', role: payload.role });
          // For owner or platform context, grant all entitlements
          const role = payload.role as TokenPayload['role'];
          if (role === 'thea-owner' || tenantId === 'platform') {
            effectiveEntitlements = { sam: true, health: true, edrac: true, cvision: true, imdad: true };
          } else {
            // For regular users without tenant, default to sam and health only
            effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false, imdad: false };
          }
        }
      }
    } else {
      logger.debug('Using entitlements from token', { category: 'api', route: '/api/platform/switch', entitlements: effectiveEntitlements });
    }

    // Check if user is entitled to the requested platform
    const isEntitled =
      (platform === 'sam' && effectiveEntitlements.sam) ||
      (platform === 'health' && effectiveEntitlements.health) ||
      (platform === 'cvision' && effectiveEntitlements.cvision) ||
      (platform === 'imdad' && effectiveEntitlements.imdad);

    logger.debug('Platform check', { category: 'api', route: '/api/platform/switch', platform, isEntitled, userRole: payload.role });

    if (!isEntitled) {
      logger.warn('Access denied for platform switch', { category: 'api', route: '/api/platform/switch', platform, userRole: payload.role });
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not entitled to access this platform' },
        { status: 403 }
      );
    }

    // Create response
    const response = NextResponse.json({ ok: true, platform });

    // Set activePlatform cookie (use same secure setting as auth cookie)
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    response.headers.set(
      'Set-Cookie',
      serialize(ACTIVE_PLATFORM_COOKIE, platform, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })
    );

    // Optionally set thea_last_platform cookie (non-httpOnly for client-side access)
    response.headers.append(
      'Set-Cookie',
      serialize('thea_last_platform', platform, {
        httpOnly: false, // Allow client-side access for UI display
        secure: isSecure,
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      })
    );

    return response;
});

