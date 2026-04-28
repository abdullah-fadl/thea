/**
 * Confidence Threshold Engine — Extended AI Governance
 *
 * Provides module-specific confidence thresholds, a rich human review queue
 * with expiration/escalation, feedback loops, and accuracy tracking.
 *
 * Works alongside (not replacing) the existing ai-governance.ts which
 * handles the core decision logging. This engine adds:
 * - Per-module configurable thresholds (7 AI modules)
 * - Expiring review items with auto-escalation
 * - Human feedback (1-5 star) on AI quality
 * - Accuracy calculation per module
 * - Sample data seeding for first-visit UX
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionDb } from '@/lib/cvision/db';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ThresholdConfig {
  id: string;
  tenantId: string;
  moduleId: string;
  moduleName: string;
  autoApproveThreshold: number;
  reviewThreshold: number;
  autoRejectThreshold: number;
  isActive: boolean;
  escalationRole: string;
  maxReviewTime: number;
  lastUpdated: Date;
  updatedBy: string;
}

export type ReviewStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'OVERRIDDEN'
  | 'ESCALATED'
  | 'EXPIRED';

export type ReviewPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface ReviewQueueItem {
  id: string;
  tenantId: string;
  reviewId: string;
  moduleId: string;
  moduleName: string;
  decisionType: string;
  confidenceScore: number;
  aiDecision: string;
  aiReasoning: string;
  entityType: 'EMPLOYEE' | 'CANDIDATE' | 'JOB' | 'DEPARTMENT' | 'SCENARIO';
  entityId: string;
  entityName: string;
  relatedData: Record<string, any>;
  autoApproveThreshold: number;
  reviewThreshold: number;
  gap: number;
  status: ReviewStatus;
  priority: ReviewPriority;
  assignedTo?: string;
  assignedToName?: string;
  humanDecision?: 'AGREE' | 'DISAGREE' | 'MODIFY';
  humanReasoning?: string;
  modifiedDecision?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewedByName?: string;
  feedbackScore?: number;
  feedbackComment?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  escalatedAt?: Date;
  escalatedTo?: string;
}

export interface DecisionOutcome {
  id: string;
  tenantId: string;
  reviewId: string;
  moduleId: string;
  aiDecision: string;
  humanDecision: string;
  finalOutcome: string;
  wasAiCorrect: boolean;
  confidenceScore: number;
  createdAt: Date;
}

export interface ModuleAccuracy {
  moduleId: string;
  moduleName: string;
  totalDecisions: number;
  autoApproved: number;
  humanReviewed: number;
  autoRejected: number;
  humanAgreedWithAI: number;
  humanDisagreedWithAI: number;
  accuracyRate: number;
  avgConfidence: number;
  confidenceDistribution: { range: string; count: number }[];
}

export interface QueueStats {
  totalPending: number;
  inReview: number;
  escalated: number;
  completedToday: number;
  completedAllTime: number;
  avgWaitHours: number;
  overdueCount: number;
  byModule: { moduleId: string; moduleName: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

// ─── Default Thresholds ─────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: Record<string, Omit<ThresholdConfig, 'id' | 'tenantId' | 'lastUpdated' | 'updatedBy'>> = {
  'ai-matching': {
    moduleId: 'ai-matching',
    moduleName: 'AI Job Matching',
    autoApproveThreshold: 85,
    reviewThreshold: 60,
    autoRejectThreshold: 30,
    isActive: true,
    escalationRole: 'HR_MANAGER',
    maxReviewTime: 48,
  },
  'retention-risk': {
    moduleId: 'retention-risk',
    moduleName: 'Retention Risk Prediction',
    autoApproveThreshold: 80,
    reviewThreshold: 50,
    autoRejectThreshold: 20,
    isActive: true,
    escalationRole: 'HR_MANAGER',
    maxReviewTime: 72,
  },
  'candidate-ranking': {
    moduleId: 'candidate-ranking',
    moduleName: 'Candidate Ranking',
    autoApproveThreshold: 80,
    reviewThreshold: 55,
    autoRejectThreshold: 35,
    isActive: true,
    escalationRole: 'HR_MANAGER',
    maxReviewTime: 48,
  },
  'skills-assessment': {
    moduleId: 'skills-assessment',
    moduleName: 'Skills Gap Assessment',

    autoApproveThreshold: 75,
    reviewThreshold: 50,
    autoRejectThreshold: 25,
    isActive: true,
    escalationRole: 'MANAGER',
    maxReviewTime: 96,
  },
  'interview-scoring': {
    moduleId: 'interview-scoring',
    moduleName: 'Interview Chatbot Scoring',

    autoApproveThreshold: 80,
    reviewThreshold: 50,
    autoRejectThreshold: 30,
    isActive: true,
    escalationRole: 'HR_MANAGER',
    maxReviewTime: 48,
  },
  'whatif-simulation': {
    moduleId: 'whatif-simulation',
    moduleName: 'What-If Simulation',

    autoApproveThreshold: 90,
    reviewThreshold: 70,
    autoRejectThreshold: 40,
    isActive: true,
    escalationRole: 'OWNER',
    maxReviewTime: 24,
  },
  'promotion-readiness': {
    moduleId: 'promotion-readiness',
    moduleName: 'Promotion Readiness',

    autoApproveThreshold: 80,
    reviewThreshold: 55,
    autoRejectThreshold: 30,
    isActive: true,
    escalationRole: 'HR_MANAGER',
    maxReviewTime: 72,
  },
};

// ─── Collection helpers ─────────────────────────────────────────────────────

async function thresholdsCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_ai_thresholds');
}

async function queueCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_review_queue');
}

async function outcomesCol(tenantId: string) {
  const db = await getCVisionDb(tenantId);
  return db.collection('cvision_decision_outcomes');
}

// ─── Threshold CRUD ─────────────────────────────────────────────────────────

export async function getThresholdConfigs(tenantId: string): Promise<ThresholdConfig[]> {
  const col = await thresholdsCol(tenantId);
  const existing = await col.find({ tenantId }).sort({ moduleId: 1 }).toArray() as unknown as ThresholdConfig[];
  if (existing.length > 0) return existing;

  // Seed defaults
  const now = new Date();
  const docs = Object.values(DEFAULT_THRESHOLDS).map(t => ({
    ...t,
    id: uuidv4(),
    tenantId,
    lastUpdated: now,
    updatedBy: 'system',
  }));
  await col.insertMany(docs);
  return docs as ThresholdConfig[];
}

export async function getThresholdForModule(tenantId: string, moduleId: string): Promise<ThresholdConfig | null> {
  const configs = await getThresholdConfigs(tenantId);
  return configs.find(c => c.moduleId === moduleId) || null;
}

export async function updateThreshold(
  tenantId: string,
  moduleId: string,
  updates: Partial<ThresholdConfig>,
  updatedBy: string,
): Promise<ThresholdConfig> {
  const col = await thresholdsCol(tenantId);
  const now = new Date();

  // Validate ordering: autoApprove > review > reject
  if (updates.autoApproveThreshold !== undefined && updates.reviewThreshold !== undefined) {
    if (updates.autoApproveThreshold <= updates.reviewThreshold) {
      throw new Error('Auto-approve threshold must be greater than review threshold');
    }
  }
  if (updates.reviewThreshold !== undefined && updates.autoRejectThreshold !== undefined) {
    if (updates.reviewThreshold <= updates.autoRejectThreshold) {
      throw new Error('Review threshold must be greater than auto-reject threshold');
    }
  }

  const $set: Record<string, unknown> = {
    ...updates,
    lastUpdated: now,
    updatedBy,
  };
  delete $set.id;
  delete $set.tenantId;
  delete $set.moduleId;

  await col.updateOne({ tenantId, moduleId }, { $set });
  return (await col.findOne({ tenantId, moduleId })) as unknown as ThresholdConfig;
}

// ─── Confidence Evaluation ──────────────────────────────────────────────────

export function evaluateConfidence(
  moduleId: string,
  confidenceScore: number,
  thresholdConfig?: ThresholdConfig,
): {
  action: 'AUTO_APPROVE' | 'HUMAN_REVIEW' | 'AUTO_REJECT';
  reason: string;
  gap: number;
} {
  const defaults = DEFAULT_THRESHOLDS[moduleId];
  const autoApprove = thresholdConfig?.autoApproveThreshold ?? defaults?.autoApproveThreshold ?? 80;
  const review = thresholdConfig?.reviewThreshold ?? defaults?.reviewThreshold ?? 50;
  const reject = thresholdConfig?.autoRejectThreshold ?? defaults?.autoRejectThreshold ?? 30;

  if (confidenceScore >= autoApprove) {
    return {
      action: 'AUTO_APPROVE',
      reason: `Confidence ${confidenceScore}% meets auto-approve threshold (${autoApprove}%)`,
      gap: 0,
    };
  }
  if (confidenceScore < reject) {
    return {
      action: 'AUTO_REJECT',
      reason: `Confidence ${confidenceScore}% is below auto-reject threshold (${reject}%)`,
      gap: autoApprove - confidenceScore,
    };
  }
  return {
    action: 'HUMAN_REVIEW',
    reason: `Confidence ${confidenceScore}% is between review (${review}%) and auto-approve (${autoApprove}%) — needs human review`,
    gap: autoApprove - confidenceScore,
  };
}

function derivePriority(confidenceScore: number, reviewThreshold: number, autoApproveThreshold: number): ReviewPriority {
  const range = autoApproveThreshold - reviewThreshold;
  const position = confidenceScore - reviewThreshold;
  const pct = range > 0 ? position / range : 0;

  if (pct < 0.15) return 'URGENT';
  if (pct < 0.4) return 'HIGH';
  if (pct < 0.7) return 'MEDIUM';
  return 'LOW';
}

// ─── Submit AI Decision ─────────────────────────────────────────────────────

export async function submitAIDecision(params: {
  tenantId: string;
  moduleId: string;
  decisionType: string;
  confidenceScore: number;
  aiDecision: string;
  aiReasoning: string;
  entityType: ReviewQueueItem['entityType'];
  entityId: string;
  entityName: string;
  relatedData: Record<string, any>;
}): Promise<{
  action: 'AUTO_APPROVED' | 'QUEUED_FOR_REVIEW' | 'AUTO_REJECTED';
  reviewId?: string;
  message: string;
}> {
  const { tenantId, moduleId, confidenceScore } = params;
  const config = await getThresholdForModule(tenantId, moduleId);
  const evaluation = evaluateConfidence(moduleId, confidenceScore, config || undefined);

  const now = new Date();
  const reviewId = `REV-${now.getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

  if (evaluation.action === 'AUTO_APPROVE') {
    // Log outcome directly
    const outcomeCol = await outcomesCol(tenantId);
    await outcomeCol.insertOne({
      id: uuidv4(),
      tenantId,
      reviewId,
      moduleId,
      aiDecision: params.aiDecision,
      humanDecision: 'AUTO_APPROVED',
      finalOutcome: params.aiDecision,
      wasAiCorrect: true,
      confidenceScore,
      createdAt: now,
    });
    return { action: 'AUTO_APPROVED', message: evaluation.reason };
  }

  if (evaluation.action === 'AUTO_REJECT') {
    const outcomeCol = await outcomesCol(tenantId);
    await outcomeCol.insertOne({
      id: uuidv4(),
      tenantId,
      reviewId,
      moduleId,
      aiDecision: params.aiDecision,
      humanDecision: 'AUTO_REJECTED',
      finalOutcome: 'REJECTED',
      wasAiCorrect: true,
      confidenceScore,
      createdAt: now,
    });
    return { action: 'AUTO_REJECTED', message: evaluation.reason };
  }

  // Queue for human review
  const maxHours = config?.maxReviewTime ?? DEFAULT_THRESHOLDS[moduleId]?.maxReviewTime ?? 48;
  const expiresAt = new Date(now.getTime() + maxHours * 60 * 60 * 1000);
  const autoApproveThr = config?.autoApproveThreshold ?? DEFAULT_THRESHOLDS[moduleId]?.autoApproveThreshold ?? 80;
  const reviewThr = config?.reviewThreshold ?? DEFAULT_THRESHOLDS[moduleId]?.reviewThreshold ?? 50;

  const item: ReviewQueueItem = {
    id: uuidv4(),
    tenantId,
    reviewId,
    moduleId,
    moduleName: config?.moduleName ?? DEFAULT_THRESHOLDS[moduleId]?.moduleName ?? moduleId,
    decisionType: params.decisionType,
    confidenceScore,
    aiDecision: params.aiDecision,
    aiReasoning: params.aiReasoning,
    entityType: params.entityType,
    entityId: params.entityId,
    entityName: params.entityName,
    relatedData: params.relatedData,
    autoApproveThreshold: autoApproveThr,
    reviewThreshold: reviewThr,
    gap: evaluation.gap,
    status: 'PENDING',
    priority: derivePriority(confidenceScore, reviewThr, autoApproveThr),
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };

  const col = await queueCol(tenantId);
  await col.insertOne(item);

  return { action: 'QUEUED_FOR_REVIEW', reviewId, message: evaluation.reason };
}

// ─── Review Queue Queries ───────────────────────────────────────────────────

export async function getPendingReviews(
  tenantId: string,
  filters?: { moduleId?: string; priority?: string; status?: string; assignedTo?: string },
): Promise<ReviewQueueItem[]> {
  const col = await queueCol(tenantId);
  const query: Record<string, unknown> = { tenantId };

  if (filters?.status) {
    query.status = filters.status;
  } else {
    query.status = { $in: ['PENDING', 'IN_REVIEW', 'ESCALATED'] };
  }
  if (filters?.moduleId) query.moduleId = filters.moduleId;
  if (filters?.priority) query.priority = filters.priority;
  if (filters?.assignedTo) query.assignedTo = filters.assignedTo;

  const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const items = await col.find(query).sort({ createdAt: 1 }).limit(100).toArray() as unknown as ReviewQueueItem[];

  return items.sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 4;
    const pb = priorityOrder[b.priority] ?? 4;
    if (pa !== pb) return pa - pb;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function getQueueStats(tenantId: string): Promise<QueueStats> {
  const col = await queueCol(tenantId);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const all = await col.find({ tenantId }).toArray() as unknown as ReviewQueueItem[];

  const pending = all.filter(i => i.status === 'PENDING');
  const inReview = all.filter(i => i.status === 'IN_REVIEW');
  const escalated = all.filter(i => i.status === 'ESCALATED');
  const completedToday = all.filter(i =>
    ['APPROVED', 'REJECTED', 'OVERRIDDEN'].includes(i.status) &&
    i.reviewedAt && new Date(i.reviewedAt) >= todayStart
  );
  const completedAll = all.filter(i => ['APPROVED', 'REJECTED', 'OVERRIDDEN'].includes(i.status));
  const overdue = pending.filter(i => new Date(i.expiresAt) <= now);

  let avgWaitHours = 0;
  if (pending.length > 0) {
    const totalWait = pending.reduce((s, i) => s + (now.getTime() - new Date(i.createdAt).getTime()), 0);
    avgWaitHours = Math.round(totalWait / pending.length / 3600000 * 10) / 10;
  }

  const moduleMap = new Map<string, { moduleId: string; moduleName: string; count: number }>();
  const priorityMap = new Map<string, number>();
  for (const item of pending) {
    const m = moduleMap.get(item.moduleId) || { moduleId: item.moduleId, moduleName: item.moduleName, count: 0 };
    m.count++;
    moduleMap.set(item.moduleId, m);
    priorityMap.set(item.priority, (priorityMap.get(item.priority) || 0) + 1);
  }

  return {
    totalPending: pending.length,
    inReview: inReview.length,
    escalated: escalated.length,
    completedToday: completedToday.length,
    completedAllTime: completedAll.length,
    avgWaitHours,
    overdueCount: overdue.length,
    byModule: [...moduleMap.values()].sort((a, b) => b.count - a.count),
    byPriority: ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => ({
      priority: p,
      count: priorityMap.get(p) || 0,
    })),
  };
}

export async function getReviewItem(tenantId: string, reviewId: string): Promise<ReviewQueueItem | null> {
  const col = await queueCol(tenantId);
  return col.findOne({ tenantId, reviewId }) as unknown as ReviewQueueItem | null;
}

// ─── Human Review ───────────────────────────────────────────────────────────

export async function reviewItem(params: {
  tenantId: string;
  reviewId: string;
  decision: 'AGREE' | 'DISAGREE' | 'MODIFY';
  reasoning: string;
  modifiedDecision?: string;
  reviewedBy: string;
  reviewedByName?: string;
  feedbackScore?: number;
  feedbackComment?: string;
}): Promise<ReviewQueueItem> {
  const { tenantId, reviewId, decision, reasoning } = params;
  const col = await queueCol(tenantId);
  const now = new Date();

  const statusMap: Record<string, ReviewStatus> = {
    AGREE: 'APPROVED',
    DISAGREE: 'REJECTED',
    MODIFY: 'OVERRIDDEN',
  };

  await col.updateOne(
    { tenantId, reviewId },
    {
      $set: {
        status: statusMap[decision] || 'APPROVED',
        humanDecision: decision,
        humanReasoning: reasoning,
        modifiedDecision: params.modifiedDecision,
        reviewedAt: now,
        reviewedBy: params.reviewedBy,
        reviewedByName: params.reviewedByName,
        feedbackScore: params.feedbackScore,
        feedbackComment: params.feedbackComment,
        updatedAt: now,
      },
    },
  );

  // Record outcome
  const item = await col.findOne({ tenantId, reviewId }) as unknown as ReviewQueueItem;
  if (item) {
    const outcomeCol = await outcomesCol(tenantId);
    await outcomeCol.insertOne({
      id: uuidv4(),
      tenantId,
      reviewId,
      moduleId: item.moduleId,
      aiDecision: item.aiDecision,
      humanDecision: decision,
      finalOutcome: decision === 'MODIFY' ? (params.modifiedDecision || item.aiDecision) : item.aiDecision,
      wasAiCorrect: decision === 'AGREE',
      confidenceScore: item.confidenceScore,
      createdAt: now,
    });
  }

  return item;
}

// ─── Assignment ─────────────────────────────────────────────────────────────

export async function assignReview(tenantId: string, reviewId: string, assignTo: string, assignToName?: string): Promise<boolean> {
  const col = await queueCol(tenantId);
  const result = await col.updateOne(
    { tenantId, reviewId },
    { $set: { assignedTo: assignTo, assignedToName: assignToName, status: 'IN_REVIEW', updatedAt: new Date() } },
  );
  return result.modifiedCount > 0;
}

// ─── Escalation ─────────────────────────────────────────────────────────────

export async function escalateOverdueItems(tenantId: string): Promise<{ escalated: number; items: string[] }> {
  const col = await queueCol(tenantId);
  const now = new Date();

  const overdue = await col.find({
    tenantId,
    status: { $in: ['PENDING', 'IN_REVIEW'] },
    expiresAt: { $lte: now },
  }).toArray() as unknown as ReviewQueueItem[];

  const escalatedIds: string[] = [];
  for (const item of overdue) {
    await col.updateOne(
      { tenantId, reviewId: item.reviewId },
      { $set: { status: 'ESCALATED', escalatedAt: now, updatedAt: now } },
    );
    escalatedIds.push(item.reviewId);
  }

  return { escalated: escalatedIds.length, items: escalatedIds };
}

export async function manualEscalate(tenantId: string, reviewId: string, escalateTo: string): Promise<boolean> {
  const col = await queueCol(tenantId);
  const result = await col.updateOne(
    { tenantId, reviewId },
    { $set: { status: 'ESCALATED', escalatedAt: new Date(), escalatedTo: escalateTo, updatedAt: new Date() } },
  );
  return result.modifiedCount > 0;
}

// ─── Bulk Review ────────────────────────────────────────────────────────────

export async function bulkReview(
  tenantId: string,
  reviewIds: string[],
  decision: 'AGREE' | 'DISAGREE',
  reviewedBy: string,
  reviewedByName?: string,
): Promise<number> {
  const col = await queueCol(tenantId);
  const outcomeCol = await outcomesCol(tenantId);
  const now = new Date();
  const statusMap: Record<string, ReviewStatus> = { AGREE: 'APPROVED', DISAGREE: 'REJECTED' };
  let count = 0;

  for (const reviewId of reviewIds) {
    const item = await col.findOne({ tenantId, reviewId }) as unknown as ReviewQueueItem | null;
    if (!item || !['PENDING', 'IN_REVIEW', 'ESCALATED'].includes(item.status)) continue;

    await col.updateOne(
      { tenantId, reviewId },
      {
        $set: {
          status: statusMap[decision],
          humanDecision: decision,
          reviewedAt: now,
          reviewedBy,
          reviewedByName,
          updatedAt: now,
        },
      },
    );

    await outcomeCol.insertOne({
      id: uuidv4(),
      tenantId,
      reviewId,
      moduleId: item.moduleId,
      aiDecision: item.aiDecision,
      humanDecision: decision,
      finalOutcome: item.aiDecision,
      wasAiCorrect: decision === 'AGREE',
      confidenceScore: item.confidenceScore,
      createdAt: now,
    });
    count++;
  }

  return count;
}

// ─── History ────────────────────────────────────────────────────────────────

export async function getReviewHistory(
  tenantId: string,
  filters?: { moduleId?: string; decision?: string; limit?: number },
): Promise<ReviewQueueItem[]> {
  const col = await queueCol(tenantId);
  const query: Record<string, unknown> = { tenantId, status: { $in: ['APPROVED', 'REJECTED', 'OVERRIDDEN'] } };
  if (filters?.moduleId) query.moduleId = filters.moduleId;
  if (filters?.decision) query.humanDecision = filters.decision;

  return col.find(query)
    .sort({ reviewedAt: -1 })
    .limit(filters?.limit || 50)
    .toArray() as unknown as ReviewQueueItem[];
}

// ─── Accuracy ───────────────────────────────────────────────────────────────

export async function calculateModuleAccuracy(tenantId: string, moduleId?: string): Promise<ModuleAccuracy[]> {
  const outcomeCol = await outcomesCol(tenantId);
  const query: Record<string, unknown> = { tenantId };
  if (moduleId) query.moduleId = moduleId;

  const outcomes = await outcomeCol.find(query).toArray() as unknown as DecisionOutcome[];

  const byModule = new Map<string, DecisionOutcome[]>();
  for (const o of outcomes) {
    const list = byModule.get(o.moduleId) || [];
    list.push(o);
    byModule.set(o.moduleId, list);
  }

  const results: ModuleAccuracy[] = [];
  for (const [modId, modOutcomes] of byModule) {
    const total = modOutcomes.length;
    const autoApproved = modOutcomes.filter(o => o.humanDecision === 'AUTO_APPROVED').length;
    const autoRejected = modOutcomes.filter(o => o.humanDecision === 'AUTO_REJECTED').length;
    const humanReviewed = total - autoApproved - autoRejected;
    const agreed = modOutcomes.filter(o => o.wasAiCorrect && o.humanDecision !== 'AUTO_APPROVED' && o.humanDecision !== 'AUTO_REJECTED').length;
    const disagreed = humanReviewed - agreed;

    const confidences = modOutcomes.map(o => o.confidenceScore);
    const avgConf = confidences.length > 0 ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;

    const distribution = [
      { range: '0-20', count: 0 },
      { range: '20-40', count: 0 },
      { range: '40-60', count: 0 },
      { range: '60-80', count: 0 },
      { range: '80-100', count: 0 },
    ];
    for (const c of confidences) {
      if (c < 20) distribution[0].count++;
      else if (c < 40) distribution[1].count++;
      else if (c < 60) distribution[2].count++;
      else if (c < 80) distribution[3].count++;
      else distribution[4].count++;
    }

    const modName = DEFAULT_THRESHOLDS[modId]?.moduleName ?? modId;
    results.push({
      moduleId: modId,
      moduleName: modName,
      totalDecisions: total,
      autoApproved,
      humanReviewed,
      autoRejected,
      humanAgreedWithAI: agreed,
      humanDisagreedWithAI: disagreed,
      accuracyRate: humanReviewed > 0 ? Math.round((agreed / humanReviewed) * 100) : 100,
      avgConfidence: avgConf,
      confidenceDistribution: distribution,
    });
  }

  return results.sort((a, b) => b.totalDecisions - a.totalDecisions);
}

// ─── Seed Sample Data ───────────────────────────────────────────────────────

export async function seedSampleReviewData(tenantId: string): Promise<number> {
  const col = await queueCol(tenantId);
  const existing = await col.countDocuments({ tenantId });
  if (existing > 0) return 0;

  const now = new Date();
  const h = (hours: number) => new Date(now.getTime() - hours * 3600000);
  const fwd = (hours: number) => new Date(now.getTime() + hours * 3600000);

  const samples: Partial<ReviewQueueItem>[] = [
    {
      reviewId: 'REV-2026-0042',
      moduleId: 'ai-matching',
      moduleName: 'AI Job Matching',
      decisionType: 'candidate_shortlist',
      confidenceScore: 72,
      aiDecision: 'Shortlist candidate for Senior Nurse position',
      aiReasoning: 'Strong clinical skills (90%) but limited ICU experience reduces confidence. 3/5 required certifications verified. Good culture fit indicators.',
      entityType: 'CANDIDATE',
      entityId: 'CAND-001',
      entityName: 'Ahmed Hassan',
      relatedData: {
        jobTitle: 'Senior Nurse',
        department: 'Nursing',
        skillsMatch: 85,
        experienceMatch: 90,
        educationMatch: 80,
        certificationMatch: 60,
        missingSkills: ['ICU Experience'],
        verifiedCerts: ['BLS', 'ACLS', 'Patient Care'],
        missingCerts: ['ICU Certification', 'Critical Care'],
      },
      autoApproveThreshold: 85,
      reviewThreshold: 60,
      gap: 13,
      status: 'PENDING',
      priority: 'URGENT',
      createdAt: h(3),
      updatedAt: h(3),
      expiresAt: fwd(45),
    },
    {
      reviewId: 'REV-2026-0041',
      moduleId: 'retention-risk',
      moduleName: 'Retention Risk Prediction',
      decisionType: 'risk_alert',
      confidenceScore: 68,
      aiDecision: 'Flag as CRITICAL retention risk (score 82/100)',
      aiReasoning: 'Employee shows multiple risk factors: salary below market by 15%, 3 years without promotion, declining engagement scores. However, recent positive feedback from manager adds uncertainty.',
      entityType: 'EMPLOYEE',
      entityId: 'EMP-005',
      entityName: 'Omar Ali',
      relatedData: {
        retentionScore: 82,
        salary: 12000,
        marketAverage: 14000,
        yearsWithoutPromotion: 3,
        engagementTrend: 'declining',
        managerFeedback: 'positive',
        riskFactors: ['Below market salary', 'No recent promotion', 'Declining engagement'],
      },
      autoApproveThreshold: 80,
      reviewThreshold: 50,
      gap: 12,
      status: 'PENDING',
      priority: 'HIGH',
      createdAt: h(8),
      updatedAt: h(8),
      expiresAt: fwd(64),
    },
    {
      reviewId: 'REV-2026-0040',
      moduleId: 'candidate-ranking',
      moduleName: 'Candidate Ranking',
      decisionType: 'ranking_override',
      confidenceScore: 62,
      aiDecision: 'Rank candidate #2 for Data Analyst position',
      aiReasoning: 'Strong technical skills but limited domain experience in healthcare. Interview score was above average but behavioral assessment shows some concerns.',
      entityType: 'CANDIDATE',
      entityId: 'CAND-003',
      entityName: 'Sara Al-Fahad',
      relatedData: {
        jobTitle: 'Data Analyst',
        currentRank: 2,
        technicalScore: 88,
        behavioralScore: 65,
        interviewScore: 78,
        domainExperience: 'limited',
      },
      autoApproveThreshold: 80,
      reviewThreshold: 55,
      gap: 18,
      status: 'PENDING',
      priority: 'MEDIUM',
      createdAt: h(24),
      updatedAt: h(24),
      expiresAt: fwd(24),
    },
    {
      reviewId: 'REV-2026-0039',
      moduleId: 'interview-scoring',
      moduleName: 'Interview Chatbot Scoring',
      decisionType: 'advance_candidate',
      confidenceScore: 58,
      aiDecision: 'Advance to next interview stage',
      aiReasoning: 'Candidate provided satisfactory answers to technical questions but was vague on behavioral scenarios. Time management during interview was concerning.',
      entityType: 'CANDIDATE',
      entityId: 'CAND-007',
      entityName: 'Mohammed Al-Qahtani',
      relatedData: {
        jobTitle: 'Senior Nurse',
        technicalScore: 70,
        behavioralScore: 45,
        overallScore: 58,
        flaggedAnswers: 2,
        avgResponseTime: '4.2 min',
      },
      autoApproveThreshold: 80,
      reviewThreshold: 50,
      gap: 22,
      status: 'PENDING',
      priority: 'HIGH',
      createdAt: h(12),
      updatedAt: h(12),
      expiresAt: fwd(36),
    },
    {
      reviewId: 'REV-2026-0038',
      moduleId: 'promotion-readiness',
      moduleName: 'Promotion Readiness',
      decisionType: 'promotion_recommend',
      confidenceScore: 73,
      aiDecision: 'Recommend for promotion to Senior Developer',
      aiReasoning: 'Strong performance reviews (4.5/5 avg), completed leadership training, positive peer feedback. Concern: only 2 years in current role (minimum usually 3).',
      entityType: 'EMPLOYEE',
      entityId: 'EMP-012',
      entityName: 'Khalid Ibrahim',
      relatedData: {
        currentTitle: 'Developer',
        proposedTitle: 'Senior Developer',
        yearsInRole: 2,
        performanceAvg: 4.5,
        leadershipTraining: true,
        peerFeedbackScore: 88,
        minimumYearsRequired: 3,
      },
      autoApproveThreshold: 80,
      reviewThreshold: 55,
      gap: 7,
      status: 'PENDING',
      priority: 'LOW',
      createdAt: h(48),
      updatedAt: h(48),
      expiresAt: fwd(24),
    },
  ];

  // Also seed some completed items for accuracy stats
  const completedSamples: Partial<ReviewQueueItem>[] = [
    { reviewId: 'REV-2026-0035', moduleId: 'ai-matching', moduleName: 'AI Job Matching', decisionType: 'candidate_shortlist', confidenceScore: 91, aiDecision: 'Shortlist for Nurse position', aiReasoning: 'Excellent match', entityType: 'CANDIDATE', entityId: 'CAND-010', entityName: 'Fatima Al-Rashid', relatedData: {}, autoApproveThreshold: 85, reviewThreshold: 60, gap: 0, status: 'APPROVED', priority: 'LOW', humanDecision: 'AGREE', humanReasoning: 'Good fit', reviewedAt: h(72), reviewedBy: 'admin', feedbackScore: 5, createdAt: h(96), updatedAt: h(72), expiresAt: h(48) },
    { reviewId: 'REV-2026-0034', moduleId: 'ai-matching', moduleName: 'AI Job Matching', decisionType: 'candidate_shortlist', confidenceScore: 65, aiDecision: 'Shortlist for Analyst', aiReasoning: 'Moderate match', entityType: 'CANDIDATE', entityId: 'CAND-011', entityName: 'Nasser Bin Saleh', relatedData: {}, autoApproveThreshold: 85, reviewThreshold: 60, gap: 20, status: 'REJECTED', priority: 'HIGH', humanDecision: 'DISAGREE', humanReasoning: 'Missing critical skills', reviewedAt: h(60), reviewedBy: 'admin', feedbackScore: 3, createdAt: h(84), updatedAt: h(60), expiresAt: h(36) },
    { reviewId: 'REV-2026-0033', moduleId: 'retention-risk', moduleName: 'Retention Risk Prediction', decisionType: 'risk_alert', confidenceScore: 75, aiDecision: 'Medium risk', aiReasoning: 'Some indicators', entityType: 'EMPLOYEE', entityId: 'EMP-020', entityName: 'Layla Ahmed', relatedData: {}, autoApproveThreshold: 80, reviewThreshold: 50, gap: 5, status: 'APPROVED', priority: 'MEDIUM', humanDecision: 'AGREE', humanReasoning: 'Confirmed risk', reviewedAt: h(48), reviewedBy: 'admin', feedbackScore: 4, createdAt: h(72), updatedAt: h(48), expiresAt: h(0) },
    { reviewId: 'REV-2026-0032', moduleId: 'candidate-ranking', moduleName: 'Candidate Ranking', decisionType: 'ranking_override', confidenceScore: 88, aiDecision: 'Rank #1', aiReasoning: 'Top match', entityType: 'CANDIDATE', entityId: 'CAND-015', entityName: 'Yousef Al-Harbi', relatedData: {}, autoApproveThreshold: 80, reviewThreshold: 55, gap: 0, status: 'APPROVED', priority: 'LOW', humanDecision: 'AGREE', humanReasoning: 'Excellent candidate', reviewedAt: h(36), reviewedBy: 'admin', feedbackScore: 5, createdAt: h(60), updatedAt: h(36), expiresAt: h(12) },
    { reviewId: 'REV-2026-0031', moduleId: 'interview-scoring', moduleName: 'Interview Chatbot Scoring', decisionType: 'advance_candidate', confidenceScore: 55, aiDecision: 'Advance', aiReasoning: 'Borderline', entityType: 'CANDIDATE', entityId: 'CAND-018', entityName: 'Huda Mansour', relatedData: {}, autoApproveThreshold: 80, reviewThreshold: 50, gap: 25, status: 'OVERRIDDEN', priority: 'HIGH', humanDecision: 'MODIFY', humanReasoning: 'Schedule additional interview instead', modifiedDecision: 'Schedule phone screen before advancing', reviewedAt: h(24), reviewedBy: 'admin', feedbackScore: 2, createdAt: h(48), updatedAt: h(24), expiresAt: h(0) },
  ];

  const allDocs = [...samples, ...completedSamples].map(s => ({
    ...s,
    id: uuidv4(),
    tenantId,
  }));

  await col.insertMany(allDocs);

  // Seed outcomes for completed items
  const outcomeColRef = await outcomesCol(tenantId);
  const outcomesDocs = completedSamples.map(s => ({
    id: uuidv4(),
    tenantId,
    reviewId: s.reviewId,
    moduleId: s.moduleId,
    aiDecision: s.aiDecision,
    humanDecision: s.humanDecision || 'AGREE',
    finalOutcome: s.humanDecision === 'MODIFY' ? (s.modifiedDecision || s.aiDecision) : s.aiDecision,
    wasAiCorrect: s.humanDecision === 'AGREE',
    confidenceScore: s.confidenceScore,
    createdAt: s.reviewedAt || now,
  }));
  if (outcomesDocs.length > 0) {
    await outcomeColRef.insertMany(outcomesDocs);
  }

  return allDocs.length;
}
