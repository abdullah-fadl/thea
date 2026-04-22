// ─── Smart Job Recommender ───────────────────────────────────────────────────
// Deterministic multi-job matching system that ranks candidates across open
// positions using weighted scoring with fuzzy skill matching.
// Pure computation — no AI API calls, no DB, no side effects.

import { getSkillsForJobTitle } from './skill-mappings';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface JobRequirements {
  jobId: string;
  title: string;
  department: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExperience: number; // years
  education: string;
  location?: string;
  salaryRange?: { min: number; max: number };
}

export interface CandidateProfile {
  candidateId: string;
  name: string;
  skills: string[];
  experience: { title: string; company: string; years: number }[];
  education: { degree: string; field: string; institution: string }[];
  totalYearsExperience: number;
  currentSalary?: number;
  preferredLocation?: string;
  cvText?: string;
  currentTitle?: string;
}

export interface MatchResult {
  jobId: string;
  jobTitle: string;
  department?: string;
  candidateId: string;
  candidateName: string;
  overallScore: number; // 0-100
  breakdown: {
    skillMatch: number;
    experienceMatch: number;
    educationMatch: number;
    salaryFit: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  missingPreferredSkills?: string[];
  recommendation: 'STRONG_MATCH' | 'GOOD_MATCH' | 'PARTIAL_MATCH' | 'WEAK_MATCH';
  reasoning: string;
  debugInfo?: {
    candidateSkillsUsed: string[];
    skillSource: string;
    experienceYears: number;
    educationLevel: string;
  };
}

export interface RecommendationReport {
  candidateId: string;
  candidateName: string;
  topMatches: MatchResult[];
  generatedAt: Date;
  totalJobsAnalyzed: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Common skill aliases for fuzzy matching */
export const SKILL_ALIASES: Record<string, string[]> = {
  javascript: ['js', 'ecmascript', 'es6', 'es2015'],
  typescript: ['ts'],
  react: ['reactjs', 'react.js', 'react js'],
  node: ['nodejs', 'node.js', 'node js'],
  python: ['py', 'python3'],
  vue: ['vuejs', 'vue.js'],
  angular: ['angularjs', 'angular.js'],
  postgres: ['postgresql', 'psql', 'pgsql'],
  mongodb: ['mongo', 'mongo db'],
  aws: ['amazon web services', 'amazon aws'],
  gcp: ['google cloud', 'google cloud platform'],
  azure: ['microsoft azure', 'ms azure'],
  ml: ['machine learning'],
  ai: ['artificial intelligence'],
  hr: ['human resources'],
  erp: ['enterprise resource planning'],
  css: ['css3', 'cascading style sheets'],
  html: ['html5', 'hypertext markup language'],
  sql: ['structured query language', 'mysql', 'mssql', 'sql server', 't-sql', 'tsql'],
  excel: ['microsoft excel', 'ms excel', 'spreadsheet'],
  nursing: ['rn', 'registered nurse', 'bsn', 'clinical nursing', 'nurse'],
  pharmacy: ['pharmacist', 'pharmd', 'pharmaceutical'],
  accounting: ['bookkeeping', 'financial accounting', 'cpa'],
  data_analysis: ['data analytics', 'data analyst', 'data science', 'data mining'],
  project_management: ['pmp', 'project manager', 'pm', 'scrum master'],
  leadership: ['team leadership', 'team lead', 'people management'],
  communication: ['communications', 'interpersonal skills', 'public speaking'],
  management: ['managerial', 'managing', 'supervisor', 'supervisory'],
  marketing: ['digital marketing', 'marketing management'],
  finance: ['financial analysis', 'financial management', 'financial planning'],
  procurement: ['purchasing', 'supply chain', 'sourcing'],
};

/** Skill categories for partial matching */
const SKILL_CATEGORIES: Record<string, string[]> = {
  frontend: ['javascript', 'typescript', 'react', 'vue', 'angular', 'html', 'css', 'next.js', 'nextjs', 'tailwind'],
  backend: ['node', 'python', 'java', 'c#', '.net', 'go', 'ruby', 'php', 'spring'],
  database: ['sql', 'postgres', 'mongodb', 'mysql', 'redis', 'elasticsearch', 'dynamodb'],
  cloud: ['aws', 'gcp', 'azure', 'docker', 'kubernetes', 'devops', 'ci/cd'],
  data: ['data_analysis', 'python', 'sql', 'excel', 'tableau', 'power bi', 'r', 'statistics'],
  healthcare: ['nursing', 'pharmacy', 'medical', 'clinical', 'patient care', 'bls', 'acls'],
  business: ['management', 'leadership', 'communication', 'project_management', 'strategy'],
  finance_category: ['accounting', 'finance', 'budgeting', 'auditing', 'tax', 'excel'],
  hr_category: ['hr', 'recruitment', 'talent acquisition', 'compensation', 'payroll', 'employee relations'],
};

/** Education level hierarchy for comparison */
const EDUCATION_LEVELS: Record<string, number> = {
  high_school: 1,
  secondary: 1,
  diploma: 2,
  associate: 2,
  bachelor: 3,
  bachelors: 3,
  bsc: 3,
  ba: 3,
  bsn: 3,
  master: 4,
  masters: 4,
  msc: 4,
  mba: 4,
  phd: 5,
  doctorate: 5,
  md: 5,
};

const RECOMMENDATION_LABELS: Record<MatchResult['recommendation'], string> = {
  STRONG_MATCH: 'Strong match',
  GOOD_MATCH: 'Good match',
  PARTIAL_MATCH: 'Partial match',
  WEAK_MATCH: 'Weak match',
};

// Title-to-skills inference now uses the shared ROLE_SKILL_MAP via getSkillsForJobTitle()

// ─── Internal Helpers ───────────────────────────────────────────────────────

function buildReverseAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    map.set(canonical, canonical);
    for (const alias of aliases) {
      map.set(alias, canonical);
    }
  }
  return map;
}

const reverseAliasMap = buildReverseAliasMap();

function normalizeSkill(skill: string): string {
  const cleaned = skill.trim().toLowerCase();
  return reverseAliasMap.get(cleaned) || cleaned;
}

function getSkillCategory(skill: string): string | null {
  const norm = normalizeSkill(skill);
  for (const [cat, skills] of Object.entries(SKILL_CATEGORIES)) {
    if (skills.includes(norm)) return cat;
  }
  return null;
}

/**
 * Infer skills from a job title string using the shared role-based mapping.
 * Returns lowercase normalized skills for matching purposes.
 */
function inferSkillsFromTitle(title: string): string[] {
  if (!title) return [];
  const skills = getSkillsForJobTitle(title);
  // Return lowercase for matching compatibility
  return skills.map(s => s.toLowerCase());
}

/**
 * Extract skill-like keywords from CV raw text for fallback matching.
 */
function extractSkillKeywordsFromText(text: string): string[] {
  if (!text || text.length < 50) return [];
  const textLower = text.toLowerCase();
  const found: string[] = [];

  // Check all known skill aliases and canonical names
  const allKnownSkills = new Set<string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    allKnownSkills.add(canonical);
    for (const alias of aliases) allKnownSkills.add(alias);
  }

  for (const skill of allKnownSkills) {
    if (skill.length < 2) continue;
    // Word-boundary matching for short skills, substring for longer ones
    if (skill.length <= 3) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) found.push(normalizeSkill(skill));
    } else {
      if (textLower.includes(skill)) found.push(normalizeSkill(skill));
    }
  }

  return [...new Set(found)];
}

// ─── Scoring Functions ──────────────────────────────────────────────────────

/**
 * Calculates skill match score with fuzzy alias + partial + category matching.
 * Required skills contribute 70% weight, preferred skills 30%.
 */
export function calculateSkillMatch(
  candidateSkills: string[],
  requiredSkills: string[],
  preferredSkills: string[]
): { score: number; matched: string[]; missing: string[]; missingPreferred: string[] } {
  const candidateNormalized = new Set(candidateSkills.map(normalizeSkill));
  const candidateCategories = new Set(
    candidateSkills.map(s => getSkillCategory(s)).filter(Boolean) as string[]
  );
  const matched: string[] = [];
  const missing: string[] = [];
  const missingPreferred: string[] = [];

  // Match required skills (exact → category fallback)
  let matchedRequired = 0;
  for (const skill of requiredSkills) {
    const norm = normalizeSkill(skill);
    if (candidateNormalized.has(norm)) {
      matchedRequired++;
      matched.push(skill);
    } else {
      let partialFound = false;
      for (const cs of candidateNormalized) {
        if ((cs.length >= 4 && norm.includes(cs)) || (norm.length >= 4 && cs.includes(norm))) {
          matchedRequired += 0.8;
          matched.push(`${skill} (~partial)`);
          partialFound = true;
          break;
        }
      }

      if (!partialFound) {
        const skillCat = getSkillCategory(skill);
        if (skillCat && candidateCategories.has(skillCat)) {
          matchedRequired += 0.5;
          matched.push(`${skill} (~category)`);
        } else {
          missing.push(skill);
        }
      }
    }
  }

  // Match preferred skills
  let matchedPreferred = 0;
  for (const skill of preferredSkills) {
    const norm = normalizeSkill(skill);
    if (candidateNormalized.has(norm)) {
      matchedPreferred++;
      if (!matched.includes(skill)) matched.push(skill);
    } else {
      let found = false;
      for (const cs of candidateNormalized) {
        if ((cs.length >= 4 && norm.includes(cs)) || (norm.length >= 4 && cs.includes(norm))) {
          matchedPreferred += 0.7;
          if (!matched.some(m => m.startsWith(skill))) matched.push(`${skill} (~partial)`);
          found = true;
          break;
        }
      }
      if (!found) {
        missingPreferred.push(skill);
      }
    }
  }

  // Calculate weighted score
  const requiredScore = requiredSkills.length > 0
    ? (matchedRequired / requiredSkills.length) * 70
    : 70;
  const preferredScore = preferredSkills.length > 0
    ? (matchedPreferred / preferredSkills.length) * 30
    : 30;

  const score = Math.round((requiredScore + preferredScore) * 100) / 100;

  return { score, matched, missing, missingPreferred };
}

/**
 * Calculates experience match score.
 */
export function calculateExperienceMatch(
  candidateYears: number,
  requiredYears: number
): number {
  if (requiredYears <= 0) return 100;
  if (candidateYears >= requiredYears) return 100;
  if (candidateYears >= requiredYears * 0.75) return 75;
  if (candidateYears >= requiredYears * 0.5) return 50;
  return 25;
}

/**
 * Calculates education match score.
 */
export function calculateEducationMatch(
  candidateEdu: CandidateProfile['education'],
  requiredEdu: string
): number {
  const requiredLevel = EDUCATION_LEVELS[requiredEdu.toLowerCase().replace(/[\s-]/g, '_')];

  if (!requiredLevel) return 50;
  if (candidateEdu.length === 0) return 50;

  let highestLevel = 0;
  for (const edu of candidateEdu) {
    const normalized = edu.degree.toLowerCase().replace(/[\s-]/g, '_');
    let level = EDUCATION_LEVELS[normalized] || 0;
    if (level === 0) {
      for (const [key, val] of Object.entries(EDUCATION_LEVELS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          level = Math.max(level, val);
        }
      }
    }
    highestLevel = Math.max(highestLevel, level);
  }

  if (highestLevel === 0) return 50;
  if (highestLevel >= requiredLevel) return 100;
  if (highestLevel === requiredLevel - 1) return 60;
  return 30;
}

/**
 * Calculates salary fit score.
 */
export function calculateSalaryFit(
  candidateSalary: number | undefined,
  salaryRange: { min: number; max: number } | undefined
): number {
  if (candidateSalary === undefined || !salaryRange) return 80;

  if (candidateSalary >= salaryRange.min && candidateSalary <= salaryRange.max) {
    return 100;
  }
  if (candidateSalary < salaryRange.min) {
    return 90;
  }
  const overagePercent = ((candidateSalary - salaryRange.max) / salaryRange.max) * 100;
  if (overagePercent <= 10) return 70;
  return 40;
}

// ─── Main Matching ──────────────────────────────────────────────────────────

/**
 * Matches a single candidate to a single job opening.
 * Now handles missing skills by inferring from job title and CV text.
 *
 * Weights: Skills 40%, Experience 25%, Education 20%, Salary 15%
 */
export function matchCandidateToJob(
  candidate: CandidateProfile,
  job: JobRequirements
): MatchResult {
  // Determine effective skills with fallback chain
  let effectiveSkills = candidate.skills;
  let skillSource = 'parsed_cv';

  if (effectiveSkills.length === 0 && candidate.currentTitle) {
    effectiveSkills = inferSkillsFromTitle(candidate.currentTitle);
    skillSource = effectiveSkills.length > 0 ? 'inferred_from_title' : 'none';
  }

  if (effectiveSkills.length === 0 && candidate.cvText) {
    effectiveSkills = extractSkillKeywordsFromText(candidate.cvText);
    skillSource = effectiveSkills.length > 0 ? 'extracted_from_cv_text' : 'none';
  }

  if (effectiveSkills.length === 0) {
    skillSource = 'none';
  }

  // Calculate individual scores
  const skillResult = calculateSkillMatch(effectiveSkills, job.requiredSkills, job.preferredSkills);
  const experienceScore = calculateExperienceMatch(candidate.totalYearsExperience, job.minExperience);
  const educationScore = calculateEducationMatch(candidate.education, job.education);
  const salaryScore = calculateSalaryFit(candidate.currentSalary, job.salaryRange);

  // If no skills at all, give a small neutral score instead of 0
  // This prevents all skillless candidates from being identical
  let adjustedSkillScore = skillResult.score;
  if (effectiveSkills.length === 0) {
    // Give some variance based on experience and education to differentiate
    adjustedSkillScore = Math.min(30, 15 + (experienceScore > 75 ? 10 : 0) + (educationScore > 75 ? 5 : 0));
  }

  // Weighted overall score
  const overallScore = Math.round(
    (adjustedSkillScore * 0.40 +
      experienceScore * 0.25 +
      educationScore * 0.20 +
      salaryScore * 0.15) * 10
  ) / 10;

  // Determine recommendation tier
  let recommendation: MatchResult['recommendation'];
  if (overallScore >= 80) recommendation = 'STRONG_MATCH';
  else if (overallScore >= 60) recommendation = 'GOOD_MATCH';
  else if (overallScore >= 40) recommendation = 'PARTIAL_MATCH';
  else recommendation = 'WEAK_MATCH';

  // Generate reasoning
  const labels = RECOMMENDATION_LABELS[recommendation];

  const expMeetsEn = experienceScore >= 100 ? 'meets'
    : experienceScore >= 75 ? 'partially meets' : 'is below';

  const eduMeetsEn = educationScore >= 100 ? 'meets' : 'below';

  // Build detailed reasoning with match explanation
  const skillLine = effectiveSkills.length > 0
    ? `Matched ${skillResult.matched.length}/${job.requiredSkills.length} required skills` +
      (skillResult.matched.length > 0 ? ` (${skillResult.matched.filter(s => !s.includes('~')).slice(0, 5).join(', ')})` : '') +
      (skillResult.missing.length > 0 ? `. Missing: ${skillResult.missing.slice(0, 3).join(', ')}` : '')
    : 'No skills data available — score based on experience and education';

  const reasoning = `${labels} for ${job.title}. ` +
    `${skillLine}. ` +
    `${candidate.totalYearsExperience} years experience ${expMeetsEn} the ${job.minExperience} year requirement. ` +
    `Education level ${eduMeetsEn} requirements.`;

  return {
    jobId: job.jobId,
    jobTitle: job.title,
    department: job.department,
    candidateId: candidate.candidateId,
    candidateName: candidate.name,
    overallScore,
    breakdown: {
      skillMatch: adjustedSkillScore,
      experienceMatch: experienceScore,
      educationMatch: educationScore,
      salaryFit: salaryScore,
    },
    matchedSkills: skillResult.matched,
    missingSkills: skillResult.missing,
    missingPreferredSkills: skillResult.missingPreferred,
    recommendation,
    reasoning,
    debugInfo: {
      candidateSkillsUsed: effectiveSkills,
      skillSource,
      experienceYears: candidate.totalYearsExperience,
      educationLevel: candidate.education.length > 0
        ? candidate.education.map(e => e.degree).join(', ')
        : 'none',
    },
  };
}

// ─── Recommendation Engines ─────────────────────────────────────────────────

export function recommendJobsForCandidate(
  candidate: CandidateProfile,
  jobs: JobRequirements[],
  limit: number = 5
): RecommendationReport {
  const allMatches = jobs.map((job) => matchCandidateToJob(candidate, job));
  allMatches.sort((a, b) => b.overallScore - a.overallScore);

  return {
    candidateId: candidate.candidateId,
    candidateName: candidate.name,
    topMatches: allMatches.slice(0, limit),
    generatedAt: new Date(),
    totalJobsAnalyzed: jobs.length,
  };
}

export function recommendCandidatesForJob(
  job: JobRequirements,
  candidates: CandidateProfile[],
  limit: number = 10
): MatchResult[] {
  const allMatches = candidates.map((candidate) => matchCandidateToJob(candidate, job));
  allMatches.sort((a, b) => b.overallScore - a.overallScore);

  return allMatches.slice(0, limit);
}
