'use client';

import { useState, useCallback } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionEmptyState, CVisionSkeletonCard,
  CVisionTabs, CVisionTabContent, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import { Workflow, GitBranch, Clock, CheckCircle2, XCircle, AlertTriangle, Play, BarChart3, ArrowRight, CircleDot, Square, Diamond, Bell } from 'lucide-react';

const api = (action: string, params?: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams({ action, ...params });
  return fetch(`/api/cvision/workflows?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};
const post = (body: any) => fetch('/api/cvision/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).then(r => r.json());

const stepTypeIcon: Record<string, any> = { APPROVAL: CheckCircle2, NOTIFICATION: Bell, CONDITION: Diamond, ACTION: Square, PARALLEL: GitBranch };

function stepBadgeVariant(type: string): 'info' | 'purple' | 'warning' | 'success' | 'muted' {
  if (type === 'APPROVAL') return 'info';
  if (type === 'NOTIFICATION') return 'purple';
  if (type === 'CONDITION') return 'warning';
  if (type === 'ACTION') return 'success';
  return 'muted';
}

function instanceBadgeVariant(status: string): 'info' | 'success' | 'danger' | 'muted' | 'warning' {
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'COMPLETED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'ESCALATED') return 'warning';
  return 'muted';
}

function actionColor(action: string, C: any): string {
  if (action === 'APPROVED') return C.green;
  if (action === 'REJECTED') return C.red;
  if (action === 'DELEGATED') return C.blue;
  if (action === 'ESCALATED') return C.orange;
  if (action === 'AUTO') return C.purple;
  return C.textMuted;
}

/* ════ Templates ══════════════════════════════════════════════════ */

function TemplatesTab({ C, isDark, tr, isRTL }: { C: any; isDark: boolean; tr: (a: string, e: string) => string; isRTL: boolean }) {
  const [selected, setSelected] = useState<any>(null);

  const { data: tplRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.workflows.list({ action: 'templates' }),
    queryFn: () => api('templates'),
  });
  const templates = (tplRaw as any)?.templates || [];

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={80} />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {templates.map(t => (
          <CVisionCard key={t.workflowId} C={C} onClick={() => setSelected(t)}>
            <CVisionCardBody>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{t.name}</span>
                <CVisionBadge C={C} variant={t.status === 'ACTIVE' ? 'success' : 'muted'}>{t.status}</CVisionBadge>
              </div>
              {t.nameAr && <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>{t.nameAr}</div>}
              <div style={{ fontSize: 11, color: C.textMuted }}>
                {tr('الوحدة', 'Module')}: {t.module} &middot; {t.steps?.length || 0} {tr('خطوات', 'steps')} &middot; v{t.version}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {(t.steps || []).map((s: any) => {
                  const Icon = stepTypeIcon[s.type] || CircleDot;
                  return <CVisionBadge key={s.stepId} C={C} variant={stepBadgeVariant(s.type)} style={{ fontSize: 10 }}><Icon size={10} style={{ marginRight: 2 }} />{s.type}</CVisionBadge>;
                })}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      <CVisionDialog C={C} open={!!selected} onClose={() => setSelected(null)} title={selected?.name} isRTL={isRTL}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13 }}>
              <div><span style={{ color: C.textMuted }}>{tr('المشغل', 'Trigger')}:</span> <span style={{ color: C.text }}>{selected.triggerEvent}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('الوحدة', 'Module')}:</span> <span style={{ color: C.text }}>{selected.module}</span></div>
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13, color: C.text, marginBottom: 12 }}>{tr('خطوات سير العمل', 'Workflow Steps')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(selected.steps || []).sort((a: any, b: any) => a.order - b.order).map((step: any, idx: number) => {
                  const Icon = stepTypeIcon[step.type] || CircleDot;
                  return (
                    <div key={step.stepId} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.goldDim }}>
                          <Icon size={16} color={C.gold} />
                        </div>
                        {idx < (selected.steps?.length || 0) - 1 && <div style={{ width: 2, height: 24, background: C.border }} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 8 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{step.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>{tr('النوع', 'Type')}: {step.type}</span>
                          {step.approverType && <span>{tr('المعتمد', 'Approver')}: {step.approverType?.replace('_', ' ')}</span>}
                          {step.slaHours && <span>SLA: {step.slaHours}h</span>}
                          {step.condition && <span>{tr('الشرط', 'Condition')}: {step.condition.field} {step.condition.operator} {step.condition.value}</span>}
                          {step.action && <span>{tr('الإجراء', 'Action')}: {step.action.type}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CVisionDialog>
    </div>
  );
}

/* ════ Instances ══════════════════════════════════════════════════ */

function InstancesTab({ C, isDark, tr, isRTL }: { C: any; isDark: boolean; tr: (a: string, e: string) => string; isRTL: boolean }) {
  const [selected, setSelected] = useState<any>(null);

  const { data: instRaw, isLoading: loading, refetch: load } = useQuery({
    queryKey: cvisionKeys.workflows.list({ action: 'instances' }),
    queryFn: () => api('instances'),
  });
  const instances = (instRaw as any)?.instances || [];

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[1,2].map(i => <CVisionSkeletonCard key={i} C={C} height={64} />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {instances.map(inst => (
        <CVisionCard key={inst.instanceId} C={C} onClick={() => setSelected(inst)}>
          <CVisionCardBody style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CVisionBadge C={C} variant="muted" style={{ fontSize: 10 }}>{inst.instanceId}</CVisionBadge>
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{inst.workflowName}</span>
              </div>
              <CVisionBadge C={C} variant={instanceBadgeVariant(inst.status)}>{inst.status?.replace('_', ' ')}</CVisionBadge>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {tr('بواسطة', 'By')} {inst.triggeredByName} &middot; {tr('الحالي', 'Current')}: {inst.currentStepName} &middot; {new Date(inst.startedAt).toLocaleDateString()}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ))}

      <CVisionDialog C={C} open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.workflowName} \u2014 ${selected.instanceId}` : ''} isRTL={isRTL}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: C.textMuted }}>{tr('بواسطة', 'Triggered by')}:</span> <span style={{ color: C.text }}>{selected.triggeredByName}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('المصدر', 'Source')}:</span> <span style={{ color: C.text }}>{selected.sourceModule} / {selected.sourceId}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('الخطوة الحالية', 'Current Step')}:</span> <span style={{ color: C.text }}>{selected.currentStepName}</span></div>
              <div><span style={{ color: C.textMuted }}>{tr('البدء', 'Started')}:</span> <span style={{ color: C.text }}>{new Date(selected.startedAt).toLocaleString()}</span></div>
            </div>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8, color: C.text }}>{tr('سجل الخطوات', 'Step History')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(selected.stepHistory || []).map((s: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: 8, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <span style={{ fontWeight: 500, color: actionColor(s.action, C) }}>{s.action}</span>
                    <span style={{ flex: 1, color: C.text }}>{s.stepName} \u2014 {s.assignedToName}</span>
                    <span style={{ color: C.textMuted }}>{new Date(s.timestamp).toLocaleString()}</span>
                    {s.slaBreached && <CVisionBadge C={C} variant="danger" style={{ fontSize: 10 }}>SLA!</CVisionBadge>}
                  </div>
                ))}
              </div>
            </div>
            {selected.status === 'IN_PROGRESS' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionButton C={C} isDark={isDark} size="sm" variant="primary" icon={<CheckCircle2 size={14} />} onClick={async () => {
                  await post({ action: 'approve-step', instanceId: selected.instanceId, userName: 'Current User' });
                  toast.success(tr('تمت الموافقة', 'Step approved'));
                  setSelected(null); load();
                }}>{tr('موافقة', 'Approve')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} size="sm" variant="danger" icon={<XCircle size={14} />} onClick={async () => {
                  await post({ action: 'reject-step', instanceId: selected.instanceId, userName: 'Current User' });
                  toast.success(tr('تم الرفض', 'Step rejected'));
                  setSelected(null); load();
                }}>{tr('رفض', 'Reject')}</CVisionButton>
              </div>
            )}
          </div>
        )}
      </CVisionDialog>
    </div>
  );
}

/* ════ SLA Report ═════════════════════════════════════════════════ */

function SLAReportTab({ C, isDark, tr }: { C: any; isDark: boolean; tr: (a: string, e: string) => string }) {
  const { data: slaRaw, isLoading: loadingSla } = useQuery({
    queryKey: cvisionKeys.workflows.list({ action: 'sla-report' }),
    queryFn: () => api('sla-report'),
  });
  const report = (slaRaw as any)?.report || null;

  const { data: bnRaw, isLoading: loadingBn } = useQuery({
    queryKey: cvisionKeys.workflows.list({ action: 'bottleneck-analysis' }),
    queryFn: () => api('bottleneck-analysis'),
  });
  const bottlenecks = (bnRaw as any)?.analysis || [];

  const loading = loadingSla || loadingBn;

  if (loading) return <CVisionSkeletonCard C={C} height={160} />;

  const miniStat = (label: string, labelAr: string, value: string | number, color?: string) => (
    <CVisionCard C={C} style={{ flex: '1 1 140px', padding: 16 }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{tr(labelAr, label)}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || C.text }}>{value}</div>
    </CVisionCard>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {report && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {miniStat('Total Instances', 'إجمالي العمليات', report.totalInstances)}
          {miniStat('SLA Compliance', 'الالتزام بـ SLA', `${report.slaComplianceRate}%`, C.green)}
          {miniStat('SLA Breaches', 'انتهاكات SLA', report.slaBreaches, C.red)}
          {miniStat('Avg Duration', 'متوسط المدة', `${report.avgDurationHours}h`)}
        </div>
      )}
      {bottlenecks.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تحليل الاختناقات', 'Bottleneck Analysis')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bottlenecks.map((b: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: 8, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.text }}>{b.step}</span>
                  <CVisionBadge C={C} variant="muted">{b.count} {tr('في الانتظار', 'waiting')}</CVisionBadge>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}

/* ════ Main Page ═══════════════════════════════════════════════════ */

export default function WorkflowBuilderPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('templates');

  const tabs = [
    { id: 'templates', label: 'Templates', labelAr: 'القوالب', icon: <GitBranch size={14} /> },
    { id: 'instances', label: 'Instances', labelAr: 'العمليات', icon: <Play size={14} /> },
    { id: 'sla', label: 'SLA Report', labelAr: 'تقرير SLA', icon: <BarChart3 size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('محرك سير العمل', 'Workflow Engine')} titleEn="Workflow Engine" icon={Workflow} isRTL={isRTL}
        subtitle={tr('القوالب والعمليات والموافقات وتتبع SLA', 'Templates, instances, approvals & SLA tracking')}
      />
      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="templates" activeTab={activeTab}><TemplatesTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} /></CVisionTabContent>
      <CVisionTabContent id="instances" activeTab={activeTab}><InstancesTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} /></CVisionTabContent>
      <CVisionTabContent id="sla" activeTab={activeTab}><SLAReportTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
    </CVisionPageLayout>
  );
}
