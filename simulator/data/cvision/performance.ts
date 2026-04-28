/**
 * CVision Performance Data Generator
 * OKRs, review ratings, KPI targets.
 */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface OKRData {
  title: string;
  titleAr: string;
  description: string;
  keyResults: { title: string; target: number; unit: string }[];
}

export interface ReviewData {
  categories: { name: string; nameAr: string; score: number; comments?: string }[];
  strengths: string;
  improvementAreas: string;
  overallRating: number;
}

const OKR_TEMPLATES: OKRData[] = [
  {
    title: 'Improve Team Productivity',
    titleAr: 'تحسين إنتاجية الفريق',
    description: 'Increase overall team output and efficiency',
    keyResults: [
      { title: 'Complete 90% of sprint tasks', target: 90, unit: '%' },
      { title: 'Reduce bug count by 30%', target: 30, unit: '%' },
      { title: 'Ship 3 major features', target: 3, unit: 'features' },
    ],
  },
  {
    title: 'Enhance Customer Satisfaction',
    titleAr: 'تحسين رضا العملاء',
    description: 'Improve NPS and response times',
    keyResults: [
      { title: 'Achieve NPS score of 80+', target: 80, unit: 'score' },
      { title: 'Reduce response time to 2 hours', target: 2, unit: 'hours' },
    ],
  },
  {
    title: 'Professional Development',
    titleAr: 'التطوير المهني',
    description: 'Grow technical and leadership skills',
    keyResults: [
      { title: 'Complete 2 certifications', target: 2, unit: 'certifications' },
      { title: 'Mentor 1 junior team member', target: 1, unit: 'mentees' },
      { title: 'Present at 1 team knowledge share', target: 1, unit: 'presentations' },
    ],
  },
  {
    title: 'Process Optimization',
    titleAr: 'تحسين العمليات',
    description: 'Streamline department workflows',
    keyResults: [
      { title: 'Automate 3 manual processes', target: 3, unit: 'processes' },
      { title: 'Reduce processing time by 25%', target: 25, unit: '%' },
    ],
  },
];

const REVIEW_CATEGORIES = [
  { name: 'Job Knowledge', nameAr: 'المعرفة الوظيفية' },
  { name: 'Quality of Work', nameAr: 'جودة العمل' },
  { name: 'Communication', nameAr: 'التواصل' },
  { name: 'Teamwork', nameAr: 'العمل الجماعي' },
  { name: 'Initiative', nameAr: 'المبادرة' },
];

const STRENGTHS = [
  'Strong technical skills and attention to detail',
  'Excellent team collaboration and communication',
  'Consistently meets deadlines and quality standards',
  'Shows initiative and takes ownership of tasks',
  'Great problem-solving abilities',
];

const IMPROVEMENTS = [
  'Could improve time management skills',
  'Should seek more cross-functional collaboration',
  'Documentation could be more thorough',
  'Would benefit from leadership training',
  'Communication with stakeholders needs improvement',
];

export class CVisionPerformanceGenerator {
  generateOKR(): OKRData {
    return pick(OKR_TEMPLATES);
  }

  generateReview(): ReviewData {
    const categories = REVIEW_CATEGORIES.map(cat => ({
      name: cat.name,
      nameAr: cat.nameAr,
      score: 1 + Math.floor(Math.random() * 5), // 1-5 scale
    }));

    const avgScore = categories.reduce((s, c) => s + c.score, 0) / categories.length;

    return {
      categories,
      strengths: pick(STRENGTHS),
      improvementAreas: pick(IMPROVEMENTS),
      overallRating: Math.round(avgScore * 10) / 10,
    };
  }
}
