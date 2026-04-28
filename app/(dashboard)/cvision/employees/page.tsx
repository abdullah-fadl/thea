'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Download, Upload, LayoutGrid, List, Loader2, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionInput, CVisionSelect, CVisionSkeletonCard , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { getDeptColor, getDeptBgLight, getDeptTextColor, getStatusColor } from '@/lib/cvision/department-colors';
import StatsBar, { computeStats } from './_components/StatsBar';
import EmployeeCard from './_components/EmployeeCard';
import EmployeeRow from './_components/EmployeeRow';
import EmptyState from './_components/EmptyState';
import AddEmployeeDialog from './_components/AddEmployeeDialog';
import type { EmployeeListItem, DepartmentRef, JobTitleRef, UnitRef, ViewMode, SortOption } from './_components/types';

export default function EmployeesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [deptFilter, setDeptFilter] = useState<string>('');

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cvision-employees-view');
    if (saved === 'grid' || saved === 'list') setViewMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('cvision-employees-view', viewMode);
  }, [viewMode]);

  // Build status params
  const statusesParam = statusFilter === 'active' ? 'ACTIVE,PROBATION'
    : statusFilter === 'inactive' ? 'RESIGNED,TERMINATED'
    : statusFilter === 'all' ? undefined
    : statusFilter;

  const empFilters = { search: search || undefined, statuses: statusesParam, departmentId: deptFilter || undefined };

  const { data: empData, isLoading: empLoading, refetch: refetchEmployees } = useQuery({
    queryKey: cvisionKeys.employees.list(empFilters),
    queryFn: () => cvisionFetch<any>('/api/cvision/employees', { params: empFilters }),
  });

  const { data: deptData } = useQuery({
    queryKey: cvisionKeys.departments.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/org/departments'),
  });

  const { data: jobData } = useQuery({
    queryKey: cvisionKeys.jobTitles.list({ limit: 1000 }),
    queryFn: () => cvisionFetch<any>('/api/cvision/job-titles', { params: { limit: 1000 } }),
  });

  const { data: unitData } = useQuery({
    queryKey: cvisionKeys.units.list({ isActive: true }),
    queryFn: () => cvisionFetch<any>('/api/cvision/units', { params: { isActive: true } }),
  });

  const employees: EmployeeListItem[] = empData?.data?.items || empData?.data || [];
  const meta = empData?.meta || null;
  const depts = deptData?.items ?? deptData?.data ?? deptData ?? [];
  const departments: DepartmentRef[] = Array.isArray(depts) ? depts : [];
  const jobs = jobData?.items ?? jobData?.data ?? jobData ?? [];
  const jobTitles: JobTitleRef[] = Array.isArray(jobs) ? jobs : [];
  const unitsArr = unitData?.items ?? unitData?.data ?? unitData ?? [];
  const units: UnitRef[] = Array.isArray(unitsArr) ? unitsArr : [];
  const loading = empLoading;

  useEffect(() => {
    const handleRefresh = () => refetchEmployees();
    window.addEventListener('cvision:refresh-dashboard', handleRefresh);
    return () => window.removeEventListener('cvision:refresh-dashboard', handleRefresh);
  }, [refetchEmployees]);

  function getDepartmentName(id: string): string | null {
    if (!id || !Array.isArray(departments) || departments.length === 0) return null;
    const dept = departments.find(d => d.id === id);
    return dept ? dept.name + (dept.code ? ` (${dept.code})` : '') : null;
  }

  function getJobTitleName(id: string): string | null {
    if (!id || !Array.isArray(jobTitles) || jobTitles.length === 0) return null;
    const jt = jobTitles.find(j => j.id === id);
    return jt ? (jt.name || jt.title || '') + (jt.code ? ` (${jt.code})` : '') : null;
  }

  const sortedEmployees = useMemo(() => {
    const sorted = [...employees];
    switch (sortBy) {
      case 'name_asc':
        sorted.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
        break;
      case 'name_desc':
        sorted.sort((a, b) => `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`));
        break;
      case 'hire_date_asc':
        sorted.sort((a, b) => new Date(a.hiredAt || a.hireDate || 0).getTime() - new Date(b.hiredAt || b.hireDate || 0).getTime());
        break;
      case 'hire_date_desc':
        sorted.sort((a, b) => new Date(b.hiredAt || b.hireDate || 0).getTime() - new Date(a.hiredAt || a.hireDate || 0).getTime());
        break;
      case 'department':
        sorted.sort((a, b) => (getDepartmentName(a.departmentId) || '').localeCompare(getDepartmentName(b.departmentId) || ''));
        break;
      case 'status':
        sorted.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
        break;
    }
    return sorted;
  }, [employees, sortBy, departments]);

  const stats = useMemo(() => computeStats(employees, departments), [employees, departments]);

  function handleQuickAction(emp: EmployeeListItem, action: string) {
    switch (action) {
      case 'view-profile': router.push(`/cvision/employees/${emp.id}`); break;
      case 'edit-details': router.push(`/cvision/employees/${emp.id}?edit=true`); break;
      case 'change-status': router.push(`/cvision/employees/${emp.id}?changeStatus=true`); break;
      case 'view-payroll': router.push(`/cvision/payroll/profiles?employeeId=${emp.id}`); break;
      case 'view-attendance': router.push(`/cvision/attendance?employeeId=${emp.id}`); break;
      case 'terminate': router.push(`/cvision/employees/${emp.id}?changeStatus=true&target=TERMINATED`); break;
    }
  }

  const hasFilters = !!search || statusFilter !== 'active' || !!deptFilter;

  function clearFilters() {
    setSearch('');
    setStatusFilter('active');
    setDeptFilter('');
  }

  const statusOptions = [
    { value: 'active', label: tr('نشط وتجربة', 'Active & Probation') },
    { value: 'all', label: tr('جميع الحالات', 'All Statuses') },
    { value: 'ACTIVE', label: tr('نشط فقط', 'Active Only') },
    { value: 'PROBATION', label: tr('تجربة فقط', 'Probation Only') },
    { value: 'inactive', label: tr('مستقيل ومنتهي', 'Resigned & Terminated') },
    { value: 'RESIGNED', label: tr('مستقيل', 'Resigned') },
    { value: 'TERMINATED', label: tr('منتهي الخدمة', 'Terminated') },
  ];

  const sortOptions = [
    { value: 'name_asc', label: tr('الاسم أ-ي', 'Name A-Z') },
    { value: 'name_desc', label: tr('الاسم ي-أ', 'Name Z-A') },
    { value: 'hire_date_desc', label: tr('الأحدث أولاً', 'Newest First') },
    { value: 'hire_date_asc', label: tr('الأقدم أولاً', 'Oldest First') },
    { value: 'department', label: tr('حسب القسم', 'By Department') },
    { value: 'status', label: tr('حسب الحالة', 'By Status') },
  ];

  const deptOptions = [
    { value: 'all', label: tr('جميع الأقسام', 'All Departments') },
    ...departments.map(d => ({ value: d.id, label: d.name })),
  ];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>
            {tr('الفريق', 'Team')}
          </h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {loading ? '...' : `${employees.length} ${tr('عضو فريق', 'team member')}${!isRTL && employees.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/cvision/employees/lifecycle">
            <CVisionButton C={C} isDark={isDark} variant="outline" icon={<UserCog style={{ width: 16, height: 16 }} />}>
              {tr('دورة الحياة', 'Lifecycle')}
            </CVisionButton>
          </Link>
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={<Plus style={{ width: 16, height: 16 }} />} onClick={() => setDialogOpen(true)}>
            {tr('إضافة موظف', 'Add Employee')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="outline" icon={<Download style={{ width: 16, height: 16 }} />} title={tr('تصدير', 'Export')} />
          <CVisionButton C={C} isDark={isDark} variant="outline" icon={<Upload style={{ width: 16, height: 16 }} />} title={tr('استيراد', 'Import')} />
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats} loading={loading} />

      {/* Filters & Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: isRTL ? 'auto' : 12, right: isRTL ? 12 : 'auto', top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.textMuted }} />
          <CVisionInput
            C={C}
            placeholder={tr('بحث بالاسم، البريد، أو رقم الموظف...', 'Search by name, email, or employee number...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: isRTL ? 12 : 36, paddingRight: isRTL ? 36 : 12 }}
          />
        </div>

        {/* View Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
          <button
            style={{
              width: 36, height: 36, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: viewMode === 'grid' ? C.gold : 'transparent',
              color: viewMode === 'grid' ? '#fff' : C.textMuted,
            }}
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid style={{ width: 16, height: 16 }} />
          </button>
          <button
            style={{
              width: 36, height: 36, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: viewMode === 'list' ? C.gold : 'transparent',
              color: viewMode === 'list' ? '#fff' : C.textMuted,
            }}
            onClick={() => setViewMode('list')}
          >
            <List style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Department Filter */}
        <CVisionSelect
          C={C}
          value={deptFilter || 'all'}
          onChange={v => setDeptFilter(v === 'all' ? '' : v)}
          options={deptOptions}
          style={{ width: 160, flexShrink: 0 }}
        />

        {/* Status Filter */}
        <CVisionSelect
          C={C}
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          style={{ width: 160, flexShrink: 0 }}
        />

        {/* Sort */}
        <CVisionSelect
          C={C}
          value={sortBy}
          onChange={v => setSortBy(v as SortOption)}
          options={sortOptions}
          style={{ width: 150, flexShrink: 0 }}
        />
      </div>

      {/* Content */}
      {loading ? (
        viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <CVisionSkeletonCard key={i} C={C} height={280} />
            ))}
          </div>
        ) : (
          <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <CVisionSkeletonCard key={i} C={C} height={56} />
            ))}
          </div>
        )
      ) : sortedEmployees.length === 0 ? (
        <EmptyState
          onAddEmployee={() => setDialogOpen(true)}
          onClearFilters={hasFilters ? clearFilters : undefined}
          hasFilters={hasFilters}
        />
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {sortedEmployees.map((emp, i) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              index={i}
              departmentName={getDepartmentName(emp.departmentId)}
              jobTitleName={getJobTitleName(emp.jobTitleId)}
              deptColor={getDeptColor(emp.departmentId)}
              deptBgLight={getDeptBgLight(emp.departmentId)}
              deptTextColor={getDeptTextColor(emp.departmentId)}
              statusColorClass={getStatusColor(emp.status)}
              onClick={() => router.push(`/cvision/employees/${emp.id}`)}
              onQuickAction={(action) => handleQuickAction(emp, action)}
            />
          ))}
        </div>
      ) : (
        <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '10px 12px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted, width: 280 }}>
                  {tr('الموظف', 'Employee')}
                </th>
                <th style={{ padding: '10px 12px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted }}>
                  {tr('القسم', 'Department')}
                </th>
                <th style={{ padding: '10px 12px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted }}>
                  {tr('الحالة', 'Status')}
                </th>
                <th style={{ padding: '10px 12px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted }}>
                  {tr('تاريخ التعيين', 'Hire Date')}
                </th>
                <th style={{ padding: '10px 12px', textAlign: isRTL ? 'right' : 'left', fontSize: 12, fontWeight: 500, color: C.textMuted, width: 100 }}>
                  {tr('الإجراءات', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map(emp => (
                <EmployeeRow
                  key={emp.id}
                  employee={emp}
                  departmentName={getDepartmentName(emp.departmentId)}
                  jobTitleName={getJobTitleName(emp.jobTitleId)}
                  deptColor={getDeptColor(emp.departmentId)}
                  deptBgLight={getDeptBgLight(emp.departmentId)}
                  deptTextColor={getDeptTextColor(emp.departmentId)}
                  statusColorClass={getStatusColor(emp.status)}
                  onClick={() => router.push(`/cvision/employees/${emp.id}`)}
                  onQuickAction={(action) => handleQuickAction(emp, action)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Employee Dialog */}
      <AddEmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        departments={departments}
        onSuccess={() => refetchEmployees()}
      />
    </div>
  );
}
