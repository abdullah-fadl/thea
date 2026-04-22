import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { prisma } from '@/lib/db/prisma';
import { evaluateLifecycle } from '@/lib/sam/lifecycle';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/cron/sam/lifecycle/run
 * Daily lifecycle automation for SAM library documents.
 * Protected by CRON_SECRET (header or query param).
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    if (!env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      );
    }

    const headerSecret = request.headers.get('x-cron-secret');
    const querySecret = request.nextUrl.searchParams.get('secret');
    const providedSecret = headerSecret || querySecret;
    if (!providedSecret || providedSecret !== env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { tenantId: true },
    });

    const now = new Date();
    const results: Array<{ tenantId: string; updated: number }> = [];

    for (const tenant of tenants) {
      const tenantId = tenant.tenantId;
      if (!tenantId) continue;

      const policies = await prisma.policyDocument.findMany({
        where: {
          tenantId: tenantId,
          isActive: true,
          deletedAt: null,
          archivedAt: null,
          OR: [
            { status: { not: 'ARCHIVED' } },
            { status: null as string },
          ],
        },
      });

      let updatedCount = 0;
      const events: any[] = [];

      for (const policy of policies) {
        const evaluation = evaluateLifecycle(policy, now);
        const updates: any = {};
        let needsUpdate = false;

        if (evaluation.nextReviewDate && !policy.nextReviewDate) {
          updates.nextReviewDate = evaluation.nextReviewDate;
          needsUpdate = true;
        }

        if (evaluation.status && policy.status !== evaluation.status) {
          updates.status = evaluation.status;
          updates.statusUpdatedAt = now;
          updates.updatedAt = now;
          needsUpdate = true;
          events.push({
            tenantId,
            policyId: policy.id,
            fromStatus: policy.status || 'ACTIVE',
            toStatus: evaluation.status,
            message: `Lifecycle update: ${policy.title || policy.originalFileName || policy.id} ${policy.status || 'ACTIVE'} → ${evaluation.status}`,
            createdAt: now,
          });
        }

        if (needsUpdate) {
          await prisma.policyDocument.updateMany({
            where: { id: policy.id, tenantId },
            data: updates as Record<string, unknown>,
          });
          updatedCount++;
        }
      }

      if (events.length > 0) {
        await prisma.policyLifecycleEvent.createMany({
          data: events,
        });
      }

      results.push({ tenantId, updated: updatedCount });
    }

    return NextResponse.json({ ok: true, results });
});
