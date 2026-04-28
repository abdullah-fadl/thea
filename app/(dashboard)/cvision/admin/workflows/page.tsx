'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionTabs, CVisionSkeletonCard, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { ArrowRight, Check, GitBranch, Clock, X, RotateCcw } from 'lucide-react';

interface Step { stepNumber: number; type: string; name: string; nameAr?: string; assigneeType?: string; slaHours?: number; condition?: any }
interface Workflow { workflowId: string; name: string; nameAr: string; triggerType: string; isActive: boolean; steps: Step[] }
interface PendingItem { instanceId: string; workflowName: string; resourceType: string; resourceId: string; requesterName: string; currentStep: number; startedAt: string; stepHistory: any[] }

const STEP_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'purple' | 'muted'> = {
  APPROVAL: 'info',
  CONDITION: 'warning',
  ACTION: 'success',
  NOTIFICATION: 'purple',
  PARALLEL: 'muted',
};

export default function WorkflowsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('templates');

  const { data: wData, isLoading: wLoading } = useQuery({
    queryKey: cvisionKeys.workflows.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/workflows', { params: { action: 'list' } }),
  });
  const { data: pData, isLoading: pLoading } = useQuery({
    queryKey: ['cvision', 'workflow-instances', 'my-pending'],
    queryFn: () => cvisionFetch<any>('/api/cvision/workflow-instances', { params: { action: 'my-pending' } }),
  });

  const workflows = wData?.ok ? (wData.data || []) as Workflow[] : [];
  const pending = pData?.ok ? (pData.data || []) as PendingItem[] : [];
  const loading = wLoading || pLoading;

  const actionMutation = useMutation({
    mutationFn: ({ instanceId, act }: { instanceId: string; act: string }) =>
      cvisionMutate<any>('/api/cvision/workflow-instances', 'POST', { action: act, instanceId }),
    onSuccess: (d, { act }) => {
      d.ok ? toast.success(tr(`${act} تم بنجاح`, `${act} success`)) : toast.error(d.error);
      queryClient.invalidateQueries({ queryKey: cvisionKeys.workflows.all });
      queryClient.invalidateQueries({ queryKey: ['cvision', 'workflow-instances'] });
    },
  });

  const handleAction = (instanceId: string, act: string) => actionMutation.mutate({ instanceId, act });

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} /><CVisionSkeletonCard C={C} /></CVisionPageLayout>;

  const tabs = [
    { key: 'templates', label: tr('القوالب', 'Templates'), icon: <GitBranch size={14} /> },
    { key: 'pending', label: `${tr('المعلقة', 'My Pending')} (${pending.length})`, icon: <Clock size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('محرك سير العمل', 'Workflow Engine')} titleEn="Workflow Engine" icon={GitBranch} iconColor={C.purple} isRTL={isRTL} />

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'templates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {workflows.map(wf => (
            <CVisionCard C={C} key={wf.workflowId}>
              <CVisionCardBody style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 500, color: C.text, fontSize: 13 }}>{wf.name}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>({wf.nameAr})</span>
                  <CVisionBadge C={C} variant="muted">{wf.triggerType}</CVisionBadge>
                  <CVisionBadge C={C} variant={wf.isActive ? 'success' : 'muted'}>{wf.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  {wf.steps.map((s, i) => (
                    <div key={s.stepNumber} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && <ArrowRight size={12} color={C.textMuted} />}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <CVisionBadge C={C} variant={STEP_VARIANT[s.type] || 'muted'}>
                          {s.name}
                        </CVisionBadge>
                        {s.assigneeType && <span style={{ fontSize: 9, color: C.textMuted }}>{s.assigneeType}</span>}
                        {s.slaHours && <span style={{ fontSize: 9, color: C.textMuted }}>{s.slaHours}h SLA</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}

      {activeTab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pending.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontSize: 13 }}>
              {tr('لا توجد موافقات معلقة', 'No pending approvals.')}
            </div>
          )}
          {pending.map(p => (
            <CVisionCard C={C} key={p.instanceId}>
              <CVisionCardBody style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CVisionBadge C={C} variant="muted">{p.resourceType}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{p.workflowName}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{tr('بواسطة', 'by')} {p.requesterName}</span>
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>{tr('خطوة', 'Step')} {p.currentStep}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => handleAction(p.instanceId, 'approve')} icon={<Check size={12} />}>
                    {tr('موافقة', 'Approve')}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" onClick={() => handleAction(p.instanceId, 'reject')} icon={<X size={12} />}>
                    {tr('رفض', 'Reject')}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => handleAction(p.instanceId, 'return')} icon={<RotateCcw size={12} />}>
                    {tr('إرجاع', 'Return')}
                  </CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}
    </CVisionPageLayout>
  );
}
