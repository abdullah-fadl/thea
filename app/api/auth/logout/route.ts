import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { verifyTokenEdge } from '@/lib/auth/edge';
import { deleteSession } from '@/lib/auth/sessions';
import { env } from '@/lib/env';
import { revokeAllUserRefreshTokens, revokeRefreshToken } from '@/lib/core/auth/refreshToken';
import { clearSessionState } from '@/lib/core/auth/sessionRestore';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    // Get tokens from cookies
    const accessToken = request.cookies.get('auth-token')?.value;
    const refreshToken = request.cookies.get('refresh-token')?.value;
    let payload: any = null;

    if (accessToken) {
      payload = await verifyTokenEdge(accessToken);
      if (payload?.userId) {
        // Revoke all refresh tokens for user
        await revokeAllUserRefreshTokens(payload.userId);
        
        // Clear session state (but keep metadata)
        await clearSessionState(payload.userId);
        
        // Delete the session
        if (payload.sessionId) {
          await deleteSession(payload.sessionId);
        }
      }
    }
    
    // Also revoke the specific refresh token if provided
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    if (payload?.userId) {
      await createAuditLog(
        'auth',
        payload.userId,
        'USER_LOGGED_OUT',
        payload.userId,
        undefined,
        { sessionId: payload.sessionId || null },
        (payload as Record<string, unknown>).tenantId as string
      );
    }

    const response = NextResponse.json({ success: true });

    // Clear all auth cookies (use same secure setting as login)
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    const cookieOptions = {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict' as const,
      maxAge: 0,
      path: '/',
    };
    
    // Clear access token
    response.headers.append(
      'Set-Cookie',
      serialize('auth-token', '', cookieOptions)
    );
    
    // Clear refresh token
    response.headers.append(
      'Set-Cookie',
      serialize('refresh-token', '', cookieOptions)
    );

    return response;
  } catch (error) {
    logger.error('Logout error', { category: 'auth', error });
    // Still return success even if session deletion fails
    const response = NextResponse.json({ success: true });
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    response.headers.set(
      'Set-Cookie',
      serialize('auth-token', '', {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      })
    );
    return response;
  }
});
