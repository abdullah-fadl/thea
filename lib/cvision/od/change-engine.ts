import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { ObjectId } from '@/lib/cvision/infra/mongo-compat';

/* ═══════════════════════════════════════════════════════════════════
 *  Change Management Engine — إدارة التغيير
 *
 *  Based on ADKAR + Kotter models.
 *  Manages change initiatives, stakeholder analysis, risk assessment,
 *  communication plans, adoption tracking, and resistance logging.
 * ═══════════════════════════════════════════════════════════════════ */

const COLLECTION = 'cvision_change_initiatives';

/* ── Types ─────────────────────────────────────────────────────────── */

export type ChangeType =
  | 'DIGITAL_TRANSFORMATION' | 'RESTRUCTURING' | 'MERGER_ACQUISITION'
  | 'NEW_SYSTEM' | 'PROCESS_CHANGE' | 'POLICY_CHANGE' | 'CULTURE_SHIFT'
  | 'RELOCATION' | 'DOWNSIZING' | 'EXPANSION' | 'LEADERSHIP_CHANGE';

export type ChangeScope = 'ORGANIZATION_WIDE' | 'DEPARTMENT' | 'TEAM' | 'PROCESS';

export type PhaseStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DELAYED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE';
export type Attitude = 'CHAMPION' | 'SUPPORTER' | 'NEUTRAL' | 'RESISTANT' | 'BLOCKER';
export type Level = 'HIGH' | 'MEDIUM' | 'LOW';
export type RiskStatus = 'IDENTIFIED' | 'MITIGATING' | 'RESOLVED' | 'ACCEPTED';
export type ResistanceType = 'VOCAL' | 'PASSIVE' | 'SABOTAGE' | 'ANXIETY' | 'CONFUSION';
export type RootCause = 'FEAR_OF_UNKNOWN' | 'LOSS_OF_CONTROL' | 'BAD_TIMING' | 'LACK_OF_TRUST' | 'PAST_FAILURE' | 'SKILL_GAP' | 'OVERLOAD';

export type OverallStatus =
  | 'PLANNING' | 'COMMUNICATING' | 'PREPARING' | 'IMPLEMENTING'
  | 'REINFORCING' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED';

export interface Phase {
  phaseId: string;
  name: string;
  nameAr: string;
  order: number;
  startDate: Date;
  endDate: Date;
  status: PhaseStatus;
  progress: number;
  milestones: { title: string; dueDate: Date; completed: boolean; completedDate?: Date }[];
  tasks: { taskId: string; title: string; assignedTo: string; dueDate: Date; status: TaskStatus }[];
}

export interface Stakeholder {
  groupId: string;
  name: string;
  size: number;
  impactLevel: Level | 'NONE';
  impactDescription: string;
  currentAwareness: number;
  currentDesire: number;
  currentKnowledge: number;
  currentAbility: number;
  currentReinforcement: number;
  attitude: Attitude;
  influenceLevel: Level;
  engagementStrategy: string;
  keyMessages: string[];
  assignedAgent: string;
}

export interface Risk {
  riskId: string;
  description: string;
  category: 'PEOPLE' | 'PROCESS' | 'TECHNOLOGY' | 'TIMELINE' | 'BUDGET' | 'COMMUNICATION';
  likelihood: Level;
  impact: Level;
  riskScore: number;
  mitigationPlan: string;
  owner: string;
  status: RiskStatus;
}

export interface CommunicationItem {
  messageId: string;
  audience: string;
  phase: string;
  messageType: 'ANNOUNCEMENT' | 'UPDATE' | 'TRAINING_INVITE' | 'FAQ' | 'SUCCESS_STORY' | 'FEEDBACK_REQUEST';
  channel: 'EMAIL' | 'MEETING' | 'TOWN_HALL' | 'INTRANET' | 'SMS' | 'ONE_ON_ONE' | 'VIDEO' | 'POSTER';
  sender: string;
  content: string;
  scheduledDate: Date;
  sent: boolean;
  sentDate?: Date;
}

export interface TrainingSession {
  sessionId: string;
  title: string;
  audience: string;
  type: 'AWARENESS' | 'SKILL_BUILDING' | 'HANDS_ON' | 'REFRESHER';
  deliveryMethod: 'CLASSROOM' | 'VIRTUAL' | 'E_LEARNING' | 'ON_THE_JOB' | 'COACHING';
  duration: string;
  scheduledDate: Date;
  trainer: string;
  maxAttendees: number;
  enrolledCount: number;
  completedCount: number;
}

export interface AdoptionMetric {
  metricId: string;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  measurementFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  trend: { date: Date; value: number }[];
}

export interface ResistanceEntry {
  logId: string;
  date: Date;
  source: string;
  type: ResistanceType;
  description: string;
  rootCause: RootCause;
  actionTaken: string;
  resolvedDate?: Date;
  status: 'OPEN' | 'ADDRESSED' | 'ESCALATED';
}

export interface ChangeInitiative {
  _id?: any;
  tenantId: string;
  changeId: string;
  title: string;
  titleEn?: string;
  description: string;
  type: ChangeType;
  scope: ChangeScope;
  affectedDepartments: string[];
  sponsor: { employeeId: string; name: string; title: string };
  changeManager: { employeeId: string; name: string };
  changeAgents: { employeeId: string; name: string; department: string; role: 'CHAMPION' | 'AGENT' | 'COORDINATOR' }[];
  phases: Phase[];
  stakeholders: Stakeholder[];
  risks: Risk[];
  communicationPlan: CommunicationItem[];
  trainingPlan: TrainingSession[];
  adoptionMetrics: AdoptionMetric[];
  resistanceLog: ResistanceEntry[];
  feedbackSurveys: { surveyId: string; phase: string; scheduledDate: Date; responseRate: number; sentimentScore: number; topConcerns: string[]; topPositives: string[] }[];
  overallProgress: number;
  overallStatus: OverallStatus;
  adoptionRate: number;
  budget: { allocated: number; spent: number; categories: { name: string; allocated: number; spent: number }[] };
  lessonsLearned?: { whatWorked: string[]; whatDidnt: string[]; recommendations: string[]; completedDate: Date };
  createdAt: Date;
  updatedAt: Date;
}

/* ── ADKAR Calculator ──────────────────────────────────────────────── */

const ADKAR_BOTTLENECK_MAP: Record<string, { name: string; nameAr: string; fix: string; fixAr: string }> = {
  A:  { name: 'Awareness',      nameAr: 'الوعي',       fix: 'More communication about WHY change is needed',       fixAr: 'مزيد من التواصل حول لماذا التغيير ضروري' },
  D:  { name: 'Desire',         nameAr: 'الرغبة',      fix: 'Address resistance, show WIIFM, involve in decisions', fixAr: 'معالجة المقاومة وإشراكهم في القرارات' },
  K:  { name: 'Knowledge',      nameAr: 'المعرفة',     fix: 'Training on HOW to change',                           fixAr: 'تدريب على كيفية التغيير' },
  Ab: { name: 'Ability',        nameAr: 'القدرة',      fix: 'Practice, coaching, remove barriers',                 fixAr: 'ممارسة وتدريب عملي وإزالة العوائق' },
  R:  { name: 'Reinforcement',  nameAr: 'التعزيز',     fix: 'Recognition, celebrate wins, hold accountable',       fixAr: 'تقدير النجاحات وتعزيز الاستدامة' },
};

export function calculateADKAR(stakeholder: Stakeholder) {
  const adkar: Record<string, number> = {
    A: stakeholder.currentAwareness,
    D: stakeholder.currentDesire,
    K: stakeholder.currentKnowledge,
    Ab: stakeholder.currentAbility,
    R: stakeholder.currentReinforcement,
  };

  let bottleneck = 'None';
  let bottleneckAr = 'لا يوجد';
  let recommendation = 'On track';
  let recommendationAr = 'على المسار الصحيح';

  for (const [key, value] of Object.entries(adkar)) {
    if (value < 3) {
      const info = ADKAR_BOTTLENECK_MAP[key];
      bottleneck = info.name;
      bottleneckAr = info.nameAr;
      recommendation = info.fix;
      recommendationAr = info.fixAr;
      break;
    }
  }

  const avgScore = Math.round(((adkar.A + adkar.D + adkar.K + adkar.Ab + adkar.R) / 5) * 100) / 100;
  return { adkar, avgScore, bottleneck, bottleneckAr, recommendation, recommendationAr };
}

/* ── Stakeholder Mapping (Power / Interest Grid) ───────────────────── */

export function mapStakeholders(stakeholders: Stakeholder[]) {
  return {
    manageClosely: stakeholders.filter(s => s.influenceLevel === 'HIGH' && (s.impactLevel === 'HIGH')),
    keepSatisfied: stakeholders.filter(s => s.influenceLevel === 'HIGH' && s.impactLevel !== 'HIGH'),
    keepInformed: stakeholders.filter(s => s.influenceLevel !== 'HIGH' && (s.impactLevel === 'HIGH')),
    monitor: stakeholders.filter(s => s.influenceLevel !== 'HIGH' && s.impactLevel !== 'HIGH'),
  };
}

/* ── Risk Scoring ──────────────────────────────────────────────────── */

const LEVEL_NUM: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function computeRiskScore(likelihood: Level, impact: Level): number {
  return LEVEL_NUM[likelihood] * LEVEL_NUM[impact];
}

export function buildRiskMatrix(risks: Risk[]) {
  const matrix: Record<string, Risk[]> = { '9': [], '6': [], '4': [], '3': [], '2': [], '1': [] };
  for (const r of risks) {
    const score = computeRiskScore(r.likelihood, r.impact);
    const key = String(score);
    if (!matrix[key]) matrix[key] = [];
    matrix[key].push(r);
  }
  return matrix;
}

/* ── Progress Calculation ──────────────────────────────────────────── */

export function calculateOverallProgress(phases: Phase[]): number {
  if (phases.length === 0) return 0;
  const total = phases.reduce((s, p) => s + p.progress, 0);
  return Math.round(total / phases.length);
}

export function calculateAdoptionRate(metrics: AdoptionMetric[]): number {
  if (metrics.length === 0) return 0;
  const vals = metrics.map(m => m.targetValue > 0 ? (m.currentValue / m.targetValue) * 100 : 0);
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

/* ── Default Phases (ADKAR / Kotter inspired) ──────────────────────── */

function defaultPhases(startDate: Date): Phase[] {
  const d = (offset: number) => new Date(startDate.getTime() + offset * 24 * 60 * 60 * 1000);
  const uid = () => new ObjectId().toHexString().slice(-8);
  return [
    { phaseId: uid(), name: 'Assessment & Planning', nameAr: 'تقييم وتخطيط', order: 1, startDate: d(0), endDate: d(30), status: 'NOT_STARTED', progress: 0, milestones: [{ title: 'Stakeholder analysis complete', dueDate: d(14), completed: false }, { title: 'Risk assessment complete', dueDate: d(21), completed: false }], tasks: [] },
    { phaseId: uid(), name: 'Awareness & Communication', nameAr: 'توعية وتواصل', order: 2, startDate: d(15), endDate: d(60), status: 'NOT_STARTED', progress: 0, milestones: [{ title: 'All stakeholders notified', dueDate: d(30), completed: false }], tasks: [] },
    { phaseId: uid(), name: 'Preparation & Training', nameAr: 'تجهيز وتدريب', order: 3, startDate: d(45), endDate: d(90), status: 'NOT_STARTED', progress: 0, milestones: [{ title: 'Training plan delivered', dueDate: d(75), completed: false }], tasks: [] },
    { phaseId: uid(), name: 'Implementation', nameAr: 'تطبيق', order: 4, startDate: d(75), endDate: d(150), status: 'NOT_STARTED', progress: 0, milestones: [{ title: 'Go-live', dueDate: d(90), completed: false }, { title: '80% adoption target', dueDate: d(135), completed: false }], tasks: [] },
    { phaseId: uid(), name: 'Reinforcement & Sustainability', nameAr: 'تعزيز واستدامة', order: 5, startDate: d(135), endDate: d(210), status: 'NOT_STARTED', progress: 0, milestones: [{ title: '90% sustained adoption', dueDate: d(180), completed: false }], tasks: [] },
  ];
}

/* ── Change Readiness Survey Template ──────────────────────────────── */

export const CHANGE_READINESS_SURVEY = {
  title: 'Change Readiness Assessment',
  titleAr: 'تقييم الجاهزية للتغيير',
  scaleMin: 1,
  scaleMax: 5,
  questions: [
    { text: 'I understand why this change is necessary', textAr: 'أفهم لماذا هذا التغيير ضروري', dimension: 'awareness' },
    { text: 'I know what will change in my daily work', textAr: 'أعرف ماذا سيتغير في عملي اليومي', dimension: 'awareness' },
    { text: 'I support this change and see its benefit', textAr: 'أؤيد هذا التغيير وأرى فائدته', dimension: 'desire' },
    { text: 'I am ready to participate actively', textAr: 'أنا مستعد للمشاركة بفعالية', dimension: 'desire' },
    { text: 'I know what is expected of me during and after the change', textAr: 'أعرف ما المطلوب مني خلال وبعد التغيير', dimension: 'knowledge' },
    { text: 'I have received adequate training', textAr: 'تلقيت تدريباً كافياً', dimension: 'knowledge' },
    { text: 'I can apply what is required in my work now', textAr: 'أستطيع تطبيق المطلوب في عملي الآن', dimension: 'ability' },
    { text: 'The tools and resources are available to me', textAr: 'الأدوات والموارد متاحة لي', dimension: 'ability' },
    { text: 'I see that leadership is committed to the change', textAr: 'أرى أن القيادة ملتزمة بالتغيير', dimension: 'reinforcement' },
    { text: 'Those who adopt the change are recognized and rewarded', textAr: 'يتم تقدير ومكافأة من يتبنون التغيير', dimension: 'reinforcement' },
  ],
  openQuestions: [
    { text: 'What is your biggest concern about this change?', textAr: 'ما هي أكبر مخاوفك من هذا التغيير؟' },
    { text: 'What would help you most to adapt?', textAr: 'ما الذي يساعدك أكثر للتكيف مع التغيير؟' },
  ],
};

/* ── Seed Data ─────────────────────────────────────────────────────── */

function buildSeedInitiative(tenantId: string): ChangeInitiative {
  const now = new Date();
  const d = (offset: number) => new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
  const uid = () => new ObjectId().toHexString().slice(-8);

  const phases = defaultPhases(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
  phases[0].status = 'COMPLETED'; phases[0].progress = 100;
  phases[0].milestones.forEach(m => { m.completed = true; m.completedDate = d(-70); });
  phases[1].status = 'COMPLETED'; phases[1].progress = 100;
  phases[1].milestones.forEach(m => { m.completed = true; m.completedDate = d(-45); });
  phases[2].status = 'COMPLETED'; phases[2].progress = 100;
  phases[2].milestones.forEach(m => { m.completed = true; m.completedDate = d(-20); });
  phases[3].status = 'IN_PROGRESS'; phases[3].progress = 65;
  phases[3].milestones[0].completed = true; phases[3].milestones[0].completedDate = d(-5);
  phases[4].status = 'NOT_STARTED'; phases[4].progress = 0;

  return {
    tenantId,
    changeId: 'CHG-2026-001',
    title: 'التحول لنظام ERP جديد',
    titleEn: 'ERP System Transformation',
    description: 'Transition from legacy systems to a unified ERP platform across all departments.',
    type: 'DIGITAL_TRANSFORMATION',
    scope: 'ORGANIZATION_WIDE',
    affectedDepartments: ['Finance', 'HR', 'Operations', 'Procurement', 'IT'],
    sponsor: { employeeId: 'EMP-001', name: 'Abdullah Al-Rashid', title: 'CEO' },
    changeManager: { employeeId: 'EMP-015', name: 'Noura Al-Ghamdi' },
    changeAgents: [
      { employeeId: 'EMP-022', name: 'Fahad Al-Mutairi', department: 'Finance', role: 'CHAMPION' },
      { employeeId: 'EMP-034', name: 'Sara Al-Zahrani', department: 'HR', role: 'AGENT' },
      { employeeId: 'EMP-041', name: 'Khalid Al-Otaibi', department: 'Operations', role: 'AGENT' },
      { employeeId: 'EMP-055', name: 'Mona Al-Harbi', department: 'Procurement', role: 'COORDINATOR' },
    ],
    phases,
    stakeholders: [
      {
        groupId: uid(), name: 'Senior Leadership', size: 8,
        impactLevel: 'HIGH', impactDescription: 'Decision-making dashboards will change entirely',
        currentAwareness: 5, currentDesire: 4, currentKnowledge: 4, currentAbility: 3, currentReinforcement: 4,
        attitude: 'CHAMPION', influenceLevel: 'HIGH',
        engagementStrategy: 'Monthly steering committee meetings',
        keyMessages: ['ROI projections', 'Competitive advantage', 'Timeline assurance'],
        assignedAgent: 'EMP-015',
      },
      {
        groupId: uid(), name: 'Finance Team', size: 22,
        impactLevel: 'HIGH', impactDescription: 'نظام عملهم اليومي سيتغير بالكامل',
        currentAwareness: 4, currentDesire: 2, currentKnowledge: 3, currentAbility: 2, currentReinforcement: 2,
        attitude: 'RESISTANT', influenceLevel: 'MEDIUM',
        engagementStrategy: 'Weekly hands-on sessions + dedicated super-users',
        keyMessages: ['Simplified month-end close', 'Fewer manual entries', 'Real-time reporting'],
        assignedAgent: 'EMP-022',
      },
      {
        groupId: uid(), name: 'HR Team', size: 15,
        impactLevel: 'HIGH', impactDescription: 'Payroll, attendance, and employee records migration',
        currentAwareness: 4, currentDesire: 4, currentKnowledge: 3, currentAbility: 3, currentReinforcement: 3,
        attitude: 'SUPPORTER', influenceLevel: 'MEDIUM',
        engagementStrategy: 'Bi-weekly training + sandbox environment access',
        keyMessages: ['Employee self-service portal', 'Automated workflows', 'Data accuracy'],
        assignedAgent: 'EMP-034',
      },
      {
        groupId: uid(), name: 'Operations Team', size: 45,
        impactLevel: 'MEDIUM', impactDescription: 'Procurement and inventory modules changing',
        currentAwareness: 3, currentDesire: 3, currentKnowledge: 2, currentAbility: 2, currentReinforcement: 2,
        attitude: 'NEUTRAL', influenceLevel: 'LOW',
        engagementStrategy: 'Department briefings + e-learning modules',
        keyMessages: ['Simpler ordering process', 'Inventory visibility', 'Mobile access'],
        assignedAgent: 'EMP-041',
      },
      {
        groupId: uid(), name: 'Branch Managers', size: 12,
        impactLevel: 'MEDIUM', impactDescription: 'Reporting and approvals will go through new system',
        currentAwareness: 3, currentDesire: 3, currentKnowledge: 2, currentAbility: 2, currentReinforcement: 2,
        attitude: 'NEUTRAL', influenceLevel: 'HIGH',
        engagementStrategy: 'One-on-one sessions + regional roadshows',
        keyMessages: ['Branch performance dashboard', 'Faster approvals', 'Unified view'],
        assignedAgent: 'EMP-015',
      },
    ],
    risks: [
      { riskId: uid(), description: 'Employee resistance especially in Finance', category: 'PEOPLE', likelihood: 'HIGH', impact: 'HIGH', riskScore: 9, mitigationPlan: 'Dedicated change agents + peer support groups', owner: 'EMP-022', status: 'MITIGATING' },
      { riskId: uid(), description: 'Timeline slip due to data migration complexity', category: 'TIMELINE', likelihood: 'MEDIUM', impact: 'HIGH', riskScore: 6, mitigationPlan: 'Phased migration with parallel-run period', owner: 'EMP-015', status: 'MITIGATING' },
      { riskId: uid(), description: 'Budget overrun from additional training needs', category: 'BUDGET', likelihood: 'LOW', impact: 'MEDIUM', riskScore: 2, mitigationPlan: 'Pre-negotiated training package with vendor', owner: 'EMP-015', status: 'IDENTIFIED' },
      { riskId: uid(), description: 'Data quality issues during migration', category: 'TECHNOLOGY', likelihood: 'MEDIUM', impact: 'MEDIUM', riskScore: 4, mitigationPlan: 'Data cleansing sprint + validation checkpoints', owner: 'EMP-041', status: 'MITIGATING' },
      { riskId: uid(), description: 'Key person dependency on IT team', category: 'PEOPLE', likelihood: 'MEDIUM', impact: 'MEDIUM', riskScore: 4, mitigationPlan: 'Cross-training + documentation', owner: 'EMP-034', status: 'IDENTIFIED' },
    ],
    communicationPlan: [
      { messageId: uid(), audience: 'All Employees', phase: 'Awareness', messageType: 'ANNOUNCEMENT', channel: 'TOWN_HALL', sender: 'CEO', content: 'Vision announcement — why we are transforming', scheduledDate: d(-75), sent: true, sentDate: d(-75) },
      { messageId: uid(), audience: 'Department Heads', phase: 'Awareness', messageType: 'UPDATE', channel: 'MEETING', sender: 'Change Manager', content: 'Detailed timeline and department impact review', scheduledDate: d(-60), sent: true, sentDate: d(-60) },
      { messageId: uid(), audience: 'Finance Team', phase: 'Preparation', messageType: 'TRAINING_INVITE', channel: 'EMAIL', sender: 'HR', content: 'ERP Finance module training enrollment', scheduledDate: d(-30), sent: true, sentDate: d(-30) },
      { messageId: uid(), audience: 'All Employees', phase: 'Implementation', messageType: 'UPDATE', channel: 'EMAIL', sender: 'Change Manager', content: 'Go-live update and support channels', scheduledDate: d(-5), sent: true, sentDate: d(-5) },
      { messageId: uid(), audience: 'All Employees', phase: 'Implementation', messageType: 'FAQ', channel: 'INTRANET', sender: 'IT', content: 'Common questions and troubleshooting guide', scheduledDate: d(0), sent: false },
      { messageId: uid(), audience: 'All Employees', phase: 'Reinforcement', messageType: 'SUCCESS_STORY', channel: 'EMAIL', sender: 'Change Manager', content: 'Early wins and success stories from pilot teams', scheduledDate: d(30), sent: false },
    ],
    trainingPlan: [
      { sessionId: uid(), title: 'ERP Overview — What is Changing', audience: 'All Employees', type: 'AWARENESS', deliveryMethod: 'VIRTUAL', duration: '1 hour', scheduledDate: d(-45), trainer: 'External Consultant', maxAttendees: 200, enrolledCount: 180, completedCount: 165 },
      { sessionId: uid(), title: 'Finance Module Deep Dive', audience: 'Finance Team', type: 'HANDS_ON', deliveryMethod: 'CLASSROOM', duration: '3 days', scheduledDate: d(-25), trainer: 'Vendor Trainer', maxAttendees: 25, enrolledCount: 22, completedCount: 20 },
      { sessionId: uid(), title: 'HR Module Training', audience: 'HR Team', type: 'HANDS_ON', deliveryMethod: 'CLASSROOM', duration: '2 days', scheduledDate: d(-20), trainer: 'Vendor Trainer', maxAttendees: 20, enrolledCount: 15, completedCount: 14 },
      { sessionId: uid(), title: 'Manager Approvals & Reporting', audience: 'Branch Managers', type: 'SKILL_BUILDING', deliveryMethod: 'VIRTUAL', duration: '2 hours', scheduledDate: d(-10), trainer: 'EMP-015', maxAttendees: 15, enrolledCount: 12, completedCount: 10 },
      { sessionId: uid(), title: 'Refresher & Tips', audience: 'All Employees', type: 'REFRESHER', deliveryMethod: 'E_LEARNING', duration: '30 min', scheduledDate: d(15), trainer: 'EMP-034', maxAttendees: 200, enrolledCount: 0, completedCount: 0 },
    ],
    adoptionMetrics: [
      { metricId: uid(), name: 'System Login Rate', targetValue: 95, currentValue: 65, unit: '%', measurementFrequency: 'DAILY', trend: [{ date: d(-14), value: 30 }, { date: d(-7), value: 48 }, { date: d(0), value: 65 }] },
      { metricId: uid(), name: 'Transactions via ERP', targetValue: 90, currentValue: 55, unit: '%', measurementFrequency: 'WEEKLY', trend: [{ date: d(-21), value: 15 }, { date: d(-14), value: 30 }, { date: d(-7), value: 42 }, { date: d(0), value: 55 }] },
      { metricId: uid(), name: 'Help Desk Tickets', targetValue: 10, currentValue: 35, unit: 'per day', measurementFrequency: 'DAILY', trend: [{ date: d(-14), value: 80 }, { date: d(-7), value: 55 }, { date: d(0), value: 35 }] },
      { metricId: uid(), name: 'Process Compliance', targetValue: 100, currentValue: 72, unit: '%', measurementFrequency: 'WEEKLY', trend: [{ date: d(-14), value: 40 }, { date: d(-7), value: 58 }, { date: d(0), value: 72 }] },
    ],
    resistanceLog: [
      { logId: uid(), date: d(-20), source: 'Finance', type: 'VOCAL', description: 'Team lead expressed concerns about data accuracy in new system during town hall', rootCause: 'LACK_OF_TRUST', actionTaken: 'Arranged dedicated session to walk through data migration validation', status: 'ADDRESSED' },
      { logId: uid(), date: d(-10), source: 'Operations', type: 'PASSIVE', description: 'Several staff still using old system for purchase orders', rootCause: 'SKILL_GAP', actionTaken: 'Assigned buddy system — each resister paired with a champion', status: 'OPEN' },
      { logId: uid(), date: d(-3), source: 'Branch Managers', type: 'ANXIETY', description: 'Concerns about system downtime affecting customer service', rootCause: 'FEAR_OF_UNKNOWN', actionTaken: 'Shared uptime SLA from vendor + rollback plan', status: 'ADDRESSED' },
    ],
    feedbackSurveys: [
      { surveyId: uid(), phase: 'Awareness', scheduledDate: d(-60), responseRate: 78, sentimentScore: 0.3, topConcerns: ['Timeline too aggressive', 'Not enough training time'], topPositives: ['Leadership support is visible', 'Good communication'] },
      { surveyId: uid(), phase: 'Implementation', scheduledDate: d(-5), responseRate: 65, sentimentScore: 0.15, topConcerns: ['System is slow', 'Need more hands-on practice'], topPositives: ['Finance module works well', 'Support team responsive'] },
    ],
    overallProgress: 72,
    overallStatus: 'IMPLEMENTING',
    adoptionRate: 65,
    budget: {
      allocated: 500000,
      spent: 380000,
      categories: [
        { name: 'Software Licensing', allocated: 200000, spent: 200000 },
        { name: 'Consulting', allocated: 150000, spent: 120000 },
        { name: 'Training', allocated: 80000, spent: 45000 },
        { name: 'Communication', allocated: 20000, spent: 10000 },
        { name: 'Contingency', allocated: 50000, spent: 5000 },
      ],
    },
    createdAt: d(-95),
    updatedAt: now,
  };
}

export async function ensureSeedData(db: Db, tenantId: string) {
  const existing = await db.collection(COLLECTION).findOne({ tenantId });
  if (existing) return;
  await db.collection(COLLECTION).insertOne(buildSeedInitiative(tenantId));
}

/* ── CRUD ───────────────────────────────────────────────────────────── */

export async function list(db: Db, tenantId: string) {
  return db.collection(COLLECTION).find({ tenantId }).sort({ updatedAt: -1 }).toArray();
}

export async function getActive(db: Db, tenantId: string) {
  return db.collection(COLLECTION).find({ tenantId, overallStatus: { $nin: ['COMPLETED', 'CANCELLED'] } }).sort({ updatedAt: -1 }).toArray();
}

export async function getDetail(db: Db, tenantId: string, changeId: string) {
  return db.collection(COLLECTION).findOne({ tenantId, changeId });
}

export async function create(db: Db, tenantId: string, data: Partial<ChangeInitiative>) {
  const count = await db.collection(COLLECTION).countDocuments({ tenantId });
  const changeId = `CHG-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
  const doc: ChangeInitiative = {
    tenantId,
    changeId,
    title: data.title || '',
    titleEn: data.titleEn,
    description: data.description || '',
    type: data.type || 'PROCESS_CHANGE',
    scope: data.scope || 'DEPARTMENT',
    affectedDepartments: data.affectedDepartments || [],
    sponsor: data.sponsor || { employeeId: '', name: '', title: '' },
    changeManager: data.changeManager || { employeeId: '', name: '' },
    changeAgents: data.changeAgents || [],
    phases: data.phases || defaultPhases(new Date()),
    stakeholders: data.stakeholders || [],
    risks: data.risks || [],
    communicationPlan: data.communicationPlan || [],
    trainingPlan: data.trainingPlan || [],
    adoptionMetrics: data.adoptionMetrics || [],
    resistanceLog: [],
    feedbackSurveys: [],
    overallProgress: 0,
    overallStatus: 'PLANNING',
    adoptionRate: 0,
    budget: data.budget || { allocated: 0, spent: 0, categories: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.collection(COLLECTION).insertOne(doc);
  return doc;
}

export async function update(db: Db, tenantId: string, changeId: string, updates: Partial<ChangeInitiative>) {
  const { _id, tenantId: _t, changeId: _c, ...safe } = updates as Partial<ChangeInitiative> & Record<string, unknown>;
  await db.collection(COLLECTION).updateOne({ tenantId, changeId }, { $set: { ...safe, updatedAt: new Date() } });
}

export async function addStakeholder(db: Db, tenantId: string, changeId: string, stakeholder: Stakeholder) {
  stakeholder.groupId = stakeholder.groupId || new ObjectId().toHexString().slice(-8);
  await db.collection(COLLECTION).updateOne({ tenantId, changeId }, { $push: { stakeholders: stakeholder }, $set: { updatedAt: new Date() } });
  return stakeholder;
}

export async function updateADKAR(db: Db, tenantId: string, changeId: string, groupId: string, scores: { awareness: number; desire: number; knowledge: number; ability: number; reinforcement: number }) {
  await db.collection(COLLECTION).updateOne(
    { tenantId, changeId, 'stakeholders.groupId': groupId },
    { $set: { 'stakeholders.$.currentAwareness': scores.awareness, 'stakeholders.$.currentDesire': scores.desire, 'stakeholders.$.currentKnowledge': scores.knowledge, 'stakeholders.$.currentAbility': scores.ability, 'stakeholders.$.currentReinforcement': scores.reinforcement, updatedAt: new Date() } },
  );
}

export async function addRisk(db: Db, tenantId: string, changeId: string, risk: Omit<Risk, 'riskId' | 'riskScore'>) {
  const full: Risk = { ...risk, riskId: new ObjectId().toHexString().slice(-8), riskScore: computeRiskScore(risk.likelihood, risk.impact) };
  await db.collection(COLLECTION).updateOne({ tenantId, changeId }, { $push: { risks: full }, $set: { updatedAt: new Date() } });
  return full;
}

export async function logResistance(db: Db, tenantId: string, changeId: string, entry: Omit<ResistanceEntry, 'logId'>) {
  const full: ResistanceEntry = { ...entry, logId: new ObjectId().toHexString().slice(-8) };
  await db.collection(COLLECTION).updateOne({ tenantId, changeId }, { $push: { resistanceLog: full }, $set: { updatedAt: new Date() } });
  return full;
}

export async function updateAdoption(db: Db, tenantId: string, changeId: string, metricId: string, value: number) {
  const initiative = await db.collection(COLLECTION).findOne({ tenantId, changeId }) as Record<string, unknown> | null;
  if (!initiative) return;
  const metrics: AdoptionMetric[] = (initiative.adoptionMetrics || []) as AdoptionMetric[];
  const m = metrics.find(x => x.metricId === metricId);
  if (m) {
    m.currentValue = value;
    m.trend.push({ date: new Date(), value });
  }
  const adoptionRate = calculateAdoptionRate(metrics);
  await db.collection(COLLECTION).updateOne({ tenantId, changeId }, { $set: { adoptionMetrics: metrics, adoptionRate, updatedAt: new Date() } });
}

export async function completePhase(db: Db, tenantId: string, changeId: string, phaseId: string) {
  const initiative = await db.collection(COLLECTION).findOne({ tenantId, changeId }) as Record<string, unknown> | null;
  if (!initiative) return;
  const phases: Phase[] = (initiative.phases || []) as Phase[];
  const phase = phases.find(p => p.phaseId === phaseId);
  if (phase) {
    phase.status = 'COMPLETED';
    phase.progress = 100;
  }
  const progress = calculateOverallProgress(phases);
  await db.collection(COLLECTION).updateOne({ tenantId, changeId }, { $set: { phases, overallProgress: progress, updatedAt: new Date() } });
}

export async function closeInitiative(db: Db, tenantId: string, changeId: string, lessons: { whatWorked: string[]; whatDidnt: string[]; recommendations: string[] }) {
  await db.collection(COLLECTION).updateOne(
    { tenantId, changeId },
    { $set: { overallStatus: 'COMPLETED', lessonsLearned: { ...lessons, completedDate: new Date() }, updatedAt: new Date() } },
  );
}

export { COLLECTION };
