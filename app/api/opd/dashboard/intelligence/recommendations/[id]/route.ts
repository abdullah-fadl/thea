/**
 * OPD Intelligence — Recommendation Actions API
 *
 * PATCH /api/opd/dashboard/intelligence/recommendations/:id
 *
 * Body: { action: 'acknowledge' | 'dismiss', reason?: string }
 *
 * Marks a recommendation as acknowledged or dismissed.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { recommendationActionSchema } from '@/lib/validation/opd.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  // Extract id from URL
  const urlParts = req.nextUrl.pathname.split('/');
  const recId = urlParts[urlParts.length - 1];

  if (!recId) {
    return NextResponse.json({ error: 'Missing recommendation id' }, { status: 400 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const v = validateBody(body, recommendationActionSchema);
  if ('error' in v) return v.error;
  const { action, reason } = v.data;

  try {
    const now = new Date();
    const update: Record<string, any> = {};

    if (action === 'acknowledge') {
      update.acknowledged = true;
      update.acknowledgedAt = now;
      update.acknowledgedBy = userId || 'unknown';
    } else {
      update.dismissed = true;
      update.dismissedAt = now;
      update.dismissedBy = userId || 'unknown';
      if (reason) update.dismissReason = reason;
    }

    const existing = await prisma.opdRecommendation.findFirst({
      where: { tenantId, id: recId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    await prisma.opdRecommendation.update({
      where: { id: recId },
      data: update,
    });

    return NextResponse.json({
      success: true,
      id: recId,
      action,
      updatedAt: now.toISOString(),
    });
  } catch (err) {
    logger.error('Recommendation action error', { category: 'opd', error: err });
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 },
    );
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.dashboard.strategic' }
);
