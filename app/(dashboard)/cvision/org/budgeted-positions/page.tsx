'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionLabel, CVisionSelect, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionSkeletonStyles } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Users } from 'lucide-react';

interface BudgetedPosition {
  id: string; positionCode: string; title?: string | null; departmentId: string;
  jobTitleId: string; budgetedHeadcount: number; isActive: boolean;
  occupiedHeadcount: number; openRequisitions: number; availableSlots: number;
}
interface Department { id: string; code: string; name: string; }
interface JobTitle { id: string; code: string; name: string; departmentId?: string | null; }

export default function BudgetedPositionsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string>('');
  const [filterJobTitle, setFilterJobTitle] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [form, setForm] = useState({ departmentId: '', jobTitleId: '', positionCode: '', title: '', budgetedHeadcount: 0, isActive: true });
  const { toast } = useToast();

  // Fetch departments
  const { data: deptRaw } = useQuery({
    queryKey: cvisionKeys.departments.list(),
    queryFn: () => cvisionFetch('/api/cvision/org/departments'),
  });
  const departments: Department[] = deptRaw?.items || deptRaw?.data?.items || deptRaw?.data || [];

  // Fetch job titles
  const { data: jtRaw } = useQuery({
    queryKey: cvisionKeys.jobTitles.list(),
    queryFn: () => cvisionFetch('/api/cvision/org/job-titles'),
  });
  const jobTitles: JobTitle[] = jtRaw?.items || jtRaw?.data?.items || jtRaw?.data || [];

  // Fetch budgeted positions with filters
  const posFilters: Record<string, any> = {};
  if (filterDept) posFilters.departmentId = filterDept;
  if (filterJobTitle) posFilters.jobTitleId = filterJobTitle;
  if (includeInactive) posFilters.includeInactive = '1';

  const { data: posRaw, isLoading: loading, refetch: refetchPositions } = useQuery({
    queryKey: cvisionKeys.org.budgetedPositions.list(posFilters),
    queryFn: () => cvisionFetch('/api/cvision/org/budgeted-positions', { params: posFilters }),
  });
  const positions: BudgetedPosition[] = posRaw?.data || posRaw?.items || [];

  function openCreateDialog() { setEditingId(null); setForm({ departmentId: filterDept || '', jobTitleId: filterJobTitle || '', positionCode: '', title: '', budgetedHeadcount: 0, isActive: true }); setDialogOpen(true); }
  function openEditDialog(position: BudgetedPosition) { setEditingId(position.id); setForm({ departmentId: position.departmentId, jobTitleId: position.jobTitleId, positionCode: position.positionCode, title: position.title || '', budgetedHeadcount: position.budgetedHeadcount, isActive: position.isActive }); setEditDialogOpen(true); }

  const createMutation = useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/org/budgeted-positions', 'POST', body),
    onSuccess: () => {
      toast({ title: tr('نجاح', 'Success'), description: tr('تم انشاء المنصب', 'Position created') });
      setDialogOpen(false);
      refetchPositions();
    },
    onError: (err: any) => {
      toast({ title: tr('خطأ', 'Error'), description: err?.data?.error || err?.data?.message || tr('فشل انشاء المنصب', 'Failed to create position'), variant: 'destructive' });
    },
  });

  function savePosition() {
    if (!form.departmentId || !form.jobTitleId) { toast({ title: tr('خطأ', 'Error'), description: tr('القسم والمسمى الوظيفي مطلوبان', 'Department and Job Title are required'), variant: 'destructive' }); return; }
    const body: any = { departmentId: form.departmentId, jobTitleId: form.jobTitleId, budgetedHeadcount: form.budgetedHeadcount, isActive: form.isActive };
    if (form.positionCode) body.positionCode = form.positionCode;
    if (form.title) body.title = form.title;
    createMutation.mutate(body);
  }

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; body: any }) => cvisionMutate(`/api/cvision/org/budgeted-positions/${data.id}`, 'PATCH', data.body),
    onSuccess: () => {
      toast({ title: tr('نجاح', 'Success'), description: tr('تم تحديث المنصب', 'Position updated') });
      setEditDialogOpen(false);
      refetchPositions();
    },
    onError: (err: any) => {
      toast({ title: tr('خطأ', 'Error'), description: err?.data?.error || err?.data?.message || tr('فشل تحديث المنصب', 'Failed to update position'), variant: 'destructive' });
    },
  });

  function updatePosition() {
    if (!editingId) return;
    const body: any = {};
    if (form.title !== undefined) body.title = form.title || null;
    if (form.budgetedHeadcount !== undefined) body.budgetedHeadcount = form.budgetedHeadcount;
    if (form.isActive !== undefined) body.isActive = form.isActive;
    updateMutation.mutate({ id: editingId, body });
  }

  const filteredJobTitles = filterDept ? jobTitles.filter(jt => !jt.departmentId || jt.departmentId === filterDept) : jobTitles;
  const getDepartmentName = (id: string) => departments.find(d => d.id === id)?.name || id;
  const getJobTitleName = (id: string) => jobTitles.find(jt => jt.id === id)?.name || id;

  if (loading && positions.length === 0) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={300} />
    </CVisionPageLayout>
  );

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('المناصب المخططة', 'Budgeted Positions')}
        titleEn={isRTL ? 'Budgeted Positions' : undefined}
        subtitle={tr('ادارة ميزانيات العدد حسب القسم والمنصب', 'Manage headcount budgets by department and position')}
        icon={Users}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={Plus} onClick={openCreateDialog}>
            {tr('اضافة منصب', 'Add Position')}
          </CVisionButton>
        }
      />

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, alignItems: 'end' }}>
          <CVisionSelect C={C} label={tr('القسم', 'Department')} value={filterDept || '__all__'} onChange={v => setFilterDept(v === '__all__' ? '' : v)} options={[{ value: '__all__', label: tr('جميع الاقسام', 'All departments') }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
          <CVisionSelect C={C} label={tr('المسمى الوظيفي', 'Job Title')} value={filterJobTitle || '__all__'} onChange={v => setFilterJobTitle(v === '__all__' ? '' : v)} options={[{ value: '__all__', label: tr('جميع المسميات', 'All job titles') }, ...filteredJobTitles.map(jt => ({ value: jt.id, label: jt.name }))]} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} style={{ accentColor: C.gold }} />
            {tr('تضمين غير النشطة', 'Include Inactive')}
          </label>
        </CVisionCardBody>
      </CVisionCard>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('المناصب', 'Positions')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('رمز المنصب', 'Position Code')}</CVisionTh>
              <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
              <CVisionTh C={C}>{tr('المسمى الوظيفي', 'Job Title')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('المخطط', 'Budgeted')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('مشغول', 'Occupied')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('طلبات', 'Open Reqs')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('متاح', 'Available')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C} width={70}>{tr('اجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {positions.length === 0 ? (
                <CVisionTr C={C}>
                  <CVisionTd style={{ textAlign: 'center', color: C.textMuted }} colSpan={9}>
                    {tr('لا توجد مناصب. انشئ اول منصب مخطط.', 'No positions found. Create your first budgeted position.')}
                  </CVisionTd>
                </CVisionTr>
              ) : (
                positions.map(pos => (
                  <CVisionTr key={pos.id} C={C}>
                    <CVisionTd><span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{pos.positionCode}</span></CVisionTd>
                    <CVisionTd><span style={{ color: C.text }}>{getDepartmentName(pos.departmentId)}</span></CVisionTd>
                    <CVisionTd><span style={{ color: C.text }}>{getJobTitleName(pos.jobTitleId)}</span></CVisionTd>
                    <CVisionTd align="right"><span style={{ color: C.text }}>{pos.budgetedHeadcount}</span></CVisionTd>
                    <CVisionTd align="right"><span style={{ color: C.text }}>{pos.occupiedHeadcount}</span></CVisionTd>
                    <CVisionTd align="right"><span style={{ color: C.text }}>{pos.openRequisitions}</span></CVisionTd>
                    <CVisionTd align="right"><span style={{ fontWeight: 500, color: pos.availableSlots === 0 ? C.red : C.text }}>{pos.availableSlots}</span></CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant={pos.isActive ? 'success' : 'muted'}>{pos.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge></CVisionTd>
                    <CVisionTd><CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => openEditDialog(pos)}><Edit size={16} /></CVisionButton></CVisionTd>
                  </CVisionTr>
                ))
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* Create Dialog */}
      <CVisionDialog C={C} open={dialogOpen} onClose={() => setDialogOpen(false)} title={tr('انشاء منصب مخطط', 'Create Budgeted Position')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CVisionSelect C={C} label={`${tr('القسم', 'Department')} *`} value={form.departmentId} onChange={v => setForm({ ...form, departmentId: v, jobTitleId: '' })} placeholder={tr('اختر القسم', 'Select department')} options={departments.map(d => ({ value: d.id, label: d.name }))} />
          <CVisionSelect C={C} label={`${tr('المسمى الوظيفي', 'Job Title')} *`} value={form.jobTitleId} onChange={v => setForm({ ...form, jobTitleId: v })} disabled={!form.departmentId} placeholder={tr('اختر المسمى', 'Select job title')} options={filteredJobTitles.map(jt => ({ value: jt.id, label: jt.name }))} />
          <CVisionInput C={C} label={tr('رمز المنصب (تلقائي اذا فارغ)', 'Position Code (auto-generated if empty)')} value={form.positionCode} onChange={e => setForm({ ...form, positionCode: e.target.value })} placeholder="POS-ER-RN-001" />
          <CVisionInput C={C} label={tr('العنوان (اختياري)', 'Title (optional)')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ER Staff Nurse" />
          <CVisionInput C={C} type="number" label={`${tr('العدد المخطط', 'Budgeted Headcount')} *`} value={String(form.budgetedHeadcount)} onChange={e => setForm({ ...form, budgetedHeadcount: parseInt(e.target.value) || 0 })} />
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDialogOpen(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" loading={createMutation.isPending || updateMutation.isPending} disabled={createMutation.isPending || updateMutation.isPending || !form.departmentId || !form.jobTitleId} onClick={savePosition}>{tr('انشاء', 'Create')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>

      {/* Edit Dialog */}
      <CVisionDialog C={C} open={editDialogOpen} onClose={() => setEditDialogOpen(false)} title={tr('تعديل المنصب المخطط', 'Edit Budgeted Position')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CVisionInput C={C} label={tr('رمز المنصب', 'Position Code')} value={form.positionCode} disabled />
          <CVisionInput C={C} label={tr('القسم', 'Department')} value={getDepartmentName(form.departmentId)} disabled />
          <CVisionInput C={C} label={tr('المسمى الوظيفي', 'Job Title')} value={getJobTitleName(form.jobTitleId)} disabled />
          <CVisionInput C={C} label={tr('العنوان', 'Title')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tr('عنوان العرض الاختياري', 'Optional display label')} />
          <CVisionInput C={C} type="number" label={`${tr('العدد المخطط', 'Budgeted Headcount')} *`} value={String(form.budgetedHeadcount)} onChange={e => setForm({ ...form, budgetedHeadcount: parseInt(e.target.value) || 0 })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} style={{ accentColor: C.gold }} />
            {tr('نشط', 'Active')}
          </label>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setEditDialogOpen(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" loading={createMutation.isPending || updateMutation.isPending} disabled={createMutation.isPending || updateMutation.isPending} onClick={updatePosition}>{tr('تحديث', 'Update')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
