import type { Db } from '@/lib/cvision/infra/mongo-compat';

/* ── Types ─────────────────────────────────────────────────────────── */

export type Authority = 'GOSI' | 'MOL' | 'CCHI' | 'ZATCA' | 'MUDAD' | 'NITAQAT' | 'INTERNAL' | 'OTHER';
export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONE_TIME';
export type DeadlineStatus = 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED' | 'NOT_APPLICABLE';
export type NitaqatCategory = 'PLATINUM' | 'GREEN_HIGH' | 'GREEN_MID' | 'GREEN_LOW' | 'YELLOW' | 'RED';

const DEADLINES_COLL = 'cvision_compliance_calendar';
const NITAQAT_COLL = 'cvision_nitaqat_scores';

export const SAUDI_COMPLIANCE = [
  { title: 'GOSI Monthly Payment', titleAr: 'دفع التأمينات الاجتماعية الشهري', authority: 'GOSI' as Authority, frequency: 'MONTHLY' as Frequency, dueDay: 15, penalty: '2% late fee', penaltyAmount: 0, alertDaysBefore: [7, 3, 1] },
  { title: 'WPS Salary File Upload', titleAr: 'رفع ملف حماية الأجور', authority: 'MUDAD' as Authority, frequency: 'MONTHLY' as Frequency, dueDay: 10, penalty: 'Suspension of services', alertDaysBefore: [5, 2, 1] },
  { title: 'Nitaqat Status Check', titleAr: 'فحص حالة نطاقات', authority: 'MOL' as Authority, frequency: 'QUARTERLY' as Frequency, dueDay: 1, penalty: 'Visa restrictions', alertDaysBefore: [30, 7] },
  { title: 'CCHI Insurance Compliance', titleAr: 'امتثال التأمين الصحي', authority: 'CCHI' as Authority, frequency: 'ANNUAL' as Frequency, dueMonth: 1, penalty: 'Fine up to 500 SAR per employee', penaltyAmount: 500, alertDaysBefore: [60, 30, 7] },
  { title: 'ZATCA Tax Filing', titleAr: 'تقديم الإقرار الضريبي', authority: 'ZATCA' as Authority, frequency: 'QUARTERLY' as Frequency, dueDay: 30, penalty: '5-25% of unpaid tax', alertDaysBefore: [30, 14, 7] },
  { title: 'Labor Law Compliance Audit', titleAr: 'تدقيق الامتثال لنظام العمل', authority: 'MOL' as Authority, frequency: 'ANNUAL' as Frequency, dueMonth: 6, penalty: 'Fines and restrictions', alertDaysBefore: [60, 30, 14] },
  { title: 'Fire Safety Certificate Renewal', titleAr: 'تجديد شهادة السلامة من الحريق', authority: 'OTHER' as Authority, frequency: 'ANNUAL' as Frequency, dueMonth: 3, penalty: 'Facility closure', alertDaysBefore: [90, 30, 7] },
  { title: 'Trade License Renewal', titleAr: 'تجديد السجل التجاري', authority: 'OTHER' as Authority, frequency: 'ANNUAL' as Frequency, dueMonth: 12, penalty: 'Business suspension', alertDaysBefore: [60, 30, 7] },
  { title: 'Chamber of Commerce Renewal', titleAr: 'تجديد عضوية الغرفة التجارية', authority: 'OTHER' as Authority, frequency: 'ANNUAL' as Frequency, dueMonth: 12, penalty: 'Service suspension', alertDaysBefore: [60, 30, 7] },
];

/* ── Seed Data ─────────────────────────────────────────────────────── */

function computeNextDueDate(freq: Frequency, dueDay?: number, dueMonth?: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (freq === 'MONTHLY') return new Date(year, month + 1, dueDay || 1);
  if (freq === 'QUARTERLY') {
    const qMonth = Math.floor(month / 3) * 3 + 3;
    return new Date(year, qMonth, dueDay || 1);
  }
  if (freq === 'ANNUAL') return new Date(year, (dueMonth || 1) - 1, dueDay || 1);
  return new Date(year, month + 1, 1);
}

export async function ensureSeedData(db: Db, tenantId: string) {
  const coll = db.collection(DEADLINES_COLL);
  if (await coll.countDocuments({ tenantId }) > 0) return;
  const now = new Date();

  const deadlines = SAUDI_COMPLIANCE.map((c, idx) => {
    const nextDue = computeNextDueDate(c.frequency, c.dueDay, undefined);
    const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let status: DeadlineStatus = 'UPCOMING';
    if (daysUntil < 0) status = 'OVERDUE';
    else if (daysUntil <= 7) status = 'DUE_SOON';
    return {
      ...c, tenantId, description: c.title,
      dueDay: c.dueDay, nextDueDate: nextDue, status,
      assignedTo: idx < 3 ? 'HR Manager' : 'Finance Manager',
      assignedDepartment: idx < 3 ? 'Human Resources' : 'Finance',
      completionHistory: [], penaltyForLate: c.penalty,
      createdAt: now, updatedAt: now,
    };
  });
  await coll.insertMany(deadlines);

  await db.collection(NITAQAT_COLL).insertOne({
    tenantId, calculationDate: now, totalEmployees: 55, saudiEmployees: 18,
    saudizationRate: 32.7, requiredRate: 26, category: 'GREEN_MID' as NitaqatCategory,
    gap: 0, recommendations: ['Maintain current ratio', 'Consider Saudi trainee programs for future growth'],
  });
}

/* ── Queries ───────────────────────────────────────────────────────── */

export async function getCalendar(db: Db, tenantId: string) {
  return db.collection(DEADLINES_COLL).find({ tenantId }).sort({ nextDueDate: 1 }).toArray();
}

export async function getUpcoming(db: Db, tenantId: string, days: number = 30) {
  const future = new Date();
  future.setDate(future.getDate() + days);
  return db.collection(DEADLINES_COLL).find({
    tenantId, nextDueDate: { $lte: future }, status: { $ne: 'COMPLETED' },
  }).sort({ nextDueDate: 1 }).toArray();
}

export async function getOverdue(db: Db, tenantId: string) {
  return db.collection(DEADLINES_COLL).find({ tenantId, status: 'OVERDUE' }).sort({ nextDueDate: 1 }).toArray();
}

export async function getNitaqatScore(db: Db, tenantId: string) {
  return db.collection(NITAQAT_COLL).findOne({ tenantId }, { sort: { calculationDate: -1 } });
}

export async function getComplianceReport(db: Db, tenantId: string) {
  const deadlines = await db.collection(DEADLINES_COLL).find({ tenantId }).toArray();
  const total = deadlines.length;
  const byStatus: any = {};
  for (const d of deadlines) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  const byAuthority: any = {};
  for (const d of deadlines) byAuthority[d.authority] = (byAuthority[d.authority] || 0) + 1;
  const completionRate = total > 0 ? Math.round(((byStatus.COMPLETED || 0) / total) * 100) : 0;
  return { total, byStatus, byAuthority, completionRate };
}

export async function getAuditReadiness(db: Db, tenantId: string) {
  const deadlines = await db.collection(DEADLINES_COLL).find({ tenantId }).toArray();
  const overdue = deadlines.filter(d => d.status === 'OVERDUE').length;
  const dueSoon = deadlines.filter(d => d.status === 'DUE_SOON').length;
  const completed = deadlines.filter(d => d.status === 'COMPLETED').length;
  const score = Math.max(0, 100 - (overdue * 15) - (dueSoon * 5));
  return { score, overdue, dueSoon, completed, total: deadlines.length, rating: score >= 80 ? 'READY' : score >= 50 ? 'NEEDS_ATTENTION' : 'AT_RISK' };
}

/* ── Mutations ─────────────────────────────────────────────────────── */

export async function markComplete(db: Db, tenantId: string, title: string, completedBy: string, notes?: string) {
  const now = new Date();
  const deadline = await db.collection(DEADLINES_COLL).findOne({ tenantId, title });
  if (!deadline) return;

  const nextDue = computeNextDueDate(deadline.frequency, deadline.dueDay, deadline.dueMonth);
  await db.collection(DEADLINES_COLL).updateOne(
    { tenantId, title },
    {
      $set: { status: 'UPCOMING', nextDueDate: nextDue, updatedAt: now },
      $push: { completionHistory: { period: now.toISOString().slice(0, 7), completedBy, completedAt: now, notes } } as Record<string, unknown>,
    },
  );
}

export async function createDeadline(db: Db, tenantId: string, data: any) {
  const now = new Date();
  await db.collection(DEADLINES_COLL).insertOne({
    ...data, tenantId, completionHistory: [], status: 'UPCOMING',
    createdAt: now, updatedAt: now,
  });
}

export async function updateDeadline(db: Db, tenantId: string, title: string, updates: any) {
  await db.collection(DEADLINES_COLL).updateOne({ tenantId, title }, { $set: { ...updates, updatedAt: new Date() } });
}

export async function calculateNitaqat(db: Db, tenantId: string, data: { totalEmployees: number; saudiEmployees: number; requiredRate: number }) {
  const rate = data.totalEmployees > 0 ? Math.round((data.saudiEmployees / data.totalEmployees) * 1000) / 10 : 0;
  let category: NitaqatCategory = 'RED';
  if (rate >= data.requiredRate + 20) category = 'PLATINUM';
  else if (rate >= data.requiredRate + 10) category = 'GREEN_HIGH';
  else if (rate >= data.requiredRate + 5) category = 'GREEN_MID';
  else if (rate >= data.requiredRate) category = 'GREEN_LOW';
  else if (rate >= data.requiredRate - 5) category = 'YELLOW';

  const gap = rate < data.requiredRate ? Math.ceil((data.requiredRate / 100) * data.totalEmployees - data.saudiEmployees) : 0;
  const recommendations: string[] = [];
  if (category === 'RED') recommendations.push('Urgent: Hire Saudi nationals to meet minimum requirement');
  if (category === 'YELLOW') recommendations.push('Increase Saudization through training/hiring programs');
  if (gap > 0) recommendations.push(`Need ${gap} more Saudi employee(s) to reach required rate`);
  if (rate >= data.requiredRate) recommendations.push('Maintain current ratio and explore growth opportunities');

  const now = new Date();
  await db.collection(NITAQAT_COLL).insertOne({
    tenantId, calculationDate: now, ...data, saudizationRate: rate, category, gap, recommendations,
  });
  return { saudizationRate: rate, category, gap, recommendations };
}

export async function runComplianceCheck(db: Db, tenantId: string) {
  const now = new Date();
  const deadlines = await db.collection(DEADLINES_COLL).find({ tenantId, status: { $ne: 'COMPLETED' } }).toArray();
  const updates: any[] = [];
  for (const d of deadlines) {
    const daysUntil = Math.ceil((new Date(d.nextDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    let newStatus: DeadlineStatus = 'UPCOMING';
    if (daysUntil < 0) newStatus = 'OVERDUE';
    else if (daysUntil <= 7) newStatus = 'DUE_SOON';
    if (newStatus !== d.status) {
      await db.collection(DEADLINES_COLL).updateOne({ _id: d._id, tenantId }, { $set: { status: newStatus, updatedAt: now } });
      updates.push({ title: d.title, oldStatus: d.status, newStatus });
    }
  }
  return { checked: deadlines.length, updated: updates.length, changes: updates };
}
