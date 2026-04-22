'use client';

import { useState } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow,
  CVisionSkeletonCard, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import { Shield, AlertTriangle, Users, PlusCircle, CheckCircle2 } from 'lucide-react';

export default function SuccessionPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ positionTitle: '', positionTitleAr: '', criticality: 'HIGH' });

  const { data: plansRaw, isLoading: loadingPlans } = useQuery({
    queryKey: cvisionKeys.succession.list({ action: 'list' }),
    queryFn: () => cvisionFetch('/api/cvision/succession', { params: { action: 'list' } }),
  });
  const plans = (plansRaw as any)?.data || [];

  const { data: statsRaw } = useQuery({
    queryKey: cvisionKeys.succession.list({ action: 'dashboard' }),
    queryFn: () => cvisionFetch('/api/cvision/succession', { params: { action: 'dashboard' } }),
  });
  const stats = (statsRaw as any)?.data || {};

  const { data: riskRaw } = useQuery({
    queryKey: cvisionKeys.succession.list({ action: 'risk-analysis' }),
    queryFn: () => cvisionFetch('/api/cvision/succession', { params: { action: 'risk-analysis' } }),
  });
  const riskPositions = (riskRaw as any)?.data || [];

  const loading = loadingPlans;

  const createMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate('/api/cvision/succession', 'POST', payload),
    onSuccess: () => {
      toast.success(tr('تم إنشاء الخطة', 'Plan created'));
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: cvisionKeys.succession.all });
    },
    onError: (err: any) => toast.error(err.message || 'Error'),
  });

  const handleCreate = async () => {
    if (!form.positionTitle) { toast.error(tr('العنوان مطلوب', 'Title required')); return; }
    createMutation.mutate({ action: 'create', ...form });
  };

  const critVariant = (c: string) => c === 'CRITICAL' ? 'danger' as const : c === 'HIGH' ? 'warning' as const : 'info' as const;
  const readinessVariant = (r: string) => r === 'READY_NOW' ? 'success' as const : r === 'READY_1_YEAR' ? 'info' as const : r === 'READY_2_YEARS' ? 'purple' as const : 'muted' as const;

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('تخطيط التعاقب', 'Succession Planning')} titleEn="Succession Planning" icon={Shield} isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('خطة جديدة', 'New Plan')}
          </CVisionButton>
        }
      />

      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('إجمالي المناصب', 'Total Positions')} value={stats.totalPositions || 0} icon={Users} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('مغطاة', 'Covered')} value={stats.coveredPositions || 0} icon={CheckCircle2} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('التغطية', 'Coverage')} value={`${stats.coverageRate || 0}%`} icon={Shield} color={C.gold} colorDim={C.goldDim} />
        <CVisionMiniStat C={C} label={tr('حرجة', 'Critical')} value={stats.criticalPositions || 0} icon={AlertTriangle} color={C.red} colorDim={C.redDim} />
        <CVisionMiniStat C={C} label={tr('معرضة للخطر', 'At Risk')} value={stats.atRisk || 0} icon={AlertTriangle} color={C.red} colorDim={C.redDim} />
      </CVisionStatsRow>

      {showCreate && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء خطة تعاقب', 'Create Succession Plan')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <CVisionInput C={C} placeholder={tr('عنوان المنصب', 'Position Title')} value={form.positionTitle} onChange={e => setForm({ ...form, positionTitle: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('المسمى الوظيفي', 'المسمى الوظيفي')} value={form.positionTitleAr} onChange={e => setForm({ ...form, positionTitleAr: e.target.value })} style={{ direction: 'rtl' }} />
              </div>
              <CVisionSelect C={C} label={tr('مستوى الأهمية', 'Criticality')} value={form.criticality} onChange={v => setForm({ ...form, criticality: v })} options={['CRITICAL', 'HIGH', 'MEDIUM'].map(c => ({ value: c, label: c }))} />
              <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleCreate}>{tr('إنشاء', 'Create')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {riskPositions.length > 0 && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.red}30` }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.red }}>{tr('خطر: لا يوجد خلفاء جاهزون', 'Risk: No Ready Successors')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {riskPositions.map((p: any) => (
                <div key={p.positionId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <AlertTriangle size={14} color={C.red} />
                  <CVisionBadge C={C} variant={critVariant(p.criticality)}>{p.criticality}</CVisionBadge>
                  <span style={{ color: C.text }}>{p.positionTitle}</span>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map(p => (
          <CVisionCard key={p.positionId} C={C}>
            <CVisionCardBody style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <CVisionBadge C={C} variant={critVariant(p.criticality)}>{p.criticality}</CVisionBadge>
                <span style={{ fontWeight: 500, color: C.text }}>{p.positionTitle}</span>
                {p.positionTitleAr && <span style={{ fontSize: 11, color: C.textMuted }}>({p.positionTitleAr})</span>}
              </div>
              {p.currentIncumbent?.name && (
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                  {tr('الحالي:', 'Current:')} {p.currentIncumbent.name}
                  {p.currentIncumbent.flightRisk && <CVisionBadge C={C} variant="danger" style={{ marginLeft: 6 }}>{tr('خطر مغادرة', 'Flight Risk')}</CVisionBadge>}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(p.successors || []).length === 0
                  ? <span style={{ fontSize: 12, color: C.textMuted }}>{tr('لم يتم تحديد خلفاء', 'No successors identified')}</span>
                  : (p.successors || []).map((s: any) => (
                    <div key={s.employeeId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, paddingLeft: isRTL ? 0 : 16, paddingRight: isRTL ? 16 : 0, borderLeft: isRTL ? 'none' : `2px solid ${C.blue}40`, borderRight: isRTL ? `2px solid ${C.blue}40` : 'none' }}>
                      <Users size={12} color={C.textMuted} />
                      <span style={{ color: C.text }}>{s.name}</span>
                      <CVisionBadge C={C} variant={readinessVariant(s.readiness)}>{s.readiness?.replace(/_/g, ' ')}</CVisionBadge>
                      {s.strengthsGaps?.gaps?.length > 0 && <span style={{ fontSize: 10, color: C.textMuted }}>{tr('فجوات:', 'Gaps:')} {s.strengthsGaps.gaps.join(', ')}</span>}
                    </div>
                  ))}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
