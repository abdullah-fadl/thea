/**
 * Smart Job Recommender & Talent Pool Engine
 *
 * Builds on the existing deterministic matching engine to add:
 *  - Per-candidate multi-job recommendations with detailed breakdown
 *  - Cross-fit detection (candidate applied for Job A but better fits Job B)
 *  - Talent Pool CRUD (persist promising candidates for future openings)
 *  - Auto-populate: move high-scoring rejected candidates into the pool
 *
 * Pure DB + computation — does NOT call external AI APIs.
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type {
  CVisionCandidate,
  CVisionJobRequisition,
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
  recommendJobsForCandidate as coreRecommend,
  matchCandidateToJob as coreMatch,
  type CandidateProfile as CoreCandidateProfile,
  type JobRequirements,
  type MatchResult,
} from './job-recommender';
import { getSkillsForJobTitle, hasSkillMismatch } from './skill-mappings';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CandidateProfile {
  candidateId: string;
  name: string;
  skills: { name: string; level?: number }[];
  experience: { title: string; years: number; company?: string }[];
  education: { degree: string; field: string; institution?: string }[];
  expectedSalary?: number;
  location?: string;
  languages?: string[];
  totalYearsExperience: number;
}

export interface JobRecommendation {
  requisitionId: string;
  jobTitle: string;
  department: string;
  matchScore: number;
  matchBreakdown: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    salaryMatch: number;
    locationMatch: number;
  };
  salaryRange: { min: number; max: number };
  salaryFit: 'WITHIN_BUDGET' | 'ABOVE_BUDGET' | 'BELOW_RANGE' | 'UNKNOWN';
  missingSkills: string[];
  strongPoints: string[];
  recommendation: string;
  appliedForThis: boolean;
}

export interface CrossFitResult {
  candidateId: string;
  candidateName: string;
  appliedFor: string;
  appliedForId: string;
  betterFitFor: string;
  betterFitForId: string;
  appliedScore: number;
  betterScore: number;
}

export interface TalentPoolEntry {
  id: string;
  tenantId: string;
  candidateId: string;
  candidateName: string;
  email: string;
  phone?: string;
  skills: string[];
  totalExperience: number;
  expectedSalary?: number;
  source: 'APPLICATION' | 'MANUAL' | 'AI_RECOMMENDED';
  status: 'ACTIVE' | 'CONTACTED' | 'NOT_INTERESTED' | 'HIRED' | 'ARCHIVED';
  tags: string[];
  notes: string;
  addedBy: string;
  matchedJobs: { requisitionId: string; jobTitle: string; score: number }[];
  lastContactDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TalentPoolStats {
  total: number;
  active: number;
  bySkill: { skill: string; count: number }[];
  bySource: { source: string; count: number }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function toCoreProfile(cp: CandidateProfile): CoreCandidateProfile {
  return {
    candidateId: cp.candidateId,
    name: cp.name,
    skills: cp.skills.map(s => s.name),
    experience: cp.experience.map(e => ({ title: e.title, company: e.company || '', years: e.years })),
    education: cp.education.map(e => ({ degree: e.degree, field: e.field, institution: e.institution || '' })),
    totalYearsExperience: cp.totalYearsExperience,
    currentSalary: cp.expectedSalary,
    preferredLocation: cp.location,
  };
}

export function checkSalaryFit(
  expected: number,
  min: number,
  max: number,
): { fit: 'WITHIN_BUDGET' | 'ABOVE_BUDGET' | 'BELOW_RANGE' | 'UNKNOWN'; difference: number; percentage: number } {
  if (!expected || (!min && !max)) return { fit: 'UNKNOWN', difference: 0, percentage: 0 };
  if (expected > max) return { fit: 'ABOVE_BUDGET', difference: expected - max, percentage: Math.round(((expected - max) / max) * 100) };
  if (expected < min) return { fit: 'BELOW_RANGE', difference: min - expected, percentage: Math.round(((min - expected) / min) * 100) };
  return { fit: 'WITHIN_BUDGET', difference: 0, percentage: 0 };
}

// ─── Recommend jobs for a candidate ─────────────────────────────────────────

export async function recommendJobsForCandidate(
  tenantId: string,
  profile: CandidateProfile,
): Promise<JobRecommendation[]> {
  const [reqColl, deptColl, candColl] = await Promise.all([
    getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions'),
    getCVisionCollection<CVisionDepartmentRecord>(tenantId, 'departments'),
    getCVisionCollection<CVisionCandidate>(tenantId, 'candidates'),
  ]);

  const openJobs = await reqColl.find(
    createTenantFilter(tenantId, { status: 'open' } as Filter<CVisionJobRequisition>),
  ).toArray();

  if (openJobs.length === 0) return [];

  const depts = await deptColl.find({ tenantId }).toArray();
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));

  // Check which jobs this candidate already applied for
  const applications = await candColl.find(
    createTenantFilter(tenantId, {
      $or: [{ email: profile.skills.length > 0 ? undefined : undefined }, { id: profile.candidateId }],
    } as Filter<CVisionCandidate>),
  ).toArray();
  const appliedJobIds = new Set(applications.map(a => a.requisitionId).filter(Boolean));

  const coreProfile = toCoreProfile(profile);

  const results: JobRecommendation[] = [];

  for (const job of openJobs) {
    const deptName = deptMap.get(job.departmentId) || 'Unknown';
    const jobReqs = buildJobReqs(job, deptName);

    const match = coreMatch(coreProfile, jobReqs);

    const salaryRange = jobReqs.salaryRange || { min: 0, max: 0 };
    const salaryCheck = checkSalaryFit(profile.expectedSalary || 0, salaryRange.min, salaryRange.max);

    const strongPoints: string[] = [];
    if (match.breakdown.skillMatch >= 80) strongPoints.push(`Strong skill alignment (${match.matchedSkills.slice(0, 3).join(', ')})`);
    if (match.breakdown.experienceMatch >= 80) strongPoints.push(`${profile.totalYearsExperience} years relevant experience`);
    if (match.breakdown.educationMatch >= 80) strongPoints.push('Education exceeds requirements');
    if (salaryCheck.fit === 'WITHIN_BUDGET') strongPoints.push('Salary within budget');
    if (profile.languages && profile.languages.length > 1) strongPoints.push('Multilingual candidate');

    results.push({
      requisitionId: job.id,
      jobTitle: job.title,
      department: deptName,
      matchScore: match.overallScore,
      matchBreakdown: {
        skillsMatch: match.breakdown.skillMatch,
        experienceMatch: match.breakdown.experienceMatch,
        educationMatch: match.breakdown.educationMatch,
        salaryMatch: match.breakdown.salaryFit,
        locationMatch: 50, // neutral when no location data
      },
      salaryRange,
      salaryFit: salaryCheck.fit,
      missingSkills: match.missingSkills,
      strongPoints,
      recommendation: match.reasoning,
      appliedForThis: appliedJobIds.has(job.id),
    });
  }

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, 10);
}

// ─── Cross-fit detection ────────────────────────────────────────────────────

export async function detectCrossFitCandidates(tenantId: string): Promise<CrossFitResult[]> {
  const [candColl, reqColl, deptColl, parseColl] = await Promise.all([
    getCVisionCollection<CVisionCandidate>(tenantId, 'candidates'),
    getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions'),
    getCVisionCollection<CVisionDepartmentRecord>(tenantId, 'departments'),
    getCVisionCollection<CVisionCvParseJobRecord>(tenantId, 'cvParseJobs'),
  ]);

  const activeCandidates = await candColl.find(
    createTenantFilter(tenantId, {
      requisitionId: { $ne: null },
      isArchived: { $ne: true },
    } as Filter<CVisionCandidate>),
  ).toArray();

  const openJobs = await reqColl.find(
    createTenantFilter(tenantId, { status: 'open' } as Filter<CVisionJobRequisition>),
  ).toArray();

  if (activeCandidates.length === 0 || openJobs.length < 2) return [];

  const depts = await deptColl.find({ tenantId }).toArray();
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const jobMap = new Map(openJobs.map(j => [j.id, j]));

  const results: CrossFitResult[] = [];

  for (const cand of activeCandidates.slice(0, 50)) {
    const parseJob = await parseColl.findOne({ tenantId, candidateId: cand.id } as Filter<CVisionCvParseJobRecord>);
    const extracted = parseJob?.extractedJson || parseJob?.metaJson || cand.metadata || {};
    const skills: string[] = extracted.skills || (cand.metadata as CandidateMetadata)?.skills || [];
    const experience = (extracted.experience || []).map((e: CandidateExperienceEntry) => ({
      title: e.title || '', company: e.company || '', years: 1,
    }));
    const education = (extracted.education || []).map((e: CandidateEducationEntry) => ({
      degree: e.degree || '', field: e.field || '', institution: e.institution || '',
    }));
    const totalYears = extracted.yearsOfExperience || (cand.metadata as CandidateMetadata)?.yearsOfExperience || 0;

    const coreProfile: CoreCandidateProfile = {
      candidateId: cand.id,
      name: cand.fullName || 'Unknown',
      skills,
      experience,
      education,
      totalYearsExperience: Number(totalYears) || 0,
    };

    const appliedJob = cand.requisitionId ? jobMap.get(cand.requisitionId) : null;
    if (!appliedJob) continue;

    const appliedReqs = buildJobReqs(appliedJob, deptMap.get(appliedJob.departmentId) || '');
    const appliedMatch = coreMatch(coreProfile, appliedReqs);

    let bestAlternative: { job: CVisionJobRequisition; score: number } | null = null;

    for (const otherJob of openJobs) {
      if (otherJob.id === appliedJob.id) continue;
      const otherReqs = buildJobReqs(otherJob, deptMap.get(otherJob.departmentId) || '');
      const otherMatch = coreMatch(coreProfile, otherReqs);
      if (otherMatch.overallScore > appliedMatch.overallScore + 15) {
        if (!bestAlternative || otherMatch.overallScore > bestAlternative.score) {
          bestAlternative = { job: otherJob, score: otherMatch.overallScore };
        }
      }
    }

    if (bestAlternative) {
      results.push({
        candidateId: cand.id,
        candidateName: cand.fullName || 'Unknown',
        appliedFor: appliedJob.title,
        appliedForId: appliedJob.id,
        betterFitFor: bestAlternative.job.title,
        betterFitForId: bestAlternative.job.id,
        appliedScore: appliedMatch.overallScore,
        betterScore: bestAlternative.score,
      });
    }
  }

  return results.sort((a, b) => (b.betterScore - b.appliedScore) - (a.betterScore - a.appliedScore));
}

// ─── Talent Pool CRUD ───────────────────────────────────────────────────────

function poolCollection(tenantId: string) {
  return getCVisionCollection<TalentPoolEntry>(tenantId, 'talentPool');
}

export async function addToTalentPool(
  tenantId: string,
  entry: Partial<TalentPoolEntry>,
  userId: string,
): Promise<TalentPoolEntry> {
  const coll = await poolCollection(tenantId);
  const now = new Date();

  // Check for duplicate
  if (entry.candidateId) {
    const existing = await coll.findOne({ tenantId, candidateId: entry.candidateId } as Filter<TalentPoolEntry>);
    if (existing) {
      await coll.updateOne(
        { tenantId, candidateId: entry.candidateId } as Filter<TalentPoolEntry>,
        { $set: { status: 'ACTIVE' as const, updatedAt: now, notes: entry.notes || existing.notes } },
      );
      return { ...existing, status: 'ACTIVE', updatedAt: now } as TalentPoolEntry;
    }
  }

  const record: TalentPoolEntry = {
    id: uuidv4(),
    tenantId,
    candidateId: entry.candidateId || uuidv4(),
    candidateName: entry.candidateName || '',
    email: entry.email || '',
    phone: entry.phone,
    skills: entry.skills || [],
    totalExperience: entry.totalExperience || 0,
    expectedSalary: entry.expectedSalary,
    source: entry.source || 'MANUAL',
    status: entry.status || 'ACTIVE',
    tags: entry.tags || [],
    notes: entry.notes || '',
    addedBy: userId,
    matchedJobs: entry.matchedJobs || [],
    lastContactDate: entry.lastContactDate,
    createdAt: now,
    updatedAt: now,
  };

  await coll.insertOne(record as Record<string, unknown> & TalentPoolEntry);
  return record;
}

export async function updateTalentPoolEntry(
  tenantId: string,
  entryId: string,
  updates: Partial<TalentPoolEntry>,
): Promise<TalentPoolEntry | null> {
  const coll = await poolCollection(tenantId);
  const $set: Partial<TalentPoolEntry> & { updatedAt: Date } = { ...updates, updatedAt: new Date() };
  delete $set.id;
  delete $set.tenantId;
  const result = await coll.findOneAndUpdate(
    { tenantId, id: entryId } as Filter<TalentPoolEntry>,
    { $set },
    { returnDocument: 'after' },
  );
  return (result as unknown as TalentPoolEntry | null) ?? null;
}

export async function searchTalentPool(
  tenantId: string,
  filters: {
    skills?: string[];
    minExperience?: number;
    maxSalary?: number;
    tags?: string[];
    status?: string;
    search?: string;
  },
): Promise<TalentPoolEntry[]> {
  const coll = await poolCollection(tenantId);
  const query: Filter<TalentPoolEntry> = { tenantId } as Filter<TalentPoolEntry>;
  const q = query as Record<string, unknown>;

  if (filters.status && filters.status !== 'ALL') q.status = filters.status;
  else q.status = { $ne: 'ARCHIVED' };

  if (filters.skills && filters.skills.length > 0) q.skills = { $in: filters.skills };
  if (filters.tags && filters.tags.length > 0) q.tags = { $in: filters.tags };
  if (filters.minExperience) q.totalExperience = { $gte: filters.minExperience };
  if (filters.maxSalary) q.expectedSalary = { $lte: filters.maxSalary };
  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    q.candidateName = { $regex: escaped, $options: 'i' };
  }

  return coll.find(query).sort({ updatedAt: -1 } as any).limit(100).toArray() as Promise<TalentPoolEntry[]>;
}

export async function getTalentPoolStats(tenantId: string): Promise<TalentPoolStats> {
  const coll = await poolCollection(tenantId);
  const all = await coll.find({ tenantId, status: { $ne: 'ARCHIVED' } } as Filter<TalentPoolEntry>).toArray();

  const skillCount = new Map<string, number>();
  const sourceCount = new Map<string, number>();

  for (const entry of all) {
    for (const s of entry.skills || []) {
      skillCount.set(s, (skillCount.get(s) || 0) + 1);
    }
    const src = entry.source || 'MANUAL';
    sourceCount.set(src, (sourceCount.get(src) || 0) + 1);
  }

  return {
    total: all.length,
    active: all.filter((e) => e.status === 'ACTIVE').length,
    bySkill: Array.from(skillCount.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
    bySource: Array.from(sourceCount.entries())
      .map(([source, count]) => ({ source, count })),
  };
}

export async function searchTalentPoolForJob(
  tenantId: string,
  requisitionId: string,
): Promise<(TalentPoolEntry & { matchScore: number })[]> {
  const reqColl = await getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions');
  const job = await reqColl.findOne(createTenantFilter(tenantId, { id: requisitionId } as Filter<CVisionJobRequisition>));
  if (!job) return [];

  const deptColl = await getCVisionCollection<CVisionDepartmentRecord>(tenantId, 'departments');
  const dept = await deptColl.findOne({ tenantId, id: job.departmentId } as Filter<CVisionDepartmentRecord>);
  const jobReqs = buildJobReqs(job, dept?.name || '');

  const poolEntries = await searchTalentPool(tenantId, { status: 'ACTIVE' });
  const results: (TalentPoolEntry & { matchScore: number })[] = [];

  for (const entry of poolEntries) {
    const profile: CoreCandidateProfile = {
      candidateId: entry.candidateId,
      name: entry.candidateName,
      skills: entry.skills,
      experience: [],
      education: [],
      totalYearsExperience: entry.totalExperience,
      currentSalary: entry.expectedSalary,
    };
    const match = coreMatch(profile, jobReqs);
    if (match.overallScore >= 30) {
      results.push({ ...entry, matchScore: match.overallScore });
    }
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

// ─── Auto-populate talent pool ──────────────────────────────────────────────

export async function autoPopulateTalentPool(
  tenantId: string,
  userId: string,
): Promise<{ added: number }> {
  const [candColl, reqColl, deptColl, parseColl] = await Promise.all([
    getCVisionCollection<CVisionCandidate>(tenantId, 'candidates'),
    getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions'),
    getCVisionCollection<CVisionDepartmentRecord>(tenantId, 'departments'),
    getCVisionCollection<CVisionCvParseJobRecord>(tenantId, 'cvParseJobs'),
  ]);

  const rejected = await candColl.find(
    createTenantFilter(tenantId, {
      status: { $in: ['rejected', 'disqualified', 'withdrawn'] },
      isArchived: { $ne: true },
    } as Filter<CVisionCandidate>),
  ).toArray();

  if (rejected.length === 0) return { added: 0 };

  const openJobs = await reqColl.find(
    createTenantFilter(tenantId, { status: 'open' } as Filter<CVisionJobRequisition>),
  ).toArray();
  const depts = await deptColl.find({ tenantId }).toArray();
  const deptMap = new Map(depts.map((d) => [d.id, d.name]));
  const jobReqsList = openJobs.map(j => buildJobReqs(j, deptMap.get(j.departmentId) || ''));

  let added = 0;

  for (const cand of rejected.slice(0, 100)) {
    const parseJob = await parseColl.findOne({ tenantId, candidateId: cand.id } as Filter<CVisionCvParseJobRecord>);
    const extracted = parseJob?.extractedJson || parseJob?.metaJson || cand.metadata || {};
    const skills: string[] = extracted.skills || (cand.metadata as CandidateMetadata)?.skills || [];
    const totalYears = Number(extracted.yearsOfExperience || (cand.metadata as CandidateMetadata)?.yearsOfExperience || 0);

    const profile: CoreCandidateProfile = {
      candidateId: cand.id,
      name: cand.fullName || 'Unknown',
      skills,
      experience: [],
      education: [],
      totalYearsExperience: totalYears,
    };

    const matchedJobs: { requisitionId: string; jobTitle: string; score: number }[] = [];
    for (const jobReq of jobReqsList) {
      const match = coreMatch(profile, jobReq);
      if (match.overallScore >= 50) {
        matchedJobs.push({ requisitionId: jobReq.jobId, jobTitle: jobReq.title, score: match.overallScore });
      }
    }

    if (matchedJobs.length > 0) {
      await addToTalentPool(tenantId, {
        candidateId: cand.id,
        candidateName: cand.fullName || 'Unknown',
        email: cand.email || '',
        phone: cand.phone || undefined,
        skills,
        totalExperience: totalYears,
        source: 'AI_RECOMMENDED',
        tags: skills.slice(0, 5),
        notes: `Auto-added: matched ${matchedJobs.length} open job(s)`,
        matchedJobs: matchedJobs.sort((a, b) => b.score - a.score).slice(0, 5),
      }, userId);
      added++;
    }
  }

  return { added };
}
