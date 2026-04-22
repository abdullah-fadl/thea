import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { ObjectId } from '@/lib/cvision/infra/mongo-compat';

/* ═══════════════════════════════════════════════════════════════════
 *  Strategic Alignment Engine — لوحة المواءمة الاستراتيجية
 *
 *  "OD looks at the whole system: Strategy, Structure, Culture,
 *   Processes, People, Rewards — are they aligned?"
 *
 *  Galbraith's Star Model: Strategy ↔ Structure ↔ Processes
 *                           ↔ Rewards ↔ People
 *
 *  Identifies gaps and classifies interventions as OD vs L&D vs BOTH.
 * ═══════════════════════════════════════════════════════════════════ */

const COLLECTION = 'cvision_strategic_alignment';
const uid = () => new ObjectId().toHexString().slice(-8);

/* ── Types ─────────────────────────────────────────────────────────── */

export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type InterventionType = 'OD' | 'L&D' | 'BOTH';
export type GapStatus = 'IDENTIFIED' | 'PLANNED' | 'IN_PROGRESS' | 'RESOLVED';

export interface StrategicPillar {
  pillarId: string;
  name: string;
  nameAr: string;
  description: string;
  weight: number;
  progress: number;
  linkedOkrs: string[];
  okrProgress: number;
  enablingStructure: string[];
  enablingProcesses: string[];
  enablingCapabilities: string[];
  enablingCulture: string[];
}

export interface AlignmentPair {
  score: number;
  gaps: string[];
}

export interface AlignmentScores {
  strategyStructure: AlignmentPair;
  strategyCulture: AlignmentPair;
  strategyProcess: AlignmentPair;
  strategyPeople: AlignmentPair;
  strategyRewards: AlignmentPair;
  structureProcess: AlignmentPair;
  overallAlignment: number;
}

export interface StarModel {
  strategy: number;
  structure: number;
  processes: number;
  rewards: number;
  people: number;
  balance: number;
  weakestPoint: string;
  strongestPoint: string;
}

export interface StrategicGap {
  gapId: string;
  dimension: string;
  description: string;
  descriptionAr: string;
  severity: GapSeverity;
  interventionType: InterventionType;
  interventionRationale: string;
  odIntervention?: { type: string; description: string; linkedId?: string };
  ldIntervention?: { type: string; description: string; linkedIds?: string[] };
  status: GapStatus;
  owner: string;
  targetDate: Date;
  resolvedDate?: Date;
}

export interface MaturityLevel {
  overall: number;
  byDimension: { strategyMaturity: number; structureMaturity: number; cultureMaturity: number; processMaturity: number; peopleMaturity: number };
  nextLevelActions: string[];
}

export interface StrategicAlignment {
  _id?: any;
  tenantId: string;
  year: number;
  strategy: {
    vision: string; visionAr: string;
    mission: string; missionAr: string;
    strategicPillars: StrategicPillar[];
  };
  alignmentScores: AlignmentScores;
  starModel: StarModel;
  gaps: StrategicGap[];
  maturityLevel: MaturityLevel;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  reviewedBy: string;
  lastUpdated: Date;
  createdAt: Date;
}

/* ── Star Model Calculation ────────────────────────────────────────── */

export function calculateStarModel(scores: { strategy: number; structure: number; processes: number; rewards: number; people: number }): StarModel {
  const values = Object.values(scores);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / values.length);

  const entries = Object.entries(scores) as [string, number][];
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);

  return { ...scores, balance: Math.round(stdDev * 100) / 100, weakestPoint: sorted[0][0], strongestPoint: sorted[sorted.length - 1][0] };
}

export function calculateOverallAlignment(pairs: AlignmentScores): number {
  const vals = [pairs.strategyStructure.score, pairs.strategyCulture.score, pairs.strategyProcess.score, pairs.strategyPeople.score, pairs.strategyRewards.score, pairs.structureProcess.score];
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
}

/* ── Gap Identification ────────────────────────────────────────────── */

export function identifyGaps(star: StarModel, extra: {
  roleOverlaps?: number; badProcesses?: string[]; skillGapPct?: number;
  cultureScore?: number; rewardsAligned?: boolean;
}): StrategicGap[] {
  const gaps: StrategicGap[] = [];
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  if ((extra.roleOverlaps || 0) > 2) {
    gaps.push({ gapId: uid(), dimension: 'Structure', description: `${extra.roleOverlaps} role overlaps detected — causing confusion and inefficiency`, descriptionAr: `${extra.roleOverlaps} تداخلات في الأدوار — تسبب ارتباك وعدم كفاءة`, severity: (extra.roleOverlaps || 0) > 5 ? 'CRITICAL' : 'HIGH', interventionType: 'OD', interventionRationale: 'Structural issue requires organizational redesign', odIntervention: { type: 'RESTRUCTURE', description: 'Reorganize overlapping roles via Org Design Studio' }, status: 'IDENTIFIED', owner: 'HR Director', targetDate: future });
  }

  if (extra.badProcesses && extra.badProcesses.length > 0) {
    for (const proc of extra.badProcesses) {
      gaps.push({ gapId: uid(), dimension: 'Processes', description: `${proc} is underperforming — needs redesign`, descriptionAr: `${proc} أداؤه ضعيف — يحتاج إعادة تصميم`, severity: 'HIGH', interventionType: 'OD', interventionRationale: 'Process redesign is an OD intervention', odIntervention: { type: 'PROCESS_REDESIGN', description: `Redesign ${proc}` }, status: 'IDENTIFIED', owner: 'Process Owner', targetDate: future });
    }
  }

  if ((extra.skillGapPct || 0) > 15) {
    gaps.push({ gapId: uid(), dimension: 'People', description: `${Math.round(extra.skillGapPct || 0)}% skill gap across organization`, descriptionAr: `${Math.round(extra.skillGapPct || 0)}% فجوة مهارات في المنظمة`, severity: (extra.skillGapPct || 0) > 30 ? 'CRITICAL' : 'HIGH', interventionType: 'L&D', interventionRationale: 'Skill gaps are addressed through training and development', ldIntervention: { type: 'TRAINING_PROGRAM', description: 'Targeted skill development programs' }, status: 'IDENTIFIED', owner: 'L&D Manager', targetDate: future });
  }

  if ((extra.cultureScore || 5) < 3.0) {
    gaps.push({ gapId: uid(), dimension: 'Culture', description: 'Culture health below threshold — affects all other dimensions', descriptionAr: 'صحة الثقافة تحت الحد المطلوب — تؤثر على كل الأبعاد', severity: 'HIGH', interventionType: 'BOTH', interventionRationale: 'Culture requires both organizational systems change AND leadership behavior development', odIntervention: { type: 'CULTURE_INITIATIVE', description: 'Culture transformation program' }, ldIntervention: { type: 'LEADERSHIP_DEVELOPMENT', description: 'Leadership behavior change program' }, status: 'IDENTIFIED', owner: 'CEO', targetDate: future });
  }

  if (star.rewards < 3.0 || extra.rewardsAligned === false) {
    gaps.push({ gapId: uid(), dimension: 'Rewards', description: 'Reward system not aligned with strategy — rewards individual output but strategy requires teamwork', descriptionAr: 'نظام المكافآت غير متوائم مع الاستراتيجية', severity: 'MEDIUM', interventionType: 'OD', interventionRationale: 'Compensation and reward structure is an organizational system', odIntervention: { type: 'POLICY_CHANGE', description: 'Introduce team-based incentive component' }, status: 'IDENTIFIED', owner: 'Compensation Manager', targetDate: future });
  }

  return gaps.sort((a, b) => { const sev: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }; return (sev[a.severity] || 3) - (sev[b.severity] || 3); });
}

/* ── Maturity Assessment ───────────────────────────────────────────── */

export function assessMaturity(star: StarModel, alignment: number): MaturityLevel {
  const byDim = {
    strategyMaturity: Math.min(Math.round(star.strategy), 5),
    structureMaturity: Math.min(Math.round(star.structure), 5),
    cultureMaturity: 3,
    processMaturity: Math.min(Math.round(star.processes), 5),
    peopleMaturity: Math.min(Math.round(star.people), 5),
  };

  const avg = Object.values(byDim).reduce((s, v) => s + v, 0) / 5;
  let overall = Math.min(Math.round(avg), 5);
  if (star.balance > 1.0) overall = Math.max(overall - 1, 1);

  const actions: string[] = [];
  if (overall <= 2) actions.push('Document strategy and communicate to all levels', 'Establish basic alignment measurement');
  else if (overall <= 3) actions.push('Implement data-driven alignment measurement', 'Link KPIs across all dimensions');
  else if (overall <= 4) actions.push('Integrate OD and L&D interventions systematically', 'Establish continuous feedback loops');
  else actions.push('Maintain excellence through continuous improvement', 'Benchmark against industry leaders');

  return { overall, byDimension: byDim, nextLevelActions: actions };
}

/* ── Seed Data ─────────────────────────────────────────────────────── */

function buildSeed(tenantId: string): StrategicAlignment {
  const pillars: StrategicPillar[] = [
    { pillarId: uid(), name: 'Digital Transformation', nameAr: 'التحول الرقمي', description: 'Automate core processes and enable data-driven decisions', weight: 0.30, progress: 65, linkedOkrs: [], okrProgress: 65, enablingStructure: ['IT', 'Operations'], enablingProcesses: ['ERP Implementation', 'Process Automation'], enablingCapabilities: ['Data Analytics', 'Digital Literacy'], enablingCulture: ['Innovation', 'Change Readiness'] },
    { pillarId: uid(), name: 'Talent Excellence', nameAr: 'التميز في المواهب', description: 'Attract, develop, and retain top talent', weight: 0.25, progress: 55, linkedOkrs: [], okrProgress: 55, enablingStructure: ['HR', 'L&D'], enablingProcesses: ['Hiring', 'Performance Management', 'Training'], enablingCapabilities: ['Leadership', 'Core Skills'], enablingCulture: ['Employee Development', 'Recognition'] },
    { pillarId: uid(), name: 'Customer Centricity', nameAr: 'التركيز على العميل', description: 'Put customer experience at the heart of everything', weight: 0.25, progress: 45, linkedOkrs: [], okrProgress: 45, enablingStructure: ['Sales', 'Operations'], enablingProcesses: ['CRM', 'Service Delivery'], enablingCapabilities: ['Customer Service', 'Communication'], enablingCulture: ['Customer Focus', 'Responsiveness'] },
    { pillarId: uid(), name: 'Operational Efficiency', nameAr: 'الكفاءة التشغيلية', description: 'Reduce waste and improve process efficiency', weight: 0.20, progress: 70, linkedOkrs: [], okrProgress: 70, enablingStructure: ['Operations', 'Finance'], enablingProcesses: ['Procurement', 'Payroll', 'Reporting'], enablingCapabilities: ['Process Improvement', 'Lean'], enablingCulture: ['Continuous Improvement', 'Accountability'] },
  ];

  const alignmentScores: AlignmentScores = {
    strategyStructure: { score: 3.8, gaps: ['IT department underresourced for digital transformation goals'] },
    strategyCulture: { score: 3.0, gaps: ['Strategy requires innovation but culture is hierarchy-dominant', 'Low psychological safety inhibits change'] },
    strategyProcess: { score: 3.5, gaps: ['Procurement process too slow for agility goals'] },
    strategyPeople: { score: 2.5, gaps: ['35% skill gap in digital capabilities', 'Succession coverage at 60%'] },
    strategyRewards: { score: 2.1, gaps: ['Rewards are 100% individual but strategy emphasizes teamwork', 'No innovation incentive'] },
    structureProcess: { score: 3.3, gaps: ['5 role overlaps between departments slow down cross-functional processes'] },
    overallAlignment: 0,
  };
  alignmentScores.overallAlignment = calculateOverallAlignment(alignmentScores);

  const starScores = { strategy: 4.2, structure: 3.8, processes: 3.5, rewards: 2.8, people: 3.1 };
  const starModel = calculateStarModel(starScores);

  const gaps = identifyGaps(starModel, { roleOverlaps: 5, badProcesses: ['Procurement Request'], skillGapPct: 35, cultureScore: 2.8, rewardsAligned: false });
  const maturityLevel = assessMaturity(starModel, alignmentScores.overallAlignment);

  return {
    tenantId, year: 2026,
    strategy: {
      vision: 'To be the leading technology-enabled organization in the region', visionAr: 'أن نكون المنظمة الرائدة المُمكّنة بالتقنية في المنطقة',
      mission: 'Deliver exceptional value through innovation, talent, and operational excellence', missionAr: 'تقديم قيمة استثنائية عبر الابتكار والمواهب والتميز التشغيلي',
      strategicPillars: pillars,
    },
    alignmentScores, starModel, gaps, maturityLevel,
    status: 'ACTIVE', reviewedBy: 'CEO',
    lastUpdated: new Date(), createdAt: new Date(),
  };
}

export async function ensureSeedData(db: Db, tenantId: string) {
  const existing = await db.collection(COLLECTION).findOne({ tenantId });
  if (existing) return;
  await db.collection(COLLECTION).insertOne(buildSeed(tenantId));
}

/* ── CRUD ───────────────────────────────────────────────────────────── */

export async function getDashboard(db: Db, tenantId: string) {
  return db.collection(COLLECTION).findOne({ tenantId, status: 'ACTIVE' }, { sort: { year: -1 } });
}

export async function getStarModel(db: Db, tenantId: string) {
  const doc = await getDashboard(db, tenantId) as StrategicAlignment | null;
  return doc?.starModel || null;
}

export async function getGaps(db: Db, tenantId: string) {
  const doc = await getDashboard(db, tenantId) as StrategicAlignment | null;
  return doc?.gaps || [];
}

export async function getPillarProgress(db: Db, tenantId: string) {
  const doc = await getDashboard(db, tenantId) as StrategicAlignment | null;
  return doc?.strategy?.strategicPillars || [];
}

export async function getMaturity(db: Db, tenantId: string) {
  const doc = await getDashboard(db, tenantId) as StrategicAlignment | null;
  return doc?.maturityLevel || null;
}

export async function setStrategy(db: Db, tenantId: string, strategy: StrategicAlignment['strategy']) {
  await db.collection(COLLECTION).updateOne({ tenantId, status: 'ACTIVE' }, { $set: { strategy, lastUpdated: new Date() } });
}

export async function addGap(db: Db, tenantId: string, gap: Partial<StrategicGap>) {
  const full: StrategicGap = {
    gapId: uid(), dimension: gap.dimension || '', description: gap.description || '', descriptionAr: gap.descriptionAr || '',
    severity: gap.severity || 'MEDIUM', interventionType: gap.interventionType || 'OD', interventionRationale: gap.interventionRationale || '',
    odIntervention: gap.odIntervention, ldIntervention: gap.ldIntervention,
    status: 'IDENTIFIED', owner: gap.owner || '', targetDate: gap.targetDate || new Date(),
  };
  await db.collection(COLLECTION).updateOne({ tenantId, status: 'ACTIVE' }, { $push: { gaps: full } as Record<string, unknown>, $set: { lastUpdated: new Date() } });
  return full;
}

export async function assignIntervention(db: Db, tenantId: string, gapId: string, updates: Partial<StrategicGap>) {
  const doc = await db.collection(COLLECTION).findOne({ tenantId, status: 'ACTIVE' }) as StrategicAlignment | null;
  if (!doc) return;
  const gaps: StrategicGap[] = doc.gaps || [];
  const idx = gaps.findIndex(g => g.gapId === gapId);
  if (idx < 0) return;
  Object.assign(gaps[idx], updates);
  await db.collection(COLLECTION).updateOne({ tenantId, status: 'ACTIVE' }, { $set: { gaps, lastUpdated: new Date() } });
}

export async function refresh(db: Db, tenantId: string) {
  const doc = await db.collection(COLLECTION).findOne({ tenantId, status: 'ACTIVE' }) as StrategicAlignment | null;
  if (!doc) return null;

  // Re-pull data from other OD systems
  const orgDesign = await db.collection('cvision_org_designs').findOne({ tenantId, type: 'CURRENT' }) as Record<string, unknown> | null;
  const cultureAssess = await db.collection('cvision_culture_assessments').findOne({ tenantId }, { sort: { createdAt: -1 } }) as Record<string, unknown> | null;
  const processes = await db.collection('cvision_process_analysis').find({ tenantId }).toArray() as Array<Record<string, unknown>>;

  const analysis = (orgDesign?.analysis ?? {}) as Record<string, unknown>;
  const roleOverlaps = (Array.isArray(analysis.roleOverlaps) ? analysis.roleOverlaps.length : 0);
  const badProcesses = processes.filter(p => (p.healthScore as number) < 3).map(p => p.processName as string);
  const cultureScore = (cultureAssess?.overallCultureScore as number) || 3;

  const star = doc.starModel;
  const newGaps = identifyGaps(star, { roleOverlaps, badProcesses, skillGapPct: 35, cultureScore, rewardsAligned: star.rewards >= 3.5 });
  const maturity = assessMaturity(star, doc.alignmentScores.overallAlignment);

  await db.collection(COLLECTION).updateOne({ tenantId, status: 'ACTIVE' }, { $set: { gaps: newGaps, maturityLevel: maturity, lastUpdated: new Date() } });
  return { gaps: newGaps, maturityLevel: maturity };
}

export { COLLECTION };
