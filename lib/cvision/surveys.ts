/**
 * CVision Employee Surveys & Feedback Engine
 *
 * Handles:
 *  - Survey creation with multiple question types
 *  - Anonymous/named responses
 *  - eNPS calculation
 *  - Response rate tracking
 *  - Sentiment analysis labels
 */

import { v4 as uuidv4 } from 'uuid';
import type { Db } from '@/lib/cvision/infra/mongo-compat';

// ── Types ───────────────────────────────────────────────────────────────

export interface Survey {
  _id?: string;
  id: string;
  tenantId: string;
  surveyId: string;
  title: string;
  description: string;
  type: 'ENGAGEMENT' | 'PULSE' | 'EXIT' | 'ONBOARDING' | 'TRAINING' | 'CUSTOM' | 'eNPS';
  questions: SurveyQuestion[];
  anonymous: boolean;
  targetAudience: 'ALL' | 'DEPARTMENT' | 'CUSTOM';
  targetDepartments?: string[];
  targetEmployeeIds?: string[];
  startDate: string;
  endDate: string;
  reminderFrequency?: 'DAILY' | 'WEEKLY' | 'NONE';
  totalInvited: number;
  totalResponded: number;
  responseRate: number;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyQuestion {
  questionId: string;
  text: string;
  type: 'RATING' | 'SCALE_1_5' | 'SCALE_1_10' | 'YES_NO' | 'MULTIPLE_CHOICE' | 'TEXT' | 'NPS';
  required: boolean;
  options?: string[];
  category?: string;
}

export interface SurveyResponse {
  _id?: string;
  id: string;
  tenantId: string;
  surveyId: string;
  respondentId?: string;
  department?: string;
  answers: { questionId: string; value: any }[];
  sentimentScore?: number;
  sentimentLabel?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  submittedAt: Date;
}

// ── Constants ───────────────────────────────────────────────────────────

export const SURVEY_TYPES = [
  { value: 'ENGAGEMENT', label: 'Employee Engagement' },
  { value: 'PULSE', label: 'Pulse Survey' },
  { value: 'EXIT', label: 'Exit Interview' },
  { value: 'ONBOARDING', label: 'Onboarding Feedback' },
  { value: 'TRAINING', label: 'Training Evaluation' },
  { value: 'eNPS', label: 'eNPS Survey' },
  { value: 'CUSTOM', label: 'Custom Survey' },
] as const;

export const QUESTION_TYPES = [
  { value: 'RATING', label: 'Star Rating (1-5)' },
  { value: 'SCALE_1_5', label: 'Scale 1-5' },
  { value: 'SCALE_1_10', label: 'Scale 1-10' },
  { value: 'YES_NO', label: 'Yes / No' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'TEXT', label: 'Free Text' },
  { value: 'NPS', label: 'NPS (0-10)' },
] as const;

export const ENPS_TEMPLATE: SurveyQuestion[] = [
  {
    questionId: 'enps_main',
    text: 'On a scale of 0-10, how likely are you to recommend this company as a place to work?',
    type: 'NPS',
    required: true,
  },
  {
    questionId: 'enps_why',
    text: 'What is the primary reason for your score?',
    type: 'TEXT',
    required: false,
  },
];

// ── eNPS Calculation ────────────────────────────────────────────────────

export function calculateENPS(scores: number[]): { enps: number; promoters: number; passives: number; detractors: number; total: number } {
  if (scores.length === 0) return { enps: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };

  const promoters = scores.filter(s => s >= 9).length;
  const passives = scores.filter(s => s >= 7 && s <= 8).length;
  const detractors = scores.filter(s => s <= 6).length;
  const total = scores.length;

  const enps = Math.round(((promoters - detractors) / total) * 100);
  return { enps, promoters, passives, detractors, total };
}

// ── CRUD ────────────────────────────────────────────────────────────────

export async function createSurvey(
  db: Db, tenantId: string, data: any,
): Promise<{ id: string; surveyId: string }> {
  const now = new Date();
  const id = uuidv4();
  const count = await db.collection('cvision_surveys').countDocuments({ tenantId });
  const surveyId = `SRV-${String(count + 1).padStart(4, '0')}`;

  let questions = data.questions || [];
  if (data.type === 'eNPS' && questions.length === 0) {
    questions = ENPS_TEMPLATE;
  }

  // Count invited
  let totalInvited = 0;
  if (data.targetAudience === 'ALL') {
    totalInvited = await db.collection('cvision_employees')
      .countDocuments({ tenantId, status: { $in: ['ACTIVE', 'Active', 'PROBATION'] } });
  } else if (data.targetEmployeeIds?.length) {
    totalInvited = data.targetEmployeeIds.length;
  }

  const doc = {
    id,
    tenantId,
    surveyId,
    title: data.title,
    description: data.description || '',
    type: data.type || 'CUSTOM',
    questions: questions.map((q: any) => ({ ...q, questionId: q.questionId || uuidv4() })),
    anonymous: data.anonymous !== false,
    targetAudience: data.targetAudience || 'ALL',
    targetDepartments: data.targetDepartments || [],
    targetEmployeeIds: data.targetEmployeeIds || [],
    startDate: data.startDate || now.toISOString().split('T')[0],
    endDate: data.endDate || '',
    reminderFrequency: data.reminderFrequency || 'NONE',
    totalInvited,
    totalResponded: 0,
    responseRate: 0,
    status: data.status || 'DRAFT',
    createdBy: data.createdBy || '',
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('cvision_surveys').insertOne(doc);
  return { id, surveyId };
}

export async function publishSurvey(
  db: Db, tenantId: string, surveyId: string,
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const result = await db.collection('cvision_surveys').updateOne(
    { tenantId, $or: [{ id: surveyId }, { surveyId }], status: 'DRAFT' },
    { $set: { status: 'ACTIVE', startDate: now.toISOString().split('T')[0], updatedAt: now } },
  );
  if (result.modifiedCount === 0) return { success: false, error: 'Survey not found or not in draft' };
  return { success: true };
}

export async function closeSurvey(
  db: Db, tenantId: string, surveyId: string,
): Promise<{ success: boolean }> {
  const now = new Date();
  await db.collection('cvision_surveys').updateOne(
    { tenantId, $or: [{ id: surveyId }, { surveyId }] },
    { $set: { status: 'CLOSED', endDate: now.toISOString().split('T')[0], updatedAt: now } },
  );
  return { success: true };
}

export async function submitResponse(
  db: Db, tenantId: string, surveyId: string, data: any,
): Promise<{ success: boolean; error?: string }> {
  const survey = await db.collection('cvision_surveys').findOne({
    tenantId, $or: [{ id: surveyId }, { surveyId }],
  });
  if (!survey) return { success: false, error: 'Survey not found' };
  if (survey.status !== 'ACTIVE') return { success: false, error: 'Survey is not active' };

  // Check duplicate (if not anonymous)
  if (!survey.anonymous && data.respondentId) {
    const existing = await db.collection('cvision_survey_responses').findOne({
      tenantId, surveyId: survey.surveyId, respondentId: data.respondentId,
    });
    if (existing) return { success: false, error: 'Already responded' };
  }

  // Simple sentiment for text answers
  let sentimentScore = 0;
  let sentimentLabel: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' = 'NEUTRAL';
  const textAnswers = (data.answers || []).filter((a: any) => typeof a.value === 'string' && a.value.length > 10);
  if (textAnswers.length > 0) {
    // Very basic — count positive/negative words
    const text = textAnswers.map((a: any) => a.value).join(' ').toLowerCase();
    const posWords = ['great', 'excellent', 'good', 'amazing', 'love', 'happy', 'satisfied', 'wonderful', 'best', 'fantastic'];
    const negWords = ['bad', 'terrible', 'poor', 'hate', 'unhappy', 'dissatisfied', 'worst', 'awful', 'horrible', 'frustrating'];
    const posCount = posWords.filter(w => text.includes(w)).length;
    const negCount = negWords.filter(w => text.includes(w)).length;
    sentimentScore = (posCount - negCount) / Math.max(1, posCount + negCount);
    sentimentLabel = sentimentScore > 0.2 ? 'POSITIVE' : sentimentScore < -0.2 ? 'NEGATIVE' : 'NEUTRAL';
  }

  const now = new Date();
  await db.collection('cvision_survey_responses').insertOne({
    id: uuidv4(),
    tenantId,
    surveyId: survey.surveyId,
    respondentId: survey.anonymous ? null : (data.respondentId || null),
    department: data.department || null,
    answers: data.answers || [],
    sentimentScore,
    sentimentLabel,
    submittedAt: now,
  });

  // Update counts
  const totalResponded = await db.collection('cvision_survey_responses')
    .countDocuments({ tenantId, surveyId: survey.surveyId });
  const responseRate = survey.totalInvited > 0 ? Math.round((totalResponded / survey.totalInvited) * 100) : 0;

  await db.collection('cvision_surveys').updateOne(
    { tenantId, _id: survey._id },
    { $set: { totalResponded, responseRate, updatedAt: now } },
  );

  return { success: true };
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function listSurveys(
  db: Db, tenantId: string, filters: { status?: string } = {},
): Promise<any[]> {
  const query: any = { tenantId };
  if (filters.status) query.status = filters.status;
  return db.collection('cvision_surveys').find(query).sort({ createdAt: -1 }).limit(200).toArray();
}

export async function getSurveyResults(
  db: Db, tenantId: string, surveyId: string,
): Promise<any> {
  const survey = await db.collection('cvision_surveys').findOne({
    tenantId, $or: [{ id: surveyId }, { surveyId }],
  });
  if (!survey) return null;

  const responses = await db.collection('cvision_survey_responses')
    .find({ tenantId, surveyId: survey.surveyId }).toArray();

  // Aggregate per question
  const questionResults = (survey.questions || []).map((q: any) => {
    const answers = responses.map((r: any) => {
      const ans = (r.answers || []).find((a: any) => a.questionId === q.questionId);
      return ans?.value;
    }).filter((v: any) => v !== undefined && v !== null);

    let avg = 0;
    if (['RATING', 'SCALE_1_5', 'SCALE_1_10', 'NPS'].includes(q.type)) {
      const nums = answers.filter((v: any) => typeof v === 'number') as number[];
      avg = nums.length ? +(nums.reduce((s: number, n: number) => s + n, 0) / nums.length).toFixed(1) : 0;
    }

    return { ...q, answers, count: answers.length, average: avg };
  });

  // eNPS if applicable
  let enps = null;
  const npsQuestion = (survey.questions || []).find((q: any) => q.type === 'NPS');
  if (npsQuestion) {
    const npsScores = responses
      .map((r: any) => (r.answers || []).find((a: any) => a.questionId === npsQuestion.questionId)?.value)
      .filter((v: any) => typeof v === 'number') as number[];
    enps = calculateENPS(npsScores);
  }

  // Sentiment
  const sentiments = responses.filter((r: any) => r.sentimentLabel);
  const sentimentBreakdown = {
    positive: sentiments.filter((r: any) => r.sentimentLabel === 'POSITIVE').length,
    neutral: sentiments.filter((r: any) => r.sentimentLabel === 'NEUTRAL').length,
    negative: sentiments.filter((r: any) => r.sentimentLabel === 'NEGATIVE').length,
  };

  return {
    survey,
    totalResponses: responses.length,
    questionResults,
    enps,
    sentimentBreakdown,
  };
}

export async function getStats(db: Db, tenantId: string) {
  const surveys = await db.collection('cvision_surveys').find({ tenantId }).toArray();
  const active = surveys.filter((s: any) => s.status === 'ACTIVE').length;
  const totalResponses = surveys.reduce((s: number, sv: any) => s + (sv.totalResponded || 0), 0);
  const avgRate = surveys.filter((s: any) => s.totalInvited > 0).length
    ? Math.round(surveys.filter((s: any) => s.totalInvited > 0).reduce((s: number, sv: any) => s + (sv.responseRate || 0), 0) / surveys.filter((s: any) => s.totalInvited > 0).length)
    : 0;

  return {
    totalSurveys: surveys.length,
    activeSurveys: active,
    totalResponses,
    avgResponseRate: avgRate,
    draft: surveys.filter((s: any) => s.status === 'DRAFT').length,
    closed: surveys.filter((s: any) => s.status === 'CLOSED').length,
  };
}
