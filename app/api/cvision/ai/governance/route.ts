import { logger } from '@/lib/monitoring/logger';
/**
 * CVision AI Governance API
 * GET  /api/cvision/ai/governance  - Stats, review queue, decision lookup, config, summary
 * POST /api/cvision/ai/governance  - Log decisions, review, bulk review, update config
 *
 * Central hub for AI decision tracking. Other AI routes (recommend, skills,
 * interview) log their decisions here. Provides a human review workflow,
 * governance stats, and audit trail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type { CVisionCandidate, CVisionEmployee } from '@/lib/cvision/types';
import {
  createDecisionLog,
  buildReviewQueueItem,
  calculateGovernanceStats,
  formatDecisionForAudit,
  getThreshold,
  evaluateConfidence,
  DEFAULT_GOVERNANCE_CONFIG,
  DECISION_TYPE_LABELS,
  type AIDecisionType,
  type AIDecisionLog,
  type GovernanceConfig,
  type ReviewQueueItem,
} from '@/lib/cvision/ai/ai-governance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Constants ──────────────────────────────────────────────────────────────

const AI_DECISIONS_COLLECTION = 'cvision_ai_decisions';
const AI_SETTINGS_COLLECTION = 'cvision_ai_settings';
const VALID_DECISION_TYPES: AIDecisionType[] = [
  'CV_PARSING',
  'JOB_MATCHING',
  'SKILL_ASSESSMENT',
  'SALARY_RECOMMENDATION',
  'INTERVIEW_SCORING',
  'PERFORMANCE_PREDICTION',
  'TRAINING_RECOMMENDATION',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates a simple unique ID for decision logs.
 */
function generateId(): string {
  return `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds a GovernanceConfig from defaults for a tenant.
 */
function buildGovernanceConfig(tenantId: string, userId: string): GovernanceConfig {
  return {
    ...DEFAULT_GOVERNANCE_CONFIG,
    tenantId,
    updatedAt: new Date(),
    updatedBy: userId,
  };
}

/**
 * Resolves an entity name for display in the review queue.
 * Fetches from the appropriate collection based on subjectType.
 */
async function resolveEntityName(
  tenantId: string,
  subjectType: AIDecisionLog['subjectType'],
  subjectId: string
): Promise<string> {
  try {
    if (subjectType === 'CANDIDATE') {
      const col = await getCVisionCollection<CVisionCandidate>(tenantId, 'candidates');
      const doc = await findById(col, tenantId, subjectId);
      return doc?.fullName || subjectId;
    }
    if (subjectType === 'EMPLOYEE') {
      const col = await getCVisionCollection<CVisionEmployee>(tenantId, 'employees');
      const doc = await findById(col, tenantId, subjectId);
      return (
        doc?.fullName ||
        `${doc?.firstName || ''} ${doc?.lastName || ''}`.trim() ||
        subjectId
      );
    }
    if (subjectType === 'JOB') {
      const col = await getCVisionCollection<any>(tenantId, 'jobRequisitions');
      const doc = await findById(col, tenantId, subjectId);
      return doc?.title || subjectId;
    }
    if (subjectType === 'DEPARTMENT') {
      const col = await getCVisionCollection<any>(tenantId, 'departments');
      const doc = await findById(col, tenantId, subjectId);
      return doc?.name || subjectId;
    }
  } catch {
    // Non-critical
  }
  return subjectId;
}

/**
 * Converts a raw DB document to the AIDecisionLog interface shape.
 */
function toDecisionLog(doc: any): AIDecisionLog {
  return {
    id: doc.id || doc._id?.toString(),
    tenantId: doc.tenantId,
    decisionType: doc.decisionType,
    confidence: doc.confidence,
    status: doc.status,
    subjectId: doc.subjectId,
    subjectType: doc.subjectType,
    inputSnapshot: doc.inputSnapshot || {},
    outputSnapshot: doc.outputSnapshot || {},
    reviewedBy: doc.reviewedBy,
    reviewedAt: doc.reviewedAt ? new Date(doc.reviewedAt) : undefined,
    reviewNotes: doc.reviewNotes,
    reasoning: doc.reasoning || '',
    createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    createdBy: doc.createdBy || '',
  };
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      const db = await getCVisionDb(tenantId);
      const decisionsCol = db.collection(AI_DECISIONS_COLLECTION);

      // ── action=config ─────────────────────────────────────────────
      if (action === 'config') {
        // Check for tenant-specific overrides
        let config: any = null;
        try {
          const settingsCol = db.collection(AI_SETTINGS_COLLECTION);
          config = await settingsCol.findOne({
            tenantId,
            key: 'ai_governance_config',
          });
        } catch {
          // No overrides found
        }

        return NextResponse.json({
          success: true,
          data: config?.value || DEFAULT_GOVERNANCE_CONFIG,
        });
      }

      // ── action=defaults (alias for config) ────────────────────────
      if (action === 'defaults') {
        return NextResponse.json({
          success: true,
          data: {
            config: DEFAULT_GOVERNANCE_CONFIG,
            decisionTypes: VALID_DECISION_TYPES,
            decisionTypeLabels: DECISION_TYPE_LABELS,
          },
        });
      }

      // ── action=stats ──────────────────────────────────────────────
      if (action === 'stats') {
        const fromParam = searchParams.get('from');
        const toParam = searchParams.get('to');
        const typeParam = searchParams.get('type') as AIDecisionType | null;

        const fromDate = fromParam ? new Date(fromParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // default: last 30 days
        const toDate = toParam ? new Date(toParam) : new Date();

        // Build query filter
        const filter: Record<string, any> = {
          tenantId,
          createdAt: { $gte: fromDate, $lte: toDate },
        };
        if (typeParam && VALID_DECISION_TYPES.includes(typeParam)) {
          filter.decisionType = typeParam;
        }

        const rawDocs = await decisionsCol.find(filter).limit(5000).toArray();
        const logs = rawDocs.map(toDecisionLog);

        const stats = calculateGovernanceStats(logs, fromDate, toDate);

        return NextResponse.json({
          success: true,
          data: {
            stats,
            period: { from: fromDate.toISOString(), to: toDate.toISOString() },
            totalDecisionsInPeriod: logs.length,
          },
        });
      }

      // ── action=review-queue ───────────────────────────────────────
      if (action === 'review-queue') {
        const priority = searchParams.get('priority'); // URGENT | NORMAL | LOW
        const status = searchParams.get('status') || 'PENDING_REVIEW';
        const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10) || 20, 100);
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
        const skip = (page - 1) * limit;

        // Base filter: pending reviews
        const filter: Record<string, any> = { tenantId, status };

        // Priority filtering by confidence ranges
        if (priority === 'URGENT') {
          filter.confidence = { $lt: 30 };
        } else if (priority === 'NORMAL') {
          filter.confidence = { $gte: 30, $lt: 50 };
        } else if (priority === 'LOW') {
          filter.confidence = { $gte: 50 };
        }

        // Count total before pagination
        const total = await decisionsCol.countDocuments(filter);

        // Fetch paginated results (oldest first)
        const rawDocs = await decisionsCol
          .find(filter)
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        // Count urgent items (confidence < 30 and PENDING_REVIEW)
        const urgentCount = await decisionsCol.countDocuments({
          tenantId,
          status: 'PENDING_REVIEW',
          confidence: { $lt: 30 },
        });

        // Build review queue items with entity names
        const items: ReviewQueueItem[] = [];
        for (const doc of rawDocs) {
          const log = toDecisionLog(doc);
          const queueItem = buildReviewQueueItem(log);

          // Enrich with entity name
          const entityName = await resolveEntityName(
            tenantId,
            log.subjectType,
            log.subjectId
          );
          // Override the summary with the resolved name
          const labels = DECISION_TYPE_LABELS[log.decisionType];
          if (entityName !== log.subjectId) {
            queueItem.summary =
              `${labels} for ${entityName} — confidence ${log.confidence}%`;
          }

          items.push(queueItem);
        }

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
          success: true,
          data: {
            items,
            total,
            page,
            limit,
            totalPages,
            urgentCount,
          },
        });
      }

      // ── action=decision ───────────────────────────────────────────
      if (action === 'decision') {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json(
            {
              success: false,
              error: 'id parameter is required',
            },
            { status: 400 }
          );
        }

        const doc = await decisionsCol.findOne({ tenantId, id });
        if (!doc) {
          return NextResponse.json(
            {
              success: false,
              error: 'Decision not found',
            },
            { status: 404 }
          );
        }

        const decision = toDecisionLog(doc);

        // Also resolve entity name
        const entityName = await resolveEntityName(
          tenantId,
          decision.subjectType,
          decision.subjectId
        );

        return NextResponse.json({
          success: true,
          data: {
            ...decision,
            subjectName: entityName,
            audit: formatDecisionForAudit(decision),
          },
        });
      }

      // ── action=summary ────────────────────────────────────────────
      if (action === 'summary') {
        // Aggregation: count by status
        const pipeline = [
          { $match: { tenantId } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ];

        const statusCounts = await decisionsCol.aggregate(pipeline).toArray();

        let total = 0;
        let autoApproved = 0;
        let pendingReview = 0;
        let humanApproved = 0;
        let humanRejected = 0;
        let overridden = 0;

        for (const row of statusCounts) {
          total += Number(row.count);
          switch (row._id) {
            case 'AUTO_APPROVED':
              autoApproved = Number(row.count);
              break;
            case 'PENDING_REVIEW':
              pendingReview = Number(row.count);
              break;
            case 'APPROVED':
              humanApproved = Number(row.count);
              break;
            case 'REJECTED':
              humanRejected = Number(row.count);
              break;
            case 'OVERRIDDEN':
              overridden = Number(row.count);
              break;
          }
        }

        // Find oldest pending review
        let oldestPending: string | null = null;
        if (pendingReview > 0) {
          const oldest = await decisionsCol
            .find({ tenantId, status: 'PENDING_REVIEW' })
            .sort({ createdAt: 1 })
            .limit(1)
            .toArray();
          if (oldest[0]?.createdAt) {
            oldestPending = new Date(oldest[0].createdAt).toISOString();
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            total,
            autoApproved,
            pendingReview,
            humanApproved,
            humanRejected,
            overridden,
            oldestPending,
          },
        });
      }

      // ── Default: API documentation ────────────────────────────────
      return NextResponse.json({
        success: true,
        data: {
          name: 'CVision AI Governance API',
          version: '1.0',
          endpoints: {
            GET: {
              'action=stats&from=2025-01-01&to=2025-12-31&type=CV_PARSING':
                'Governance stats for a period (optional: from, to, type)',
              'action=review-queue&priority=URGENT&limit=20&page=1':
                'Review queue with pending decisions (optional: priority, status, limit, page)',
              'action=decision&id=dec_xxx':
                'Single decision details with audit trail',
              'action=config':
                'Current governance config (tenant overrides or defaults)',
              'action=defaults':
                'Default config, decision types, and labels',
              'action=summary':
                'Quick count by status with oldest pending',
            },
            POST: {
              'log-decision':
                'Log a new AI decision (decisionType, confidence, subjectId, subjectType, inputSnapshot, outputSnapshot)',
              review:
                'Review a pending decision (decisionId, action: approve|reject|override, reviewNotes?)',
              'bulk-review':
                'Review multiple decisions at once (decisionIds[], action: approve|reject, reviewNotes?)',
              'update-config':
                'Update tenant-specific governance thresholds',
            },
          },
          decisionTypes: VALID_DECISION_TYPES,
        },
      });
    } catch (error: any) {
      logger.error('[Governance API GET]', error?.message || String(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_READ }
);

// ─── POST Handler ───────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const db = await getCVisionDb(tenantId);
      const decisionsCol = db.collection(AI_DECISIONS_COLLECTION);

      // ── action=log-decision ───────────────────────────────────────
      if (action === 'log-decision') {
        const {
          decisionType,
          confidence,
          subjectId,
          subjectType,
          inputSnapshot,
          outputSnapshot,
          modelUsed,
          modelProvider,
          processingTimeMs,
          tokenUsage,
          metadata: extraMetadata,
        } = body;

        // Validate required fields
        if (!decisionType || confidence === undefined || !subjectId || !subjectType) {
          return NextResponse.json(
            {
              success: false,
              error:
                'Required fields: decisionType, confidence, subjectId, subjectType',
            },
            { status: 400 }
          );
        }

        if (!VALID_DECISION_TYPES.includes(decisionType)) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid decisionType. Valid types: ${VALID_DECISION_TYPES.join(', ')}`,
            },
            { status: 400 }
          );
        }

        const confidenceNum = parseFloat(String(confidence));
        if (isNaN(confidenceNum) || confidenceNum < 0 || confidenceNum > 100) {
          return NextResponse.json(
            {
              success: false,
              error: 'confidence must be a number between 0 and 100',
            },
            { status: 400 }
          );
        }

        // Build governance config (check for tenant overrides)
        let govConfig = buildGovernanceConfig(tenantId, userId);
        try {
          const settingsCol = db.collection(AI_SETTINGS_COLLECTION);
          const tenantConfig = await settingsCol.findOne({
            tenantId,
            key: 'ai_governance_config',
          });
          if (tenantConfig?.value) {
            govConfig = {
              ...govConfig,
              ...tenantConfig.value,
              tenantId,
            };
          }
        } catch {
          // Use defaults
        }

        // Create the decision log
        const decisionId = generateId();
        const decisionLog = createDecisionLog({
          id: decisionId,
          tenantId,
          decisionType,
          confidence: confidenceNum,
          subjectId,
          subjectType,
          inputSnapshot: {
            ...(inputSnapshot || {}),
            modelUsed: modelUsed || undefined,
            modelProvider: modelProvider || undefined,
            processingTimeMs: processingTimeMs || undefined,
            tokenUsage: tokenUsage || undefined,
          },
          outputSnapshot: outputSnapshot || {},
          config: govConfig,
          createdBy: userId,
        });

        // Attach extra metadata if provided
        const docToInsert: any = {
          ...decisionLog,
          tenantId,
        };
        if (extraMetadata) {
          docToInsert.metadata = extraMetadata;
        }

        // Insert into DB
        await decisionsCol.insertOne(docToInsert);

        // If pending review, create a notification for HR admins
        let notificationSent = false;
        if (decisionLog.status === 'PENDING_REVIEW') {
          try {
            const notifCol = await getCVisionCollection<any>(
              tenantId,
              'notifications'
            );
            const labels = DECISION_TYPE_LABELS[decisionType];

            await notifCol.insertOne({
              id: `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              tenantId,
              type: 'AI_REVIEW_REQUIRED',
              title_en: `AI Decision Needs Review: ${labels}`,
              message_en: `A ${labels} decision with ${confidenceNum}% confidence requires human review.`,
              recipientUserIds: [],
              recipientRoles: ['admin', 'hr-admin'],
              candidateId: subjectType === 'CANDIDATE' ? subjectId : undefined,
              candidateName: '',
              priority: confidenceNum < 30 ? 'high' : 'medium',
              actionUrl: `/cvision/ai/governance?decision=${decisionId}`,
              readBy: [],
              meta: {
                decisionLogId: decisionId,
                decisionType,
                confidence: confidenceNum,
                subjectType,
                subjectId,
              },
              createdAt: new Date(),
              createdBy: userId,
            });
            notificationSent = true;
          } catch (e) {
            logger.error('[Governance API] Failed to send notification:', e);
            // Non-critical
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            decisionLog,
            notificationSent,
          },
        });
      }

      // ── action=review ─────────────────────────────────────────────
      if (action === 'review') {
        const {
          decisionId,
          action: reviewAction,
          reviewNotes,
        } = body;

        if (!decisionId || !reviewAction) {
          return NextResponse.json(
            {
              success: false,
              error: 'decisionId and action (approve|reject|override) are required',
            },
            { status: 400 }
          );
        }

        const validActions = ['approve', 'reject', 'override'];
        if (!validActions.includes(reviewAction)) {
          return NextResponse.json(
            {
              success: false,
              error: `Invalid review action. Valid: ${validActions.join(', ')}`,
            },
            { status: 400 }
          );
        }

        // Fetch the decision
        const doc = await decisionsCol.findOne({ tenantId, id: decisionId });
        if (!doc) {
          return NextResponse.json(
            {
              success: false,
              error: 'Decision not found',
            },
            { status: 404 }
          );
        }

        if (doc.status !== 'PENDING_REVIEW') {
          return NextResponse.json(
            {
              success: false,
              error: `Decision already reviewed (current status: ${doc.status})`,
            },
            { status: 400 }
          );
        }

        // Determine new status
        const statusMap: Record<string, AIDecisionLog['status']> = {
          approve: 'APPROVED',
          reject: 'REJECTED',
          override: 'OVERRIDDEN',
        };
        const newStatus = statusMap[reviewAction];
        const now = new Date();

        // Update in DB
        await decisionsCol.updateOne(
          { tenantId, id: decisionId },
          {
            $set: {
              status: newStatus,
              reviewedBy: userId,
              reviewedAt: now,
              reviewNotes: reviewNotes || undefined,
              updatedAt: now,
            },
          }
        );

        // Build updated decision for response
        const updatedDecision = toDecisionLog({
          ...doc,
          status: newStatus,
          reviewedBy: userId,
          reviewedAt: now,
          reviewNotes: reviewNotes || undefined,
        });

        // Format for audit trail
        const auditEntry = formatDecisionForAudit(updatedDecision);
        logger.info('[Governance Audit]', auditEntry);

        return NextResponse.json({
          success: true,
          data: {
            updated: true,
            decision: updatedDecision,
            audit: auditEntry,
          },
        });
      }

      // ── action=bulk-review ────────────────────────────────────────
      if (action === 'bulk-review') {
        const {
          decisionIds,
          action: reviewAction,
          reviewNotes,
        } = body;

        if (
          !decisionIds ||
          !Array.isArray(decisionIds) ||
          decisionIds.length === 0
        ) {
          return NextResponse.json(
            {
              success: false,
              error: 'decisionIds must be a non-empty array',
            },
            { status: 400 }
          );
        }

        if (decisionIds.length > 50) {
          return NextResponse.json(
            {
              success: false,
              error: 'Maximum 50 decisions per bulk review',
            },
            { status: 400 }
          );
        }

        const validActions = ['approve', 'reject'];
        if (!reviewAction || !validActions.includes(reviewAction)) {
          return NextResponse.json(
            {
              success: false,
              error: `action must be 'approve' or 'reject'`,
            },
            { status: 400 }
          );
        }

        const statusMap: Record<string, AIDecisionLog['status']> = {
          approve: 'APPROVED',
          reject: 'REJECTED',
        };
        const newStatus = statusMap[reviewAction];
        const now = new Date();

        // Only update decisions that are still PENDING_REVIEW
        const result = await decisionsCol.updateMany(
          {
            tenantId,
            id: { $in: decisionIds },
            status: 'PENDING_REVIEW',
          },
          {
            $set: {
              status: newStatus,
              reviewedBy: userId,
              reviewedAt: now,
              reviewNotes: reviewNotes || undefined,
              updatedAt: now,
            },
          }
        );

        const updatedCount = result.modifiedCount;
        const skippedCount = decisionIds.length - updatedCount;

        return NextResponse.json({
          success: true,
          data: {
            updatedCount,
            skippedCount,
            newStatus,
            reviewedBy: userId,
          },
        });
      }

      // ── action=update-config ──────────────────────────────────────
      if (action === 'update-config') {
        const {
          thresholds,
          globalAutoApproveEnabled,
          maxPendingReviews,
          retentionDays,
        } = body;

        // Build partial config update
        const configUpdate: Record<string, any> = {};
        if (thresholds !== undefined) configUpdate.thresholds = thresholds;
        if (globalAutoApproveEnabled !== undefined)
          configUpdate.globalAutoApproveEnabled = globalAutoApproveEnabled;
        if (maxPendingReviews !== undefined)
          configUpdate.maxPendingReviews = maxPendingReviews;
        if (retentionDays !== undefined)
          configUpdate.retentionDays = retentionDays;

        if (Object.keys(configUpdate).length === 0) {
          return NextResponse.json(
            {
              success: false,
              error:
                'At least one config field is required (thresholds, globalAutoApproveEnabled, maxPendingReviews, retentionDays)',
            },
            { status: 400 }
          );
        }

        // Upsert into settings collection
        const settingsCol = db.collection(AI_SETTINGS_COLLECTION);
        const now = new Date();

        await settingsCol.updateOne(
          { tenantId, key: 'ai_governance_config' },
          {
            $set: {
              tenantId,
              key: 'ai_governance_config',
              value: configUpdate,
              updatedAt: now,
              updatedBy: userId,
            },
          },
          { upsert: true }
        );

        // Merge with defaults for the response
        const mergedConfig = {
          ...DEFAULT_GOVERNANCE_CONFIG,
          ...configUpdate,
          tenantId,
          updatedAt: now,
          updatedBy: userId,
        };

        return NextResponse.json({
          success: true,
          data: {
            config: mergedConfig,
            message: 'Governance config updated',
          },
        });
      }

      // ── Unknown action ────────────────────────────────────────────
      return NextResponse.json(
        {
          success: false,
          error: `Invalid action: ${action || 'none'}. Valid actions: log-decision, review, bulk-review, update-config`,
        },
        { status: 400 }
      );
    } catch (error: any) {
      logger.error('[Governance API POST]', error?.message || String(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.EMPLOYEES_WRITE }
);
