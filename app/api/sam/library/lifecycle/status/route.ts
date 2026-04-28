import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import type { PolicyDocument } from '@/lib/models/Policy';
import { evaluateLifecycle } from '@/lib/sam/lifecycle';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Auto-update lifecycle status based on dates
 * Called periodically (e.g., via cron job or scheduled task)
 */
export async function POST(request: NextRequest) {
  return withAuthTenant(
  withErrorHandler(async (req, { tenantId }) => {
    try {
      const now = new Date();
      const policies = await prisma.policyDocument.findMany({
        where: {
          isActive: true,
          tenantId: tenantId,
        },
        take: 500,
      }) as unknown as PolicyDocument[];

      let updatedCount = 0;
      const transitions: Array<{ itemId: string; from: string; to: string; message: string }> = [];

      for (const policy of policies) {
        const policyRecord = policy as PolicyDocument & any;
        const normalizedStatus = String(policyRecord.status || '').toLowerCase();
        if (normalizedStatus === 'archived' || policyRecord.archivedAt) {
          continue;
        }
        const evaluation = evaluateLifecycle(policy, now);
        const updates: any = {};
        let needsUpdate = false;

        if (evaluation.nextReviewDate && !policy.nextReviewDate) {
          updates.nextReviewDate = evaluation.nextReviewDate;
            needsUpdate = true;
        }

        const currentStatus = String(policyRecord.status || '');
        const nextStatus = evaluation.status ? String(evaluation.status) : '';
        if (nextStatus && currentStatus !== nextStatus) {
          updates.status = evaluation.status;
          updates.statusUpdatedAt = now;
            updates.updatedAt = now;
          needsUpdate = true;
          transitions.push({
            itemId: policy.id,
            from: currentStatus || 'ACTIVE',
            to: nextStatus,
            message: `Lifecycle update: ${policy.title || policy.originalFileName || policy.id} ${currentStatus || 'ACTIVE'} → ${nextStatus}`,
          });
        }

        if (needsUpdate) {
          await prisma.policyDocument.updateMany({
            where: { id: policy.id, tenantId: tenantId },
            data: updates as Prisma.PolicyDocumentUncheckedUpdateManyInput,
          });
          updatedCount++;
        }
      }

      if (transitions.length > 0) {
        await prisma.policyLifecycleEvent.createMany({
          data: transitions.map(event => ({
            tenantId,
            policyId: event.itemId,
            fromStatus: event.from,
            toStatus: event.to,
            message: event.message,
            createdAt: now,
          })),
        });
      }

      return NextResponse.json({
        success: true,
        updatedCount,
        transitions,
        message: `Updated ${updatedCount} policies`,
      });
    } catch (error) {
      logger.error('Lifecycle status update error:', { error: error });
      return NextResponse.json(
        // [SEC-10]
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }),
  { platformKey: 'sam', tenantScoped: true })(request);
}
