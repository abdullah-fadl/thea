import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type OKRLevel = 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'INDIVIDUAL';
export type OKRPeriod = 'ANNUAL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'MONTHLY';
export type OKRStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type KRStatus = 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED';
export type MetricType = 'NUMBER' | 'PERCENTAGE' | 'CURRENCY' | 'BOOLEAN' | 'MILESTONE';
export type KPICategory = 'HR' | 'FINANCE' | 'OPERATIONS' | 'SALES' | 'CUSTOMER' | 'QUALITY';
export type TargetDirection = 'HIGHER_BETTER' | 'LOWER_BETTER' | 'TARGET_EXACT';
export type KPIFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

const OKR_COLL = 'cvision_okrs';
const KPI_COLL = 'cvision_kpis';

export const HR_KPIS = [
  { name: 'Employee Turnover Rate', nameAr: 'معدل دوران الموظفين', formula: 'resignations / avg_headcount * 100', target: 10, unit: '%', direction: 'LOWER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Time to Hire', nameAr: 'وقت التوظيف', formula: 'avg(hired_date - job_posted_date)', target: 30, unit: 'days', direction: 'LOWER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Cost per Hire', nameAr: 'تكلفة التوظيف', formula: 'total_recruitment_cost / hires', target: 5000, unit: 'SAR', direction: 'LOWER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Absenteeism Rate', nameAr: 'معدل الغياب', formula: 'absent_days / (working_days * headcount) * 100', target: 3, unit: '%', direction: 'LOWER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Training Hours per Employee', nameAr: 'ساعات التدريب لكل موظف', formula: 'total_training_hours / headcount', target: 40, unit: 'hours', direction: 'HIGHER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Employee Satisfaction (eNPS)', nameAr: 'رضا الموظفين', formula: 'from surveys', target: 50, unit: 'score', direction: 'HIGHER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Saudization Rate', nameAr: 'نسبة السعودة', formula: 'saudi_employees / total * 100', target: 30, unit: '%', direction: 'HIGHER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Insurance Claim Rate', nameAr: 'معدل مطالبات التأمين', formula: 'claims / insured_employees', target: 0.5, unit: 'ratio', direction: 'LOWER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Overtime as % of Payroll', nameAr: 'العمل الإضافي كنسبة من الرواتب', formula: 'overtime_cost / total_payroll * 100', target: 5, unit: '%', direction: 'LOWER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Offer Acceptance Rate', nameAr: 'معدل قبول العروض', formula: 'accepted_offers / total_offers * 100', target: 85, unit: '%', direction: 'HIGHER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Probation Pass Rate', nameAr: 'معدل اجتياز فترة التجربة', formula: 'confirmed / total_probation * 100', target: 90, unit: '%', direction: 'HIGHER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
  { name: 'Average Tenure', nameAr: 'متوسط مدة الخدمة', formula: 'avg(today - join_date)', target: 3, unit: 'years', direction: 'HIGHER_BETTER' as TargetDirection, category: 'HR' as KPICategory },
];

/* ── Seed Data ─────────────────────────────────────────────────────── */

const SEED_OKRS = [
  {
    okrId: 'OKR-001', level: 'COMPANY' as OKRLevel, ownerId: 'COMPANY', ownerName: 'Company', ownerType: 'COMPANY',
    period: 'ANNUAL' as OKRPeriod, year: 2026,
    objective: 'Improve employee retention by 20%', objectiveAr: 'تحسين الاحتفاظ بالموظفين بنسبة 20%',
    keyResults: [
      { krId: 'KR-001-1', description: 'Reduce turnover rate to 8%', descriptionAr: 'خفض معدل الدوران إلى 8%', metricType: 'PERCENTAGE' as MetricType, targetValue: 8, currentValue: 10.5, startValue: 12, unit: '%', progress: 38, status: 'AT_RISK' as KRStatus, weight: 40, updates: [], dueDate: new Date(2026, 11, 31) },
      { krId: 'KR-001-2', description: 'Achieve eNPS score of 60+', descriptionAr: 'تحقيق درجة رضا الموظفين 60+', metricType: 'NUMBER' as MetricType, targetValue: 60, currentValue: 48, startValue: 35, unit: 'score', progress: 52, status: 'ON_TRACK' as KRStatus, weight: 30, updates: [], dueDate: new Date(2026, 11, 31) },
      { krId: 'KR-001-3', description: 'Complete 100% of exit interviews', descriptionAr: 'إكمال 100% من مقابلات نهاية الخدمة', metricType: 'PERCENTAGE' as MetricType, targetValue: 100, currentValue: 85, startValue: 60, unit: '%', progress: 63, status: 'ON_TRACK' as KRStatus, weight: 30, updates: [], dueDate: new Date(2026, 11, 31) },
    ],
    overallProgress: 50, overallStatus: 'ON_TRACK', alignedTo: [], contributesTo: ['OKR-002', 'OKR-003'],
    status: 'ACTIVE' as OKRStatus,
  },
  {
    okrId: 'OKR-002', level: 'DEPARTMENT' as OKRLevel, parentOkrId: 'OKR-001',
    ownerId: 'DEP-001', ownerName: 'Human Resources', ownerType: 'DEPARTMENT',
    period: 'Q1' as OKRPeriod, year: 2026,
    objective: 'Revamp onboarding experience', objectiveAr: 'تجديد تجربة التأهيل',
    keyResults: [
      { krId: 'KR-002-1', description: 'New hire satisfaction > 90%', metricType: 'PERCENTAGE' as MetricType, targetValue: 90, currentValue: 78, startValue: 65, unit: '%', progress: 52, status: 'ON_TRACK' as KRStatus, weight: 50, updates: [], dueDate: new Date(2026, 2, 31) },
      { krId: 'KR-002-2', description: 'Reduce time-to-productivity to 30 days', metricType: 'NUMBER' as MetricType, targetValue: 30, currentValue: 42, startValue: 60, unit: 'days', progress: 60, status: 'ON_TRACK' as KRStatus, weight: 50, updates: [], dueDate: new Date(2026, 2, 31) },
    ],
    overallProgress: 56, overallStatus: 'ON_TRACK', alignedTo: ['OKR-001'], contributesTo: [],
    status: 'ACTIVE' as OKRStatus,
  },
  {
    okrId: 'OKR-003', level: 'INDIVIDUAL' as OKRLevel, parentOkrId: 'OKR-001',
    ownerId: 'EMP-001', ownerName: 'Ahmed Hassan', ownerType: 'EMPLOYEE',
    period: 'Q1' as OKRPeriod, year: 2026,
    objective: 'Launch employee engagement program', objectiveAr: 'إطلاق برنامج مشاركة الموظفين',
    keyResults: [
      { krId: 'KR-003-1', description: 'Plan and execute 4 team events', metricType: 'NUMBER' as MetricType, targetValue: 4, currentValue: 2, startValue: 0, unit: 'events', progress: 50, status: 'ON_TRACK' as KRStatus, weight: 50, updates: [], dueDate: new Date(2026, 2, 31) },
      { krId: 'KR-003-2', description: 'Participation rate > 80%', metricType: 'PERCENTAGE' as MetricType, targetValue: 80, currentValue: 72, startValue: 50, unit: '%', progress: 73, status: 'ON_TRACK' as KRStatus, weight: 50, updates: [], dueDate: new Date(2026, 2, 31) },
    ],
    overallProgress: 62, overallStatus: 'ON_TRACK', alignedTo: ['OKR-001'], contributesTo: [],
    status: 'ACTIVE' as OKRStatus,
  },
];

export async function ensureSeedData(db: Db, tenantId: string) {
  const okrColl = db.collection(OKR_COLL);
  if (await okrColl.countDocuments({ tenantId }) > 0) return;
  const now = new Date();
  await okrColl.insertMany(SEED_OKRS.map(o => ({ ...o, tenantId, createdBy: 'SYSTEM', createdAt: now, updatedAt: now })));

  const kpiColl = db.collection(KPI_COLL);
  let idx = 1;
  await kpiColl.insertMany(HR_KPIS.map(k => ({
    tenantId, kpiId: `KPI-${String(idx++).padStart(3, '0')}`,
    name: k.name, nameAr: k.nameAr, category: k.category, formula: k.formula,
    dataSource: 'cvision_employees',
    targetValue: k.target, targetDirection: k.direction,
    thresholds: { excellent: k.target * (k.direction === 'LOWER_BETTER' ? 0.8 : 1.2), good: k.target, poor: k.target * (k.direction === 'LOWER_BETTER' ? 1.5 : 0.5) },
    currentValue: k.target * (0.8 + Math.random() * 0.4),
    lastCalculated: now, trend: ['UP', 'DOWN', 'STABLE'][Math.floor(Math.random() * 3)],
    history: [], assignedTo: 'COMPANY', frequency: 'MONTHLY',
    status: 'ACTIVE', createdAt: now, updatedAt: now,
  })));
}

/* ── OKR Queries ───────────────────────────────────────────────────── */

export async function listOKRs(db: Db, tenantId: string, filters?: { level?: string; period?: string; year?: number; status?: string }) {
  const query: any = { tenantId };
  if (filters?.level) query.level = filters.level;
  if (filters?.period) query.period = filters.period;
  if (filters?.year) query.year = filters.year;
  if (filters?.status) query.status = filters.status;
  return db.collection(OKR_COLL).find(query).sort({ okrId: 1 }).toArray();
}

export async function getOKRDetail(db: Db, tenantId: string, okrId: string) {
  return db.collection(OKR_COLL).findOne({ tenantId, okrId });
}

export async function getMyOKRs(db: Db, tenantId: string, employeeId: string) {
  return db.collection(OKR_COLL).find({ tenantId, ownerId: employeeId }).sort({ year: -1, period: 1 }).toArray();
}

export async function getTeamOKRs(db: Db, tenantId: string, departmentId: string) {
  return db.collection(OKR_COLL).find({ tenantId, $or: [{ ownerId: departmentId }, { level: 'TEAM' }] }).toArray();
}

export async function getCompanyOKRs(db: Db, tenantId: string, year: number) {
  return db.collection(OKR_COLL).find({ tenantId, level: 'COMPANY', year }).toArray();
}

export async function getAlignmentTree(db: Db, tenantId: string, year: number) {
  const all = await db.collection(OKR_COLL).find({ tenantId, year }).toArray();
  const roots = all.filter(o => !o.parentOkrId);
  function buildTree(parent: any): any {
    const children = all.filter(o => o.parentOkrId === parent.okrId);
    return { ...parent, children: children.map(buildTree) };
  }
  return roots.map(buildTree);
}

export async function getProgressDashboard(db: Db, tenantId: string, year: number) {
  const okrs = await db.collection(OKR_COLL).find({ tenantId, year, status: 'ACTIVE' }).toArray();
  const total = okrs.length;
  const byStatus = { ON_TRACK: 0, AT_RISK: 0, BEHIND: 0, COMPLETED: 0, NOT_STARTED: 0 };
  for (const o of okrs) byStatus[o.overallStatus as keyof typeof byStatus] = (byStatus[o.overallStatus as keyof typeof byStatus] || 0) + 1;
  const avgProgress = total > 0 ? Math.round(okrs.reduce((s, o) => s + (o.overallProgress || 0), 0) / total) : 0;
  return { total, byStatus, avgProgress, byLevel: { COMPANY: okrs.filter(o => o.level === 'COMPANY').length, DEPARTMENT: okrs.filter(o => o.level === 'DEPARTMENT').length, INDIVIDUAL: okrs.filter(o => o.level === 'INDIVIDUAL').length } };
}

/* ── KPI Queries ───────────────────────────────────────────────────── */

export async function listKPIs(db: Db, tenantId: string, category?: string) {
  const query: any = { tenantId };
  if (category) query.category = category;
  return db.collection(KPI_COLL).find(query).sort({ kpiId: 1 }).toArray();
}

export async function getKPIDetail(db: Db, tenantId: string, kpiId: string) {
  return db.collection(KPI_COLL).findOne({ tenantId, kpiId });
}

export async function getKPIDashboard(db: Db, tenantId: string) {
  const kpis = await db.collection(KPI_COLL).find({ tenantId, status: 'ACTIVE' }).toArray();
  return kpis.map(k => {
    let ragStatus: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (k.targetDirection === 'LOWER_BETTER') {
      if (k.currentValue > k.thresholds?.poor) ragStatus = 'RED';
      else if (k.currentValue > k.targetValue) ragStatus = 'YELLOW';
    } else if (k.targetDirection === 'HIGHER_BETTER') {
      if (k.currentValue < k.thresholds?.poor) ragStatus = 'RED';
      else if (k.currentValue < k.targetValue) ragStatus = 'YELLOW';
    }
    return { ...k, ragStatus };
  });
}

/* ── OKR Mutations ─────────────────────────────────────────────────── */

export async function createOKR(db: Db, tenantId: string, data: any, userId: string) {
  const count = await db.collection(OKR_COLL).countDocuments({ tenantId });
  const okrId = `OKR-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  await db.collection(OKR_COLL).insertOne({
    ...data, tenantId, okrId, overallProgress: 0, overallStatus: 'NOT_STARTED',
    alignedTo: data.alignedTo || [], contributesTo: [],
    status: 'DRAFT', createdBy: userId, createdAt: now, updatedAt: now,
  });
  return okrId;
}

export async function updateOKR(db: Db, tenantId: string, okrId: string, updates: any) {
  await db.collection(OKR_COLL).updateOne({ tenantId, okrId }, { $set: { ...updates, updatedAt: new Date() } });
}

export async function checkInKR(db: Db, tenantId: string, okrId: string, krId: string, value: number, notes: string, userId: string) {
  const okr = await db.collection(OKR_COLL).findOne({ tenantId, okrId });
  if (!okr) return;
  const krs = okr.keyResults.map((kr: any) => {
    if (kr.krId !== krId) return kr;
    const newProgress = Math.min(100, Math.round(((value - kr.startValue) / (kr.targetValue - kr.startValue)) * 100));
    const updates = [...(kr.updates || []), { date: new Date(), value, notes, updatedBy: userId }];
    let status: KRStatus = 'ON_TRACK';
    if (newProgress >= 100) status = 'COMPLETED';
    else if (newProgress < 30) status = 'BEHIND';
    else if (newProgress < 50) status = 'AT_RISK';
    return { ...kr, currentValue: value, progress: Math.max(0, newProgress), status, updates };
  });
  const totalWeight = krs.reduce((s: number, kr: any) => s + kr.weight, 0);
  const overallProgress = totalWeight > 0 ? Math.round(krs.reduce((s: number, kr: any) => s + kr.progress * kr.weight, 0) / totalWeight) : 0;
  const allCompleted = krs.every((kr: any) => kr.status === 'COMPLETED');
  const anyBehind = krs.some((kr: any) => kr.status === 'BEHIND');
  const overallStatus = allCompleted ? 'COMPLETED' : anyBehind ? 'BEHIND' : 'ON_TRACK';
  await db.collection(OKR_COLL).updateOne({ tenantId, okrId }, { $set: { keyResults: krs, overallProgress, overallStatus, updatedAt: new Date() } });
}

/* ── KPI Mutations ─────────────────────────────────────────────────── */

export async function createKPI(db: Db, tenantId: string, data: any) {
  const count = await db.collection(KPI_COLL).countDocuments({ tenantId });
  const kpiId = `KPI-${String(count + 1).padStart(3, '0')}`;
  const now = new Date();
  await db.collection(KPI_COLL).insertOne({
    ...data, tenantId, kpiId, currentValue: 0, lastCalculated: now,
    trend: 'STABLE', history: [], status: 'ACTIVE', createdAt: now, updatedAt: now,
  });
  return kpiId;
}

export async function recordKPIValue(db: Db, tenantId: string, kpiId: string, period: string, value: number) {
  const kpi = await db.collection(KPI_COLL).findOne({ tenantId, kpiId });
  const prevValue = kpi?.currentValue || 0;
  const trend = value > prevValue ? 'UP' : value < prevValue ? 'DOWN' : 'STABLE';
  await db.collection(KPI_COLL).updateOne(
    { tenantId, kpiId },
    {
      $set: { currentValue: value, lastCalculated: new Date(), trend, updatedAt: new Date() },
      $push: { history: { period, value } } as Record<string, unknown>,
    },
  );
}
