import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Smart Job Recommender API
 * GET  /api/cvision/ai/recommend  — stats / docs
 * POST /api/cvision/ai/recommend  — match candidates ↔ jobs
 *
 * Uses the same AI engine as CV Inbox (OpenAI gpt-4o-mini / Claude) for
 * high-quality, differentiated match results.
 * Falls back to the deterministic scoring engine when no AI provider is available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
  findById,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import type {
  CVisionCandidate,
  CVisionJobRequisition,
  CVisionCvParseJob,
  CVisionCandidateDocument,
} from '@/lib/cvision/types';
import {
  recommendJobsForCandidate,
  recommendCandidatesForJob,
  matchCandidateToJob,
  type CandidateProfile,
  type JobRequirements,
} from '@/lib/cvision/ai/job-recommender';
import { analyzeCV } from '@/lib/ai/cv-analyzer';
import {
  aiMatchCandidateToJobs,
  aiMatchJobToCandidates,
  type JobSummary,
  type CandidateSummary,
} from '@/lib/ai/cv-matcher';
import { getSkillsForJobTitle, getPreferredSkillsForJobTitle, hasSkillMismatch } from '@/lib/cvision/ai/skill-mappings';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const JOB_CODE_TO_TITLE: Record<string, string> = {
  rn: 'Registered Nurse',
  lpn: 'Licensed Practical Nurse',
  swe: 'Software Engineer',
  'sr-swe': 'Senior Software Engineer',
  'hr-spec': 'HR Specialist',
  'hr-mgr': 'HR Manager',
  'it-mgr': 'IT Manager',
  acct: 'Accountant',
  'fin-mgr': 'Finance Manager',
  'da-ns': 'Data Analyst',
  da: 'Data Analyst',
};

function normalizeJobTitle(title: string): string {
  if (!title) return title;
  const lookup = JOB_CODE_TO_TITLE[title.toLowerCase()];
  if (lookup) return lookup;
  if (title.length <= 5 && title === title.toLowerCase()) return title.toUpperCase();
  return title;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDuration(duration: string | undefined | null): number {
  if (!duration) return 1;
  const str = String(duration).trim();
  const rangeMatch = str.match(/(\d{4})\s*[-–]\s*(\d{4}|present|current|now)/i);
  if (rangeMatch) {
    const startYear = parseInt(rangeMatch[1]);
    const endYear = rangeMatch[2].match(/\d{4}/) ? parseInt(rangeMatch[2]) : new Date().getFullYear();
    return Math.max(1, endYear - startYear);
  }
  const numMatch = str.match(/(\d+)/);
  if (numMatch) return Math.max(1, parseInt(numMatch[1]));
  return 1;
}

/**
 * Builds a CandidateProfile (for deterministic fallback)
 */
function buildCandidateProfile(
  candidate: any,
  parseJob?: any | null,
  cvDocument?: any | null
): CandidateProfile {
  const metadata = (candidate.metadata || {}) as Record<string, unknown>;
  const extracted = (parseJob?.extractedJson || parseJob?.metaJson || metadata || {}) as Record<string, unknown>;
  const experience = (Array.isArray(extracted.experience) ? extracted.experience : []).map((e: any) => ({
    title: String(e.title || e.jobTitle || ''),
    company: String(e.company || e.employer || ''),
    years: parseDuration(e.duration as string | undefined),
  }));
  const totalYearsExperience =
    extracted.yearsOfExperience ||
    (metadata as Record<string, unknown>)?.yearsOfExperience ||
    (experience.length > 0 ? experience.reduce((sum: number, e: { years: number }) => sum + (e.years || 0), 0) : 0);
  const education = (Array.isArray(extracted.education) ? extracted.education : []).map((e: any) => ({
    degree: String(e.degree || ''),
    field: String(e.field || e.major || ''),
    institution: String(e.institution || e.university || ''),
  }));
  const skills: string[] = (extracted.skills || metadata?.skills || candidate.skills || []) as string[];
  const cvText = String(parseJob?.extractedRawText || parseJob?.extractedText || cvDocument?.extractedText || '');
  const currentTitle = experience.length > 0 ? experience[0].title : String((metadata as Record<string, unknown>)?.currentTitle || '');

  return {
    candidateId: String(candidate.id),
    name: String(candidate.fullName || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown'),
    skills,
    experience,
    education,
    totalYearsExperience: totalYearsExperience as number,
    currentSalary: (candidate.offerAmount as unknown as number) || undefined,
    cvText: cvText ? cvText.substring(0, 10000) : undefined,
    currentTitle: currentTitle || undefined,
  };
}

/**
 * Builds a CandidateSummary for the AI matcher
 */
function buildCandidateSummary(
  candidate: any,
  parseJob?: any | null,
  cvDocument?: any | null
): CandidateSummary {
  const metadata = (candidate.metadata || {}) as Record<string, unknown>;
  const extracted = (parseJob?.extractedJson || parseJob?.metaJson || metadata || {}) as Record<string, unknown>;
  const skills: string[] = (extracted.skills || metadata?.skills || candidate.skills || []) as string[];
  const experience = (Array.isArray(extracted.experience) ? extracted.experience : []).map((e: any) => ({
    title: String(e.title || e.jobTitle || ''),
    company: String(e.company || e.employer || ''),
    years: parseDuration(e.duration as string | undefined),
  }));
  const educationEntries = (Array.isArray(extracted.education) ? extracted.education : []).map((e: any) =>
    [e.degree, e.institution].filter(Boolean).join(' — ')
  );
  const totalYears =
    extracted.yearsOfExperience ||
    metadata?.yearsOfExperience ||
    0;
  const cvText = String(parseJob?.extractedRawText || parseJob?.extractedText || cvDocument?.extractedText || '');

  return {
    id: String(candidate.id),
    name: String(candidate.fullName || `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown'),
    skills,
    experience: Number(totalYears) || 0,
    education: educationEntries.join('; ') || undefined,
    experienceEntries: experience,
    summary: String(extracted.summary || metadata?.summary || ''),
    cvText: cvText ? cvText.substring(0, 4000) : undefined,
  };
}

/**
 * Builds a JobRequirements object with auto-corrected skills.
 */
function buildJobRequirements(job: any, deptNameMap?: Map<string, string>): JobRequirements {
  const title = normalizeJobTitle(String(job.title || ''));
  let requiredSkills: string[] = [];
  let preferredSkills: string[] = Array.isArray(job.preferredSkills) ? job.preferredSkills as string[] : [];

  const jobSkills = job.skills as Record<string, unknown> | string[] | null | undefined;
  if (jobSkills) {
    if (Array.isArray(jobSkills)) {
      requiredSkills = jobSkills as string[];
    } else {
      requiredSkills = (jobSkills.required || []) as string[];
      if (!preferredSkills.length) preferredSkills = (jobSkills.preferred || []) as string[];
    }
  }

  if (title) {
    if (requiredSkills.length === 0 || hasSkillMismatch(title, requiredSkills)) {
      requiredSkills = getSkillsForJobTitle(title);
    }
    if (preferredSkills.length === 0) {
      preferredSkills = getPreferredSkillsForJobTitle(title);
    }
  }

  const experienceYears = job.experienceYears as Record<string, unknown> | number | null | undefined;
  const requirements = (job.requirements || {}) as Record<string, unknown>;
  const minExperience =
    (typeof experienceYears === 'object' && experienceYears != null ? experienceYears.min : experienceYears) ||
    requirements.minExperience || 0;

  const salaryRangeRaw = job.salaryRange as Record<string, unknown> | null | undefined;
  const salaryRange =
    salaryRangeRaw?.min != null && salaryRangeRaw?.max != null
      ? { min: Number(salaryRangeRaw.min), max: Number(salaryRangeRaw.max) }
      : undefined;

  const department = String(deptNameMap?.get(String(job.departmentId)) || job.departmentName || job.departmentId || '');

  return {
    jobId: String(job.id),
    title,
    department,
    requiredSkills,
    preferredSkills,
    minExperience: Number(minExperience) || 0,
    education: String(requirements.education || 'bachelor'),
    location: job.location as string | undefined,
    salaryRange,
  };
}

/**
 * Builds a JobSummary for the AI matcher
 */
function buildJobSummary(job: any, deptNameMap?: Map<string, string>): JobSummary {
  const jr = buildJobRequirements(job, deptNameMap);
  return {
    id: jr.jobId,
    title: jr.title,
    department: jr.department,
    requiredSkills: jr.requiredSkills,
    preferredSkills: jr.preferredSkills,
    minExperience: jr.minExperience,
    education: jr.education,
    description: (job.description as string) || undefined,
  };
}

async function getLatestParseJob(parseJobsCol: Awaited<ReturnType<typeof getCVisionCollection>>, tenantId: string, candidateId: string): Promise<any | null> {
  const doneJob = await parseJobsCol.findOne(
    createTenantFilter(tenantId, { candidateId, status: 'DONE' }),
    { sort: { completedAt: -1 } }
  );
  if (doneJob) return doneJob;

  const anyWithData = await parseJobsCol.findOne(
    createTenantFilter(tenantId, { candidateId, extractedJson: { $ne: null } }),
    { sort: { createdAt: -1 } }
  );
  if (anyWithData) return anyWithData;

  return parseJobsCol.findOne(
    createTenantFilter(tenantId, { candidateId }),
    { sort: { createdAt: -1 } }
  );
}

async function ensureCvAnalysis(
  parseJobsCol: Awaited<ReturnType<typeof getCVisionCollection>>, docsCol: Awaited<ReturnType<typeof getCVisionCollection>>, tenantId: string, candidateId: string, parseJob: any | null
): Promise<any | null> {
  if (parseJob?.extractedJson && Object.keys(parseJob.extractedJson).length > 0) {
    return parseJob;
  }

  let extractedText = parseJob?.extractedText || null;
  if (!extractedText) {
    const doc = await docsCol.findOne(
      createTenantFilter(tenantId, { candidateId, kind: 'CV', extractedText: { $ne: null } }),
      { sort: { createdAt: -1 } }
    );
    if (doc?.extractedText) extractedText = doc.extractedText;
  }

  if (!extractedText || extractedText.trim().length < 50) return parseJob;

  try {
    logger.info('[Recommend] Auto-analyzing CV for candidate:', candidateId);
    const analysis = await analyzeCV(extractedText, 'cv.pdf');
    if (analysis?.skills?.length > 0 && parseJob) {
      const now = new Date();
      await parseJobsCol.updateOne(
        createTenantFilter(tenantId, { id: parseJob.id }),
        { $set: { extractedJson: analysis, status: 'DONE', startedAt: parseJob.startedAt || now, completedAt: now, updatedAt: now } }
      );
      parseJob.extractedJson = analysis;
      parseJob.status = 'DONE';
    }
    return parseJob;
  } catch (err: unknown) {
    logger.error('[Recommend] Auto-analysis failed:', err instanceof Error ? err.message : String(err));
    return parseJob;
  }
}

async function batchGetParseJobs(parseJobsCol: Awaited<ReturnType<typeof getCVisionCollection>>, tenantId: string, candidateIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (candidateIds.length === 0) return map;
  const parseJobs = await parseJobsCol.find(createTenantFilter(tenantId, { candidateId: { $in: candidateIds } })).sort({ completedAt: -1, createdAt: -1 }).toArray();
  for (const job of parseJobs) {
    const existing = map.get(job.candidateId);
    if (!existing) { map.set(job.candidateId, job); }
    else if (existing.status !== 'DONE' && job.status === 'DONE') { map.set(job.candidateId, job); }
    else if (!existing.extractedJson && job.extractedJson) { map.set(job.candidateId, job); }
  }
  return map;
}

/**
 * Fetches CV Inbox suggestions for a candidate (if they came through CV Inbox).
 */
async function getCvInboxSuggestions(
  tenantId: string,
  candidateId: string
): Promise<{ requisitionId: string; score: number }[]> {
  try {
    const inboxCol = await getCVisionCollection(tenantId, 'cvInboxItems');
    const item = await inboxCol.findOne(
      createTenantFilter(tenantId, { assignedCandidateId: candidateId })
    );
    if (!item) return [];

    const scores: Record<string, number> = (item.suggestedScoresJson as Record<string, number>) || {};
    const ids: string[] = (item.suggestedRequisitionIdsJson as string[]) || [];

    return ids.map(id => ({ requisitionId: id, score: scores[id] || 0 }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

/**
 * Converts AI matcher results to the MatchResult format expected by the UI.
 */
function aiResultToMatchResult(
  ai: { jobId: string; jobTitle: string; department?: string; matchScore: number; reasoning: string; matchedSkills: string[]; missingSkills: string[]; strengthPoints: string[]; gaps: string[] },
  candidateId: string,
  candidateName: string
) {
  const score = Math.round(ai.matchScore);
  let recommendation: 'STRONG_MATCH' | 'GOOD_MATCH' | 'PARTIAL_MATCH' | 'WEAK_MATCH';
  if (score >= 80) recommendation = 'STRONG_MATCH';
  else if (score >= 60) recommendation = 'GOOD_MATCH';
  else if (score >= 40) recommendation = 'PARTIAL_MATCH';
  else recommendation = 'WEAK_MATCH';

  return {
    jobId: ai.jobId,
    jobTitle: ai.jobTitle,
    department: ai.department || '',
    candidateId,
    candidateName,
    overallScore: score,
    breakdown: {
      skillMatch: score,
      experienceMatch: score,
      educationMatch: score,
      salaryFit: 80,
    },
    matchedSkills: ai.matchedSkills || [],
    missingSkills: ai.missingSkills || [],
    recommendation,
    reasoning: ai.reasoning || '',
    reasoningAr: '',
    strengthPoints: ai.strengthPoints || [],
    gaps: ai.gaps || [],
    source: 'ai' as const,
  };
}

function aiCandidateResultToMatchResult(
  ai: { candidateId: string; candidateName: string; matchScore: number; reasoning: string; matchedSkills: string[]; missingSkills: string[]; strengthPoints: string[]; gaps: string[] },
  jobId: string,
  jobTitle: string
) {
  const score = Math.round(ai.matchScore);
  let recommendation: 'STRONG_MATCH' | 'GOOD_MATCH' | 'PARTIAL_MATCH' | 'WEAK_MATCH';
  if (score >= 80) recommendation = 'STRONG_MATCH';
  else if (score >= 60) recommendation = 'GOOD_MATCH';
  else if (score >= 40) recommendation = 'PARTIAL_MATCH';
  else recommendation = 'WEAK_MATCH';

  return {
    jobId,
    jobTitle,
    candidateId: ai.candidateId,
    candidateName: ai.candidateName,
    overallScore: score,
    breakdown: {
      skillMatch: score,
      experienceMatch: score,
      educationMatch: score,
      salaryFit: 80,
    },
    matchedSkills: ai.matchedSkills || [],
    missingSkills: ai.missingSkills || [],
    recommendation,
    reasoning: ai.reasoning || '',
    reasoningAr: '',
    strengthPoints: ai.strengthPoints || [],
    gaps: ai.gaps || [],
    source: 'ai' as const,
  };
}

// ─── GET Handler ────────────────────────────────────────────────────────────

export const GET = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const action = searchParams.get('action');

      if (action === 'stats') {
        const candidatesCol = await getCVisionCollection<CVisionCandidate>(tenantId, 'candidates');
        const jobsCol = await getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions');
        const [totalCandidates, openJobs] = await Promise.all([
          candidatesCol.countDocuments(createTenantFilter(tenantId)),
          jobsCol.countDocuments(createTenantFilter(tenantId, { status: { $in: ['open', 'approved'] } })),
        ]);
        return NextResponse.json({ success: true, data: { totalCandidates, openJobs, message: 'AI Job Recommender ready' } });
      }

      return NextResponse.json({
        success: true,
        data: {
          message: 'CVision AI Job Recommender API',
          engine: 'AI-powered (same engine as CV Inbox)',
          endpoints: {
            'POST action=match-candidate-to-jobs': 'AI-powered job matching for a candidate',
            'POST action=match-job-to-candidates': 'AI-powered candidate ranking for a job',
            'POST action=match-single': 'Quick match one candidate to one job',
            'POST action=fix-skills': 'Auto-correct job skills',
            'POST action=suggest-skills': 'Suggest skills for a job title',
          },
        },
      });
    } catch (error: unknown) {
      logger.error('[Recommend API GET]', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);

// ─── POST Handler ───────────────────────────────────────────────────────────

export const POST = withAuthTenant(
  async (request, { tenantId }) => {
    try {
      const body = await request.json();
      const { action } = body;

      const candidatesCol = await getCVisionCollection<CVisionCandidate>(tenantId, 'candidates');
      const jobsCol = await getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions');
      const parseJobsCol = await getCVisionCollection<CVisionCvParseJob>(tenantId, 'cvParseJobs');
      const docsCol = await getCVisionCollection<CVisionCandidateDocument>(tenantId, 'candidateDocuments');

      // Build department name map for resolving UUIDs
      const deptsCol = await getCVisionCollection(tenantId, 'departments');
      const allDepts = await deptsCol.find(createTenantFilter(tenantId)).limit(500).toArray();
      const deptNameMap = new Map<string, string>();
      for (const d of allDepts) {
        const dept = d as Record<string, unknown>;
        deptNameMap.set(String(dept.id), String(dept.name || dept.code || dept.id));
      }

      // ══════════════════════════════════════════════════════════════════
      // Match Candidate → Jobs (AI-powered)
      // ══════════════════════════════════════════════════════════════════

      if (action === 'match-candidate-to-jobs') {
        const { candidateId, limit = 5 } = body;
        if (!candidateId) {
          return NextResponse.json({ success: false, error: 'candidateId is required' }, { status: 400 });
        }

        const candidate = await findById(candidatesCol, tenantId, candidateId);
        if (!candidate) {
          return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
        }

        // Fetch & auto-analyze CV
        let parseJob = await getLatestParseJob(parseJobsCol, tenantId, candidateId);
        parseJob = await ensureCvAnalysis(parseJobsCol, docsCol, tenantId, candidateId, parseJob);
        const cvDoc = await docsCol.findOne(
          createTenantFilter(tenantId, { candidateId, kind: 'CV', extractedText: { $ne: null } }),
          { sort: { createdAt: -1 } }
        );

        // Build candidate summaries for both AI and deterministic engines
        const candidateSummary = buildCandidateSummary(candidate, parseJob, cvDoc);
        const candidateProfile = buildCandidateProfile(candidate, parseJob, cvDoc);
        const hasCvData = candidateSummary.skills.length > 0 || (candidateSummary.experience ?? 0) > 0;

        // Fetch open jobs
        const openJobs = await jobsCol.find(
          createTenantFilter(tenantId, { status: { $in: ['open', 'approved'] } })
        ).toArray();

        if (openJobs.length === 0) {
          return NextResponse.json({
            success: true,
            data: { candidateId, candidateName: candidateSummary.name, topMatches: [], totalJobsAnalyzed: 0, hasCvData },
          });
        }

        const jobSummaries = openJobs.map(j => buildJobSummary(j, deptNameMap));
        const jobProfiles = openJobs.map(j => buildJobRequirements(j, deptNameMap));

        // Fetch CV Inbox suggestions
        const cvInboxSuggestions = await getCvInboxSuggestions(tenantId, candidateId);
        const cvInboxMatches: any[] = [];
        for (const sug of cvInboxSuggestions) {
          const job = openJobs.find(j => j.id === sug.requisitionId);
          if (job) {
            cvInboxMatches.push({
              jobId: job.id,
              jobTitle: normalizeJobTitle(job.title),
              department: deptNameMap.get(job.departmentId) || job.departmentId || '',
              candidateId,
              candidateName: candidateSummary.name,
              overallScore: Math.round(sug.score),
              breakdown: { skillMatch: sug.score, experienceMatch: sug.score, educationMatch: sug.score, salaryFit: 80 },
              matchedSkills: [],
              missingSkills: [],
              recommendation: sug.score >= 80 ? 'STRONG_MATCH' : sug.score >= 60 ? 'GOOD_MATCH' : sug.score >= 40 ? 'PARTIAL_MATCH' : 'WEAK_MATCH',
              reasoning: `CV Inbox recommended this position with a ${Math.round(sug.score)}% match based on CV analysis.`,
              reasoningAr: '',
              strengthPoints: [],
              gaps: [],
              source: 'cv_inbox',
            });
          }
        }

        // Try AI-powered matching first
        let aiMatches: ReturnType<typeof aiResultToMatchResult>[] = [];
        try {
          const aiResults = await aiMatchCandidateToJobs(candidateSummary, jobSummaries, limit);
          aiMatches = aiResults.map(r => aiResultToMatchResult(r, candidateId, candidateSummary.name));
          logger.info('[Recommend] AI matching succeeded:', aiMatches.length, 'results');
        } catch (err: unknown) {
          logger.warn('[Recommend] AI matching failed, using deterministic fallback:', err instanceof Error ? err.message : String(err));
        }

        // If AI matching returned results, use those. Otherwise, fall back to deterministic.
        let topMatches: any[];
        if (aiMatches.length > 0) {
          topMatches = aiMatches;
        } else {
          const deterministicReport = recommendJobsForCandidate(candidateProfile, jobProfiles, limit);
          topMatches = deterministicReport.topMatches.map(m => ({ ...m, source: 'deterministic' }));
        }

        // Merge CV Inbox suggestions at the top if they aren't already represented
        const seen = new Set(topMatches.map(m => m.jobId));
        for (const inboxMatch of cvInboxMatches) {
          if (!seen.has(inboxMatch.jobId)) {
            topMatches.unshift(inboxMatch);
            seen.add(inboxMatch.jobId);
          }
        }

        // Re-sort by score
        topMatches.sort((a, b) => (b.overallScore as number) - (a.overallScore as number));
        topMatches = topMatches.slice(0, limit);

        return NextResponse.json({
          success: true,
          data: {
            candidateId,
            candidateName: candidateSummary.name,
            topMatches,
            totalJobsAnalyzed: openJobs.length,
            generatedAt: new Date(),
            hasCvData,
            candidateSkills: candidateSummary.skills,
            candidateExperience: candidateSummary.yearsOfExperience,
            candidateEducation: candidateSummary.education,
            currentTitle: candidateProfile.currentTitle || null,
            matchEngine: aiMatches.length > 0 ? 'ai' : 'deterministic',
          },
        });
      }

      // ══════════════════════════════════════════════════════════════════
      // Match Job → Candidates (AI-powered)
      // ══════════════════════════════════════════════════════════════════

      if (action === 'match-job-to-candidates') {
        const { jobId, limit = 10 } = body;
        if (!jobId) {
          return NextResponse.json({ success: false, error: 'jobId is required' }, { status: 400 });
        }

        const job = await findById(jobsCol, tenantId, jobId);
        if (!job) {
          return NextResponse.json({ success: false, error: 'Job requisition not found' }, { status: 404 });
        }

        const jobSummary = buildJobSummary(job, deptNameMap);
        const jobProfile = buildJobRequirements(job, deptNameMap);

        const candidates = await candidatesCol.find(
          createTenantFilter(tenantId, { status: { $nin: ['rejected', 'withdrawn'] } })
        ).toArray();

        if (candidates.length === 0) {
          return NextResponse.json({
            success: true,
            data: { jobId, jobTitle: normalizeJobTitle(job.title), candidates: [], totalCandidatesAnalyzed: 0 },
          });
        }

        const candidateIds = candidates.map(c => c.id || String((c as Record<string, unknown>)._id || ''));
        const parseJobsMap = await batchGetParseJobs(parseJobsCol, tenantId, candidateIds);
        const cvDocs = await docsCol.find(
          createTenantFilter(tenantId, { candidateId: { $in: candidateIds }, kind: 'CV', extractedText: { $ne: null } })
        ).sort({ createdAt: -1 }).toArray();
        const cvDocsMap = new Map<string, any>();
        for (const doc of cvDocs) {
          if (!cvDocsMap.has(doc.candidateId)) cvDocsMap.set(doc.candidateId, doc);
        }

        const candidateSummaries = candidates.map(c =>
          buildCandidateSummary(c, parseJobsMap.get(c.id), cvDocsMap.get(c.id))
        );

        // Try AI-powered matching
        let resultMatches: any[];
        try {
          const aiResults = await aiMatchJobToCandidates(jobSummary, candidateSummaries, limit);
          resultMatches = aiResults.map(r => aiCandidateResultToMatchResult(r, jobId, normalizeJobTitle(job.title)));
          logger.info('[Recommend] AI job→candidates succeeded:', resultMatches.length, 'results');
        } catch (err: unknown) {
          logger.warn('[Recommend] AI job→candidates failed, falling back:', err instanceof Error ? err.message : String(err));
          const candidateProfiles = candidates.map(c =>
            buildCandidateProfile(c, parseJobsMap.get(c.id), cvDocsMap.get(c.id))
          );
          resultMatches = recommendCandidatesForJob(jobProfile, candidateProfiles, limit)
            .map(m => ({ ...m, source: 'deterministic' }));
        }

        return NextResponse.json({
          success: true,
          data: {
            jobId,
            jobTitle: normalizeJobTitle(job.title),
            candidates: resultMatches,
            totalCandidatesAnalyzed: candidates.length,
            matchEngine: resultMatches.length > 0 && resultMatches[0].source === 'ai' ? 'ai' : 'deterministic',
          },
        });
      }

      // ══════════════════════════════════════════════════════════════════
      // Quick Match: Single Candidate ↔ Single Job
      // ══════════════════════════════════════════════════════════════════

      if (action === 'match-single') {
        const { candidateId, jobId } = body;
        if (!candidateId || !jobId) {
          return NextResponse.json({ success: false, error: 'Both candidateId and jobId are required' }, { status: 400 });
        }

        const [candidate, job, parseJob] = await Promise.all([
          findById(candidatesCol, tenantId, candidateId),
          findById(jobsCol, tenantId, jobId),
          getLatestParseJob(parseJobsCol, tenantId, candidateId),
        ]);
        if (!candidate) return NextResponse.json({ success: false, error: 'Candidate not found' }, { status: 404 });
        if (!job) return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });

        const cvDoc = await docsCol.findOne(
          createTenantFilter(tenantId, { candidateId, kind: 'CV', extractedText: { $ne: null } }),
          { sort: { createdAt: -1 } }
        );

        // Try AI match for single pair
        const candidateSummary = buildCandidateSummary(candidate, parseJob, cvDoc);
        const jobSummary = buildJobSummary(job, deptNameMap);

        let result: any | undefined;
        try {
          const aiResults = await aiMatchCandidateToJobs(candidateSummary, [jobSummary], 1);
          if (aiResults.length > 0) {
            result = aiResultToMatchResult(aiResults[0], candidateId, candidateSummary.name);
          }
        } catch { /* fall through to deterministic */ }

        if (!result) {
          const candidateProfile = buildCandidateProfile(candidate, parseJob, cvDoc);
          const jobProfile = buildJobRequirements(job, deptNameMap);
          result = matchCandidateToJob(candidateProfile, jobProfile);
        }

        return NextResponse.json({ success: true, data: result });
      }

      // ══════════════════════════════════════════════════════════════════
      // Fix Skills
      // ══════════════════════════════════════════════════════════════════

      if (action === 'fix-skills') {
        const allJobs = await jobsCol.find(createTenantFilter(tenantId)).limit(5000).toArray();
        let fixed = 0;
        const fixes: { title: string; oldSkills: string[]; newSkills: string[] }[] = [];

        for (const job of allJobs) {
          const currentSkills = Array.isArray(job.skills) ? job.skills : [];
          const titleStr = job.title || '';
          const normalizedTitle = normalizeJobTitle(titleStr);
          const needsTitleFix = normalizedTitle !== titleStr;
          const needsSkillFix = hasSkillMismatch(normalizedTitle, currentSkills) || currentSkills.length === 0;
          const jobRecord = job as Record<string, unknown>;
          const needsDeptName = job.departmentId && !jobRecord.departmentName;

          if (needsTitleFix || needsSkillFix || needsDeptName) {
            const correctSkills = needsSkillFix ? getSkillsForJobTitle(normalizedTitle) : currentSkills;
            const correctPreferred = needsSkillFix ? getPreferredSkillsForJobTitle(normalizedTitle) : ((jobRecord.preferredSkills || []) as string[]);
            const updates: any = { updatedAt: new Date() };
            if (needsTitleFix) updates.title = normalizedTitle;
            if (needsSkillFix) {
              updates.skills = correctSkills;
              updates.preferredSkills = correctPreferred;
            }
            if (needsDeptName) {
              updates.departmentName = deptNameMap.get(job.departmentId) || job.departmentId;
            }
            await jobsCol.updateOne(
              createTenantFilter(tenantId, { id: job.id }),
              { $set: updates }
            );
            fixes.push({
              title: needsTitleFix ? `${titleStr} → ${normalizedTitle}` : titleStr,
              oldSkills: currentSkills.slice(0, 5),
              newSkills: correctSkills.slice(0, 5),
            });
            fixed++;
          }
        }
        return NextResponse.json({ success: true, data: { totalChecked: allJobs.length, fixed, fixes } });
      }

      // ══════════════════════════════════════════════════════════════════
      // Suggest Skills
      // ══════════════════════════════════════════════════════════════════

      if (action === 'suggest-skills') {
        const { title } = body;
        if (!title) return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
        return NextResponse.json({ success: true, data: { title, suggestedSkills: getSkillsForJobTitle(title) } });
      }

      // ══════════════════════════════════════════════════════════════════

      return NextResponse.json(
        { success: false, error: 'Invalid action. Use: match-candidate-to-jobs, match-job-to-candidates, match-single, fix-skills, suggest-skills' },
        { status: 400 }
      );
    } catch (error: unknown) {
      logger.error('[Recommend API POST]', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.RECRUITMENT_READ }
);
