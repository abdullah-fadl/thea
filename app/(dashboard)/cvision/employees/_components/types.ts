// Shared types for Employees list page components

export interface EmployeeListItem {
  id: string;
  employeeNumber?: string;
  employeeNo?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  departmentId: string;
  unitId?: string | null;
  jobTitleId: string;
  positionId?: string | null;
  gradeId?: string | null;
  managerEmployeeId?: string | null;
  status: string;
  hireDate?: string;
  hiredAt?: string;
  nationalId?: string;
  gender?: string;
  nationality?: string;
  dateOfBirth?: string;
}

export interface DepartmentRef { id: string; name: string; code?: string }
export interface JobTitleRef { id: string; name?: string; title?: string; code?: string | null }
export interface UnitRef { id: string; name: string; code?: string; departmentId?: string }
export interface GradeRef { id: string; name?: string; code?: string | null; level?: number }
export interface EmployeeRef { id: string; firstName: string; lastName: string; employeeNo?: string }

export type ViewMode = 'grid' | 'list';

export type SortOption = 'name_asc' | 'name_desc' | 'hire_date_asc' | 'hire_date_desc' | 'department' | 'status';

export interface StatsData {
  total: number;
  active: number;
  probation: number;
  departmentCount: number;
  avgTenureMonths: number;
}

export interface AddEmployeeFormData {
  // Step 1: Basic Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationalId: string;
  gender: string;
  nationality: string;
  dateOfBirth: string;
  // Step 2: Employment
  departmentId: string;
  jobTitleId: string;
  gradeId: string;
  managerEmployeeId: string;
  hireDate: string;
  employmentType: string;
  status: string;
}

/** Calculate profile completeness from list-view fields (no API call) */
export function calculateProfileCompleteness(emp: EmployeeListItem): number {
  const checks = [
    !!emp.firstName,
    !!emp.lastName,
    !!emp.email,
    !!emp.phone,
    !!emp.departmentId,
    !!emp.jobTitleId,
    !!(emp.hireDate || emp.hiredAt),
    !!emp.nationalId,
    !!emp.gender,
    !!emp.nationality,
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

/** Format a date as relative time (e.g. "2y 3mo", "15 days") */
export function formatRelativeDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Future date
  if (diffMs < 0) {
    const days = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
    return `in ${days}d`;
  }

  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (totalDays < 30) return `${totalDays}d ago`;

  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  if (now.getDate() < date.getDate()) months--;
  if (months < 0) { years--; months += 12; }

  if (years === 0) return `${months}mo ago`;
  if (months === 0) return `${years}y ago`;
  return `${years}y ${months}mo ago`;
}
