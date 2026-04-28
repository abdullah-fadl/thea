import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import { saveSessionState } from '@/lib/core/auth/sessionRestore';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

const saveSessionStateSchema = z.object({
  lastRoute: z.string().optional(),
  lastPlatformKey: z.string().optional(),
});

/**
 * POST /api/auth/save-session-state
 * Save current session state (lastRoute, lastPlatformKey)
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const { lastRoute, lastPlatformKey } = saveSessionStateSchema.parse(body);

    await saveSessionState(authResult.userId, {
      lastRoute,
      lastPlatformKey: lastPlatformKey as string,
    });

    return NextResponse.json({ success: true });
});
