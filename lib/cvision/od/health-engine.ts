import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ═══════════════════════════════════════════════════════════════════
 *  Organization Health Assessment Engine
 *  Inspired by McKinsey OHI + المنشور model
 *
 *  9 Dimensions:
 *    1. Strategy      5. People
 *    2. Structure     6. Rewards
 *    3. Culture       7. Communication
 *    4. Processes     8. Innovation
 *                     9. Governance
 * ═══════════════════════════════════════════════════════════════════ */

const ASSESSMENTS = 'cvision_org_health_assessments';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface DimensionData {
  score: number;
  subMetrics: Record<string, number>;
  dataPoints: Record<string, unknown>;
  findings: string[];
  recommendations: string[];
}

export type DimensionKey =
  | 'strategy' | 'structure' | 'culture' | 'processes'
  | 'people' | 'rewards' | 'communication' | 'innovation' | 'governance';

export interface PriorityArea {
  dimension: string;
  dimensionAr: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  interventionType: 'OD' | 'L&D' | 'BOTH';
  suggestedActions: string[];
  timeframe: 'SHORT' | 'MEDIUM' | 'LONG';
  estimatedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type HealthLevel = 'CRITICAL' | 'WEAK' | 'DEVELOPING' | 'STRONG' | 'EXCELLENT';

export interface OrgHealthAssessment {
  _id?: unknown;
  tenantId: string;
  assessmentId: string;
  period: string;
  year: number;
  quarter: number;
  assessmentDate: Date;
  dimensions: Record<DimensionKey, DimensionData>;
  overallScore: number;
  healthLevel: HealthLevel;
  priorityAreas: PriorityArea[];
  previousScore?: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  dataSources: {
    surveyBased: boolean;
    dataDriven: boolean;
    interviewBased: boolean;
    surveyId?: string;
    responseCount?: number;
    responseRate?: number;
  };
  conductedBy: string;
  reviewedBy?: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'REVIEWED';
  createdAt: Date;
  updatedAt: Date;
}

/* ── Dimension Weights ─────────────────────────────────────────────── */

export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  strategy: 0.15,
  structure: 0.12,
  culture: 0.15,
  processes: 0.10,
  people: 0.13,
  rewards: 0.10,
  communication: 0.10,
  innovation: 0.08,
  governance: 0.07,
};

export const DIMENSION_LABELS: Record<DimensionKey, { en: string; ar: string }> = {
  strategy:      { en: 'Strategy & Direction',          ar: 'الاتجاه والاستراتيجية' },
  structure:     { en: 'Structure & Design',            ar: 'الهيكل والتصميم' },
  culture:       { en: 'Culture & Values',              ar: 'الثقافة والقيم' },
  processes:     { en: 'Processes & Operations',        ar: 'العمليات' },
  people:        { en: 'People & Capabilities',         ar: 'الناس والقدرات' },
  rewards:       { en: 'Rewards & Accountability',      ar: 'المكافآت والمساءلة' },
  communication: { en: 'Communication & Information',   ar: 'التواصل وتدفق المعلومات' },
  innovation:    { en: 'Innovation & Adaptability',     ar: 'الابتكار والتكيف' },
  governance:    { en: 'Compliance & Governance',       ar: 'الامتثال والحوكمة' },
};

/* ── Scoring ───────────────────────────────────────────────────────── */

export function calculateOverallScore(dimensions: Record<DimensionKey, DimensionData>): number {
  let total = 0;
  for (const [dim, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const d = dimensions[dim as DimensionKey];
    total += (d?.score || 0) * weight;
  }
  return Math.round(total * 100) / 100;
}

export function scoreToLevel(score: number): HealthLevel {
  if (score >= 4.3) return 'EXCELLENT';
  if (score >= 3.6) return 'STRONG';
  if (score >= 3.0) return 'DEVELOPING';
  if (score >= 2.0) return 'WEAK';
  return 'CRITICAL';
}

export function determineTrend(current: number, previous?: number): 'IMPROVING' | 'STABLE' | 'DECLINING' {
  if (previous == null) return 'STABLE';
  const diff = current - previous;
  if (diff > 0.15) return 'IMPROVING';
  if (diff < -0.15) return 'DECLINING';
  return 'STABLE';
}

export function calculateDimensionScore(subMetrics: Record<string, number>): number {
  const values = Object.values(subMetrics).filter(v => v > 0);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

/* ── Priority Areas ────────────────────────────────────────────────── */

const OD_DIMENSIONS: DimensionKey[] = ['strategy', 'structure', 'processes', 'governance'];
const LD_DIMENSIONS: DimensionKey[] = ['people'];

export function identifyPriorityAreas(dimensions: Record<DimensionKey, DimensionData>): PriorityArea[] {
  const priorities: PriorityArea[] = [];

  for (const [dimName, dim] of Object.entries(dimensions)) {
    const key = dimName as DimensionKey;
    if (dim.score < 3.5) {
      const targetScore = Math.min(dim.score + 1.0, 5.0);
      priorities.push({
        dimension: dimName,
        dimensionAr: DIMENSION_LABELS[key]?.ar || dimName,
        currentScore: dim.score,
        targetScore,
        gap: Math.round((targetScore - dim.score) * 100) / 100,
        interventionType: OD_DIMENSIONS.includes(key) ? 'OD' : LD_DIMENSIONS.includes(key) ? 'L&D' : 'BOTH',
        suggestedActions: dim.recommendations?.slice(0, 3) || [],
        timeframe: ['culture', 'strategy', 'structure'].includes(dimName) ? 'LONG' : dim.score < 2.0 ? 'SHORT' : 'MEDIUM',
        estimatedImpact: dim.score < 2.0 ? 'HIGH' : dim.score < 3.0 ? 'MEDIUM' : 'LOW',
      });
    }
  }

  return priorities.sort((a, b) => a.currentScore - b.currentScore);
}

/* ── Auto-Metrics (calculated from existing system data) ───────────── */

export async function calculateAutoMetrics(db: Db, tenantId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const employees = await db.collection('cvision_employees').find({ tenantId, status: 'ACTIVE' }).toArray();
  const totalActive = employees.length || 1;

  /* Structure */
  const departments = new Set(employees.map(e => e.department).filter(Boolean));
  const managers = employees.filter(e => e.isManager || e.role === 'MANAGER' || (e.position || '').toLowerCase().includes('manager'));
  const avgSpanOfControl = Math.round((totalActive / Math.max(managers.length, 1)) * 10) / 10;

  const vacant = await db.collection('cvision_jobs').countDocuments({ tenantId, status: 'Open' });

  /* Processes */
  const workflows = await db.collection('cvision_workflow_instances').find({
    tenantId, completedAt: { $gte: thirtyDaysAgo },
  }).toArray();
  const avgApprovalHrs = workflows.length > 0
    ? Math.round(workflows.reduce((s, w) => s + (w.totalDuration || 0), 0) / workflows.length)
    : 0;
  const slaBreachCount = workflows.filter(w => w.stepHistory?.some((s: Record<string, unknown>) => s.slaBreached)).length;
  const slaBreachRate = workflows.length > 0 ? Math.round((slaBreachCount / workflows.length) * 100) : 0;

  /* Culture */
  const resignations90d = await db.collection('cvision_employees').countDocuments({
    tenantId, status: 'RESIGNED', updatedAt: { $gte: ninetyDaysAgo },
  });
  const turnoverRate = Math.round((resignations90d / totalActive) * 100 * 10) / 10;
  const grievances = await db.collection('cvision_grievances').countDocuments({ tenantId, createdAt: { $gte: ninetyDaysAgo } }).catch(() => 0);
  const recognitions = await db.collection('cvision_recognitions').countDocuments({ tenantId, createdAt: { $gte: ninetyDaysAgo } }).catch(() => 0);

  /* People */
  const trainingEnrollments = await db.collection('cvision_training_enrollments').countDocuments({ tenantId }).catch(() => 0);
  const trainingHoursPerEmp = totalActive > 0 ? Math.round((trainingEnrollments * 8) / totalActive) : 0;

  /* Governance */
  const overdueCompliance = await db.collection('cvision_compliance_calendar').countDocuments({ tenantId, status: 'OVERDUE' }).catch(() => 0);
  const saudiCount = employees.filter(e => e.nationality === 'Saudi').length;
  const saudizationRate = Math.round((saudiCount / totalActive) * 100);

  return {
    structure: {
      avgSpanOfControl,
      departmentsCount: departments.size,
      vacantPositions: vacant,
      totalEmployees: totalActive,
      managersCount: managers.length,
    },
    processes: {
      avgApprovalTime: avgApprovalHrs,
      slaBreachRate,
      workflowsCompleted30d: workflows.length,
    },
    culture: {
      voluntaryTurnoverRate: turnoverRate,
      grievancesCount90d: grievances,
      recognitionsGiven90d: recognitions,
    },
    people: {
      trainingHoursPerEmployee: trainingHoursPerEmp,
      totalTrainingEnrollments: trainingEnrollments,
    },
    governance: {
      saudizationRate,
      overdueLegalDeadlines: overdueCompliance,
    },
  };
}

/* ── Survey Template ───────────────────────────────────────────────── */

export const ORG_HEALTH_SURVEY = {
  title: 'Organization Health Assessment',
  titleAr: 'تقييم صحة المنظمة',
  anonymous: true,
  scaleMin: 1,
  scaleMax: 5,
  scaleLabels: { 1: 'Strongly Disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly Agree' },
  scaleLabelsAr: { 1: 'لا أوافق بشدة', 2: 'لا أوافق', 3: 'محايد', 4: 'أوافق', 5: 'أوافق بشدة' },

  sections: [
    {
      name: 'Strategy & Direction', nameAr: 'الاتجاه والاستراتيجية',
      questions: [
        { text: "I clearly understand our organization's strategy and direction", textAr: 'أفهم بوضوح استراتيجية واتجاه منظمتنا', dimension: 'strategy' as const, subMetric: 'strategicClarity' },
        { text: "My department's goals are well-aligned with the overall strategy", textAr: 'أهداف إدارتي متوائمة مع الاستراتيجية العامة', dimension: 'strategy' as const, subMetric: 'goalsAlignment' },
        { text: 'Our strategy translates into real execution', textAr: 'الاستراتيجية تتحول لتنفيذ فعلي', dimension: 'strategy' as const, subMetric: 'strategyExecution' },
        { text: 'Our organization responds quickly to market changes', textAr: 'منظمتنا تستجيب بسرعة لتغيرات السوق', dimension: 'strategy' as const, subMetric: 'marketResponsiveness' },
      ],
    },
    {
      name: 'Structure & Roles', nameAr: 'الهيكل والأدوار',
      questions: [
        { text: 'My role and responsibilities are clearly defined', textAr: 'دوري ومسؤولياتي محددة بوضوح', dimension: 'structure' as const, subMetric: 'roleClarity' },
        { text: 'Decisions are made quickly in my area', textAr: 'القرارات تُتخذ بسرعة في مجال عملي', dimension: 'structure' as const, subMetric: 'decisionSpeed' },
        { text: 'There is minimal overlap between departments', textAr: 'لا يوجد تداخل كبير بين الأقسام', dimension: 'structure' as const, subMetric: 'authorityOverlap' },
        { text: 'Reporting lines are clear and logical', textAr: 'خطوط الرفع واضحة ومنطقية', dimension: 'structure' as const, subMetric: 'reportingClarity' },
      ],
    },
    {
      name: 'Culture & Values', nameAr: 'الثقافة والقيم',
      questions: [
        { text: 'Our stated values are reflected in daily behavior', textAr: 'قيمنا المعلنة تنعكس على السلوك اليومي', dimension: 'culture' as const, subMetric: 'valuesLived' },
        { text: 'I feel safe to express my opinions without fear', textAr: 'أشعر بالأمان للتعبير عن رأيي بدون خوف', dimension: 'culture' as const, subMetric: 'psychologicalSafety' },
        { text: 'Teams collaborate effectively across departments', textAr: 'الفرق تتعاون بفعالية عبر الأقسام', dimension: 'culture' as const, subMetric: 'collaborationLevel' },
        { text: 'Innovation and new ideas are encouraged', textAr: 'الابتكار والأفكار الجديدة مشجعة', dimension: 'culture' as const, subMetric: 'innovationClimate' },
        { text: 'I trust the leadership team', textAr: 'أثق بفريق القيادة', dimension: 'culture' as const, subMetric: 'trustInLeadership' },
        { text: 'I feel a sense of belonging', textAr: 'أحس بالانتماء للمنظمة', dimension: 'culture' as const, subMetric: 'inclusionSense' },
      ],
    },
    {
      name: 'Processes', nameAr: 'العمليات',
      questions: [
        { text: 'Our internal processes are efficient', textAr: 'عملياتنا الداخلية فعالة', dimension: 'processes' as const, subMetric: 'processEfficiency' },
        { text: 'Approval processes are not overly slow', textAr: 'إجراءات الموافقات ليست بطيئة جداً', dimension: 'processes' as const, subMetric: 'bureaucracyLevel' },
        { text: 'Many of our processes are automated', textAr: 'كثير من عملياتنا مؤتمتة', dimension: 'processes' as const, subMetric: 'automationLevel' },
        { text: 'Procedures are standardized', textAr: 'الإجراءات موحدة', dimension: 'processes' as const, subMetric: 'standardization' },
      ],
    },
    {
      name: 'People & Capabilities', nameAr: 'الناس والقدرات',
      questions: [
        { text: 'We have the right skills for our goals', textAr: 'لدينا المهارات المناسبة لتحقيق أهدافنا', dimension: 'people' as const, subMetric: 'skillsAdequacy' },
        { text: 'There is a strong leadership pipeline', textAr: 'يوجد خط قيادات مستقبلية قوي', dimension: 'people' as const, subMetric: 'leadershipPipeline' },
        { text: 'Top talent stays with the organization', textAr: 'المواهب المتميزة تبقى في المنظمة', dimension: 'people' as const, subMetric: 'talentRetention' },
        { text: 'I am engaged with my work', textAr: 'أنا مرتبط بعملي', dimension: 'people' as const, subMetric: 'workforceEngagement' },
        { text: 'There are good development opportunities', textAr: 'توجد فرص تطوير جيدة', dimension: 'people' as const, subMetric: 'developmentOpportunities' },
      ],
    },
    {
      name: 'Rewards & Accountability', nameAr: 'المكافآت والمساءلة',
      questions: [
        { text: 'Pay is fair and equitable', textAr: 'الرواتب عادلة ومنصفة', dimension: 'rewards' as const, subMetric: 'payEquity' },
        { text: 'Rewards are linked to performance', textAr: 'المكافآت مرتبطة بالأداء', dimension: 'rewards' as const, subMetric: 'performanceRewardLink' },
        { text: 'Accountability is clear', textAr: 'المساءلة واضحة', dimension: 'rewards' as const, subMetric: 'accountabilityClarity' },
        { text: 'Good work is recognized', textAr: 'العمل الجيد يُقدّر', dimension: 'rewards' as const, subMetric: 'recognitionFrequency' },
      ],
    },
    {
      name: 'Communication', nameAr: 'التواصل',
      questions: [
        { text: 'Information flows transparently', textAr: 'المعلومات تتدفق بشفافية', dimension: 'communication' as const, subMetric: 'transparencyLevel' },
        { text: 'Cross-department communication is effective', textAr: 'التواصل بين الأقسام فعال', dimension: 'communication' as const, subMetric: 'crossDepartmentComm' },
        { text: 'Leadership communicates clearly', textAr: 'القيادة تتواصل بوضوح', dimension: 'communication' as const, subMetric: 'topDownClarity' },
        { text: 'Leadership listens to employee feedback', textAr: 'القيادة تسمع ملاحظات الموظفين', dimension: 'communication' as const, subMetric: 'bottomUpListening' },
      ],
    },
    {
      name: 'Innovation & Adaptability', nameAr: 'الابتكار والتكيف',
      questions: [
        { text: 'The organization is ready for change', textAr: 'المنظمة جاهزة للتغيير', dimension: 'innovation' as const, subMetric: 'changeReadiness' },
        { text: 'Experimentation is supported', textAr: 'التجريب مدعوم', dimension: 'innovation' as const, subMetric: 'experimentationSupport' },
        { text: 'We learn from failures', textAr: 'نتعلم من الأخطاء', dimension: 'innovation' as const, subMetric: 'learningFromFailure' },
        { text: 'Our digital maturity is high', textAr: 'مستوى النضج الرقمي عالي', dimension: 'innovation' as const, subMetric: 'digitalMaturity' },
      ],
    },
    {
      name: 'Compliance & Governance', nameAr: 'الامتثال والحوكمة',
      questions: [
        { text: 'We comply with all regulations', textAr: 'نلتزم بجميع الأنظمة', dimension: 'governance' as const, subMetric: 'regulatoryCompliance' },
        { text: 'Internal policies are followed', textAr: 'السياسات الداخلية مُتّبعة', dimension: 'governance' as const, subMetric: 'policyAdherence' },
        { text: 'Risks are well managed', textAr: 'المخاطر تُدار بشكل جيد', dimension: 'governance' as const, subMetric: 'riskManagement' },
        { text: 'We are always audit-ready', textAr: 'نحن جاهزون للتدقيق دائماً', dimension: 'governance' as const, subMetric: 'auditReadiness' },
      ],
    },
  ],
};

/* ── Seed Data ─────────────────────────────────────────────────────── */

function makeDim(score: number, subs: Record<string, number>, dataPoints: Record<string, unknown>, findings: string[], recs: string[]): DimensionData {
  return { score, subMetrics: subs, dataPoints, findings, recommendations: recs };
}

const SEED_ASSESSMENT: Omit<OrgHealthAssessment, '_id' | 'tenantId'> = {
  assessmentId: 'OHA-2026-Q1',
  period: '2026-Q1', year: 2026, quarter: 1,
  assessmentDate: new Date('2026-01-15'),
  dimensions: {
    strategy: makeDim(4.1, { strategicClarity: 4.2, goalsAlignment: 4.0, strategyExecution: 3.9, marketResponsiveness: 4.3 }, { okrCompletionRate: 72, strategicInitiativesOnTrack: 8 },
      ['Strategic direction is well communicated'], ['Improve quarterly cascading of goals to individual level']),
    structure: makeDim(3.0, { roleClarity: 3.2, decisionSpeed: 2.8, authorityOverlap: 2.5, spanOfControl: 3.5, reportingClarity: 3.0 }, { avgSpanOfControl: 8.2, layersToTop: 5, departmentsCount: 8, vacantPositions: 12, duplicateRoles: 3 },
      ['Authority overlap between 3 departments', 'Decision speed below target'], ['Review reporting structure', 'Clarify delegation matrix', 'Reduce approval layers']),
    culture: makeDim(3.5, { valuesLived: 3.4, psychologicalSafety: 3.3, collaborationLevel: 3.6, innovationClimate: 3.2, trustInLeadership: 3.8, inclusionSense: 3.7 }, { eNPS: 35, voluntaryTurnoverRate: 8.5, averageTenure: 3.2, grievancesCount: 4, recognitionsGiven: 45 },
      ['Psychological safety needs improvement in 2 departments'], ['Launch pulse survey program', 'Train managers on feedback culture']),
    processes: makeDim(2.5, { processEfficiency: 2.6, bureaucracyLevel: 2.0, automationLevel: 2.8, standardization: 2.7, customerExperience: 2.4 }, { avgApprovalTime: 72, avgLeaveApprovalTime: 36, slaBreachRate: 25, processAutomationRate: 40 },
      ['Average approval time is 72h (target: 24h)', 'SLA breach rate at 25%'], ['Redesign approval workflows', 'Automate routine approvals', 'Implement parallel approvals']),
    people: makeDim(3.8, { skillsAdequacy: 3.7, leadershipPipeline: 3.5, talentRetention: 3.9, workforceEngagement: 4.0, developmentOpportunities: 3.9 }, { skillGapPercentage: 15, successionCoverage: 60, trainingHoursPerEmployee: 32, flightRiskPercentage: 8, performanceDistribution: { high: 25, mid: 60, low: 15 } },
      ['Leadership pipeline coverage at 60%'], ['Accelerate high-potential program', 'Increase training budget']),
    rewards: makeDim(3.1, { payEquity: 3.0, performanceRewardLink: 2.9, accountabilityClarity: 3.3, consequenceManagement: 3.0, recognitionFrequency: 3.3 }, { compaRatioAvg: 0.95, performanceReviewCompletion: 78, disciplinaryActionsCount: 3 },
      ['Pay-performance link perceived as weak'], ['Implement variable pay component', 'Increase recognition program visibility']),
    communication: makeDim(3.4, { transparencyLevel: 3.5, crossDepartmentComm: 3.0, topDownClarity: 3.6, bottomUpListening: 3.2, meetingEffectiveness: 3.7 }, { announcementReadRate: 65, surveyResponseRate: 55, suggestionBoxSubmissions: 12, grievanceResolutionTime: 14 },
      ['Cross-department communication gaps'], ['Implement monthly town halls', 'Launch internal communication platform']),
    innovation: makeDim(2.8, { changeReadiness: 3.0, experimentationSupport: 2.5, learningFromFailure: 2.7, digitalMaturity: 3.2, continuousImprovement: 2.6 }, { suggestionsImplemented: 5, processImprovements: 3, newInitiativesLaunched: 2, systemAdoptionRate: 70 },
      ['Low experimentation culture', 'Few improvement suggestions acted on'], ['Innovation incentive program', 'Design thinking workshops', 'Dedicated innovation time']),
    governance: makeDim(4.3, { regulatoryCompliance: 4.5, policyAdherence: 4.2, riskManagement: 4.0, auditReadiness: 4.3, saudizationHealth: 4.5 }, { nitaqatScore: 'GREEN_HIGH', gosiCompliance: true, cchiCompliance: true, policyAcknowledgmentRate: 92, overdueLegalDeadlines: 0 },
      ['Governance is a strength area'], ['Maintain current standards', 'Automate compliance monitoring']),
  },
  overallScore: 0, healthLevel: 'DEVELOPING', priorityAreas: [], previousScore: 3.1, trend: 'IMPROVING',
  dataSources: { surveyBased: true, dataDriven: true, interviewBased: false, responseCount: 42, responseRate: 84 },
  conductedBy: 'HR Team', status: 'COMPLETED',
  createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-01-20'),
};

export async function ensureSeedData(db: Db, tenantId: string) {
  const existing = await db.collection(ASSESSMENTS).findOne({ tenantId });
  if (existing) return;

  const assessment = { ...SEED_ASSESSMENT, tenantId };
  assessment.overallScore = calculateOverallScore(assessment.dimensions);
  assessment.healthLevel = scoreToLevel(assessment.overallScore);
  assessment.trend = determineTrend(assessment.overallScore, assessment.previousScore);
  assessment.priorityAreas = identifyPriorityAreas(assessment.dimensions);

  await db.collection(ASSESSMENTS).insertOne(assessment);
}

/* ── CRUD ───────────────────────────────────────────────────────────── */

export async function getLatest(db: Db, tenantId: string): Promise<OrgHealthAssessment | null> {
  return db.collection(ASSESSMENTS).findOne({ tenantId, status: { $in: ['COMPLETED', 'REVIEWED'] } }, { sort: { assessmentDate: -1 } }) as Promise<OrgHealthAssessment | null>;
}

export async function getHistory(db: Db, tenantId: string, limit = 12) {
  return db.collection(ASSESSMENTS).find({ tenantId }).sort({ assessmentDate: -1 }).limit(limit).toArray();
}

export async function getDetail(db: Db, tenantId: string, assessmentId: string) {
  return db.collection(ASSESSMENTS).findOne({ tenantId, assessmentId });
}

export async function startAssessment(db: Db, tenantId: string, userId: string, period: string) {
  const [yearStr, qStr] = period.split('-Q');
  const year = parseInt(yearStr);
  const quarter = parseInt(qStr);
  const assessmentId = `OHA-${year}-Q${quarter}`;

  const emptyDim = (): DimensionData => ({ score: 0, subMetrics: {}, dataPoints: {}, findings: [], recommendations: [] });

  const doc: Omit<OrgHealthAssessment, '_id'> = {
    tenantId, assessmentId, period, year, quarter,
    assessmentDate: new Date(),
    dimensions: {
      strategy: emptyDim(), structure: emptyDim(), culture: emptyDim(), processes: emptyDim(),
      people: emptyDim(), rewards: emptyDim(), communication: emptyDim(), innovation: emptyDim(), governance: emptyDim(),
    },
    overallScore: 0, healthLevel: 'CRITICAL', priorityAreas: [], trend: 'STABLE',
    dataSources: { surveyBased: false, dataDriven: true, interviewBased: false },
    conductedBy: userId, status: 'DRAFT',
    createdAt: new Date(), updatedAt: new Date(),
  };

  // Pre-fill auto-metrics
  const autoMetrics = await calculateAutoMetrics(db, tenantId);
  doc.dimensions.structure.dataPoints = autoMetrics.structure;
  doc.dimensions.processes.dataPoints = autoMetrics.processes;
  doc.dimensions.culture.dataPoints = autoMetrics.culture;
  doc.dimensions.people.dataPoints = autoMetrics.people;
  doc.dimensions.governance.dataPoints = autoMetrics.governance;
  doc.dataSources.dataDriven = true;

  await db.collection(ASSESSMENTS).insertOne(doc);
  return doc;
}

export async function saveDraft(db: Db, tenantId: string, assessmentId: string, dimensions: Record<DimensionKey, DimensionData>) {
  // Recalculate dimension scores from subMetrics
  for (const key of Object.keys(dimensions) as DimensionKey[]) {
    const dim = dimensions[key];
    if (dim.subMetrics && Object.keys(dim.subMetrics).length > 0) {
      dim.score = calculateDimensionScore(dim.subMetrics);
    }
  }

  const overallScore = calculateOverallScore(dimensions);
  const healthLevel = scoreToLevel(overallScore);
  const prev = await db.collection(ASSESSMENTS).findOne({ tenantId, status: { $in: ['COMPLETED', 'REVIEWED'] }, assessmentId: { $ne: assessmentId } }, { sort: { assessmentDate: -1 } });
  const prevScore = (prev as Record<string, unknown> | null)?.overallScore as number | undefined;
  const trend = determineTrend(overallScore, prevScore);
  const priorityAreas = identifyPriorityAreas(dimensions);

  await db.collection(ASSESSMENTS).updateOne(
    { tenantId, assessmentId },
    { $set: { dimensions, overallScore, healthLevel, trend, priorityAreas, previousScore: prevScore, updatedAt: new Date() } },
  );

  return { overallScore, healthLevel, trend, priorityAreas };
}

export async function completeAssessment(db: Db, tenantId: string, assessmentId: string) {
  await db.collection(ASSESSMENTS).updateOne(
    { tenantId, assessmentId },
    { $set: { status: 'COMPLETED', updatedAt: new Date() } },
  );
}

export async function addFindings(db: Db, tenantId: string, assessmentId: string, dimension: DimensionKey, findings: string[], recommendations: string[]) {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (findings?.length) update[`dimensions.${dimension}.findings`] = findings;
  if (recommendations?.length) update[`dimensions.${dimension}.recommendations`] = recommendations;

  await db.collection(ASSESSMENTS).updateOne({ tenantId, assessmentId }, { $set: update });
}

export async function comparePeriods(db: Db, tenantId: string, periodA: string, periodB: string) {
  const a = await db.collection(ASSESSMENTS).findOne({ tenantId, period: periodA }) as OrgHealthAssessment | null;
  const b = await db.collection(ASSESSMENTS).findOne({ tenantId, period: periodB }) as OrgHealthAssessment | null;
  if (!a || !b) return null;

  const comparison: Record<string, { a: number; b: number; delta: number }> = {};
  for (const dim of Object.keys(DIMENSION_WEIGHTS) as DimensionKey[]) {
    comparison[dim] = {
      a: a.dimensions[dim]?.score || 0,
      b: b.dimensions[dim]?.score || 0,
      delta: Math.round(((b.dimensions[dim]?.score || 0) - (a.dimensions[dim]?.score || 0)) * 100) / 100,
    };
  }

  return {
    periodA: { period: periodA, overall: a.overallScore, level: a.healthLevel },
    periodB: { period: periodB, overall: b.overallScore, level: b.healthLevel },
    overallDelta: Math.round((b.overallScore - a.overallScore) * 100) / 100,
    dimensions: comparison,
  };
}

export { ASSESSMENTS };
