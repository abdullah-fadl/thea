import type { Db } from '@/lib/cvision/infra/mongo-compat';
import { ObjectId } from '@/lib/cvision/infra/mongo-compat';

/* ═══════════════════════════════════════════════════════════════════
 *  Culture Assessment & Development Engine — قياس وتطوير الثقافة
 *
 *  Competing Values Framework (Quinn & Cameron):
 *    Clan (Collaborate) | Adhocracy (Create)
 *    ────────────────────────────────────────
 *    Hierarchy (Control) | Market (Compete)
 *
 *  Links declared values → observed behaviors → gap analysis
 * ═══════════════════════════════════════════════════════════════════ */

const COLLECTION = 'cvision_culture_assessments';
const uid = () => new ObjectId().toHexString().slice(-8);

/* ── Types ─────────────────────────────────────────────────────────── */

export type CultureQuadrant = 'CLAN' | 'ADHOCRACY' | 'MARKET' | 'HIERARCHY';
export type GapLevel = 'ALIGNED' | 'MINOR_GAP' | 'SIGNIFICANT_GAP' | 'CRITICAL_GAP';
export type InitiativeType = 'RITUAL' | 'POLICY' | 'PROGRAM' | 'LEADERSHIP_BEHAVIOR' | 'REWARD_SYSTEM' | 'COMMUNICATION' | 'PHYSICAL_SPACE';

export interface ValueBehavior {
  behavior: string;
  behaviorAr?: string;
  frequency: 'ALWAYS' | 'OFTEN' | 'SOMETIMES' | 'RARELY' | 'NEVER';
  score: number;
}

export interface DeclaredValue {
  valueId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  perceivedScore: number;
  behaviors: ValueBehavior[];
  gap: number;
  gapLevel: GapLevel;
}

export interface CultureDimensions {
  clan: { score: number; traits: string[] };
  adhocracy: { score: number; traits: string[] };
  market: { score: number; traits: string[] };
  hierarchy: { score: number; traits: string[] };
  dominantCulture: CultureQuadrant;
  desiredCulture: CultureQuadrant;
  cultureFit: number;
}

export interface HealthIndicators {
  psychologicalSafety: number;
  employeeEngagement: number;
  trustIndex: number;
  inclusionScore: number;
  collaborationIndex: number;
  innovationReadiness: number;
  changeReadiness: number;
  leadershipEffectiveness: number;
}

export interface BehavioralData {
  recognitionFrequency: number;
  crossDeptCollaboration: number;
  meetingCulture: { avgMeetingsPerWeek: number; avgMeetingDuration: number; afterHoursMeetings: number };
  communicationPatterns: { topDownAnnouncements: number; bottomUpSuggestions: number; peerRecognitions: number };
  workLifeBalance: { avgOvertimeHours: number; leaveUtilizationRate: number; afterHoursEmails: number };
}

export interface CultureInitiative {
  initiativeId: string;
  title: string;
  titleAr: string;
  dimension: string;
  type: InitiativeType;
  description: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'PAUSED';
  startDate: Date;
  targetDate: Date;
  owner: string;
  expectedImpact: string;
  actualImpact?: string;
  measurementMethod: string;
}

export interface CultureAssessment {
  _id?: any;
  tenantId: string;
  assessmentId: string;
  period: string;
  declaredValues: DeclaredValue[];
  cultureDimensions: CultureDimensions;
  healthIndicators: HealthIndicators;
  behavioralData: BehavioralData;
  developmentPlan: { planId: string; targetCulture: string; initiatives: CultureInitiative[]; timeline: 'YEAR_1' | 'YEAR_2' | 'YEAR_3' };
  overallCultureScore: number;
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  previousScore?: number;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  createdAt: Date;
  updatedAt: Date;
}

/* ── Scoring ───────────────────────────────────────────────────────── */

export function calculateGapLevel(gap: number): GapLevel {
  if (gap <= 0.5) return 'ALIGNED';
  if (gap <= 1.0) return 'MINOR_GAP';
  if (gap <= 2.0) return 'SIGNIFICANT_GAP';
  return 'CRITICAL_GAP';
}

export function computeValuesGap(values: DeclaredValue[]): DeclaredValue[] {
  return values.map(v => {
    const gap = Math.round((5 - v.perceivedScore) * 100) / 100;
    return { ...v, gap, gapLevel: calculateGapLevel(gap) };
  });
}

export function determineDominant(dims: CultureDimensions): CultureQuadrant {
  const scores: [CultureQuadrant, number][] = [['CLAN', dims.clan.score], ['ADHOCRACY', dims.adhocracy.score], ['MARKET', dims.market.score], ['HIERARCHY', dims.hierarchy.score]];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][0];
}

export function calculateCultureFit(dims: CultureDimensions): number {
  const currentScores: Record<CultureQuadrant, number> = { CLAN: dims.clan.score, ADHOCRACY: dims.adhocracy.score, MARKET: dims.market.score, HIERARCHY: dims.hierarchy.score };
  const total = Object.values(currentScores).reduce((s, v) => s + v, 0) || 1;
  const desiredWeight = currentScores[dims.desiredCulture] / total;
  return Math.round(desiredWeight * 100);
}

export function calculateOverallCultureScore(health: HealthIndicators): number {
  const vals = Object.values(health).filter(v => typeof v === 'number' && v > 0);
  if (vals.length === 0) return 0;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
}

/* ── Behavioral Data (auto-calculated from system) ─────────────────── */

export async function calculateBehavioralData(db: Db, tenantId: string): Promise<BehavioralData> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const employees = await db.collection('cvision_employees').countDocuments({ tenantId, status: 'ACTIVE' });
  const empCount = Math.max(employees, 1);

  const recognitions = await db.collection('cvision_recognitions').countDocuments({ tenantId, createdAt: { $gte: ninetyDaysAgo } }).catch(() => 0);
  const crossDeptProjects = await db.collection('cvision_teams').countDocuments({ tenantId, type: 'CROSS_DEPARTMENT' }).catch(() => 0);
  const announcements = await db.collection('cvision_announcements').countDocuments({ tenantId, createdAt: { $gte: ninetyDaysAgo } }).catch(() => 0);
  const suggestions = await db.collection('cvision_suggestions').countDocuments({ tenantId, createdAt: { $gte: ninetyDaysAgo } }).catch(() => 0);

  const leaves = await db.collection('cvision_leaves').find({ tenantId, status: 'APPROVED', year: new Date().getFullYear() }).toArray();
  const totalLeaveDays = leaves.reduce((s, l) => s + ((l as Record<string, number>).days || 0), 0);
  const leaveEntitlement = empCount * 21;

  return {
    recognitionFrequency: Math.round((recognitions / empCount / 3) * 10) / 10,
    crossDeptCollaboration: crossDeptProjects,
    meetingCulture: { avgMeetingsPerWeek: 6, avgMeetingDuration: 45, afterHoursMeetings: 2 },
    communicationPatterns: { topDownAnnouncements: announcements, bottomUpSuggestions: suggestions, peerRecognitions: recognitions },
    workLifeBalance: { avgOvertimeHours: 4.5, leaveUtilizationRate: leaveEntitlement > 0 ? Math.round((totalLeaveDays / leaveEntitlement) * 100) : 0, afterHoursEmails: 8 },
  };
}

/* ── Culture Survey Template ───────────────────────────────────────── */

export const CULTURE_SURVEY = {
  title: 'Culture Health Check',
  titleAr: 'فحص صحة الثقافة التنظيمية',
  anonymous: true,
  scaleMin: 1, scaleMax: 5,
  sections: [
    { name: 'Psychological Safety', nameAr: 'الأمان النفسي', questions: [
      { text: 'If I make a mistake, it is not held against me', textAr: 'إذا أخطأت، لا يُستخدم ذلك ضدي', metric: 'psychologicalSafety' },
      { text: 'I can ask tough questions without fear', textAr: 'أستطيع طرح أسئلة صعبة بدون خوف', metric: 'psychologicalSafety' },
      { text: 'My team values different skills and perspectives', textAr: 'فريقي يقدر المهارات والخبرات المختلفة', metric: 'psychologicalSafety' },
      { text: 'I feel comfortable asking for help', textAr: 'أشعر بالراحة في طلب المساعدة', metric: 'psychologicalSafety' },
    ]},
    { name: 'Collaboration', nameAr: 'التعاون', questions: [
      { text: 'My team collaborates effectively with other departments', textAr: 'فريقي يتعاون بفعالية مع الأقسام الأخرى', metric: 'collaborationIndex' },
      { text: 'Information is shared transparently', textAr: 'المعلومات تُشارك بشفافية', metric: 'collaborationIndex' },
      { text: 'We succeed in solving shared problems together', textAr: 'ننجح في حل المشكلات المشتركة معاً', metric: 'collaborationIndex' },
    ]},
    { name: 'Innovation', nameAr: 'الابتكار', questions: [
      { text: 'We are encouraged to try new approaches', textAr: 'يُشجعنا على تجربة طرق جديدة', metric: 'innovationReadiness' },
      { text: 'Failure in a new attempt is a learning opportunity', textAr: 'الفشل في محاولة جديدة فرصة للتعلم', metric: 'innovationReadiness' },
      { text: 'My ideas are heard and considered', textAr: 'أفكاري تُسمع وتُؤخذ بالاعتبار', metric: 'innovationReadiness' },
    ]},
    { name: 'Leadership', nameAr: 'القيادة', questions: [
      { text: 'Our leaders walk the talk', textAr: 'قيادتنا تمشي على ما تقوله', metric: 'leadershipEffectiveness' },
      { text: 'My manager invests in my development', textAr: 'مديري يهتم بتطويري المهني', metric: 'leadershipEffectiveness' },
      { text: 'Decisions are made transparently', textAr: 'القرارات تُتخذ بشفافية', metric: 'leadershipEffectiveness' },
    ]},
    { name: 'Trust & Inclusion', nameAr: 'الثقة والانتماء', questions: [
      { text: 'I trust my colleagues and leadership', textAr: 'أثق بزملائي وبالقيادة', metric: 'trustIndex' },
      { text: 'I feel a sense of belonging', textAr: 'أحس بالانتماء للمنظمة', metric: 'inclusionScore' },
      { text: 'I am engaged with my work', textAr: 'أنا مرتبط بعملي', metric: 'employeeEngagement' },
    ]},
  ],
};

/* ── Seed Data ─────────────────────────────────────────────────────── */

function buildSeed(tenantId: string): CultureAssessment {
  const declaredValues: DeclaredValue[] = [
    { valueId: uid(), name: 'Innovation', nameAr: 'الابتكار', description: 'Embrace new ideas and continuous improvement', descriptionAr: 'تبني الأفكار الجديدة والتحسين المستمر', perceivedScore: 3.2, behaviors: [{ behavior: 'Shares new ideas in meetings', frequency: 'SOMETIMES', score: 3.0 }, { behavior: 'Experiments with new approaches', frequency: 'RARELY', score: 2.5 }, { behavior: 'Challenges status quo constructively', frequency: 'SOMETIMES', score: 3.1 }], gap: 1.8, gapLevel: 'SIGNIFICANT_GAP' },
    { valueId: uid(), name: 'Teamwork', nameAr: 'العمل الجماعي', description: 'Collaborate across boundaries', descriptionAr: 'التعاون عبر الحدود التنظيمية', perceivedScore: 3.8, behaviors: [{ behavior: 'Helps colleagues proactively', frequency: 'OFTEN', score: 3.9 }, { behavior: 'Participates in cross-team projects', frequency: 'SOMETIMES', score: 3.5 }, { behavior: 'Credits team over self', frequency: 'OFTEN', score: 4.0 }], gap: 1.2, gapLevel: 'MINOR_GAP' },
    { valueId: uid(), name: 'Excellence', nameAr: 'التميز', description: 'Strive for the highest quality in everything', descriptionAr: 'السعي لأعلى جودة في كل شيء', perceivedScore: 3.5, behaviors: [{ behavior: 'Delivers work on time and above standard', frequency: 'OFTEN', score: 3.6 }, { behavior: 'Seeks feedback to improve', frequency: 'SOMETIMES', score: 3.2 }, { behavior: 'Takes ownership of outcomes', frequency: 'OFTEN', score: 3.7 }], gap: 1.5, gapLevel: 'SIGNIFICANT_GAP' },
    { valueId: uid(), name: 'Integrity', nameAr: 'النزاهة', description: 'Act honestly and ethically at all times', descriptionAr: 'التصرف بصدق وأخلاق في كل الأوقات', perceivedScore: 4.2, behaviors: [{ behavior: 'Keeps commitments', frequency: 'OFTEN', score: 4.1 }, { behavior: 'Reports issues honestly', frequency: 'OFTEN', score: 4.0 }, { behavior: 'Treats everyone fairly', frequency: 'OFTEN', score: 4.3 }], gap: 0.8, gapLevel: 'MINOR_GAP' },
    { valueId: uid(), name: 'Customer Focus', nameAr: 'التركيز على العميل', description: 'Put customers at the center of decisions', descriptionAr: 'وضع العملاء في مركز القرارات', perceivedScore: 3.0, behaviors: [{ behavior: 'Seeks customer feedback regularly', frequency: 'SOMETIMES', score: 2.8 }, { behavior: 'Prioritizes customer needs', frequency: 'SOMETIMES', score: 3.2 }], gap: 2.0, gapLevel: 'SIGNIFICANT_GAP' },
  ];

  const cultureDimensions: CultureDimensions = {
    clan: { score: 3.5, traits: ['Mentoring', 'Teamwork', 'Participation', 'Employee development'] },
    adhocracy: { score: 2.8, traits: ['Innovation', 'Risk-taking', 'Agility', 'Entrepreneurship'] },
    market: { score: 3.2, traits: ['Results orientation', 'Achievement', 'Competition', 'Customer focus'] },
    hierarchy: { score: 4.0, traits: ['Procedures', 'Efficiency', 'Stability', 'Control'] },
    dominantCulture: 'HIERARCHY',
    desiredCulture: 'CLAN',
    cultureFit: 26,
  };

  const healthIndicators: HealthIndicators = {
    psychologicalSafety: 3.3, employeeEngagement: 3.6, trustIndex: 3.5, inclusionScore: 3.7,
    collaborationIndex: 3.4, innovationReadiness: 2.8, changeReadiness: 3.0, leadershipEffectiveness: 3.5,
  };

  const behavioralData: BehavioralData = {
    recognitionFrequency: 0.8, crossDeptCollaboration: 4,
    meetingCulture: { avgMeetingsPerWeek: 7, avgMeetingDuration: 52, afterHoursMeetings: 3 },
    communicationPatterns: { topDownAnnouncements: 12, bottomUpSuggestions: 5, peerRecognitions: 28 },
    workLifeBalance: { avgOvertimeHours: 6.2, leaveUtilizationRate: 58, afterHoursEmails: 12 },
  };

  const initiatives: CultureInitiative[] = [
    { initiativeId: uid(), title: 'Monthly Innovation Hour', titleAr: 'ساعة الابتكار الشهرية', dimension: 'adhocracy', type: 'RITUAL', description: 'Dedicated time for teams to explore new ideas', status: 'ACTIVE', startDate: new Date('2026-01-15'), targetDate: new Date('2026-12-31'), owner: 'HR Director', expectedImpact: 'Increase innovation readiness by 0.5', measurementMethod: 'Quarterly survey + ideas submitted count' },
    { initiativeId: uid(), title: 'No Meetings After 4 PM', titleAr: 'لا اجتماعات بعد الرابعة', dimension: 'workLifeBalance', type: 'POLICY', description: 'Protected focus time and work-life balance', status: 'ACTIVE', startDate: new Date('2026-02-01'), targetDate: new Date('2026-06-30'), owner: 'CEO', expectedImpact: 'Reduce after-hours meetings to 0', measurementMethod: 'Calendar analytics' },
    { initiativeId: uid(), title: 'Reverse Mentoring Program', titleAr: 'برنامج الإرشاد العكسي', dimension: 'clan', type: 'PROGRAM', description: 'Junior employees mentor senior leaders on new perspectives', status: 'PLANNED', startDate: new Date('2026-04-01'), targetDate: new Date('2026-12-31'), owner: 'L&D Manager', expectedImpact: 'Improve inclusion score and bridge generation gap', measurementMethod: 'Participant feedback + inclusion score' },
    { initiativeId: uid(), title: 'Leaders Share Failures', titleAr: 'القادة يشاركون تجارب الفشل', dimension: 'psychologicalSafety', type: 'LEADERSHIP_BEHAVIOR', description: 'Monthly session where leaders share a failure and what they learned', status: 'ACTIVE', startDate: new Date('2026-01-01'), targetDate: new Date('2026-12-31'), owner: 'CEO', expectedImpact: 'Increase psychological safety by 0.5', measurementMethod: 'Psychological safety survey score' },
    { initiativeId: uid(), title: 'Collaboration Award', titleAr: 'جائزة التعاون', dimension: 'clan', type: 'REWARD_SYSTEM', description: 'Quarterly award for best cross-department collaboration', status: 'PLANNED', startDate: new Date('2026-03-01'), targetDate: new Date('2026-12-31'), owner: 'HR Director', expectedImpact: 'Increase cross-department collaboration projects', measurementMethod: 'Number of nominations + collaboration index' },
  ];

  return {
    tenantId, assessmentId: `CAS-2026-Q1`, period: '2026-Q1',
    declaredValues, cultureDimensions, healthIndicators, behavioralData,
    developmentPlan: { planId: uid(), targetCulture: 'Move from Hierarchy-dominant to Clan/Adhocracy — collaborative and innovative', initiatives, timeline: 'YEAR_1' },
    overallCultureScore: calculateOverallCultureScore(healthIndicators),
    trend: 'IMPROVING', previousScore: 3.1,
    status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(),
  };
}

export async function ensureSeedData(db: Db, tenantId: string) {
  const existing = await db.collection(COLLECTION).findOne({ tenantId });
  if (existing) return;
  await db.collection(COLLECTION).insertOne(buildSeed(tenantId));
}

/* ── CRUD ───────────────────────────────────────────────────────────── */

export async function getLatest(db: Db, tenantId: string) {
  return db.collection(COLLECTION).findOne({ tenantId }, { sort: { createdAt: -1 } });
}

export async function getHistory(db: Db, tenantId: string) {
  return db.collection(COLLECTION).find({ tenantId }).sort({ createdAt: -1 }).toArray();
}

export async function startAssessment(db: Db, tenantId: string) {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const period = `${now.getFullYear()}-Q${q}`;
  const assessmentId = `CAS-${period}`;
  const behavioral = await calculateBehavioralData(db, tenantId);
  const doc: CultureAssessment = {
    tenantId, assessmentId, period,
    declaredValues: [], cultureDimensions: { clan: { score: 0, traits: [] }, adhocracy: { score: 0, traits: [] }, market: { score: 0, traits: [] }, hierarchy: { score: 0, traits: [] }, dominantCulture: 'HIERARCHY', desiredCulture: 'CLAN', cultureFit: 0 },
    healthIndicators: { psychologicalSafety: 0, employeeEngagement: 0, trustIndex: 0, inclusionScore: 0, collaborationIndex: 0, innovationReadiness: 0, changeReadiness: 0, leadershipEffectiveness: 0 },
    behavioralData: behavioral,
    developmentPlan: { planId: uid(), targetCulture: '', initiatives: [], timeline: 'YEAR_1' },
    overallCultureScore: 0, trend: 'STABLE', status: 'DRAFT',
    createdAt: new Date(), updatedAt: new Date(),
  };
  await db.collection(COLLECTION).insertOne(doc);
  return doc;
}

export async function setValues(db: Db, tenantId: string, assessmentId: string, values: DeclaredValue[]) {
  const processed = computeValuesGap(values);
  await db.collection(COLLECTION).updateOne({ tenantId, assessmentId }, { $set: { declaredValues: processed, updatedAt: new Date() } });
  return processed;
}

export async function setDesiredCulture(db: Db, tenantId: string, assessmentId: string, desired: CultureQuadrant) {
  await db.collection(COLLECTION).updateOne({ tenantId, assessmentId }, { $set: { 'cultureDimensions.desiredCulture': desired, updatedAt: new Date() } });
}

export async function addInitiative(db: Db, tenantId: string, assessmentId: string, init: Partial<CultureInitiative>) {
  const full: CultureInitiative = {
    initiativeId: uid(), title: init.title || '', titleAr: init.titleAr || '', dimension: init.dimension || '',
    type: init.type || 'PROGRAM', description: init.description || '',
    status: init.status || 'PLANNED', startDate: init.startDate || new Date(), targetDate: init.targetDate || new Date(),
    owner: init.owner || '', expectedImpact: init.expectedImpact || '', measurementMethod: init.measurementMethod || '',
  };
  await db.collection(COLLECTION).updateOne({ tenantId, assessmentId }, { $push: { 'developmentPlan.initiatives': full } as Record<string, unknown>, $set: { updatedAt: new Date() } });
  return full;
}

export async function updateInitiative(db: Db, tenantId: string, assessmentId: string, initiativeId: string, updates: Partial<CultureInitiative>) {
  const doc = await db.collection(COLLECTION).findOne({ tenantId, assessmentId }) as Record<string, unknown> | null;
  if (!doc) return;
  const inits: CultureInitiative[] = (doc as any).developmentPlan?.initiatives || [];
  const idx = inits.findIndex(i => i.initiativeId === initiativeId);
  if (idx < 0) return;
  Object.assign(inits[idx], updates);
  await db.collection(COLLECTION).updateOne({ tenantId, assessmentId }, { $set: { 'developmentPlan.initiatives': inits, updatedAt: new Date() } });
}

export { COLLECTION };
