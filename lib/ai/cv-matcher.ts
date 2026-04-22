/**
 * CV Matcher — Heuristic candidate/job matching engine
 *
 * Scores candidates against job requirements using skill overlap,
 * experience, and education matching.
 */

export interface JobSummary {
  id: string;
  title: string;
  titleAr?: string;
  department?: string;
  requirements?: string[];
  requiredSkills?: string[];
  minExperience?: number;
  requiredDegree?: string;
  preferredSkills?: string[];
  [key: string]: any;
}

export interface CandidateSummary {
  id: string;
  name: string;
  skills: string[];
  experience?: number; // total years
  education?: string;  // highest degree
  experienceEntries?: { title: string; years: number; company?: string }[];
  certifications?: string[];
  [key: string]: any;
}

export interface AIMatchResult {
  jobId: string;
  jobTitle: string;
  department?: string;
  matchScore: number;
  reasoning: string;
  matchedSkills: string[];
  missingSkills: string[];
  strengthPoints: string[];
  gaps: string[];
  [key: string]: any;
}

export interface AICandidateMatchResult {
  candidateId: string;
  candidateName: string;
  matchScore: number;
  reasoning: string;
  matchedSkills: string[];
  missingSkills: string[];
  strengthPoints: string[];
  gaps: string[];
  [key: string]: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normalizeSkills(skills: string[]): Set<string> {
  return new Set(skills.map(s => s.toLowerCase().trim()));
}

function computeSkillOverlap(
  candidateSkills: Set<string>,
  requiredSkills: string[],
  preferredSkills: string[] = []
): { matched: string[]; missing: string[]; preferredMatched: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];
  const preferredMatched: string[] = [];

  for (const skill of requiredSkills) {
    if (candidateSkills.has(skill.toLowerCase().trim())) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  for (const skill of preferredSkills) {
    if (candidateSkills.has(skill.toLowerCase().trim())) {
      preferredMatched.push(skill);
    }
  }

  return { matched, missing, preferredMatched };
}

function buildReasoning(
  matchedSkills: string[],
  missingSkills: string[],
  strengthPoints: string[],
  gaps: string[],
  score: number
): string {
  const parts: string[] = [];
  if (score >= 80) parts.push('Strong match.');
  else if (score >= 60) parts.push('Good match with some gaps.');
  else if (score >= 40) parts.push('Partial match.');
  else parts.push('Weak match.');

  if (matchedSkills.length > 0) {
    parts.push(`${matchedSkills.length} required skills matched.`);
  }
  if (missingSkills.length > 0) {
    parts.push(`${missingSkills.length} required skills missing.`);
  }
  if (strengthPoints.length > 0) {
    parts.push(`Strengths: ${strengthPoints.join(', ')}.`);
  }
  if (gaps.length > 0) {
    parts.push(`Gaps: ${gaps.join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Match a single candidate against multiple jobs.
 * Returns scored results sorted by matchScore descending.
 */
export async function aiMatchCandidateToJobs(
  candidate: CandidateSummary,
  jobs: JobSummary[],
  limit?: number
): Promise<AIMatchResult[]> {
  if (!jobs.length || !candidate.skills?.length) return [];

  const candidateSkills = normalizeSkills(candidate.skills);
  const totalExperience = candidate.experience || 0;
  const highestDegree = (candidate.education || '').toLowerCase();

  const results: AIMatchResult[] = jobs.map(job => {
    let score = 0;
    const strengthPoints: string[] = [];
    const gaps: string[] = [];

    // 1. Skill matching (0-50 points)
    const reqSkills = job.requiredSkills || job.requirements || [];
    const prefSkills = job.preferredSkills || [];
    const { matched, missing, preferredMatched } = computeSkillOverlap(candidateSkills, reqSkills, prefSkills);

    if (reqSkills.length > 0) {
      score += (matched.length / reqSkills.length) * 50;
    } else {
      // No specific skills listed — give partial credit based on candidate having skills
      score += Math.min(25, candidateSkills.size * 2);
    }

    if (preferredMatched.length > 0) {
      score += Math.min(10, preferredMatched.length * 3);
      strengthPoints.push(`${preferredMatched.length} preferred skills`);
    }

    // 2. Experience matching (0-25 points)
    const minExp = job.minExperience || 0;
    if (minExp > 0) {
      if (totalExperience >= minExp) {
        score += 25;
        strengthPoints.push(`${totalExperience}y experience (${minExp}y required)`);
        if (totalExperience >= minExp * 1.5) {
          strengthPoints.push('Exceeds experience requirements');
        }
      } else {
        const ratio = totalExperience / minExp;
        score += ratio * 15;
        gaps.push(`Experience: ${totalExperience}y of ${minExp}y required`);
      }
    } else {
      score += 12; // neutral
    }

    // 3. Education matching (0-15 points)
    const reqDegree = (job.requiredDegree || '').toLowerCase();
    if (reqDegree) {
      if (highestDegree.includes(reqDegree) || reqDegree.includes(highestDegree)) {
        score += 15;
        strengthPoints.push('Education requirement met');
      } else if (highestDegree) {
        score += 5;
        gaps.push(`Education: has ${highestDegree}, requires ${reqDegree}`);
      } else {
        gaps.push(`Education: ${reqDegree} required but not specified`);
      }
    } else {
      score += 8; // neutral
    }

    const clampedScore = Math.round(Math.min(100, Math.max(0, score)));

    return {
      jobId: job.id,
      jobTitle: job.title,
      department: job.department,
      matchScore: clampedScore,
      reasoning: buildReasoning(matched, missing, strengthPoints, gaps, clampedScore),
      matchedSkills: matched,
      missingSkills: missing,
      strengthPoints,
      gaps,
    };
  });

  results.sort((a, b) => b.matchScore - a.matchScore);
  return limit ? results.slice(0, limit) : results;
}

/**
 * Match a single job against multiple candidates.
 * Returns scored results sorted by matchScore descending.
 */
export async function aiMatchJobToCandidates(
  job: JobSummary,
  candidates: CandidateSummary[],
  limit?: number
): Promise<AICandidateMatchResult[]> {
  if (!candidates.length) return [];

  const reqSkills = job.requiredSkills || job.requirements || [];
  const prefSkills = job.preferredSkills || [];
  const minExp = job.minExperience || 0;
  const reqDegree = (job.requiredDegree || '').toLowerCase();

  const results: AICandidateMatchResult[] = candidates.map(candidate => {
    let score = 0;
    const strengthPoints: string[] = [];
    const gaps: string[] = [];

    const candidateSkills = normalizeSkills(candidate.skills || []);
    const totalExperience = candidate.experience || 0;
    const highestDegree = (candidate.education || '').toLowerCase();

    // 1. Skill matching (0-50 points)
    const { matched, missing, preferredMatched } = computeSkillOverlap(candidateSkills, reqSkills, prefSkills);

    if (reqSkills.length > 0) {
      score += (matched.length / reqSkills.length) * 50;
    } else {
      score += Math.min(25, candidateSkills.size * 2);
    }

    if (preferredMatched.length > 0) {
      score += Math.min(10, preferredMatched.length * 3);
      strengthPoints.push(`${preferredMatched.length} preferred skills`);
    }

    // 2. Experience (0-25 points)
    if (minExp > 0) {
      if (totalExperience >= minExp) {
        score += 25;
        strengthPoints.push(`${totalExperience}y experience`);
      } else {
        score += (totalExperience / minExp) * 15;
        gaps.push(`Experience: ${totalExperience}y of ${minExp}y required`);
      }
    } else {
      score += 12;
    }

    // 3. Education (0-15 points)
    if (reqDegree) {
      if (highestDegree.includes(reqDegree)) {
        score += 15;
        strengthPoints.push('Education match');
      } else if (highestDegree) {
        score += 5;
        gaps.push(`Education mismatch`);
      }
    } else {
      score += 8;
    }

    const clampedScore = Math.round(Math.min(100, Math.max(0, score)));

    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      matchScore: clampedScore,
      reasoning: buildReasoning(matched, missing, strengthPoints, gaps, clampedScore),
      matchedSkills: matched,
      missingSkills: missing,
      strengthPoints,
      gaps,
    };
  });

  results.sort((a, b) => b.matchScore - a.matchScore);
  return limit ? results.slice(0, limit) : results;
}
