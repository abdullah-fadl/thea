'use client';

import { useState } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard,
  CVisionSelect, type CVisionSelectOption, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import { UserPlus, UserMinus, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

const CATEGORY_COLORS: Record<string, { variant: 'info' | 'purple' | 'success' | 'warning' | 'muted' | 'danger' | 'default' }> = {
  HR: { variant: 'info' }, IT: { variant: 'purple' }, FACILITIES: { variant: 'success' },
  DEPARTMENT: { variant: 'warning' }, TRAINING: { variant: 'success' }, FINANCE: { variant: 'default' },
};

export default function OnboardingPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showStart, setShowStart] = useState(false);
  const [form, setForm] = useState({ employeeId: '', employeeName: '', type: 'ONBOARDING' });
  const [detail, setDetail] = useState<any>(null);

  const { data: instancesRaw, isLoading: loadingInstances } = useQuery({
    queryKey: cvisionKeys.onboarding.list({ action: 'list' }),
    queryFn: () => cvisionFetch('/api/cvision/onboarding', { params: { action: 'list' } }),
  });
  const instances = (instancesRaw as any)?.data || [];

  const { data: statsRaw } = useQuery({
    queryKey: cvisionKeys.onboarding.list({ action: 'dashboard' }),
    queryFn: () => cvisionFetch('/api/cvision/onboarding', { params: { action: 'dashboard' } }),
  });
  const stats = (statsRaw as any)?.data || { inProgress: 0, overdue: 0, completed: 0 };

  const loading = loadingInstances;

  const startMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate('/api/cvision/onboarding', 'POST', payload),
    onSuccess: () => {
      toast.success(tr('تم البدء', 'Started'));
      setShowStart(false);
      queryClient.invalidateQueries({ queryKey: cvisionKeys.onboarding.all });
    },
    onError: (err: any) => toast.error(err.message || 'Error'),
  });

  const handleStart = async () => {
    if (!form.employeeId) { toast.error(tr('رقم الموظف مطلوب', 'Employee ID required')); return; }
    startMutation.mutate({ action: 'start', ...form });
  };

  const completeTaskMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate('/api/cvision/onboarding', 'POST', payload),
    onSuccess: async (d: any, variables: any) => {
      toast.success(`${tr('اكتملت المهمة', 'Task completed')} (${d.data?.completionPercentage}%)`);
      if (detail) {
        const dd = await cvisionFetch<any>(`/api/cvision/onboarding`, { params: { action: 'detail', id: variables.instanceId } });
        if (dd.ok) setDetail(dd.data);
      }
      queryClient.invalidateQueries({ queryKey: cvisionKeys.onboarding.all });
    },
    onError: (err: any) => toast.error(err.message || 'Error'),
  });

  const handleComplete = async (instanceId: string, taskId: string) => {
    completeTaskMutation.mutate({ action: 'complete-task', instanceId, taskId });
  };

  const typeOptions: CVisionSelectOption[] = [
    { value: 'ONBOARDING', label: tr('تعيين جديد', 'Onboarding') },
    { value: 'OFFBOARDING', label: tr('إنهاء خدمة', 'Offboarding') },
  ];

  if (loading) return <div style={{ padding: 24 }}><CVisionSkeletonCard C={C} height={260} /></div>;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('التعيين / إنهاء الخدمة', 'Onboarding / Offboarding')}
        titleEn="Onboarding / Offboarding"
        icon={UserPlus}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant={showStart ? 'outline' : 'primary'} onClick={() => setShowStart(!showStart)}>
            {showStart ? tr('إلغاء', 'Cancel') : tr('بدء جديد', 'Start New')}
          </CVisionButton>
        }
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <CVisionCard C={C}><CVisionCardBody>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <Clock size={20} color={C.blue} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{stats.inProgress}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{tr('قيد التنفيذ', 'In Progress')}</div>
          </div>
        </CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <AlertTriangle size={20} color={C.red} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: C.red }}>{stats.overdue}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{tr('متأخرة', 'Overdue')}</div>
          </div>
        </CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <CheckCircle2 size={20} color={C.green} style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{stats.completed}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مكتملة', 'Completed')}</div>
          </div>
        </CVisionCardBody></CVisionCard>
      </div>

      {/* Start Form */}
      {showStart && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('بدء تعيين / إنهاء خدمة', 'Start Onboarding/Offboarding')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionInput C={C} placeholder={tr('رقم الموظف', 'Employee ID')} value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} />
              <CVisionInput C={C} placeholder={tr('اسم الموظف', 'Employee Name')} value={form.employeeName} onChange={e => setForm({ ...form, employeeName: e.target.value })} />
              <CVisionSelect C={C} options={typeOptions} value={form.type} onChange={v => setForm({ ...form, type: v })} />
              <CVisionButton C={C} isDark={isDark} onClick={handleStart}>{tr('بدء', 'Start')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Detail View */}
      {detail && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{detail.employeeName} — {detail.type} ({detail.completionPercentage}%)</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            {/* Progress bar */}
            <div style={{ width: '100%', background: C.bgSubtle, borderRadius: 999, height: 8, marginBottom: 12 }}>
              <div style={{ width: `${detail.completionPercentage}%`, background: C.blue, height: 8, borderRadius: 999, transition: 'all 0.3s' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(detail.tasks || []).map((t: any) => {
                const overdue = t.status !== 'COMPLETED' && new Date(t.dueDate) < new Date();
                return (
                  <div key={t.taskId} style={{
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, paddingBottom: 6,
                    borderBottom: `1px solid ${C.border}`,
                    background: overdue ? C.redDim : 'transparent', padding: overdue ? 6 : 0, borderRadius: overdue ? 6 : 0,
                  }}>
                    {t.status === 'COMPLETED'
                      ? <CheckCircle2 size={16} color={C.green} style={{ flexShrink: 0 }} />
                      : <button onClick={() => handleComplete(detail.instanceId, t.taskId)} style={{ width: 16, height: 16, border: `1px solid ${C.border}`, borderRadius: 4, background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
                    }
                    <CVisionBadge C={C} variant={CATEGORY_COLORS[t.category]?.variant || 'muted'} style={{ fontSize: 9, flexShrink: 0 }}>{t.category}</CVisionBadge>
                    <span style={{ color: t.status === 'COMPLETED' ? C.textMuted : C.text, textDecoration: t.status === 'COMPLETED' ? 'line-through' : 'none' }}>{t.title}</span>
                    {overdue && <CVisionBadge C={C} variant="danger" style={{ fontSize: 9 }}>{tr('متأخرة', 'Overdue')}</CVisionBadge>}
                  </div>
                );
              })}
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setDetail(null)} style={{ marginTop: 12 }}>{tr('إغلاق', 'Close')}</CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Instances List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {instances.map(inst => (
          <CVisionCard C={C} key={inst.instanceId} hover onClick={async () => {
            const r = await fetch(`/api/cvision/onboarding?action=detail&id=${inst.instanceId}`, { credentials: 'include' }); const d = await r.json();
            if (d.ok) setDetail(d.data);
          }}>
            <CVisionCardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {inst.type === 'ONBOARDING' ? <UserPlus size={16} color={C.green} /> : <UserMinus size={16} color={C.red} />}
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{inst.employeeName}</span>
                <CVisionBadge C={C} variant="muted" style={{ fontSize: 9 }}>{inst.type}</CVisionBadge>
                <CVisionBadge C={C} variant={inst.status === 'COMPLETED' ? 'success' : 'info'} style={{ fontSize: 9 }}>{inst.status}</CVisionBadge>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{inst.completionPercentage || 0}%</span>
              </div>
              <div style={{ width: '100%', background: C.bgSubtle, borderRadius: 999, height: 6, marginTop: 6 }}>
                <div style={{ width: `${inst.completionPercentage || 0}%`, background: C.blue, height: 6, borderRadius: 999 }} />
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
