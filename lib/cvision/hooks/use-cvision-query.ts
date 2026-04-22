/**
 * CVision React Query hooks for all domains.
 * Each hook wraps useQuery/useMutation with the correct query key and fetch call.
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, CVisionApiError } from './cvision-fetch';
import { cvisionKeys } from './query-keys';

// ─── Helpers ────────────────────────────────────────────────

type QueryOpts<T> = Omit<UseQueryOptions<T, CVisionApiError>, 'queryKey' | 'queryFn'>;

/** Extract array data from various API response shapes */
function extractArray(data: any, ...keys: string[]): any[] {
  for (const key of keys) {
    if (data?.[key]) {
      const val = data[key];
      if (Array.isArray(val)) return val;
      if (val?.items && Array.isArray(val.items)) return val.items;
    }
  }
  if (data?.data?.items && Array.isArray(data.data.items)) return data.data.items;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

// ─── Employees ──────────────────────────────────────────────

interface EmployeeFilters {
  search?: string;
  statuses?: string;
  departmentId?: string;
  limit?: number;
}

export function useEmployees(filters?: EmployeeFilters, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.employees.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/employees', { params: filters as any }),
    ...opts,
  });
}

export function useEmployee(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.employees.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/employees/${id}`),
    enabled: !!id,
    ...opts,
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/employees', 'POST', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: cvisionKeys.employees.all }); },
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => cvisionMutate(`/api/cvision/employees/${id}`, 'PATCH', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: cvisionKeys.employees.all }); },
  });
}

// ─── Departments ────────────────────────────────────────────

export function useDepartments(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.departments.list(),
    queryFn: () => cvisionFetch('/api/cvision/org/departments'),
    ...opts,
  });
}

export function useDepartment(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.departments.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/org/departments/${id}`),
    enabled: !!id,
    ...opts,
  });
}

// ─── Job Titles ─────────────────────────────────────────────

export function useJobTitles(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.jobTitles.list(),
    queryFn: () => cvisionFetch('/api/cvision/job-titles', { params: { limit: 1000 } }),
    ...opts,
  });
}

// ─── Units ──────────────────────────────────────────────────

export function useUnits(filters?: { isActive?: boolean }, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.units.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/units', { params: filters }),
    ...opts,
  });
}

// ─── Positions ──────────────────────────────────────────────

export function usePositions(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.positions.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/positions', { params: filters }),
    ...opts,
  });
}

export function useBudgetedPositions(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.org.budgetedPositions.list(),
    queryFn: () => cvisionFetch('/api/cvision/org/budgeted-positions'),
    ...opts,
  });
}

// ─── Grades ─────────────────────────────────────────────────

export function useGrades(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.grades.list(),
    queryFn: () => cvisionFetch('/api/cvision/grades'),
    ...opts,
  });
}

// ─── Branches ───────────────────────────────────────────────

export function useBranches(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.branches.list(),
    queryFn: () => cvisionFetch('/api/cvision/branches'),
    ...opts,
  });
}

// ─── Contracts ──────────────────────────────────────────────

export function useContracts(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.contracts.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/contracts', { params: filters }),
    ...opts,
  });
}

// ─── Leaves ─────────────────────────────────────────────────

export function useLeaves(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.leaves.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/leaves', { params: filters }),
    ...opts,
  });
}

export function useLeaveBalances(employeeId: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.leaves.balances(employeeId),
    queryFn: () => cvisionFetch('/api/cvision/leaves', { params: { action: 'balance', employeeId } }),
    enabled: !!employeeId,
    ...opts,
  });
}

export function useCreateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/leaves', 'POST', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: cvisionKeys.leaves.all }); },
  });
}

export function useUpdateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: any) => cvisionMutate(`/api/cvision/leaves/${id}`, 'PATCH', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: cvisionKeys.leaves.all }); },
  });
}

// ─── Attendance ─────────────────────────────────────────────

export function useAttendance(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.attendance.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/attendance', { params: filters }),
    ...opts,
  });
}

export function useAttendanceBiometric(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.attendance.biometric.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/attendance/biometric', { params: filters }),
    ...opts,
  });
}

// ─── Payroll ────────────────────────────────────────────────

export function usePayrollProfiles(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.payroll.profiles.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/payroll/profiles', { params: { limit: 1000, ...filters } }),
    ...opts,
  });
}

export function usePayrollProfile(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.payroll.profiles.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/payroll/profiles/${id}`),
    enabled: !!id,
    ...opts,
  });
}

export function usePayrollRuns(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.payroll.runs.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/payroll/runs', { params: filters }),
    ...opts,
  });
}

export function usePayrollRun(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.payroll.runs.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/payroll/runs/${id}`),
    enabled: !!id,
    ...opts,
  });
}

export function usePayslips(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.payroll.payslips.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/payroll/payslips', { params: filters }),
    ...opts,
  });
}

export function useLoans(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.payroll.loans.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/payroll/loans', { params: { limit: 1000, ...filters } }),
    ...opts,
  });
}

export function useCreateLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/payroll/loans', 'POST', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: cvisionKeys.payroll.loans.all }); },
  });
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/payroll/runs', 'POST', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: cvisionKeys.payroll.runs.all }); },
  });
}

// ─── Recruitment ────────────────────────────────────────────

export function useRequisitions(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.recruitment.requisitions.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/recruitment/requisitions', { params: filters }),
    ...opts,
  });
}

export function useRequisition(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.recruitment.requisitions.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/recruitment/requisitions/${id}`),
    enabled: !!id,
    ...opts,
  });
}

export function useCandidates(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.recruitment.candidates.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/recruitment/candidates', { params: filters }),
    ...opts,
  });
}

export function useCandidate(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.recruitment.candidates.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/recruitment/candidates/${id}`),
    enabled: !!id,
    ...opts,
  });
}

export function useCvInboxBatches(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.recruitment.batches.list(),
    queryFn: () => cvisionFetch('/api/cvision/recruitment/cv-inbox/batches'),
    ...opts,
  });
}

export function useCvInboxBatch(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.recruitment.batches.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/recruitment/cv-inbox/batches/${id}`),
    enabled: !!id,
    ...opts,
  });
}

// ─── Performance ────────────────────────────────────────────

export function usePerformance(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.performance.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/performance', { params: filters }),
    ...opts,
  });
}

// ─── Training ───────────────────────────────────────────────

export function useTraining(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.training.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/training', { params: filters }),
    ...opts,
  });
}

// ─── OKRs ───────────────────────────────────────────────────

export function useOKRs(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.okrs.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/okrs', { params: filters }),
    ...opts,
  });
}

// ─── Scheduling ─────────────────────────────────────────────

export function useScheduling(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.scheduling.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/scheduling', { params: filters }),
    ...opts,
  });
}

// ─── Timesheets ─────────────────────────────────────────────

export function useTimesheets(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.timesheets.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/timesheets', { params: filters }),
    ...opts,
  });
}

// ─── Requests (Service Desk) ────────────────────────────────

export function useRequests(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.requests.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/requests', { params: filters }),
    ...opts,
  });
}

export function useRequest(id: string, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.requests.detail(id),
    queryFn: () => cvisionFetch(`/api/cvision/requests/${id}`),
    enabled: !!id,
    ...opts,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/requests', 'POST', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: cvisionKeys.requests.all }); },
  });
}

// ─── Announcements ──────────────────────────────────────────

export function useAnnouncements(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.announcements.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/announcements', { params: filters }),
    ...opts,
  });
}

// ─── Notifications ──────────────────────────────────────────

export function useNotifications(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.notifications.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/notifications', { params: filters }),
    ...opts,
  });
}

// ─── Self Service ───────────────────────────────────────────

export function useSelfService(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.selfService.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/self-service', { params: filters }),
    ...opts,
  });
}

// ─── Insurance ──────────────────────────────────────────────

export function useInsurance(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.insurance.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/insurance', { params: filters }),
    ...opts,
  });
}

// ─── Letters ────────────────────────────────────────────────

export function useLetters(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.letters.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/letters', { params: filters }),
    ...opts,
  });
}

// ─── Compliance ─────────────────────────────────────────────

export function useCompliance(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.compliance.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/compliance', { params: filters }),
    ...opts,
  });
}

// ─── Disciplinary ───────────────────────────────────────────

export function useDisciplinary(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.disciplinary.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/disciplinary', { params: filters }),
    ...opts,
  });
}

// ─── Grievances ─────────────────────────────────────────────

export function useGrievances(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.grievances.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/grievances', { params: filters }),
    ...opts,
  });
}

// ─── Safety ─────────────────────────────────────────────────

export function useSafety(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.safety.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/safety', { params: filters }),
    ...opts,
  });
}

// ─── Analytics ──────────────────────────────────────────────

export function useAnalytics(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.analytics.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/analytics', { params: filters }),
    ...opts,
  });
}

// ─── Reports ────────────────────────────────────────────────

export function useReports(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.reports.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/reports', { params: filters }),
    ...opts,
  });
}

// ─── Report Engine ──────────────────────────────────────────

export function useReportEngine(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.reportEngine.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/report-engine', { params: filters }),
    ...opts,
  });
}

// ─── Dashboards ─────────────────────────────────────────────

export function useDashboards(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.dashboards.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/dashboards', { params: filters }),
    ...opts,
  });
}

export function useDashboardSummary(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.dashboard.summary(),
    queryFn: () => cvisionFetch('/api/cvision/dashboard/summary'),
    ...opts,
  });
}

// ─── Surveys ────────────────────────────────────────────────

export function useSurveys(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.surveys.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/surveys', { params: filters }),
    ...opts,
  });
}

// ─── Housing ────────────────────────────────────────────────

export function useHousing(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.housing.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/housing', { params: filters }),
    ...opts,
  });
}

// ─── Transport ──────────────────────────────────────────────

export function useTransport(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.transport.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/transport', { params: filters }),
    ...opts,
  });
}

// ─── Travel ─────────────────────────────────────────────────

export function useTravel(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.travel.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/travel', { params: filters }),
    ...opts,
  });
}

// ─── Cafeteria ──────────────────────────────────────────────

export function useCafeteria(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.cafeteria.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/meals', { params: filters }),
    ...opts,
  });
}

// ─── Wellness ───────────────────────────────────────────────

export function useWellness(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.wellness.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/wellness', { params: filters }),
    ...opts,
  });
}

// ─── Assets ─────────────────────────────────────────────────

export function useAssets(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.assets.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/assets', { params: filters }),
    ...opts,
  });
}

// ─── Paycards ───────────────────────────────────────────────

export function usePaycards(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.paycards.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/paycards', { params: filters }),
    ...opts,
  });
}

// ─── Engagement ─────────────────────────────────────────────

export function useEngagement(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.engagement.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/engagement', { params: filters }),
    ...opts,
  });
}

// ─── Culture ────────────────────────────────────────────────

export function useCulture(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.culture.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/culture', { params: filters }),
    ...opts,
  });
}

// ─── Recognition ────────────────────────────────────────────

export function useRecognition(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.recognition.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/recognition', { params: filters }),
    ...opts,
  });
}

// ─── Rewards ────────────────────────────────────────────────

export function useRewards(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.rewards.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/rewards', { params: filters }),
    ...opts,
  });
}

// ─── Retention ──────────────────────────────────────────────

export function useRetention(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.retention.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/retention', { params: filters }),
    ...opts,
  });
}

// ─── Compensation ───────────────────────────────────────────

export function useCompensation(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.compensation.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/compensation', { params: filters }),
    ...opts,
  });
}

// ─── Promotions ─────────────────────────────────────────────

export function usePromotions(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.promotions.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/promotions', { params: filters }),
    ...opts,
  });
}

// ─── Manpower ───────────────────────────────────────────────

export function useManpower(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.manpower.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/manpower/summary', { params: filters }),
    ...opts,
  });
}

// ─── Headcount ──────────────────────────────────────────────

export function useHeadcount(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.headcount.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/headcount', { params: filters }),
    ...opts,
  });
}

// ─── Succession ─────────────────────────────────────────────

export function useSuccession(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.succession.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/succession', { params: filters }),
    ...opts,
  });
}

// ─── Strategic Alignment ────────────────────────────────────

export function useStrategicAlignment(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.strategicAlignment.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/strategic-alignment', { params: filters }),
    ...opts,
  });
}

// ─── Org Design ─────────────────────────────────────────────

export function useOrgDesign(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.orgDesign.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/org-design', { params: filters }),
    ...opts,
  });
}

// ─── Org Health ─────────────────────────────────────────────

export function useOrgHealth(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.orgHealth.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/org-health', { params: filters }),
    ...opts,
  });
}

// ─── Change Management ──────────────────────────────────────

export function useChangeManagement(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.changeManagement.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/change-management', { params: filters }),
    ...opts,
  });
}

// ─── Segments ───────────────────────────────────────────────

export function useSegments(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.segments.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/segments', { params: filters }),
    ...opts,
  });
}

// ─── Directory ──────────────────────────────────────────────

export function useDirectory(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.directory.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/directory', { params: filters }),
    ...opts,
  });
}

// ─── Teams ──────────────────────────────────────────────────

export function useTeams(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.teams.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/teams', { params: filters }),
    ...opts,
  });
}

// ─── Jobs (Public) ──────────────────────────────────────────

export function useJobs(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.jobs.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/jobs', { params: filters }),
    ...opts,
  });
}

// ─── Onboarding ─────────────────────────────────────────────

export function useOnboarding(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.onboarding.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/onboarding', { params: filters }),
    ...opts,
  });
}

// ─── Integrations ───────────────────────────────────────────

export function useIntegrations(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.integrations.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/integrations', { params: filters }),
    ...opts,
  });
}

export function useIntegrationsManager(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.integrationsManager.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/integrations-mgr', { params: filters }),
    ...opts,
  });
}

// ─── Calendar ───────────────────────────────────────────────

export function useCalendar(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.calendar.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/calendar', { params: filters }),
    ...opts,
  });
}

// ─── Bookings ───────────────────────────────────────────────

export function useBookings(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.bookings.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/bookings', { params: filters }),
    ...opts,
  });
}

// ─── Communications ─────────────────────────────────────────

export function useCommunications(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.communications.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/communications', { params: filters }),
    ...opts,
  });
}

// ─── Company Policies ───────────────────────────────────────

export function useCompanyPolicies(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.companyPolicies.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/company-policies', { params: filters }),
    ...opts,
  });
}

// ─── Investigations ─────────────────────────────────────────

export function useInvestigations(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.investigations.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/investigations', { params: filters }),
    ...opts,
  });
}

// ─── Data Quality ───────────────────────────────────────────

export function useDataQuality(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.dataQuality.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/data-quality', { params: filters }),
    ...opts,
  });
}

// ─── Diagnostics ────────────────────────────────────────────

export function useDiagnostics(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.diagnostics.list(),
    queryFn: () => cvisionFetch('/api/cvision/diagnostics'),
    ...opts,
  });
}

// ─── Predictive ─────────────────────────────────────────────

export function usePredictive(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.predictive.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/predictive', { params: filters }),
    ...opts,
  });
}

// ─── What-If ────────────────────────────────────────────────

export function useWhatIf(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.whatif.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/analytics/what-if', { params: filters }),
    ...opts,
  });
}

// ─── Admin Settings ─────────────────────────────────────────

export function useAdminSettings(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.admin.settings.list(),
    queryFn: () => cvisionFetch('/api/cvision/admin/settings'),
    ...opts,
  });
}

// ─── Webhooks ───────────────────────────────────────────────

export function useWebhooks(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.admin.webhooks.list(),
    queryFn: () => cvisionFetch('/api/cvision/admin/webhooks'),
    ...opts,
  });
}

// ─── Workflows ──────────────────────────────────────────────

export function useWorkflows(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.workflows.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/workflows', { params: filters }),
    ...opts,
  });
}

// ─── Documents ──────────────────────────────────────────────

export function useDocuments(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.documents.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/files', { params: filters }),
    ...opts,
  });
}

// ─── Org Tree ───────────────────────────────────────────────

export function useOrgTree(opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.org.tree(),
    queryFn: () => cvisionFetch('/api/cvision/org/tree'),
    ...opts,
  });
}

// ─── Audit Log ──────────────────────────────────────────────

export function useAuditLog(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.auditLog.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/audit-log', { params: filters }),
    ...opts,
  });
}

// ─── AI ─────────────────────────────────────────────────────

export function useAISkills(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.ai.skills.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/ai/skills', { params: filters }),
    ...opts,
  });
}

export function useAIGovernance(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.ai.governance.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/ai/governance', { params: filters }),
    ...opts,
  });
}

// ─── Muqeem ─────────────────────────────────────────────────

export function useMuqeem(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: ['cvision', 'muqeem', filters ?? {}],
    queryFn: () => cvisionFetch('/api/cvision/muqeem', { params: filters }),
    ...opts,
  });
}

// ─── Dashboard Builder ──────────────────────────────────────

export function useDashboardBuilder(filters?: Record<string, any>, opts?: QueryOpts<any>) {
  return useQuery({
    queryKey: cvisionKeys.dashboards.list(filters),
    queryFn: () => cvisionFetch('/api/cvision/dashboards', { params: filters }),
    ...opts,
  });
}

// ─── Generic mutation helper ────────────────────────────────

export function useCVisionMutation<TData = any, TVariables = any>(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  invalidateKeys?: readonly any[],
  opts?: Omit<UseMutationOptions<TData, CVisionApiError, TVariables>, 'mutationFn'>
) {
  const qc = useQueryClient();
  return useMutation<TData, CVisionApiError, TVariables>({
    mutationFn: (variables) => cvisionMutate<TData>(url, method, variables),
    onSuccess: (...args) => {
      if (invalidateKeys) qc.invalidateQueries({ queryKey: invalidateKeys as string[] });
      opts?.onSuccess?.(...args);
    },
    ...opts,
  });
}
