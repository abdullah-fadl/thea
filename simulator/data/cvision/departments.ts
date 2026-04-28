/**
 * CVision Department / Grade / Job Title Data Generator
 * Bilingual (Arabic/English) organizational structure data.
 */

export interface DepartmentData {
  name: string;
  nameAr: string;
  code: string;
  description?: string;
}

export interface GradeData {
  code: string;
  name: string;
  nameAr: string;
  level: number;
  minSalary: number;
  maxSalary: number;
  currency: string;
}

export interface JobTitleData {
  code: string;
  name: string;
  nameAr: string;
  departmentCode?: string;
}

const DEPARTMENTS: DepartmentData[] = [
  { name: 'Human Resources', nameAr: 'الموارد البشرية', code: 'HR', description: 'HR department' },
  { name: 'Information Technology', nameAr: 'تقنية المعلومات', code: 'IT', description: 'IT department' },
  { name: 'Finance', nameAr: 'المالية', code: 'FIN', description: 'Finance department' },
  { name: 'Operations', nameAr: 'العمليات', code: 'OPS', description: 'Operations department' },
  { name: 'Marketing', nameAr: 'التسويق', code: 'MKT', description: 'Marketing department' },
  { name: 'Legal', nameAr: 'الشؤون القانونية', code: 'LEG', description: 'Legal department' },
  { name: 'Administration', nameAr: 'الشؤون الإدارية', code: 'ADM', description: 'Administration' },
  { name: 'Quality', nameAr: 'الجودة', code: 'QA', description: 'Quality assurance' },
];

const GRADES: GradeData[] = [
  { code: 'G1', name: 'Grade 1 - Entry', nameAr: 'الدرجة 1 - مبتدئ', level: 1, minSalary: 3000, maxSalary: 6000, currency: 'SAR' },
  { code: 'G2', name: 'Grade 2 - Junior', nameAr: 'الدرجة 2 - مبتدئ متقدم', level: 2, minSalary: 5000, maxSalary: 10000, currency: 'SAR' },
  { code: 'G3', name: 'Grade 3 - Mid', nameAr: 'الدرجة 3 - متوسط', level: 3, minSalary: 8000, maxSalary: 18000, currency: 'SAR' },
  { code: 'G4', name: 'Grade 4 - Senior', nameAr: 'الدرجة 4 - أول', level: 4, minSalary: 15000, maxSalary: 30000, currency: 'SAR' },
  { code: 'G5', name: 'Grade 5 - Executive', nameAr: 'الدرجة 5 - تنفيذي', level: 5, minSalary: 25000, maxSalary: 50000, currency: 'SAR' },
];

const JOB_TITLES: JobTitleData[] = [
  { code: 'SWE', name: 'Software Engineer', nameAr: 'مهندس برمجيات', departmentCode: 'IT' },
  { code: 'HRS', name: 'HR Specialist', nameAr: 'أخصائي موارد بشرية', departmentCode: 'HR' },
  { code: 'ACC', name: 'Accountant', nameAr: 'محاسب', departmentCode: 'FIN' },
  { code: 'OPM', name: 'Operations Manager', nameAr: 'مدير عمليات', departmentCode: 'OPS' },
  { code: 'SYA', name: 'Systems Administrator', nameAr: 'مدير أنظمة', departmentCode: 'IT' },
  { code: 'FAN', name: 'Financial Analyst', nameAr: 'محلل مالي', departmentCode: 'FIN' },
  { code: 'REC', name: 'Recruiter', nameAr: 'أخصائي توظيف', departmentCode: 'HR' },
  { code: 'QAS', name: 'Quality Specialist', nameAr: 'أخصائي جودة', departmentCode: 'QA' },
  { code: 'ADC', name: 'Admin Coordinator', nameAr: 'منسق إداري', departmentCode: 'ADM' },
  { code: 'MKS', name: 'Marketing Specialist', nameAr: 'أخصائي تسويق', departmentCode: 'MKT' },
  { code: 'LGA', name: 'Legal Advisor', nameAr: 'مستشار قانوني', departmentCode: 'LEG' },
  { code: 'PRM', name: 'Project Manager', nameAr: 'مدير مشاريع', departmentCode: 'OPS' },
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class CVisionDepartmentGenerator {
  /** Get the standard 4 core departments */
  getCoreDepartments(): DepartmentData[] {
    return DEPARTMENTS.slice(0, 4);
  }

  /** Get all departments */
  getAllDepartments(): DepartmentData[] {
    return [...DEPARTMENTS];
  }

  generateDepartment(): DepartmentData {
    return pick(DEPARTMENTS);
  }

  /** Get all 5 grades */
  getAllGrades(): GradeData[] {
    return [...GRADES];
  }

  generateGrade(): GradeData {
    return pick(GRADES);
  }

  /** Get all job titles */
  getAllJobTitles(): JobTitleData[] {
    return [...JOB_TITLES];
  }

  /** Get job titles for a specific department */
  getJobTitlesForDepartment(deptCode: string): JobTitleData[] {
    return JOB_TITLES.filter(jt => jt.departmentCode === deptCode);
  }

  generateJobTitle(): JobTitleData {
    return pick(JOB_TITLES);
  }
}
