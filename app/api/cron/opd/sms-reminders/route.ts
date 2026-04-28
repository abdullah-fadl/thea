import { NextRequest, NextResponse } from 'next/server';
import { runSmsReminders } from '@/lib/notifications/smsReminders';
import { env } from '@/lib/env';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  if (!env.CRON_SECRET) {
    logger.error('CRON_SECRET environment variable is not set', { category: 'opd' });
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 });
  }

  const headerSecret = request.headers.get('x-cron-secret');
  const querySecret = request.nextUrl.searchParams.get('secret');
  const providedSecret = headerSecret || querySecret;

  if (!providedSecret || providedSecret !== env.CRON_SECRET) {
    logger.warn('Unauthorized cron request - invalid secret', { category: 'opd' });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runSmsReminders();

  return NextResponse.json({
    ok: true,
    scanned: result.scanned,
    sent: result.sent,
    ...(result.errors && result.errors.length > 0 && { errors: result.errors }),
  });
});
