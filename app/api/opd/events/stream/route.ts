import { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { createSSEStream } from '@/lib/realtime/sseManager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * OPD real-time event stream (SSE).
 *
 * Streams FLOW_STATE_CHANGE, NEW_PATIENT, and VITALS_SAVED events for the
 * authenticated user's tenant. Uses Redis Pub/Sub when available so events
 * propagate across multiple server instances; falls back to in-memory
 * EventEmitter in single-instance mode.
 *
 * GET /api/opd/events/stream
 */
export const GET = withAuthTenant(
  withErrorHandler((async (req: NextRequest, { tenantId, userId }: any) => {
    const stream = createSSEStream({
      tenantId,
      userId,
      signal: req.signal,
      // OPD-specific event types
      eventTypes: ['FLOW_STATE_CHANGE', 'NEW_PATIENT', 'VITALS_SAVED'],
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }) as any),
  { tenantScoped: true, platformKey: 'thea_health', permissionKeys: ['opd.queue.view', 'opd.doctor.schedule.view', 'opd.nursing.view'] }
);
