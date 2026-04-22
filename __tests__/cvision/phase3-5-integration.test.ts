/**
 * CVision Phase 3-5 Integration Tests
 *
 * 10 tests verifying that all new modules work together:
 *   1. Job recommender → AI governance logging
 *   2. Skills extraction → gap assessment pipeline
 *   3. Interview plan → evaluation → assessment flow
 *   4. AI governance threshold enforcement
 *   5. Analytics engine handles real-shaped data
 *   6. What-If simulator GOSI calculation accuracy
 *   7. Scenario comparison ranks correctly
 *   8. Rate limiter enforces limits
 *   9. Rate limiter sliding window resets
 *  10. All exports are accessible
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Job Recommender ──────────────────────────────────────────────────────────
import {
  matchCandidateToJob,
  recommendCandidatesForJob,
  recommendJobsForCandidate,
  type JobRequirements,
  type CandidateProfile,
  type MatchResult,
} from '../../lib/cvision/ai/job-recommender';

// ── AI Governance ────────────────────────────────────────────────────────────
import {
  createDecisionLog,
  evaluateConfidence,
  calculateGovernanceStats,
  formatDecisionForAudit,
  DEFAULT_GOVERNANCE_CONFIG,
  type AIDecisionLog,
  type GovernanceConfig,
} from '../../lib/cvision/ai/ai-governance';

// ── Skills Matrix ────────────────────────────────────────────────────────────
import {
  extractSkillsFromCV,
  assessSkillGaps,
  buildDepartmentSummary,
  findEmployeesWithSkill,
  generateSkillsReport,
  type EmployeeSkill,
  type SkillGap,
} from '../../lib/cvision/ai/skills-matrix';

// ── Interview Engine ─────────────────────────────────────────────────────────
import {
  generateInterviewPlan,
  evaluateAnswer,
  generateAssessment,
  getQuestionsByCategory,
  calculateInterviewDuration,
  type InterviewPlan,
  type AnswerEvaluation,
  type InterviewAssessment,
} from '../../lib/cvision/ai/interview-engine';

// ── Analytics Engine ─────────────────────────────────────────────────────────
import {
  analyzeAbsencePatterns,
  analyzeTurnover,
  analyzePayrollTrends,
  generateWorkforceInsights,
  calculateRetentionRisk,
  generateExecutiveSummary,
} from '../../lib/cvision/analytics/analytics-engine';

// ── What-If Simulator ────────────────────────────────────────────────────────
import {
  buildCurrentState,
  simulateSalaryAdjustment,
  simulateHeadcountChange,
  compareScenarios,
  generateSimulationReport,
  GOSI_RATES,
} from '../../lib/cvision/analytics/what-if-simulator';

// ── Rate Limiter ─────────────────────────────────────────────────────────────
import {
  checkRateLimit,
  clearRateLimit,
  getRateLimitStats,
  RATE_LIMIT_PRESETS,
} from '../../lib/cvision/middleware/rate-limiter';

// =============================================================================
// Helpers
// =============================================================================

function buildGovernanceConfig(): GovernanceConfig {
  return {
    ...DEFAULT_GOVERNANCE_CONFIG,
    tenantId: 'test-tenant',
    updatedAt: new Date(),
    updatedBy: 'test-admin',
  } as GovernanceConfig;
}

// =============================================================================
// Tests
// =============================================================================

describe('Phase 3-5 Integration', () => {
  // ── 1. Job recommender → AI governance logging ───────────────────────────

  it('Job recommender → AI governance logging', () => {
    const candidate: CandidateProfile = {
      candidateId: 'cand-1',
      name: 'Ahmed Al-Saud',
      skills: ['JavaScript', 'React', 'Node.js', 'TypeScript'],
      experience: [
        { title: 'Senior Developer', company: 'TechCo', years: 5 },
      ],
      education: [
        { degree: 'bachelor', field: 'Computer Science', institution: 'KSU' },
      ],
      totalYearsExperience: 5,
      currentSalary: 15000,
    };

    const job: JobRequirements = {
      jobId: 'job-1',
      title: 'Full Stack Developer',
      department: 'IT',
      requiredSkills: ['JavaScript', 'React', 'Node.js'],
      preferredSkills: ['TypeScript', 'Docker'],
      minExperience: 3,
      education: 'bachelor',
      salaryRange: { min: 12000, max: 18000 },
    };

    // Step 1: Run matching
    const matchResult: MatchResult = matchCandidateToJob(candidate, job);
    expect(matchResult.overallScore).toBeGreaterThanOrEqual(0);
    expect(matchResult.overallScore).toBeLessThanOrEqual(100);
    expect(matchResult.matchedSkills.length).toBeGreaterThan(0);
    expect(['STRONG_MATCH', 'GOOD_MATCH', 'PARTIAL_MATCH', 'WEAK_MATCH']).toContain(matchResult.recommendation);

    // Step 2: Log the AI decision via governance
    const config = buildGovernanceConfig();
    const decision: AIDecisionLog = createDecisionLog({
      id: 'dec-001',
      tenantId: 'test-tenant',
      decisionType: 'JOB_MATCHING',
      confidence: matchResult.overallScore,
      subjectId: candidate.candidateId,
      subjectType: 'CANDIDATE',
      inputSnapshot: { candidate, job },
      outputSnapshot: { matchResult },
      config,
      createdBy: 'system',
    });

    expect(decision.decisionType).toBe('JOB_MATCHING');
    expect(decision.confidence).toBe(matchResult.overallScore);
    expect(decision.subjectId).toBe('cand-1');
    expect(decision.id).toBe('dec-001');
    // Status should be determined by governance thresholds
    expect(['AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'OVERRIDDEN']).toContain(decision.status);
    expect(decision.reasoning).toBeTruthy();
  });

  // ── 2. Skills extraction → gap assessment pipeline ───────────────────────

  it('Skills extraction → gap assessment pipeline', () => {
    // Mock parsed CV data (shape matches what CV parser produces)
    const parsedCVData = {
      skills: ['JavaScript', 'React', 'Python', 'SQL', 'Docker'],
      experience: [
        { title: 'Developer', company: 'ABC Corp', duration: '3 years' },
        { title: 'Junior Developer', company: 'XYZ Inc', duration: '2 years' },
      ],
      yearsOfExperience: 5,
    };

    // Step 1: Extract skills from CV
    const extractedSkills: EmployeeSkill[] = extractSkillsFromCV(parsedCVData);
    expect(extractedSkills.length).toBeGreaterThan(0);

    // Each skill should have the required shape
    for (const skill of extractedSkills) {
      expect(skill.skillId).toBeTruthy();
      expect(skill.skillName).toBeTruthy();
      expect([1, 2, 3, 4, 5]).toContain(skill.proficiencyLevel);
      expect(skill.source).toBe('CV_EXTRACTED');
    }

    // Step 2: Assess gaps against requirements
    const requirements = [
      { skillName: 'JavaScript', requiredLevel: 4 },
      { skillName: 'React',      requiredLevel: 4 },
      { skillName: 'Kubernetes', requiredLevel: 3 }, // Not in CV
      { skillName: 'Python',     requiredLevel: 3 },
    ];

    const gaps: SkillGap[] = assessSkillGaps(extractedSkills, requirements);
    expect(gaps.length).toBeGreaterThan(0);

    // Each gap should have required fields
    for (const gap of gaps) {
      expect(gap.skillName).toBeTruthy();
      expect(typeof gap.requiredLevel).toBe('number');
      expect(typeof gap.currentLevel).toBe('number');
      expect(typeof gap.gap).toBe('number');
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(gap.priority);
    }

    // Kubernetes should have the largest gap (not in CV => currentLevel 0)
    const k8sGap = gaps.find(g => g.skillName.toLowerCase().includes('kubernetes'));
    if (k8sGap) {
      expect(k8sGap.currentLevel).toBe(0);
      expect(k8sGap.gap).toBeGreaterThan(0);
    }
  });

  // ── 3. Interview plan → evaluation → assessment flow ─────────────────────

  it('Interview plan → evaluation → assessment flow', () => {
    // Step 1: Generate interview plan
    const plan: InterviewPlan = generateInterviewPlan({
      jobTitle: 'Senior Developer',
      department: 'IT',
      requiredSkills: ['JavaScript', 'React', 'Node.js'],
      experienceLevel: 'technical',
      totalQuestions: 6,
    });

    expect(plan.jobTitle).toBe('Senior Developer');
    expect(plan.questions.length).toBe(6);
    expect(plan.estimatedDurationMinutes).toBeGreaterThan(0);
    expect(plan.id).toBeTruthy();

    // Step 2: Evaluate each answer
    const evaluations: AnswerEvaluation[] = plan.questions.map((question) => {
      return evaluateAnswer({
        question,
        answer: 'I have extensive experience with this topic. In my previous role, I led a team of 5 developers to implement a scalable microservices architecture using React and Node.js. We improved performance by 40% and reduced deployment time from hours to minutes using CI/CD pipelines. I believe in clean code practices, thorough testing, and continuous learning.',
        candidateContext: { name: 'Ahmed', experience: 5 },
      });
    });

    expect(evaluations.length).toBe(6);
    for (const ev of evaluations) {
      expect(ev.questionId).toBeTruthy();
      expect(ev.score).toBeGreaterThanOrEqual(0);
      expect(ev.score).toBeLessThanOrEqual(ev.maxScore);
      expect(ev.percentage).toBeGreaterThanOrEqual(0);
      expect(ev.percentage).toBeLessThanOrEqual(100);
      expect(['EXCELLENT', 'GOOD', 'AVERAGE', 'POOR']).toContain(ev.level);
    }

    // Step 3: Generate assessment
    const assessment: InterviewAssessment = generateAssessment({
      candidateId: 'cand-test',
      candidateName: 'Ahmed Al-Saud',
      interviewPlan: plan,
      evaluations,
    });

    expect(assessment.overallScore).toBeGreaterThanOrEqual(0);
    expect(assessment.overallScore).toBeLessThanOrEqual(100);
    expect(assessment.candidateId).toBe('cand-test');
    expect(assessment.candidateName).toBe('Ahmed Al-Saud');
    expect(['STRONGLY_RECOMMEND', 'RECOMMEND', 'CONSIDER', 'DO_NOT_RECOMMEND']).toContain(assessment.recommendation);
    expect(assessment.summary).toBeTruthy();
    expect(assessment.strengths.length).toBeGreaterThanOrEqual(0);
    expect(assessment.concerns.length).toBeGreaterThanOrEqual(0);
  });

  // ── 4. AI governance threshold enforcement ───────────────────────────────

  it('AI governance threshold enforcement', () => {
    const config = buildGovernanceConfig();

    // JOB_MATCHING: autoApproveThreshold = 80, autoRejectThreshold = 25

    // Low confidence (40) — should be PENDING_REVIEW (above reject 25 but below approve 80)
    const lowResult = evaluateConfidence(config, 'JOB_MATCHING', 40);
    expect(lowResult.status).toBe('PENDING_REVIEW');
    expect(lowResult.reasoning).toBeTruthy();

    // High confidence (90) — should be AUTO_APPROVED (above 80 threshold)
    const highResult = evaluateConfidence(config, 'JOB_MATCHING', 90);
    expect(highResult.status).toBe('AUTO_APPROVED');

    // Very low confidence (20) — should be REJECTED (below 25 threshold)
    const veryLowResult = evaluateConfidence(config, 'JOB_MATCHING', 20);
    expect(veryLowResult.status).toBe('REJECTED');

    // Verify the full decision log respects the threshold
    const approvedDecision = createDecisionLog({
      id: 'dec-approved',
      tenantId: 'test-tenant',
      decisionType: 'JOB_MATCHING',
      confidence: 90,
      subjectId: 'cand-x',
      subjectType: 'CANDIDATE',
      inputSnapshot: {},
      outputSnapshot: {},
      config,
      createdBy: 'system',
    });
    expect(approvedDecision.status).toBe('AUTO_APPROVED');

    const pendingDecision = createDecisionLog({
      id: 'dec-pending',
      tenantId: 'test-tenant',
      decisionType: 'JOB_MATCHING',
      confidence: 40,
      subjectId: 'cand-y',
      subjectType: 'CANDIDATE',
      inputSnapshot: {},
      outputSnapshot: {},
      config,
      createdBy: 'system',
    });
    expect(pendingDecision.status).toBe('PENDING_REVIEW');
  });

  // ── 5. Analytics engine handles real-shaped data ─────────────────────────

  it('Analytics engine handles real-shaped data', () => {
    // Mock data matching actual DB document shapes
    const employees = [
      { id: 'e1', name: 'Ahmed', departmentId: 'IT', jobTitleId: 'jt-1', nationality: 'SA', gender: 'Male', dateOfBirth: '1990-01-15', status: 'ACTIVE', hiredAt: '2020-03-01', contractEndDate: '2025-03-01', probationEndDate: null },
      { id: 'e2', name: 'Sara',  departmentId: 'HR', jobTitleId: 'jt-2', nationality: 'Saudi', gender: 'Female', dateOfBirth: '1988-06-20', status: 'ACTIVE', hiredAt: '2019-08-15', contractEndDate: '2025-08-15', probationEndDate: null },
      { id: 'e3', name: 'Omar',  departmentId: 'IT', jobTitleId: 'jt-1', nationality: 'JO', gender: 'Male', dateOfBirth: '1992-11-05', status: 'RESIGNED', hiredAt: '2021-01-10', resignedAt: '2024-03-01', statusReason: 'Better opportunity' },
    ];

    const dateRange = {
      start: new Date('2024-01-01'),
      end: new Date('2024-06-30'),
    };

    // Absence analysis — should not crash on string dates
    const absence = analyzeAbsencePatterns({
      employees: employees.filter(e => e.status === 'ACTIVE').map(e => ({ id: e.id, name: e.name, departmentId: e.departmentId })),
      attendanceRecords: [
        { employeeId: 'e1', date: '2024-02-15', status: 'ABSENT' },
        { employeeId: 'e2', date: '2024-03-10', status: 'LATE', lateMinutes: 20 },
      ],
      leaveRecords: [
        { employeeId: 'e1', type: 'ANNUAL', status: 'APPROVED', startDate: '2024-04-01', endDate: '2024-04-05', totalDays: 5 },
      ],
      dateRange,
    });
    expect(absence.totalEmployees).toBe(2);
    expect(absence.totalAbsenceDays).toBe(1);

    // Turnover analysis
    const turnover = analyzeTurnover({ employees: employees as Record<string, unknown>[], dateRange });
    expect(turnover.totalSeparations).toBe(1); // Omar resigned
    expect(turnover.resignations).toBe(1);

    // Payroll trends
    const payrollTrends = analyzePayrollTrends({
      payrollRuns: [
        { period: '2024-01', status: 'paid', totalsJson: { totalGross: 50000, totalNet: 42000, employeeCount: 2 } },
        { period: '2024-02', status: 'paid', totalsJson: { totalGross: 52000, totalNet: 43500, employeeCount: 2 } },
      ],
      dateRange,
    });
    expect(payrollTrends.length).toBe(2);

    // Workforce insights
    const insights = generateWorkforceInsights({
      employees: employees as Record<string, unknown>[],
      snapshotDate: new Date('2024-06-01'),
    });
    expect(insights.totalHeadcount).toBe(2); // Only ACTIVE
    expect(insights.saudizationRate).toBe(100); // Both active are Saudi

    // Executive summary — should not crash
    const summary = generateExecutiveSummary({
      absenceAnalytics: absence,
      turnoverAnalytics: turnover,
      payrollTrends,
      workforceInsights: insights,
    });
    expect(summary.summary).toBeTruthy();
    expect(summary.keyMetrics.length).toBeGreaterThanOrEqual(5);
  });

  // ── 6. What-If simulator GOSI calculation accuracy ───────────────────────

  it('What-If simulator GOSI calculation accuracy', () => {
    // Known salaries for manual verification
    const employees = [
      {
        id: 'emp-a',
        name: 'Test A',
        department: 'IT',
        grade: 'G5',
        basicSalary: 10000,
        allowances: [{ type: 'HOUSING', amount: 2500 }],
      },
      {
        id: 'emp-b',
        name: 'Test B',
        department: 'IT',
        grade: 'G6',
        basicSalary: 40000,
        allowances: [{ type: 'HOUSING', amount: 10000 }],
        // basic + housing = 50000, exceeds cap of 45000
      },
    ];

    const state = buildCurrentState(employees);

    // emp-a: insurable = min(10000 + 2500, 45000) = 12500
    // gosiEmployer = 12500 * 0.1175 = 1468.75
    // gosiEmployee = 12500 * 0.0975 = 1218.75
    const empA = state.employees.find(e => e.id === 'emp-a')!;
    expect(empA.gosiEmployer).toBe(1468.75);
    expect(empA.gosiEmployee).toBe(1218.75);

    // emp-b: insurable = min(40000 + 10000, 45000) = 45000 (capped)
    // gosiEmployer = 45000 * 0.1175 = 5287.50
    // gosiEmployee = 45000 * 0.0975 = 4387.50
    const empB = state.employees.find(e => e.id === 'emp-b')!;
    expect(empB.gosiEmployer).toBe(5287.5);
    expect(empB.gosiEmployee).toBe(4387.5);

    // Verify GOSI constants
    expect(GOSI_RATES.employerRate).toBe(0.1175);
    expect(GOSI_RATES.employeeRate).toBe(0.0975);
    expect(GOSI_RATES.maxContributionBase).toBe(45000);

    // Total GOSI employer = 1468.75 + 5287.50 = 6756.25
    expect(state.totalGosiEmployer).toBe(6756.25);
    expect(state.totalGosiEmployee).toBe(5606.25); // 1218.75 + 4387.50
  });

  // ── 7. Scenario comparison ranks correctly ───────────────────────────────

  it('Scenario comparison ranks correctly', () => {
    const employees = [
      { id: 'e1', name: 'A', department: 'IT',      grade: 'G5', basicSalary: 10000, allowances: [{ type: 'HOUSING', amount: 2500 }] },
      { id: 'e2', name: 'B', department: 'HR',      grade: 'G4', basicSalary: 8000,  allowances: [{ type: 'HOUSING', amount: 2000 }] },
      { id: 'e3', name: 'C', department: 'Finance', grade: 'G3', basicSalary: 7000,  allowances: [{ type: 'HOUSING', amount: 1500 }] },
    ];

    const state = buildCurrentState(employees);

    // Scenario 1: 5% raise (cheapest increase)
    const small = simulateSalaryAdjustment(state, {
      scope: 'ALL',
      adjustmentType: 'PERCENTAGE',
      adjustmentValue: 5,
      effectiveDate: new Date(),
      includeAllowances: false,
    });

    // Scenario 2: 15% raise (most expensive increase)
    const large = simulateSalaryAdjustment(state, {
      scope: 'ALL',
      adjustmentType: 'PERCENTAGE',
      adjustmentValue: 15,
      effectiveDate: new Date(),
      includeAllowances: false,
    });

    // Scenario 3: 10% raise (middle)
    const medium = simulateSalaryAdjustment(state, {
      scope: 'ALL',
      adjustmentType: 'PERCENTAGE',
      adjustmentValue: 10,
      effectiveDate: new Date(),
      includeAllowances: false,
    });

    const comparison = compareScenarios([small, large, medium]);

    expect(comparison.scenarios.length).toBe(3);
    // Cheapest should be the 5% raise
    expect(comparison.cheapestScenario).toBe(small.scenarioId);
    // Most expensive should be the 15% raise
    expect(comparison.mostExpensiveScenario).toBe(large.scenarioId);
    // Scenarios should be sorted by annual cost ascending
    expect(comparison.scenarios[0].annualCost).toBeLessThanOrEqual(comparison.scenarios[1].annualCost);
    expect(comparison.scenarios[1].annualCost).toBeLessThanOrEqual(comparison.scenarios[2].annualCost);
    // Recommendation
    expect(comparison.recommendation).toBeTruthy();
  });

  // ── 8. Rate limiter enforces limits ──────────────────────────────────────

  it('Rate limiter enforces limits', () => {
    // Clear any previous state
    clearRateLimit();

    const config = { windowMs: 60_000, maxRequests: 5 };
    const key = 'test-enforce';

    // Make exactly maxRequests calls — all should be allowed
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(key, config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4 - i);
      expect(result.limit).toBe(5);
    }

    // The next call should be blocked
    const blocked = checkRateLimit(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.resetAt).toBeInstanceOf(Date);

    // Stats should show the key
    const stats = getRateLimitStats();
    expect(stats.totalKeys).toBeGreaterThanOrEqual(1);

    // Clean up
    clearRateLimit(key);
  });

  // ── 9. Rate limiter sliding window resets ────────────────────────────────

  it('Rate limiter sliding window resets', () => {
    clearRateLimit();

    // Use a very small window (100ms) so we can test reset behavior
    const config = { windowMs: 100, maxRequests: 2 };
    const key = 'test-sliding';

    // Fill the window
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(true);
    expect(checkRateLimit(key, config).allowed).toBe(false); // Blocked

    // Wait for the window to expire, then try again
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // After window expires, requests should be allowed again
        const result = checkRateLimit(key, config);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1); // 2 - 1 = 1 remaining

        clearRateLimit(key);
        resolve();
      }, 150); // Wait 150ms (> 100ms window)
    });
  });

  // ── 10. All exports are accessible ───────────────────────────────────────

  it('All exports are accessible', () => {
    // Job Recommender
    expect(typeof matchCandidateToJob).toBe('function');
    expect(typeof recommendCandidatesForJob).toBe('function');
    expect(typeof recommendJobsForCandidate).toBe('function');

    // AI Governance
    expect(typeof createDecisionLog).toBe('function');
    expect(typeof evaluateConfidence).toBe('function');
    expect(typeof calculateGovernanceStats).toBe('function');
    expect(typeof formatDecisionForAudit).toBe('function');
    expect(DEFAULT_GOVERNANCE_CONFIG).toBeDefined();
    expect(DEFAULT_GOVERNANCE_CONFIG.thresholds).toBeDefined();

    // Skills Matrix
    expect(typeof extractSkillsFromCV).toBe('function');
    expect(typeof assessSkillGaps).toBe('function');
    expect(typeof buildDepartmentSummary).toBe('function');
    expect(typeof findEmployeesWithSkill).toBe('function');
    expect(typeof generateSkillsReport).toBe('function');

    // Interview Engine
    expect(typeof generateInterviewPlan).toBe('function');
    expect(typeof evaluateAnswer).toBe('function');
    expect(typeof generateAssessment).toBe('function');
    expect(typeof getQuestionsByCategory).toBe('function');
    expect(typeof calculateInterviewDuration).toBe('function');

    // Analytics Engine
    expect(typeof analyzeAbsencePatterns).toBe('function');
    expect(typeof analyzeTurnover).toBe('function');
    expect(typeof analyzePayrollTrends).toBe('function');
    expect(typeof generateWorkforceInsights).toBe('function');
    expect(typeof calculateRetentionRisk).toBe('function');
    expect(typeof generateExecutiveSummary).toBe('function');

    // What-If Simulator
    expect(typeof buildCurrentState).toBe('function');
    expect(typeof simulateSalaryAdjustment).toBe('function');
    expect(typeof simulateHeadcountChange).toBe('function');
    expect(typeof compareScenarios).toBe('function');
    expect(typeof generateSimulationReport).toBe('function');
    expect(GOSI_RATES).toBeDefined();
    expect(GOSI_RATES.employerRate).toBe(0.1175);

    // Rate Limiter
    expect(typeof checkRateLimit).toBe('function');
    expect(typeof clearRateLimit).toBe('function');
    expect(typeof getRateLimitStats).toBe('function');
    expect(RATE_LIMIT_PRESETS).toBeDefined();
    expect(RATE_LIMIT_PRESETS.strict.maxRequests).toBe(20);
    expect(RATE_LIMIT_PRESETS.standard.maxRequests).toBe(60);
    expect(RATE_LIMIT_PRESETS.ai.maxRequests).toBe(10);
  });
});
