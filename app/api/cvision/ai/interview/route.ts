import { logger } from '@/lib/monitoring/logger';
/**
 * CVision AI Interview API
 * GET  /api/cvision/ai/interview  - Question bank, plans, assessments, duration
 * POST /api/cvision/ai/interview  - Generate plans, evaluate answers, assessments, compare
 *
 * AI analysis layer for structured interviews. Complements the existing
 * operational interview route at /api/cvision/recruitment/candidates/[id]/interviews/.
 * Wires the interview-engine (lib/cvision/ai/interview-engine.ts) to the database
 * and integrates AI governance decision logging for interview scoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  getCVisionDb,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionCandidate,
  CVisionJobRequisition,
  CVisionCvParseJob,
} from '@/lib/cvision/types';
import {
  generateInterviewPlan,
  evaluateAnswer,
  generateAssessment,
  getQuestionsByCategory,
  calculateInterviewDuration,
  CATEGORY_DISTRIBUTION_TEMPLATES,
  QUESTION_BANK,
  type InterviewQuestionCategory,
  type InterviewPlan,
  type AnswerEvaluation,
  type InterviewAssessment,
  type InterviewQuestion,
} from '@/lib/cvision/ai/interview-engine';
import {
  createDecisionLog,
  DEFAULT_GOVERNANCE_CONFIG,
  type GovernanceConfig,
} from '@/lib/cvision/ai/ai-governance';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Constants ──────────────────────────────────────────────────────────────

const INTERVIEWS_COLLECTION = 'cvision_interviews';
const AI_DECISIONS_COLLECTION = 'cvision_ai_decisions';

const VALID_CATEGORIES: InterviewQuestionCategory[] = [
  'TECHNICAL',
  'BEHAVIORAL',
  'SITUATIONAL',
  'CULTURAL_FIT',
  'MOTIVATION',
  'PROBLEM_SOLVING',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Generates a simple unique ID with a prefix.
 */
function generateId(prefix = 'iv'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Builds a GovernanceConfig from defaults for decision logging.
 */
function buildGovernanceConfig(
  tenantId: string,
  userId: string
): GovernanceConfig {
  return {
    ...DEFAULT_GOVERNANCE_CONFIG,
    tenantId,
    updatedAt: new Date(),
    updatedBy: userId,
  };
}

/**
 * Normalizes the flexible `skills` field from a CVisionJobRequisition.
 * Handles string[], { required: [], preferred: [] }, or null.
 */
function extractSkillsFromJob(job: any): string[] {
  if (!job.skills) return [];
  if (Array.isArray(job.skills)) {
    return job.skills.filter((s: unknown) => typeof s === 'string') as string[];
  }
  const jobSkills = job.skills as Record<string, unknown>;
  const skills: string[] = [];
  if (Array.isArray(jobSkills?.required)) {
    skills.push(
      ...jobSkills.required.filter((s: unknown) => typeof s === 'string') as string[]
    );
  }
  if (Array.isArray(jobSkills?.preferred)) {
    skills.push(
      ...jobSkills.preferred.filter((s: unknown) => typeof s === 'string') as string[]
    );
  }
  return skills;
}

/**
 * Maps years of experience to the engine's experience level.
 */
function determineExperienceLevel(
  years: number | undefined
): 'entry_level' | 'technical' | 'managerial' | 'executive' {
  if (years === undefined || years < 2) return 'entry_level';
  if (years <= 5) return 'technical';
  if (years <= 10) return 'managerial';
  return 'executive';
}

/**
 * Parses a duration string like "2020-2023" or "3 years" into a number.
 */
function parseDuration(duration: string | undefined | null): number {
  if (!duration) return 1;
  const str = String(duration).trim();
  const rangeMatch = str.match(
    /(\d{4})\s*[-–]\s*(\d{4}|present|current|now)/i
  );
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1]);
    const endYear = rangeMatch[2].match(/\d{4}/)
      ? parseInt(rangeMatch[2])
      : new Date().getFullYear();
    return Math.max(1, endYear - startYear);
  }
  const numMatch = str.match(/(\d+)/);
  if (numMatch) return Math.max(1, parseInt(numMatch[1]));
  return 1;
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      const db = await getCVisionDb(tenantId);
      const interviewsCol = db.collection(INTERVIEWS_COLLECTION);

      // ── action=question-bank ──────────────────────────────────────
      if (action === 'question-bank') {
        const category = searchParams.get('category') as InterviewQuestionCategory | null;
        const countParam = searchParams.get('count');
        const count = countParam ? parseInt(countParam, 10) || undefined : undefined;

        if (category) {
          if (!VALID_CATEGORIES.includes(category)) {
            return NextResponse.json(
              {
                success: false,
                error: `Invalid category. Valid: ${VALID_CATEGORIES.join(', ')}`,
              },
              { status: 400 }
            );
          }
          const questions = getQuestionsByCategory(category, count);
          return NextResponse.json({
            success: true,
            data: {
              category,
              questions,
              totalAvailable: questions.length,
            },
          });
        }

        // Return all categories with counts
        const categorySummary = VALID_CATEGORIES.map((cat) => {
          const qs = getQuestionsByCategory(cat);
          return { category: cat, count: qs.length };
        });

        return NextResponse.json({
          success: true,
          data: {
            categories: categorySummary,
            totalAvailable: QUESTION_BANK.length,
            distributionTemplates: Object.keys(CATEGORY_DISTRIBUTION_TEMPLATES),
          },
        });
      }

      // ── action=plan ───────────────────────────────────────────────
      if (action === 'plan') {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json(
            {
              success: false,
              error: 'id parameter is required',
            },
            { status: 400 }
          );
        }

        const plan = await interviewsCol.findOne({
          tenantId,
          id,
          type: 'PLAN',
        });
        if (!plan) {
          return NextResponse.json(
            {
              success: false,
              error: 'Interview plan not found',
            },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: plan });
      }

      // ── action=plans ──────────────────────────────────────────────
      if (action === 'plans') {
        const limit = Math.min(
          parseInt(searchParams.get('limit') || '20', 10) || 20,
          100
        );
        const page = Math.max(
          parseInt(searchParams.get('page') || '1', 10) || 1,
          1
        );
        const skip = (page - 1) * limit;
        const jobTitle = searchParams.get('jobTitle');
        const department = searchParams.get('department');

        const filter: Record<string, any> = { tenantId, type: 'PLAN' };
        if (jobTitle) {
          const escapedJobTitle = jobTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          filter.jobTitle = { $regex: escapedJobTitle, $options: 'i' };
        }
        if (department) {
          filter.department = department;
        }

        const [plans, total] = await Promise.all([
          interviewsCol
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
          interviewsCol.countDocuments(filter),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            plans,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      }

      // ── action=assessment ─────────────────────────────────────────
      if (action === 'assessment') {
        const id = searchParams.get('id');
        if (!id) {
          return NextResponse.json(
            {
              success: false,
              error: 'id parameter is required',
            },
            { status: 400 }
          );
        }

        const assessment = await interviewsCol.findOne({
          tenantId,
          id,
          type: 'ASSESSMENT',
        });
        if (!assessment) {
          return NextResponse.json(
            {
              success: false,
              error: 'Assessment not found',
            },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: assessment });
      }

      // ── action=candidate-assessments ──────────────────────────────
      if (action === 'candidate-assessments') {
        const candidateId = searchParams.get('candidateId');
        if (!candidateId) {
          return NextResponse.json(
            {
              success: false,
              error: 'candidateId parameter is required',
            },
            { status: 400 }
          );
        }

        const assessments = await interviewsCol
          .find({ tenantId, candidateId, type: 'ASSESSMENT' })
          .sort({ createdAt: -1 })
          .toArray();

        return NextResponse.json({
          success: true,
          data: {
            candidateId,
            assessments,
            totalInterviews: assessments.length,
          },
        });
      }

      // ── action=duration ───────────────────────────────────────────
      if (action === 'duration') {
        const planId = searchParams.get('planId');
        if (!planId) {
          return NextResponse.json(
            {
              success: false,
              error: 'planId parameter is required',
            },
            { status: 400 }
          );
        }

        const plan = await interviewsCol.findOne({
          tenantId,
          id: planId,
          type: 'PLAN',
        });
        if (!plan) {
          return NextResponse.json(
            {
              success: false,
              error: 'Interview plan not found',
            },
            { status: 404 }
          );
        }

        const duration = calculateInterviewDuration(plan as InterviewPlan);

        return NextResponse.json({
          success: true,
          data: {
            planId,
            jobTitle: plan.jobTitle,
            ...duration,
          },
        });
      }

      // ── Default: API documentation ────────────────────────────────
      return NextResponse.json({
        success: true,
        data: {
          name: 'CVision AI Interview API',
          version: '1.0',
          endpoints: {
            GET: {
              'action=question-bank&category=TECHNICAL&count=3':
                'Browse question bank (optional: category, count)',
              'action=plan&id=plan_xxx':
                'Fetch a single interview plan',
              'action=plans&jobTitle=Engineer&department=dept-id&limit=10&page=1':
                'List interview plans (optional: jobTitle, department, pagination)',
              'action=assessment&id=asmt_xxx':
                'Fetch a single assessment',
              'action=candidate-assessments&candidateId=cand-xxx':
                'All assessments for a candidate',
              'action=duration&planId=plan_xxx':
                'Calculate interview duration breakdown',
            },
            POST: {
              'generate-plan':
                'Generate an interview plan (required: jobTitle)',
              'generate-plan-for-candidate':
                'Generate a plan for a specific candidate + job (required: candidateId, jobId)',
              'evaluate-answer':
                'Evaluate a single answer (required: questionId, planId, answer)',
              'evaluate-all':
                'Evaluate all answers for a plan (required: planId, answers[])',
              'generate-assessment':
                'Full assessment pipeline (required: candidateId, planId, answers[])',
              'compare-candidates':
                'Compare multiple assessments (required: assessmentIds[])',
            },
          },
          categories: VALID_CATEGORIES,
          experienceLevels: ['entry_level', 'technical', 'managerial', 'executive'],
        },
      });
    } catch (error: unknown) {
      logger.error('[Interview AI API GET]', error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
  {
    platformKey: 'cvision',
    permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ,
  }
);

// ─── POST Handler ───────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const db = await getCVisionDb(tenantId);
      const interviewsCol = db.collection(INTERVIEWS_COLLECTION);

      // ── action=generate-plan ──────────────────────────────────────
      if (action === 'generate-plan') {
        const {
          jobTitle,
          department = 'General',
          requiredSkills: bodySkills,
          experienceLevel,
          totalQuestions,
        } = body;

        if (!jobTitle) {
          return NextResponse.json(
            {
              success: false,
              error: 'jobTitle is required',
            },
            { status: 400 }
          );
        }

        // Auto-fetch skills if not provided
        let requiredSkills: string[] = bodySkills || [];
        if (requiredSkills.length === 0) {
          try {
            const jtCol = await getCVisionCollection<any>(
              tenantId,
              'jobTitles'
            );
            const escapedJT = jobTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const jobTitleDoc = await jtCol.findOne(
              createTenantFilter(tenantId, {
                name: { $regex: `^${escapedJT}$`, $options: 'i' },
                isActive: true,
              })
            );
            if (
              jobTitleDoc?.requirements &&
              Array.isArray(jobTitleDoc.requirements)
            ) {
              requiredSkills = jobTitleDoc.requirements.filter(
                (r: unknown) => typeof r === 'string' && r.trim()
              );
            }
          } catch {
            // Non-critical
          }
        }

        const plan = generateInterviewPlan({
          jobTitle,
          department,
          requiredSkills,
          experienceLevel,
          totalQuestions: totalQuestions || 10,
        });

        // Save to DB
        const docToSave = {
          ...plan,
          id: plan.id,
          tenantId,
          type: 'PLAN' as const,
          createdBy: userId,
          createdAt: new Date(),
        };
        await interviewsCol.insertOne(docToSave);

        return NextResponse.json(
          { success: true, data: { plan: docToSave } },
          { status: 201 }
        );
      }

      // ── action=generate-plan-for-candidate ────────────────────────
      if (action === 'generate-plan-for-candidate') {
        const { candidateId, jobId, totalQuestions } = body;

        if (!candidateId || !jobId) {
          return NextResponse.json(
            {
              success: false,
              error: 'candidateId and jobId are required',
            },
            { status: 400 }
          );
        }

        // Fetch candidate
        const candidatesCol = await getCVisionCollection<CVisionCandidate>(
          tenantId,
          'candidates'
        );
        const candidate = await findById(candidatesCol, tenantId, candidateId);
        if (!candidate) {
          return NextResponse.json(
            {
              success: false,
              error: 'Candidate not found',
            },
            { status: 404 }
          );
        }

        // Fetch job requisition
        const jobsCol = await getCVisionCollection<CVisionJobRequisition>(
          tenantId,
          'jobRequisitions'
        );
        const job = await findById(jobsCol, tenantId, jobId);
        if (!job) {
          return NextResponse.json(
            {
              success: false,
              error: 'Job requisition not found',
            },
            { status: 404 }
          );
        }

        // Fetch latest CV parse job for experience data
        let totalYears: number | undefined;
        try {
          const parseCol = await getCVisionCollection<CVisionCvParseJob>(
            tenantId,
            'cvParseJobs'
          );
          const parseJobs = await parseCol
            .find(
              createTenantFilter(tenantId, {
                candidateId,
                status: 'DONE',
              })
            )
            .sort({ completedAt: -1 })
            .limit(1)
            .toArray();

          const latestParse = parseJobs[0];
          const extracted = latestParse?.extractedJson || latestParse?.metaJson || {};

          if (extracted.yearsOfExperience) {
            totalYears = Number(extracted.yearsOfExperience);
          } else if (Array.isArray(extracted.experience)) {
            totalYears = extracted.experience.reduce(
              (sum: number, e: any) => sum + parseDuration(e.duration as string | undefined),
              0
            );
          }
        } catch {
          // Non-critical: proceed without experience data
        }

        const experienceLevel = determineExperienceLevel(totalYears);
        const requiredSkills = extractSkillsFromJob(job);

        const plan = generateInterviewPlan({
          jobTitle: job.title,
          department: job.departmentId,
          requiredSkills,
          experienceLevel,
          totalQuestions: totalQuestions || 10,
        });

        // Save with candidate and job refs
        const docToSave = {
          ...plan,
          id: plan.id,
          tenantId,
          type: 'PLAN' as const,
          candidateId,
          jobId,
          candidateName: candidate.fullName,
          createdBy: userId,
          createdAt: new Date(),
        };
        await interviewsCol.insertOne(docToSave);

        return NextResponse.json(
          {
            success: true,
            data: {
              plan: docToSave,
              candidateName: candidate.fullName,
              experienceLevel,
              experienceYears: totalYears,
              skillsUsed: requiredSkills,
            },
          },
          { status: 201 }
        );
      }

      // ── action=evaluate-answer ────────────────────────────────────
      if (action === 'evaluate-answer') {
        const { questionId, planId, answer, candidateName, candidateExperience } =
          body;

        if (!questionId || !planId || !answer) {
          return NextResponse.json(
            {
              success: false,
              error: 'questionId, planId, and answer are required',
            },
            { status: 400 }
          );
        }

        if (typeof answer !== 'string' || answer.trim().length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'Answer text is required',
            },
            { status: 400 }
          );
        }

        // Fetch plan
        const plan = await interviewsCol.findOne({
          tenantId,
          id: planId,
          type: 'PLAN',
        });
        if (!plan) {
          return NextResponse.json(
            {
              success: false,
              error: 'Interview plan not found',
            },
            { status: 404 }
          );
        }

        // Find question in plan
        const questions: InterviewQuestion[] = plan.questions || [];
        const question = questions.find((q) => q.id === questionId);
        if (!question) {
          return NextResponse.json(
            {
              success: false,
              error: 'Question not found in plan',
            },
            { status: 404 }
          );
        }

        const candidateContext =
          candidateName || candidateExperience
            ? {
                name: candidateName || '',
                experience: candidateExperience || 0,
              }
            : undefined;

        const evaluation = evaluateAnswer({
          question,
          answer,
          candidateContext,
        });

        return NextResponse.json({
          success: true,
          data: { evaluation },
        });
      }

      // ── action=evaluate-all ───────────────────────────────────────
      if (action === 'evaluate-all') {
        const { planId, answers, candidateId, candidateName } = body;

        if (!planId || !Array.isArray(answers) || answers.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'planId and answers[] are required',
            },
            { status: 400 }
          );
        }

        // Fetch plan
        const plan = await interviewsCol.findOne({
          tenantId,
          id: planId,
          type: 'PLAN',
        });
        if (!plan) {
          return NextResponse.json(
            {
              success: false,
              error: 'Interview plan not found',
            },
            { status: 404 }
          );
        }

        // Build question lookup
        const questionMap = new Map<string, InterviewQuestion>();
        for (const q of (plan.questions || []) as InterviewQuestion[]) {
          questionMap.set(q.id, q);
        }

        const evaluations: AnswerEvaluation[] = [];
        const skipped: string[] = [];

        for (const entry of answers) {
          const { questionId, answer } = entry;
          const question = questionMap.get(questionId);
          if (!question) {
            skipped.push(questionId);
            continue;
          }
          if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
            skipped.push(questionId);
            continue;
          }

          const evaluation = evaluateAnswer({ question, answer });
          evaluations.push(evaluation);
        }

        const averageScore =
          evaluations.length > 0
            ? Math.round(
                evaluations.reduce((sum, e) => sum + e.percentage, 0) /
                  evaluations.length
              )
            : 0;

        return NextResponse.json({
          success: true,
          data: {
            evaluations,
            averageScore,
            totalEvaluated: evaluations.length,
            totalSkipped: skipped.length,
            skippedQuestionIds: skipped,
          },
        });
      }

      // ── action=generate-assessment ────────────────────────────────
      if (action === 'generate-assessment') {
        const { candidateId, planId, answers } = body;

        if (
          !candidateId ||
          !planId ||
          !Array.isArray(answers) ||
          answers.length === 0
        ) {
          return NextResponse.json(
            {
              success: false,
              error: 'candidateId, planId, and answers[] are required',
            },
            { status: 400 }
          );
        }

        // Fetch candidate
        const candidatesCol = await getCVisionCollection<CVisionCandidate>(
          tenantId,
          'candidates'
        );
        const candidate = await findById(candidatesCol, tenantId, candidateId);
        if (!candidate) {
          return NextResponse.json(
            {
              success: false,
              error: 'Candidate not found',
            },
            { status: 404 }
          );
        }

        // Fetch plan
        const plan = await interviewsCol.findOne({
          tenantId,
          id: planId,
          type: 'PLAN',
        });
        if (!plan) {
          return NextResponse.json(
            {
              success: false,
              error: 'Interview plan not found',
            },
            { status: 404 }
          );
        }

        // Build question lookup
        const questionMap = new Map<string, InterviewQuestion>();
        for (const q of (plan.questions || []) as InterviewQuestion[]) {
          questionMap.set(q.id, q);
        }

        // Evaluate all answers
        const evaluations: AnswerEvaluation[] = [];
        for (const entry of answers) {
          const { questionId, answer } = entry;
          const question = questionMap.get(questionId);
          if (!question || !answer || typeof answer !== 'string') continue;
          evaluations.push(evaluateAnswer({ question, answer }));
        }

        if (evaluations.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error: 'No valid answers could be evaluated',
            },
            { status: 400 }
          );
        }

        // Generate assessment
        const candidateName = candidate.fullName || candidateId;
        const assessment = generateAssessment({
          candidateId,
          candidateName,
          interviewPlan: plan as InterviewPlan,
          evaluations,
        });

        // Log AI governance decision
        let decisionLogId: string | null = null;
        let decisionStatus: string | null = null;
        try {
          const govConfig = buildGovernanceConfig(tenantId, userId);
          const decId = generateId('dec');
          const decisionLog = createDecisionLog({
            id: decId,
            tenantId,
            decisionType: 'INTERVIEW_SCORING',
            confidence: assessment.overallScore,
            subjectId: candidateId,
            subjectType: 'CANDIDATE',
            inputSnapshot: {
              planId,
              answersCount: answers.length,
              evaluatedCount: evaluations.length,
              jobTitle: plan.jobTitle,
            },
            outputSnapshot: {
              overallScore: assessment.overallScore,
              recommendation: assessment.recommendation,
              categoryScores: assessment.categoryScores,
              strengthsCount: assessment.strengths.length,
              concernsCount: assessment.concerns.length,
            },
            config: govConfig,
            createdBy: userId,
          });

          await db
            .collection(AI_DECISIONS_COLLECTION)
            .insertOne({ ...decisionLog, tenantId });

          decisionLogId = decId;
          decisionStatus = decisionLog.status;
        } catch (e) {
          logger.error(
            '[Interview AI API] Failed to log governance decision:',
            e
          );
          // Non-critical
        }

        // Save assessment to DB
        const assessmentId = generateId('asmt');
        const assessmentDoc = {
          id: assessmentId,
          tenantId,
          type: 'ASSESSMENT' as const,
          candidateId,
          candidateName,
          planId,
          ...assessment,
          decisionLogId,
          createdBy: userId,
          createdAt: new Date(),
        };
        await interviewsCol.insertOne(assessmentDoc);

        return NextResponse.json(
          {
            success: true,
            data: {
              assessment: assessmentDoc,
              decisionLogId,
              decisionStatus,
            },
          },
          { status: 201 }
        );
      }

      // ── action=compare-candidates ─────────────────────────────────
      if (action === 'compare-candidates') {
        const { assessmentIds } = body;

        if (!Array.isArray(assessmentIds) || assessmentIds.length < 2) {
          return NextResponse.json(
            {
              success: false,
              error: 'assessmentIds must be an array with at least 2 IDs',
            },
            { status: 400 }
          );
        }

        if (assessmentIds.length > 5) {
          return NextResponse.json(
            {
              success: false,
              error: 'Maximum 5 assessments can be compared at once',
            },
            { status: 400 }
          );
        }

        // Fetch all assessments
        const assessments = await interviewsCol
          .find({
            tenantId,
            id: { $in: assessmentIds },
            type: 'ASSESSMENT',
          })
          .toArray();

        if (assessments.length < 2) {
          const foundIds = assessments.map((a) => a.id);
          const missingIds = assessmentIds.filter(
            (id: string) => !foundIds.includes(id)
          );
          return NextResponse.json(
            {
              success: false,
              error: `Not enough assessments found. Missing: ${missingIds.join(', ')}`,
            },
            { status: 404 }
          );
        }

        // Sort by overall score descending
        const ranked = [...assessments].sort(
          (a, b) => (Number((b as Record<string, unknown>).overallScore) || 0) - (Number((a as Record<string, unknown>).overallScore) || 0)
        );

        const rankings = ranked.map((a, idx: number) => ({
          rank: idx + 1,
          assessmentId: a.id,
          candidateId: a.candidateId,
          candidateName: a.candidateName,
          overallScore: a.overallScore,
          recommendation: a.recommendation,
          jobTitle: a.jobTitle,
        }));

        // Identify category winners
        const categoryWinners: Record<
          string,
          {
            candidateId: string;
            candidateName: string;
            percentage: number;
          }
        > = {};

        for (const cat of VALID_CATEGORIES) {
          let bestCandidate: Record<string, unknown> | null = null;
          let bestPercentage = -1;

          for (const a of assessments) {
            const categoryScores = (a as Record<string, unknown>).categoryScores as Record<string, Record<string, unknown>> | undefined;
            const catScore = categoryScores?.[cat] as Record<string, unknown> | undefined;
            const pct = Number(catScore?.percentage || 0);
            if (pct > bestPercentage) {
              bestPercentage = pct;
              bestCandidate = a as Record<string, unknown>;
            }
          }

          if (bestCandidate) {
            categoryWinners[cat] = {
              candidateId: String(bestCandidate.candidateId),
              candidateName: String(bestCandidate.candidateName),
              percentage: bestPercentage,
            };
          }
        }

        return NextResponse.json({
          success: true,
          data: {
            rankings,
            categoryWinners,
            totalCompared: assessments.length,
            topCandidate: rankings[0] || null,
          },
        });
      }

      // ── Unknown action ────────────────────────────────────────────
      return NextResponse.json(
        {
          success: false,
          error: `Invalid action: ${action || 'none'}. Valid actions: generate-plan, generate-plan-for-candidate, evaluate-answer, evaluate-all, generate-assessment, compare-candidates`,
        },
        { status: 400 }
      );
    } catch (error: unknown) {
      logger.error('[Interview AI API POST]', error instanceof Error ? error.message : String(error));
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
  {
    platformKey: 'cvision',
    permissionKey: CVISION_PERMISSIONS.RECRUITMENT_WRITE,
  }
);
