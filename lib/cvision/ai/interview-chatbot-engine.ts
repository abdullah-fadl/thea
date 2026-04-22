/**
 * AI Interview Chatbot Engine
 *
 * Conducts automated initial screening interviews.
 * Generates questions based on job requirements, scores answers with
 * rule-based analysis (keyword matching, length, specificity), and
 * produces an overall recommendation.
 *
 * Pure computation + DB — no external AI API calls.
 */

import { v4 as uuidv4 } from 'uuid';
import { getCVisionCollection, createTenantFilter } from '@/lib/cvision/db';
import type {
  CVisionCandidate,
  CVisionJobRequisition,
  JobSkillsStructured,
  InterviewSessionUpdateFields,
} from '@/lib/cvision/types';
import type { Filter, Sort } from 'mongodb';
import { getSkillsForJobTitle } from './skill-mappings';

// ─── Types ──────────────────────────────────────────────────────────────────

export type QuestionCategory =
  | 'INTRODUCTION'
  | 'TECHNICAL'
  | 'EXPERIENCE'
  | 'BEHAVIORAL'
  | 'SITUATIONAL'
  | 'MOTIVATION'
  | 'SALARY'
  | 'AVAILABILITY';

export type SessionStatus = 'PENDING' | 'SENT' | 'IN_PROGRESS' | 'COMPLETED' | 'SCORED' | 'EXPIRED' | 'CANCELLED';
export type SessionRecommendation = 'ADVANCE' | 'CONSIDER' | 'REJECT';

export interface InterviewQuestion {
  id: string;
  order: number;
  category: QuestionCategory;
  question: string;
  expectedAnswer?: string;
  scoringCriteria: string;
  weight: number;
  required: boolean;
  followUpEnabled: boolean;
  maxAnswerLength?: number;
  timeLimit?: number;
}

export interface InterviewAnswer {
  questionId: string;
  answer: string;
  answeredAt: Date;
  timeSpent: number;
  score: number;
  aiAnalysis: string;
  flags: string[];
}

export interface InterviewSession {
  id: string;
  tenantId: string;
  sessionId: string;
  candidateId: string;
  candidateName: string;
  requisitionId: string;
  jobTitle: string;
  questions: InterviewQuestion[];
  language: 'en' | 'ar' | 'both';
  maxDuration: number;
  status: SessionStatus;
  startedAt?: Date;
  completedAt?: Date;
  currentQuestionIndex: number;
  answers: InterviewAnswer[];
  overallScore: number;
  summary: string;
  recommendation: SessionRecommendation;
  strengths: string[];
  concerns: string[];
  inviteSentAt?: Date;
  inviteLink: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Question Templates ─────────────────────────────────────────────────────

interface QuestionTemplate {
  question: string;
  scoringCriteria: string;
  weight: number;
  followUpEnabled: boolean;
  expectedKeywords?: string[];
}

const QUESTION_TEMPLATES: Record<QuestionCategory, QuestionTemplate[]> = {
  INTRODUCTION: [
    {
      question: 'Please introduce yourself and tell us about your professional background.',

      scoringCriteria: 'Clear communication, relevant experience mentioned, professional tone',
      weight: 5,
      followUpEnabled: false,
    },
    {
      question: 'Why are you interested in this position?',

      scoringCriteria: 'Shows knowledge of company/role, genuine interest, career alignment',
      weight: 7,
      followUpEnabled: true,
    },
  ],
  EXPERIENCE: [
    {
      question: 'Describe your most relevant experience for this role. Please include specific examples and achievements.',
      scoringCriteria: 'Specific examples, quantifiable achievements, relevance to job',
      weight: 9,
      followUpEnabled: true,
    },
    {
      question: 'What was your biggest professional challenge and how did you handle it?',
      scoringCriteria: 'Problem-solving ability, resilience, learning from experience',
      weight: 7,
      followUpEnabled: true,
    },
  ],
  BEHAVIORAL: [
    {
      question: 'Tell me about a time you had to work with a difficult team member. How did you handle the situation?',
      scoringCriteria: 'Conflict resolution, teamwork, emotional intelligence',
      weight: 6,
      followUpEnabled: true,
    },
    {
      question: 'Describe a situation where you had to meet a tight deadline. What was the outcome?',
      scoringCriteria: 'Time management, prioritization, results under pressure',
      weight: 6,
      followUpEnabled: false,
    },
  ],
  SITUATIONAL: [
    {
      question: 'If you discovered a colleague was not following company policies, what would you do?',
      scoringCriteria: 'Integrity, diplomacy, escalation awareness',
      weight: 6,
      followUpEnabled: false,
    },
  ],
  MOTIVATION: [
    {
      question: 'What motivates you in your career, and what are your long-term professional goals?',
      scoringCriteria: 'Self-awareness, ambition aligned with role, growth mindset',
      weight: 5,
      followUpEnabled: false,
    },
  ],
  TECHNICAL: [], // generated dynamically
  SALARY: [
    {
      question: 'What are your salary expectations for this role?',
      scoringCriteria: 'Realistic expectations, market awareness, flexibility',
      weight: 5,
      followUpEnabled: false,
    },
  ],
  AVAILABILITY: [
    {
      question: 'When would you be available to start if selected?',
      scoringCriteria: 'Reasonable timeline, notice period awareness, eagerness',
      weight: 4,
      followUpEnabled: false,
    },
  ],
};

// Technical question generators keyed by skill domain
const TECHNICAL_GENERATORS: Record<string, QuestionTemplate> = {
  nursing: {
    question: 'Describe your experience with patient assessment and vital signs monitoring. What protocols do you follow?',
    scoringCriteria: 'Clinical knowledge, protocol awareness, patient safety',
    weight: 9,
    followUpEnabled: true,
  },
  nursing_leadership: {
    question: 'Describe your experience managing nursing staff. How do you ensure quality care standards, handle staffing challenges, and develop your team?',
    scoringCriteria: 'Leadership, staff management, quality improvement, staff development, performance management',
    weight: 9,
    followUpEnabled: true,
  },
  nursing_operations: {
    question: 'How do you handle department operations including scheduling, budget management, and regulatory compliance? Give a specific example.',
    scoringCriteria: 'Operations management, scheduling, budget, regulatory compliance, policy implementation',
    weight: 9,
    followUpEnabled: true,
  },
  nursing_quality: {
    question: 'Describe your experience with quality improvement initiatives in a healthcare setting. How do you measure and improve patient outcomes?',
    scoringCriteria: 'Quality improvement, patient outcomes, KPIs, evidence-based practice, accreditation',
    weight: 9,
    followUpEnabled: true,
  },
  programming: {
    question: 'Describe a complex technical project you have worked on. What technologies did you use and what challenges did you face?',
    scoringCriteria: 'Technical depth, architecture understanding, problem-solving',
    weight: 9,
    followUpEnabled: true,
  },
  data: {
    question: 'How do you approach data analysis? Walk us through your process from raw data to actionable insights.',
    scoringCriteria: 'Analytical thinking, methodology, tool proficiency',
    weight: 9,
    followUpEnabled: true,
  },
  finance: {
    question: 'Explain your experience with financial reporting and analysis. What tools and standards do you work with?',
    scoringCriteria: 'Financial knowledge, standards compliance, analytical skills',
    weight: 9,
    followUpEnabled: true,
  },
  hr: {
    question: 'Describe your experience with recruitment processes and employee relations. How do you handle sensitive HR situations?',
    scoringCriteria: 'HR knowledge, discretion, conflict resolution, policy awareness',
    weight: 9,
    followUpEnabled: true,
  },
  management: {
    question: 'How do you manage team performance and handle underperformers? Give a specific example.',
    scoringCriteria: 'Leadership style, performance management, coaching ability',
    weight: 8,
    followUpEnabled: true,
  },
  healthcare: {
    question: 'Describe your approach to patient safety and infection control in a healthcare environment.',
    scoringCriteria: 'Safety protocols, infection control knowledge, compliance',
    weight: 9,
    followUpEnabled: true,
  },
  default: {
    question: 'What specific skills and knowledge do you bring that make you the best candidate for this position?',
    scoringCriteria: 'Self-awareness, skill relevance, confidence',
    weight: 8,
    followUpEnabled: true,
  },
};

// Map skill keywords to domain for question generation
const SKILL_DOMAIN_MAP: Record<string, string> = {
  'patient care': 'nursing', 'clinical assessment': 'nursing', 'medication administration': 'nursing',
  nursing: 'nursing', bls: 'nursing', acls: 'nursing', 'vital signs': 'nursing',
  'vital signs monitoring': 'nursing', 'ehr documentation': 'nursing',
  // Nursing leadership skills → nursing_leadership domain
  'nursing leadership': 'nursing_leadership', 'staff management': 'nursing_leadership',
  'patient care standards': 'nursing_leadership', 'staff development': 'nursing_leadership',
  'staff coordination': 'nursing_leadership', 'training & mentoring': 'nursing_leadership',
  // Nursing operations
  'department management': 'nursing_operations', 'staff scheduling': 'nursing_operations',
  'clinical operations': 'nursing_operations', 'policy implementation': 'nursing_operations',
  'policy development': 'nursing_operations',
  // Nursing quality
  'quality improvement': 'nursing_quality',
  // General
  javascript: 'programming', typescript: 'programming', python: 'programming', react: 'programming',
  java: 'programming', node: 'programming', sql: 'programming', programming: 'programming',
  'data analysis': 'data', 'data science': 'data', excel: 'data', tableau: 'data', 'power bi': 'data',
  accounting: 'finance', finance: 'finance', budgeting: 'finance', auditing: 'finance',
  recruitment: 'hr', 'human resources': 'hr', 'employee relations': 'hr', payroll: 'hr',
  management: 'management', leadership: 'management', 'team lead': 'management',
  'performance management': 'management', 'strategic planning': 'management',
  'patient safety': 'healthcare', 'infection control': 'healthcare', 'emergency medicine': 'healthcare',
  'regulatory compliance': 'healthcare',
};

// ─── Expected Answer Keywords by Role ───────────────────────────────────────
// When a candidate's answer includes these concepts, their score increases.

const ROLE_EXPECTED_KEYWORDS: Record<string, Record<string, string[]>> = {
  // Nursing Leadership roles (Director, Manager, Head Nurse)
  nursing_leadership: {
    INTRODUCTION: ['leadership', 'management', 'staff', 'team', 'department', 'quality', 'patient care', 'years experience', 'director', 'supervisor', 'clinical', 'operations'],
    TECHNICAL: ['staff development', 'scheduling', 'performance', 'training', 'mentoring', 'retention', 'turnover', 'competency', 'staffing ratios', 'overtime', 'budget', 'policy', 'accreditation', 'jci', 'cbahi', 'KPI', 'quality metrics', 'patient satisfaction', 'safety'],
    EXPERIENCE: ['managed', 'led', 'supervised', 'implemented', 'improved', 'reduced', 'increased', 'team of', 'nurses', 'staff members', 'department', 'initiative', 'program', 'outcomes', 'patient satisfaction'],
    BEHAVIORAL: ['conflict', 'resolution', 'mediation', 'delegation', 'accountability', 'communication', 'collaboration', 'difficult', 'feedback', 'coaching'],
    SALARY: ['range', 'market', 'experience', 'negotiable', 'package', 'benefits'],
    AVAILABILITY: ['notice', 'weeks', 'immediately', 'start', 'month'],
  },
  // Basic Nursing roles (Staff Nurse, RN)
  nursing: {
    INTRODUCTION: ['patient care', 'clinical', 'nursing', 'hospital', 'years', 'experience', 'department', 'bedside', 'registered nurse'],
    TECHNICAL: ['assessment', 'vital signs', 'medication', 'protocol', 'infection control', 'patient safety', 'documentation', 'ehr', 'handoff', 'triage', 'emergency', 'wound care', 'IV', 'monitoring'],
    EXPERIENCE: ['patients', 'care', 'emergency', 'surgical', 'icu', 'ward', 'treated', 'monitored', 'administered', 'outcomes', 'improved'],
    BEHAVIORAL: ['team', 'collaboration', 'empathy', 'communication', 'stressful', 'patient', 'family', 'support'],
    SALARY: ['range', 'market', 'experience', 'shift differential'],
    AVAILABILITY: ['notice', 'weeks', 'immediately', 'start'],
  },
  // Programming/Software
  programming: {
    INTRODUCTION: ['developer', 'software', 'engineer', 'programming', 'years', 'projects', 'technology', 'stack'],
    TECHNICAL: ['architecture', 'api', 'database', 'testing', 'deployment', 'git', 'agile', 'performance', 'scalability', 'security', 'framework', 'design patterns', 'code review'],
    EXPERIENCE: ['built', 'developed', 'implemented', 'deployed', 'optimized', 'users', 'traffic', 'reduced', 'improved', 'team'],
    BEHAVIORAL: ['collaboration', 'code review', 'deadline', 'debugging', 'mentoring'],
  },
  // Data/Analytics
  data: {
    INTRODUCTION: ['data', 'analysis', 'analytics', 'insights', 'reporting', 'visualization'],
    TECHNICAL: ['sql', 'python', 'dashboard', 'visualization', 'cleaning', 'etl', 'model', 'statistical', 'kpi', 'metrics', 'power bi', 'tableau', 'excel'],
    EXPERIENCE: ['analyzed', 'discovered', 'insights', 'dashboard', 'report', 'stakeholders', 'improved', 'decision'],
  },
  // Finance/Accounting
  finance: {
    INTRODUCTION: ['finance', 'accounting', 'financial', 'reporting', 'audit', 'budget'],
    TECHNICAL: ['gaap', 'ifrs', 'reporting', 'reconciliation', 'audit', 'budget', 'forecast', 'erp', 'compliance', 'tax', 'variance'],
    EXPERIENCE: ['managed', 'prepared', 'audited', 'reconciled', 'reduced', 'savings', 'compliance'],
  },
  // HR
  hr: {
    INTRODUCTION: ['human resources', 'hr', 'recruitment', 'employee', 'talent', 'people'],
    TECHNICAL: ['recruitment', 'onboarding', 'performance', 'policy', 'compliance', 'labor law', 'employee relations', 'benefits', 'training', 'retention'],
    EXPERIENCE: ['hired', 'recruited', 'implemented', 'reduced turnover', 'improved', 'engagement', 'onboarded'],
  },
  // Management/Leadership
  management: {
    INTRODUCTION: ['manager', 'director', 'leader', 'team', 'department', 'operations', 'years'],
    TECHNICAL: ['kpi', 'performance', 'strategy', 'budget', 'planning', 'delegation', 'process improvement', 'stakeholder', 'reporting'],
    EXPERIENCE: ['led', 'managed', 'improved', 'grew', 'team of', 'reduced', 'increased', 'implemented', 'revenue', 'efficiency'],
    BEHAVIORAL: ['conflict', 'motivation', 'delegation', 'coaching', 'feedback', 'accountability', 'empowerment'],
  },
  // Healthcare general
  healthcare: {
    INTRODUCTION: ['healthcare', 'hospital', 'clinical', 'patient', 'medical', 'health'],
    TECHNICAL: ['patient safety', 'infection control', 'protocols', 'compliance', 'accreditation', 'quality', 'reporting', 'documentation'],
    EXPERIENCE: ['improved', 'implemented', 'reduced', 'outcomes', 'compliance', 'safety'],
  },
  // Default
  default: {
    INTRODUCTION: ['experience', 'background', 'skills', 'professional', 'years'],
    TECHNICAL: ['proficiency', 'knowledge', 'tools', 'methodology', 'standards', 'best practices'],
    EXPERIENCE: ['achieved', 'implemented', 'improved', 'led', 'managed', 'results'],
    BEHAVIORAL: ['team', 'communication', 'problem', 'solution', 'challenge'],
  },
};

/**
 * Determine which expected-keywords domain to use for a given job title.
 * Checks seniority and role type to return the most accurate domain.
 */
function getExpectedKeywordsDomain(jobTitle: string): string {
  if (!jobTitle) return 'default';
  const t = jobTitle.toLowerCase();

  // Nursing leadership
  if ((/\bnurs/i.test(t)) && (/\bdirector|manager|head|supervisor|lead|chief|assistant\s+director|assistant\s+manager\b/.test(t))) {
    return 'nursing_leadership';
  }
  if (/\bnurs/i.test(t)) return 'nursing';
  if (/\bsoftware|developer|programmer|engineer(?!.*bio)/i.test(t) && !/\bmechanical|electrical|civil|chemical\b/i.test(t)) return 'programming';
  if (/\bdata\b/i.test(t)) return 'data';
  if (/\bfinance|account|audit/i.test(t)) return 'finance';
  if (/\bhr\b|human\s*resource|recruit/i.test(t)) return 'hr';
  if (/\bmanager|director|head|lead|chief|supervisor/i.test(t)) return 'management';
  if (/\bhospital|clinical|medical|health|patient|pharma/i.test(t)) return 'healthcare';
  return 'default';
}

/**
 * Get expected answer keywords for a question category and job title.
 */
function getExpectedKeywords(jobTitle: string, category: QuestionCategory): string[] {
  const domain = getExpectedKeywordsDomain(jobTitle);
  const domainKeywords = ROLE_EXPECTED_KEYWORDS[domain] || ROLE_EXPECTED_KEYWORDS.default;
  return domainKeywords[category] || domainKeywords.TECHNICAL || [];
}

// ─── Collection helper ──────────────────────────────────────────────────────

function sessionsCollection(tenantId: string) {
  return getCVisionCollection<InterviewSession>(
    tenantId,
    'interviewSessions',
  );
}

// ─── Generate interview questions ───────────────────────────────────────────

export async function generateInterviewQuestions(
  tenantId: string,
  requisitionId: string | null,
  questionCount = 8,
  jobTitleOverride?: string,
): Promise<InterviewQuestion[]> {
  let job: CVisionJobRequisition | null = null;

  if (requisitionId) {
    const reqColl = await getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions');
    job = await reqColl.findOne(createTenantFilter(tenantId, { id: requisitionId } as Filter<CVisionJobRequisition>));
  }

  // Use jobTitleOverride when no requisition found
  const effectiveJobTitle = job?.title || jobTitleOverride || 'General';

  const questions: InterviewQuestion[] = [];
  let order = 0;

  function addQuestion(tpl: QuestionTemplate, category: QuestionCategory, required = true) {
    if (questions.length >= questionCount) return;
    order++;
    // Merge template's own keywords with role-based expected keywords
    const roleKeywords = getExpectedKeywords(effectiveJobTitle, category);
    const combinedKeywords = [...new Set([...(tpl.expectedKeywords || []), ...roleKeywords])];
    questions.push({
      id: uuidv4(),
      order,
      category,
      question: tpl.question,
      expectedAnswer: combinedKeywords.length > 0
        ? `Expected concepts: ${combinedKeywords.join(', ')}`
        : undefined,
      scoringCriteria: tpl.scoringCriteria,
      weight: tpl.weight,
      required,
      followUpEnabled: tpl.followUpEnabled,
      maxAnswerLength: 2000,
      timeLimit: 300,
    });
  }

  // 1. Introduction (2)
  for (const tpl of QUESTION_TEMPLATES.INTRODUCTION) addQuestion(tpl, 'INTRODUCTION');

  // 2. Technical questions based on job skills (2-3)
  let skills: string[] = [];
  if (job?.skills) {
    skills = Array.isArray(job.skills)
      ? (job.skills as unknown as string[])
      : ((job.skills as JobSkillsStructured).required || []);
  }
  if (skills.length === 0) {
    skills = getSkillsForJobTitle(effectiveJobTitle);
  }

  const seenDomains = new Set<string>();
  for (const skill of skills) {
    if (questions.length >= questionCount - 3) break; // leave room for closing questions
    const lower = skill.toLowerCase();
    let domain = SKILL_DOMAIN_MAP[lower];
    if (!domain) {
      for (const [kw, d] of Object.entries(SKILL_DOMAIN_MAP)) {
        if (lower.includes(kw) || kw.includes(lower)) { domain = d; break; }
      }
    }
    domain = domain || 'default';
    if (seenDomains.has(domain)) continue;
    seenDomains.add(domain);
    const tpl = TECHNICAL_GENERATORS[domain] || TECHNICAL_GENERATORS.default;
    addQuestion(tpl, 'TECHNICAL');
  }

  // If no technical questions were generated, add the default
  if (!seenDomains.size) {
    addQuestion(TECHNICAL_GENERATORS.default, 'TECHNICAL');
  }

  // 3. Experience (1)
  if (QUESTION_TEMPLATES.EXPERIENCE[0]) addQuestion(QUESTION_TEMPLATES.EXPERIENCE[0], 'EXPERIENCE');

  // 4. Behavioral (1)
  if (QUESTION_TEMPLATES.BEHAVIORAL[0]) addQuestion(QUESTION_TEMPLATES.BEHAVIORAL[0], 'BEHAVIORAL');

  // 5. Salary + Availability
  if (QUESTION_TEMPLATES.SALARY[0]) addQuestion(QUESTION_TEMPLATES.SALARY[0], 'SALARY', false);
  if (QUESTION_TEMPLATES.AVAILABILITY[0]) addQuestion(QUESTION_TEMPLATES.AVAILABILITY[0], 'AVAILABILITY', false);

  return questions.slice(0, questionCount);
}

// ─── Create session ─────────────────────────────────────────────────────────

let sessionCounter = 0;

export async function createInterviewSession(
  tenantId: string,
  candidateId: string,
  requisitionId: string | null,
  language: 'en' | 'ar' | 'both' = 'en',
  questionCount = 8,
  jobTitleOverride?: string,
): Promise<{ session: InterviewSession; inviteLink: string }> {
  const candColl = await getCVisionCollection<CVisionCandidate>(tenantId, 'candidates');
  const candidate = await candColl.findOne(createTenantFilter(tenantId, { id: candidateId } as Filter<CVisionCandidate>));
  if (!candidate) throw new Error('Candidate not found');

  // Look up requisition if provided
  let job: CVisionJobRequisition | null = null;
  if (requisitionId) {
    const reqColl = await getCVisionCollection<CVisionJobRequisition>(tenantId, 'jobRequisitions');
    job = await reqColl.findOne(createTenantFilter(tenantId, { id: requisitionId } as Filter<CVisionJobRequisition>));
  }

  // Determine the effective job title: requisition title > override > candidate's jobTitleName
  const effectiveJobTitle = job?.title
    || jobTitleOverride
    || (candidate as CVisionCandidate & { jobTitleName?: string }).jobTitleName
    || 'General Position';

  const questions = await generateInterviewQuestions(tenantId, requisitionId, questionCount, effectiveJobTitle);
  sessionCounter++;
  const year = new Date().getFullYear();
  const num = String(sessionCounter).padStart(4, '0');
  const sessionId = `INT-${year}-${num}`;
  const id = uuidv4();
  const inviteLink = `/ai-interview/${id}`;
  const now = new Date();

  const session: InterviewSession = {
    id,
    tenantId,
    sessionId,
    candidateId,
    candidateName: candidate.fullName || 'Unknown',
    requisitionId: requisitionId || '',
    jobTitle: effectiveJobTitle,
    questions,
    language,
    maxDuration: Math.max(15, questions.length * 3),
    status: 'PENDING',
    currentQuestionIndex: 0,
    answers: [],
    overallScore: 0,
    summary: '',
    recommendation: 'CONSIDER',
    strengths: [],
    concerns: [],
    inviteLink,
    createdAt: now,
    updatedAt: now,
  };

  const coll = await sessionsCollection(tenantId);
  await coll.insertOne(session as Record<string, unknown> & InterviewSession);

  return { session, inviteLink };
}

// ─── Score an answer ────────────────────────────────────────────────────────

export function scoreAnswer(
  question: InterviewQuestion,
  answer: string,
): { score: number; analysis: string; flags: string[] } {
  const flags: string[] = [];
  const trimmed = answer.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (!trimmed) {
    return { score: 0, analysis: 'No answer provided.', flags: ['no_answer'] };
  }

  let score = 40; // start slightly below neutral
  const analyses: string[] = [];

  // Length analysis
  if (wordCount < 10) {
    score -= 20;
    flags.push('too_short');
    analyses.push('Answer is very brief.');
  } else if (wordCount < 25) {
    score -= 5;
    analyses.push('Answer could be more detailed.');
  } else if (wordCount >= 50 && wordCount <= 300) {
    score += 8;
    analyses.push('Good level of detail.');
  } else if (wordCount > 500) {
    score -= 5;
    flags.push('very_long');
    analyses.push('Answer is quite lengthy.');
  }

  // Specificity: numbers, dates, names indicate concrete examples
  const hasNumbers = /\d{1,4}/.test(trimmed);
  const hasPercentages = /%|\bpercent/i.test(trimmed);
  const hasTimeframes = /\b(year|month|week|day|quarter)\b/i.test(trimmed);
  const hasSpecifics = hasNumbers || hasPercentages || hasTimeframes;
  if (hasSpecifics) {
    score += 10;
    analyses.push('Includes specific/quantifiable details.');
  }

  // Relevance: check if answer touches on scoring criteria keywords
  const criteriaWords = question.scoringCriteria
    .toLowerCase()
    .replace(/[,]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);
  const answerLower = trimmed.toLowerCase();
  let criteriaHits = 0;
  for (const kw of criteriaWords) {
    if (answerLower.includes(kw)) criteriaHits++;
  }
  const relevanceRatio = criteriaWords.length > 0 ? criteriaHits / criteriaWords.length : 0;
  if (relevanceRatio >= 0.4) {
    score += 10;
    analyses.push('Answer is relevant to the question topic.');
  } else if (relevanceRatio >= 0.2) {
    score += 5;
    analyses.push('Partially relevant response.');
  }

  // ── Expected Answer Keywords Matching (the main scoring boost) ──
  // Parse expected keywords from the expectedAnswer field
  const expectedKeywords: string[] = [];
  if (question.expectedAnswer) {
    const match = question.expectedAnswer.match(/Expected concepts:\s*(.+)/i);
    if (match) {
      expectedKeywords.push(...match[1].split(',').map(k => k.trim().toLowerCase()).filter(Boolean));
    }
  }

  if (expectedKeywords.length > 0) {
    let keywordHits = 0;
    const matchedConcepts: string[] = [];
    for (const kw of expectedKeywords) {
      // Support multi-word keywords (e.g. "patient safety")
      if (answerLower.includes(kw)) {
        keywordHits++;
        matchedConcepts.push(kw);
      } else {
        // Also try matching individual words from multi-word keywords
        const parts = kw.split(/\s+/);
        if (parts.length > 1 && parts.every(p => answerLower.includes(p))) {
          keywordHits += 0.7;
          matchedConcepts.push(kw);
        }
      }
    }

    const keywordRatio = keywordHits / expectedKeywords.length;
    if (keywordRatio >= 0.4) {
      score += 25;
      analyses.push(`Covers key expected concepts (${matchedConcepts.length}/${expectedKeywords.length} matched).`);
    } else if (keywordRatio >= 0.25) {
      score += 18;
      analyses.push(`Addresses several expected concepts (${matchedConcepts.length}/${expectedKeywords.length}).`);
    } else if (keywordRatio >= 0.1) {
      score += 10;
      analyses.push(`Touches on some expected concepts (${matchedConcepts.length}/${expectedKeywords.length}).`);
    } else if (wordCount >= 20) {
      score -= 5;
      flags.push('missing_key_concepts');
      analyses.push('Answer does not address the expected key concepts for this role.');
    }
  } else if (relevanceRatio < 0.2 && wordCount >= 20) {
    score -= 5;
    flags.push('possibly_off_topic');
    analyses.push('Answer may not fully address the question.');
  }

  // Structure: uses connecting words, paragraphs
  const structureWords = /\b(first|second|then|additionally|moreover|however|because|therefore|for example|specifically)\b/i;
  if (structureWords.test(trimmed)) {
    score += 5;
    analyses.push('Well-structured response.');
  }

  // Professional tone
  const casualFlags = /\b(lol|haha|idk|idc|tbh|ngl|omg)\b/i;
  if (casualFlags.test(trimmed)) {
    score -= 10;
    flags.push('informal_tone');
    analyses.push('Answer uses overly casual language.');
  }

  // Copy-paste detection heuristic: very long + zero typos + dense
  if (wordCount > 200 && !/\b(um|uh|well|i think|i believe)\b/i.test(trimmed) && !hasSpecifics) {
    flags.push('possible_copy');
    analyses.push('Answer may be pre-written.');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    analysis: analyses.join(' ') || 'Answer recorded.',
    flags,
  };
}

// ─── Generate follow-up ────────────────────────────────────────────────────

export function generateFollowUp(question: InterviewQuestion, answer: string): string | null {
  if (!question.followUpEnabled) return null;

  const trimmed = answer.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount < 20) {
    return 'Could you elaborate on that? Please provide a specific example from your experience.';
  }

  const hasNumbers = /\d/.test(trimmed);
  if (!hasNumbers && question.category === 'EXPERIENCE') {
    return 'Can you quantify the impact of your work? For example, how many people, what percentage improvement, or what timeline?';
  }

  if (question.category === 'TECHNICAL' && wordCount < 50) {
    return 'Could you go into more technical detail about your approach or the tools you used?';
  }

  return null;
}

// ─── Complete interview ─────────────────────────────────────────────────────

export async function completeInterview(
  tenantId: string,
  sessionId: string,
): Promise<{
  overallScore: number;
  recommendation: SessionRecommendation;
  summary: string;
  strengths: string[];
  concerns: string[];
}> {
  const coll = await sessionsCollection(tenantId);
  const session = await coll.findOne({ tenantId, id: sessionId } as Filter<InterviewSession>) as InterviewSession | null;
  if (!session) throw new Error('Session not found');

  const answers = session.answers || [];
  const questions = session.questions || [];

  // Weighted average score
  let totalWeight = 0;
  let weightedSum = 0;
  for (const q of questions) {
    const ans = answers.find(a => a.questionId === q.id);
    const ansScore = ans ? ans.score : 0;
    weightedSum += ansScore * q.weight;
    totalWeight += q.weight;
  }
  const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  // Strengths / concerns — use specific descriptions to avoid duplicates
  const strengths: string[] = [];
  const concerns: string[] = [];
  const categoryCount: Record<string, number> = {};

  for (const q of questions) {
    const cat = q.category.toLowerCase();
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    const catLabel = categoryCount[cat] > 1 ? `${cat} #${categoryCount[cat]}` : cat;

    const ans = answers.find(a => a.questionId === q.id);
    if (!ans) { concerns.push(`No answer for: ${catLabel}`); continue; }

    // Use analysis text for more specific strengths/concerns
    if (ans.score >= 70) {
      const detail = ans.aiAnalysis?.split('.')[0] || `Strong ${catLabel} response`;
      strengths.push(detail);
    }
    if (ans.score < 40) {
      const detail = ans.aiAnalysis?.includes('expected key concepts')
        ? `Missing key concepts in ${catLabel}`
        : `Weak ${catLabel} response (score: ${ans.score})`;
      concerns.push(detail);
    }
    if (ans.flags.includes('too_short')) concerns.push(`Brief answer on ${catLabel}`);
    if (ans.flags.includes('missing_key_concepts')) {
      if (!concerns.some(c => c.includes('key concepts')))
        concerns.push('Some answers lack expected role-specific knowledge');
    }
    if (ans.flags.includes('no_show_risk')) concerns.push('Possible no-show risk');
  }

  // De-duplicate
  const uniqueStrengths = [...new Set(strengths)].slice(0, 5);
  const uniqueConcerns = [...new Set(concerns)].slice(0, 5);

  // Recommendation
  let recommendation: SessionRecommendation;
  if (overallScore >= 65) recommendation = 'ADVANCE';
  else if (overallScore >= 40) recommendation = 'CONSIDER';
  else recommendation = 'REJECT';

  // Summary
  const answeredCount = answers.length;
  const totalCount = questions.length;
  const avgTimeSpent = answers.length > 0
    ? Math.round(answers.reduce((s, a) => s + a.timeSpent, 0) / answers.length)
    : 0;

  const summary = `Candidate completed ${answeredCount}/${totalCount} questions with an overall score of ${overallScore}/100. ` +
    `Average response time: ${avgTimeSpent} seconds. ` +
    (uniqueStrengths.length > 0 ? `Strengths include: ${uniqueStrengths.join(', ')}. ` : '') +
    (uniqueConcerns.length > 0 ? `Areas of concern: ${uniqueConcerns.join(', ')}.` : 'No major concerns noted.');

  await coll.updateOne(
    { tenantId, id: sessionId } as Filter<InterviewSession>,
    {
      $set: {
        status: 'COMPLETED' as const,
        completedAt: new Date(),
        overallScore,
        summary,
        recommendation,
        strengths: uniqueStrengths,
        concerns: uniqueConcerns,
        updatedAt: new Date(),
      } as Partial<InterviewSession>,
    },
  );

  return { overallScore, recommendation, summary, strengths: uniqueStrengths, concerns: uniqueConcerns };
}

// ─── Session queries ────────────────────────────────────────────────────────

export async function listSessions(
  tenantId: string,
  filters?: { status?: string; requisitionId?: string; candidateId?: string },
): Promise<InterviewSession[]> {
  const coll = await sessionsCollection(tenantId);
  const query: Record<string, unknown> = { tenantId };
  if (filters?.status) query.status = filters.status;
  if (filters?.requisitionId) query.requisitionId = filters.requisitionId;
  if (filters?.candidateId) query.candidateId = filters.candidateId;
  return coll.find(query).sort({ createdAt: -1 } as any).limit(200).toArray() as Promise<InterviewSession[]>;
}

export async function getSessionById(
  tenantId: string,
  sessionId: string,
): Promise<InterviewSession | null> {
  const coll = await sessionsCollection(tenantId);
  return coll.findOne({ tenantId, id: sessionId } as Filter<InterviewSession>) as Promise<InterviewSession | null>;
}

export async function getSessionByIdPublic(
  sessionId: string,
): Promise<InterviewSession | null> {
  // For the public interview page — looks up by id across all active tenants.
  // The session UUID acts as the authentication token.
  const { getPlatformClient, getTenantClient } = await import('@/lib/db/mongo');
  const { db: platformDb } = await getPlatformClient();
  const tenants = await platformDb.collection('tenants')
    .find({ status: 'active' })
    .project({ tenantId: 1, dbName: 1, key: 1 })
    .limit(50)
    .toArray();

  for (const t of tenants) {
    try {
      const dbName = t.dbName || `tenant_${(t.key || t.tenantId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const { db } = await getTenantClient(t.tenantId, dbName);
      const coll = db.collection('cvision_interview_sessions');
      const session = await coll.findOne({ id: sessionId });
      if (session) return session as unknown as InterviewSession;
    } catch { /* skip tenants that can't connect */ }
  }
  return null;
}

export async function startInterviewPublic(
  sessionId: string,
): Promise<InterviewSession | null> {
  const { getPlatformClient, getTenantClient } = await import('@/lib/db/mongo');
  const { db: platformDb } = await getPlatformClient();
  const tenants = await platformDb.collection('tenants')
    .find({ status: 'active' })
    .project({ tenantId: 1, dbName: 1, key: 1 })
    .limit(50)
    .toArray();

  for (const t of tenants) {
    try {
      const dbName = t.dbName || `tenant_${(t.key || t.tenantId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const { db } = await getTenantClient(t.tenantId, dbName);
      const coll = db.collection('cvision_interview_sessions');
      const session = await coll.findOne({ id: sessionId });
      if (session) {
        if (session.status === 'PENDING' || session.status === 'SENT') {
          await coll.updateOne(
            { id: sessionId },
            { $set: { status: 'IN_PROGRESS', startedAt: new Date(), updatedAt: new Date() } },
          );
        }
        return { ...session, status: 'IN_PROGRESS' } as unknown as InterviewSession;
      }
    } catch { /* skip tenants that can't connect */ }
  }
  return null;
}

export async function submitAnswerPublic(
  sessionId: string,
  questionId: string,
  answer: string,
  timeSpent: number,
): Promise<{ scored: InterviewAnswer; followUp: string | null; nextQuestion: InterviewQuestion | null; done: boolean } | null> {
  const session = await getSessionByIdPublic(sessionId);
  if (!session) return null;
  return submitAnswer(session.tenantId, sessionId, questionId, answer, timeSpent);
}

export async function completeInterviewPublic(
  sessionId: string,
): Promise<{ overallScore: number; recommendation: SessionRecommendation; summary: string; strengths: string[]; concerns: string[] } | null> {
  const session = await getSessionByIdPublic(sessionId);
  if (!session) return null;
  return completeInterview(session.tenantId, sessionId);
}

export async function submitAnswer(
  tenantId: string,
  sessionId: string,
  questionId: string,
  answer: string,
  timeSpent: number,
): Promise<{ scored: InterviewAnswer; followUp: string | null; nextQuestion: InterviewQuestion | null; done: boolean }> {
  const coll = await sessionsCollection(tenantId);
  const session = await coll.findOne({ tenantId, id: sessionId } as Filter<InterviewSession>) as InterviewSession | null;
  if (!session) throw new Error('Session not found');
  if (session.status === 'COMPLETED' || session.status === 'SCORED' || session.status === 'CANCELLED') {
    throw new Error('Session is no longer active');
  }

  const question = session.questions.find(q => q.id === questionId);
  if (!question) throw new Error('Question not found in session');

  const { score, analysis, flags } = scoreAnswer(question, answer);
  const scored: InterviewAnswer = {
    questionId,
    answer,
    answeredAt: new Date(),
    timeSpent,
    score,
    aiAnalysis: analysis,
    flags,
  };

  const followUp = generateFollowUp(question, answer);

  // Find next question
  const currentIdx = session.questions.findIndex(q => q.id === questionId);
  const nextIdx = currentIdx + 1;
  const nextQuestion = nextIdx < session.questions.length ? session.questions[nextIdx] : null;
  const done = !nextQuestion;

  // Update session
  const updateFields: InterviewSessionUpdateFields = {
    updatedAt: new Date(),
    currentQuestionIndex: nextIdx,
  };
  if (session.status === 'PENDING' || session.status === 'SENT') updateFields.status = 'IN_PROGRESS';
  if (!session.startedAt) updateFields.startedAt = new Date();

  await coll.updateOne(
    { tenantId, id: sessionId } as Filter<InterviewSession>,
    {
      $push: { answers: scored },
      $set: updateFields,
    } as Record<string, unknown>,
  );

  return { scored, followUp, nextQuestion, done };
}

export async function cancelSession(tenantId: string, sessionId: string): Promise<void> {
  const coll = await sessionsCollection(tenantId);
  await coll.updateOne(
    { tenantId, id: sessionId } as Filter<InterviewSession>,
    { $set: { status: 'CANCELLED' as const, updatedAt: new Date() } as Partial<InterviewSession> },
  );
}

export async function sendInterviewInvite(
  tenantId: string,
  sessionId: string,
  candidateEmail: string,
): Promise<{ sent: boolean; inviteLink: string }> {
  const coll = await sessionsCollection(tenantId);
  const session = await coll.findOne({ tenantId, id: sessionId } as Filter<InterviewSession>) as InterviewSession | null;
  if (!session) throw new Error('Session not found');

  // Mark status as SENT so the session is no longer stuck in PENDING
  await coll.updateOne(
    { tenantId, id: sessionId } as Filter<InterviewSession>,
    {
      $set: {
        status: 'SENT' as const,
        inviteSentAt: new Date(),
        inviteEmail: candidateEmail,
        updatedAt: new Date(),
      } as Partial<InterviewSession> & Record<string, unknown>,
    },
  );

  // In production this would send an actual email.
  // For now, return the invite link.
  return { sent: true, inviteLink: session.inviteLink };
}

export async function regenerateSessionQuestions(
  tenantId: string,
  sessionId: string,
  questionCount?: number,
): Promise<{ questions: InterviewQuestion[]; count: number }> {
  const coll = await sessionsCollection(tenantId);
  const session = await coll.findOne({ tenantId, id: sessionId } as Filter<InterviewSession>) as InterviewSession | null;
  if (!session) throw new Error('Session not found');

  if (session.status === 'COMPLETED' || session.status === 'SCORED' || session.status === 'CANCELLED') {
    throw new Error('Cannot regenerate questions for a finished session');
  }

  const count = questionCount || session.questions?.length || 8;
  const reqId = session.requisitionId || null;
  const questions = await generateInterviewQuestions(tenantId, reqId, count, session.jobTitle);

  await coll.updateOne(
    { tenantId, id: sessionId } as Filter<InterviewSession>,
    {
      $set: {
        questions,
        currentQuestionIndex: 0,
        answers: [] as InterviewAnswer[],
        updatedAt: new Date(),
      } as Partial<InterviewSession>,
    },
  );

  return { questions, count: questions.length };
}

export function getQuestionTemplates(): Record<QuestionCategory, QuestionTemplate[]> {
  return QUESTION_TEMPLATES;
}
