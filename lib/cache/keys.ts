/**
 * Cache Key Builders and TTL Constants
 *
 * Centralised registry of cache key patterns so that cache reads and
 * invalidations stay consistent across the codebase.
 */

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

export const CacheKeys = {
  // ---- Dashboard / Analytics ----
  opdDashboard: (tenantId: string) => `opd:dashboard:${tenantId}`,
  opdAnalytics: (tenantId: string, period: string) =>
    `opd:analytics:${tenantId}:${period}`,
  opdAnalyticsWithDept: (tenantId: string, period: string, departmentId: string) =>
    `opd:analytics:${tenantId}:${period}:${departmentId}`,

  // ---- Departments ----
  departments: (tenantId: string) => `departments:${tenantId}`,
  departmentsByFloor: (tenantId: string, floorKey: string) =>
    `departments:${tenantId}:floor:${floorKey}`,
  departmentsWithDeleted: (tenantId: string) =>
    `departments:${tenantId}:with-deleted`,
  department: (tenantId: string, deptId: string) =>
    `department:${tenantId}:${deptId}`,

  // ---- Scheduling ----
  schedulingResources: (tenantId: string) => `scheduling:resources:${tenantId}`,
  schedulingResourcesFiltered: (tenantId: string, filterHash: string) =>
    `scheduling:resources:${tenantId}:${filterHash}`,
  schedulingSlots: (tenantId: string, resourceId: string, date: string) =>
    `scheduling:slots:${tenantId}:${resourceId}:${date}`,

  // ---- Providers ----
  providers: (tenantId: string) => `providers:${tenantId}`,

  // ---- Patients ----
  patientSearch: (tenantId: string, query: string) =>
    `patient:search:${tenantId}:${query}`,
  patient: (tenantId: string, patientId: string) =>
    `patient:${tenantId}:${patientId}`,

  // ---- Dashboard / Stats ----
  dashboardStats: (tenantId: string) => `dashboard:stats:${tenantId}`,

  // ---- Department extras ----
  departmentList: (tenantId: string) => `departments:list:${tenantId}`,
  activeDepartments: (tenantId: string) => `departments:active:${tenantId}`,

  // ---- Provider extras ----
  providerList: (tenantId: string) => `providers:list:${tenantId}`,
  providerSummary: (tenantId: string) => `providers:summary:${tenantId}`,

  // ---- OPD Census ----
  opdCensus: (tenantId: string) => `opd:census:${tenantId}`,

  // ---- Clinics ----
  clinicList: (tenantId: string) => `clinics:list:${tenantId}`,

  // ---- Specialties ----
  specialtyList: (tenantId: string) => `specialties:list:${tenantId}`,

  // ---- System ----
  systemSettings: (tenantId: string) => `system:settings:${tenantId}`,
};

// ---------------------------------------------------------------------------
// TTL values (seconds)
// ---------------------------------------------------------------------------

export const CacheTTL = {
  /** Dashboard summary widgets */
  DASHBOARD: 5 * 60,         // 5 minutes
  /** Analytics queries */
  ANALYTICS: 5 * 60,         // 5 minutes
  /** Department lists (rarely change) */
  DEPARTMENTS: 30 * 60,      // 30 minutes
  /** Scheduling resources */
  SCHEDULING: 10 * 60,       // 10 minutes
  /** Provider lists */
  PROVIDERS: 15 * 60,        // 15 minutes
  /** Patient search results (short-lived) */
  PATIENT_SEARCH: 2 * 60,    // 2 minutes
  /** Individual patient record */
  PATIENT: 5 * 60,           // 5 minutes
  /** System settings */
  SYSTEM_SETTINGS: 30 * 60,  // 30 minutes
};
