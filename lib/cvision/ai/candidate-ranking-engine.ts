/**
 * Candidate Ranking & Seriousness Scoring Engine
 *
 * Reads existing candidate, interview, document, and CV-parse data to produce
 * a composite ranking that blends:
 *   • AI match score   (50 %) — from the deterministic matching engine
 *   • Seriousness score (30 %) — response speed, attendance, follow-ups
 *   • Completeness score (20 %) — profile + document coverage
 *
 * Also introduces a lightweight interaction-tracking collection
 * (cvision_candidate_interactions) so that HR can log events like
 * "candidate replied to email" / "document submitted" / "no-show".
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type {
  CVisionCandidate,
  CVisionJobRequisition,
  CVisionCandidateDocument,
  CandidateInterview,
  JobSkillsStructured,
  ExperienceYearsRange,
  SalaryRange,
  JobRequirementsRecord,
  CandidateMetadata,
  CandidateExperienceEntry,
  CandidateEducationEntry,
  CVisionDepartmentRecord,
  CVisionCvParseJobRecord,
} from '@/lib/cvision/types';
import type { Filter, Sort } from 'mongodb';
import {
  matchCandidateToJob,
  type CandidateProfile,
  type JobRequirements,
} from './job-recommender';
import { getSkillsForJobTitle, hasSkillMismatch } from './skill-mappings';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SeriousnessFactors {
  responseTime: {
    score: number;
    avgResponseHours: number;
    detail: string;
  };
  profileCompleteness: {
    score: number;
    filledFields: number;
    totalFields: number;
    missingFields: string[];
  };
  documentSubmission: {
    score: number;
    cvUploaded: boolean;
    certificatesUploaded: boolean;
    referencesProvided: boolean;
  };
  interviewAttendance: {
    score: number;
    scheduled: number;
    attended: number;
    noShows: number;
    onTime: number;
  };
  followUp: {
    score: number;
    sentFollowUp: boolean;
    askedQuestions: boolean;
  };
  applicationQuality: {
    score: number;
    coverLetterProvided: boolean;
    customizedApplication: boolean;
    relevantExperience: boolean;
  };
}

export type RecommendationTier =
  | 'HIGHLY_RECOMMENDED'
  | 'RECOMMENDED'
  | 'CONSIDER'
  | 'NOT_RECOMMENDED';

export interface CandidateRanking {
  candidateId: string;
  candidateName: string;
  requisitionId: string;
  jobTitle: string;

  overallScore: number;
  rank: number;

  matchScore: number;
  seriousnessScore: number;
  completenessScore: number;
  responsivenessScore: number;

  seriousnessFactors: SeriousnessFactors;
  recommendation: RecommendationTier;
  flags: string[];
}

export type InteractionType =
  | 'EMAIL_RESPONSE'
  | 'DOCUMENT_SUBMITTED'
  | 'INTERVIEW_ATTENDED'
  | 'INTERVIEW_NO_SHOW'
  | 'FOLLOW_UP_SENT'
  | 'QUESTION_ASKED';

export interface CandidateInteraction {
  id: string;
  tenantId: string;
  candidateId: string;
  interactionType: InteractionType;
  timestamp: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ─── Weights ────────────────────────────────────────────────────────────────

const SERIOUSNESS_WEIGHTS = {
  responseTime: 25,
  profileCompleteness: 20,
  documentSubmission: 20,
  interviewAttendance: 15,
  followUp: 10,
  applicationQuality: 10,
} as const;

const OVERALL_WEIGHTS = {
  match: 0.50,
  seriousness: 0.30,
  completeness: 0.20,
} as const;

// ─── Collection helpers ─────────────────────────────────────────────────────

function interactionsCollection(tenantId: string) {
  return getCVisionCollection<CandidateInteraction>(
    tenantId,
    'candidateInteractions',
  );
}

function rankingsCollection(tenantId: string) {
  return getCVisionCollection<CandidateRanking>(
    tenantId,
    'candidateRankings',
  );
}

// ─── Interaction tracking ───────────────────────────────────────────────────

export async function trackCandidateInteraction(
  tenantId: string,
  candidateId: string,
  interactionType: InteractionType,
  timestamp?: Date,
  metadata?: Record<string, any>,
): Promise<CandidateInteraction> {
  const coll = await interactionsCollection(tenantId);
  const record: CandidateInteraction = {
    id: uuidv4(),
    tenantId,
    candidateId,
    interactionType,
    timestamp: timestamp || new Date(),
    metadata,
    createdAt: new Date(),
  };
  await coll.insertOne(record as Record<string, unknown> & CandidateInteraction);
  return record;
}

// ─── Seriousness calculation ────────────────────────────────────────────────

export async function calculateSeriousnessScore(
  tenantId: string,
  candidateId: string,
  requisitionId: string,
): Promise<SeriousnessFactors> {
  const [candColl, docColl, parseColl, intColl] = await Promise.all([
    getCVisionCollection<CVisionCandidate>(tenantId, 'candidates'),
    getCVisionCollection<CVisionCandidateDocument>(tenantId, 'candidateDocuments'),
    getCVisionCollection<CVisionCvParseJobRecord>(tenantId, 'cvParseJobs'),
    interactionsCollection(tenantId),
  ]);

  const candidate = await candColl.findOne(createTenantFilter(tenantId, { id: candidateId } as Filter<CVisionCandidate>));
  const docs = await docColl.find({ tenantId, candidateId } as Filter<CVisionCandidateDocument>).toArray();
  const parseJob = await parseColl.findOne({ tenantId, candidateId } as Filter<CVisionCvParseJobRecord>);
  const interactions = await intColl.find({ tenantId, candidateId } as Filter<CandidateInteraction>).toArray();

  // ── 1. Response time ──────────────────────────────────────────────────────
  const emailResponses = interactions.filter((i) => i.interactionType === 'EMAIL_RESPONSE');
  let avgResponseHours = 0;
  let responseScore = 50; // neutral default
  if (emailResponses.length > 0) {
    const totalHours = emailResponses.reduce((sum: number, i) => {
      return sum + ((i.metadata as Record<string, unknown> | undefined)?.responseHours as number || 24);
    }, 0);
    avgResponseHours = Math.round(totalHours / emailResponses.length);
    if (avgResponseHours <= 4) responseScore = 100;
    else if (avgResponseHours <= 12) responseScore = 85;
    else if (avgResponseHours <= 24) responseScore = 70;
    else if (avgResponseHours <= 48) responseScore = 50;
    else if (avgResponseHours <= 72) responseScore = 30;
    else responseScore = 15;
  }
  const responseTimeDetail = emailResponses.length > 0
    ? `Responded within ${avgResponseHours} hours avg`
    : 'No response data tracked';

  // ── 2. Profile completeness ───────────────────────────────────────────────
  const PROFILE_FIELDS = [
    'fullName', 'email', 'phone', 'source', 'status',
    'notes', 'screeningScore', 'metadata',
  ];
  const candidateObj = candidate || {} as Partial<CVisionCandidate>;
  const extracted = parseJob?.extractedJson || parseJob?.metaJson || candidateObj.metadata || {};
  const allFields = [
    ...PROFILE_FIELDS,
    ...(extracted.skills?.length ? ['skills'] : []),
    ...(extracted.experience?.length ? ['experience'] : []),
  ];
  const totalFields = 10;
  let filledFields = 0;
  const missingFields: string[] = [];

  for (const f of PROFILE_FIELDS) {
    const val = candidateObj[f];
    if (val !== undefined && val !== null && val !== '') filledFields++;
    else missingFields.push(f);
  }
  if (extracted.skills?.length) filledFields++;
  else missingFields.push('skills');
  if (extracted.experience?.length) filledFields++;
  else missingFields.push('experience');

  const completenessScore = Math.round((filledFields / totalFields) * 100);

  // ── 3. Document submission ────────────────────────────────────────────────
  const cvUploaded = docs.some((d) => ['CV', 'cv'].includes(d.kind));
  const certificatesUploaded = docs.some((d) => ['CERTIFICATE', 'certificate'].includes(d.kind));
  const referencesProvided = !!(candidateObj.metadata?.references?.length || candidateObj.referredBy);
  let docScore = 0;
  if (cvUploaded) docScore += 50;
  if (certificatesUploaded) docScore += 30;
  if (referencesProvided) docScore += 20;
  if (!cvUploaded && !certificatesUploaded && !referencesProvided) docScore = 50; // neutral

  // ── 4. Interview attendance ───────────────────────────────────────────────
  const interviews: CandidateInterview[] = candidateObj.interviews || [];
  const scheduled = interviews.length;
  const attended = interviews.filter(
    (iv: CandidateInterview) => iv.status === 'completed' || iv.status === 'in_progress',
  ).length;
  const noShows = interviews.filter((iv: CandidateInterview) => iv.status === 'no_show').length;
  const interactionNoShows = interactions.filter(
    (i) => i.interactionType === 'INTERVIEW_NO_SHOW',
  ).length;
  const totalNoShows = noShows + interactionNoShows;
  const interactionAttended = interactions.filter(
    (i) => i.interactionType === 'INTERVIEW_ATTENDED',
  ).length;
  const totalAttended = attended + interactionAttended;
  const onTime = totalAttended; // assume on-time unless tracked otherwise

  let attendanceScore = 50;
  if (scheduled > 0 || totalAttended > 0) {
    const totalScheduled = Math.max(scheduled, totalAttended + totalNoShows);
    if (totalScheduled > 0) {
      attendanceScore = Math.round(((totalAttended) / totalScheduled) * 100);
    }
    if (totalNoShows > 0) attendanceScore = Math.max(0, attendanceScore - totalNoShows * 20);
  }

  // ── 5. Follow-up ─────────────────────────────────────────────────────────
  const sentFollowUp = interactions.some((i) => i.interactionType === 'FOLLOW_UP_SENT');
  const askedQuestions = interactions.some((i) => i.interactionType === 'QUESTION_ASKED');
  let followUpScore = 50;
  if (sentFollowUp && askedQuestions) followUpScore = 100;
  else if (sentFollowUp || askedQuestions) followUpScore = 70;
  else if (interactions.length > 0) followUpScore = 40; // interacted but no follow-up

  // ── 6. Application quality ────────────────────────────────────────────────
  const coverLetterProvided = !!(
    candidateObj.metadata?.coverLetter ||
    docs.some((d) => d.kind === 'OTHER' && /cover/i.test(d.fileName))
  );
  const hasSkillsData = !!(extracted.skills?.length);
  const hasExperienceData = !!(extracted.experience?.length);
  const relevantExperience = hasExperienceData;
  const customizedApplication = hasSkillsData && hasExperienceData;

  let qualityScore = 30;
  if (coverLetterProvided) qualityScore += 30;
  if (customizedApplication) qualityScore += 20;
  if (relevantExperience) qualityScore += 20;
  qualityScore = Math.min(100, qualityScore);

  return {
    responseTime: { score: responseScore, avgResponseHours, detail: responseTimeDetail },
    profileCompleteness: { score: completenessScore, filledFields, totalFields, missingFields },
    documentSubmission: { score: docScore, cvUploaded, certificatesUploaded, referencesProvided },
    interviewAttendance: { score: attendanceScore, scheduled, attended: totalAttended, noShows: totalNoShows, onTime },
    followUp: { score: followUpScore, sentFollowUp, askedQuestions },
    applicationQuality: { score: qualityScore, coverLetterProvided, customizedApplication, relevantExperience },
  };
}

function computeWeightedSeriousness(factors: SeriousnessFactors): number {
  const total =
    factors.responseTime.score * SERIOUSNESS_WEIGHTS.responseTime +
    factors.profileCompleteness.score * SERIOUSNESS_WEIGHTS.profileCompleteness +
    factors.documentSubmission.score * SERIOUSNESS_WEIGHTS.documentSubmission +
    factors.interviewAttendance.score * SERIOUSNESS_WEIGHTS.interviewAttendance +
    factors.followUp.score * SERIOUSNESS_WEIGHTS.followUp +
    factors.applicationQuality.score * SERIOUSNESS_WEIGHTS.applicationQuality;
  return Math.round(total / 100);
}

// ─── Flag detection ─────────────────────────────────────────────────────────

export function detectCandidateFlags(ranking: CandidateRanking): string[] {
  const flags: string[] = [];
  if (ranking.seriousnessFactors.responseTime.avgResponseHours > 72 &&
      ranking.seriousnessFactors.responseTime.score < 30) {
    flags.push('slow_responder');
  }
  if (ranking.seriousnessFactors.profileCompleteness.score < 50) {
    flags.push('incomplete_profile');
  }
  if (ranking.seriousnessFactors.interviewAttendance.noShows > 0) {
    flags.push('no_show_risk');
  }
  if (ranking.matchScore >= 70 && ranking.seriousnessScore < 40) {
    flags.push('low_engagement');
  }
  if (ranking.matchScore < 40) {
    flags.push('underqualified');
  }
  return flags;
}

// ─── Build job requirements from requisition ────────────────────────────────

function buildJobReqs(job: CVisionJobRequisition, deptName: string): JobRequirements {
  let requiredSkills: string[] = [];
  let preferredSkills: string[] = [];
  if (job.skills) {
    if (Array.isArray(job.skills)) {
      requiredSkills = job.skills as unknown as string[];
    } else {
      requiredSkills = (job.skills as JobSkillsStructured).required || [];
      preferredSkills = (job.skills as JobSkillsStructured).preferred || [];
    }
  }
  if (job.title && (requiredSkills.length === 0 || hasSkillMismatch(job.title, requiredSkills))) {
    requiredSkills = getSkillsForJobTitle(job.title);
  }
  const minExp =
    (typeof job.experienceYears === 'object' ? (job.experienceYears as ExperienceYearsRange)?.min : job.experienceYears) || 0;
  const salaryRange = job.salaryRange as SalaryRange | null;

  return {
    jobId: job.id,
    title: job.title,
    department: deptName,
    requiredSkills,
    preferredSkills,
    minExperience: Number(minExp) || 0,
    education: (job.requirements as JobRequirementsRecord)?.education || '',
    location: (job.requirements as JobRequirementsRecord)?.location,
    salaryRange: salaryRange ? { min: Number(salaryRange.min) || 0, max: Number(salaryRange.max) || 0 } : undefined,
  };
}

// ─── Rank all candidates for a job ──────────────────────────────────────────

export async function rankCandidatesForJob(
  tenantId: string,
  requisitionId: string,
): Promise<CandidateRanking[]> {
  const [candColl, reqColl, deptColl, parseColl] = await Promise.all([
    getCVisionCollection<CVisionCandidate>(tenantId, 'candidates'),
    getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions'),
    getCVisionCollection<CVisionDepartmentRecord>(tenantId, 'departments'),
    getCVisionCollection<CVisionCvParseJobRecord>(tenantId, 'cvParseJobs'),
  ]);

  const job = await reqColl.findOne(createTenantFilter(tenantId, { id: requisitionId } as Filter<CVisionJobRequisition>));
  if (!job) return [];

  const dept = await deptColl.findOne({ tenantId, id: job.departmentId } as Filter<CVisionDepartmentRecord>);
  const jobReqs = buildJobReqs(job, dept?.name || 'Unknown');

  const candidates = await candColl.find(
    createTenantFilter(tenantId, {
      requisitionId,
      isArchived: { $ne: true },
    } as Filter<CVisionCandidate>),
  ).toArray();

  if (candidates.length === 0) return [];

  const rankings: CandidateRanking[] = [];

  for (const cand of candidates) {
    // Build profile for matching engine
    const parseJob = await parseColl.findOne({ tenantId, candidateId: cand.id } as Filter<CVisionCvParseJobRecord>);
    const extracted = parseJob?.extractedJson || parseJob?.metaJson || cand.metadata || {};
    const skills: string[] = extracted.skills || (cand.metadata as CandidateMetadata)?.skills || [];
    const experience = (extracted.experience || []).map((e: CandidateExperienceEntry) => ({
      title: e.title || '', company: e.company || '', years: parseDuration(e.duration),
    }));
    const education = (extracted.education || []).map((e: CandidateEducationEntry) => ({
      degree: e.degree || '', field: e.field || '', institution: e.institution || '',
    }));
    const totalYears = Number(
      extracted.yearsOfExperience || (cand.metadata as CandidateMetadata)?.yearsOfExperience || 0,
    );

    const profile: CandidateProfile = {
      candidateId: cand.id,
      name: cand.fullName || 'Unknown',
      skills,
      experience,
      education,
      totalYearsExperience: totalYears,
      currentSalary: cand.offerAmount || undefined,
      cvText: parseJob?.extractedRawText || parseJob?.extractedText || '',
      currentTitle: experience[0]?.title || undefined,
    };

    // 1. Match score from existing engine (read-only)
    const matchResult = matchCandidateToJob(profile, jobReqs);
    const matchScore = matchResult.overallScore;

    // 2. Seriousness
    const factors = await calculateSeriousnessScore(tenantId, cand.id, requisitionId);
    const seriousnessScore = computeWeightedSeriousness(factors);

    // 3. Completeness (from factors)
    const completenessScore = factors.profileCompleteness.score;

    // 4. Responsiveness (from factors)
    const responsivenessScore = factors.responseTime.score;

    // Overall composite
    const overallScore = Math.round(
      matchScore * OVERALL_WEIGHTS.match +
      seriousnessScore * OVERALL_WEIGHTS.seriousness +
      completenessScore * OVERALL_WEIGHTS.completeness,
    );

    // Recommendation tier
    let recommendation: RecommendationTier;
    if (overallScore >= 75) recommendation = 'HIGHLY_RECOMMENDED';
    else if (overallScore >= 55) recommendation = 'RECOMMENDED';
    else if (overallScore >= 35) recommendation = 'CONSIDER';
    else recommendation = 'NOT_RECOMMENDED';

    const ranking: CandidateRanking = {
      candidateId: cand.id,
      candidateName: cand.fullName || 'Unknown',
      requisitionId,
      jobTitle: job.title,
      overallScore,
      rank: 0, // assigned after sorting
      matchScore,
      seriousnessScore,
      completenessScore,
      responsivenessScore,
      seriousnessFactors: factors,
      recommendation,
      flags: [],
    };

    ranking.flags = detectCandidateFlags(ranking);
    rankings.push(ranking);
  }

  // Sort and assign ranks
  rankings.sort((a, b) => b.overallScore - a.overallScore);
  rankings.forEach((r, i) => { r.rank = i + 1; });

  // Persist latest rankings
  const rkColl = await rankingsCollection(tenantId);
  for (const r of rankings) {
    await rkColl.updateOne(
      { tenantId, candidateId: r.candidateId, requisitionId: r.requisitionId } as Filter<CandidateRanking>,
      { $set: { ...r, tenantId, updatedAt: new Date() } },
      { upsert: true },
    );
  }

  return rankings;
}

// ─── Get flagged candidates ─────────────────────────────────────────────────

export async function getFlaggedCandidates(
  tenantId: string,
  requisitionId?: string,
): Promise<CandidateRanking[]> {
  const rkColl = await rankingsCollection(tenantId);
  const query: Filter<CandidateRanking> = { tenantId, 'flags.0': { $exists: true } } as Filter<CandidateRanking>;
  if (requisitionId) (query as Record<string, unknown>).requisitionId = requisitionId;
  const results = await rkColl.find(query).sort({ overallScore: -1 } as any).limit(100).toArray();
  return results as CandidateRanking[];
}

// ─── Leaderboard across all open jobs ───────────────────────────────────────

export async function getLeaderboard(tenantId: string): Promise<CandidateRanking[]> {
  const rkColl = await rankingsCollection(tenantId);
  const results = await rkColl.find({ tenantId } as Filter<CandidateRanking>)
    .sort({ overallScore: -1 } as any)
    .limit(50)
    .toArray();

  // De-duplicate by candidateId (keep highest scoring entry)
  const seen = new Set<string>();
  const unique: CandidateRanking[] = [];
  for (const r of results as CandidateRanking[]) {
    if (!seen.has(r.candidateId)) {
      seen.add(r.candidateId);
      unique.push(r);
    }
  }
  return unique;
}

// ─── Single candidate detail ────────────────────────────────────────────────

export async function getCandidateRankingDetail(
  tenantId: string,
  candidateId: string,
  requisitionId: string,
): Promise<CandidateRanking | null> {
  const rkColl = await rankingsCollection(tenantId);
  const existing = await rkColl.findOne({ tenantId, candidateId, requisitionId } as Filter<CandidateRanking>);
  if (existing) return existing as CandidateRanking;

  // Calculate on-the-fly if not persisted
  const rankings = await rankCandidatesForJob(tenantId, requisitionId);
  return rankings.find(r => r.candidateId === candidateId) || null;
}

// ─── Candidates by responsiveness ───────────────────────────────────────────

export async function getCandidatesByResponsiveness(
  tenantId: string,
  requisitionId: string,
): Promise<CandidateRanking[]> {
  const rkColl = await rankingsCollection(tenantId);
  const results = await rkColl.find({ tenantId, requisitionId } as Filter<CandidateRanking>)
    .sort({ responsivenessScore: -1 } as any)
    .limit(100)
    .toArray();
  return results as CandidateRanking[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDuration(dur: string | undefined | null): number {
  if (!dur) return 1;
  const s = String(dur).trim();
  const range = s.match(/(\d{4})\s*[-–]\s*(\d{4}|present|current|now)/i);
  if (range) {
    const start = parseInt(range[1]);
    const end = range[2].match(/\d{4}/) ? parseInt(range[2]) : new Date().getFullYear();
    return Math.max(1, end - start);
  }
  const num = s.match(/(\d+)/);
  return num ? Math.max(1, parseInt(num[1])) : 1;
}
