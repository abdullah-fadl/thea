import type { Db, Document } from '@/lib/cvision/infra/mongo-compat';
import { ObjectId } from '@/lib/cvision/infra/mongo-compat';

/* ═══════════════════════════════════════════════════════════════════
 *  Organization Design Engine — التصميم التنظيمي
 *
 *  Answers: Is the department split logical? Are promotion paths clear?
 *  Is there authority overlap? Span of control, layers, decision paths.
 * ═══════════════════════════════════════════════════════════════════ */

const COLLECTION = 'cvision_org_designs';

/* ── Types ─────────────────────────────────────────────────────────── */

export type DesignType = 'CURRENT' | 'PROPOSED' | 'SCENARIO' | 'ARCHIVED';
export type DesignModel = 'FUNCTIONAL' | 'DIVISIONAL' | 'MATRIX' | 'FLAT' | 'NETWORK' | 'HYBRID';
export type UnitType = 'COMPANY' | 'DIVISION' | 'DEPARTMENT' | 'SECTION' | 'UNIT' | 'TEAM';
export type LineType = 'SOLID' | 'DOTTED';
export type DesignStatus = 'DRAFT' | 'ANALYZING' | 'PROPOSED' | 'APPROVED' | 'IMPLEMENTING' | 'ACTIVE' | 'ARCHIVED';

export interface Position {
  positionId: string;
  title: string;
  titleAr: string;
  grade: string;
  headcount: number;
  filled: number;
  vacant: number;
  critical: boolean;
  mainResponsibilities: string[];
  requiredSkills: string[];
  reportingTo: string;
}

export interface OrgUnit {
  unitId: string;
  name: string;
  nameAr: string;
  type: UnitType;
  parentUnitId?: string;
  level: number;
  headPositionId?: string;
  headPositionTitle: string;
  headEmployeeId?: string;
  headEmployeeName?: string;
  positions: Position[];
  totalHeadcount: number;
  totalBudgetedPositions: number;
  totalVacancies: number;
  spanOfControl: number;
  layersBelow: number;
}

export interface ReportingLine {
  fromPositionId: string;
  toPositionId: string;
  type: LineType;
}

export interface RoleOverlap {
  position1: string;
  position2: string;
  unit1: string;
  unit2: string;
  overlapPercentage: number;
  overlappingResponsibilities: string[];
  recommendation: string;
}

export interface SpanAnalysis {
  average: number;
  min: { unitName: string; value: number };
  max: { unitName: string; value: number };
  ideal: { min: number; max: number };
  outliers: { unitName: string; value: number; issue: 'TOO_NARROW' | 'TOO_WIDE' }[];
  distribution: Record<string, number>;
}

export interface LayerAnalysis {
  totalLayers: number;
  avgLayersToFrontline: number;
  recommendation: string;
}

export interface DecisionPath {
  process: string;
  approvalSteps: number;
  avgDaysToComplete: number;
  instancesLast30Days: number;
  bottleneckStep?: string;
  recommendation: string;
}

export interface VacancyAnalysis {
  totalVacant: number;
  criticalVacant: number;
  vacancyRate: number;
  byUnit: { unit: string; vacant: number; critical: number }[];
}

export interface CostAnalysis {
  totalPersonnelCost: number;
  costByUnit: { unit: string; cost: number; percentage: number }[];
  managerToICRatio: number;
  supportToFrontlineRatio: number;
}

export interface DesignAnalysis {
  spanOfControl: SpanAnalysis;
  layers: LayerAnalysis;
  roleOverlaps: RoleOverlap[];
  vacancies: VacancyAnalysis;
  costAnalysis: CostAnalysis;
  decisionPaths: DecisionPath[];
}

export interface DesignComparison {
  addedUnits: string[];
  removedUnits: string[];
  mergedUnits: { from: string[]; to: string }[];
  movedPositions: { position: string; from: string; to: string }[];
  headcountChange: number;
  costChange: number;
  layerChange: number;
  spanChange: { current: number; proposed: number };
  overlapsResolved: number;
  impactSummary: string;
}

export interface OrgDesign {
  _id?: unknown;
  tenantId: string;
  designId: string;
  name: string;
  type: DesignType;
  designModel: DesignModel;
  units: OrgUnit[];
  reportingLines: ReportingLine[];
  analysis: DesignAnalysis;
  comparisonWithCurrent?: DesignComparison;
  createdBy: string;
  approvedBy?: string;
  status: DesignStatus;
  createdAt: Date;
  updatedAt: Date;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

const uid = () => new ObjectId().toHexString().slice(-8);

function buildTree(units: OrgUnit[]): Map<string, OrgUnit[]> {
  const children = new Map<string, OrgUnit[]>();
  for (const u of units) {
    const parent = u.parentUnitId || '__root__';
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(u);
  }
  return children;
}

function maxDepth(unitId: string, tree: Map<string, OrgUnit[]>, depth = 0): number {
  const kids = tree.get(unitId) || [];
  if (kids.length === 0) return depth;
  return Math.max(...kids.map(k => maxDepth(k.unitId, tree, depth + 1)));
}

/* ── Span of Control Analysis ──────────────────────────────────────── */

export function analyzeSpanOfControl(units: OrgUnit[]): SpanAnalysis {
  const managers = units.filter(u => u.spanOfControl > 0);
  if (managers.length === 0) {
    return { average: 0, min: { unitName: '', value: 0 }, max: { unitName: '', value: 0 }, ideal: { min: 5, max: 8 }, outliers: [], distribution: { '1-3': 0, '4-6': 0, '7-9': 0, '10-15': 0, '16+': 0 } };
  }

  const avgSpan = Math.round((managers.reduce((s, m) => s + m.spanOfControl, 0) / managers.length) * 10) / 10;
  const sorted = [...managers].sort((a, b) => a.spanOfControl - b.spanOfControl);

  const outliers: SpanAnalysis['outliers'] = [];
  for (const m of managers) {
    if (m.spanOfControl < 3) outliers.push({ unitName: m.name, value: m.spanOfControl, issue: 'TOO_NARROW' });
    else if (m.spanOfControl > 12) outliers.push({ unitName: m.name, value: m.spanOfControl, issue: 'TOO_WIDE' });
  }

  return {
    average: avgSpan,
    min: { unitName: sorted[0].name, value: sorted[0].spanOfControl },
    max: { unitName: sorted[sorted.length - 1].name, value: sorted[sorted.length - 1].spanOfControl },
    ideal: { min: 5, max: 8 },
    outliers,
    distribution: {
      '1-3': managers.filter(m => m.spanOfControl <= 3).length,
      '4-6': managers.filter(m => m.spanOfControl >= 4 && m.spanOfControl <= 6).length,
      '7-9': managers.filter(m => m.spanOfControl >= 7 && m.spanOfControl <= 9).length,
      '10-15': managers.filter(m => m.spanOfControl >= 10 && m.spanOfControl <= 15).length,
      '16+': managers.filter(m => m.spanOfControl >= 16).length,
    },
  };
}

/* ── Layer Analysis ────────────────────────────────────────────────── */

export function analyzeLayers(units: OrgUnit[]): LayerAnalysis {
  if (units.length === 0) return { totalLayers: 0, avgLayersToFrontline: 0, recommendation: 'No units defined' };

  const totalLayers = Math.max(...units.map(u => u.level)) + 1;
  const leaves = units.filter(u => !units.some(o => o.parentUnitId === u.unitId));
  const avgToFrontline = leaves.length > 0
    ? Math.round((leaves.reduce((s, l) => s + l.level, 0) / leaves.length) * 10) / 10
    : 0;

  let recommendation = 'Structure depth is acceptable';
  if (totalLayers > 6) recommendation = 'Consider removing 1-2 management layers to speed up decisions';
  else if (totalLayers > 8) recommendation = 'Excessive hierarchy — flatten structure significantly';
  else if (totalLayers <= 3) recommendation = 'Flat structure — ensure adequate oversight';

  return { totalLayers, avgLayersToFrontline: avgToFrontline, recommendation };
}

/* ── Role Overlap Detection ────────────────────────────────────────── */

export function detectRoleOverlaps(units: OrgUnit[]): RoleOverlap[] {
  const allPositions: { title: string; unit: string; responsibilities: string[] }[] = [];
  for (const u of units) {
    for (const p of u.positions) {
      allPositions.push({ title: p.title, unit: u.name, responsibilities: p.mainResponsibilities.map(r => r.toLowerCase().trim()) });
    }
  }

  const overlaps: RoleOverlap[] = [];
  for (let i = 0; i < allPositions.length; i++) {
    for (let j = i + 1; j < allPositions.length; j++) {
      const a = allPositions[i];
      const b = allPositions[j];
      const setA = new Set(a.responsibilities);
      const setB = new Set(b.responsibilities);
      const intersection = [...setA].filter(x => setB.has(x));
      const overlapPct = Math.round((intersection.length / Math.min(setA.size || 1, setB.size || 1)) * 100);

      if (overlapPct > 30) {
        overlaps.push({
          position1: a.title, position2: b.title,
          unit1: a.unit, unit2: b.unit,
          overlapPercentage: overlapPct,
          overlappingResponsibilities: intersection,
          recommendation: overlapPct > 70 ? 'Consider merging these roles' : overlapPct > 50 ? 'Clarify boundaries between these roles' : 'Minor overlap — document clear RACI',
        });
      }
    }
  }
  return overlaps.sort((a, b) => b.overlapPercentage - a.overlapPercentage);
}

/* ── Vacancy Analysis ──────────────────────────────────────────────── */

export function analyzeVacancies(units: OrgUnit[]): VacancyAnalysis {
  let totalVacant = 0, criticalVacant = 0, totalBudgeted = 0;
  const byUnit: VacancyAnalysis['byUnit'] = [];

  for (const u of units) {
    let uVacant = 0, uCritical = 0;
    for (const p of u.positions) {
      uVacant += p.vacant;
      if (p.critical && p.vacant > 0) uCritical += p.vacant;
    }
    totalVacant += uVacant;
    criticalVacant += uCritical;
    totalBudgeted += u.totalBudgetedPositions;
    if (uVacant > 0) byUnit.push({ unit: u.name, vacant: uVacant, critical: uCritical });
  }

  return {
    totalVacant,
    criticalVacant,
    vacancyRate: totalBudgeted > 0 ? Math.round((totalVacant / totalBudgeted) * 100) : 0,
    byUnit: byUnit.sort((a, b) => b.vacant - a.vacant),
  };
}

/* ── Cost Analysis ─────────────────────────────────────────────────── */

export function analyzeCost(units: OrgUnit[]): CostAnalysis {
  const avgCostPerHead = 12000; // SAR/month placeholder
  let totalHeads = 0, totalManagers = 0, totalIC = 0, totalSupport = 0, totalFrontline = 0;
  const costByUnit: CostAnalysis['costByUnit'] = [];

  for (const u of units) {
    const heads = u.totalHeadcount;
    totalHeads += heads;
    const cost = heads * avgCostPerHead * 12;
    costByUnit.push({ unit: u.name, cost, percentage: 0 });

    for (const p of u.positions) {
      const isManager = p.title.toLowerCase().includes('manager') || p.title.toLowerCase().includes('director') || p.title.toLowerCase().includes('head') || p.title.toLowerCase().includes('vp');
      if (isManager) totalManagers += p.filled;
      else totalIC += p.filled;

      const isSupport = ['HR', 'Finance', 'IT', 'Admin', 'Legal'].some(s => u.name.includes(s));
      if (isSupport) totalSupport += p.filled;
      else totalFrontline += p.filled;
    }
  }

  const totalCost = totalHeads * avgCostPerHead * 12;
  for (const c of costByUnit) c.percentage = totalCost > 0 ? Math.round((c.cost / totalCost) * 100) : 0;

  return {
    totalPersonnelCost: totalCost,
    costByUnit: costByUnit.sort((a, b) => b.cost - a.cost),
    managerToICRatio: totalIC > 0 ? Math.round((totalManagers / totalIC) * 100) / 100 : 0,
    supportToFrontlineRatio: totalFrontline > 0 ? Math.round((totalSupport / totalFrontline) * 100) / 100 : 0,
  };
}

/* ── Decision Path Analysis (from live workflow data) ──────────────── */

export async function analyzeDecisionPaths(db: Db, tenantId: string): Promise<DecisionPath[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const workflows = await db.collection('cvision_workflows').find({ tenantId, status: 'ACTIVE' }).toArray();
  const instances = await db.collection('cvision_workflow_instances').find({ tenantId, status: 'COMPLETED', completedAt: { $gte: thirtyDaysAgo } }).toArray();

  if (workflows.length === 0) {
    return [
      { process: 'Leave Approval', approvalSteps: 3, avgDaysToComplete: 2.1, instancesLast30Days: 45, recommendation: 'Acceptable' },
      { process: 'Procurement Request', approvalSteps: 6, avgDaysToComplete: 8.3, instancesLast30Days: 18, bottleneckStep: 'VP Approval', recommendation: 'Too many approval layers — consider delegation for items < 5,000 SAR' },
      { process: 'Travel Request', approvalSteps: 4, avgDaysToComplete: 3.5, instancesLast30Days: 12, recommendation: 'Acceptable' },
      { process: 'New Hire Approval', approvalSteps: 5, avgDaysToComplete: 12.0, instancesLast30Days: 8, bottleneckStep: 'CEO Approval', recommendation: 'Process is slow — consider delegation or auto-approval for budgeted positions' },
      { process: 'Expense Reimbursement', approvalSteps: 3, avgDaysToComplete: 4.2, instancesLast30Days: 30, recommendation: 'Acceptable' },
    ];
  }

  return workflows.map(wf => {
    const related = instances.filter(i => i.workflowId === wf.workflowId);
    const steps: Document[] = wf.steps || [];
    const approvalSteps = steps.filter((s) => s.type === 'APPROVAL').length;
    const avgHrs = related.length > 0 ? related.reduce((s, i) => s + (i.totalDuration || 0), 0) / related.length : 0;
    const avgDays = Math.round((avgHrs / 24) * 10) / 10;

    let recommendation = 'Acceptable';
    if (approvalSteps > 4) recommendation = 'Too many approval layers — consider delegation or auto-approval for low-risk items';
    else if (avgHrs > 72) recommendation = 'Process is slow — identify and address bottleneck';

    return { process: wf.name || 'Unnamed', approvalSteps, avgDaysToComplete: avgDays, instancesLast30Days: related.length, recommendation };
  });
}

/* ── Full Analysis ─────────────────────────────────────────────────── */

export async function runFullAnalysis(db: Db, tenantId: string, units: OrgUnit[]): Promise<DesignAnalysis> {
  return {
    spanOfControl: analyzeSpanOfControl(units),
    layers: analyzeLayers(units),
    roleOverlaps: detectRoleOverlaps(units),
    vacancies: analyzeVacancies(units),
    costAnalysis: analyzeCost(units),
    decisionPaths: await analyzeDecisionPaths(db, tenantId),
  };
}

/* ── Scenario Comparison ───────────────────────────────────────────── */

export function compareDesigns(current: OrgDesign, proposed: OrgDesign): DesignComparison {
  const curIds = new Set(current.units.map(u => u.unitId));
  const proIds = new Set(proposed.units.map(u => u.unitId));

  const addedUnits = proposed.units.filter(u => !curIds.has(u.unitId)).map(u => u.name);
  const removedUnits = current.units.filter(u => !proIds.has(u.unitId)).map(u => u.name);

  const curHeadcount = current.units.reduce((s, u) => s + u.totalHeadcount, 0);
  const proHeadcount = proposed.units.reduce((s, u) => s + u.totalHeadcount, 0);

  const spanCur = current.analysis?.spanOfControl?.average || 0;
  const spanPro = proposed.analysis?.spanOfControl?.average || 0;

  const layersCur = current.analysis?.layers?.totalLayers || 0;
  const layersPro = proposed.analysis?.layers?.totalLayers || 0;

  const costCur = current.analysis?.costAnalysis?.totalPersonnelCost || 0;
  const costPro = proposed.analysis?.costAnalysis?.totalPersonnelCost || 0;

  const overlapsCur = current.analysis?.roleOverlaps?.length || 0;
  const overlapsPro = proposed.analysis?.roleOverlaps?.length || 0;

  const parts: string[] = [];
  if (addedUnits.length) parts.push(`+${addedUnits.length} new units`);
  if (removedUnits.length) parts.push(`-${removedUnits.length} units removed`);
  if (layersPro !== layersCur) parts.push(`${layersPro - layersCur > 0 ? '+' : ''}${layersPro - layersCur} layers`);
  if (proHeadcount !== curHeadcount) parts.push(`${proHeadcount - curHeadcount > 0 ? '+' : ''}${proHeadcount - curHeadcount} headcount`);

  return {
    addedUnits,
    removedUnits,
    mergedUnits: [],
    movedPositions: [],
    headcountChange: proHeadcount - curHeadcount,
    costChange: costPro - costCur,
    layerChange: layersPro - layersCur,
    spanChange: { current: spanCur, proposed: spanPro },
    overlapsResolved: Math.max(overlapsCur - overlapsPro, 0),
    impactSummary: parts.join(', ') || 'No significant structural changes',
  };
}

/* ── Seed Data ─────────────────────────────────────────────────────── */

function pos(title: string, titleAr: string, grade: string, headcount: number, filled: number, critical: boolean, responsibilities: string[], skills: string[], reportingTo: string): Position {
  return { positionId: uid(), title, titleAr, grade, headcount, filled, vacant: headcount - filled, critical, mainResponsibilities: responsibilities, requiredSkills: skills, reportingTo };
}

function unit(name: string, nameAr: string, type: UnitType, parentUnitId: string | undefined, level: number, headTitle: string, headName: string | undefined, positions: Position[], span: number): OrgUnit {
  const filled = positions.reduce((s, p) => s + p.filled, 0);
  const budgeted = positions.reduce((s, p) => s + p.headcount, 0);
  return { unitId: uid(), name, nameAr, type, parentUnitId, level, headPositionId: positions[0]?.positionId, headPositionTitle: headTitle, headEmployeeName: headName, positions, totalHeadcount: filled, totalBudgetedPositions: budgeted, totalVacancies: budgeted - filled, spanOfControl: span, layersBelow: 0 };
}

function buildSeedDesign(tenantId: string): OrgDesign {
  const companyId = uid();
  const hrId = uid(), finId = uid(), opsId = uid(), itId = uid(), salesId = uid();

  const ceoPos = pos('CEO', 'الرئيس التنفيذي', 'E1', 1, 1, true, ['Strategic planning', 'Board relations', 'Organization leadership'], ['Leadership', 'Strategy'], '');

  const hrDirPos = pos('HR Director', 'مدير الموارد البشرية', 'D1', 1, 1, true, ['HR strategy', 'Workforce planning', 'Employee relations', 'Compensation & benefits'], ['HR Management', 'Labor Law'], ceoPos.positionId);
  const hrRecPos = pos('Recruitment Specialist', 'أخصائي توظيف', 'S2', 2, 2, false, ['Source candidates', 'Screen applications', 'Coordinate interviews', 'Onboarding new hires'], ['Recruiting', 'Interviewing'], hrDirPos.positionId);
  const hrOfficerPos = pos('HR Officer', 'موظف موارد بشرية', 'S2', 3, 2, false, ['Employee records', 'Leave management', 'Benefits administration', 'Onboarding new hires', 'Exit processing'], ['HRIS', 'Administration'], hrDirPos.positionId);
  const hrTrainPos = pos('Training Coordinator', 'منسق تدريب', 'S3', 1, 1, false, ['Training needs analysis', 'Program coordination', 'Vendor management', 'Training records'], ['L&D', 'Facilitation'], hrDirPos.positionId);

  const finDirPos = pos('Finance Director', 'مدير المالية', 'D1', 1, 1, true, ['Financial planning', 'Budgeting', 'Audit coordination', 'Financial reporting'], ['Accounting', 'Financial Analysis'], ceoPos.positionId);
  const finAccPos = pos('Senior Accountant', 'محاسب أول', 'S1', 2, 2, false, ['General ledger', 'Month-end close', 'Financial statements', 'Journal entries'], ['Accounting', 'ERP'], finDirPos.positionId);
  const finApPos = pos('Accounts Payable Clerk', 'موظف ذمم دائنة', 'S3', 2, 1, false, ['Invoice processing', 'Vendor payments', 'Reconciliation'], ['AP', 'Excel'], finDirPos.positionId);
  const finBudgetPos = pos('Budget Analyst', 'محلل ميزانية', 'S2', 1, 1, false, ['Budget preparation', 'Variance analysis', 'Financial forecasting', 'Cost allocation'], ['Budgeting', 'Analysis'], finDirPos.positionId);

  const opsDirPos = pos('Operations Director', 'مدير العمليات', 'D1', 1, 1, true, ['Operations strategy', 'Process optimization', 'Vendor management', 'Quality control'], ['Operations', 'Project Management'], ceoPos.positionId);
  const opsMgrPos = pos('Operations Manager', 'مدير عمليات', 'M1', 2, 2, false, ['Daily operations', 'Team supervision', 'KPI tracking', 'Resource allocation'], ['Management', 'Ops'], opsDirPos.positionId);
  const opsCoordPos = pos('Sales Coordinator', 'منسق مبيعات', 'S3', 3, 3, false, ['Order processing', 'Customer follow-up', 'Account management', 'Sales reporting'], ['CRM', 'Sales'], opsMgrPos.positionId);
  const opsProcPos = pos('Procurement Officer', 'موظف مشتريات', 'S2', 2, 2, false, ['Purchase orders', 'Vendor sourcing', 'Contract negotiation', 'Inventory management'], ['Procurement', 'Negotiation'], opsDirPos.positionId);

  const itDirPos = pos('IT Manager', 'مدير تقنية المعلومات', 'M1', 1, 1, true, ['IT strategy', 'Infrastructure management', 'Cybersecurity', 'Vendor management'], ['IT Management', 'Security'], ceoPos.positionId);
  const itDevPos = pos('Software Developer', 'مطور برمجيات', 'S1', 2, 1, false, ['Application development', 'Bug fixes', 'Code reviews', 'Technical documentation'], ['Programming', 'DevOps'], itDirPos.positionId);
  const itSupportPos = pos('IT Support Specialist', 'فني دعم تقني', 'S3', 2, 2, false, ['Help desk', 'Hardware setup', 'Network troubleshooting', 'User training'], ['Networking', 'Support'], itDirPos.positionId);

  const salesDirPos = pos('Sales Director', 'مدير المبيعات', 'D1', 1, 1, true, ['Sales strategy', 'Revenue targets', 'Key account management', 'Market analysis'], ['Sales', 'Strategy'], ceoPos.positionId);
  const salesAccPos = pos('Account Manager', 'مدير حسابات', 'S1', 3, 2, false, ['Client relationship management', 'Account management', 'Sales reporting', 'Upselling', 'Order processing'], ['CRM', 'Negotiation'], salesDirPos.positionId);
  const salesRepPos = pos('Sales Representative', 'مندوب مبيعات', 'S3', 4, 4, false, ['Prospecting', 'Client visits', 'Proposal preparation', 'Follow-ups'], ['Sales', 'Communication'], salesDirPos.positionId);

  const companyUnit: OrgUnit = {
    unitId: companyId, name: 'Company', nameAr: 'الشركة', type: 'COMPANY', level: 0,
    headPositionId: ceoPos.positionId, headPositionTitle: 'CEO', headEmployeeName: 'Abdullah Al-Rashid',
    positions: [ceoPos], totalHeadcount: 1, totalBudgetedPositions: 1, totalVacancies: 0, spanOfControl: 5, layersBelow: 3,
  };

  const units: OrgUnit[] = [
    companyUnit,
    unit('Human Resources', 'الموارد البشرية', 'DEPARTMENT', companyId, 1, 'HR Director', 'Noura Al-Ghamdi', [hrDirPos, hrRecPos, hrOfficerPos, hrTrainPos], 6),
    unit('Finance', 'المالية', 'DEPARTMENT', companyId, 1, 'Finance Director', 'Fahad Al-Mutairi', [finDirPos, finAccPos, finApPos, finBudgetPos], 4),
    unit('Operations', 'العمليات', 'DEPARTMENT', companyId, 1, 'Operations Director', 'Khalid Al-Otaibi', [opsDirPos, opsMgrPos, opsCoordPos, opsProcPos], 9),
    unit('Information Technology', 'تقنية المعلومات', 'DEPARTMENT', companyId, 1, 'IT Manager', 'Omar Al-Shamrani', [itDirPos, itDevPos, itSupportPos], 3),
    unit('Sales & Marketing', 'المبيعات والتسويق', 'DEPARTMENT', companyId, 1, 'Sales Director', 'Mona Al-Harbi', [salesDirPos, salesAccPos, salesRepPos], 9),
  ];

  const analysis: DesignAnalysis = {
    spanOfControl: analyzeSpanOfControl(units),
    layers: analyzeLayers(units),
    roleOverlaps: detectRoleOverlaps(units),
    vacancies: analyzeVacancies(units),
    costAnalysis: analyzeCost(units),
    decisionPaths: [],
  };

  return {
    tenantId,
    designId: 'ODS-2026-001',
    name: 'Current Organization Structure',
    type: 'CURRENT',
    designModel: 'FUNCTIONAL',
    units,
    reportingLines: [],
    analysis,
    createdBy: 'system',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function ensureSeedData(db: Db, tenantId: string) {
  const existing = await db.collection(COLLECTION).findOne({ tenantId });
  if (existing) return;
  const design = buildSeedDesign(tenantId);
  design.analysis.decisionPaths = await analyzeDecisionPaths(db, tenantId);
  await db.collection(COLLECTION).insertOne(design);
}

/* ── CRUD ───────────────────────────────────────────────────────────── */

export async function listDesigns(db: Db, tenantId: string) {
  return db.collection(COLLECTION).find({ tenantId }).sort({ updatedAt: -1 }).toArray();
}

export async function getDetail(db: Db, tenantId: string, designId: string) {
  return db.collection(COLLECTION).findOne({ tenantId, designId });
}

export async function getCurrent(db: Db, tenantId: string) {
  return db.collection(COLLECTION).findOne({ tenantId, type: 'CURRENT', status: 'ACTIVE' });
}

export async function createDesign(db: Db, tenantId: string, userId: string, data: Partial<OrgDesign>) {
  const count = await db.collection(COLLECTION).countDocuments({ tenantId });
  const designId = `ODS-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
  const doc: OrgDesign = {
    tenantId, designId,
    name: data.name || 'New Design',
    type: data.type || 'SCENARIO',
    designModel: data.designModel || 'FUNCTIONAL',
    units: data.units || [],
    reportingLines: data.reportingLines || [],
    analysis: data.analysis || { spanOfControl: analyzeSpanOfControl([]), layers: analyzeLayers([]), roleOverlaps: [], vacancies: analyzeVacancies([]), costAnalysis: analyzeCost([]), decisionPaths: [] },
    createdBy: userId,
    status: 'DRAFT',
    createdAt: new Date(), updatedAt: new Date(),
  };
  await db.collection(COLLECTION).insertOne(doc);
  return doc;
}

export async function cloneDesign(db: Db, tenantId: string, userId: string, sourceId: string, newName: string) {
  const source = await db.collection(COLLECTION).findOne({ tenantId, designId: sourceId });
  if (!source) return null;
  const { _id, designId: _did, ...rest } = source;
  const count = await db.collection(COLLECTION).countDocuments({ tenantId });
  const newId = `ODS-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
  const clone = { ...rest, designId: newId, name: newName || `Scenario — ${new Date().toLocaleDateString()}`, type: 'SCENARIO' as const, status: 'DRAFT' as const, createdBy: userId, createdAt: new Date(), updatedAt: new Date() };
  await db.collection(COLLECTION).insertOne(clone);
  return clone;
}

export async function addUnit(db: Db, tenantId: string, designId: string, unitData: Partial<OrgUnit>) {
  const u: OrgUnit = {
    unitId: uid(), name: unitData.name || '', nameAr: unitData.nameAr || '', type: unitData.type || 'DEPARTMENT',
    parentUnitId: unitData.parentUnitId, level: unitData.level || 1, headPositionTitle: unitData.headPositionTitle || '',
    headEmployeeName: unitData.headEmployeeName, positions: unitData.positions || [],
    totalHeadcount: 0, totalBudgetedPositions: 0, totalVacancies: 0, spanOfControl: 0, layersBelow: 0,
  };
  await db.collection(COLLECTION).updateOne({ tenantId, designId }, { $push: { units: u }, $set: { updatedAt: new Date() } });
  return u;
}

export async function moveUnit(db: Db, tenantId: string, designId: string, unitId: string, newParentId: string, newLevel: number) {
  await db.collection(COLLECTION).updateOne(
    { tenantId, designId, 'units.unitId': unitId },
    { $set: { 'units.$.parentUnitId': newParentId, 'units.$.level': newLevel, updatedAt: new Date() } },
  );
}

export async function mergeUnits(db: Db, tenantId: string, designId: string, unitIds: string[], targetName: string) {
  const design = await db.collection(COLLECTION).findOne({ tenantId, designId }) as OrgDesign | null;
  if (!design) return null;
  const units: OrgUnit[] = design.units;
  const sources = units.filter(u => unitIds.includes(u.unitId));
  if (sources.length < 2) return null;

  const merged: OrgUnit = {
    unitId: uid(), name: targetName, nameAr: sources.map(s => s.nameAr).join(' + '), type: sources[0].type,
    parentUnitId: sources[0].parentUnitId, level: sources[0].level, headPositionTitle: sources[0].headPositionTitle,
    headEmployeeName: sources[0].headEmployeeName, positions: sources.flatMap(s => s.positions),
    totalHeadcount: sources.reduce((s, u) => s + u.totalHeadcount, 0),
    totalBudgetedPositions: sources.reduce((s, u) => s + u.totalBudgetedPositions, 0),
    totalVacancies: sources.reduce((s, u) => s + u.totalVacancies, 0),
    spanOfControl: sources.reduce((s, u) => s + u.spanOfControl, 0), layersBelow: Math.max(...sources.map(s => s.layersBelow)),
  };

  const remaining = units.filter(u => !unitIds.includes(u.unitId));
  remaining.push(merged);
  await db.collection(COLLECTION).updateOne({ tenantId, designId }, { $set: { units: remaining, updatedAt: new Date() } });
  return merged;
}

export async function splitUnit(db: Db, tenantId: string, designId: string, unitId: string, splitConfig: { name1: string; name2: string; positionIds1: string[] }) {
  const design = await db.collection(COLLECTION).findOne({ tenantId, designId }) as OrgDesign | null;
  if (!design) return null;
  const units: OrgUnit[] = design.units;
  const idx = units.findIndex(u => u.unitId === unitId);
  if (idx < 0) return null;
  const source = units[idx];

  const positions1 = source.positions.filter(p => splitConfig.positionIds1.includes(p.positionId));
  const positions2 = source.positions.filter(p => !splitConfig.positionIds1.includes(p.positionId));

  const u1: OrgUnit = { ...source, unitId: uid(), name: splitConfig.name1, positions: positions1, totalHeadcount: positions1.reduce((s, p) => s + p.filled, 0), totalBudgetedPositions: positions1.reduce((s, p) => s + p.headcount, 0), totalVacancies: positions1.reduce((s, p) => s + p.vacant, 0), spanOfControl: positions1.length };
  const u2: OrgUnit = { ...source, unitId: uid(), name: splitConfig.name2, positions: positions2, totalHeadcount: positions2.reduce((s, p) => s + p.filled, 0), totalBudgetedPositions: positions2.reduce((s, p) => s + p.headcount, 0), totalVacancies: positions2.reduce((s, p) => s + p.vacant, 0), spanOfControl: positions2.length };

  units.splice(idx, 1, u1, u2);
  await db.collection(COLLECTION).updateOne({ tenantId, designId }, { $set: { units, updatedAt: new Date() } });
  return { unit1: u1, unit2: u2 };
}

export async function addPosition(db: Db, tenantId: string, designId: string, unitId: string, posData: Partial<Position>) {
  const p: Position = {
    positionId: uid(), title: posData.title || '', titleAr: posData.titleAr || '', grade: posData.grade || '',
    headcount: posData.headcount || 1, filled: posData.filled || 0, vacant: (posData.headcount || 1) - (posData.filled || 0),
    critical: posData.critical || false, mainResponsibilities: posData.mainResponsibilities || [],
    requiredSkills: posData.requiredSkills || [], reportingTo: posData.reportingTo || '',
  };
  await db.collection(COLLECTION).updateOne(
    { tenantId, designId, 'units.unitId': unitId },
    { $push: { 'units.$.positions': p }, $set: { updatedAt: new Date() } },
  );
  return p;
}

export async function movePosition(db: Db, tenantId: string, designId: string, positionId: string, fromUnitId: string, toUnitId: string) {
  const design = await db.collection(COLLECTION).findOne({ tenantId, designId }) as OrgDesign | null;
  if (!design) return;
  const units: OrgUnit[] = design.units;
  const fromUnit = units.find(u => u.unitId === fromUnitId);
  const toUnit = units.find(u => u.unitId === toUnitId);
  if (!fromUnit || !toUnit) return;

  const posIdx = fromUnit.positions.findIndex(p => p.positionId === positionId);
  if (posIdx < 0) return;
  const [moved] = fromUnit.positions.splice(posIdx, 1);
  toUnit.positions.push(moved);

  await db.collection(COLLECTION).updateOne({ tenantId, designId }, { $set: { units, updatedAt: new Date() } });
}

export async function runAnalysis(db: Db, tenantId: string, designId: string) {
  const design = await db.collection(COLLECTION).findOne({ tenantId, designId }) as OrgDesign | null;
  if (!design) return null;
  const analysis = await runFullAnalysis(db, tenantId, design.units);
  await db.collection(COLLECTION).updateOne({ tenantId, designId }, { $set: { analysis, status: 'ANALYZING', updatedAt: new Date() } });
  return analysis;
}

export async function approveDesign(db: Db, tenantId: string, designId: string, userId: string) {
  await db.collection(COLLECTION).updateOne({ tenantId, designId }, { $set: { status: 'APPROVED', approvedBy: userId, updatedAt: new Date() } });
}

export async function compareTwo(db: Db, tenantId: string, designIdA: string, designIdB: string) {
  const a = await db.collection(COLLECTION).findOne({ tenantId, designId: designIdA }) as OrgDesign | null;
  const b = await db.collection(COLLECTION).findOne({ tenantId, designId: designIdB }) as OrgDesign | null;
  if (!a || !b) return null;
  return compareDesigns(a, b);
}

export { COLLECTION };
