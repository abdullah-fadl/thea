import { logger } from '@/lib/monitoring/logger';
/**
 * CVision Performance Review — Seed Data
 *
 * POST /api/cvision/performance/seed
 * Dev-only endpoint that creates sample review cycles and employee reviews.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/cvision/infra';
import {
  getCVisionCollection,
  createTenantFilter,
} from '@/lib/cvision/db';
import { CVISION_PERMISSIONS } from '@/lib/cvision/constants';
import {
  type ReviewCycle,
  type EmployeeReview,
  type CriterionScore,
  type ReviewGoal,
  DEFAULT_REVIEW_TEMPLATE,
  calculateOverallScore,
  determineRating,
} from '@/lib/cvision/performance/performance-engine';

export const dynamic = 'force-dynamic';

/**
 * Generate scores for all 20 criteria with a target average.
 * The spread parameter adds variance around the base score.
 */
function generateScores(baseScore: number, spread = 0.8): CriterionScore[] {
  const scores: CriterionScore[] = [];
  for (const category of DEFAULT_REVIEW_TEMPLATE.categories) {
    for (const criterion of category.criteria) {
      const variance = (Math.random() - 0.5) * 2 * spread;
      const raw = baseScore + variance;
      const score = Math.min(5, Math.max(1, Math.round(raw)));
      scores.push({
        criterionId: criterion.id,
        score,
        comment: '',
      });
    }
  }
  return scores;
}

function generateGoals(count: number, completed: boolean): ReviewGoal[] {
  const goalTexts = [
    'Complete advanced certification in core domain',
    'Lead a cross-functional project initiative',
    'Improve team collaboration metrics by 15%',
    'Mentor 2 junior team members',
    'Reduce average task completion time by 10%',
    'Present at department knowledge-sharing session',
    'Develop a process improvement proposal',
    'Achieve 95% customer satisfaction score',
  ];

  const statuses: ReviewGoal['status'][] = completed
    ? ['ACHIEVED', 'ACHIEVED', 'IN_PROGRESS', 'MISSED']
    : ['NOT_STARTED', 'IN_PROGRESS', 'NOT_STARTED', 'NOT_STARTED'];

  return goalTexts.slice(0, count).map((goal, i) => ({
    id: uuidv4(),
    goal,
    status: statuses[i % statuses.length],
  }));
}

export const POST = withAuthTenant(
  async (request, { tenantId, userId }) => {
    try {
      // Fetch active employees for seeding
      const empColl = await getCVisionCollection<any>(
        tenantId,
        'employees'
      );
      const employees = await empColl
        .find(
          createTenantFilter(tenantId, {
            status: { $in: ['ACTIVE', 'PROBATION', 'active', 'probation'] },
            isArchived: { $ne: true },
          })
        )
        .limit(8)
        .toArray();

      if (employees.length < 2) {
        return NextResponse.json(
          { error: 'Need at least 2 active employees to seed performance data. Seed employees first.' },
          { status: 400 }
        );
      }

      // Fetch departments for name lookup
      const deptColl = await getCVisionCollection<any>(tenantId, 'departments');
      const departments = await deptColl
        .find(createTenantFilter(tenantId))
        .toArray();
      const deptMap = new Map<string, string>();
      for (const d of departments) {
        deptMap.set(d.id, d.name || d.code || d.id);
      }

      // Fetch job titles
      const jtColl = await getCVisionCollection<any>(tenantId, 'jobTitles');
      const jobTitles = await jtColl
        .find(createTenantFilter(tenantId))
        .toArray();
      const jtMap = new Map<string, string>();
      for (const jt of jobTitles) {
        jtMap.set(jt.id, jt.name || jt.code || jt.id);
      }

      const cyclesColl = await getCVisionCollection<any>(
        tenantId,
        'reviewCycles'
      );
      const reviewsColl = await getCVisionCollection<any>(
        tenantId,
        'performanceReviews'
      );

      // Clear existing seed data
      await cyclesColl.deleteMany(createTenantFilter(tenantId));
      await reviewsColl.deleteMany(createTenantFilter(tenantId));

      const now = new Date();

      // ---------------------------------------------------------------
      // Cycle 1: 2025 Annual Review — COMPLETED
      // ---------------------------------------------------------------
      const cycle2025: ReviewCycle = {
        id: uuidv4(),
        tenantId,
        name: '2025 Annual Performance Review',
        type: 'ANNUAL',
        year: 2025,
        status: 'COMPLETED',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        reviewPeriodStart: '2025-12-01',
        reviewPeriodEnd: '2025-12-31',
        selfReviewDeadline: '2025-12-15',
        managerReviewDeadline: '2025-12-31',
        templateId: DEFAULT_REVIEW_TEMPLATE.id,
        createdAt: '2025-12-01T00:00:00.000Z',
        updatedAt: '2025-12-31T00:00:00.000Z',
        createdBy: userId,
        updatedBy: userId,
      };

      // ---------------------------------------------------------------
      // Cycle 2: 2026 Annual Review — ACTIVE
      // ---------------------------------------------------------------
      const cycle2026: ReviewCycle = {
        id: uuidv4(),
        tenantId,
        name: '2026 Annual Performance Review',
        type: 'ANNUAL',
        year: 2026,
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reviewPeriodStart: '2026-01-01',
        reviewPeriodEnd: '2026-02-28',
        selfReviewDeadline: '2026-02-15',
        managerReviewDeadline: '2026-02-28',
        templateId: DEFAULT_REVIEW_TEMPLATE.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: userId,
        updatedBy: userId,
      };

      await cyclesColl.insertMany([cycle2025 as unknown as Record<string, unknown>, cycle2026 as unknown as Record<string, unknown>]);

      // ---------------------------------------------------------------
      // Create reviews for COMPLETED cycle (2025)
      // ---------------------------------------------------------------
      const completedReviews: EmployeeReview[] = [];

      // Score profiles: EXCEPTIONAL, EXCEEDS, MEETS, NEEDS_IMPROVEMENT
      const scoreProfiles = [
        { base: 4.7, label: 'high performer' },
        { base: 3.9, label: 'good performer' },
        { base: 3.0, label: 'average performer' },
        { base: 2.0, label: 'needs improvement' },
      ];

      const usableEmployees = employees.slice(0, Math.min(employees.length, 4));

      for (let i = 0; i < usableEmployees.length; i++) {
        const emp = usableEmployees[i];
        const profile = scoreProfiles[i % scoreProfiles.length];
        const empName =
          emp.fullName ||
          `${emp.firstName || ''} ${emp.lastName || ''}`.trim();

        const selfScores = generateScores(profile.base, 0.6);
        const managerScores = generateScores(profile.base, 0.5);

        const overallSelfScore = calculateOverallScore(
          selfScores,
          DEFAULT_REVIEW_TEMPLATE
        );
        const overallManagerScore = calculateOverallScore(
          managerScores,
          DEFAULT_REVIEW_TEMPLATE
        );
        const finalScore = overallManagerScore;
        const ratingTier = determineRating(finalScore);

        // Find manager
        let reviewerId = '';
        let reviewerName = '';
        if (emp.managerEmployeeId) {
          const mgr = employees.find((e) => e.id === emp.managerEmployeeId);
          if (mgr) {
            reviewerName =
              mgr.fullName ||
              `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim();
            reviewerId = mgr.id;
          }
        }
        // Fallback: use another employee as reviewer
        if (!reviewerId && employees.length > 1) {
          const mgr = employees.find((e) => e.id !== emp.id);
          if (mgr) {
            reviewerName =
              mgr.fullName ||
              `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim();
            reviewerId = mgr.id;
          }
        }

        completedReviews.push({
          id: uuidv4(),
          tenantId,
          cycleId: cycle2025.id,
          employeeId: emp.id,
          employeeName: empName,
          department: deptMap.get(emp.departmentId) || '',
          departmentId: emp.departmentId || '',
          jobTitle: jtMap.get(emp.jobTitleId) || '',
          reviewerId,
          reviewerName,
          status: i < 3 ? 'ACKNOWLEDGED' : 'COMPLETED',
          selfScores,
          managerScores,
          overallSelfScore,
          overallManagerScore,
          finalScore,
          rating: ratingTier.label,
          managerComments: `Employee demonstrates ${profile.label} characteristics. Reviewed for the 2025 period.`,
          employeeComments:
            'I believe this review accurately reflects my contributions during the review period.',
          goals: generateGoals(3, true),
          developmentPlan:
            i < 2
              ? 'Continue leadership development and pursue advanced certification.'
              : 'Focus on core competency improvement and time management.',
          promotionRecommendation: i === 0,
          salaryIncreaseRecommendation: i < 2,
          acknowledgedAt: i < 3 ? '2025-12-28T00:00:00.000Z' : null,
          completedAt: '2025-12-25T00:00:00.000Z',
          createdAt: '2025-12-01T00:00:00.000Z',
          updatedAt: '2025-12-28T00:00:00.000Z',
          createdBy: userId,
          updatedBy: userId,
        });
      }

      // ---------------------------------------------------------------
      // Create reviews for ACTIVE cycle (2026)
      // ---------------------------------------------------------------
      const activeReviews: EmployeeReview[] = [];

      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];
        const empName =
          emp.fullName ||
          `${emp.firstName || ''} ${emp.lastName || ''}`.trim();

        // Find manager
        let reviewerId = '';
        let reviewerName = '';
        if (emp.managerEmployeeId) {
          const mgr = employees.find((e) => e.id === emp.managerEmployeeId);
          if (mgr) {
            reviewerName =
              mgr.fullName ||
              `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim();
            reviewerId = mgr.id;
          }
        }
        if (!reviewerId && employees.length > 1) {
          const mgr = employees.find((e) => e.id !== emp.id);
          if (mgr) {
            reviewerName =
              mgr.fullName ||
              `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim();
            reviewerId = mgr.id;
          }
        }

        // Varied statuses: some NOT_STARTED, some SELF_REVIEW, some MANAGER_REVIEW
        let status: EmployeeReview['status'] = 'NOT_STARTED';
        let selfScores: CriterionScore[] = [];
        let managerScores: CriterionScore[] = [];
        let overallSelfScore = 0;
        let overallManagerScore = 0;
        let finalScore = 0;
        let rating = '';

        if (i === 0) {
          // First employee: completed self-review, in SELF_REVIEW status
          status = 'SELF_REVIEW';
          selfScores = generateScores(4.0, 0.7);
          overallSelfScore = calculateOverallScore(
            selfScores,
            DEFAULT_REVIEW_TEMPLATE
          );
        } else if (i === 1) {
          // Second employee: manager review done
          status = 'MANAGER_REVIEW';
          selfScores = generateScores(3.5, 0.6);
          managerScores = generateScores(3.6, 0.5);
          overallSelfScore = calculateOverallScore(
            selfScores,
            DEFAULT_REVIEW_TEMPLATE
          );
          overallManagerScore = calculateOverallScore(
            managerScores,
            DEFAULT_REVIEW_TEMPLATE
          );
          finalScore = overallManagerScore;
          const tier = determineRating(finalScore);
          rating = tier.label;
        }
        // Others stay NOT_STARTED

        activeReviews.push({
          id: uuidv4(),
          tenantId,
          cycleId: cycle2026.id,
          employeeId: emp.id,
          employeeName: empName,
          department: deptMap.get(emp.departmentId) || '',
          departmentId: emp.departmentId || '',
          jobTitle: jtMap.get(emp.jobTitleId) || '',
          reviewerId,
          reviewerName,
          status,
          selfScores,
          managerScores,
          overallSelfScore,
          overallManagerScore,
          finalScore,
          rating,
          managerComments: '',
          employeeComments:
            i === 0
              ? 'Submitted self-review for the 2026 review cycle.'
              : '',
          goals: i === 0 ? generateGoals(2, false) : [],
          developmentPlan: '',
          promotionRecommendation: false,
          salaryIncreaseRecommendation: false,
          acknowledgedAt: null,
          completedAt: null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          createdBy: userId,
          updatedBy: userId,
        });
      }

      const allReviews = [...completedReviews, ...activeReviews];
      if (allReviews.length > 0) {
        await reviewsColl.insertMany(allReviews as unknown as Record<string, unknown>[]);
      }

      return NextResponse.json({
        success: true,
        message: 'Performance review seed data created',
        cycles: 2,
        reviews: allReviews.length,
        completedCycleReviews: completedReviews.length,
        activeCycleReviews: activeReviews.length,
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error('[CVision Performance Seed]', errMsg);
      return NextResponse.json(
        { error: 'Failed to seed performance data', message: errMsg },
        { status: 500 }
      );
    }
  },
  { platformKey: 'cvision', permissionKey: CVISION_PERMISSIONS.PERFORMANCE_WRITE }
);
