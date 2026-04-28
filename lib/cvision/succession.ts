/**
 * CVision Succession Planning Engine
 *
 * Handles:
 *  - Key position identification & criticality
 *  - Successor pipeline with readiness levels
 *  - 9-Box Grid (Performance × Potential)
 *  - Development plan tracking
 *  - Bench strength & risk reports
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface SuccessionPlan {
  _id?: string;
  id: string;
  tenantId: string;
  positionId: string;
  positionTitle: string;
  department: string;
  currentHolder: {
    employeeId: string;
    employeeName: string;
    tenure: number;
    retirementDate?: Date;
    flightRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  vacancyRisk: 'IMMINENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  successors: Successor[];
  hasReadySuccessor: boolean;
  benchStrength: number;
  lastReviewDate: Date;
  nextReviewDate: Date;
  reviewedBy: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

export interface Successor {
  employeeId: string;
  employeeName: string;
  currentPosition: string;
  readiness: 'READY_NOW' | 'READY_1_YEAR' | 'READY_2_PLUS_YEARS';
  performance: 'LOW' | 'MEDIUM' | 'HIGH';
  potential: 'LOW' | 'MEDIUM' | 'HIGH';
  nineBoxPosition: string;
  skillGaps: string[];
  developmentPlan: DevelopmentItem[];
  overallReadinessScore: number;
  notes?: string;
}

export interface DevelopmentItem {
  id: string;
  action: string;
  type: 'TRAINING' | 'MENTORING' | 'ROTATION' | 'PROJECT' | 'COACHING';
  targetDate: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
}

// ── 9-Box Grid ──────────────────────────────────────────────────────────

export const NINE_BOX: Record<string, { label: string; color: string; action: string }> = {
  'HIGH_HIGH':     { label: 'Star',            color: 'green',   action: 'Promote / stretch assignments' },
  'HIGH_MEDIUM':   { label: 'High Performer',  color: 'emerald', action: 'Retain / develop potential' },
  'HIGH_LOW':      { label: 'Solid Performer', color: 'blue',    action: 'Maintain / appreciate' },
  'MEDIUM_HIGH':   { label: 'Growth',          color: 'yellow',  action: 'Develop performance' },
  'MEDIUM_MEDIUM': { label: 'Core',            color: 'gray',    action: 'Invest selectively' },
  'MEDIUM_LOW':    { label: 'Effective',        color: 'slate',   action: 'Maintain in role' },
  'LOW_HIGH':      { label: 'Enigma',          color: 'orange',  action: 'Coach / investigate barriers' },
  'LOW_MEDIUM':    { label: 'Underperformer',  color: 'red',     action: 'Performance plan / reassign' },
  'LOW_LOW':       { label: 'Risk',            color: 'red',     action: 'Urgent intervention / exit' },
};

export function getNineBoxPosition(performance: string, potential: string): string {
  const key = `${performance}_${potential}`;
  return NINE_BOX[key]?.label || 'Core';
}

export const CRITICALITY_LEVELS = [
  { value: 'CRITICAL', label: 'Critical', color: 'bg-red-100 text-red-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'LOW', label: 'Low', color: 'bg-green-100 text-green-700' },
] as const;

export const VACANCY_RISK_LEVELS = [
  { value: 'IMMINENT', label: 'Imminent', color: 'bg-red-100 text-red-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'LOW', label: 'Low', color: 'bg-green-100 text-green-700' },
] as const;

export const READINESS_LEVELS = [
  { value: 'READY_NOW', label: 'Ready Now', color: 'bg-green-100 text-green-700' },
  { value: 'READY_1_YEAR', label: 'Ready in 1 Year', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'READY_2_PLUS_YEARS', label: 'Ready in 2+ Years', color: 'bg-orange-100 text-orange-700' },
] as const;

export const DEV_TYPES = [
  { value: 'TRAINING', label: 'Training' },
  { value: 'MENTORING', label: 'Mentoring' },
  { value: 'ROTATION', label: 'Job Rotation' },
  { value: 'PROJECT', label: 'Stretch Project' },
  { value: 'COACHING', label: 'Coaching' },
] as const;

// ── CRUD ────────────────────────────────────────────────────────────────

export async function createPlan(
  db: Db, tenantId: string, data: any,
): Promise<{ id: string }> {
  const now = new Date();
  const id = uuidv4();

  const doc = {
    id,
    tenantId,
    positionId: data.positionId || uuidv4(),
    positionTitle: data.positionTitle,
    department: data.department,
    currentHolder: {
      employeeId: data.currentHolder?.employeeId || '',
      employeeName: data.currentHolder?.employeeName || '',
      tenure: data.currentHolder?.tenure || 0,
      retirementDate: data.currentHolder?.retirementDate ? new Date(data.currentHolder.retirementDate) : null,
      flightRisk: data.currentHolder?.flightRisk || 'LOW',
    },
    criticality: data.criticality || 'MEDIUM',
    vacancyRisk: data.vacancyRisk || 'MEDIUM',
    successors: [],
    hasReadySuccessor: false,
    benchStrength: 0,
    lastReviewDate: now,
    nextReviewDate: new Date(now.getTime() + 90 * 86400000), // 90 days
    reviewedBy: data.reviewedBy || '',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('cvision_succession_plans').insertOne(doc);
  return { id };
}

export async function addSuccessor(
  db: Db, tenantId: string, planId: string, successor: any,
): Promise<{ success: boolean; error?: string }> {
  const nineBox = getNineBoxPosition(successor.performance || 'MEDIUM', successor.potential || 'MEDIUM');
  const now = new Date();

  const succ: Successor = {
    employeeId: successor.employeeId,
    employeeName: successor.employeeName,
    currentPosition: successor.currentPosition || '',
    readiness: successor.readiness || 'READY_2_PLUS_YEARS',
    performance: successor.performance || 'MEDIUM',
    potential: successor.potential || 'MEDIUM',
    nineBoxPosition: nineBox,
    skillGaps: successor.skillGaps || [],
    developmentPlan: (successor.developmentPlan || []).map((d: any) => ({
      ...d,
      id: d.id || uuidv4(),
      status: d.status || 'PLANNED',
    })),
    overallReadinessScore: successor.overallReadinessScore || 0,
    notes: successor.notes || '',
  };

  const result = await db.collection('cvision_succession_plans').updateOne(
    { tenantId, $or: [{ id: planId }, { positionId: planId }] },
    { $push: { successors: succ } as Record<string, unknown>, $set: { updatedAt: now } },
  );

  if (result.modifiedCount === 0) return { success: false, error: 'Plan not found' };

  // Recalculate bench strength
  await recalculateBenchStrength(db, tenantId, planId);
  return { success: true };
}

export async function removeSuccessor(
  db: Db, tenantId: string, planId: string, employeeId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_succession_plans').updateOne(
    { tenantId, $or: [{ id: planId }, { positionId: planId }] },
    { $pull: { successors: { employeeId } } as Record<string, unknown>, $set: { updatedAt: now } },
  );
  await recalculateBenchStrength(db, tenantId, planId);
  return { success: true };
}

export async function updateReadiness(
  db: Db, tenantId: string, planId: string, employeeId: string,
  updates: { readiness?: string; performance?: string; potential?: string; overallReadinessScore?: number },
): Promise<{ success: boolean }> {
  const now = new Date();
  const set: any = { updatedAt: now };
  if (updates.readiness) set['successors.$.readiness'] = updates.readiness;
  if (updates.performance) {
    set['successors.$.performance'] = updates.performance;
    set['successors.$.nineBoxPosition'] = getNineBoxPosition(
      updates.performance, updates.potential || 'MEDIUM',
    );
  }
  if (updates.potential) {
    set['successors.$.potential'] = updates.potential;
    set['successors.$.nineBoxPosition'] = getNineBoxPosition(
      updates.performance || 'MEDIUM', updates.potential,
    );
  }
  if (updates.overallReadinessScore !== undefined) set['successors.$.overallReadinessScore'] = updates.overallReadinessScore;

  await db.collection('cvision_succession_plans').updateOne(
    { tenantId, $or: [{ id: planId }, { positionId: planId }], 'successors.employeeId': employeeId },
    { $set: set },
  );
  await recalculateBenchStrength(db, tenantId, planId);
  return { success: true };
}

async function recalculateBenchStrength(db: Db, tenantId: string, planId: string) {
  const plan = await db.collection('cvision_succession_plans').findOne({
    tenantId, $or: [{ id: planId }, { positionId: planId }],
  });
  if (!plan) return;

  const successors = plan.successors || [];
  const readyNow = successors.filter((s: any) => s.readiness === 'READY_NOW').length;

  await db.collection('cvision_succession_plans').updateOne(
    { _id: plan._id },
    { $set: { hasReadySuccessor: readyNow > 0, benchStrength: readyNow } },
  );
}

export async function reviewPlan(
  db: Db, tenantId: string, planId: string, reviewedBy: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_succession_plans').updateOne(
    { tenantId, $or: [{ id: planId }, { positionId: planId }] },
    { $set: { lastReviewDate: now, nextReviewDate: new Date(now.getTime() + 90 * 86400000), reviewedBy, updatedAt: now } },
  );
  return { success: true };
}

export async function archivePlan(
  db: Db, tenantId: string, planId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_succession_plans').updateOne(
    { tenantId, $or: [{ id: planId }, { positionId: planId }] },
    { $set: { status: 'ARCHIVED', updatedAt: now } },
  );
  return { success: true };
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function listPlans(
  db: Db, tenantId: string, filters: { status?: string; department?: string; criticality?: string } = {},
): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  else query.status = 'ACTIVE';
  if (filters.department) query.department = filters.department;
  if (filters.criticality) query.criticality = filters.criticality;

  return db.collection('cvision_succession_plans').find(query).sort({ criticality: 1, createdAt: -1 }).limit(500).toArray();
}

export async function getNineBoxGrid(db: Db, tenantId: string): Promise<Record<string, any[]>> {
  const plans = await db.collection('cvision_succession_plans').find({ tenantId, status: 'ACTIVE' }).toArray();
  const grid: Record<string, any[]> = {};

  for (const key of Object.keys(NINE_BOX)) {
    grid[key] = [];
  }

  for (const plan of plans) {
    for (const succ of (plan.successors || [])) {
      const key = `${succ.performance}_${succ.potential}`;
      if (!grid[key]) grid[key] = [];
      grid[key].push({
        ...succ,
        targetPosition: plan.positionTitle,
        department: plan.department,
      });
    }
  }

  return grid;
}

export async function getRiskReport(db: Db, tenantId: string): Promise<any> {
  const plans = await db.collection('cvision_succession_plans').find({ tenantId, status: 'ACTIVE' }).toArray();

  const critical = plans.filter((p: any) => p.criticality === 'CRITICAL');
  const noSuccessor = plans.filter((p: any) => !p.hasReadySuccessor);
  const imminentVacancy = plans.filter((p: any) => p.vacancyRisk === 'IMMINENT');
  const reviewOverdue = plans.filter((p: any) => new Date(p.nextReviewDate) < new Date());

  return {
    totalPositions: plans.length,
    criticalPositions: critical.length,
    withoutReadySuccessor: noSuccessor.length,
    imminentVacancies: imminentVacancy.length,
    reviewOverdue: reviewOverdue.length,
    avgBenchStrength: plans.length ? (plans.reduce((s: number, p: any) => s + (p.benchStrength || 0), 0) / plans.length).toFixed(1) : '0',
    highRiskPositions: plans.filter((p: any) =>
      (p.criticality === 'CRITICAL' || p.criticality === 'HIGH') && !p.hasReadySuccessor
    ),
  };
}

export async function getStats(db: Db, tenantId: string) {
  const plans = await db.collection('cvision_succession_plans').find({ tenantId, status: 'ACTIVE' }).toArray();
  const totalSuccessors = plans.reduce((s: number, p: any) => s + (p.successors?.length || 0), 0);
  const readyNow = plans.reduce((s: number, p: any) =>
    s + (p.successors || []).filter((su: any) => su.readiness === 'READY_NOW').length, 0);

  return {
    totalPositions: plans.length,
    totalSuccessors,
    readyNow,
    criticalWithoutSuccessor: plans.filter((p: any) =>
      (p.criticality === 'CRITICAL') && !p.hasReadySuccessor).length,
    avgBenchStrength: plans.length ? +(plans.reduce((s: number, p: any) => s + (p.benchStrength || 0), 0) / plans.length).toFixed(1) : 0,
    reviewOverdue: plans.filter((p: any) => new Date(p.nextReviewDate) < new Date()).length,
  };
}
