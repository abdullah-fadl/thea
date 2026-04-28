/**
 * CVision Career Page + Referral Engine
 * Public job listings, applications, employee referral tracking
 */
import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

export const REFERRAL_STATUSES = ['SUBMITTED', 'SCREENING', 'INTERVIEW', 'HIRED', 'REJECTED'] as const;

const JOB_COL = 'cvision_job_requisitions';
const CAND_COL = 'cvision_candidates';
const REF_COL = 'cvision_referrals';

// ── Public Career Page (no auth) ────────────────────────────────────────

export async function getPublicJobs(db: Db, tenantId: string): Promise<any[]> {
  return db.collection(JOB_COL).find({
    tenantId, status: 'OPEN', publishToCareerPage: true,
  }, {
    projection: { title: 1, department: 1, departmentName: 1, location: 1, type: 1, description: 1, requirements: 1, benefits: 1, createdAt: 1, id: 1 },
  }).sort({ createdAt: -1 }).toArray();
}

export async function getPublicJobDetail(db: Db, tenantId: string, jobId: string): Promise<any> {
  return db.collection(JOB_COL).findOne({ tenantId, id: jobId, status: 'OPEN' }, {
    projection: { title: 1, department: 1, departmentName: 1, location: 1, type: 1, description: 1, requirements: 1, benefits: 1, createdAt: 1, id: 1 },
  });
}

export async function applyForJob(db: Db, tenantId: string, data: any): Promise<{ candidateId: string }> {
  const id = uuidv4();
  await db.collection(CAND_COL).insertOne({
    id, tenantId, requisitionId: data.jobId,
    firstName: data.firstName, lastName: data.lastName,
    email: data.email, phone: data.phone,
    resumeUrl: data.resumeUrl,
    source: data.referralCode ? 'REFERRAL' : 'CAREER_PAGE',
    referralCode: data.referralCode,
    stage: 'APPLIED', status: 'NEW',
    createdAt: new Date(), updatedAt: new Date(),
  });
  // Update referral if applicable
  if (data.referralCode) {
    await db.collection(REF_COL).updateOne(
      { tenantId, referralCode: data.referralCode },
      { $set: { candidateId: id, candidateName: `${data.firstName} ${data.lastName}`, status: 'SCREENING' } },
    );
  }
  return { candidateId: id };
}

export async function getCompanyInfo(db: Db, tenantId: string): Promise<any> {
  const settings = await db.collection('cvision_tenant_settings').findOne({ tenantId });
  return settings?.company || { name: 'Company', description: '' };
}

// ── Referrals (auth required) ───────────────────────────────────────────

export async function createReferral(db: Db, tenantId: string, data: any): Promise<{ referralCode: string }> {
  const id = uuidv4();
  const referralCode = `REF-${data.referrerId?.slice(-4) || 'XXXX'}-${Date.now().toString(36).toUpperCase()}`;
  await db.collection(REF_COL).insertOne({
    id, tenantId, referralId: `RREF-${Date.now()}`,
    referrerId: data.referrerId, referrerName: data.referrerName,
    candidateId: '', candidateName: data.candidateName || '',
    jobId: data.jobId, jobTitle: data.jobTitle,
    referralCode, status: 'SUBMITTED',
    bonusEligible: false, bonusPaid: false,
    createdAt: new Date(),
  });
  return { referralCode };
}

export async function updateReferralStatus(db: Db, tenantId: string, referralId: string, status: string): Promise<{ success: boolean }> {
  const updates: any = { status };
  if (status === 'HIRED') updates.bonusEligible = true;
  await db.collection(REF_COL).updateOne({ tenantId, $or: [{ id: referralId }, { referralId }] }, { $set: updates });
  return { success: true };
}

export async function payReferralBonus(db: Db, tenantId: string, referralId: string, amount: number): Promise<{ success: boolean }> {
  await db.collection(REF_COL).updateOne({ tenantId, $or: [{ id: referralId }, { referralId }] }, {
    $set: { bonusPaid: true, bonusAmount: amount, bonusPaidDate: new Date() },
  });
  return { success: true };
}

export async function listReferrals(db: Db, tenantId: string, filters: any = {}): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  if (filters.referrerId) query.referrerId = filters.referrerId;
  return db.collection(REF_COL).find(query).sort({ createdAt: -1 }).toArray();
}

export async function getMyReferrals(db: Db, tenantId: string, referrerId: string): Promise<any[]> {
  return db.collection(REF_COL).find({ tenantId, referrerId }).sort({ createdAt: -1 }).toArray();
}

export async function getReferralStats(db: Db, tenantId: string) {
  const total = await db.collection(REF_COL).countDocuments({ tenantId });
  const hired = await db.collection(REF_COL).countDocuments({ tenantId, status: 'HIRED' });
  const pending = await db.collection(REF_COL).countDocuments({ tenantId, status: { $in: ['SUBMITTED', 'SCREENING', 'INTERVIEW'] } });
  const bonusesPaid = await db.collection(REF_COL).countDocuments({ tenantId, bonusPaid: true });
  return { totalReferrals: total, hired, pending, bonusesPaid };
}
