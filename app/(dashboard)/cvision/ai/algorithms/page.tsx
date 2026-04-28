'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useMemo, useRef, useEffect } from 'react';

import {
  BookOpen,
  Search,
  ChevronDown,
  ChevronRight,
  Target,
  BarChart3,
  Shield,
  Database,
  FileText,
  Brain,
  Calculator,
  Activity,
  AlertTriangle,
  Zap,
  Users,
  Clock,
  TrendingUp,
  Heart,
  Award,
  MessageSquare,
  Layers,
  Shuffle,
  Scale,
  Flame,
  SlidersHorizontal,
  Printer,
} from 'lucide-react';

// ─── Algorithm Data ─────────────────────────────────────────────────────────

interface AlgorithmDoc {
  id: string;
  title: string;
  category: 'scoring' | 'analysis' | 'governance' | 'data';
  version: string;
  status: 'active' | 'deprecated' | 'experimental';
  module: string;
  lastUpdated: string;
  icon: typeof Target;
  sections: {
    purpose: string;
    inputs: string[];
    algorithm: React.ReactNode;
    outputs: string[];
    limitations: string[];
    biasMitigations: string[];
    example?: React.ReactNode;
  };
}

const STATUS_STYLES = {
  active: { label: 'Active', color: 'bg-green-100 text-green-800' },
  deprecated: { label: 'Deprecated', color: 'bg-red-100 text-red-800' },
  experimental: { label: 'Experimental', color: 'bg-yellow-100 text-yellow-800' },
};

const CATEGORY_LABELS = {
  scoring: { label: 'Scoring Models', icon: Target },
  analysis: { label: 'Analysis Models', icon: BarChart3 },
  governance: { label: 'Governance', icon: Shield },
  data: { label: 'Data Models', icon: Database },
};

// Helper functions and ALGORITHMS are defined inside the component
// so they have access to theme colors (C) from useCVisionTheme().

export default function AlgorithmsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

// Helper for weight tables
function WeightTable({ rows }: { rows: [string, string, string][] }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', fontSize: 12, marginTop: 8, marginBottom: 8 }}>
      <table style={{ width: '100%' }}>
        <thead>
          <tr className="bg-muted/50">
            <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontWeight: 500 }}>Factor</th>
            <th style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontWeight: 500 }}>Weight</th>
            <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontWeight: 500 }}>Calculation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([factor, weight, calc], i) => (
            <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontWeight: 500 }}>{factor}</td>
              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, textAlign: 'center' }}>{weight}</td>
              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, color: C.textMuted }}>{calc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ThresholdBar({ ranges }: { ranges: { label: string; end: number; color: string }[] }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <div style={{ position: 'relative', height: 24, borderRadius: '50%', overflow: 'hidden', display: 'flex' }}>
        {ranges.map((r, i) => {
          const prev = i === 0 ? 0 : ranges[i - 1].end;
          const width = r.end - prev;
          return (
            <div
              key={r.label}
              className={`h-full flex items-center justify-center text-[9px] font-medium ${r.color}`}
              style={{ width: `${width}%` }}
            >
              {width >= 12 ? r.label : ''}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: C.textMuted, marginTop: 2, paddingLeft: 2, paddingRight: 2 }}>
        <span>0</span>
        {ranges.map(r => <span key={r.label}>{r.end}</span>)}
      </div>
    </div>
  );
}

function ScoreTable({ rows }: { rows: [string, string][] }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', fontSize: 12, marginTop: 8, marginBottom: 8 }}>
      <table style={{ width: '100%' }}>
        <tbody>
          {rows.map(([condition, score], i) => (
            <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, color: C.textMuted }}>{condition}</td>
              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, fontWeight: 500, textAlign: 'right' }}>{score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  const { C, isDark } = useCVisionTheme();
  return <code style={{ background: C.bgSubtle, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}>{children}</code>;
}

// ─── Algorithm Definitions ──────────────────────────────────────────────────

const ALGORITHMS: AlgorithmDoc[] = [
  // ════════════════════ 1. AI JOB MATCHING ════════════════════
  {
    id: 'job-matching',
    title: 'AI Job Matching Score',
    category: 'scoring',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/ai/job-recommender.ts',
    lastUpdated: '2026-02-22',
    icon: Target,
    sections: {
      purpose: 'Calculates how well a candidate matches a job opening based on skills, experience, education, and salary fit. Used to rank and shortlist candidates automatically.',
      inputs: [
        'Candidate: skills[], experience (years), education level, expected salary',
        'Job: requiredSkills[], preferredSkills[], minExperience, educationLevel, salaryRange{min,max}, department',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}><Code>{'Total Score = Σ(Factor × Weight)'}</Code></p>
          <WeightTable rows={[
            ['Skills Match', '40%', 'Required (70%) + Preferred (30%) overlap'],
            ['Experience', '25%', 'candidateYears vs requiredYears'],
            ['Education', '20%', 'Level hierarchy comparison'],
            ['Salary Fit', '15%', 'Within budget range check'],
          ]} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Skills Match Detail:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>Exact match: 1.0 points per skill</li>
              <li>Partial match (substring): 0.8 points</li>
              <li>Category match: 0.5 points</li>
              <li>Score = <Code>{'(matchedRequired / required.length) × 70 + (matchedPreferred / preferred.length) × 30'}</Code></li>
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Experience Match:</p>
            <ScoreTable rows={[
              ['Meets/exceeds requirement', '100'],
              ['≥75% of required', '75'],
              ['≥50% of required', '50'],
              ['Below 50%', '25'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Education Hierarchy: PhD(5) → Masters(4) → Bachelors(3) → Diploma(2) → HS(1)</p>
            <ScoreTable rows={[
              ['Meets or exceeds', '100'],
              ['One level below', '60'],
              ['Two+ levels below', '30'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Salary Fit:</p>
            <ScoreTable rows={[
              ['Within range', '100'],
              ['Below minimum', '90'],
              ['Above max by ≤10%', '70'],
              ['Above max by >10%', '40'],
              ['No salary data', '80 (neutral)'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Recommendation Thresholds:</p>
            <ThresholdBar ranges={[
              { label: 'Weak', end: 40, color: 'bg-red-200 text-red-700' },
              { label: 'Partial', end: 60, color: 'bg-yellow-200 text-yellow-700' },
              { label: 'Good', end: 80, color: 'bg-blue-200 text-blue-700' },
              { label: 'Strong', end: 100, color: 'bg-green-200 text-green-700' },
            ]} />
          </div>
        </div>
      ),
      outputs: [
        'overallScore: 0-100',
        'matchLevel: STRONG_MATCH (≥80) / GOOD_MATCH (≥60) / PARTIAL_MATCH (≥40) / WEAK_MATCH (<40)',
        'matchedSkills: string[] — skills that matched',
        'missingSkills: string[] — required skills not found',
        'recommendation: string — bilingual EN/AR reasoning',
      ],
      limitations: [
        'Skill matching is keyword-based, not semantic',
        'Soft skills and cultural fit not measured',
        'Candidate potential not assessed (only current skills)',
        'Location proximity not factored',
      ],
      biasMitigations: [
        'No gender, nationality, or age used in scoring',
        'All candidates scored by the same deterministic algorithm',
        'Skills weighted equally regardless of source',
        'Human review required below 85% confidence',
      ],
      example: (
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p><strong>Candidate:</strong> Ahmed — Python, SQL, 5 years, BSc</p>
          <p><strong>Job:</strong> Data Analyst — Python, SQL, R required, 3 years min, BSc</p>
          <p>Skills: 2/3 matched = 67% → 67 × 0.40 = <strong>26.7</strong></p>
          <p>Experience: 5/3 = exceeds → 100 × 0.25 = <strong>25.0</strong></p>
          <p>Education: BSc/BSc = meets → 100 × 0.20 = <strong>20.0</strong></p>
          <p>Salary: within range → 100 × 0.15 = <strong>15.0</strong></p>
          <p style={{ fontWeight: 700 }}>Total: 86.7/100 — STRONG_MATCH</p>
        </div>
      ),
    },
  },

  // ════════════════════ 2. CANDIDATE RANKING ════════════════════
  {
    id: 'candidate-ranking',
    title: 'Candidate Ranking & Seriousness Score',
    category: 'scoring',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/ai/candidate-ranking-engine.ts',
    lastUpdated: '2026-02-22',
    icon: Award,
    sections: {
      purpose: 'Ranks candidates by combining AI match scores with behavioral seriousness indicators. Measures commitment and engagement alongside qualifications.',
      inputs: [
        'matchScore: from AI Job Matching (0-100)',
        'Candidate interaction data: response times, profile completeness, documents, interview attendance, follow-ups',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}><Code>{'Overall = matchScore × 0.50 + seriousnessScore × 0.30 + completenessScore × 0.20'}</Code></p>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Seriousness Weights:</p>
            <WeightTable rows={[
              ['Response Time', '25%', 'How fast candidate replies'],
              ['Profile Completeness', '20%', 'filledFields / 10 total fields'],
              ['Document Submission', '20%', 'CV (+50), Certs (+30), Refs (+20)'],
              ['Interview Attendance', '15%', 'attended / scheduled, -20 per no-show'],
              ['Follow-up', '10%', 'Sent follow-up + asked questions'],
              ['Application Quality', '10%', 'Cover letter, customization, relevance'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Response Time Scoring:</p>
            <ScoreTable rows={[
              ['≤4 hours', '100'], ['≤12 hours', '85'], ['≤24 hours', '70'],
              ['≤48 hours', '50'], ['≤72 hours', '30'], ['>72 hours', '15'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Recommendation Thresholds (Overall):</p>
            <ThresholdBar ranges={[
              { label: 'Not Recommended', end: 35, color: 'bg-red-200 text-red-700' },
              { label: 'Consider', end: 55, color: 'bg-yellow-200 text-yellow-700' },
              { label: 'Recommended', end: 75, color: 'bg-blue-200 text-blue-700' },
              { label: 'Highly Rec.', end: 100, color: 'bg-green-200 text-green-700' },
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Red Flags Detected:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li><Code>slow_responder</Code> — avg response &gt;72 hours</li>
              <li><Code>incomplete_profile</Code> — completeness &lt;50%</li>
              <li><Code>no_show_risk</Code> — missed 1+ interviews</li>
              <li><Code>overqualified</Code> — salary mismatch upward</li>
              <li><Code>underqualified</Code> — missing 3+ required skills</li>
            </ul>
          </div>
        </div>
      ),
      outputs: [
        'overallScore: 0-100',
        'rank: integer position among candidates',
        'recommendation: HIGHLY_RECOMMENDED / RECOMMENDED / CONSIDER / NOT_RECOMMENDED',
        'seriousnessFactors: detailed breakdown per factor',
        'flags: string[] — detected red flags',
      ],
      limitations: [
        'Response time relies on tracked email interactions — untracked channels not measured',
        'Candidates without prior interactions get neutral scores (50)',
        'Does not account for external circumstances affecting response time',
      ],
      biasMitigations: [
        'Same seriousness criteria applied to all candidates uniformly',
        'No demographic data used in scoring',
        'Behavioral metrics are objective and measurable',
      ],
    },
  },

  // ════════════════════ 3. RETENTION RISK ════════════════════
  {
    id: 'retention-risk',
    title: 'Retention Risk Score (Flight Risk)',
    category: 'scoring',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/retention/retention-engine.ts',
    lastUpdated: '2026-02-22',
    icon: Heart,
    sections: {
      purpose: 'Predicts the likelihood of an employee leaving the organization by analyzing 7 risk factors. Enables proactive retention interventions.',
      inputs: [
        'Employee: salary history, performance reviews, leave records, tenure, promotion history',
        'Department: headcount, overtime data',
        'Disciplinary: warnings, actions',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}><Code>{'Flight Risk = min(100, Σ(factorScore × factorWeight / 100))'}</Code></p>
          <WeightTable rows={[
            ['Salary Stagnation', '20%', 'Months since last raise'],
            ['Performance Decline', '20%', 'Rating trend (drop/stagnant/improving)'],
            ['Leave Patterns', '15%', 'Suspicious absence patterns'],
            ['Career Growth', '15%', 'Months without promotion'],
            ['Tenure Risk', '10%', 'Risk varies by tenure bucket'],
            ['Disciplinary', '10%', 'Active warnings severity'],
            ['Workload/Burnout', '10%', 'Overtime hours, team size'],
          ]} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Salary Stagnation:</p>
            <ScoreTable rows={[
              ['≥24 months no raise', '100'], ['≥18 months', '80'], ['≥12 months', '50'],
              ['≥6 months', '20'], ['<6 months', '0'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Performance Decline:</p>
            <ScoreTable rows={[
              ['Rating drop ≥2 levels', '100'], ['Rating drop 1 level', '70'],
              ['Stagnant low (≤2/5)', '80'], ['Stable (3/5)', '30'], ['Improving', '0'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Leave Patterns:</p>
            <ScoreTable rows={[
              ['≥4 sick leaves in 3 months', '90'], ['≥3 Mon/Fri absences', '80'],
              ['≥5 leaves in 3 months', '60'], ['≥2 leaves', '30'], ['Normal', '0'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Risk Levels:</p>
            <ThresholdBar ranges={[
              { label: 'LOW', end: 25, color: 'bg-green-200 text-green-700' },
              { label: 'MODERATE', end: 50, color: 'bg-yellow-200 text-yellow-700' },
              { label: 'HIGH', end: 75, color: 'bg-orange-200 text-orange-700' },
              { label: 'CRITICAL', end: 100, color: 'bg-red-200 text-red-700' },
            ]} />
          </div>
        </div>
      ),
      outputs: [
        'flightRiskScore: 0-100',
        'riskLevel: LOW (≤25) / MODERATE (≤50) / HIGH (≤75) / CRITICAL (>75)',
        'factors: detailed breakdown with individual scores and weighted contributions',
        'recommendations: string[] — suggested retention actions',
      ],
      limitations: [
        'Cannot detect external factors (market offers, personal circumstances)',
        'Leave pattern analysis may flag legitimate medical absences',
        'Historical data quality affects accuracy',
        'Does not measure employee sentiment directly',
      ],
      biasMitigations: [
        'No demographic data (gender, nationality, age) used',
        'Objective metrics only (dates, numbers, ratings)',
        'Same algorithm applied to all employees regardless of role',
        'Human review required for CRITICAL risk alerts',
      ],
    },
  },

  // ════════════════════ 4. PROMOTION READINESS ════════════════════
  {
    id: 'promotion-readiness',
    title: 'Promotion Readiness Score',
    category: 'scoring',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/promotions/promotion-engine.ts',
    lastUpdated: '2026-02-22',
    icon: TrendingUp,
    sections: {
      purpose: 'Evaluates employee readiness for promotion based on tenure, performance history, promotion cadence, and disciplinary record. Calculates suggested new salary.',
      inputs: [
        'Employee: hire date, current salary, current grade',
        'Performance reviews: ratings history',
        'Promotion history: dates and previous promotions',
        'Disciplinary: active warnings count',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}><Code>{'Total = tenure × 0.30 + performance × 0.40 + promoHistory × 0.20 + disciplinary × 0.10'}</Code></p>
          <WeightTable rows={[
            ['Tenure', '30%', 'Time in current role'],
            ['Performance', '40%', 'Average rating (highest weight)'],
            ['Promotion History', '20%', 'Time since last promotion'],
            ['Disciplinary Record', '10%', 'Active warnings count'],
          ]} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Tenure Score:</p>
            <ScoreTable rows={[
              ['<6 months', '0'], ['6-12 months', '30'], ['12-24 months', '70'],
              ['24-36 months', '100'], ['≥36 months', '80'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Performance Rating Mapping:</p>
            <ScoreTable rows={[
              ['EXCEPTIONAL / ≥4.5', '100'], ['EXCEEDS / ≥3.5', '80'],
              ['MEETS / ≥2.5', '50'], ['NEEDS_IMPROVEMENT / ≥1.5', '10'],
              ['UNSATISFACTORY / <1.5', '0'], ['No data', '30'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Promotion History:</p>
            <ScoreTable rows={[
              ['Never promoted', '100'], ['≥12 months since', '80'],
              ['≥6 months since', '30'], ['<6 months since', '0'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Readiness Tiers:</p>
            <ThresholdBar ranges={[
              { label: 'Not Ready', end: 40, color: 'bg-red-200 text-red-700' },
              { label: 'Consider', end: 60, color: 'bg-yellow-200 text-yellow-700' },
              { label: 'Recommended', end: 80, color: 'bg-blue-200 text-blue-700' },
              { label: 'Highly Rec.', end: 100, color: 'bg-green-200 text-green-700' },
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Salary Suggestion:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>If current &lt; new grade min: suggested = new grade minimum</li>
              <li>Else: suggested = max(newGrade.midSalary, currentSalary × 1.15)</li>
              <li>Cap: min(suggested, newGrade.maxSalary)</li>
              <li>GOSI impact: (newBase − currentBase) × 0.0975 (capped at SAR 45,000)</li>
            </ul>
          </div>
        </div>
      ),
      outputs: [
        'readinessScore: 0-100',
        'tier: HIGHLY_RECOMMENDED / RECOMMENDED / CONSIDER / NOT_READY',
        'component scores: tenure, performance, promoHistory, disciplinary',
        'suggestedSalary: SAR amount with GOSI impact',
      ],
      limitations: [
        'Does not measure leadership readiness or soft skills',
        'Relies on performance review data availability',
        '36+ months tenure gets 80 (not 100) — diminishing returns by design',
      ],
      biasMitigations: [
        'Purely data-driven (dates, ratings, counts)',
        'No subjective assessments used',
        'Same weights for all roles and departments',
      ],
    },
  },

  // ════════════════════ 5. INTERVIEW SCORING ════════════════════
  {
    id: 'interview-scoring',
    title: 'Interview Chatbot Scoring',
    category: 'scoring',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/ai/interview-chatbot-engine.ts',
    lastUpdated: '2026-02-22',
    icon: MessageSquare,
    sections: {
      purpose: 'Scores candidate answers in automated screening interviews using rule-based analysis. Evaluates length, relevance, specificity, and professionalism.',
      inputs: [
        'InterviewQuestion: question text, scoringCriteria keywords, weight (1-10), category',
        'Candidate answer: text, time spent (seconds)',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}>Base score: <Code>50</Code> (neutral), adjusted by modifiers:</p>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Length Analysis:</p>
            <ScoreTable rows={[
              ['<10 words', '-25 (flag: too_short)'],
              ['<25 words', '-10'],
              ['50-300 words (ideal)', '+10'],
              ['>500 words', '-5 (flag: very_long)'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Relevance (keyword matching against scoringCriteria):</p>
            <ScoreTable rows={[
              ['≥40% criteria words hit', '+15'],
              ['≥20% criteria words hit', '+5'],
              ['<20% (if ≥20 words)', '-5 (flag: possibly_off_topic)'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Other Modifiers:</p>
            <ScoreTable rows={[
              ['Has numbers/dates/metrics', '+10 (specificity bonus)'],
              ['Uses connecting words (structured)', '+5'],
              ['Casual/informal language', '-10 (flag: informal_tone)'],
              ['>200 words + zero specifics', 'flag: possible_copy'],
            ]} />
          </div>
          <p style={{ fontSize: 12 }}>Final answer score: <Code>{'max(0, min(100, score))'}</Code></p>
          <p style={{ fontSize: 13, marginTop: 8 }}><Code>{'Overall = Σ(answerScore × questionWeight) / Σ(questionWeight)'}</Code></p>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Question Category Weights (typical):</p>
            <ScoreTable rows={[
              ['Technical', '8-9'], ['Experience', '7-9'], ['Behavioral', '6'],
              ['Introduction', '5-7'], ['Motivation', '5'], ['Salary', '5'], ['Availability', '4'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Recommendation:</p>
            <ThresholdBar ranges={[
              { label: 'REJECT', end: 40, color: 'bg-red-200 text-red-700' },
              { label: 'CONSIDER', end: 65, color: 'bg-yellow-200 text-yellow-700' },
              { label: 'ADVANCE', end: 100, color: 'bg-green-200 text-green-700' },
            ]} />
          </div>
        </div>
      ),
      outputs: [
        'Overall score: 0-100 (weighted average)',
        'Per-question: score, analysis text, flags[]',
        'Recommendation: ADVANCE (≥65) / CONSIDER (≥40) / REJECT (<40)',
        'Strengths: questions scored ≥70',
        'Concerns: questions scored <40',
      ],
      limitations: [
        'Keyword-based — cannot understand nuanced or creative answers',
        'Cannot detect lies or exaggerations',
        'Short creative answers may be penalized unfairly',
        'Copy-paste detection is heuristic, not definitive',
      ],
      biasMitigations: [
        'Same scoring criteria for all candidates per question',
        'No analysis of writing style or vocabulary sophistication',
        'Language quality not scored (content only)',
        'Questions generated from job requirements, not interviewer bias',
      ],
    },
  },

  // ════════════════════ 6. SKILLS GAP ════════════════════
  {
    id: 'skills-gap',
    title: 'Skills Gap Analysis',
    category: 'analysis',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/ai/skills-matrix.ts',
    lastUpdated: '2026-02-22',
    icon: Layers,
    sections: {
      purpose: 'Identifies gaps between employee current skills and required proficiency levels. Calculates department maturity scores and prioritizes training needs.',
      inputs: [
        'Employee skills: name, current proficiency (1-5)',
        'Job/role requirements: skill name, required proficiency (1-5)',
        'Department: all employees and their skills',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Proficiency Levels:</p>
            <ScoreTable rows={[
              ['1 — Beginner', 'Basic awareness'], ['2 — Basic', 'Can perform with guidance'],
              ['3 — Intermediate', 'Independent performer'], ['4 — Advanced', 'Can mentor others'],
              ['5 — Expert', 'Organization-level authority'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Proficiency from Years of Experience:</p>
            <ScoreTable rows={[
              ['≥8 years', '5 (Expert)'], ['≥5 years', '4'], ['≥3 years', '3'],
              ['≥1 year', '2'], ['<1 year', '1'],
            ]} />
          </div>
          <p style={{ fontSize: 13 }}><Code>{'Gap = max(0, requiredLevel − currentLevel)'}</Code></p>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Priority Thresholds:</p>
            <ScoreTable rows={[
              ['Gap ≥ 3', 'HIGH priority'], ['Gap = 2', 'MEDIUM priority'], ['Gap = 1', 'LOW priority'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Department Maturity:</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>
              <Code>{'maturityScore = (totalLevelSum / totalSkillCount / 5) × 100'}</Code>
            </p>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              Department gap: <Code>{'avgGap = totalGap / affectedEmployees'}</Code> — HIGH (≥3), MEDIUM (≥2), LOW (&lt;2)
            </p>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Special Assignments:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>Certifications → Level 4 (Advanced)</li>
              <li>Languages → Level 3 (Intermediate)</li>
            </ul>
          </div>
        </div>
      ),
      outputs: [
        'Per employee: skill gaps[], priority per gap, training recommendations',
        'Per department: maturityScore (0-100), avgGap, priority level',
        'Sorted by: priority first (HIGH→MEDIUM→LOW), then gap size descending',
      ],
      limitations: [
        'Proficiency is self-assessed or estimated from years — not verified',
        'Skill taxonomy is fixed — new skills must be manually added',
        'Does not measure learning ability or potential',
      ],
      biasMitigations: [
        'Same proficiency scale for all employees',
        'Gap is purely mathematical (required − current)',
        'No weighting by employee demographics',
      ],
    },
  },

  // ════════════════════ 7. BURNOUT DETECTION ════════════════════
  {
    id: 'burnout-detection',
    title: 'Burnout Detection',
    category: 'analysis',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/scheduling/scheduling-engine.ts',
    lastUpdated: '2026-02-22',
    icon: Flame,
    sections: {
      purpose: 'Detects employee burnout risk from scheduling patterns — hours worked, consecutive days, night shifts, overtime, and rest periods. Saudi Labor Law compliant.',
      inputs: [
        'ShiftAssignment[]: employee shifts for the analysis period',
        'ShiftTemplate[]: shift definitions with working hours and overnight flag',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}>Cumulative score (0-100), capped at 100:</p>
          <WeightTable rows={[
            ['Total Hours', '+20 if >50h/wk, +10 if >44h/wk', 'Weekly hours vs limit'],
            ['Night Shifts', '+25 if ≥4/wk, +10 if ≥2/wk', 'Overnight shift count'],
            ['Consecutive Days', '+25 if ≥6, +15 if ≥5', 'Days without rest'],
            ['Overtime', '+20 if >6h/wk, +10 if >2h/wk', 'Extra hours beyond scheduled'],
            ['Short Rest', '+15 if <12h between shifts', 'Saudi Labor Law Art. 98'],
          ]} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Risk Levels:</p>
            <ThresholdBar ranges={[
              { label: 'Balanced', end: 25, color: 'bg-green-200 text-green-700' },
              { label: 'Elevated', end: 50, color: 'bg-yellow-200 text-yellow-700' },
              { label: 'Moderate Risk', end: 75, color: 'bg-orange-200 text-orange-700' },
              { label: 'High Risk', end: 100, color: 'bg-red-200 text-red-700' },
            ]} />
          </div>
          <p style={{ fontSize: 12, color: C.textMuted }}><Code>atRisk = score ≥ 50</Code></p>
        </div>
      ),
      outputs: [
        'atRisk: boolean (score ≥ 50)',
        'score: 0-100',
        'reasons: string[] — contributing factors',
        'recommendation: action text based on score tier',
      ],
      limitations: [
        'Schedule-based only — cannot detect emotional/psychological burnout',
        'Does not consider employee preferences or voluntary overtime',
        'Ramadan hours use approximate Hijri dates',
      ],
      biasMitigations: [
        'Same thresholds for all employees',
        'Based on Saudi Labor Law Articles 98, 101, 104, 107',
        'No demographic factors in scoring',
      ],
    },
  },

  // ════════════════════ 8. GOSI CALCULATOR ════════════════════
  {
    id: 'gosi-calculator',
    title: 'GOSI Calculator',
    category: 'analysis',
    version: '2025',
    status: 'active',
    module: 'lib/cvision/integrations/gosi/gosi-client.ts',
    lastUpdated: '2026-02-22',
    icon: Calculator,
    sections: {
      purpose: 'Calculates General Organization for Social Insurance (GOSI) contributions for Saudi and non-Saudi employees per 2025 rates.',
      inputs: [
        'basicSalary: SAR monthly',
        'housingAllowance: SAR monthly',
        'nationality: Saudi or Non-Saudi',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}><Code>{'Base = min(basicSalary + housingAllowance, 45,000)'}</Code></p>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Saudi Employee Rates:</p>
            <WeightTable rows={[
              ['Pension (Employer)', '9.00%', 'Pension fund'],
              ['Pension (Employee)', '9.00%', 'Pension fund'],
              ['SANED (Employer)', '0.75%', 'Unemployment insurance'],
              ['SANED (Employee)', '0.75%', 'Unemployment insurance'],
              ['Occupational Hazard (Employer)', '2.00%', 'Work injury insurance'],
              ['Total Employer', '11.75%', '9.00 + 0.75 + 2.00'],
              ['Total Employee', '9.75%', '9.00 + 0.75'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Non-Saudi Employee Rates:</p>
            <WeightTable rows={[
              ['Occupational Hazard (Employer)', '2.00%', 'Work injury only'],
              ['Total Employer', '2.00%', 'Employer only'],
              ['Total Employee', '0.00%', 'No employee contribution'],
            ]} />
          </div>
          <p style={{ fontSize: 12, color: C.textMuted }}>
            Base salary capped at <strong>SAR 45,000</strong> — amounts above this cap are not subject to GOSI.
          </p>
        </div>
      ),
      outputs: [
        'employerContribution: SAR monthly',
        'employeeDeduction: SAR monthly',
        'totalContribution: employer + employee',
        'breakdown: { annuity, saned, hazard } per party',
      ],
      limitations: [
        'Rates are for 2025 — must be updated when GOSI publishes new rates',
        'Does not handle special cases (military, diplomatic)',
        'Voluntary additional contributions not calculated',
      ],
      biasMitigations: [
        'Regulatory formula — no discretion involved',
        'Different rates for Saudi/Non-Saudi per law (not a bias)',
      ],
    },
  },

  // ════════════════════ 9. NITAQAT ════════════════════
  {
    id: 'nitaqat-calculator',
    title: 'Nitaqat Calculator',
    category: 'analysis',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/reports/nitaqat-report.ts',
    lastUpdated: '2026-02-22',
    icon: Scale,
    sections: {
      purpose: 'Calculates Saudization rate and determines Nitaqat band classification per HRSD regulations. Supports sector-specific and size-specific thresholds.',
      inputs: [
        'Employees: list with nationality and employment type',
        'Company: sector, total headcount',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}><Code>{'Saudization Rate = (Saudi Employees / Total Employees) × 100'}</Code></p>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Weight Factors:</p>
            <ScoreTable rows={[
              ['Full-time employee', '× 1.0'],
              ['Part-time employee', '× 0.5'],
              ['Disabled employee', '× 4.0'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Company Size Tiers:</p>
            <ScoreTable rows={[
              ['SMALL', '10-49 employees'],
              ['MEDIUM', '50-499 employees'],
              ['LARGE', '500-2,999 employees'],
              ['GIANT', '3,000+ employees'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Healthcare Sector Bands (50-499):</p>
            <ThresholdBar ranges={[
              { label: 'Red', end: 10, color: 'bg-red-200 text-red-700' },
              { label: 'Yellow', end: 17, color: 'bg-yellow-200 text-yellow-700' },
              { label: 'Green Low', end: 23, color: 'bg-green-100 text-green-700' },
              { label: 'Green Mid', end: 27, color: 'bg-green-200 text-green-800' },
              { label: 'Green High', end: 40, color: 'bg-green-300 text-green-800' },
              { label: 'Platinum', end: 100, color: 'bg-blue-200 text-blue-800' },
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Required Rates by Sector (MEDIUM tier):</p>
            <ScoreTable rows={[
              ['Technology', '30%'], ['Services', '18%'], ['Retail', '15%'],
              ['General', '12%'], ['Manufacturing', '12%'], ['Construction', '10%'],
            ]} />
          </div>
        </div>
      ),
      outputs: [
        'saudizationRate: percentage',
        'nitaqatBand: PLATINUM / GREEN_HIGH / GREEN_MID / GREEN_LOW / YELLOW / RED',
        'requiredRate: minimum for current band',
        'gap: distance to next band',
        'headcount: saudi, nonSaudi, total',
      ],
      limitations: [
        'Band thresholds are approximate — check HRSD for latest official values',
        'Sector classification must be manually set',
        'Special workforce categories may have different rules',
      ],
      biasMitigations: [
        'Regulatory formula — no discretion',
        'Weighted equally per employment type',
      ],
    },
  },

  // ════════════════════ 10. WHAT-IF SIMULATION ════════════════════
  {
    id: 'whatif-simulation',
    title: 'What-If Simulation',
    category: 'analysis',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/whatif/whatif-engine.ts',
    lastUpdated: '2026-02-22',
    icon: Shuffle,
    sections: {
      purpose: 'Simulates the impact of HR decisions (salary changes, hires, layoffs, promotions) on retention, Saudization, costs, and compliance before execution.',
      inputs: [
        'Scenario: type (salary_increase, new_hire, layoff, promotion)',
        'Parameters: amount, employee IDs, department',
        'Current state: employee roster, costs, Saudization rate',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Salary Increase Impact:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>Reduces <Code>salary_stagnation</Code> factor by 20-80% based on increase %</li>
              <li>GOSI impact: new base capped at SAR 45,000</li>
              <li>Net retention improvement calculated</li>
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>New Hire Impact:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>Reduces <Code>workload_burnout</Code> by up to 40% (15% per hire, capped)</li>
              <li>Updates Saudization rate and Nitaqat band</li>
              <li>Additional GOSI cost calculated</li>
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Layoff Impact:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>End of Service: first 5 years × 0.5 monthly + additional years × 1.0 monthly</li>
              <li>Adds +15 risk points to remaining employees (anxiety factor)</li>
              <li>Resignation multipliers: &lt;2yr = 0, 2-5yr = ⅓, 5-10yr = ⅔, 10+yr = full</li>
            </ul>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Promotion Impact:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>Reduces <Code>career_growth</Code> factor by 80%</li>
              <li>Reduces <Code>salary_stagnation</Code> by 50%</li>
              <li>New salary calculated per promotion engine</li>
            </ul>
          </div>
        </div>
      ),
      outputs: [
        'Before/after comparison: retention scores, costs, Saudization, Nitaqat band',
        'Cost analysis: GOSI delta, salary delta, end-of-service liability',
        'Risk analysis: retention score changes per affected employee',
        'ROI: retention cost savings vs implementation cost',
      ],
      limitations: [
        'Simulations are estimates — actual outcomes may differ',
        'Cannot model market-wide changes (competitor salary moves)',
        'End-of-service calculation uses standard formula only',
      ],
      biasMitigations: [
        'Same simulation model for all departments',
        'Financial calculations are regulatory (GOSI, EOS)',
        'Higher confidence threshold (90%) due to financial impact',
      ],
    },
  },

  // ════════════════════ 11. CONFIDENCE THRESHOLDS ════════════════════
  {
    id: 'confidence-thresholds',
    title: 'Confidence Threshold System',
    category: 'governance',
    version: '1.0',
    status: 'active',
    module: 'lib/cvision/ai/confidence-threshold-engine.ts',
    lastUpdated: '2026-02-22',
    icon: SlidersHorizontal,
    sections: {
      purpose: 'Controls when AI decisions are auto-approved, routed to human review, or auto-rejected. Provides escalation, feedback loops, and accuracy tracking for each AI module.',
      inputs: [
        'AI decision: moduleId, confidenceScore (0-100), aiDecision text, reasoning',
        'ThresholdConfig: autoApproveThreshold, reviewThreshold, autoRejectThreshold per module',
      ],
      algorithm: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Evaluation Logic:</p>
            <ScoreTable rows={[
              ['score ≥ autoApproveThreshold', '→ AUTO_APPROVE'],
              ['score < autoRejectThreshold', '→ AUTO_REJECT'],
              ['Otherwise', '→ HUMAN_REVIEW (queued)'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Default Thresholds per Module:</p>
            <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden', fontSize: 12, marginTop: 8, marginBottom: 8 }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr className="bg-muted/50">
                    <th style={{ textAlign: 'left', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>Module</th>
                    <th style={{ textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>Auto-Approve</th>
                    <th style={{ textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>Review</th>
                    <th style={{ textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>Reject</th>
                    <th style={{ textAlign: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>Max Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['AI Matching', '85%', '60%', '30%', '48h'],
                    ['Retention Risk', '80%', '50%', '20%', '72h'],
                    ['Candidate Ranking', '80%', '55%', '35%', '48h'],
                    ['Skills Assessment', '75%', '50%', '25%', '96h'],
                    ['Interview Scoring', '80%', '50%', '30%', '48h'],
                    ['What-If Simulation', '90%', '70%', '40%', '24h'],
                    ['Promotion Readiness', '80%', '55%', '30%', '72h'],
                  ].map(([mod, aa, rv, rj, t], i) => (
                    <tr key={i} className={i % 2 === 0 ? '' : 'bg-muted/30'}>
                      <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontWeight: 500 }}>{mod}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, textAlign: 'center', color: C.green }}>{aa}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, textAlign: 'center', color: C.orange }}>{rv}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, textAlign: 'center', color: C.red }}>{rj}</td>
                      <td style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, textAlign: 'center' }}>{t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Priority Derivation for Review Queue:</p>
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
              <Code>{'position = (score − reviewThreshold) / (autoApprove − reviewThreshold)'}</Code>
            </p>
            <ScoreTable rows={[
              ['position < 0.15', 'URGENT'],
              ['position < 0.40', 'HIGH'],
              ['position < 0.70', 'MEDIUM'],
              ['position ≥ 0.70', 'LOW'],
            ]} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Escalation:</p>
            <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <li>Items not reviewed within maxReviewTime → auto-escalated</li>
              <li>Escalation role configurable per module (HR_MANAGER, OWNER, etc.)</li>
              <li>Manual escalation available at any time</li>
            </ul>
          </div>
        </div>
      ),
      outputs: [
        'action: AUTO_APPROVED / QUEUED_FOR_REVIEW / AUTO_REJECTED',
        'reviewId: unique ID if queued',
        'priority: URGENT / HIGH / MEDIUM / LOW',
        'expiresAt: auto-escalation deadline',
        'accuracy: per-module agreement rate over time',
      ],
      limitations: [
        'Thresholds are configurable but defaults may not suit all organizations',
        'Accuracy requires sufficient reviewed decisions to be meaningful',
        'Does not adapt thresholds automatically (must be tuned manually)',
      ],
      biasMitigations: [
        'Transparent thresholds — fully visible and adjustable',
        'Human always has final say in the review zone',
        'Feedback loop (1-5 star) tracks AI quality over time',
        'Accuracy below 80% triggers alerts for recalibration',
      ],
    },
  },
];

// ─── Component State ────────────────────────────────────────────────────────

  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['job-matching']));
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = useMemo(() => {
    if (!search.trim()) return ALGORITHMS;
    const q = search.toLowerCase();
    return ALGORITHMS.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.module.toLowerCase().includes(q) ||
      a.id.includes(q)
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map = new Map<string, AlgorithmDoc[]>();
    for (const a of filtered) {
      const list = map.get(a.category) || [];
      list.push(a);
      map.set(a.category, list);
    }
    return map;
  }, [filtered]);

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scrollTo = (id: string) => {
    setExpandedIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const expandAll = () => setExpandedIds(new Set(ALGORITHMS.map(a => a.id)));
  const collapseAll = () => setExpandedIds(new Set());

  return (
    <div style={{ display: 'flex' }}>
      {/* ── Sidebar ── */}
      <aside style={{ display: 'none', width: 256, position: 'sticky', overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BookOpen style={{ height: 20, width: 20 }} />
          <h2 style={{ fontWeight: 700, fontSize: 13 }}>{tr('الخوارزميات', 'Algorithms')}</h2>
        </div>

        {(['scoring', 'analysis', 'governance'] as const).map(cat => {
          const info = CATEGORY_LABELS[cat];
          const items = ALGORITHMS.filter(a => a.category === cat);
          const CatIcon = info.icon;
          return (
            <div key={cat} style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <CatIcon style={{ height: 14, width: 14 }} />
                {info.label}
              </p>
              {items.map(a => (
                <button
                  key={a.id}
                  onClick={() => scrollTo(a.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 12, paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, borderRadius: 6, transition: 'color 0.2s, background 0.2s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {a.title}
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen style={{ height: 24, width: 24 }} />
              {tr('توثيق الخوارزميات', 'Algorithm Documentation')}
            </h1>
            <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
              {tr('توثيق كامل لجميع نماذج الذكاء الاصطناعي وأنظمة التسجيل', 'Complete documentation of all AI models and scoring systems')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={expandAll}>{tr('توسيع الكل', 'Expand All')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={collapseAll}>{tr('طي الكل', 'Collapse All')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => window.print()}>
              <Printer style={{ height: 14, width: 14, marginRight: 4 }} />
              {tr('طباعة', 'Print')}
            </CVisionButton>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
          <CVisionInput C={C}
            placeholder={tr("بحث في الخوارزميات بالاسم أو الوحدة أو الكلمة المفتاحية...", "Search algorithms by name, module, or keyword...")}
            style={{ paddingLeft: 40 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {(['scoring', 'analysis', 'governance'] as const).map(cat => {
            const info = CATEGORY_LABELS[cat];
            const CatIcon = info.icon;
            const count = ALGORITHMS.filter(a => a.category === cat).length;
            return (
              <CVisionCard C={C} key={cat}>
                <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
                  <CatIcon style={{ height: 20, width: 20, marginBottom: 4, color: C.textMuted }} />
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{count}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{info.label}</div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <FileText style={{ height: 20, width: 20, marginBottom: 4, color: C.textMuted }} />
              <div style={{ fontSize: 24, fontWeight: 700 }}>{ALGORITHMS.length}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي الخوارزميات', 'Total Algorithms')}</div>
            </CVisionCardBody>
          </CVisionCard>
        </div>

        {/* Algorithm Cards */}
        {(['scoring', 'analysis', 'governance'] as const).map(cat => {
          const info = CATEGORY_LABELS[cat];
          const items = grouped.get(cat);
          if (!items || items.length === 0) return null;
          const CatIcon = info.icon;

          return (
            <div key={cat}>
              <h2 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingTop: 8 }}>
                <CatIcon style={{ height: 20, width: 20 }} />
                {info.label}
                {/* Arabic label removed */}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map(algo => {
                  const isExpanded = expandedIds.has(algo.id);
                  const statusStyle = STATUS_STYLES[algo.status];
                  const AlgoIcon = algo.icon;

                  return (
                    <div
                      key={algo.id}
                      ref={el => { sectionRefs.current[algo.id] = el; }}
                    >
                      <CVisionCard C={C}>
                        <CVisionCardHeader C={C}
                          style={{ cursor: 'pointer', transition: 'color 0.2s, background 0.2s', paddingTop: 12, paddingBottom: 12 }}
                          onClick={() => toggle(algo.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div className="shrink-0">
                              {isExpanded ? (
                                <ChevronDown style={{ height: 16, width: 16, color: C.textMuted }} />
                              ) : (
                                <ChevronRight style={{ height: 16, width: 16, color: C.textMuted }} />
                              )}
                            </div>
                            <AlgoIcon style={{ height: 20, width: 20, color: C.textMuted }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{algo.title}</div>
                                <CVisionBadge C={C} className={statusStyle.color} variant="secondary">
                                  {statusStyle.label}
                                </CVisionBadge>
                                <CVisionBadge C={C} variant="outline" className="text-[10px]">v{algo.version}</CVisionBadge>
                              </div>
                              <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                                {algo.module}
                              </p>
                            </div>
                            <span style={{ color: C.textMuted }}>
                              Updated {algo.lastUpdated}
                            </span>
                          </div>
                        </CVisionCardHeader>

                        {isExpanded && (
                          <CVisionCardBody style={{ paddingTop: 0, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Purpose */}
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>{tr('الغرض', 'Purpose')}</p>
                              <p style={{ fontSize: 13 }}>{algo.sections.purpose}</p>
                            </div>

                            {/* Inputs */}
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Input Data</p>
                              <ul style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2, color: C.textMuted }}>
                                {algo.sections.inputs.map((inp, i) => <li key={i}>{inp}</li>)}
                              </ul>
                            </div>

                            {/* Algorithm */}
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>{tr('الخوارزمية', 'Algorithm')}</p>
                              {algo.sections.algorithm}
                            </div>

                            {/* Outputs */}
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Output</p>
                              <ul style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2, color: C.textMuted }}>
                                {algo.sections.outputs.map((out, i) => <li key={i}>{out}</li>)}
                              </ul>
                            </div>

                            {/* Example */}
                            {algo.sections.example && (
                              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, padding: 12 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>{tr('مثال', 'Example')}</p>
                                {algo.sections.example}
                              </div>
                            )}

                            {/* Limitations */}
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <AlertTriangle style={{ height: 12, width: 12 }} /> Known Limitations
                              </p>
                              <ul style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2, color: C.textMuted }}>
                                {algo.sections.limitations.map((lim, i) => <li key={i}>{lim}</li>)}
                              </ul>
                            </div>

                            {/* Bias */}
                            <div>
                              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Shield style={{ height: 12, width: 12 }} /> Bias Mitigations
                              </p>
                              <ul style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2, color: C.textMuted }}>
                                {algo.sections.biasMitigations.map((bm, i) => <li key={i}>{bm}</li>)}
                              </ul>
                            </div>

                            {/* Confidence Threshold */}
                            <div style={{ borderRadius: 8, background: C.blueDim, border: `1px solid ${C.border}`, padding: 12 }}>
                              <p style={{ fontSize: 12, fontWeight: 500, color: C.blue }}>
                                Confidence Threshold: Human review required for decisions below the auto-approve threshold.
                                See <button onClick={() => scrollTo('confidence-thresholds')} className="underline">Confidence Threshold System</button> for module-specific settings.
                              </p>
                            </div>
                          </CVisionCardBody>
                        )}
                      </CVisionCard>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {filtered.length === 0 && (
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
              <Search style={{ height: 48, width: 48, marginBottom: 12 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>No algorithms found</p>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                Try a different search term
              </p>
            </CVisionCardBody>
          </CVisionCard>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 12, color: C.textMuted, paddingTop: 24, paddingBottom: 24, borderTop: `1px solid ${C.border}` }}>
          <p>CVision HR — Algorithm Documentation</p>
          <p style={{ marginTop: 4 }}>
            All algorithms are deterministic and rule-based unless explicitly noted.
            Weights and thresholds are verified against the codebase as of the documented date.
          </p>
        </div>
      </main>
    </div>
  );
}
