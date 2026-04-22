import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { requireAuth } from '@/lib/auth/requireAuth';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { ACTIVE_PLATFORM_COOKIE } from '@/lib/shell/platform';
import { validateBody } from '@/lib/validation/helpers';
import { platformSetSchema } from '@/lib/validation/platform.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/platform/set
 * Sets the activePlatform cookie
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

    // Get entitlements from JWT token to validate access
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

    // For owner roles, always grant all entitlements
    if (payload.role === 'thea-owner') {
      // thea-owner has access to all platforms
      const effectiveEntitlements = { sam: true, health: true, edrac: true, cvision: true, imdad: true };
      logger.debug('Owner detected, granting all entitlements', { category: 'api', route: '/api/platform/set' });
      
      // Create response
      const response = NextResponse.json({ success: true, platform });

      // Set httpOnly cookie (use same secure setting as auth cookie)
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

      return response;
    }

    // For non-owner users, check entitlements from token or DB
    let effectiveEntitlements = payload.entitlements;
    if (!effectiveEntitlements) {
      logger.debug('Entitlements not in token, fetching from DB', { category: 'api', route: '/api/platform/set' });
      const { getTenantEntitlements, getUserPlatformAccess, computeEffectiveEntitlements } = await import('@/lib/entitlements');
      const { requireAuthContext } = await import('@/lib/auth/requireAuthContext');
      
      // Get tenantId from auth context
      const authContext = await requireAuthContext(request, true);
      if (authContext instanceof NextResponse) {
        logger.error('Failed to get auth context', { category: 'api', route: '/api/platform/set' });
        // Default to both platforms if auth context fails
        effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false, imdad: false };
      } else {
        const tenantId = authContext.tenantId;

        if (tenantId && tenantId !== 'platform') {
          try {
            const tenantEntitlements = await getTenantEntitlements(tenantId);
            const userPlatformAccess = await getUserPlatformAccess(payload.userId, tenantId);
            effectiveEntitlements = tenantEntitlements
              ? computeEffectiveEntitlements(tenantEntitlements, userPlatformAccess)
              : { sam: true, health: true, edrac: false, cvision: false, imdad: false };
            logger.debug('Computed entitlements', { category: 'api', route: '/api/platform/set', entitlements: effectiveEntitlements });
          } catch (error) {
            logger.error('Error fetching entitlements', { category: 'api', route: '/api/platform/set', error });
            // Default to both platforms on error
            effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false, imdad: false };
          }
        } else {
          // No tenant or platform context - default to both
          effectiveEntitlements = { sam: true, health: true, edrac: false, cvision: false, imdad: false };
        }
      }
    } else {
      logger.debug('Using entitlements from token', { category: 'api', route: '/api/platform/set', entitlements: effectiveEntitlements });
    }

    // Check if user is entitled to the requested platform
    const isPlatformAllowed =
      (platform === 'sam' && effectiveEntitlements.sam) ||
      (platform === 'health' && effectiveEntitlements.health) ||
      (platform === 'imdad' && effectiveEntitlements.imdad);
    
    if (!isPlatformAllowed) {
      logger.warn('Access denied for platform set', { category: 'api', route: '/api/platform/set', platform, userRole: payload.role });
      return NextResponse.json(
        { error: 'Forbidden', message: 'You are not entitled to access this platform' },
        { status: 403 }
      );
    }

    // Create response
    const response = NextResponse.json({ success: true, platform });

    // Set httpOnly cookie (use same secure setting as auth cookie)
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

    return response;
});

