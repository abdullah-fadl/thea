import { logger } from '@/lib/monitoring/logger';
/**
 * Confidence Threshold & Human Review Queue API
 *
 * GET  /api/cvision/ai/threshold — thresholds, queue, queue-stats, item-detail, accuracy, history, escalated
 * POST /api/cvision/ai/threshold — review, assign, escalate, update-threshold, bulk-review, run-escalation
 *
 * Separate from /api/cvision/ai/governance (existing basic governance).
 * This API adds rich human review workflow with expiration, escalation, and feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getThresholdConfigs,
  updateThreshold,
  getPendingReviews,
  getQueueStats,
  getReviewItem,
  reviewItem,
  assignReview,
  escalateOverdueItems,
  manualEscalate,
  bulkReview,
  getReviewHistory,
  calculateModuleAccuracy,
  seedSampleReviewData,
} from '@/lib/cvision/ai/confidence-threshold-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function ok(data: any) {
  return NextResponse.json({ success: true, data });
}
function fail(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET = withAuthTenant(async (request: NextRequest, { tenantId }) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'thresholds';

  try {
    switch (action) {
      case 'thresholds': {
        const configs = await getThresholdConfigs(tenantId);
        return ok({ thresholds: configs });
      }

      case 'queue': {
        const moduleId = url.searchParams.get('moduleId') || undefined;
        const priority = url.searchParams.get('priority') || undefined;
        const status = url.searchParams.get('status') || undefined;
        const assignedTo = url.searchParams.get('assignedTo') || undefined;

        // Seed sample data on first access
        await seedSampleReviewData(tenantId);

        const items = await getPendingReviews(tenantId, { moduleId, priority, status, assignedTo });
        return ok({ items, total: items.length });
      }

      case 'queue-stats': {
        await seedSampleReviewData(tenantId);
        const stats = await getQueueStats(tenantId);
        return ok(stats);
      }

      case 'item-detail': {
        const reviewId = url.searchParams.get('reviewId');
        if (!reviewId) return fail('reviewId required');
        const item = await getReviewItem(tenantId, reviewId);
        if (!item) return fail('Review item not found', 404);
        return ok({ item });
      }

      case 'accuracy': {
        const modId = url.searchParams.get('moduleId') || undefined;
        await seedSampleReviewData(tenantId);
        const accuracy = await calculateModuleAccuracy(tenantId, modId);
        return ok({ modules: accuracy });
      }

      case 'history': {
        const modId2 = url.searchParams.get('moduleId') || undefined;
        const decision = url.searchParams.get('decision') || undefined;
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const history = await getReviewHistory(tenantId, { moduleId: modId2, decision, limit });
        return ok({ items: history, total: history.length });
      }

      case 'escalated': {
        const escalated = await getPendingReviews(tenantId, { status: 'ESCALATED' });
        return ok({ items: escalated, total: escalated.length });
      }

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    logger.error('[Threshold API GET]', err);
    return fail(err.message || 'Internal error', 500);
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST = withAuthTenant(async (request: NextRequest, { tenantId, userId }) => {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'review': {
        const { reviewId, decision, reasoning, modifiedDecision, feedbackScore, feedbackComment } = body;
        if (!reviewId || !decision || !reasoning) return fail('reviewId, decision, reasoning required');
        if (!['AGREE', 'DISAGREE', 'MODIFY'].includes(decision)) return fail('decision must be AGREE, DISAGREE, or MODIFY');
        if (decision === 'MODIFY' && !modifiedDecision) return fail('modifiedDecision required when decision is MODIFY');

        const item = await reviewItem({
          tenantId,
          reviewId,
          decision,
          reasoning,
          modifiedDecision,
          reviewedBy: userId,
          reviewedByName: body.reviewedByName,
          feedbackScore,
          feedbackComment,
        });
        return ok({ item });
      }

      case 'assign': {
        const { reviewId, assignTo, assignToName } = body;
        if (!reviewId || !assignTo) return fail('reviewId, assignTo required');
        const success = await assignReview(tenantId, reviewId, assignTo, assignToName);
        return ok({ assigned: success });
      }

      case 'escalate': {
        const { reviewId, escalateTo } = body;
        if (!reviewId) return fail('reviewId required');
        const success = await manualEscalate(tenantId, reviewId, escalateTo || 'OWNER');
        return ok({ escalated: success });
      }

      case 'update-threshold': {
        const { moduleId, autoApproveThreshold, reviewThreshold, autoRejectThreshold, escalationRole, maxReviewTime } = body;
        if (!moduleId) return fail('moduleId required');

        if (autoApproveThreshold !== undefined && reviewThreshold !== undefined && autoApproveThreshold <= reviewThreshold) {
          return fail('autoApproveThreshold must be greater than reviewThreshold');
        }
        if (reviewThreshold !== undefined && autoRejectThreshold !== undefined && reviewThreshold <= autoRejectThreshold) {
          return fail('reviewThreshold must be greater than autoRejectThreshold');
        }

        const updated = await updateThreshold(tenantId, moduleId, {
          autoApproveThreshold,
          reviewThreshold,
          autoRejectThreshold,
          escalationRole,
          maxReviewTime,
        }, userId);
        return ok({ threshold: updated });
      }

      case 'bulk-review': {
        const { reviewIds, decision } = body;
        if (!Array.isArray(reviewIds) || reviewIds.length === 0) return fail('reviewIds array required');
        if (!['AGREE', 'DISAGREE'].includes(decision)) return fail('decision must be AGREE or DISAGREE');
        const count = await bulkReview(tenantId, reviewIds, decision, userId, body.reviewedByName);
        return ok({ reviewed: count });
      }

      case 'run-escalation': {
        const result = await escalateOverdueItems(tenantId);
        return ok(result);
      }

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    logger.error('[Threshold API POST]', err);
    return fail(err.message || 'Internal error', 500);
  }
},
  { platformKey: 'cvision', permissionKey: 'cvision.view' });
