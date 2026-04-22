'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton,
  CVisionBadge,
  CVisionInput, CVisionTextarea,
  CVisionSelect,
  CVisionPageHeader, CVisionPageLayout,
  CVisionSkeletonCard, CVisionSkeletonStyles,
  CVisionEmptyState, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Network, PlusCircle, BarChart3, Check, AlertTriangle, ArrowRight, ArrowDown, ArrowUp, Equal, XCircle } from 'lucide-react';

function DeltaIndicator({ C, current, proposed, label }: { C: any; current: number; proposed: number; label: string }) {
  const diff = proposed - current;
  const color = diff > 0 ? C.red : diff < 0 ? C.green : C.textMuted;
  const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Equal;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <span style={{ fontSize: 13, color: C.text }}>{current}</span>
        <ArrowRight size={12} color={C.textMuted} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{proposed}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 11, color }}>
        <Icon size={12} />{diff > 0 ? '+' : ''}{diff}
      </div>
    </div>
  );
}

export default function OrgDesignPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', nameAr: '', type: 'RESTRUCTURE', description: '' });

  const { data: rawData, isLoading: loading, refetch } = useQuery({
    queryKey: cvisionKeys.orgDesign.list({ action: 'scenarios' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/org-design', { params: { action: 'scenarios' } }),
  });

  const scenarios: any[] = rawData?.ok ? rawData.data || [] : [];

  const createMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/org-design', 'POST', { action: 'create-scenario', ...form }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم انشاء السيناريو', 'Scenario created')), setShowCreate(false), refetch()) : toast.error(d.error); },
  });

  const analyzeMutation = useMutation({
    mutationFn: (scenarioId: string) => cvisionMutate<any>('/api/cvision/org-design', 'POST', { action: 'analyze', scenarioId }),
    onSuccess: (d, scenarioId) => {
      if (d.ok) { toast.success(tr('اكتمل التحليل', 'Analysis complete')); const updated = scenarios.find(s => s.scenarioId === scenarioId); if (updated) setSelected({ ...updated, analysis: d.data }); refetch(); }
      else toast.error(d.error);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (scenarioId: string) => cvisionMutate<any>('/api/cvision/org-design', 'POST', { action: 'approve-scenario', scenarioId }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تمت الموافقة', 'Approved')), refetch()) : toast.error(d.error); },
  });

  const handleCreate = () => { if (!form.name) { toast.error(tr('الاسم مطلوب', 'Name required')); return; } createMutation.mutate(); };
  const handleAnalyze = (scenarioId: string) => analyzeMutation.mutate(scenarioId);
  const handleApprove = (scenarioId: string) => approveMutation.mutate(scenarioId);

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const statusVariant = (s: string) => {
    if (s === 'APPROVED' || s === 'APPLIED') return 'success' as const;
    if (s === 'REJECTED') return 'danger' as const;
    if (s === 'UNDER_REVIEW') return 'warning' as const;
    return 'muted' as const;
  };

  const a = selected?.analysis;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('التصميم التنظيمي', 'Organization Design')}
        titleEn={isRTL ? 'Organization Design' : undefined}
        icon={Network}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant={showCreate ? 'outline' : 'primary'} icon={showCreate ? XCircle : PlusCircle} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('الغاء', 'Cancel') : tr('سيناريو جديد', 'New Scenario')}
          </CVisionButton>
        }
      />

      {showCreate && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سيناريو تصميم جديد', 'New Design Scenario')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CVisionInput C={C} placeholder={tr('اسم السيناريو', 'Scenario Name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <CVisionInput C={C} placeholder={tr('الاسم', 'Name (Arabic)')} dir="rtl" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} />
            </div>
            <CVisionSelect C={C} label={tr('النوع', 'Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={['RESTRUCTURE','EXPANSION','MERGER','DOWNSIZING','DEPARTMENT_CHANGE','CUSTOM'].map(t => ({ value: t, label: t }))} />
            <CVisionTextarea C={C} label={tr('الوصف', 'Description')} placeholder={tr('وصف السيناريو', 'Describe the scenario')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleCreate}>{tr('انشاء', 'Create')}</CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {selected && a && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('التحليل', 'Analysis')}: {selected.name}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
              <DeltaIndicator C={C} current={a.currentHeadcount} proposed={a.proposedHeadcount} label={tr('عدد الموظفين', 'Headcount')} />
              <DeltaIndicator C={C} current={a.currentAvgSpan} proposed={a.proposedAvgSpan} label={tr('متوسط النطاق', 'Avg Span')} />
              <DeltaIndicator C={C} current={a.currentLayers} proposed={a.proposedLayers} label={tr('المستويات', 'Layers')} />
              <DeltaIndicator C={C} current={a.currentMonthlyCost} proposed={a.proposedMonthlyCost} label={tr('التكلفة الشهرية', 'Monthly Cost')} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{tr('مناصب جديدة', 'New Positions')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>+{a.newPositions}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>{tr('محذوفة', 'Removed')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>-{a.removedPositions}</div>
              </div>
            </div>
            {a.duplicateRoles.length > 0 && (
              <div style={{ fontSize: 11, color: C.orange }}>
                <span style={{ fontWeight: 500 }}>{tr('ادوار مكررة', 'Duplicate Roles')}: </span>{a.duplicateRoles.join(', ')}
              </div>
            )}
            {a.singlePointsOfFailure.length > 0 && (
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={12} color={C.red} />
                <span style={{ fontWeight: 500, color: C.red }}>{tr('نقاط فشل فردية', 'SPOFs')}: </span>
                <span style={{ color: C.red }}>{a.singlePointsOfFailure.join(', ')}</span>
              </div>
            )}
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setSelected(null)}>{tr('اغلاق', 'Close')}</CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {scenarios.map(s => (
          <CVisionCard key={s.scenarioId} C={C} hover onClick={() => setSelected(s)} style={{ cursor: 'pointer' }}>
            <CVisionCardBody style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <CVisionBadge C={C} variant={statusVariant(s.status)}>{s.status}</CVisionBadge>
                <CVisionBadge C={C} variant="muted">{s.type}</CVisionBadge>
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{s.name}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={BarChart3} onClick={e => { e.stopPropagation(); handleAnalyze(s.scenarioId); }}>
                    {tr('تحليل', 'Analyze')}
                  </CVisionButton>
                  {s.status === 'DRAFT' && (
                    <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={Check} onClick={e => { e.stopPropagation(); handleApprove(s.scenarioId); }}>
                      {tr('موافقة', 'Approve')}
                    </CVisionButton>
                  )}
                </span>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
