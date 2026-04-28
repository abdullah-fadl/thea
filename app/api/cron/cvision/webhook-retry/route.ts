import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Webhook Retry Cron Endpoint
 * GET /api/cron/cvision/webhook-retry
 *
 * Picks up webhook events stuck in RETRYING / PENDING state whose nextRetry
 * timestamp has elapsed, and attempts redelivery.  Should be called every
 * 1-2 minutes via Vercel Cron, Render Cron, or an external scheduler.
 *
 * Security: Protected by CRON_SECRET (header or query param)
 */

import { NextRequest, NextResponse } from 'next/server';
import { retryFailedWebhooks } from '@/lib/cvision/saas/webhooks';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    if (!env.CRON_SECRET) {
      logger.error('[Webhook Retry Cron] CRON_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 },
      );
    }

    const headerSecret = request.headers.get('x-cron-secret');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const providedSecret = headerSecret || querySecret;

    if (!providedSecret || providedSecret !== env.CRON_SECRET) {
      logger.warn('[Webhook Retry Cron] Unauthorized cron request - invalid secret');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // ── Execute retries ──────────────────────────────────────────────────
    const result = await retryFailedWebhooks(50);

    logger.info(
      `[Webhook Retry Cron] Completed — processed: ${result.processed}, delivered: ${result.delivered}, failed: ${result.failed}, disabled: ${result.disabled}`,
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    logger.error('[Webhook Retry Cron] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to run webhook retry',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
