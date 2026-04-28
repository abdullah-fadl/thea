/**
 * CVision Performance Review Engine
 *
 * Self-contained module with all interfaces, the default review template,
 * rating map, and pure computation functions for performance reviews.
 * No database or API dependencies — pure logic only.
 */

// =============================================================================
// Interfaces
// =============================================================================

export interface ReviewCriterion {
  id: string;
  name: string;
  description: string;
  maxScore: number; // default 5
}

export interface ReviewCategory {
  id: string;
  name: string;
  weight: number; // percentage (0-100), all categories sum to 100
  criteria: ReviewCriterion[];
}

export interface ReviewTemplate {
  id: string;
  name: string;
  categories: ReviewCategory[];
  totalWeight: number; // should be 100
}

export type ReviewCycleStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface ReviewCycle {
  id: string;
  tenantId: string;
  name: string;
  type: 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'PROBATION';
  year: number;
  status: ReviewCycleStatus;
  startDate: string;
  endDate: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  selfReviewDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CriterionScore {
  criterionId: string;
  score: number; // 1-5
  comment?: string;
}

export type EmployeeReviewStatus =
  | 'NOT_STARTED'
  | 'SELF_REVIEW'
  | 'MANAGER_REVIEW'
  | 'CALIBRATION'
  | 'COMPLETED'
  | 'ACKNOWLEDGED';

export interface ReviewGoal {
  id: string;
  goal: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED';
}

export interface EmployeeReview {
  id: string;
  tenantId: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;
  jobTitle: string;
  reviewerId: string;
  reviewerName: string;
  status: EmployeeReviewStatus;
  selfScores: CriterionScore[];
  managerScores: CriterionScore[];
  overallSelfScore: number;
  overallManagerScore: number;
  finalScore: number;
  rating: string;
  managerComments: string;
  employeeComments: string;
  goals: ReviewGoal[];
  developmentPlan: string;
  promotionRecommendation: boolean;
  salaryIncreaseRecommendation: boolean;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface RatingTier {
  key: string;
  label: string;
  min: number;
  max: number;
  color: string;
}

export interface CategoryScoreResult {
  categoryId: string;
  categoryName: string;
  weight: number;
  rawAverage: number;
  weightedScore: number;
  criterionCount: number;
  scoredCount: number;
}

export interface ReviewSummary {
  overallScore: number;
  rating: RatingTier;
  categoryBreakdown: CategoryScoreResult[];
  scoredCriteria: number;
  totalCriteria: number;
}

export interface DepartmentStat {
  departmentId: string;
  departmentName: string;
  employeeCount: number;
  completedCount: number;
  averageScore: number;
  completionRate: number;
  distribution: Record<string, number>;
}

export interface CalibrationReport {
  cycleId: string;
  totalReviews: number;
  completedReviews: number;
  averageScore: number;
  distribution: Record<string, number>;
  departmentStats: DepartmentStat[];
  topPerformers: { employeeId: string; employeeName: string; score: number; rating: string }[];
  bottomPerformers: { employeeId: string; employeeName: string; score: number; rating: string }[];
}

// =============================================================================
// Rating Map
// =============================================================================

export const RATING_MAP: RatingTier[] = [
  { key: 'EXCEPTIONAL', label: 'Exceptional', min: 4.5, max: 5.0, color: 'emerald' },
  { key: 'EXCEEDS_EXPECTATIONS', label: 'Exceeds Expectations', min: 3.5, max: 4.49, color: 'blue' },
  { key: 'MEETS_EXPECTATIONS', label: 'Meets Expectations', min: 2.5, max: 3.49, color: 'amber' },
  { key: 'NEEDS_IMPROVEMENT', label: 'Needs Improvement', min: 1.5, max: 2.49, color: 'orange' },
  { key: 'UNSATISFACTORY', label: 'Unsatisfactory', min: 0, max: 1.49, color: 'red' },
];

export const RATING_BADGE_COLORS: Record<string, string> = {
  EXCEPTIONAL: 'bg-emerald-100 text-emerald-800',
  EXCEEDS_EXPECTATIONS: 'bg-blue-100 text-blue-800',
  MEETS_EXPECTATIONS: 'bg-amber-100 text-amber-800',
  NEEDS_IMPROVEMENT: 'bg-orange-100 text-orange-800',
  UNSATISFACTORY: 'bg-red-100 text-red-800',
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not Started',
  SELF_REVIEW: 'Self Review',
  MANAGER_REVIEW: 'Manager Review',
  CALIBRATION: 'Calibration',
  COMPLETED: 'Completed',
  ACKNOWLEDGED: 'Acknowledged',
};

export const REVIEW_STATUS_BADGE: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-800',
  SELF_REVIEW: 'bg-blue-100 text-blue-800',
  MANAGER_REVIEW: 'bg-indigo-100 text-indigo-800',
  CALIBRATION: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ACKNOWLEDGED: 'bg-emerald-100 text-emerald-800',
};

export const CYCLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const CYCLE_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

// =============================================================================
// Default Review Template
// =============================================================================

export const DEFAULT_REVIEW_TEMPLATE: ReviewTemplate = {
  id: 'default-template-v1',
  name: 'Standard Performance Review',
  totalWeight: 100,
  categories: [
    {
      id: 'cat-knowledge',
      name: 'Job Knowledge & Technical Skills',
      weight: 20,
      criteria: [
        {
          id: 'crit-tech-competency',
          name: 'Technical competency in role',
          description: 'Demonstrates expertise and proficiency in the technical aspects of the role',
          maxScore: 5,
        },
        {
          id: 'crit-tools-knowledge',
          name: 'Knowledge of tools and systems',
          description: 'Proficient in using required tools, software, and systems',
          maxScore: 5,
        },
        {
          id: 'crit-work-quality',
          name: 'Quality of work output',
          description: 'Consistently produces accurate, thorough, and high-quality work',
          maxScore: 5,
        },
        {
          id: 'crit-problem-solving',
          name: 'Problem-solving ability',
          description: 'Effectively identifies problems and develops practical solutions',
          maxScore: 5,
        },
      ],
    },
    {
      id: 'cat-productivity',
      name: 'Productivity & Results',
      weight: 25,
      criteria: [
        {
          id: 'crit-targets',
          name: 'Achievement of targets/KPIs',
          description: 'Consistently meets or exceeds assigned targets and KPIs',
          maxScore: 5,
        },
        {
          id: 'crit-deadlines',
          name: 'Meeting deadlines',
          description: 'Completes work within established timelines',
          maxScore: 5,
        },
        {
          id: 'crit-efficiency',
          name: 'Efficiency and time management',
          description: 'Uses time effectively and prioritizes tasks appropriately',
          maxScore: 5,
        },
        {
          id: 'crit-initiative',
          name: 'Initiative and proactiveness',
          description: 'Takes initiative, anticipates needs, and acts without being asked',
          maxScore: 5,
        },
      ],
    },
    {
      id: 'cat-communication',
      name: 'Communication & Teamwork',
      weight: 20,
      criteria: [
        {
          id: 'crit-verbal-written',
          name: 'Verbal and written communication',
          description: 'Communicates clearly and effectively in all forms',
          maxScore: 5,
        },
        {
          id: 'crit-collaboration',
          name: 'Collaboration with team',
          description: 'Works effectively with colleagues, contributes to team goals',
          maxScore: 5,
        },
        {
          id: 'crit-stakeholders',
          name: 'Relationship with stakeholders',
          description: 'Builds and maintains positive relationships with internal and external stakeholders',
          maxScore: 5,
        },
        {
          id: 'crit-knowledge-sharing',
          name: 'Knowledge sharing',
          description: 'Shares expertise and helps others develop their skills',
          maxScore: 5,
        },
      ],
    },
    {
      id: 'cat-leadership',
      name: 'Leadership & Growth',
      weight: 20,
      criteria: [
        {
          id: 'crit-leadership',
          name: 'Leadership qualities',
          description: 'Demonstrates leadership through influence, decision-making, and accountability',
          maxScore: 5,
        },
        {
          id: 'crit-mentoring',
          name: 'Mentoring and coaching',
          description: 'Actively mentors and coaches team members to improve performance',
          maxScore: 5,
        },
        {
          id: 'crit-professional-dev',
          name: 'Professional development',
          description: 'Pursues learning opportunities and professional growth',
          maxScore: 5,
        },
        {
          id: 'crit-adaptability',
          name: 'Adaptability to change',
          description: 'Adapts to new processes, technologies, and organizational changes',
          maxScore: 5,
        },
      ],
    },
    {
      id: 'cat-professionalism',
      name: 'Attendance & Professionalism',
      weight: 15,
      criteria: [
        {
          id: 'crit-attendance',
          name: 'Attendance and punctuality',
          description: 'Maintains regular attendance and arrives on time',
          maxScore: 5,
        },
        {
          id: 'crit-policies',
          name: 'Adherence to policies',
          description: 'Follows organizational policies, procedures, and guidelines',
          maxScore: 5,
        },
        {
          id: 'crit-conduct',
          name: 'Professional conduct',
          description: 'Maintains professional behavior and appearance',
          maxScore: 5,
        },
        {
          id: 'crit-ethics',
          name: 'Workplace ethics',
          description: 'Demonstrates integrity, honesty, and ethical behavior',
          maxScore: 5,
        },
      ],
    },
  ],
};

// =============================================================================
// Score Labels
// =============================================================================

export const SCORE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

// =============================================================================
// Pure Computation Functions
// =============================================================================

/**
 * Calculate score for a single category based on criterion scores.
 * Returns the raw average (1-5) and weighted contribution.
 */
export function calculateCategoryScore(
  scores: CriterionScore[],
  category: ReviewCategory
): CategoryScoreResult {
  const criterionIds = new Set(category.criteria.map((c) => c.id));
  const relevantScores = scores.filter((s) => criterionIds.has(s.criterionId) && s.score > 0);

  const rawAverage =
    relevantScores.length > 0
      ? relevantScores.reduce((sum, s) => sum + s.score, 0) / relevantScores.length
      : 0;

  const weightedScore = rawAverage * (category.weight / 100);

  return {
    categoryId: category.id,
    categoryName: category.name,
    weight: category.weight,
    rawAverage: Math.round(rawAverage * 100) / 100,
    weightedScore: Math.round(weightedScore * 100) / 100,
    criterionCount: category.criteria.length,
    scoredCount: relevantScores.length,
  };
}

/**
 * Calculate overall weighted score across all categories.
 * Returns a value on the 1-5 scale.
 */
export function calculateOverallScore(
  scores: CriterionScore[],
  template: ReviewTemplate
): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const category of template.categories) {
    const result = calculateCategoryScore(scores, category);
    if (result.scoredCount > 0) {
      totalWeightedScore += result.rawAverage * category.weight;
      totalWeight += category.weight;
    }
  }

  if (totalWeight === 0) return 0;

  // Normalize to 1-5 scale
  const overall = totalWeightedScore / totalWeight;
  return Math.round(overall * 100) / 100;
}

/**
 * Determine rating tier from a numeric score (1-5 scale).
 */
export function determineRating(score: number): RatingTier {
  if (score >= 4.5) return RATING_MAP[0]; // EXCEPTIONAL
  if (score >= 3.5) return RATING_MAP[1]; // EXCEEDS_EXPECTATIONS
  if (score >= 2.5) return RATING_MAP[2]; // MEETS_EXPECTATIONS
  if (score >= 1.5) return RATING_MAP[3]; // NEEDS_IMPROVEMENT
  return RATING_MAP[4]; // UNSATISFACTORY
}

/**
 * Generate a review summary with per-category breakdown.
 */
export function generateReviewSummary(
  review: Pick<EmployeeReview, 'managerScores' | 'selfScores'>,
  template: ReviewTemplate
): ReviewSummary {
  const scores = review.managerScores.length > 0 ? review.managerScores : review.selfScores;
  const overallScore = calculateOverallScore(scores, template);
  const rating = determineRating(overallScore);

  const categoryBreakdown = template.categories.map((cat) =>
    calculateCategoryScore(scores, cat)
  );

  const totalCriteria = template.categories.reduce((sum, c) => sum + c.criteria.length, 0);
  const scoredCriteria = scores.filter((s) => s.score > 0).length;

  return {
    overallScore,
    rating,
    categoryBreakdown,
    scoredCriteria,
    totalCriteria,
  };
}

/**
 * Calculate department-level statistics from a set of reviews.
 */
export function calculateDepartmentStats(
  reviews: EmployeeReview[],
  template: ReviewTemplate
): DepartmentStat[] {
  const deptMap = new Map<string, EmployeeReview[]>();

  for (const review of reviews) {
    const key = review.departmentId || review.department;
    if (!deptMap.has(key)) deptMap.set(key, []);
    deptMap.get(key)!.push(review);
  }

  const stats: DepartmentStat[] = [];

  for (const [deptId, deptReviews] of deptMap) {
    const completed = deptReviews.filter(
      (r) => r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED'
    );
    const scoredReviews = completed.filter((r) => r.finalScore > 0);

    const avgScore =
      scoredReviews.length > 0
        ? scoredReviews.reduce((sum, r) => sum + r.finalScore, 0) / scoredReviews.length
        : 0;

    const distribution: Record<string, number> = {};
    for (const tier of RATING_MAP) {
      distribution[tier.key] = 0;
    }
    for (const r of scoredReviews) {
      const tier = determineRating(r.finalScore);
      distribution[tier.key] = (distribution[tier.key] || 0) + 1;
    }

    stats.push({
      departmentId: deptId,
      departmentName: deptReviews[0]?.department || deptId,
      employeeCount: deptReviews.length,
      completedCount: completed.length,
      averageScore: Math.round(avgScore * 100) / 100,
      completionRate:
        deptReviews.length > 0
          ? Math.round((completed.length / deptReviews.length) * 100)
          : 0,
      distribution,
    });
  }

  return stats.sort((a, b) => b.averageScore - a.averageScore);
}

/**
 * Generate a full calibration report for a review cycle.
 */
export function generateCalibrationReport(
  reviews: EmployeeReview[],
  template: ReviewTemplate,
  cycleId: string
): CalibrationReport {
  const completed = reviews.filter(
    (r) => r.status === 'COMPLETED' || r.status === 'ACKNOWLEDGED'
  );
  const scored = completed.filter((r) => r.finalScore > 0);

  const avgScore =
    scored.length > 0
      ? scored.reduce((sum, r) => sum + r.finalScore, 0) / scored.length
      : 0;

  // Overall distribution
  const distribution: Record<string, number> = {};
  for (const tier of RATING_MAP) {
    distribution[tier.key] = 0;
  }
  for (const r of scored) {
    const tier = determineRating(r.finalScore);
    distribution[tier.key] = (distribution[tier.key] || 0) + 1;
  }

  // Department stats
  const departmentStats = calculateDepartmentStats(reviews, template);

  // Top performers (sorted by score desc)
  const sortedByScore = [...scored].sort((a, b) => b.finalScore - a.finalScore);
  const topPerformers = sortedByScore.slice(0, 10).map((r) => ({
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    score: r.finalScore,
    rating: r.rating,
  }));

  // Bottom performers (sorted by score asc)
  const bottomPerformers = sortedByScore
    .slice(-5)
    .reverse()
    .filter((r) => r.finalScore < 2.5)
    .map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      score: r.finalScore,
      rating: r.rating,
    }));

  return {
    cycleId,
    totalReviews: reviews.length,
    completedReviews: completed.length,
    averageScore: Math.round(avgScore * 100) / 100,
    distribution,
    departmentStats,
    topPerformers,
    bottomPerformers,
  };
}
