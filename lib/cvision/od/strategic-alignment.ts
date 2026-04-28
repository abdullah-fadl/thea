/**
 * Strategic Alignment Dashboard Assembly Engine
 * Pulls data from all OD systems into a unified view.
 */
import { getCVisionDb } from '../db';

export interface AlignmentSnapshot {
  orgHealthScore: number;
  cultureScore: number;
  processEfficiency: number;
  employeeEngagement: number;
  okrCompletion: number;
  talentReadiness: number;
  changeAdoption: number;
  complianceScore: number;
}

interface MongoDoc {
  [key: string]: unknown;
}

export async function buildAlignmentDashboard(tenantId: string): Promise<AlignmentSnapshot> {
  const db = await getCVisionDb(tenantId);

  // Org Health
  let orgHealthScore = 0;
  try {
    const oha = await db.collection('cvision_org_health_assessments').findOne({ tenantId, status: 'COMPLETED' }, { sort: { assessmentDate: -1 } }) as MongoDoc | null;
    if (oha) orgHealthScore = Math.round(((oha.overallScore as number) / 5) * 100);
  } catch { /* noop */ }

  // Culture
  let cultureScore = 0;
  try {
    const ca = await db.collection('cvision_culture_assessments').findOne({ tenantId, status: 'COMPLETED' }, { sort: { createdAt: -1 } }) as MongoDoc | null;
    if (ca) cultureScore = (ca.overallScore as number) || (100 - ((ca.cultureGap as number) || 0));
  } catch { /* noop */ }

  // Process Efficiency
  let processEfficiency = 0;
  try {
    const wfCol = db.collection('cvision_workflow_instances');
    const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = await wfCol.find({ tenantId, startedAt: { $gte: thirtyDays } }).toArray() as MongoDoc[];
    const completed = recent.filter((w) => w.completedAt);
    const breaches = recent.filter((w) => ((w.stepHistory as MongoDoc[]) || []).some((s) => s.slaBreached)).length;
    processEfficiency = recent.length > 0 ? Math.round(((recent.length - breaches) / recent.length) * 100) : 100;
  } catch { /* noop */ }

  // Employee Engagement (eNPS)
  let employeeEngagement = 50;
  try {
    const survey = await db.collection('cvision_surveys').findOne({ tenantId, type: { $in: ['eNPS', 'ENGAGEMENT'] }, status: 'CLOSED' }, { sort: { createdAt: -1 } }) as MongoDoc | null;
    if (survey) {
      const responses = await db.collection('cvision_survey_responses').find({ tenantId, surveyId: survey.surveyId }).toArray() as MongoDoc[];
      const npsQ = ((survey.questions as MongoDoc[]) || []).find((q) => q.type === 'NPS');
      if (npsQ && responses.length > 0) {
        const scores = responses.map((r) => ((r.answers as MongoDoc[]) || []).find((a) => a.questionId === npsQ.questionId)?.value).filter(Boolean).map(Number);
        const promoters = scores.filter((s: number) => s >= 9).length;
        const detractors = scores.filter((s: number) => s <= 6).length;
        const nps = scores.length > 0 ? Math.round(((promoters - detractors) / scores.length) * 100) : 0;
        employeeEngagement = Math.max(0, Math.min(100, 50 + nps));
      }
    }
  } catch { /* noop */ }

  // OKR Completion
  let okrCompletion = 0;
  try {
    const okrs = await db.collection('cvision_okrs').find({ tenantId }).toArray() as MongoDoc[];
    if (okrs.length > 0) {
      okrCompletion = Math.round(okrs.reduce((s, o) => s + ((o.overallProgress as number) || 0), 0) / okrs.length);
    }
  } catch { /* noop */ }

  // Talent Readiness (succession coverage)
  let talentReadiness = 0;
  try {
    const plans = await db.collection('cvision_succession_plans').find({ tenantId, status: 'ACTIVE' }).toArray() as MongoDoc[];
    const covered = plans.filter((p) => ((p.successors as MongoDoc[]) || []).some((s) => s.readiness === 'READY_NOW')).length;
    talentReadiness = plans.length > 0 ? Math.round((covered / plans.length) * 100) : 0;
  } catch { /* noop */ }

  // Change Adoption
  let changeAdoption = 0;
  try {
    const changes = await db.collection('cvision_change_initiatives').find({ tenantId, status: 'IN_PROGRESS' }).toArray() as MongoDoc[];
    if (changes.length > 0) {
      changeAdoption = Math.round(changes.reduce((s, c) => s + ((c.adoptionRate as number) || 0), 0) / changes.length);
    }
  } catch { /* noop */ }

  // Compliance
  let complianceScore = 100;
  try {
    const total = await db.collection('cvision_compliance_calendar').countDocuments({ tenantId });
    const overdue = await db.collection('cvision_compliance_calendar').countDocuments({ tenantId, status: { $ne: 'COMPLETED' }, dueDate: { $lt: new Date() } });
    complianceScore = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;
  } catch { /* noop */ }

  return { orgHealthScore, cultureScore, processEfficiency, employeeEngagement, okrCompletion, talentReadiness, changeAdoption, complianceScore };
}
