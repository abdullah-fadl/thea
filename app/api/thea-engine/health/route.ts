import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/thea-engine/health
 * 
 * Public health check endpoint that proxies to the thea-engine backend.
 * This endpoint does NOT require authentication as it's used for liveness checks.
 * 
 * Response:
 * {
 *   ok: boolean
 * }
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // Get thea-engine URL from env (already has default in lib/env.ts)
  const theaEngineUrl = `${env.THEA_ENGINE_URL}/health`;

  const response = await fetch(theaEngineUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json(
      { error: `Thea health check failed: ${errorText}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
});

