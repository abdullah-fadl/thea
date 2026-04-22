/**
 * CVision (HR OS) - Path Constants
 * 
 * Centralized path definitions for CVision routes.
 */

// =============================================================================
// UI Routes
// =============================================================================

export const CVISION_ROUTES = {
  // Main
  ROOT: '/cvision',
  DASHBOARD: '/cvision',
  
  // Organization
  ORGANIZATION: '/cvision/organization',
  DEPARTMENTS: '/cvision/organization/departments',
  UNITS: '/cvision/organization/units',
  JOB_TITLES: '/cvision/organization/job-titles',
  GRADES: '/cvision/organization/grades',
  
  // Employees
  EMPLOYEES: '/cvision/employees',
  EMPLOYEE_DETAIL: (id: string) => `/cvision/employees/${id}`,
  EMPLOYEE_NEW: '/cvision/employees/new',
  
  // Requests
  REQUESTS: '/cvision/requests',
  REQUEST_DETAIL: (id: string) => `/cvision/requests/${id}`,
  REQUEST_NEW: '/cvision/requests/new',
  
  // Recruitment
  RECRUITMENT: '/cvision/recruitment',
  REQUISITIONS: '/cvision/recruitment/requisitions',
  REQUISITION_DETAIL: (id: string) => `/cvision/recruitment/requisitions/${id}`,
  REQUISITION_NEW: '/cvision/recruitment/requisitions/new',
  CANDIDATES: '/cvision/recruitment/candidates',
  CANDIDATE_DETAIL: (id: string) => `/cvision/recruitment/candidates/${id}`,
  
  // Manpower
  MANPOWER_PLANS: '/cvision/manpower/plans',
} as const;

// =============================================================================
// API Routes
// =============================================================================

export const CVISION_API_ROUTES = {
  // Health
  HEALTH: '/api/cvision/health',
  
  // Organization
  DEPARTMENTS: '/api/cvision/departments',
  DEPARTMENT: (id: string) => `/api/cvision/departments/${id}`,
  UNITS: '/api/cvision/units',
  UNIT: (id: string) => `/api/cvision/units/${id}`,
  JOB_TITLES: '/api/cvision/job-titles',
  JOB_TITLE: (id: string) => `/api/cvision/job-titles/${id}`,
  GRADES: '/api/cvision/grades',
  GRADE: (id: string) => `/api/cvision/grades/${id}`,
  
  // Employees
  EMPLOYEES: '/api/cvision/employees',
  EMPLOYEE: (id: string) => `/api/cvision/employees/${id}`,
  EMPLOYEE_STATUS: (id: string) => `/api/cvision/employees/${id}/status`,
  EMPLOYEE_HISTORY: (id: string) => `/api/cvision/employees/${id}/history`,
  
  // Requests
  REQUESTS: '/api/cvision/requests',
  REQUEST: (id: string) => `/api/cvision/requests/${id}`,
  REQUEST_ESCALATE: (id: string) => `/api/cvision/requests/${id}/escalate`,
  
  // Recruitment
  REQUISITIONS: '/api/cvision/recruitment/requisitions',
  REQUISITION: (id: string) => `/api/cvision/recruitment/requisitions/${id}`,
  CANDIDATES: '/api/cvision/recruitment/candidates',
  CANDIDATE: (id: string) => `/api/cvision/recruitment/candidates/${id}`,
  CANDIDATE_SCREEN: (id: string) => `/api/cvision/recruitment/candidates/${id}/screen`,
} as const;

// =============================================================================
// Navigation Items
// =============================================================================

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavItem[];
}

export const CVISION_NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: CVISION_ROUTES.DASHBOARD,
    icon: 'LayoutDashboard',
  },
  {
    label: 'Organization',
    href: CVISION_ROUTES.ORGANIZATION,
    icon: 'Building2',
  },
  {
    label: 'Employees',
    href: CVISION_ROUTES.EMPLOYEES,
    icon: 'Users',
  },
  {
    label: 'Requests',
    href: CVISION_ROUTES.REQUESTS,
    icon: 'FileText',
  },
  {
    label: 'Recruitment',
    href: CVISION_ROUTES.RECRUITMENT,
    icon: 'UserPlus',
  },
  {
    label: 'Manpower',
    href: CVISION_ROUTES.MANPOWER_PLANS,
    icon: 'BarChart',
  },
];

// =============================================================================
// Path Helpers
// =============================================================================

/**
 * Check if a path is a CVision route
 */
export function isCVisionRoute(pathname: string): boolean {
  return pathname.startsWith('/cvision') || pathname.startsWith('/api/cvision');
}

/**
 * Check if a path is a CVision API route
 */
export function isCVisionApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/cvision');
}

/**
 * Get the active nav item for a given pathname
 */
export function getActiveNavItem(pathname: string): NavItem | undefined {
  return CVISION_NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );
}
