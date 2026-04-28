// ─── AI Interview Engine ────────────────────────────────────────────────────
// Structured question generation, heuristic answer evaluation, and comprehensive
// assessment for AI-assisted interviews. Generates role-specific interview plans
// from a question bank and scores candidate answers using keyword/heuristic analysis.
// Pure computation — no AI API calls, no DB, no side effects.

// ─── Types & Interfaces ────────────────────────────────────────────────────

export type InterviewQuestionCategory =
  | 'TECHNICAL'
  | 'BEHAVIORAL'
  | 'SITUATIONAL'
  | 'CULTURAL_FIT'
  | 'MOTIVATION'
  | 'PROBLEM_SOLVING';

export interface InterviewQuestion {
  id: string;
  category: InterviewQuestionCategory;
  question: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  timeAllocationMinutes: number;
  scoringCriteria: {
    excellent: string;
    good: string;
    average: string;
    poor: string;
  };
  followUpQuestions: string[];
  relatedSkills: string[];
  maxScore: number;
}

export interface InterviewPlan {
  id: string;
  jobTitle: string;
  department: string;
  totalQuestions: number;
  estimatedDurationMinutes: number;
  questions: InterviewQuestion[];
  categoryDistribution: Record<InterviewQuestionCategory, number>;
  createdAt: Date;
}

export interface AnswerEvaluation {
  questionId: string;
  score: number;
  maxScore: number;
  percentage: number;
  level: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR';
  feedback: string;
  strengths: string[];
  improvements: string[];
  keywordsDetected: string[];
}

export interface InterviewAssessment {
  candidateId: string;
  candidateName: string;
  interviewPlanId: string;
  jobTitle: string;
  evaluations: AnswerEvaluation[];
  overallScore: number;
  categoryScores: Record<
    InterviewQuestionCategory,
    { score: number; maxScore: number; percentage: number }
  >;
  recommendation:
    | 'STRONGLY_RECOMMEND'
    | 'RECOMMEND'
    | 'CONSIDER'
    | 'DO_NOT_RECOMMEND';
  summary: string;
  strengths: string[];
  concerns: string[];
  completedAt: Date;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Category distribution templates by experience level */
export const CATEGORY_DISTRIBUTION_TEMPLATES: Record<
  string,
  Record<InterviewQuestionCategory, number>
> = {
  technical: {
    TECHNICAL: 4,
    BEHAVIORAL: 1,
    SITUATIONAL: 2,
    PROBLEM_SOLVING: 2,
    MOTIVATION: 1,
    CULTURAL_FIT: 0,
  },
  managerial: {
    TECHNICAL: 1,
    BEHAVIORAL: 3,
    SITUATIONAL: 2,
    PROBLEM_SOLVING: 1,
    MOTIVATION: 1,
    CULTURAL_FIT: 2,
  },
  entry_level: {
    TECHNICAL: 2,
    BEHAVIORAL: 2,
    SITUATIONAL: 1,
    PROBLEM_SOLVING: 2,
    MOTIVATION: 2,
    CULTURAL_FIT: 1,
  },
  executive: {
    TECHNICAL: 0,
    BEHAVIORAL: 2,
    SITUATIONAL: 3,
    PROBLEM_SOLVING: 1,
    MOTIVATION: 1,
    CULTURAL_FIT: 3,
  },
  default: {
    TECHNICAL: 2,
    BEHAVIORAL: 2,
    SITUATIONAL: 2,
    PROBLEM_SOLVING: 2,
    MOTIVATION: 1,
    CULTURAL_FIT: 1,
  },
};

/** Recommendation labels */
const RECOMMENDATION_LABELS: Record<
  InterviewAssessment['recommendation'],
  string
> = {
  STRONGLY_RECOMMEND: 'Strongly Recommend',
  RECOMMEND: 'Recommend',
  CONSIDER: 'Consider',
  DO_NOT_RECOMMEND: 'Do Not Recommend',
};

/** Category labels */
const CATEGORY_LABELS: Record<InterviewQuestionCategory, string> = {
  TECHNICAL: 'Technical',
  BEHAVIORAL: 'Behavioral',
  SITUATIONAL: 'Situational',
  CULTURAL_FIT: 'Cultural Fit',
  MOTIVATION: 'Motivation',
  PROBLEM_SOLVING: 'Problem Solving',
};

/** Difficulty -> time allocation in minutes */
const DIFFICULTY_TIME: Record<InterviewQuestion['difficulty'], number> = {
  EASY: 3,
  MEDIUM: 5,
  HARD: 7,
};

// ─── Question Bank ─────────────────────────────────────────────────────────

interface QuestionBankEntry {
  question: string;
  category: InterviewQuestionCategory;
  scoringCriteria: InterviewQuestion['scoringCriteria'];
  followUpQuestions: string[];
  relatedSkills: string[];
}

/** Default technical scoring criteria (reused across TECHNICAL questions) */
const TECHNICAL_CRITERIA: InterviewQuestion['scoringCriteria'] = {
  excellent:
    'Demonstrates deep expertise with specific examples and measurable outcomes',
  good: 'Shows solid understanding with relevant examples',
  average: 'Basic understanding but lacks depth or specific examples',
  poor: 'Unable to demonstrate relevant knowledge or experience',
};

/** Default behavioral scoring criteria */
const BEHAVIORAL_CRITERIA: InterviewQuestion['scoringCriteria'] = {
  excellent:
    'Uses STAR method effectively with clear impact and self-awareness',
  good: 'Provides a structured response with a concrete example',
  average: 'Gives a general answer without a clear specific example',
  poor: 'Cannot provide a relevant example or response is vague',
};

/** Default situational scoring criteria */
const SITUATIONAL_CRITERIA: InterviewQuestion['scoringCriteria'] = {
  excellent:
    'Proposes a well-reasoned approach considering multiple stakeholders and outcomes',
  good: 'Presents a practical approach with good reasoning',
  average: 'Offers a basic approach but misses important considerations',
  poor: 'Unable to propose a coherent approach or avoids the scenario',
};

/** Default cultural fit scoring criteria */
const CULTURAL_FIT_CRITERIA: InterviewQuestion['scoringCriteria'] = {
  excellent:
    'Shows strong alignment with company values and demonstrates adaptability',
  good: 'Demonstrates awareness of workplace culture and reasonable alignment',
  average: 'Generic response without demonstrating clear alignment',
  poor: 'Shows potential misalignment with company values or environment',
};

/** Default motivation scoring criteria */
const MOTIVATION_CRITERIA: InterviewQuestion['scoringCriteria'] = {
  excellent:
    'Shows genuine enthusiasm with well-researched knowledge of the role and company',
  good: 'Demonstrates clear interest with reasonable understanding of the role',
  average: 'Generic motivation without specific connection to the role',
  poor: 'Shows little interest or motivation appears purely financial',
};

/** Default problem-solving scoring criteria */
const PROBLEM_SOLVING_CRITERIA: InterviewQuestion['scoringCriteria'] = {
  excellent:
    'Demonstrates systematic approach with creative thinking and evidence of past success',
  good: 'Shows logical approach with a reasonable problem-solving framework',
  average: 'Basic problem-solving approach without clear methodology',
  poor: 'Unable to articulate a problem-solving approach or gives up easily',
};

/** Pre-defined question bank — at least 5 per category */
export const QUESTION_BANK: QuestionBankEntry[] = [
  // ── TECHNICAL (5) ─────────────────────────────────────────────────────
  {
    category: 'TECHNICAL',
    question:
      'Describe your experience with {skill}. What was the most complex project you worked on using it?',
    scoringCriteria: TECHNICAL_CRITERIA,
    followUpQuestions: [
      'What specific challenges did you face?',
      'How did you measure the success of that project?',
    ],
    relatedSkills: ['technical expertise', 'project execution', 'domain knowledge'],
  },
  {
    category: 'TECHNICAL',
    question:
      'How do you stay updated with the latest developments in your field?',
    scoringCriteria: TECHNICAL_CRITERIA,
    followUpQuestions: [
      'Can you name a recent trend you adopted?',
      'How have you applied new knowledge in your work?',
    ],
    relatedSkills: ['continuous learning', 'self-development', 'industry awareness'],
  },
  {
    category: 'TECHNICAL',
    question:
      'Walk me through how you would debug a critical production issue.',
    scoringCriteria: TECHNICAL_CRITERIA,
    followUpQuestions: [
      'What tools would you use?',
      'How would you communicate progress to stakeholders?',
    ],
    relatedSkills: ['debugging', 'troubleshooting', 'incident management', 'communication'],
  },
  {
    category: 'TECHNICAL',
    question:
      'What tools and methodologies do you use in your daily work?',
    scoringCriteria: TECHNICAL_CRITERIA,
    followUpQuestions: [
      'Why did you choose those tools over alternatives?',
      'How do you evaluate new tools?',
    ],
    relatedSkills: ['tools', 'methodology', 'workflow', 'best practices'],
  },
  {
    category: 'TECHNICAL',
    question:
      'Explain a technical concept from your field to someone non-technical.',
    scoringCriteria: TECHNICAL_CRITERIA,
    followUpQuestions: [
      'How do you adjust your communication for different audiences?',
      'Can you simplify it even further?',
    ],
    relatedSkills: ['communication', 'teaching', 'simplification', 'clarity'],
  },

  // ── BEHAVIORAL (5) ────────────────────────────────────────────────────
  {
    category: 'BEHAVIORAL',
    question:
      'Tell me about a time you had a conflict with a colleague. How did you resolve it?',
    scoringCriteria: BEHAVIORAL_CRITERIA,
    followUpQuestions: [
      'What would you do differently?',
      'How did it affect your working relationship afterward?',
    ],
    relatedSkills: ['conflict resolution', 'communication', 'empathy', 'teamwork'],
  },
  {
    category: 'BEHAVIORAL',
    question:
      'Describe a situation where you had to meet a tight deadline.',
    scoringCriteria: BEHAVIORAL_CRITERIA,
    followUpQuestions: [
      'How did you prioritize your tasks?',
      'Did you ask for help? Why or why not?',
    ],
    relatedSkills: ['time management', 'prioritization', 'pressure handling', 'delivery'],
  },
  {
    category: 'BEHAVIORAL',
    question:
      'Give an example of when you took initiative beyond your job description.',
    scoringCriteria: BEHAVIORAL_CRITERIA,
    followUpQuestions: [
      'What motivated you to take that step?',
      'What was the outcome?',
    ],
    relatedSkills: ['initiative', 'proactiveness', 'ownership', 'leadership'],
  },
  {
    category: 'BEHAVIORAL',
    question:
      'Tell me about a mistake you made at work and what you learned.',
    scoringCriteria: BEHAVIORAL_CRITERIA,
    followUpQuestions: [
      'How did you prevent it from happening again?',
      'Did you share the lesson with your team?',
    ],
    relatedSkills: ['accountability', 'learning', 'self-awareness', 'growth mindset'],
  },
  {
    category: 'BEHAVIORAL',
    question:
      'Describe how you handle receiving critical feedback.',
    scoringCriteria: BEHAVIORAL_CRITERIA,
    followUpQuestions: [
      'Can you give a specific example?',
      'How do you separate personal feelings from professional feedback?',
    ],
    relatedSkills: ['receptiveness', 'growth mindset', 'emotional intelligence', 'self-improvement'],
  },

  // ── SITUATIONAL (5) ───────────────────────────────────────────────────
  {
    category: 'SITUATIONAL',
    question:
      'If you were assigned to lead a project with team members more experienced than you, how would you handle it?',
    scoringCriteria: SITUATIONAL_CRITERIA,
    followUpQuestions: [
      'How would you earn their trust?',
      'What leadership style would you use?',
    ],
    relatedSkills: ['leadership', 'humility', 'delegation', 'team management'],
  },
  {
    category: 'SITUATIONAL',
    question:
      'How would you handle a situation where your manager asks you to do something you disagree with?',
    scoringCriteria: SITUATIONAL_CRITERIA,
    followUpQuestions: [
      'What if they insist after you voice your concerns?',
      'How do you balance respect with integrity?',
    ],
    relatedSkills: ['assertiveness', 'diplomacy', 'professional disagreement', 'judgment'],
  },
  {
    category: 'SITUATIONAL',
    question:
      'If two of your team members were in constant conflict, what would you do?',
    scoringCriteria: SITUATIONAL_CRITERIA,
    followUpQuestions: [
      'What if one of them is a top performer?',
      'When would you escalate the issue?',
    ],
    relatedSkills: ['mediation', 'conflict resolution', 'team dynamics', 'management'],
  },
  {
    category: 'SITUATIONAL',
    question:
      'You discover a significant error in a report that has already been sent to a client. What do you do?',
    scoringCriteria: SITUATIONAL_CRITERIA,
    followUpQuestions: [
      'How quickly would you act?',
      'How would you prevent similar errors in the future?',
    ],
    relatedSkills: ['accountability', 'crisis management', 'communication', 'integrity'],
  },
  {
    category: 'SITUATIONAL',
    question:
      'How would you prioritize if you had three urgent tasks with the same deadline?',
    scoringCriteria: SITUATIONAL_CRITERIA,
    followUpQuestions: [
      'What framework do you use for prioritization?',
      'Would you ask for help or try to handle all three alone?',
    ],
    relatedSkills: ['prioritization', 'decision making', 'time management', 'stakeholder management'],
  },

  // ── CULTURAL_FIT (5) ──────────────────────────────────────────────────
  {
    category: 'CULTURAL_FIT',
    question:
      'What kind of work environment brings out the best in you?',
    scoringCriteria: CULTURAL_FIT_CRITERIA,
    followUpQuestions: [
      'How do you adapt to environments that differ from your preference?',
      'What aspects are non-negotiable for you?',
    ],
    relatedSkills: ['self-awareness', 'adaptability', 'work style', 'cultural alignment'],
  },
  {
    category: 'CULTURAL_FIT',
    question: 'How do you define success in your career?',
    scoringCriteria: CULTURAL_FIT_CRITERIA,
    followUpQuestions: [
      'Has your definition changed over time?',
      'How does this role fit into your definition of success?',
    ],
    relatedSkills: ['ambition', 'values alignment', 'career clarity', 'self-reflection'],
  },
  {
    category: 'CULTURAL_FIT',
    question:
      'What values are most important to you in a workplace?',
    scoringCriteria: CULTURAL_FIT_CRITERIA,
    followUpQuestions: [
      'Can you give an example of a workplace that lived up to those values?',
      'What happens when those values are compromised?',
    ],
    relatedSkills: ['values', 'ethics', 'workplace culture', 'integrity'],
  },
  {
    category: 'CULTURAL_FIT',
    question:
      'How do you adapt when company processes or priorities change suddenly?',
    scoringCriteria: CULTURAL_FIT_CRITERIA,
    followUpQuestions: [
      'Can you share a time when this happened?',
      'What helps you stay resilient during change?',
    ],
    relatedSkills: ['adaptability', 'resilience', 'change management', 'flexibility'],
  },
  {
    category: 'CULTURAL_FIT',
    question: 'Describe your ideal manager.',
    scoringCriteria: CULTURAL_FIT_CRITERIA,
    followUpQuestions: [
      'How do you handle working with someone whose style differs?',
      'What management style frustrates you?',
    ],
    relatedSkills: ['management expectations', 'work relationships', 'communication style'],
  },

  // ── MOTIVATION (5) ────────────────────────────────────────────────────
  {
    category: 'MOTIVATION',
    question: 'Why are you interested in this role?',
    scoringCriteria: MOTIVATION_CRITERIA,
    followUpQuestions: [
      'What specifically about the role excites you?',
      'How does this fit into your career goals?',
    ],
    relatedSkills: ['motivation', 'career alignment', 'research', 'enthusiasm'],
  },
  {
    category: 'MOTIVATION',
    question: 'Where do you see yourself in 3-5 years?',
    scoringCriteria: MOTIVATION_CRITERIA,
    followUpQuestions: [
      'How does this role help you get there?',
      'What skills do you need to develop?',
    ],
    relatedSkills: ['career planning', 'ambition', 'goal setting', 'self-awareness'],
  },
  {
    category: 'MOTIVATION',
    question: 'What motivates you to do your best work?',
    scoringCriteria: MOTIVATION_CRITERIA,
    followUpQuestions: [
      'How do you stay motivated during routine tasks?',
      'What demotivates you?',
    ],
    relatedSkills: ['intrinsic motivation', 'drive', 'self-management', 'passion'],
  },
  {
    category: 'MOTIVATION',
    question: 'What attracted you to our company specifically?',
    scoringCriteria: MOTIVATION_CRITERIA,
    followUpQuestions: [
      'What do you know about our recent projects or achievements?',
      'How does our mission align with your values?',
    ],
    relatedSkills: ['company research', 'alignment', 'enthusiasm', 'cultural interest'],
  },
  {
    category: 'MOTIVATION',
    question: 'What would make you leave a job?',
    scoringCriteria: MOTIVATION_CRITERIA,
    followUpQuestions: [
      'Have you experienced that before?',
      'How do you evaluate if a situation is fixable before leaving?',
    ],
    relatedSkills: ['self-awareness', 'values', 'boundaries', 'professional maturity'],
  },

  // ── PROBLEM_SOLVING (5) ───────────────────────────────────────────────
  {
    category: 'PROBLEM_SOLVING',
    question:
      'Describe your approach to solving a problem you have never encountered before.',
    scoringCriteria: PROBLEM_SOLVING_CRITERIA,
    followUpQuestions: [
      'What resources do you turn to first?',
      'How do you know when to ask for help?',
    ],
    relatedSkills: ['analytical thinking', 'research', 'methodology', 'resourcefulness'],
  },
  {
    category: 'PROBLEM_SOLVING',
    question:
      'Tell me about a time you had to make a decision with incomplete information.',
    scoringCriteria: PROBLEM_SOLVING_CRITERIA,
    followUpQuestions: [
      'How did you assess the risks?',
      'What was the outcome?',
    ],
    relatedSkills: ['decision making', 'risk assessment', 'judgment', 'confidence'],
  },
  {
    category: 'PROBLEM_SOLVING',
    question:
      'How do you break down a large, complex problem into manageable parts?',
    scoringCriteria: PROBLEM_SOLVING_CRITERIA,
    followUpQuestions: [
      'What frameworks or techniques do you use?',
      'Can you walk me through a specific example?',
    ],
    relatedSkills: ['decomposition', 'planning', 'structured thinking', 'organization'],
  },
  {
    category: 'PROBLEM_SOLVING',
    question:
      'Give an example of an innovative solution you proposed at work.',
    scoringCriteria: PROBLEM_SOLVING_CRITERIA,
    followUpQuestions: [
      'How was it received by your team?',
      'What impact did it have?',
    ],
    relatedSkills: ['innovation', 'creativity', 'initiative', 'impact'],
  },
  {
    category: 'PROBLEM_SOLVING',
    question:
      'How do you evaluate whether your solution to a problem was effective?',
    scoringCriteria: PROBLEM_SOLVING_CRITERIA,
    followUpQuestions: [
      'What metrics do you use?',
      'How do you handle it when a solution does not work?',
    ],
    relatedSkills: ['evaluation', 'metrics', 'iteration', 'continuous improvement'],
  },
];

// ─── Internal Helpers ──────────────────────────────────────────────────────

/** Simple deterministic hash for generating IDs from seed strings */
function generateId(prefix: string, seed: string): string {
  let hash = 0;
  const str = `${prefix}-${seed}-${Date.now()}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`;
}

/** Seeded pseudo-random for deterministic question selection */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  for (let i = result.length - 1; i > 0; i--) {
    h = ((h << 5) - h + i) | 0;
    const j = Math.abs(h) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** STAR method indicator keywords */
const STAR_INDICATORS = {
  situation: ['situation', 'context', 'background', 'scenario', 'challenge', 'when', 'while'],
  task: ['task', 'responsibility', 'goal', 'objective', 'assigned', 'role', 'needed to'],
  action: ['action', 'decided', 'implemented', 'created', 'developed', 'led', 'initiated', 'took'],
  result: ['result', 'outcome', 'impact', 'achieved', 'improved', 'reduced', 'increased', 'saved'],
};

/** Specificity indicator words (numbers, metrics, tool names, etc.) */
const SPECIFICITY_PATTERNS = [
  /\d+%/,           // percentages
  /\d+\s*(years?|months?|weeks?|days?)/i, // durations
  /\$[\d,]+/,       // dollar amounts
  /\d{4}/,          // years (e.g., 2023)
  /\b(team of|group of)\s+\d+/i, // team sizes
  /\b(reduced|increased|improved|saved|grew)\s+by/i, // impact verbs
];

/** Common detail-rich keywords that indicate substantive answers */
const QUALITY_KEYWORDS = [
  'because', 'specifically', 'for example', 'in particular', 'as a result',
  'the key was', 'I learned', 'the impact was', 'measured', 'metrics',
  'stakeholders', 'collaborated', 'strategy', 'approach', 'framework',
  'process', 'methodology', 'successfully', 'achievement', 'challenge',
];

// ─── Main Functions ────────────────────────────────────────────────────────

/**
 * Generates a structured interview plan with role-specific questions.
 *
 * Selects questions from the bank based on experience level template,
 * replaces {skill} placeholders with actual required skills, assigns
 * difficulty progression (EASY -> MEDIUM -> HARD), and calculates duration.
 */
export function generateInterviewPlan(params: {
  jobTitle: string;
  department: string;
  requiredSkills?: string[];
  experienceLevel?: 'entry_level' | 'technical' | 'managerial' | 'executive';
  totalQuestions?: number;
}): InterviewPlan {
  const {
    jobTitle,
    department,
    requiredSkills = [],
    experienceLevel = 'default',
    totalQuestions = 10,
  } = params;

  // Get category distribution template
  const template =
    CATEGORY_DISTRIBUTION_TEMPLATES[experienceLevel] ||
    CATEGORY_DISTRIBUTION_TEMPLATES.default;

  // Scale distribution to desired totalQuestions
  const templateTotal = Object.values(template).reduce((sum, v) => sum + v, 0);
  const scaleFactor = totalQuestions / templateTotal;

  const distribution = {} as Record<InterviewQuestionCategory, number>;
  const allCategories: InterviewQuestionCategory[] = [
    'TECHNICAL', 'BEHAVIORAL', 'SITUATIONAL',
    'PROBLEM_SOLVING', 'MOTIVATION', 'CULTURAL_FIT',
  ];

  let allocated = 0;
  for (const cat of allCategories) {
    const raw = Math.round(template[cat] * scaleFactor);
    distribution[cat] = raw;
    allocated += raw;
  }

  // Adjust rounding errors — add/remove from largest category
  while (allocated < totalQuestions) {
    const maxCat = allCategories.reduce((a, b) =>
      distribution[a] >= distribution[b] ? a : b
    );
    distribution[maxCat]++;
    allocated++;
  }
  while (allocated > totalQuestions) {
    const maxCat = allCategories.reduce((a, b) =>
      distribution[a] >= distribution[b] ? a : b
    );
    if (distribution[maxCat] > 0) {
      distribution[maxCat]--;
      allocated--;
    } else {
      break;
    }
  }

  // Select questions per category
  const planId = generateId('plan', `${jobTitle}-${department}`);
  const seed = `${jobTitle}-${department}-${experienceLevel}`;
  const questions: InterviewQuestion[] = [];
  let questionIndex = 0;

  for (const cat of allCategories) {
    const count = distribution[cat];
    if (count <= 0) continue;

    // Get bank entries for this category, shuffle deterministically
    const bankEntries = QUESTION_BANK.filter((q) => q.category === cat);
    const shuffled = seededShuffle(bankEntries, `${seed}-${cat}`);
    const selected = shuffled.slice(0, count);

    for (const entry of selected) {
      // Replace {skill} placeholders with actual skills
      let questionText = entry.question;
      if (requiredSkills.length > 0) {
        const skillIdx = questionIndex % requiredSkills.length;
        const skill = requiredSkills[skillIdx];
        questionText = questionText.replace(/\{skill\}/g, skill);
      } else {
        questionText = questionText.replace(/\{skill\}/g, 'your primary skill');
      }

      // Assign difficulty based on position in list
      let difficulty: InterviewQuestion['difficulty'];
      const positionRatio = questionIndex / Math.max(totalQuestions - 1, 1);
      if (positionRatio < 0.33) {
        difficulty = 'EASY';
      } else if (positionRatio < 0.66) {
        difficulty = 'MEDIUM';
      } else {
        difficulty = 'HARD';
      }

      const timeAllocation = DIFFICULTY_TIME[difficulty];

      questions.push({
        id: generateId('q', `${planId}-${questionIndex}`),
        category: cat,
        question: questionText,
        difficulty,
        timeAllocationMinutes: timeAllocation,
        scoringCriteria: entry.scoringCriteria,
        followUpQuestions: entry.followUpQuestions,
        relatedSkills: [
          ...entry.relatedSkills,
          ...requiredSkills.slice(0, 3),
        ],
        maxScore: 10,
      });

      questionIndex++;
    }
  }

  // Calculate estimated duration
  const estimatedDurationMinutes = questions.reduce(
    (sum, q) => sum + q.timeAllocationMinutes,
    0
  );

  return {
    id: planId,
    jobTitle,
    department,
    totalQuestions: questions.length,
    estimatedDurationMinutes,
    questions,
    categoryDistribution: distribution,
    createdAt: new Date(),
  };
}

/**
 * Evaluates a candidate's answer using keyword and heuristic analysis.
 *
 * This is a LOCAL evaluation (no AI API call). It analyzes:
 * - Answer length (proxy for detail)
 * - Keyword matches from related skills
 * - STAR method indicators for behavioral questions
 * - Specificity: numbers, metrics, company/tool names
 * - Quality indicators: causal reasoning, examples, impact statements
 *
 * Scoring: 0-3 POOR, 4-5 AVERAGE, 6-7 GOOD, 8-10 EXCELLENT
 */
export function evaluateAnswer(params: {
  question: InterviewQuestion;
  answer: string;
  candidateContext?: { name: string; experience: number };
}): AnswerEvaluation {
  const { question, answer, candidateContext } = params;
  const answerLower = answer.toLowerCase().trim();
  const answerWords = answerLower.split(/\s+/).filter(Boolean);
  const wordCount = answerWords.length;

  let score = 0;
  const strengths: string[] = [];
  const improvements: string[] = [];
  const keywordsDetected: string[] = [];

  // ── 1. Length analysis (0-2 points) ──────────────────────────────────
  if (wordCount < 5) {
    // Very short / essentially empty
    score += 0;
    improvements.push('Answer is too brief to evaluate meaningfully');
  } else if (wordCount < 20) {
    score += 1;
    improvements.push('Provide more detail in your response');
  } else if (wordCount < 50) {
    score += 1.5;
  } else if (wordCount < 150) {
    score += 2;
    strengths.push('Good level of detail in response');
  } else {
    score += 2;
    strengths.push('Comprehensive and detailed response');
  }

  // ── 2. Keyword matching from related skills (0-2.5 points) ──────────
  const normalizedSkills = question.relatedSkills.map((s) => s.toLowerCase());
  let skillMatches = 0;
  for (const skill of normalizedSkills) {
    // Check for skill word or partial match
    const skillWords = skill.split(/\s+/);
    const matched = skillWords.some((w) => answerLower.includes(w));
    if (matched) {
      skillMatches++;
      keywordsDetected.push(skill);
    }
  }

  if (normalizedSkills.length > 0) {
    const matchRatio = skillMatches / normalizedSkills.length;
    score += matchRatio * 2.5;
    if (matchRatio >= 0.5) {
      strengths.push('References relevant skills and concepts');
    } else if (matchRatio > 0 && matchRatio < 0.3) {
      improvements.push('Address more of the relevant skills in your answer');
    } else if (matchRatio === 0) {
      improvements.push('Mention specific skills and technologies related to the question');
    }
  }

  // ── 3. STAR method for behavioral questions (0-2 points) ────────────
  if (question.category === 'BEHAVIORAL') {
    let starScore = 0;
    const starFound: string[] = [];
    for (const [component, keywords] of Object.entries(STAR_INDICATORS)) {
      const found = keywords.some((kw) => answerLower.includes(kw));
      if (found) {
        starScore += 0.5;
        starFound.push(component);
      }
    }
    score += starScore;
    if (starFound.length >= 3) {
      strengths.push('Good use of STAR method (Situation, Task, Action, Result)');
      keywordsDetected.push('STAR method');
    } else if (starFound.length > 0) {
      improvements.push(
        `Strengthen answer with full STAR method — missing: ${
          ['situation', 'task', 'action', 'result']
            .filter((c) => !starFound.includes(c))
            .join(', ')
        }`
      );
    } else {
      improvements.push('Use the STAR method: describe the Situation, Task, Action, and Result');
    }
  }

  // ── 4. Specificity indicators (0-1.5 points) ───────────────────────
  let specificityHits = 0;
  for (const pattern of SPECIFICITY_PATTERNS) {
    if (pattern.test(answer)) {
      specificityHits++;
    }
  }
  if (specificityHits >= 3) {
    score += 1.5;
    strengths.push('Includes specific metrics and quantifiable outcomes');
    keywordsDetected.push('metrics', 'quantifiable outcomes');
  } else if (specificityHits >= 1) {
    score += 0.75;
    strengths.push('Includes some specific details');
  } else if (wordCount >= 20) {
    improvements.push('Add specific numbers, metrics, or measurable outcomes');
  }

  // ── 5. Quality keywords (0-2 points) ───────────────────────────────
  let qualityHits = 0;
  for (const keyword of QUALITY_KEYWORDS) {
    if (answerLower.includes(keyword)) {
      qualityHits++;
    }
  }
  if (qualityHits >= 5) {
    score += 2;
    strengths.push('Well-structured response with clear reasoning');
  } else if (qualityHits >= 3) {
    score += 1.5;
    strengths.push('Shows good analytical thinking');
  } else if (qualityHits >= 1) {
    score += 0.75;
  } else if (wordCount >= 20) {
    improvements.push('Explain your reasoning and the impact of your actions');
  }

  // Clamp score to 0-maxScore
  score = Math.min(question.maxScore, Math.max(0, Math.round(score * 10) / 10));

  // Determine level
  let level: AnswerEvaluation['level'];
  if (score >= 8) level = 'EXCELLENT';
  else if (score >= 6) level = 'GOOD';
  else if (score >= 4) level = 'AVERAGE';
  else level = 'POOR';

  // Generate feedback
  const categoryLabel = CATEGORY_LABELS[question.category];

  const feedbackMap: Record<AnswerEvaluation['level'], string> = {
    EXCELLENT: `Excellent ${categoryLabel.toLowerCase()} response. ${question.scoringCriteria.excellent}`,
    GOOD: `Good ${categoryLabel.toLowerCase()} response. ${question.scoringCriteria.good}`,
    AVERAGE: `Average ${categoryLabel.toLowerCase()} response. ${question.scoringCriteria.average}`,
    POOR: `Below expectations. ${question.scoringCriteria.poor}`,
  };

  const percentage = Math.round((score / question.maxScore) * 100);

  return {
    questionId: question.id,
    score,
    maxScore: question.maxScore,
    percentage,
    level,
    feedback: feedbackMap[level],
    strengths: [...new Set(strengths)].slice(0, 5),
    improvements: [...new Set(improvements)].slice(0, 5),
    keywordsDetected: [...new Set(keywordsDetected)],
  };
}

/**
 * Generates a comprehensive interview assessment from all evaluations.
 *
 * Calculates overall score, per-category scores, determines recommendation,
 * and produces a summary with strengths and concerns.
 */
export function generateAssessment(params: {
  candidateId: string;
  candidateName: string;
  interviewPlan: InterviewPlan;
  evaluations: AnswerEvaluation[];
}): InterviewAssessment {
  const { candidateId, candidateName, interviewPlan, evaluations } = params;

  // Build a question lookup by ID
  const questionMap = new Map<string, InterviewQuestion>();
  for (const q of interviewPlan.questions) {
    questionMap.set(q.id, q);
  }

  // ── Calculate overall score ────────────────────────────────────────
  let totalPercentage = 0;
  for (const ev of evaluations) {
    totalPercentage += ev.percentage;
  }
  const overallScore =
    evaluations.length > 0
      ? Math.round(totalPercentage / evaluations.length)
      : 0;

  // ── Calculate per-category scores ──────────────────────────────────
  const categoryGroups = new Map<
    InterviewQuestionCategory,
    { totalScore: number; totalMax: number }
  >();

  for (const ev of evaluations) {
    const question = questionMap.get(ev.questionId);
    if (!question) continue;

    const cat = question.category;
    const existing = categoryGroups.get(cat) || { totalScore: 0, totalMax: 0 };
    existing.totalScore += ev.score;
    existing.totalMax += ev.maxScore;
    categoryGroups.set(cat, existing);
  }

  const categoryScores = {} as InterviewAssessment['categoryScores'];
  const allCategories: InterviewQuestionCategory[] = [
    'TECHNICAL', 'BEHAVIORAL', 'SITUATIONAL',
    'PROBLEM_SOLVING', 'MOTIVATION', 'CULTURAL_FIT',
  ];

  let topCategory = '';
  let topCategoryScore = -1;
  let weakCategory = '';
  let weakCategoryScore = 101;

  for (const cat of allCategories) {
    const group = categoryGroups.get(cat);
    if (group && group.totalMax > 0) {
      const pct = Math.round((group.totalScore / group.totalMax) * 100);
      categoryScores[cat] = {
        score: Math.round(group.totalScore * 10) / 10,
        maxScore: group.totalMax,
        percentage: pct,
      };
      if (pct > topCategoryScore) {
        topCategoryScore = pct;
        topCategory = CATEGORY_LABELS[cat];
      }
      if (pct < weakCategoryScore) {
        weakCategoryScore = pct;
        weakCategory = CATEGORY_LABELS[cat];
      }
    } else {
      categoryScores[cat] = { score: 0, maxScore: 0, percentage: 0 };
    }
  }

  // ── Determine recommendation ───────────────────────────────────────
  let recommendation: InterviewAssessment['recommendation'];
  if (overallScore >= 85) recommendation = 'STRONGLY_RECOMMEND';
  else if (overallScore >= 70) recommendation = 'RECOMMEND';
  else if (overallScore >= 50) recommendation = 'CONSIDER';
  else recommendation = 'DO_NOT_RECOMMEND';

  const recLabel = RECOMMENDATION_LABELS[recommendation];

  // ── Collect strengths and concerns ─────────────────────────────────
  const allStrengths: string[] = [];
  const allConcerns: string[] = [];

  for (const ev of evaluations) {
    allStrengths.push(...ev.strengths);
    allConcerns.push(...ev.improvements);
  }

  // Deduplicate and take top 5
  const strengths = [...new Set(allStrengths)].slice(0, 5);
  const concerns = [...new Set(allConcerns)].slice(0, 5);

  // ── Generate summary ───────────────────────────────────────────────
  const topPart = topCategory
    ? `Strongest in ${topCategory} (${topCategoryScore}%)`
    : 'No category data available';
  const weakPart = weakCategory
    ? `needs improvement in ${weakCategory} (${weakCategoryScore}%)`
    : 'no weak areas identified';

  const summary =
    `${candidateName} scored ${overallScore}% overall. ` +
    `${topPart}, ${weakPart}. ` +
    `Recommendation: ${recLabel}.`;

  return {
    candidateId,
    candidateName,
    interviewPlanId: interviewPlan.id,
    jobTitle: interviewPlan.jobTitle,
    evaluations,
    overallScore,
    categoryScores,
    recommendation,
    summary,
    strengths,
    concerns,
    completedAt: new Date(),
  };
}

/**
 * Returns questions from the question bank filtered by category.
 * If count is specified, returns a shuffled selection of that count.
 * Otherwise returns all questions for that category.
 */
export function getQuestionsByCategory(
  category: InterviewQuestionCategory,
  count?: number
): InterviewQuestion[] {
  const bankEntries = QUESTION_BANK.filter((q) => q.category === category);

  const questions: InterviewQuestion[] = bankEntries.map((entry, idx) => ({
    id: generateId('qbank', `${category}-${idx}`),
    category: entry.category,
    question: entry.question,
    difficulty: 'MEDIUM' as const,
    timeAllocationMinutes: DIFFICULTY_TIME.MEDIUM,
    scoringCriteria: entry.scoringCriteria,
    followUpQuestions: entry.followUpQuestions,
    relatedSkills: entry.relatedSkills,
    maxScore: 10,
  }));

  if (count !== undefined && count < questions.length) {
    // Shuffle and take first `count`
    const shuffled = seededShuffle(questions, `${category}-${count}`);
    return shuffled.slice(0, count);
  }

  return questions;
}

/**
 * Calculates the total interview duration and per-category breakdown.
 */
export function calculateInterviewDuration(plan: InterviewPlan): {
  totalMinutes: number;
  breakdown: Record<InterviewQuestionCategory, number>;
} {
  const breakdown: Record<InterviewQuestionCategory, number> = {
    TECHNICAL: 0,
    BEHAVIORAL: 0,
    SITUATIONAL: 0,
    PROBLEM_SOLVING: 0,
    MOTIVATION: 0,
    CULTURAL_FIT: 0,
  };

  let totalMinutes = 0;

  for (const q of plan.questions) {
    breakdown[q.category] += q.timeAllocationMinutes;
    totalMinutes += q.timeAllocationMinutes;
  }

  return { totalMinutes, breakdown };
}
