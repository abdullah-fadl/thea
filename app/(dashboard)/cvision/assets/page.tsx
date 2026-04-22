'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard,
  CVisionSelect, CVisionTable, CVisionTableHead, CVisionTableBody,
  CVisionTh, CVisionTr, CVisionTd,
  type CVisionSelectOption, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Package, PlusCircle, UserPlus, RotateCcw } from 'lucide-react';

const STATUS_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'muted'> = {
  AVAILABLE: 'success', ASSIGNED: 'info', MAINTENANCE: 'warning', DISPOSED: 'muted',
};
const CONDITION_VARIANTS: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  NEW: 'success', GOOD: 'info', FAIR: 'warning', DAMAGED: 'danger',
};
const CATEGORIES = ['LAPTOP', 'PHONE', 'VEHICLE', 'FURNITURE', 'KEY', 'ID_CARD', 'TOOL', 'OTHER'];

export default function AssetsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ employeeId: '', employeeName: '' });
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ name: '', nameAr: '', category: 'LAPTOP', brand: '', model: '', serialNumber: '', purchaseCost: 0, location: '' });

  const assetParams = { action: 'list', ...(filterCat ? { type: filterCat } : {}), ...(filterStatus ? { status: filterStatus } : {}) };
  const { data: assetsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.assets.list(assetParams),
    queryFn: () => cvisionFetch<any>('/api/cvision/assets', { params: assetParams }),
  });
  const { data: reportRaw } = useQuery({
    queryKey: cvisionKeys.assets.list({ action: 'report' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/assets', { params: { action: 'report' } }),
  });
  const assets = assetsRaw?.ok ? (assetsRaw.data || []) : [];
  const report = reportRaw?.ok ? reportRaw.data : null;

  const invalidateAssets = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.assets.all });

  const handleCreate = async () => {
    if (!form.name) { toast.error(tr('الاسم مطلوب', 'Name required')); return; }
    const d = await cvisionMutate<any>('/api/cvision/assets', 'POST', { action: 'create', ...form });
    d.ok ? (toast.success(tr(`تم إنشاء الأصل ${d.data.assetId}`, `Asset ${d.data.assetId} created`)), setShowCreate(false), invalidateAssets()) : toast.error(d.error);
  };

  const handleAssign = async () => {
    if (!showAssign || !assignForm.employeeId) { toast.error(tr('الموظف مطلوب', 'Employee required')); return; }
    const d = await cvisionMutate<any>('/api/cvision/assets', 'POST', { action: 'assign', assetId: showAssign, ...assignForm });
    d.ok ? (toast.success(tr('تم التخصيص', 'Assigned')), setShowAssign(null), invalidateAssets()) : toast.error(d.error);
  };

  const handleReturn = async (assetId: string) => {
    const d = await cvisionMutate<any>('/api/cvision/assets', 'POST', { action: 'return', assetId });
    d.ok ? (toast.success(tr('تم الإرجاع', 'Returned')), invalidateAssets()) : toast.error(d.error);
  };

  const categoryOptions: CVisionSelectOption[] = [
    { value: '', label: tr('جميع الفئات', 'All Categories') },
    ...CATEGORIES.map(c => ({ value: c, label: c })),
  ];
  const statusOptions: CVisionSelectOption[] = [
    { value: '', label: tr('جميع الحالات', 'All Status') },
    ...['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DISPOSED'].map(s => ({ value: s, label: s })),
  ];
  const formCategoryOptions: CVisionSelectOption[] = CATEGORIES.map(c => ({ value: c, label: c }));

  if (loading) return <div style={{ padding: 24 }}><CVisionSkeletonCard C={C} height={260} /></div>;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('إدارة الأصول', 'Asset Management')}
        titleEn="Asset Management"
        icon={Package}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant={showCreate ? 'outline' : 'primary'} icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('إضافة أصل', 'Add Asset')}
          </CVisionButton>
        }
      />

      {/* Report Stats */}
      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Package size={20} color={C.blue} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{report.total}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('إجمالي الأصول', 'Total Assets')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{report.byStatus?.AVAILABLE || 0}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('متاحة', 'Available')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.blue }}>{report.byStatus?.ASSIGNED || 0}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مخصصة', 'Assigned')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{(report.totalValue || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('القيمة الإجمالية (ر.س)', 'Total Value (SAR)')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إضافة أصل', 'Add Asset')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('الاسم', 'Name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('الاسم بالعربي', 'Name (Arabic)')} dir="rtl" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <CVisionSelect C={C} options={formCategoryOptions} value={form.category} onChange={v => setForm({ ...form, category: v })} />
                <CVisionInput C={C} placeholder={tr('العلامة التجارية', 'Brand')} value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('الموديل', 'Model')} value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('الرقم التسلسلي', 'Serial Number')} value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('الموقع', 'Location')} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                <CVisionInput C={C} label={tr('التكلفة (ر.س)', 'Cost (SAR)')} type="number" value={String(form.purchaseCost)} onChange={e => setForm({ ...form, purchaseCost: parseInt(e.target.value) })} />
              </div>
              <CVisionButton C={C} isDark={isDark} onClick={handleCreate}>{tr('إضافة أصل', 'Add Asset')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Assign Form */}
      {showAssign && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تخصيص أصل', 'Assign Asset')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionInput C={C} placeholder={tr('رقم الموظف', 'Employee ID')} value={assignForm.employeeId} onChange={e => setAssignForm({ ...assignForm, employeeId: e.target.value })} />
              <CVisionInput C={C} placeholder={tr('اسم الموظف', 'Employee Name')} value={assignForm.employeeName} onChange={e => setAssignForm({ ...assignForm, employeeName: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionButton C={C} isDark={isDark} onClick={handleAssign}>{tr('تخصيص', 'Assign')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowAssign(null)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ width: 180 }}><CVisionSelect C={C} options={categoryOptions} value={filterCat} onChange={v => setFilterCat(v)} /></div>
        <div style={{ width: 180 }}><CVisionSelect C={C} options={statusOptions} value={filterStatus} onChange={v => setFilterStatus(v)} /></div>
      </div>

      {/* Assets Table */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 0 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('المعرف', 'ID')}</CVisionTh>
              <CVisionTh C={C}>{tr('الاسم', 'Name')}</CVisionTh>
              <CVisionTh C={C} align="center">{tr('الفئة', 'Category')}</CVisionTh>
              <CVisionTh C={C} align="center">{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C} align="center">{tr('الحالة الفنية', 'Condition')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('الإجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {assets.map(a => (
                <CVisionTr C={C} key={a.assetId}>
                  <CVisionTd style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.assetId}</CVisionTd>
                  <CVisionTd>
                    <div style={{ color: C.text }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{a.brand} {a.model}</div>
                  </CVisionTd>
                  <CVisionTd align="center"><CVisionBadge C={C} variant="muted" style={{ fontSize: 9 }}>{a.category}</CVisionBadge></CVisionTd>
                  <CVisionTd align="center"><CVisionBadge C={C} variant={STATUS_VARIANTS[a.status] || 'muted'} style={{ fontSize: 9 }}>{a.status}</CVisionBadge></CVisionTd>
                  <CVisionTd align="center"><CVisionBadge C={C} variant={CONDITION_VARIANTS[a.condition] || 'muted'} style={{ fontSize: 9 }}>{a.condition}</CVisionBadge></CVisionTd>
                  <CVisionTd align="right">
                    {a.status === 'AVAILABLE' && (
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<UserPlus size={12} />}
                        onClick={() => { setShowAssign(a.assetId); setAssignForm({ employeeId: '', employeeName: '' }); }}>
                        {tr('تخصيص', 'Assign')}
                      </CVisionButton>
                    )}
                    {a.status === 'ASSIGNED' && (
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<RotateCcw size={12} />}
                        onClick={() => handleReturn(a.assetId)}>
                        {tr('إرجاع', 'Return')}
                      </CVisionButton>
                    )}
                  </CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
