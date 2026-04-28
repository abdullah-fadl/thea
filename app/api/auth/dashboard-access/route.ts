import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { canAccessMainDashboard } from '@/lib/permissions-helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/auth/dashboard-access
 * 
 * Check if the current user can access the main dashboard
 * Returns: { canAccess: boolean }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const canAccess = canAccessMainDashboard(user);

    return NextResponse.json({ canAccess });
});

