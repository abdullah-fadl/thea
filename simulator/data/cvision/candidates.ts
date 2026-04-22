/**
 * CVision Candidate Data Generator
 */

const SOURCES = ['PORTAL', 'REFERRAL', 'DIRECT', 'LINKEDIN', 'AGENCY'] as const;

const SKILL_POOLS: Record<string, string[]> = {
  IT: ['JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'Git'],
  HR: ['Recruitment', 'Onboarding', 'Performance Management', 'Labor Law', 'Payroll', 'HRIS', 'Training'],
  FIN: ['Financial Analysis', 'Budgeting', 'Excel', 'SAP', 'IFRS', 'Auditing', 'Tax Compliance'],
  OPS: ['Project Management', 'Process Improvement', 'Lean', 'Six Sigma', 'Supply Chain', 'ERP'],
  DEFAULT: ['Communication', 'Leadership', 'Problem Solving', 'Team Management', 'MS Office'],
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let counter = 0;

export interface CandidateData {
  fullName: string;
  email: string;
  phone: string;
  source: string;
  skills: string[];
  experienceYears: number;
  currentTitle?: string;
  expectedSalary?: number;
}

export class CVisionCandidateGenerator {
  generate(departmentCode?: string): CandidateData {
    counter++;
    const firstName = pick(['Ali', 'Omar', 'Hassan', 'Tariq', 'Youssef', 'Sara', 'Noor', 'Hana', 'Layla', 'Rania']);
    const lastName = pick(['Ahmed', 'Hassan', 'Ali', 'Ibrahim', 'Khalil', 'Saleh', 'Nasser', 'Hamad']);
    const skills = this.pickSkills(departmentCode || 'DEFAULT', 3 + Math.floor(Math.random() * 4));

    return {
      fullName: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${counter}@candidate.sim`,
      phone: `+9665${Math.floor(Math.random() * 10)}${Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('')}`,
      source: pick(SOURCES),
      skills,
      experienceYears: Math.floor(Math.random() * 20),
      currentTitle: pick(['Software Engineer', 'Analyst', 'Coordinator', 'Specialist', 'Manager', 'Associate']),
      expectedSalary: 4000 + Math.floor(Math.random() * 30000),
    };
  }

  generateN(n: number, departmentCode?: string): CandidateData[] {
    return Array.from({ length: n }, () => this.generate(departmentCode));
  }

  private pickSkills(deptCode: string, count: number): string[] {
    const pool = [...(SKILL_POOLS[deptCode] || SKILL_POOLS.DEFAULT), ...SKILL_POOLS.DEFAULT];
    const unique = Array.from(new Set(pool));
    const shuffled = unique.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}
