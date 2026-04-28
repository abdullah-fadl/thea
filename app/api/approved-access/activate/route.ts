/**
 * POST /api/approved-access/activate
 * Owner activates an approved access token (sets cookie)
 */

import { NextRequest, NextResponse } from 'next/server';
import { serialize } from 'cookie';
import { requireOwner } from '@/lib/core/owner/separation';
import { getApprovedAccessByToken, recordTokenUsage } from '@/lib/core/owner/approvedAccess';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const activateSchema = z.object({
  accessToken: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    // Require owner role
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { accessToken } = activateSchema.parse(body);

    // Verify token belongs to this owner
    const approvedAccess = await getApprovedAccessByToken(accessToken);
    if (!approvedAccess) {
      return NextResponse.json(
        { error: 'Invalid token', message: 'Access token not found or expired' },
        { status: 404 }
      );
    }

    if (approvedAccess.ownerId !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'This access token does not belong to you' },
        { status: 403 }
      );
    }

    // Record usage
    await recordTokenUsage(accessToken);

    // Set cookie with approved access token
    const protocol = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https://') ? 'https' : 'http');
    const isSecure = protocol === 'https';
    
    const response = NextResponse.json({
      success: true,
      tenantId: approvedAccess.tenantId,
      expiresAt: approvedAccess.expiresAt,
      message: 'Approved access activated',
    });

    response.headers.set(
      'Set-Cookie',
      serialize('approved_access_token', accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'strict',
        maxAge: Math.floor((approvedAccess.expiresAt.getTime() - Date.now()) / 1000),
        path: '/',
      })
    );

    return response;
  } catch (error) {
    logger.error('Activate access error', { category: 'api', error });
    
    // [SEC-06]
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    throw error;
  }
});
