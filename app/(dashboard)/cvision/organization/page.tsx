'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { useConfirm } from '@/components/ui/confirm-modal';
import { CVisionBadge, CVisionButton, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import { useToast } from '@/hooks/use-toast';
import {
  Plus, Search, Building2, Briefcase, GitBranch, Loader2,
  MapPin, Phone, Users, Clock, Star, Edit, Eye, UserPlus, Trash2, Mail, FileText, Globe,
} from 'lucide-react';

import type { CVisionBranch } from '@/lib/cvision/org/branch-manager';
import { useDevMode } from '@/lib/dev-mode';

import OrgStatsBar from './_components/StatsBar';
import DepartmentCard from './_components/DepartmentCard';
import OrgChart from './_components/OrgChart';
import JobTitlesTable from './_components/JobTitlesTable';
import AddDepartmentDialog from './_components/AddDepartmentDialog';
import { computeOrgStats } from './_components/types';
import type {
  Department, Unit, JobTitle, Grade, Position, EmployeeOption,
  OrgTab, DeptFormData, UnitFormData, JobTitleFormData, GradeFormData, PositionFormData,
} from './_components/types';
import { Checkbox } from '@/components/ui/checkbox';

export default function OrganizationPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const { confirm } = useConfirm();

  const isDev = useDevMode();
  // ── Data state ──
  const [departments, setDepartments] = useState<Department[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [saving, setSaving] = useState(false);

  // ── UI state ──
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<OrgTab>('departments');
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);

  // ── Employee caches ──
  const [deptEmployees, setDeptEmployees] = useState<Record<string, EmployeeOption[]>>({});
  const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);

  // ── Branches ──
  const [branches, setBranches] = useState<CVisionBranch[]>([]);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<CVisionBranch | null>(null);
  const [branchManagerDialogOpen, setBranchManagerDialogOpen] = useState(false);
  const [branchForManager, setBranchForManager] = useState<CVisionBranch | null>(null);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const { toast } = useToast();

  // ── Stats ──
  const stats = useMemo(
    () => computeOrgStats(departments, units, jobTitles, positions),
    [departments, units, jobTitles, positions],
  );

  // ── Data fetching via React Query ──
  const archivedParams = showArchived ? { includeArchived: '1' } : {};
  const archivedDeletedParams = showArchived ? { includeDeleted: '1' } : {};

  const { data: deptRaw, isLoading: deptLoading, refetch: refetchDepts } = useQuery({
    queryKey: cvisionKeys.departments.list({ showArchived }),
    queryFn: () => cvisionFetch('/api/cvision/org/departments', { params: archivedParams }),
  });
  useEffect(() => { const depts = deptRaw?.items ?? deptRaw?.data ?? []; setDepartments(Array.isArray(depts) ? depts : []); }, [deptRaw]);

  const { data: unitRaw, refetch: refetchUnits } = useQuery({
    queryKey: cvisionKeys.units.list({ showArchived }),
    queryFn: () => cvisionFetch(showArchived ? '/api/cvision/org/units?includeArchived=1' : '/api/cvision/org/units'),
  });
  useEffect(() => { setUnits(unitRaw?.items || []); }, [unitRaw]);

  const { data: jtRaw, refetch: refetchJT } = useQuery({
    queryKey: cvisionKeys.jobTitles.list({ limit: 1000, showArchived }),
    queryFn: () => cvisionFetch('/api/cvision/job-titles', { params: { limit: 1000, ...archivedDeletedParams } }),
  });
  useEffect(() => { setJobTitles(jtRaw?.data || jtRaw?.items || []); }, [jtRaw]);

  const { data: gradeRaw, refetch: refetchGrades } = useQuery({
    queryKey: cvisionKeys.grades.list({ limit: 1000, showArchived }),
    queryFn: () => cvisionFetch('/api/cvision/grades', { params: { limit: 1000, ...archivedDeletedParams } }),
  });
  useEffect(() => { setGrades(gradeRaw?.data || gradeRaw?.items || []); }, [gradeRaw]);

  const { data: posRaw, refetch: refetchPos } = useQuery({
    queryKey: cvisionKeys.org.budgetedPositions.list({ limit: 1000, showArchived }),
    queryFn: () => cvisionFetch('/api/cvision/org/budgeted-positions', { params: { limit: 1000, ...(showArchived ? { includeInactive: '1' } : {}) } }),
  });
  useEffect(() => { if (posRaw?.success) setPositions(posRaw.data || posRaw.items || []); }, [posRaw]);

  const { data: branchRaw, refetch: refetchBranches } = useQuery({
    queryKey: cvisionKeys.branches.list({ action: 'list', showArchived }),
    queryFn: () => cvisionFetch('/api/cvision/branches', { params: { action: 'list', ...(showArchived ? { includeInactive: '1' } : {}) } }),
  });
  useEffect(() => { setBranches(branchRaw?.data?.items || branchRaw?.data || []); }, [branchRaw]);

  const loading = deptLoading;

  const loadData = useCallback(async () => {
    await Promise.all([refetchDepts(), refetchUnits(), refetchJT(), refetchGrades(), refetchPos(), refetchBranches()]);
  }, [refetchDepts, refetchUnits, refetchJT, refetchGrades, refetchPos, refetchBranches]);

  // ── Filter helpers ──
  const filteredDepartments = useMemo(() => {
    return departments.filter(d => {
      const matchesArchived = showArchived || !d.isArchived;
      const matchesSearch = !searchTerm ||
        d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.nameAr && d.nameAr.includes(searchTerm));
      return matchesArchived && matchesSearch;
    });
  }, [departments, showArchived, searchTerm]);

  function getUnitsForDepartment(deptId: string) {
    return units.filter(u => u.departmentId === deptId && (showArchived || !u.isArchived));
  }

  function getJobTitlesForDepartment(deptId: string) {
    return jobTitles.filter(jt => {
      if (jt.departmentId !== deptId) return false;
      if (!showArchived && jt.isArchived) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return jt.name.toLowerCase().includes(q) || jt.code.toLowerCase().includes(q);
    });
  }

  function getUnassignedJobTitles(deptId: string) {
    return jobTitles.filter(jt => {
      if (jt.departmentId !== deptId || jt.unitId) return false;
      if (!showArchived && jt.isArchived) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return jt.name.toLowerCase().includes(q) || jt.code.toLowerCase().includes(q);
    });
  }

  // ── Employee loading ──
  async function loadEmployeesForDept(departmentId: string) {
    if (deptEmployees[departmentId]) return;
    try {
      const res = await fetch(`/api/cvision/employees?departmentId=${departmentId}&limit=200`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const items = data.data || data.items || [];
        setDeptEmployees(prev => ({ ...prev, [departmentId]: items }));
      }
    } catch {
      // silently ignore
    }
  }

  async function loadAllEmployees() {
    if (allEmployees.length > 0) return;
    try {
      const res = await fetch('/api/cvision/employees?limit=200', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAllEmployees(data.data || data.items || []);
      }
    } catch {
      // silently ignore
    }
  }

  // ── CRUD functions ──
  async function createDepartment(form: DeptFormData) {
    if (!form.name || !form.code) {
      toast({ title: tr('خطأ في التحقق', 'Validation Error'), description: tr('الرمز والاسم مطلوبان', 'Code and Name are required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/cvision/org/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ ...form, managerId: form.managerId || null }),
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        await loadData();
        setDeptDialogOpen(false);
        toast({ title: tr('نجاح', 'Success'), description: tr('تم إنشاء القسم', 'Department created') });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create department', variant: 'destructive' });
      }
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') { toast({ title: 'Error', description: 'Request timed out', variant: 'destructive' }); return; }
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function createUnit(departmentId: string, form: UnitFormData) {
    if (!form.name || !form.code) {
      toast({ title: tr('خطأ في التحقق', 'Validation Error'), description: tr('الرمز والاسم مطلوبان', 'Code and Name are required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/cvision/org/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ ...form, departmentId, managerId: form.managerId || null }),
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        await loadData();
        toast({ title: tr('نجاح', 'Success'), description: tr('تم إنشاء الوحدة', 'Unit created') });
      } else {
        toast({ title: 'Error', description: data.message || data.error || 'Failed to create unit', variant: 'destructive' });
      }
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') { toast({ title: 'Error', description: 'Request timed out', variant: 'destructive' }); return; }
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function archiveUnit(unitId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/cvision/org/units/${unitId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await loadData();
        toast({ title: tr('نجاح', 'Success'), description: tr('تم أرشفة الوحدة', 'Unit archived') });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.message || 'Failed to archive unit', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function createJobTitle(departmentId: string, unitId: string | undefined, form: JobTitleFormData) {
    if (!form.name || !form.code) {
      toast({ title: tr('خطأ في التحقق', 'Validation Error'), description: tr('الرمز والاسم مطلوبان', 'Code and Name are required'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/cvision/job-titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...form, departmentId, unitId: unitId || null, isActive: true }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        toast({ title: tr('نجاح', 'Success'), description: tr('تم إنشاء المسمى الوظيفي', 'Job title created') });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to create job title', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function createOrLinkGrade(jobTitleId: string, gradeForm: GradeFormData, existingGradeId: string) {
    setSaving(true);
    try {
      if (existingGradeId && existingGradeId !== 'new') {
        const res = await fetch(`/api/cvision/grades/${existingGradeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ jobTitleId }),
        });
        const data = await res.json();
        if (res.ok) {
          toast({ title: tr('نجاح', 'Success'), description: tr('تم ربط الدرجة', 'Grade linked to job title') });
        } else {
          toast({ title: 'Error', description: data.error || 'Failed to link grade', variant: 'destructive' });
        }
      } else {
        if (!gradeForm.name || !gradeForm.code) {
          toast({ title: tr('خطأ في التحقق', 'Validation Error'), description: tr('الرمز والاسم مطلوبان', 'Code and Name are required'), variant: 'destructive' });
          setSaving(false);
          return;
        }
        const res = await fetch('/api/cvision/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...gradeForm, jobTitleId }),
        });
        const data = await res.json();
        if (data.success) {
          toast({ title: tr('نجاح', 'Success'), description: tr('تم إنشاء الدرجة', 'Grade created') });
        } else {
          toast({ title: 'Error', description: data.error, variant: 'destructive' });
        }
      }
      await loadData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function createPosition(jobTitleId: string, departmentId: string, unitId: string | null | undefined, form: PositionFormData) {
    if (form.budgetedHeadcount < 1) {
      toast({ title: tr('خطأ في التحقق', 'Validation Error'), description: tr('العدد المخطط يجب أن يكون 1 على الأقل', 'Budgeted headcount must be at least 1'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/cvision/org/budgeted-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobTitleId,
          departmentId,
          unitId: unitId || null,
          gradeId: form.gradeId || null,
          title: form.title || null,
          budgetedHeadcount: form.budgetedHeadcount,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
        toast({ title: tr('نجاح', 'Success'), description: tr('تم إنشاء الوظيفة', 'Position created') });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>{tr('الهيكل التنظيمي', 'Organization Structure')}</h1>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {tr('إدارة الأقسام والوحدات والمسميات الوظيفية والدرجات', 'Manage departments, units, job titles, and grades')}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <Checkbox
              checked={showArchived}
              onCheckedChange={(checked) => setShowArchived(checked === true)}
            />
            <span>{tr('عرض المؤرشف', 'Show archived')}</span>
          </label>
          <CVisionButton C={C} isDark={isDark} onClick={() => setDeptDialogOpen(true)}>
            <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
            {tr('إضافة قسم', 'Add Department')}
          </CVisionButton>
        </div>
      </div>

      {/* Stats Bar */}
      <OrgStatsBar stats={stats} loading={loading} />

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted }} />
        <CVisionInput C={C}
          placeholder={tr('بحث الأقسام والمسميات الوظيفية...', 'Search departments, job titles...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ paddingLeft: 40, borderRadius: '50%' }}
        />
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={(v) => setActiveTab(v as OrgTab)}
        tabs={[
          { id: 'departments', label: tr('الأقسام', 'Departments'), icon: <Building2 style={{ height: 16, width: 16 }} /> },
          { id: 'org-chart', label: tr('الهيكل التنظيمي', 'Org Chart'), icon: <GitBranch style={{ height: 16, width: 16 }} /> },
          { id: 'branches', label: tr('الفروع', 'Branches'), icon: <MapPin style={{ height: 16, width: 16 }} /> },
          { id: 'job-titles', label: tr('المسميات والدرجات', 'Job Titles & Grades'), icon: <Briefcase style={{ height: 16, width: 16 }} /> },
        ]}
      >
        {/* Tab 1: Departments */}
        <CVisionTabContent tabId="departments">
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <CVisionSkeletonCard C={C} height={200} key={i} style={{ borderRadius: 16 }}  />
              ))}
            </div>
          ) : filteredDepartments.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
              <Building2 style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontWeight: 500 }}>{tr('لا توجد أقسام', 'No departments found')}</p>
              <p style={{ fontSize: 13 }}>
                {searchTerm
                  ? tr('حاول تعديل البحث.', tr('حاول تعديل البحث.', 'Try adjusting your search.'))
                  : tr('أنشئ أول قسم للبدء.', tr('أنشئ أول قسم للبدء.', 'Create your first department to get started.'))}
              </p>
              {!searchTerm && (
                <CVisionButton C={C} isDark={isDark} style={{ marginTop: 16 }} onClick={() => setDeptDialogOpen(true)}>
                  <Plus style={{ height: 16, width: 16, marginRight: 8 }} />{tr('إضافة قسم', 'Add Department')}
                </CVisionButton>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              {filteredDepartments.map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  department={dept}
                  units={getUnitsForDepartment(dept.id)}
                  jobTitles={getJobTitlesForDepartment(dept.id)}
                  unassignedJobTitles={getUnassignedJobTitles(dept.id)}
                  grades={grades}
                  positions={positions}
                  employees={deptEmployees[dept.id] || []}
                  allEmployees={allEmployees}
                  showArchived={showArchived}
                  saving={saving}
                  onCreateUnit={createUnit}
                  onArchiveUnit={archiveUnit}
                  onCreateJobTitle={createJobTitle}
                  onCreateOrLinkGrade={createOrLinkGrade}
                  onCreatePosition={createPosition}
                  onLoadEmployees={loadEmployeesForDept}
                />
              ))}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* Tab 2: Org Chart */}
        <CVisionTabContent tabId="org-chart">
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64 }}>
              <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.textMuted }} />
            </div>
          ) : (
            <OrgChart
              departments={filteredDepartments}
              units={units}
              jobTitles={jobTitles}
              positions={positions}
              allEmployees={allEmployees}
              deptEmployees={deptEmployees}
              showArchived={showArchived}
            />
          )}
        </div>
        </CVisionTabContent>

        {/* Tab: Branches */}
        <CVisionTabContent tabId="branches">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>{branches.length} {tr('فرع', 'branch')}{!isRTL && branches.length !== 1 ? 'es' : ''}</p>
            <CVisionButton C={C} isDark={isDark} onClick={() => { setEditingBranch(null); setBranchDialogOpen(true); }}>
              <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
              {tr('إضافة فرع', 'Add Branch')}
            </CVisionButton>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              {Array.from({ length: 2 }).map((_, i) => (
                <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 224, borderRadius: 16 }}  />
              ))}
            </div>
          ) : branches.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
              <MapPin style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontWeight: 500 }}>{tr('لا توجد فروع بعد', 'No branches yet')}</p>
              <p style={{ fontSize: 13 }}>{tr('أنشئ أول فرع', 'Create your first branch')}{isDev ? tr(' أو أنشئ مقر رئيسي افتراضي', ' or seed a default HQ') : ''}.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <CVisionButton C={C} isDark={isDark} onClick={() => { setEditingBranch(null); setBranchDialogOpen(true); }}>
                  <Plus style={{ height: 16, width: 16, marginRight: 8 }} />{tr('إضافة فرع', 'Add Branch')}
                </CVisionButton>
                {isDev && (
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={async () => {
                    try {
                      const res = await fetch('/api/cvision/branches', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'seed' }),
                      });
                      if (res.ok) { await loadData(); toast({ title: tr('تم إنشاء المقر الرئيسي', 'Default HQ created') }); }
                    } catch { /* ignore */ }
                  }}>
                    {tr('إنشاء مقر رئيسي', 'Seed Default HQ')}
                  </CVisionButton>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              {branches.map(branch => (
                <BranchCard
                  key={branch.id}
                  branch={branch}
                  onEdit={() => { setEditingBranch(branch); setBranchDialogOpen(true); }}
                  onAssignManager={() => { setBranchForManager(branch); setSelectedManagerId(branch.branchManager || ''); setBranchManagerDialogOpen(true); }}
                  onDelete={async () => {
                    if (!(await confirm(tr(`تعطيل "${branch.name}"؟`, `Deactivate "${branch.name}"?`)))) return;
                    try {
                      const res = await fetch('/api/cvision/branches', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'delete', id: branch.id }),
                      });
                      const data = await res.json();
                      if (!res.ok) { toast({ title: 'Error', description: data.error, variant: 'destructive' }); return; }
                      await loadData();
                      toast({ title: tr('تم تعطيل الفرع', 'Branch deactivated') });
                    } catch (e: any) { toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' }); }
                  }}
                  onSetHQ={async () => {
                    try {
                      for (const b of branches) {
                        if (b.isHeadquarters && b.id !== branch.id) {
                          await fetch('/api/cvision/branches', {
                            method: 'POST', credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'update', id: b.id, isHeadquarters: false }),
                          });
                        }
                      }
                      await fetch('/api/cvision/branches', {
                        method: 'POST', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'update', id: branch.id, isHeadquarters: true }),
                      });
                      await loadData();
                      toast({ title: `${branch.name} set as HQ` });
                    } catch { /* ignore */ }
                  }}
                />
              ))}
            </div>
          )}
        </CVisionTabContent>

        {/* Tab 3: Job Titles & Grades */}
        <CVisionTabContent tabId="job-titles">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 40, borderRadius: '50%', width: '100%' }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ borderRadius: 16 }}  />
            </div>
          ) : (
            <JobTitlesTable
              jobTitles={jobTitles}
              grades={grades}
              positions={positions}
              departments={departments}
              showArchived={showArchived}
              saving={saving}
              onCreateJobTitle={createJobTitle}
              onCreateOrLinkGrade={createOrLinkGrade}
              onCreatePosition={createPosition}
            />
          )}
        </CVisionTabContent>
      </CVisionTabs>

      {/* Page-level Add Department Dialog */}
      <AddDepartmentDialog
        open={deptDialogOpen}
        onOpenChange={setDeptDialogOpen}
        saving={saving}
        allEmployees={allEmployees}
        onLoadAllEmployees={loadAllEmployees}
        onSubmit={createDepartment}
      />

      {/* Branch Add/Edit Dialog */}
      <BranchFormDialog
        open={branchDialogOpen}
        onOpenChange={setBranchDialogOpen}
        branch={editingBranch}
        allEmployees={allEmployees}
        onLoadAllEmployees={loadAllEmployees}
        saving={saving}
        onSubmit={async (data) => {
          setSaving(true);
          try {
            const action = editingBranch ? 'update' : 'create';
            const payload = editingBranch ? { ...data, action, id: editingBranch.id } : { ...data, action };
            const res = await fetch('/api/cvision/branches', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const result = await res.json();
            if (!res.ok) { toast({ title: tr('خطأ', 'Error'), description: result.error, variant: 'destructive' }); return; }
            await loadData();
            setBranchDialogOpen(false);
            toast({ title: editingBranch ? tr('تم تحديث الفرع', 'Branch updated') : tr('تم إنشاء الفرع', 'Branch created') });
          } catch (e: any) { toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' }); }
          finally { setSaving(false); }
        }}
      />

      {/* Branch Manager Dialog */}
      <CVisionDialog C={C} open={branchManagerDialogOpen} onClose={() => setBranchManagerDialogOpen(false)} title={tr('تعيين مدير الفرع', 'Assign Branch Manager')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('اختر موظفاً لإدارة هذا الفرع', 'Select an employee to manage this branch')}</p>          {branchForManager && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: C.textMuted }}>{tr('اختر مدير لـ', 'Select manager for')} <span style={{ fontWeight: 500 }}>{branchForManager.name}</span></p>
              <CVisionSelect
                C={C}
                value={selectedManagerId}
                onChange={setSelectedManagerId}
                placeholder={tr('اختر موظف...', 'Select employee...')}
                options={[
                  { value: '__none__', label: tr('بدون مدير', 'No Manager') },
                  ...allEmployees.map(e => (
                    ({ value: e.id, label: `${e.firstName} ${e.lastName}` })
                  )),
                ]}
              />
            </div>
          )}
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setBranchManagerDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} disabled={saving} onClick={async () => {
              if (!branchForManager) return;
              setSaving(true);
              try {
                await fetch('/api/cvision/branches', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'assign-manager',
                    id: branchForManager.id,
                    managerId: selectedManagerId && selectedManagerId !== '__none__' ? selectedManagerId : null,
                  }),
                });
                await loadData();
                setBranchManagerDialogOpen(false);
                toast({ title: tr('تم تعيين المدير', 'Manager assigned') });
              } catch (e: any) { toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' }); }
              finally { setSaving(false); }
            }}>
              {saving ? tr('جاري الحفظ...', 'Saving...') : tr('تعيين', 'Assign')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Branch Card
// ═══════════════════════════════════════════════════════════════════════════

const BRANCH_TYPE_ICONS: Record<string, string> = {
  HEADQUARTERS: '🏢', BRANCH: '🏬', REGIONAL_OFFICE: '🏛️',
  WAREHOUSE: '🏭', CLINIC: '🏥', REMOTE: '🌐',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function BranchCard({
  branch, onEdit, onAssignManager, onDelete, onSetHQ,
}: {
  branch: CVisionBranch;
  onEdit: () => void;
  onAssignManager: () => void;
  onDelete: () => void;
  onSetHQ: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const workDayStr = (branch.workDays || []).map(d => DAY_NAMES[d]).join('-');

  return (
    <div className={`rounded-xl border-2 p-5 transition-shadow hover:shadow-md ${
      branch.isHeadquarters ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
    }`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{BRANCH_TYPE_ICONS[branch.type] || '🏢'}</span>
            <h3 style={{ fontWeight: 700 }}>{branch.name}</h3>
            {branch.isHeadquarters && (
              <CVisionBadge C={C} variant="default" style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 0, paddingBottom: 0 }}>{tr('مقر رئيسي', 'HQ')}</CVisionBadge>
            )}
          </div>
          {/* nameAr display removed */}
        </div>
        {!branch.isActive && <CVisionBadge C={C} variant="secondary">{tr('غير نشط', 'Inactive')}</CVisionBadge>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: C.textMuted, marginTop: 12 }}>
        {branch.address?.city && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin style={{ height: 14, width: 14 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[branch.address.street, branch.address.district, branch.address.city].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {branch.phone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone style={{ height: 14, width: 14 }} />
            <span>{branch.phone}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users style={{ height: 14, width: 14 }} />
          <span>{tr('المدير', 'Manager')}: {branch.branchManagerName || tr('غير معين', 'Not assigned')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, fontSize: 12, color: C.textMuted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users style={{ height: 12, width: 12 }} /> {branch.employeeCount ?? 0} {tr('موظفين', 'employees')}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Building2 style={{ height: 12, width: 12 }} /> {branch.departmentCount ?? 0} {tr('أقسام', 'depts')}
        </span>
      </div>

      {(branch.workHoursStart || workDayStr) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: C.textMuted }}>
          <Clock style={{ height: 12, width: 12 }} />
          <span>{workDayStr}, {branch.workHoursStart || '08:00'} – {branch.workHoursEnd || '17:00'}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ fontSize: 12, height: 28 }} onClick={onEdit}>
          <Edit style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('تعديل', 'Edit')}
        </CVisionButton>
        {!branch.branchManager ? (
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ fontSize: 12, height: 28 }} onClick={onAssignManager}>
            <UserPlus style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('تعيين مدير', 'Assign Manager')}
          </CVisionButton>
        ) : (
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ fontSize: 12, height: 28 }} onClick={onAssignManager}>
            {tr('تغيير المدير', 'Change Manager')}
          </CVisionButton>
        )}
        {!branch.isHeadquarters && (
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ fontSize: 12, height: 28 }} onClick={onSetHQ}>
            <Star style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('تعيين كمقر رئيسي', 'Set as HQ')}
          </CVisionButton>
        )}
        {!branch.isHeadquarters && (
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ fontSize: 12, height: 28 }} onClick={onDelete}>
            <Trash2 style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('حذف', 'Delete')}
          </CVisionButton>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Branch Form Dialog
// ═══════════════════════════════════════════════════════════════════════════

const WORK_DAYS_ALL = [
  { idx: 0, label: 'Sun' }, { idx: 1, label: 'Mon' }, { idx: 2, label: 'Tue' },
  { idx: 3, label: 'Wed' }, { idx: 4, label: 'Thu' }, { idx: 5, label: 'Fri' },
  { idx: 6, label: 'Sat' },
];

function BranchFormDialog({
  open, onOpenChange, branch, allEmployees: employees, onLoadAllEmployees, saving, onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branch: CVisionBranch | null;
  allEmployees: EmployeeOption[];
  onLoadAllEmployees: () => void;
  saving: boolean;
  onSubmit: (data: any) => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [name, setName] = useState('');
  const [type, setType] = useState('BRANCH');
  const [city, setCity] = useState('');
  const [street, setStreet] = useState('');
  const [district, setDistrict] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [nationalAddress, setNationalAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [workDays, setWorkDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [workStart, setWorkStart] = useState('08:00');
  const [workEnd, setWorkEnd] = useState('17:00');
  const [managerId, setManagerId] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (open) {
      onLoadAllEmployees();
      if (branch) {
        setName(branch.name);
        setType(branch.type);
        setCity(branch.address?.city || '');
        setStreet(branch.address?.street || '');
        setDistrict(branch.address?.district || '');
        setRegion(branch.address?.region || '');
        setPostalCode(branch.address?.postalCode || '');
        setNationalAddress(branch.address?.nationalAddress || '');
        setPhone(branch.phone || '');
        setEmail(branch.email || '');
        setCrNumber((branch as any).crNumber || '');
        setWorkDays(branch.workDays ?? [0, 1, 2, 3, 4]);
        setWorkStart(branch.workHoursStart || '08:00');
        setWorkEnd(branch.workHoursEnd || '17:00');
        setManagerId(branch.branchManager || '');
        setIsActive(branch.isActive ?? true);
      } else {
        setName(''); setType('BRANCH'); setCity(''); setStreet('');
        setDistrict(''); setRegion(''); setPostalCode(''); setNationalAddress('');
        setPhone(''); setEmail(''); setCrNumber('');
        setWorkDays([0, 1, 2, 3, 4]);
        setWorkStart('08:00'); setWorkEnd('17:00'); setManagerId('');
        setIsActive(true);
      }
    }
  }, [open, branch]);

  function toggleDay(d: number) {
    setWorkDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  }

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('التفاصيل', 'Details')} isDark={isDark}>          
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{branch ? tr('تحديث تفاصيل وإعدادات الفرع', 'Update branch details and settings') : tr('إعداد موقع فرع جديد', 'Set up a new branch location')}</p>        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ── Basic Info ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Building2 style={{ height: 14, width: 14 }} /> {tr('المعلومات الأساسية', 'Basic Information')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div className="col-span-2">
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('اسم الفرع *', 'Branch Name *')}</label>
                <CVisionInput C={C} value={name} onChange={e => setName(e.target.value)} placeholder={tr('مثال: فرع جدة', 'e.g. Jeddah Branch')} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('النوع', 'Type')}</label>
                <CVisionSelect
                C={C}
                value={type}
                onChange={setType}
                options={['HEADQUARTERS', 'BRANCH', 'REGIONAL_OFFICE', 'WAREHOUSE', 'CLINIC', 'REMOTE'].map(t => (
                      ({ value: t, label: t.replace(/_/g, ' ') })
                    ))}
              />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('رقم السجل التجاري', 'CR Number')}</label>
                <CVisionInput C={C} value={crNumber} onChange={e => setCrNumber(e.target.value)} placeholder="1010XXXXXX" />
              </div>
            </div>
          </div>

          {/* ── Address ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin style={{ height: 14, width: 14 }} /> {tr('العنوان', 'Address')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('المدينة *', 'City *')}</label>
                <CVisionInput C={C} value={city} onChange={e => setCity(e.target.value)} placeholder="Riyadh" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('المنطقة', 'Region')}</label>
                <CVisionInput C={C} value={region} onChange={e => setRegion(e.target.value)} placeholder="Riyadh Region" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('الحي', 'District')}</label>
                <CVisionInput C={C} value={district} onChange={e => setDistrict(e.target.value)} placeholder="Al Olaya" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('الرمز البريدي', 'Postal Code')}</label>
                <CVisionInput C={C} value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="12345" />
              </div>
              <div className="col-span-2">
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('عنوان الشارع', 'Street Address')}</label>
                <CVisionInput C={C} value={street} onChange={e => setStreet(e.target.value)} placeholder="King Fahd Road" />
              </div>
              <div className="col-span-2">
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('العنوان الوطني', 'National Address')}</label>
                <CVisionInput C={C} value={nationalAddress} onChange={e => setNationalAddress(e.target.value)} placeholder="AAAA1234 - Short Address" />
              </div>
            </div>
          </div>

          {/* ── Contact ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Phone style={{ height: 14, width: 14 }} /> {tr('التواصل والإدارة', 'Contact & Management')}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('الهاتف', 'Phone')}</label>
                <CVisionInput C={C} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+966 11 XXX XXXX" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('البريد الإلكتروني', 'Email')}</label>
                <CVisionInput C={C} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="branch@company.com" />
              </div>
              <div className="col-span-2">
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('مدير الفرع', 'Branch Manager')}</label>
                <CVisionSelect
                C={C}
                value={managerId}
                onChange={setManagerId}
                placeholder={tr('اختر المدير...', 'Select manager...')}
                options={[
                  { value: '__none__', label: tr('لا يوجد', 'None') },
                  ...employees.map(e => (
                      ({ value: e.id, label: `${e.firstName} ${e.lastName}` })
                    )),
                ]}
              />
              </div>
            </div>
          </div>

          {/* ── Work Schedule ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock style={{ height: 14, width: 14 }} /> {tr('جدول العمل', 'Work Schedule')}
            </p>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, display: 'block' }}>{tr('أيام العمل', 'Work Days')}</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {WORK_DAYS_ALL.map(d => (
                  <button
                    key={d.idx}
                    type="button"
                    onClick={() => toggleDay(d.idx)}
                    className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                      workDays.includes(d.idx)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('وقت البدء', 'Start Time')}</label>
                <CVisionInput C={C} type="time" value={workStart} onChange={e => setWorkStart(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('وقت الانتهاء', 'End Time')}</label>
                <CVisionInput C={C} type="time" value={workEnd} onChange={e => setWorkEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Status ── */}
          {branch && (
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('الفرع نشط', 'Branch Active')}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الفروع غير النشطة مخفية من تعيين الموظفين', 'Inactive branches are hidden from employee assignment')}</p>
                </div>
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              </div>
            </div>
          )}
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} disabled={saving || !name.trim()} onClick={() => {
            onSubmit({
              name, type,
              address: {
                street: street || undefined,
                district: district || undefined,
                city,
                region: region || undefined,
                postalCode: postalCode || undefined,
                country: 'SA',
                nationalAddress: nationalAddress || undefined,
              },
              phone: phone || undefined,
              email: email || undefined,
              crNumber: crNumber || undefined,
              workDays,
              workHoursStart: workStart,
              workHoursEnd: workEnd,
              branchManager: managerId && managerId !== '__none__' ? managerId : undefined,
              isActive,
            });
          }}>
            {saving ? tr('جاري الحفظ...', 'Saving...') : branch ? tr('حفظ التغييرات', 'Save Changes') : tr('إنشاء فرع', 'Create Branch')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}
