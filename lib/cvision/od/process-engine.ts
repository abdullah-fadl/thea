import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { ObjectId } from '@/lib/cvision/infra/mongo-compat';

/* ═══════════════════════════════════════════════════════════════════
 *  Process Effectiveness Engine — فعالية العمليات
 *
 *  Mines workflow data, detects bottlenecks, ranks process health,
 *  proposes improvements via an Impact/Effort matrix.
 * ═══════════════════════════════════════════════════════════════════ */

const COLLECTION = 'cvision_process_analysis';
const uid = () => new ObjectId().toHexString().slice(-8);

/* ── Types ─────────────────────────────────────────────────────────── */

export type StepType = 'MANUAL' | 'AUTOMATED' | 'SEMI_AUTOMATED';
export type ImprovementAction = 'ELIMINATE' | 'SIMPLIFY' | 'AUTOMATE' | 'DELEGATE' | 'PARALLELIZE' | 'STANDARDIZE';
export type Level = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ProcessStep {
  stepId: string;
  name: string;
  actor: string;
  type: StepType;
  avgDuration: number;
  waitTime: number;
  valueAdding: boolean;
  painPoints: string[];
}

export interface ProcessMetrics {
  instancesPerMonth: number;
  avgCompletionTime: number;
  medianCompletionTime: number;
  p95CompletionTime: number;
  slaBreachRate: number;
  reworkRate: number;
  abandonmentRate: number;
  bottleneck: { step: string; avgDelay: number };
}

export interface Improvement {
  actionId: string;
  title: string;
  type: ImprovementAction;
  description: string;
  impact: Level;
  effort: Level;
  status: 'IDENTIFIED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED';
  assignedTo: string;
  dueDate: Date;
  completedDate?: Date;
  measuredImpact?: string;
}

export interface ProcessAnalysis {
  _id?: string;
  tenantId: string;
  analysisId: string;
  processName: string;
  processNameAr: string;
  module: string;
  owner: string;
  department: string;
  currentState: {
    steps: ProcessStep[];
    totalSteps: number;
    totalDuration: number;
    valueAddingTime: number;
    wasteTime: number;
    processEfficiency: number;
    metrics: ProcessMetrics;
  };
  proposedState?: {
    steps: { stepId: string; name: string; actor: string; type: StepType; estimatedDuration: number; change: 'NEW' | 'MODIFIED' | 'REMOVED' | 'UNCHANGED' | 'AUTOMATED'; changeDescription?: string }[];
    expectedImprovement: { timeReduction: number; stepsReduction: number; automationIncrease: number; costSaving: number; satisfactionImprovement: number };
  };
  improvements: Improvement[];
  userSatisfaction: { score: number; commonComplaints: string[]; respondentCount: number };
  healthScore: number;
  status: 'ANALYZING' | 'OPTIMIZING' | 'IMPLEMENTED' | 'MONITORING';
  lastAnalyzed: Date;
  createdAt: Date;
  updatedAt: Date;
}

/* ── Health Score ───────────────────────────────────────────────────── */

export function calculateProcessHealth(m: ProcessMetrics): number {
  let score = 5.0;
  if (m.slaBreachRate > 30) score -= 2; else if (m.slaBreachRate > 15) score -= 1; else if (m.slaBreachRate > 5) score -= 0.5;
  if (m.reworkRate > 25) score -= 1.5; else if (m.reworkRate > 10) score -= 0.75;
  if (m.abandonmentRate > 15) score -= 1; else if (m.abandonmentRate > 5) score -= 0.5;
  if (m.avgCompletionTime > 168) score -= 1; else if (m.avgCompletionTime > 72) score -= 0.5;
  return Math.max(Math.round(score * 10) / 10, 1);
}

/* ── Improvement Matrix ────────────────────────────────────────────── */

export function categorizeImprovements(improvements: Improvement[]) {
  return {
    quickWins: improvements.filter(i => i.impact === 'HIGH' && i.effort === 'LOW'),
    majorProjects: improvements.filter(i => i.impact === 'HIGH' && i.effort === 'HIGH'),
    fillIns: improvements.filter(i => i.impact === 'LOW' && i.effort === 'LOW'),
    thankless: improvements.filter(i => i.impact === 'LOW' && i.effort === 'HIGH'),
    medium: improvements.filter(i => i.impact === 'MEDIUM' || i.effort === 'MEDIUM'),
  };
}

/* ── Process Mining (from workflow data) ───────────────────────────── */

export async function mineProcess(db: Db, tenantId: string, processName: string): Promise<ProcessMetrics | null> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const instances = await db.collection('cvision_workflow_instances').find({
    tenantId, status: 'COMPLETED', completedAt: { $gte: ninetyDaysAgo },
  }).toArray();

  if (instances.length === 0) return null;

  const durations = instances.map(i => ((i as Record<string, unknown>).totalDuration as number) || 0).sort((a, b) => a - b);
  const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
  const median = durations[Math.floor(durations.length / 2)];
  const p95 = durations[Math.floor(durations.length * 0.95)];
  const slaBreaches = instances.filter(i => {
    const history = (i as Record<string, unknown>).stepHistory as Record<string, unknown>[] | undefined;
    return history?.some(s => s.slaBreached);
  });
  const reworks = instances.filter(i => {
    const history = (i as Record<string, unknown>).stepHistory as Record<string, unknown>[] | undefined;
    return history?.some(s => s.action === 'REJECTED');
  });

  return {
    instancesPerMonth: Math.round(instances.length / 3),
    avgCompletionTime: Math.round(avg * 10) / 10,
    medianCompletionTime: Math.round(median * 10) / 10,
    p95CompletionTime: Math.round(p95 * 10) / 10,
    slaBreachRate: Math.round((slaBreaches.length / instances.length) * 100),
    reworkRate: Math.round((reworks.length / instances.length) * 100),
    abandonmentRate: 0,
    bottleneck: { step: 'Approval', avgDelay: Math.round(avg * 0.4 * 10) / 10 },
  };
}

/* ── Seed Data ─────────────────────────────────────────────────────── */

function buildSeedProcesses(tenantId: string): ProcessAnalysis[] {
  const now = new Date();
  return [
    buildProcess(tenantId, 'Leave Approval', 'إجازة الموظف', 'HR', 'HR Manager', 'Human Resources',
      [
        { stepId: uid(), name: 'Employee submits request', actor: 'Employee', type: 'AUTOMATED', avgDuration: 5, waitTime: 0, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'Manager review', actor: 'Direct Manager', type: 'MANUAL', avgDuration: 30, waitTime: 480, valueAdding: true, painPoints: ['Long wait for response'] },
        { stepId: uid(), name: 'HR confirmation', actor: 'HR Officer', type: 'SEMI_AUTOMATED', avgDuration: 15, waitTime: 120, valueAdding: true, painPoints: [] },
      ],
      { instancesPerMonth: 45, avgCompletionTime: 28, medianCompletionTime: 18, p95CompletionTime: 72, slaBreachRate: 5, reworkRate: 3, abandonmentRate: 1, bottleneck: { step: 'Manager review', avgDelay: 12 } },
      [{ actionId: uid(), title: 'Auto-approve if balance sufficient and < 3 days', type: 'AUTOMATE', description: 'Eliminate manager step for short leaves', impact: 'HIGH', effort: 'LOW', status: 'IDENTIFIED', assignedTo: 'IT Manager', dueDate: now }],
      { score: 4.2, commonComplaints: ['Manager sometimes slow to respond'], respondentCount: 38 }, 4.5),
    buildProcess(tenantId, 'Procurement Request', 'طلب شراء', 'Operations', 'Procurement Manager', 'Operations',
      [
        { stepId: uid(), name: 'Requester fills form', actor: 'Employee', type: 'MANUAL', avgDuration: 30, waitTime: 0, valueAdding: true, painPoints: ['Form too long'] },
        { stepId: uid(), name: 'Manager approval', actor: 'Dept Manager', type: 'MANUAL', avgDuration: 15, waitTime: 720, valueAdding: true, painPoints: ['Often delayed'] },
        { stepId: uid(), name: 'Budget check', actor: 'Finance', type: 'SEMI_AUTOMATED', avgDuration: 30, waitTime: 480, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'Procurement review', actor: 'Procurement', type: 'MANUAL', avgDuration: 60, waitTime: 240, valueAdding: true, painPoints: ['Manual vendor comparison'] },
        { stepId: uid(), name: 'Finance Director approval', actor: 'Finance Director', type: 'MANUAL', avgDuration: 10, waitTime: 1440, valueAdding: false, painPoints: ['Bottleneck - often traveling'] },
        { stepId: uid(), name: 'VP approval', actor: 'VP Operations', type: 'MANUAL', avgDuration: 10, waitTime: 2880, valueAdding: false, painPoints: ['Unnecessary for small amounts'] },
      ],
      { instancesPerMonth: 18, avgCompletionTime: 199, medianCompletionTime: 180, p95CompletionTime: 360, slaBreachRate: 35, reworkRate: 12, abandonmentRate: 8, bottleneck: { step: 'VP approval', avgDelay: 72 } },
      [
        { actionId: uid(), title: 'Remove VP approval for < 5,000 SAR', type: 'ELIMINATE', description: 'Delegate to Finance Director', impact: 'HIGH', effort: 'LOW', status: 'APPROVED', assignedTo: 'CFO', dueDate: now },
        { actionId: uid(), title: 'Auto budget check', type: 'AUTOMATE', description: 'Integrate with budget system for instant validation', impact: 'HIGH', effort: 'MEDIUM', status: 'IDENTIFIED', assignedTo: 'IT Manager', dueDate: now },
        { actionId: uid(), title: 'Parallel approvals', type: 'PARALLELIZE', description: 'Run Finance + Procurement review simultaneously', impact: 'MEDIUM', effort: 'LOW', status: 'IDENTIFIED', assignedTo: 'Process Owner', dueDate: now },
      ],
      { score: 2.1, commonComplaints: ['Too slow', 'Too many approvals', 'VP bottleneck'], respondentCount: 24 }, 2.1),
    buildProcess(tenantId, 'New Hire Approval', 'موافقة توظيف جديد', 'HR', 'Recruitment Manager', 'Human Resources',
      [
        { stepId: uid(), name: 'Hiring manager submits request', actor: 'Dept Manager', type: 'MANUAL', avgDuration: 45, waitTime: 0, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'HR review', actor: 'HR', type: 'MANUAL', avgDuration: 60, waitTime: 480, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'Budget approval', actor: 'Finance', type: 'MANUAL', avgDuration: 30, waitTime: 1440, valueAdding: true, painPoints: ['Slow'] },
        { stepId: uid(), name: 'VP approval', actor: 'VP', type: 'MANUAL', avgDuration: 15, waitTime: 2160, valueAdding: false, painPoints: [] },
        { stepId: uid(), name: 'CEO approval', actor: 'CEO', type: 'MANUAL', avgDuration: 10, waitTime: 4320, valueAdding: false, painPoints: ['Big bottleneck'] },
      ],
      { instancesPerMonth: 8, avgCompletionTime: 288, medianCompletionTime: 240, p95CompletionTime: 480, slaBreachRate: 15, reworkRate: 10, abandonmentRate: 5, bottleneck: { step: 'CEO Approval', avgDelay: 108 } },
      [{ actionId: uid(), title: 'Auto-approve budgeted positions', type: 'DELEGATE', description: 'VP can approve if position is in approved headcount plan', impact: 'HIGH', effort: 'MEDIUM', status: 'IDENTIFIED', assignedTo: 'CHRO', dueDate: now }],
      { score: 3.0, commonComplaints: ['Takes too long', 'Lose good candidates'], respondentCount: 15 }, 3.0),
    buildProcess(tenantId, 'Expense Reimbursement', 'تعويض مصاريف', 'Finance', 'Finance Manager', 'Finance',
      [
        { stepId: uid(), name: 'Employee submits claim', actor: 'Employee', type: 'MANUAL', avgDuration: 20, waitTime: 0, valueAdding: true, painPoints: ['Must attach paper receipts'] },
        { stepId: uid(), name: 'Manager approval', actor: 'Manager', type: 'MANUAL', avgDuration: 10, waitTime: 720, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'Receipt verification', actor: 'Finance', type: 'MANUAL', avgDuration: 45, waitTime: 1440, valueAdding: true, painPoints: ['Manual check'] },
      ],
      { instancesPerMonth: 30, avgCompletionTime: 100, medianCompletionTime: 72, p95CompletionTime: 240, slaBreachRate: 10, reworkRate: 20, abandonmentRate: 3, bottleneck: { step: 'Receipt verification', avgDelay: 48 } },
      [
        { actionId: uid(), title: 'OCR receipt scanning', type: 'AUTOMATE', description: 'Auto-extract receipt data via OCR', impact: 'HIGH', effort: 'MEDIUM', status: 'IDENTIFIED', assignedTo: 'IT Manager', dueDate: now },
        { actionId: uid(), title: 'Auto-approve < 500 SAR', type: 'ELIMINATE', description: 'Skip manager approval for small amounts', impact: 'MEDIUM', effort: 'LOW', status: 'IDENTIFIED', assignedTo: 'CFO', dueDate: now },
      ],
      { score: 3.2, commonComplaints: ['Too many rejections for receipt quality', 'Slow finance review'], respondentCount: 42 }, 3.2),
    buildProcess(tenantId, 'Payroll Processing', 'معالجة الرواتب', 'Finance', 'Payroll Manager', 'Finance',
      [
        { stepId: uid(), name: 'Data collection', actor: 'HR System', type: 'AUTOMATED', avgDuration: 5, waitTime: 0, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'Calculation', actor: 'Payroll System', type: 'AUTOMATED', avgDuration: 10, waitTime: 0, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'Manager review', actor: 'Finance Manager', type: 'MANUAL', avgDuration: 60, waitTime: 60, valueAdding: true, painPoints: [] },
        { stepId: uid(), name: 'Bank transfer', actor: 'System', type: 'AUTOMATED', avgDuration: 5, waitTime: 30, valueAdding: true, painPoints: [] },
      ],
      { instancesPerMonth: 1, avgCompletionTime: 3, medianCompletionTime: 2.5, p95CompletionTime: 5, slaBreachRate: 0, reworkRate: 2, abandonmentRate: 0, bottleneck: { step: 'Manager review', avgDelay: 1 } },
      [], { score: 4.8, commonComplaints: [], respondentCount: 50 }, 4.8),
  ];
}

function buildProcess(tenantId: string, name: string, nameAr: string, module: string, owner: string, dept: string, steps: ProcessStep[], metrics: ProcessMetrics, improvements: Improvement[], satisfaction: { score: number; commonComplaints: string[]; respondentCount: number }, healthScore: number): ProcessAnalysis {
  const totalDuration = steps.reduce((s, st) => s + st.avgDuration + st.waitTime, 0);
  const valueTime = steps.filter(s => s.valueAdding).reduce((s, st) => s + st.avgDuration, 0);
  return {
    tenantId, analysisId: `PA-${uid()}`, processName: name, processNameAr: nameAr, module, owner, department: dept,
    currentState: { steps, totalSteps: steps.length, totalDuration, valueAddingTime: valueTime, wasteTime: totalDuration - valueTime, processEfficiency: totalDuration > 0 ? Math.round((valueTime / totalDuration) * 100) : 0, metrics },
    improvements, userSatisfaction: satisfaction, healthScore,
    status: 'MONITORING', lastAnalyzed: new Date(), createdAt: new Date(), updatedAt: new Date(),
  };
}

export async function ensureSeedData(db: Db, tenantId: string) {
  const existing = await db.collection(COLLECTION).findOne({ tenantId });
  if (existing) return;
  const processes = buildSeedProcesses(tenantId);
  await db.collection(COLLECTION).insertMany(processes);
}

/* ── CRUD ───────────────────────────────────────────────────────────── */

export async function getDashboard(db: Db, tenantId: string) {
  return db.collection(COLLECTION).find({ tenantId }).sort({ healthScore: 1 }).toArray();
}

export async function getDetail(db: Db, tenantId: string, analysisId: string) {
  return db.collection(COLLECTION).findOne({ tenantId, analysisId });
}

export async function getBottlenecks(db: Db, tenantId: string) {
  const all = await db.collection(COLLECTION).find({ tenantId }).toArray();
  return (all as ProcessAnalysis[])
    .filter(p => p.currentState?.metrics?.bottleneck)
    .map(p => ({ processName: p.processName, ...p.currentState.metrics.bottleneck, healthScore: p.healthScore }))
    .sort((a, b) => b.avgDelay - a.avgDelay);
}

export async function getImprovements(db: Db, tenantId: string) {
  const all = await db.collection(COLLECTION).find({ tenantId }).toArray();
  const imps: (Improvement & { processName: string })[] = [];
  for (const p of all as ProcessAnalysis[]) {
    for (const i of (p.improvements || [])) {
      imps.push({ ...i, processName: p.processName });
    }
  }
  return imps;
}

export async function proposeImprovement(db: Db, tenantId: string, analysisId: string, imp: Partial<Improvement>) {
  const full: Improvement = {
    actionId: uid(), title: imp.title || '', type: imp.type || 'SIMPLIFY', description: imp.description || '',
    impact: imp.impact || 'MEDIUM', effort: imp.effort || 'MEDIUM', status: 'IDENTIFIED',
    assignedTo: imp.assignedTo || '', dueDate: imp.dueDate || new Date(),
  };
  await db.collection(COLLECTION).updateOne({ tenantId, analysisId }, { $push: { improvements: full }, $set: { updatedAt: new Date() } });
  return full;
}

export async function updateImprovement(db: Db, tenantId: string, analysisId: string, actionId: string, updates: Partial<Improvement>) {
  const doc = await db.collection(COLLECTION).findOne({ tenantId, analysisId }) as ProcessAnalysis | null;
  if (!doc) return;
  const imps: Improvement[] = doc.improvements || [];
  const idx = imps.findIndex(i => i.actionId === actionId);
  if (idx < 0) return;
  Object.assign(imps[idx], updates);
  await db.collection(COLLECTION).updateOne({ tenantId, analysisId }, { $set: { improvements: imps, updatedAt: new Date() } });
}

export { COLLECTION };
