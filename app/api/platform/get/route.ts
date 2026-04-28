import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { ACTIVE_PLATFORM_COOKIE, parseActivePlatform } from '@/lib/shell/platform';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/platform/get
 * Gets the current platform from cookie
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    // Require authentication — return 200 with null when unauthenticated (avoids 401 noise)
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return NextResponse.json({ platform: null });
    }

    const platform = parseActivePlatform(request.cookies.get(ACTIVE_PLATFORM_COOKIE)?.value);

    return NextResponse.json({ platform });
});

