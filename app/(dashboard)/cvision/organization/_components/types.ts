// ── Organization page shared types ──

export interface Department {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  managerId?: string | null;
  isActive: boolean;
  isArchived?: boolean;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  departmentId: string;
  managerId?: string | null;
  isActive: boolean;
  isArchived?: boolean;
  sortOrder?: number;
}

export interface JobTitle {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  departmentId?: string | null;
  unitId?: string | null;
  isActive: boolean;
  isArchived?: boolean;
}

export interface Grade {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  jobTitleId?: string | null;
  jobTitleIds?: string[];
  level: number;
  minSalary?: number;
  maxSalary?: number;
  isActive: boolean;
  isArchived?: boolean;
}

export interface Position {
  id: string;
  positionCode: string;
  title?: string | null;
  departmentId: string;
  jobTitleId: string;
  gradeId?: string | null;
  budgetedHeadcount: number;
  isActive: boolean;
  occupiedHeadcount?: number;
  openRequisitions?: number;
  availableSlots?: number;
}

export interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo: string;
}

// ── Stats ──

export interface OrgStatsData {
  departments: number;
  units: number;
  jobTitles: number;
  totalPositions: number;
  avgDeptSize: number;
}

export function computeOrgStats(
  departments: Department[],
  units: Unit[],
  jobTitles: JobTitle[],
  positions: Position[],
): OrgStatsData {
  const activeDepts = departments.filter(d => !d.isArchived);
  const activeUnits = units.filter(u => !u.isArchived);
  const activeJTs = jobTitles.filter(jt => !jt.isArchived);
  const totalPositions = positions
    .filter(p => p.isActive)
    .reduce((sum, p) => sum + (p.budgetedHeadcount || 0), 0);
  const avgDeptSize =
    activeDepts.length > 0
      ? Math.round(activeJTs.length / activeDepts.length)
      : 0;

  return {
    departments: activeDepts.length,
    units: activeUnits.length,
    jobTitles: activeJTs.length,
    totalPositions,
    avgDeptSize,
  };
}

// ── Tab type ──

export type OrgTab = 'departments' | 'org-chart' | 'job-titles' | 'branches';

// ── Form data types ──

export interface DeptFormData {
  code: string;
  name: string;
  nameAr: string;
  managerId: string;
}

export interface UnitFormData {
  code: string;
  name: string;
  nameAr: string;
  managerId: string;
}

export interface JobTitleFormData {
  code: string;
  name: string;
  nameAr: string;
}

export interface GradeFormData {
  code: string;
  name: string;
  nameAr: string;
  level: number;
}

export interface PositionFormData {
  gradeId: string;
  title: string;
  budgetedHeadcount: number;
}
