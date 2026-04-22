'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionSkeletonCard, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionStatsRow, CVisionMiniStat, CVisionDialogFooter } from '@/components/cvision/ui';
import {
  Plus, Loader2, Download, TrendingUp, TrendingDown, Minus,
  AlertCircle, Pencil, Users, ExternalLink, Briefcase, Check, DollarSign,
  Calendar, ShieldCheck, CheckCircle2, Clock, FileEdit,
} from 'lucide-react';
import { toast } from 'sonner';

interface ManpowerSummaryRow {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  positionId: string | null;
  positionCode: string | null;
  positionTitle: string;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
  budgetedHeadcount: number;
  activeHeadcount: number;
  exited30d: number;
  variance: number;
  utilizationPct: number;
}

interface ManpowerSummaryResponse {
  success: boolean;
  asOf: string;
  rows: ManpowerSummaryRow[];
  totals: {
    budgetedHeadcount: number;
    activeHeadcount: number;
    exited30d: number;
    variance: number;
  };
  metadata?: {
    unassignedEmployeesCount: number;
  };
}

interface Department { id: string; code: string; name: string; }
interface Position { id: string; code: string; title: string; displayName?: string; }
interface PositionEmployee { id: string; firstName: string; lastName: string; employeeNumber: string; status: string; }

export default function ManpowerPlansPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const searchParams = useSearchParams();
  const router = useRouter();
  const debugMode = searchParams.get('debug') === '1';

  const [summary, setSummary] = useState<ManpowerSummaryResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    departmentId: '', positionId: '', budgetedHeadcount: 0,
    effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', note: '',
  });
  const [lastApiCall, setLastApiCall] = useState<{ url: string; status: number; timestamp: string } | null>(null);

  const [editBudgetOpen, setEditBudgetOpen] = useState(false);
  const [editBudgetRow, setEditBudgetRow] = useState<ManpowerSummaryRow | null>(null);
  const [editBudgetValue, setEditBudgetValue] = useState(0);
  const [editBudgetSaving, setEditBudgetSaving] = useState(false);

  const [employeesDialogOpen, setEmployeesDialogOpen] = useState(false);
  const [employeesDialogRow, setEmployeesDialogRow] = useState<ManpowerSummaryRow | null>(null);
  const [employeesList, setEmployeesList] = useState<PositionEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [budgetSummary, setBudgetSummary] = useState<any>(null);
  const [recruitmentMap, setRecruitmentMap] = useState<Record<string, any>>({});
  const [recruitTitleMap, setRecruitTitleMap] = useState<Record<string, any>>({});
  const [openRecruitRow, setOpenRecruitRow] = useState<ManpowerSummaryRow | null>(null);
  const [openRecruitDialogOpen, setOpenRecruitDialogOpen] = useState(false);
  const [openRecruitSaving, setOpenRecruitSaving] = useState(false);

  const queryClient = useQueryClient();

  const manpowerDataQuery = useQuery({
    queryKey: cvisionKeys.manpower.list({ asOf: asOfDate, deptId: selectedDeptId }),
    queryFn: async () => {
      const summaryParams: Record<string, string> = { asOf: asOfDate };
      if (selectedDeptId) summaryParams.departmentId = selectedDeptId;
      const [summaryData, deptData, recruitData, budgetData] = await Promise.all([
        cvisionFetch<any>('/api/cvision/manpower/summary', { params: summaryParams }),
        cvisionFetch<any>('/api/cvision/org/departments'),
        cvisionFetch<any>('/api/cvision/manpower/recruitment-status').catch(() => null),
        cvisionFetch<any>('/api/cvision/headcount-budget', { params: { action: 'summary', year: String(new Date().getFullYear()) } }).catch(() => null),
      ]);
      return { summaryData, deptData, recruitData, budgetData };
    },
  });

  useEffect(() => {
    if (!manpowerDataQuery.data) return;
    const { summaryData, deptData, recruitData, budgetData } = manpowerDataQuery.data;
    if (budgetData?.ok) setBudgetSummary(budgetData.data);
    if (recruitData?.success) { setRecruitmentMap(recruitData.byPosition || {}); setRecruitTitleMap(recruitData.byTitleDept || {}); }
    if (summaryData?.success) setSummary(summaryData);
    else if (summaryData?.error) toast.error(summaryData.error || tr('فشل تحميل الملخص', 'Failed to load summary'));
    const depts = deptData?.items ?? deptData?.data ?? deptData ?? [];
    setDepartments(Array.isArray(depts) ? depts : []);
  }, [manpowerDataQuery.data]);

  const loading = manpowerDataQuery.isLoading;

  const positionsQuery = useQuery({
    queryKey: cvisionKeys.org.budgetedPositions.list({ departmentId: selectedDeptId }),
    queryFn: () => cvisionFetch<any>('/api/cvision/org/budgeted-positions', { params: { departmentId: selectedDeptId, includeInactive: 'false' } }),
    enabled: !!selectedDeptId,
  });
  useEffect(() => {
    if (!selectedDeptId) { setPositions([]); return; }
    if (positionsQuery.data) {
      const d = positionsQuery.data;
      const items = d.items || d.data?.items || d.data || [];
      setPositions(items.map((p: any) => ({ id: p.id, code: p.positionCode, title: p.title || p.positionCode, displayName: p.displayName })));
    }
  }, [positionsQuery.data, selectedDeptId]);

  async function loadData() { manpowerDataQuery.refetch(); }
  async function loadPositionsForDepartment(deptId: string) { positionsQuery.refetch(); }

  function openCreateDialog(deptId?: string, posId?: string) {
    setForm({ departmentId: deptId || '', positionId: posId || '', budgetedHeadcount: 0, effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', note: '' });
    setDialogOpen(true);
  }

  async function savePlan() {
    if (!form.departmentId || !form.positionId || form.budgetedHeadcount < 0) { toast.error(tr('القسم والمنصب والعدد المخطط مطلوبة', 'Department, Position, and Budgeted Headcount (>=0) are required')); return; }
    try {
      setSaving(true);
      const data = await cvisionMutate<any>('/api/cvision/manpower/plans', 'POST', { ...form, budgetedHeadcount: Number(form.budgetedHeadcount), effectiveTo: form.effectiveTo || null, note: form.note || null });
      if (data.success) { toast.success(tr('تم إنشاء خطة القوى العاملة', 'Manpower plan created successfully')); setDialogOpen(false); setForm({ departmentId: '', positionId: '', budgetedHeadcount: 0, effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', note: '' }); await loadData(); }
      else toast.error(data.error || data.message || tr('فشل إنشاء الخطة', 'Failed to create plan'));
    } catch (err: any) { toast.error(err.message || tr('فشل إنشاء الخطة', 'Failed to create plan')); }
    finally { setSaving(false); }
  }

  function openEditBudget(row: ManpowerSummaryRow) { setEditBudgetRow(row); setEditBudgetValue(row.budgetedHeadcount); setEditBudgetOpen(true); }

  async function saveEditBudget() {
    if (!editBudgetRow?.positionId) return;
    try {
      setEditBudgetSaving(true);
      const res = await cvisionMutate<any>(`/api/cvision/org/budgeted-positions/${editBudgetRow.positionId}`, 'PATCH', { budgetedHeadcount: editBudgetValue });
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error((e as any).error || tr('فشل التحديث', `Failed to update budget (${res.status})`)); return; }
      toast.success(tr('تم تحديث الميزانية', 'Budget updated')); setEditBudgetOpen(false); await loadData();
    } catch (err: any) { toast.error(err.message || tr('فشل تحديث الميزانية', 'Failed to update budget')); }
    finally { setEditBudgetSaving(false); }
  }

  async function openEmployeesDialog(row: ManpowerSummaryRow) {
    if (!row.positionId) return;
    setEmployeesDialogRow(row); setEmployeesList([]); setEmployeesLoading(true); setEmployeesDialogOpen(true);
    try {
      const d = await cvisionFetch<any>('/api/cvision/employees', { params: { positionId: row.positionId!, statuses: 'ACTIVE,PROBATION', limit: '100' } });
      const items = d.items || d.data?.items || d.data || []; setEmployeesList(items.map((e: any) => ({ id: e.id, firstName: e.firstName || '', lastName: e.lastName || '', employeeNumber: e.employeeNumber || e.employeeId || '', status: e.status || 'ACTIVE' })));
    } catch {} finally { setEmployeesLoading(false); }
  }

  async function exportExcel() {
    try {
      const params = new URLSearchParams({ asOf: asOfDate }); if (selectedDeptId) params.append('departmentId', selectedDeptId);
      const res = await fetch(`/api/cvision/reports/manpower.xlsx?${params}`, { credentials: 'include' });
      if (!res.ok) { toast.error(tr('فشل تصدير إكسل', `Failed to export Excel (${res.status})`)); return; }
      const blob = await res.blob(); if (blob.size === 0) { toast.error(tr('ملف فارغ', 'Excel file is empty')); return; }
      const url = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `CVision_Manpower_${asOfDate}.xlsx`; document.body.appendChild(a); a.click();
      setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
      toast.success(tr('تم تنزيل التقرير', `Excel report downloaded (${(blob.size / 1024).toFixed(1)} KB)`));
    } catch (err: any) { toast.error(err.message || tr('فشل تصدير إكسل', 'Failed to export Excel')); }
  }

  function getVarianceColor(v: number) { if (v < 0) return C.red; if (v > 0) return C.green; return C.text; }
  function getUtilizationColor(p: number) { if (p >= 100) return C.red; if (p >= 90) return C.orange; if (p >= 75) return C.green; return C.textMuted; }

  useEffect(() => { if (form.departmentId) loadPositionsForDepartment(form.departmentId); else { setPositions([]); setForm(f => ({ ...f, positionId: '' })); } }, [form.departmentId]);

  function getRecruitmentStatus(row: ManpowerSummaryRow) {
    if (row.positionId && recruitmentMap[row.positionId]) return recruitmentMap[row.positionId];
    const k = `${(row.departmentId || '').toLowerCase()}::${(row.positionTitle || '').toLowerCase().trim()}`; if (recruitTitleMap[k]) return recruitTitleMap[k]; return null;
  }

  async function handleOpenRecruitment() {
    if (!openRecruitRow) return; setOpenRecruitSaving(true);
    try {
      const res = await fetch('/api/cvision/recruitment/requisitions', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: openRecruitRow.positionTitle, departmentId: openRecruitRow.departmentId, jobTitleId: openRecruitRow.positionId, positionId: openRecruitRow.positionId, headcount: Math.max(1, openRecruitRow.variance), headcountRequested: Math.max(1, openRecruitRow.variance), reason: 'new_role', status: 'open', employmentType: 'full_time', source: 'MANPOWER_PLAN', metadata: { fromManpower: true, variance: openRecruitRow.variance } }) });
      const data = await res.json();
      if (data.success || data.requisition) { toast.success(tr(`تم إنشاء طلب التوظيف`, `Requisition ${data.requisition?.requisitionNumber || ''} created`)); setOpenRecruitDialogOpen(false); await loadData(); }
      else toast.error(data.error || data.message || tr('فشل إنشاء طلب التوظيف', 'Failed to create requisition'));
    } catch (err: any) { toast.error(err.message || tr('فشل إنشاء فرصة العمل', 'Failed to create job opening')); }
    finally { setOpenRecruitSaving(false); }
  }

  if (loading && !summary) {
    return (<CVisionPageLayout><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}><Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: C.textMuted }} /></div></CVisionPageLayout>);
  }

  const unassignedCount = summary?.metadata?.unassignedEmployeesCount || 0;
  const deptOptions = [{ value: 'all', label: tr('كل الأقسام', 'All departments') }, ...departments.map(d => ({ value: d.id, label: `${d.name} (${d.code})` }))];
  const formDeptOptions = departments.map(d => ({ value: d.id, label: `${d.name} (${d.code})` }));
  const formPosOptions = positions.map(p => ({ value: p.id, label: `${p.displayName || p.title} (${p.code})` }));

  return (
    <CVisionPageLayout>
      {unassignedCount > 0 && (
        <CVisionCard C={C} style={{ borderLeft: `4px solid ${C.orange}` }}>
          <CVisionCardBody>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertCircle size={20} color={C.orange} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{tr('موظفون بدون منصب', 'Unassigned Employees')}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{unassignedCount} {tr('موظف نشط بدون منصب. قم بتعيين المناصب للحصول على مقاييس دقيقة.', `active employee${unassignedCount !== 1 ? 's have' : ' has'} no position assigned. Assign positions for accurate metrics.`)}</div>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{tr('خطط القوى العاملة', 'Manpower Plans')}</h1>
            <p style={{ color: C.textMuted, fontSize: 13 }}>{tr('الميزانية مقابل العدد الفعلي حسب القسم والمنصب', 'Budget vs actual headcount by department and position')}</p>
          </div>
          {budgetSummary && <CVisionBadge C={C} variant="info" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> FY {budgetSummary.year}</CVisionBadge>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/cvision/headcount"><CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<DollarSign size={14} />}>{tr('ميزانية العدد', 'Headcount Budget')}</CVisionButton></Link>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={exportExcel} disabled={loading} icon={<Download size={14} />}>{tr('تصدير إكسل', 'Export Excel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={() => openCreateDialog()} icon={<Plus size={14} />}>{tr('تعيين ميزانية', 'Set Budget')}</CVisionButton>
        </div>
      </div>

      {budgetSummary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.bgSubtle, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 500, color: C.textMuted }}>{tr('ميزانية السنة المالية', 'Budget FY')} {budgetSummary.year}:</span>
          {(budgetSummary.approvedBudgets || 0) > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={14} color={C.green} /><span style={{ fontWeight: 600, color: C.green }}>{budgetSummary.approvedBudgets}</span><span style={{ color: C.textMuted }}>{tr('معتمد', 'Approved')}</span></div>}
          {(budgetSummary.activeBudgets || 0) > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} color={C.green} /><span style={{ fontWeight: 600, color: C.green }}>{budgetSummary.activeBudgets}</span><span style={{ color: C.textMuted }}>{tr('نشط', 'Active')}</span></div>}
          {(budgetSummary.pendingBudgets || 0) > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} color={C.blue} /><span style={{ fontWeight: 600, color: C.blue }}>{budgetSummary.pendingBudgets}</span><span style={{ color: C.textMuted }}>{tr('قيد الانتظار', 'Pending')}</span></div>}
          {(budgetSummary.draftBudgets || 0) > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><FileEdit size={14} color={C.orange} /><span style={{ fontWeight: 600, color: C.orange }}>{budgetSummary.draftBudgets}</span><span style={{ color: C.textMuted }}>{tr('مسودة', 'Draft')}</span></div>}
          <span style={{ color: C.textMuted }}>|</span>
          <span style={{ color: C.textMuted }}>{budgetSummary.totalApproved} {tr('مخطط', 'Budgeted')}</span>
          <span style={{ color: C.textMuted }}>|</span>
          <span style={{ color: C.textMuted }}>{budgetSummary.totalActual} {tr('فعلي', 'Actual')}</span>
        </div>
      )}

      <CVisionCard C={C}>
        <CVisionCardBody>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('تاريخ الاستعراض', 'As-of Date')}</label>
              <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, background: C.bgCard, color: C.text }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('تصفية القسم', 'Department Filter')}</label>
              <CVisionSelect C={C} value={selectedDeptId || 'all'} onChange={(v) => setSelectedDeptId(v === 'all' ? '' : v)} options={deptOptions} />
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {summary && (
        <CVisionStatsRow>
          <CVisionMiniStat C={C} label={tr('العدد المخطط', 'Budgeted Headcount')} value={summary.totals.budgetedHeadcount} />
          <CVisionMiniStat C={C} label={tr('العدد الفعلي', 'Active Headcount')} value={summary.totals.activeHeadcount} />
          <CVisionMiniStat C={C} label={tr('الفرق', 'Variance')} value={`${summary.totals.variance > 0 ? '+' : ''}${summary.totals.variance}`} color={getVarianceColor(summary.totals.variance)} />
          <CVisionMiniStat C={C} label={tr('مغادرون (30 يوم)', 'Exited (30d)')} value={summary.totals.exited30d} />
        </CVisionStatsRow>
      )}

      {debugMode && (
        <CVisionCard C={C} style={{ borderLeft: `4px solid ${C.orange}` }}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Debug Panel</span></CVisionCardHeader>
          <CVisionCardBody><div style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><strong>Selected Dept ID:</strong> {selectedDeptId || '(none)'}</div>
            <div><strong>Form Dept ID:</strong> {form.departmentId || '(none)'}</div>
            <div><strong>Form Position ID:</strong> {form.positionId || '(none)'}</div>
            <div><strong>Positions:</strong> {positions.length}</div>
            <div><strong>Departments:</strong> {departments.length}</div>
            {lastApiCall && <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}><strong>Last API:</strong> {lastApiCall.url} ({lastApiCall.status}) @ {lastApiCall.timestamp}</div>}
          </div></CVisionCardBody>
        </CVisionCard>
      )}

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('ملخص القوى العاملة', 'Manpower Summary')}</span></CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
              <CVisionTh C={C}>{tr('الوحدة', 'Unit')}</CVisionTh>
              <CVisionTh C={C}>{tr('المنصب', 'Position')}</CVisionTh>
              <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('مخطط', 'Budgeted')}</CVisionTh>
              <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('فعلي', 'Active')}</CVisionTh>
              <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('مغادرون', 'Exited(30d)')}</CVisionTh>
              <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الفرق', 'Variance')}</CVisionTh>
              <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الاستخدام', 'Utilization')}</CVisionTh>
              <CVisionTh C={C}>{tr('التوظيف', 'Recruitment')}</CVisionTh>
              <CVisionTh C={C}>{tr('إجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {!summary || summary.rows.length === 0 ? (
                <CVisionTr C={C}><CVisionTd colSpan={10} style={{ textAlign: 'center', color: C.textMuted, padding: 24 }}>{tr('لا توجد خطط. قم بتعيين ميزانيات للبدء.', 'No manpower plans found. Set budgets to get started.')}</CVisionTd></CVisionTr>
              ) : summary.rows.map((row) => (
                <CVisionTr C={C} key={`${row.departmentId}:${row.positionId || '__U__'}`}>
                  <CVisionTd><div style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{row.departmentName}</div><div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{row.departmentCode}</div></CVisionTd>
                  <CVisionTd>{row.unitName ? <><div style={{ fontWeight: 500, fontSize: 12, color: C.text }}>{row.unitName}</div><div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{row.unitCode}</div></> : <span style={{ fontSize: 11, color: C.textMuted }}>-</span>}</CVisionTd>
                  <CVisionTd><div style={{ fontWeight: 500, fontSize: 13, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>{row.positionTitle}{row.positionId === null && <CVisionBadge C={C} variant="muted">{tr('غير معين', 'Unassigned')}</CVisionBadge>}</div>{row.positionCode && <div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{row.positionCode}</div>}</CVisionTd>
                  <CVisionTd style={{ textAlign: 'right' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}><span style={{ fontWeight: 500, color: C.text }}>{row.budgetedHeadcount}</span>{row.positionId && <button onClick={() => openEditBudget(row)} style={{ padding: 2, borderRadius: 4, cursor: 'pointer', color: C.textMuted, background: 'transparent', border: 'none' }} title={tr('تعديل', 'Edit budget')}><Pencil size={12} /></button>}</div></CVisionTd>
                  <CVisionTd style={{ textAlign: 'right' }}>{row.positionId && row.activeHeadcount > 0 ? <button onClick={() => openEmployeesDialog(row)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, color: C.blue, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13 }}>{row.activeHeadcount} <Users size={12} /></button> : <span style={{ fontWeight: 500, color: C.text }}>{row.activeHeadcount}</span>}</CVisionTd>
                  <CVisionTd style={{ textAlign: 'right', color: C.text }}>{row.exited30d}</CVisionTd>
                  <CVisionTd style={{ textAlign: 'right' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>{row.variance < 0 ? <TrendingUp size={14} color={C.red} /> : row.variance > 0 ? <TrendingDown size={14} color={C.green} /> : <Minus size={14} color={C.textMuted} />}<span style={{ fontWeight: 500, color: getVarianceColor(row.variance) }}>{row.variance > 0 ? '+' : ''}{row.variance}</span></div></CVisionTd>
                  <CVisionTd style={{ textAlign: 'right', fontWeight: row.utilizationPct >= 90 ? 600 : 400, color: getUtilizationColor(row.utilizationPct) }}>{row.utilizationPct.toFixed(1)}%</CVisionTd>
                  <CVisionTd>{(() => { const ri = getRecruitmentStatus(row); if (ri) return <button onClick={() => router.push('/cvision/recruitment?tab=openings')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: C.green, background: `${C.green}15`, padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer' }}><Check size={12} /> {ri.requisitionNumber}</button>; if (row.variance > 0 && row.positionId) return <button onClick={() => { setOpenRecruitRow(row); setOpenRecruitDialogOpen(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: C.orange, background: `${C.orange}15`, padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer' }}><Briefcase size={12} /> {tr('فتح توظيف', 'Open Recruitment')}</button>; return <span style={{ fontSize: 11, color: C.textMuted }}>{'\u2014'}</span>; })()}</CVisionTd>
                  <CVisionTd><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { if (row.positionId) openCreateDialog(row.departmentId, row.positionId); else toast.error(tr('قم بتعيين منصب أولاً', 'Assign a position first')); }} disabled={!row.positionId} icon={<Plus size={14} />} /></CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      <CVisionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={tr('تعيين ميزانية', 'Set Budget')} C={C}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('القسم', 'Department')} *</label><CVisionSelect C={C} value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} options={formDeptOptions} placeholder={tr('اختر القسم', 'Select department')} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('المنصب', 'Position')} *</label><CVisionSelect C={C} value={form.positionId} onChange={(v) => setForm({ ...form, positionId: v })} options={formPosOptions} placeholder={!form.departmentId ? tr('اختر القسم أولاً', 'Select department first') : positions.length === 0 ? tr('لا مناصب', 'No positions') : tr('اختر المنصب', 'Select position')} />{form.departmentId && positions.length === 0 && <Link href={`/cvision/org/departments/${form.departmentId}`} target="_blank" style={{ fontSize: 11, color: C.blue, textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}>{tr('تعيين مناصب لهذا القسم', 'Assign positions to this department')}</Link>}</div>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('العدد المخطط', 'Budgeted Headcount')} *</label><CVisionInput C={C} type="number" min={0} value={form.budgetedHeadcount} onChange={(e) => setForm({ ...form, budgetedHeadcount: parseInt(e.target.value) || 0 })} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('ساري من', 'Effective From')} *</label><input type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, background: C.bgCard, color: C.text }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('ساري إلى', 'Effective To')}</label><input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, background: C.bgCard, color: C.text }} /></div>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('ملاحظة', 'Note')}</label><CVisionTextarea C={C} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={3} placeholder={tr('ملاحظة اختيارية...', 'Optional note...')} /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={savePlan} disabled={saving || !form.departmentId || !form.positionId || positions.length === 0} icon={saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}>{tr('حفظ', 'Save')}</CVisionButton>
          </div>
        </div>
      </CVisionDialog>

      <CVisionDialog open={editBudgetOpen} onClose={() => setEditBudgetOpen(false)} title={tr('تعديل الميزانية', 'Edit Budget')} C={C}>
        {editBudgetRow && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: C.textMuted }}><span style={{ fontWeight: 500, color: C.text }}>{editBudgetRow.positionTitle}</span>{editBudgetRow.unitName && <span> &middot; {editBudgetRow.unitName}</span>}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}><div><div style={{ fontSize: 11, color: C.textMuted }}>{tr('المخطط الحالي', 'Current Budgeted')}</div><div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{editBudgetRow.budgetedHeadcount}</div></div><div><div style={{ fontSize: 11, color: C.textMuted }}>{tr('الفعلي', 'Active')}</div><div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{editBudgetRow.activeHeadcount}</div></div></div>
          <div><label style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'block', marginBottom: 4 }}>{tr('العدد المخطط الجديد', 'New Budgeted Headcount')}</label><CVisionInput C={C} type="number" min={0} value={editBudgetValue} onChange={(e) => setEditBudgetValue(parseInt(e.target.value) || 0)} autoFocus /></div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}><CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setEditBudgetOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton><CVisionButton C={C} isDark={isDark} onClick={saveEditBudget} disabled={editBudgetSaving} icon={editBudgetSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : undefined}>{tr('حفظ', 'Save')}</CVisionButton></div>
        </div>}
      </CVisionDialog>

      <CVisionDialog open={employeesDialogOpen} onClose={() => setEmployeesDialogOpen(false)} title={tr('الموظفون المعينون', 'Assigned Employees')} C={C}>
        {employeesDialogRow && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: C.textMuted }}><span style={{ fontWeight: 500, color: C.text }}>{employeesDialogRow.positionTitle}</span>{employeesDialogRow.unitName && <span> &middot; {employeesDialogRow.unitName}</span>}</div>
          {employeesLoading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: C.textMuted }} /></div>
          : employeesList.length === 0 ? <div style={{ textAlign: 'center', color: C.textMuted, padding: 24, fontSize: 13 }}>{tr('لا يوجد موظفون', 'No employees found')}</div>
          : <div style={{ maxHeight: 400, overflowY: 'auto' }}>{employeesList.map((emp) => (
            <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
              <div><div style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{emp.firstName} {emp.lastName}</div><div style={{ fontSize: 11, color: C.textMuted, fontFamily: 'monospace' }}>{emp.employeeNumber || '-'}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CVisionBadge C={C} variant={emp.status === 'ACTIVE' ? 'success' : 'muted'}>{emp.status}</CVisionBadge><button onClick={() => router.push(`/cvision/employees/${emp.id}`)} style={{ padding: 4, borderRadius: 4, cursor: 'pointer', color: C.textMuted, background: 'transparent', border: 'none' }}><ExternalLink size={14} /></button></div>
            </div>
          ))}</div>}
        </div>}
      </CVisionDialog>

      <CVisionDialog open={openRecruitDialogOpen} onClose={() => setOpenRecruitDialogOpen(false)} title={tr('إنشاء فرصة عمل', 'Create Job Opening')} C={C}>
        {openRecruitRow && <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: C.textMuted }}>{tr('سيتم إنشاء طلب توظيف جديد في وحدة التوظيف.', 'This will create a new Job Requisition in the Recruitment module.')}</p>
          <div style={{ background: C.bgSubtle, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('المنصب', 'Position')}</span><span style={{ fontWeight: 500, color: C.text }}>{openRecruitRow.positionTitle}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('القسم', 'Department')}</span><span style={{ fontWeight: 500, color: C.text }}>{openRecruitRow.departmentName}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('الشواغر', 'Vacant spots')}</span><span style={{ fontWeight: 600, color: C.orange }}>{openRecruitRow.variance}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('مخطط', 'Budgeted')}</span><span style={{ color: C.text }}>{openRecruitRow.budgetedHeadcount}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('فعلي', 'Active')}</span><span style={{ color: C.text }}>{openRecruitRow.activeHeadcount}</span></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}><CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setOpenRecruitDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton><CVisionButton C={C} isDark={isDark} onClick={handleOpenRecruitment} disabled={openRecruitSaving} icon={openRecruitSaving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Briefcase size={14} />}>{tr('إنشاء طلب توظيف', 'Create Requisition')}</CVisionButton></div>
        </div>}
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
