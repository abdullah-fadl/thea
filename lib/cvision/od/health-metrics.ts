/**
 * Auto-Metrics Engine for Org Health Assessment
 * Calculates metrics from live system data.
 */
import { getCVisionDb } from '../db';

export interface AutoMetrics {
  avgSpanOfControl: number;
  layersToTop: number;
  departmentsCount: number;
  avgApprovalTime: number;
  slaBreachRate: number;
  eNPS: number | null;
  voluntaryTurnoverRate: number;
  averageTenure: number;
  grievancesCount: number;
  recognitionsGiven: number;
  skillGapPercentage: number;
  successionCoverage: number;
  trainingHoursPerEmployee: number;
  compaRatioAvg: number;
  policyAcknowledgmentRate: number;
  surveyResponseRate: number;
  grievanceResolutionTime: number;
  disciplinaryActionsCount: number;
  overdueLegalDeadlines: number;
}

export async function calculateAutoMetrics(tenantId: string): Promise<AutoMetrics> {
  const db = await getCVisionDb(tenantId);

  const empCol = db.collection('cvision_employees');
  const wfCol = db.collection('cvision_workflow_instances');
  const surveyCol = db.collection('cvision_surveys');
  const surveyRespCol = db.collection('cvision_survey_responses');
  const grievCol = db.collection('cvision_grievances');
  const recCol = db.collection('cvision_recognitions');
  const succCol = db.collection('cvision_succession_plans');
  const trainCol = db.collection('cvision_training_enrollments');
  const compCol = db.collection('cvision_employee_compensation');
  const policyCol = db.collection('cvision_policies');
  const ackCol = db.collection('cvision_policy_acknowledgments');
  const complianceCol = db.collection('cvision_compliance_calendar');
  const deptCol = db.collection('cvision_departments');
  const discCol = db.collection('cvision_disciplinary');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const totalEmps = await empCol.countDocuments({ tenantId, status: { $in: ['ACTIVE', 'active'] } });
  const managers = await empCol.countDocuments({ tenantId, status: { $in: ['ACTIVE', 'active'] }, isManager: true });
  const avgSpanOfControl = managers > 0 ? Math.round((totalEmps / managers) * 10) / 10 : 0;

  const depts = await deptCol.countDocuments({ tenantId });
  let layersToTop = 0;
  try {
    const deptsArr = await deptCol.find({ tenantId }).toArray();
    const parentMap = new Map(deptsArr.map((d: any) => [d.departmentId || d.deptId, d.parentDeptId || d.parentId]));
    let maxDepth = 0;
    for (const [id] of parentMap) {
      let depth = 0; let cur = id;
      while (cur && depth < 20) { cur = parentMap.get(cur) as string; if (cur) depth++; }
      if (depth > maxDepth) maxDepth = depth;
    }
    layersToTop = maxDepth;
  } catch { layersToTop = 0; }

  // Workflow metrics (last 30 days)
  const recentWfs = await wfCol.find({ tenantId, startedAt: { $gte: thirtyDaysAgo } }).toArray();
  let totalDuration = 0; let completedCount = 0; let slaBreaches = 0;
  for (const wf of recentWfs) {
    const w = wf as Record<string, unknown>;
    if (w.completedAt && w.startedAt) {
      totalDuration += new Date(w.completedAt as string).getTime() - new Date(w.startedAt as string).getTime();
      completedCount++;
    }
    const stepHistory = (w.stepHistory || []) as Array<Record<string, unknown>>;
    const breached = stepHistory.some((s) => s.slaBreached);
    if (breached) slaBreaches++;
  }
  const avgApprovalTime = completedCount > 0 ? Math.round(totalDuration / completedCount / (60 * 60 * 1000) * 10) / 10 : 0;
  const slaBreachRate = recentWfs.length > 0 ? Math.round((slaBreaches / recentWfs.length) * 100) : 0;

  // eNPS from latest survey
  let eNPS: number | null = null;
  try {
    const latestNps = await surveyCol.findOne({ tenantId, type: { $in: ['eNPS', 'ENGAGEMENT'] }, status: 'CLOSED' }, { sort: { createdAt: -1 } }) as Record<string, unknown> | null;
    if (latestNps) {
      const responses = await surveyRespCol.find({ tenantId, surveyId: latestNps.surveyId }).toArray();
      const questions = (latestNps.questions || []) as Array<Record<string, unknown>>;
      const npsQ = questions.find((q) => q.type === 'NPS');
      if (npsQ) {
        const scores = responses.map((r) => {
          const answers = ((r as Record<string, unknown>).answers || []) as Array<Record<string, unknown>>;
          return answers.find((a) => a.questionId === npsQ.questionId)?.value;
        }).filter((v) => v != null).map(Number);
        if (scores.length > 0) {
          const promoters = scores.filter((s: number) => s >= 9).length;
          const detractors = scores.filter((s: number) => s <= 6).length;
          eNPS = Math.round(((promoters - detractors) / scores.length) * 100);
        }
      }
    }
  } catch { /* noop */ }

  // Turnover
  const resigned = await empCol.countDocuments({ tenantId, status: { $in: ['RESIGNED', 'resigned'] }, updatedAt: { $gte: oneYearAgo } });
  const voluntaryTurnoverRate = totalEmps > 0 ? Math.round((resigned / totalEmps) * 100 * 10) / 10 : 0;

  // Average tenure
  let averageTenure = 0;
  try {
    const emps = await empCol.find({ tenantId, status: { $in: ['ACTIVE', 'active'] }, deletedAt: null, $or: [{ hiredAt: { $exists: true } }, { joinDate: { $exists: true } }] }).project({ hiredAt: 1, joinDate: 1 }).limit(5000).toArray();
    if (emps.length > 0) {
      const totalYears = emps.reduce((s, e) => { const rec = e as Record<string, unknown>; const d = rec.hiredAt || rec.joinDate; return d ? s + (now.getTime() - new Date(d as string).getTime()) / (365.25 * 24 * 60 * 60 * 1000) : s; }, 0);
      averageTenure = Math.round((totalYears / emps.length) * 10) / 10;
    }
  } catch { /* noop */ }

  const grievancesCount = await grievCol.countDocuments({ tenantId, createdAt: { $gte: ninetyDaysAgo } });
  const recognitionsGiven = await recCol.countDocuments({ tenantId, status: 'APPROVED', createdAt: { $gte: ninetyDaysAgo } });

  // Succession coverage
  let successionCoverage = 0;
  try {
    const plans = await succCol.find({ tenantId, status: 'ACTIVE' }).toArray();
    const covered = plans.filter((p: any) => (p.successors || []).some((s: any) => s.readiness === 'READY_NOW')).length;
    successionCoverage = plans.length > 0 ? Math.round((covered / plans.length) * 100) : 0;
  } catch { /* noop */ }

  // Training hours
  let trainingHoursPerEmployee = 0;
  try {
    const enrollments = await trainCol.find({ tenantId, status: 'COMPLETED' }).toArray();
    trainingHoursPerEmployee = totalEmps > 0 ? Math.round((enrollments.length * 8) / totalEmps * 10) / 10 : 0;
  } catch { /* noop */ }

  // Compa ratio
  let compaRatioAvg = 0;
  try {
    const comps = await compCol.find({ tenantId }).project({ compaRatio: 1 }).toArray();
    if (comps.length > 0) compaRatioAvg = Math.round(comps.reduce((s, c) => s + (((c as Record<string, unknown>).compaRatio as number) || 100), 0) / comps.length);
  } catch { /* noop */ }

  // Policy acknowledgment
  let policyAcknowledgmentRate = 0;
  try {
    const published = await policyCol.countDocuments({ tenantId, status: 'PUBLISHED', requiresAcknowledgment: true });
    if (published > 0 && totalEmps > 0) {
      const totalAcks = await ackCol.countDocuments({ tenantId });
      policyAcknowledgmentRate = Math.round((totalAcks / (published * totalEmps)) * 100);
    }
  } catch { /* noop */ }

  // Survey response rate
  let surveyResponseRate = 0;
  try {
    const recent = await surveyCol.findOne({ tenantId, status: 'CLOSED' }, { sort: { createdAt: -1 } }) as Record<string, unknown> | null;
    if (recent) surveyResponseRate = Math.round((((recent.responseCount as number) || 0) / Math.max(totalEmps, 1)) * 100);
  } catch { /* noop */ }

  // Grievance resolution
  let grievanceResolutionTime = 0;
  try {
    const resolved = await grievCol.find({ tenantId, status: 'RESOLVED', resolutionDate: { $exists: true } }).sort({ createdAt: -1 }).limit(20).toArray();
    if (resolved.length > 0) {
      const totalTime = resolved.reduce((s, g) => { const rec = g as Record<string, unknown>; return s + (new Date(rec.resolutionDate as string).getTime() - new Date(rec.createdAt as string).getTime()); }, 0);
      grievanceResolutionTime = Math.round(totalTime / resolved.length / (24 * 60 * 60 * 1000));
    }
  } catch { /* noop */ }

  const disciplinaryActionsCount = await discCol.countDocuments({ tenantId, createdAt: { $gte: oneYearAgo } }).catch(() => 0);

  let overdueLegalDeadlines = 0;
  try { overdueLegalDeadlines = await complianceCol.countDocuments({ tenantId, status: { $ne: 'COMPLETED' }, dueDate: { $lt: now } }); } catch { /* noop */ }

  const skillGapPercentage = 0; // requires skills matrix data

  return {
    avgSpanOfControl, layersToTop, departmentsCount: depts, avgApprovalTime,
    slaBreachRate, eNPS, voluntaryTurnoverRate, averageTenure, grievancesCount,
    recognitionsGiven, skillGapPercentage, successionCoverage, trainingHoursPerEmployee,
    compaRatioAvg, policyAcknowledgmentRate, surveyResponseRate, grievanceResolutionTime,
    disciplinaryActionsCount, overdueLegalDeadlines,
  };
}
