import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/docs/openapi';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/docs
 *
 * Serves the OpenAPI 3.1 JSON specification.
 * No authentication required — public documentation endpoint.
 */
export const GET = withErrorHandler(async () => {
  logger.debug('Serving OpenAPI spec', { category: 'api', route: '/api/docs' });

  const spec = generateOpenAPISpec();

  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});

/**
 * OPTIONS /api/docs — CORS preflight
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
});
