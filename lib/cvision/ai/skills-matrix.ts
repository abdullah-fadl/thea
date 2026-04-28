// ─── Employee Skills Matrix ─────────────────────────────────────────────────
// Tracks, tags, and analyzes employee skills across the organization.
// Supports gap analysis, department summaries, and training recommendations.
// Pure computation — no AI API calls, no DB, no side effects.

import { SKILL_ALIASES } from './job-recommender';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface SkillDefinition {
  id: string;
  name: string;
  category: 'TECHNICAL' | 'SOFT' | 'MANAGEMENT' | 'DOMAIN' | 'LANGUAGE' | 'CERTIFICATION';
  subcategory?: string;
  description?: string;
}

export interface EmployeeSkill {
  skillId: string;
  skillName: string;
  proficiencyLevel: 1 | 2 | 3 | 4 | 5;
  selfAssessed: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  source: 'SELF_ASSESSMENT' | 'CV_EXTRACTED' | 'MANAGER_ASSIGNED' | 'CERTIFICATION' | 'TRAINING' | 'SYSTEM_GENERATED';
  lastUpdated: Date;
}

export interface EmployeeSkillProfile {
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  skills: EmployeeSkill[];
  lastAssessmentDate?: Date;
}

export interface SkillGap {
  skillName: string;
  category: string;
  requiredLevel: number;
  currentLevel: number;
  gap: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  affectedEmployees: number;
  trainingRecommendation: string;
}

export interface DepartmentSkillSummary {
  department: string;
  totalEmployees: number;
  skillCoverage: {
    skillName: string;
    employeesWithSkill: number;
    averageLevel: number;
    maxLevel: number;
  }[];
  topSkills: { name: string; count: number; avgLevel: number }[];
  skillGaps: SkillGap[];
  overallMaturityScore: number; // 0-100
}

export interface SkillSearchResult {
  employeeId: string;
  employeeName: string;
  department: string;
  proficiencyLevel: number;
  source: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Basic',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

export const DEFAULT_SKILLS: SkillDefinition[] = [
  // ── Technical ──
  { id: 'sk-js', name: 'JavaScript', category: 'TECHNICAL', subcategory: 'Frontend' },
  { id: 'sk-ts', name: 'TypeScript', category: 'TECHNICAL', subcategory: 'Frontend' },
  { id: 'sk-python', name: 'Python', category: 'TECHNICAL', subcategory: 'Backend' },
  { id: 'sk-sql', name: 'SQL', category: 'TECHNICAL', subcategory: 'Database' },
  { id: 'sk-react', name: 'React', category: 'TECHNICAL', subcategory: 'Frontend' },
  { id: 'sk-node', name: 'Node.js', category: 'TECHNICAL', subcategory: 'Backend' },
  { id: 'sk-mongodb', name: 'MongoDB', category: 'TECHNICAL', subcategory: 'Database' },
  { id: 'sk-aws', name: 'AWS', category: 'TECHNICAL', subcategory: 'DevOps' },
  { id: 'sk-docker', name: 'Docker', category: 'TECHNICAL', subcategory: 'DevOps' },
  { id: 'sk-git', name: 'Git', category: 'TECHNICAL', subcategory: 'DevOps' },

  // ── Domain (HR / Business) ──
  { id: 'sk-hr-mgmt', name: 'HR Management', category: 'DOMAIN', subcategory: 'HR' },
  { id: 'sk-payroll', name: 'Payroll Processing', category: 'DOMAIN', subcategory: 'HR' },
  { id: 'sk-recruit', name: 'Recruitment', category: 'DOMAIN', subcategory: 'HR' },
  { id: 'sk-labor-law', name: 'Labor Law', category: 'DOMAIN', subcategory: 'Legal' },
  { id: 'sk-gosi', name: 'GOSI Compliance', category: 'DOMAIN', subcategory: 'Compliance' },
  { id: 'sk-perf-mgmt', name: 'Performance Management', category: 'DOMAIN', subcategory: 'HR' },
  { id: 'sk-training', name: 'Training & Development', category: 'DOMAIN', subcategory: 'HR' },

  // ── Soft Skills ──
  { id: 'sk-leadership', name: 'Leadership', category: 'SOFT' },
  { id: 'sk-communication', name: 'Communication', category: 'SOFT' },
  { id: 'sk-problem-solving', name: 'Problem Solving', category: 'SOFT' },
  { id: 'sk-team-mgmt', name: 'Team Management', category: 'MANAGEMENT' },
  { id: 'sk-project-mgmt', name: 'Project Management', category: 'MANAGEMENT' },
  { id: 'sk-time-mgmt', name: 'Time Management', category: 'SOFT' },
  { id: 'sk-negotiation', name: 'Negotiation', category: 'SOFT' },

  // ── Languages ──
  { id: 'sk-arabic', name: 'Arabic', category: 'LANGUAGE' },
  { id: 'sk-english', name: 'English', category: 'LANGUAGE' },
  { id: 'sk-urdu', name: 'Urdu', category: 'LANGUAGE' },
  { id: 'sk-hindi', name: 'Hindi', category: 'LANGUAGE' },
  { id: 'sk-french', name: 'French', category: 'LANGUAGE' },

  // ── Certifications ──
  { id: 'sk-phr', name: 'PHR', category: 'CERTIFICATION', description: 'Professional in Human Resources' },
  { id: 'sk-shrm', name: 'SHRM-CP', category: 'CERTIFICATION', description: 'SHRM Certified Professional' },
  { id: 'sk-pmp', name: 'PMP', category: 'CERTIFICATION', description: 'Project Management Professional' },
  { id: 'sk-cipd', name: 'CIPD', category: 'CERTIFICATION', description: 'Chartered Institute of Personnel and Development' },
  { id: 'sk-six-sigma', name: 'Six Sigma', category: 'CERTIFICATION', description: 'Six Sigma Quality Certification' },
];

// ─── Internal Helpers ───────────────────────────────────────────────────────

/** Build a reverse alias map for fuzzy skill matching (reuses SKILL_ALIASES from job-recommender) */
function buildReverseAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    map.set(canonical, canonical);
    for (const alias of aliases) {
      map.set(alias, canonical);
    }
  }
  // Also add DEFAULT_SKILLS names as canonical entries
  for (const skill of DEFAULT_SKILLS) {
    const lower = skill.name.toLowerCase();
    if (!map.has(lower)) {
      map.set(lower, lower);
    }
  }
  return map;
}

const reverseAliasMap = buildReverseAliasMap();

/** Normalize a skill name to its canonical form via alias lookup. */
function normalizeSkill(skill: string): string {
  const cleaned = skill.trim().toLowerCase();
  return reverseAliasMap.get(cleaned) || cleaned;
}

/** Find a SkillDefinition by name (fuzzy). */
function findSkillDefinition(skillName: string): SkillDefinition | undefined {
  const norm = normalizeSkill(skillName);
  return DEFAULT_SKILLS.find((s) => normalizeSkill(s.name) === norm);
}

/** Estimate proficiency level from years of experience. */
function estimateProficiency(years: number): 1 | 2 | 3 | 4 | 5 {
  if (years >= 8) return 5;
  if (years >= 5) return 4;
  if (years >= 3) return 3;
  if (years >= 1) return 2;
  return 1;
}

/** Priority sort order for SkillGap (HIGH first). */
const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Extracts employee skills from parsed CV data (CVAnalysisResult format).
 * Matches extracted skills against DEFAULT_SKILLS with fuzzy alias matching.
 * Estimates proficiency from years of experience mentioned in the CV.
 */
export function extractSkillsFromCV(parsedCVData: any): EmployeeSkill[] {
  if (!parsedCVData) return [];

  const now = new Date();
  const result: EmployeeSkill[] = [];
  const seen = new Set<string>();

  // Extract skills list from parsed CV
  const rawSkills: string[] = parsedCVData.skills || [];

  // Calculate total years from experience entries for rough estimation
  const experiences: any[] = parsedCVData.experience || [];
  const totalYears = parsedCVData.yearsOfExperience ||
    experiences.reduce((sum: number, exp: any) => {
      if (exp.duration) {
        const match = String(exp.duration).match(/(\d+)/);
        return sum + (match ? parseInt(match[1]) : 1);
      }
      return sum + 1;
    }, 0);

  for (const rawSkill of rawSkills) {
    const norm = normalizeSkill(rawSkill);
    if (seen.has(norm)) continue;
    seen.add(norm);

    const def = findSkillDefinition(rawSkill);
    const skillId = def?.id || `sk-${norm.replace(/[^a-z0-9]/g, '-')}`;
    const skillName = def?.name || rawSkill;

    // Estimate proficiency: use total years as a rough proxy
    // (individual skill years are rarely available from CV parsing)
    const level = estimateProficiency(Math.min(totalYears, 15));

    result.push({
      skillId,
      skillName,
      proficiencyLevel: level,
      selfAssessed: false,
      source: 'CV_EXTRACTED',
      lastUpdated: now,
    });
  }

  // Also extract from certifications list if present
  const certifications: string[] = parsedCVData.certifications || [];
  for (const cert of certifications) {
    const norm = normalizeSkill(cert);
    if (seen.has(norm)) continue;
    seen.add(norm);

    const def = findSkillDefinition(cert);
    if (def && def.category === 'CERTIFICATION') {
      result.push({
        skillId: def.id,
        skillName: def.name,
        proficiencyLevel: 4, // Having a certification implies at least Advanced
        selfAssessed: false,
        source: 'CERTIFICATION',
        lastUpdated: now,
      });
    }
  }

  // Extract from languages if present
  const languages: string[] = parsedCVData.languages || [];
  for (const lang of languages) {
    const norm = normalizeSkill(lang);
    if (seen.has(norm)) continue;
    seen.add(norm);

    const def = findSkillDefinition(lang);
    if (def && def.category === 'LANGUAGE') {
      result.push({
        skillId: def.id,
        skillName: def.name,
        proficiencyLevel: 3, // Default to Intermediate for stated languages
        selfAssessed: false,
        source: 'CV_EXTRACTED',
        lastUpdated: now,
      });
    }
  }

  return result;
}

/**
 * Compares employee skills against required skills for their role.
 * Identifies gaps and generates bilingual training recommendations.
 * Results sorted by priority (HIGH first), then by gap size descending.
 */
export function assessSkillGaps(
  employeeSkills: EmployeeSkill[],
  requiredSkills: { skillName: string; requiredLevel: number }[]
): SkillGap[] {
  const gaps: SkillGap[] = [];

  // Build a normalized lookup of employee skills
  const employeeSkillMap = new Map<string, EmployeeSkill>();
  for (const skill of employeeSkills) {
    employeeSkillMap.set(normalizeSkill(skill.skillName), skill);
  }

  for (const req of requiredSkills) {
    const norm = normalizeSkill(req.skillName);
    const existing = employeeSkillMap.get(norm);
    const currentLevel = existing?.proficiencyLevel || 0;
    const gap = Math.max(0, req.requiredLevel - currentLevel);

    if (gap === 0) continue; // No gap — skip

    // Determine priority
    let priority: 'HIGH' | 'MEDIUM' | 'LOW';
    if (gap >= 3) priority = 'HIGH';
    else if (gap >= 2) priority = 'MEDIUM';
    else priority = 'LOW';

    const def = findSkillDefinition(req.skillName);
    const category = def?.category || 'TECHNICAL';

    let trainingRecommendation: string;

    if (priority === 'HIGH') {
      trainingRecommendation = `Urgent training needed in ${req.skillName}`;
    } else if (priority === 'MEDIUM') {
      trainingRecommendation = `Consider training program for ${req.skillName}`;
    } else {
      trainingRecommendation = `Self-study or mentoring for ${req.skillName}`;
    }

    gaps.push({
      skillName: req.skillName,
      category,
      requiredLevel: req.requiredLevel,
      currentLevel,
      gap,
      priority,
      affectedEmployees: 1, // Single employee context; aggregation uses buildDepartmentSummary
      trainingRecommendation,
    });
  }

  // Sort: HIGH first, then by gap size descending
  gaps.sort((a, b) => {
    const priDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priDiff !== 0) return priDiff;
    return b.gap - a.gap;
  });

  return gaps;
}

/**
 * Builds a department-level skills summary with coverage, top skills,
 * aggregate gaps, and an overall maturity score (0-100).
 */
export function buildDepartmentSummary(
  employees: EmployeeSkillProfile[],
  requiredSkills?: { skillName: string; requiredLevel: number }[]
): DepartmentSkillSummary {
  const department = employees[0]?.department || 'Unknown';
  const totalEmployees = employees.length;

  // Aggregate skill data across all employees
  const skillStats = new Map<string, { count: number; totalLevel: number; maxLevel: number }>();

  for (const emp of employees) {
    for (const skill of emp.skills) {
      const norm = normalizeSkill(skill.skillName);
      const existing = skillStats.get(norm) || { count: 0, totalLevel: 0, maxLevel: 0 };
      existing.count++;
      existing.totalLevel += skill.proficiencyLevel;
      existing.maxLevel = Math.max(existing.maxLevel, skill.proficiencyLevel);
      skillStats.set(norm, existing);
    }
  }

  // Build skillCoverage array
  const skillCoverage = Array.from(skillStats.entries()).map(([norm, stats]) => {
    // Find original skill name (prefer DEFAULT_SKILLS name)
    const def = DEFAULT_SKILLS.find((s) => normalizeSkill(s.name) === norm);
    return {
      skillName: def?.name || norm,
      employeesWithSkill: stats.count,
      averageLevel: Math.round((stats.totalLevel / stats.count) * 100) / 100,
      maxLevel: stats.maxLevel,
    };
  });

  // Top skills by employee count (top 10)
  const topSkills = [...skillCoverage]
    .sort((a, b) => b.employeesWithSkill - a.employeesWithSkill)
    .slice(0, 10)
    .map((s) => ({ name: s.skillName, count: s.employeesWithSkill, avgLevel: s.averageLevel }));

  // Aggregate skill gaps if required skills provided
  let skillGaps: SkillGap[] = [];
  if (requiredSkills && requiredSkills.length > 0) {
    // For each required skill, calculate department-level gap
    const gapMap = new Map<string, { totalGap: number; affected: number; levels: number[] }>();

    for (const emp of employees) {
      const empGaps = assessSkillGaps(emp.skills, requiredSkills);
      for (const gap of empGaps) {
        const norm = normalizeSkill(gap.skillName);
        const existing = gapMap.get(norm) || { totalGap: 0, affected: 0, levels: [] };
        existing.totalGap += gap.gap;
        existing.affected++;
        existing.levels.push(gap.currentLevel);
        gapMap.set(norm, existing);
      }
    }

    for (const req of requiredSkills) {
      const norm = normalizeSkill(req.skillName);
      const stats = gapMap.get(norm);
      if (!stats || stats.affected === 0) continue;

      const avgCurrentLevel = stats.levels.length > 0
        ? Math.round(stats.levels.reduce((a, b) => a + b, 0) / stats.levels.length * 100) / 100
        : 0;
      const avgGap = Math.round((stats.totalGap / stats.affected) * 100) / 100;

      let priority: 'HIGH' | 'MEDIUM' | 'LOW';
      if (avgGap >= 3) priority = 'HIGH';
      else if (avgGap >= 2) priority = 'MEDIUM';
      else priority = 'LOW';

      const def = findSkillDefinition(req.skillName);
      const category = def?.category || 'TECHNICAL';

      let trainingRecommendation: string;
      if (priority === 'HIGH') {
        trainingRecommendation = `Urgent training needed in ${req.skillName}`;
      } else if (priority === 'MEDIUM') {
        trainingRecommendation = `Consider training program for ${req.skillName}`;
      } else {
        trainingRecommendation = `Self-study or mentoring for ${req.skillName}`;
      }

      skillGaps.push({
        skillName: req.skillName,
        category,
        requiredLevel: req.requiredLevel,
        currentLevel: avgCurrentLevel,
        gap: avgGap,
        priority,
        affectedEmployees: stats.affected,
        trainingRecommendation,
      });
    }

    skillGaps.sort((a, b) => {
      const priDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priDiff !== 0) return priDiff;
      return b.gap - a.gap;
    });
  }

  // Overall maturity score: average (level / 5) * 100 across all employee skills
  let totalLevelSum = 0;
  let totalSkillCount = 0;
  for (const emp of employees) {
    for (const skill of emp.skills) {
      totalLevelSum += skill.proficiencyLevel;
      totalSkillCount++;
    }
  }
  const overallMaturityScore = totalSkillCount > 0
    ? Math.round((totalLevelSum / totalSkillCount / 5) * 100 * 100) / 100
    : 0;

  return {
    department,
    totalEmployees,
    skillCoverage,
    topSkills,
    skillGaps,
    overallMaturityScore,
  };
}

/**
 * Searches all employees for a specific skill with optional minimum proficiency.
 * Uses fuzzy matching. Returns results sorted by proficiency (highest first).
 */
export function findEmployeesWithSkill(
  employees: EmployeeSkillProfile[],
  skillName: string,
  minLevel: number = 1
): SkillSearchResult[] {
  const targetNorm = normalizeSkill(skillName);
  const results: SkillSearchResult[] = [];

  for (const emp of employees) {
    for (const skill of emp.skills) {
      if (normalizeSkill(skill.skillName) === targetNorm && skill.proficiencyLevel >= minLevel) {
        results.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          department: emp.department,
          proficiencyLevel: skill.proficiencyLevel,
          source: skill.source,
        });
        break; // One match per employee is enough
      }
    }
  }

  // Sort by proficiency descending
  results.sort((a, b) => b.proficiencyLevel - a.proficiencyLevel);

  return results;
}

/**
 * Cross-department analysis producing an organization-level skills report.
 * Identifies strongest/weakest departments, critical gaps, and recommendations.
 */
export function generateSkillsReport(
  departments: DepartmentSkillSummary[]
): {
  organizationScore: number;
  strongestDepartment: string;
  weakestDepartment: string;
  criticalGaps: SkillGap[];
  recommendations: string[];
} {
  if (departments.length === 0) {
    return {
      organizationScore: 0,
      strongestDepartment: 'N/A',
      weakestDepartment: 'N/A',
      criticalGaps: [],
      recommendations: ['No department data available for analysis.'],
    };
  }

  // Organization score: weighted average of department scores by employee count
  const totalEmployees = departments.reduce((sum, d) => sum + d.totalEmployees, 0);
  const organizationScore = totalEmployees > 0
    ? Math.round(
        departments.reduce(
          (sum, d) => sum + d.overallMaturityScore * d.totalEmployees,
          0
        ) / totalEmployees * 100
      ) / 100
    : 0;

  // Find strongest and weakest departments
  const sorted = [...departments].sort((a, b) => b.overallMaturityScore - a.overallMaturityScore);
  const strongestDepartment = sorted[0].department;
  const weakestDepartment = sorted[sorted.length - 1].department;

  // Collect all HIGH priority gaps, deduplicate by skill name
  const gapSeen = new Set<string>();
  const criticalGaps: SkillGap[] = [];
  for (const dept of departments) {
    for (const gap of dept.skillGaps) {
      if (gap.priority === 'HIGH' && !gapSeen.has(normalizeSkill(gap.skillName))) {
        gapSeen.add(normalizeSkill(gap.skillName));
        criticalGaps.push(gap);
      }
    }
  }
  criticalGaps.sort((a, b) => b.gap - a.gap);

  // Generate actionable recommendations
  const recommendations: string[] = [];

  if (criticalGaps.length > 0) {
    const topGapNames = criticalGaps.slice(0, 3).map((g) => g.skillName).join(', ');
    recommendations.push(
      `Priority training programs needed for critical skill gaps: ${topGapNames}.`
    );
  }

  if (sorted.length >= 2 && sorted[sorted.length - 1].overallMaturityScore < 40) {
    recommendations.push(
      `${weakestDepartment} has a low maturity score (${sorted[sorted.length - 1].overallMaturityScore}%). Consider a dedicated skills development plan.`
    );
  }

  const avgSkillsPerEmployee = totalEmployees > 0
    ? departments.reduce(
        (sum, d) => sum + d.skillCoverage.reduce((s, sc) => s + sc.employeesWithSkill, 0),
        0
      ) / totalEmployees
    : 0;

  if (avgSkillsPerEmployee < 3) {
    recommendations.push(
      'Low average skill entries per employee. Launch a company-wide self-assessment campaign to build a complete skills inventory.'
    );
  }

  if (organizationScore < 50) {
    recommendations.push(
      'Organization maturity score is below 50%. Invest in structured L&D programs with measurable skill progression targets.'
    );
  }

  const certsCount = departments.reduce(
    (sum, d) => sum + d.skillCoverage.filter((sc) => {
      const def = findSkillDefinition(sc.skillName);
      return def?.category === 'CERTIFICATION';
    }).length,
    0
  );

  if (certsCount === 0) {
    recommendations.push(
      'No professional certifications detected. Consider sponsoring industry certifications (PHR, SHRM-CP, PMP) for key employees.'
    );
  }

  // Ensure at least one recommendation
  if (recommendations.length === 0) {
    recommendations.push(
      'Skills matrix is healthy. Continue regular assessments and encourage cross-departmental skill sharing.'
    );
  }

  return {
    organizationScore,
    strongestDepartment,
    weakestDepartment,
    criticalGaps,
    recommendations,
  };
}
