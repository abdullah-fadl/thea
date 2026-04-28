/**
 * Global SSE Events Stream — `/api/events/stream`
 *
 * Real-time event stream for the authenticated user's tenant.
 * Streams all event types by default, or a filtered subset when
 * the `types` query parameter is provided.
 *
 * GET /api/events/stream?types=FLOW_STATE_CHANGE,VITALS_SAVED
 *
 * Uses Redis Pub/Sub when available so events propagate across multiple
 * server instances; falls back to in-memory EventEmitter in single-instance
 * mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { createSSEStream } from '@/lib/realtime/sseManager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    // Parse optional event type filter from query string
    const typesParam = req.nextUrl.searchParams.get('types');
    const eventTypes = typesParam
      ? typesParam.split(',').map((t) => t.trim()).filter(Boolean)
      : undefined;

    const stream = createSSEStream({
      tenantId,
      userId,
      signal: req.signal,
      eventTypes,
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health' },
);
