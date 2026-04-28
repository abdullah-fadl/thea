'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea,
  CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow,
  CVisionSkeletonCard, CVisionSelect, CVisionTabs, CVisionTabContent, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Scale, ShieldAlert, CheckCircle2, AlertTriangle, Clock, PlusCircle } from 'lucide-react';

export default function ComplianceSafetyPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();

  const [showIncident, setShowIncident] = useState(false);
  const [incForm, setIncForm] = useState({ location: '', type: 'OTHER', severity: 'MINOR', description: '' });
  const [activeTab, setActiveTab] = useState('compliance');

  const statusVariant = (s: string) => s === 'COMPLETED' ? 'success' as const : s === 'OVERDUE' ? 'danger' as const : s === 'DUE' ? 'warning' as const : 'info' as const;
  const sevVariant = (s: string) => s === 'CRITICAL' || s === 'MAJOR' ? 'danger' as const : s === 'MODERATE' ? 'warning' as const : 'success' as const;
  const authVariant = (a: string) => a === 'GOSI' ? 'info' as const : a === 'MOL' ? 'purple' as const : a === 'SAUDIZATION' ? 'warning' as const : 'muted' as const;

  const safeFetch = (url: string, params: Record<string, string>) =>
    cvisionFetch<any>(url, { params }).catch(() => ({ ok: false }));

  const { data: cData, isLoading: cLoading } = useQuery({
    queryKey: cvisionKeys.compliance.list({ view: 'list' }),
    queryFn: () => safeFetch('/api/cvision/compliance', { action: 'list' }),
  });
  const { data: oData, isLoading: oLoading } = useQuery({
    queryKey: cvisionKeys.compliance.list({ view: 'overdue' }),
    queryFn: () => safeFetch('/api/cvision/compliance', { action: 'overdue' }),
  });
  const { data: iData, isLoading: iLoading } = useQuery({
    queryKey: cvisionKeys.safety.list({ view: 'incidents' }),
    queryFn: () => safeFetch('/api/cvision/safety', { action: 'incidents' }),
  });
  const { data: sData, isLoading: sLoading } = useQuery({
    queryKey: cvisionKeys.safety.list({ view: 'dashboard' }),
    queryFn: () => safeFetch('/api/cvision/safety', { action: 'dashboard' }),
  });

  const compliance = cData?.ok ? (cData.data || []) : [];
  const overdue = oData?.ok ? (oData.data || []) : [];
  const incidents = iData?.ok ? (iData.data || []) : [];
  const safetyStats = sData?.ok ? sData.data : null;
  const loading = cLoading || oLoading || iLoading || sLoading;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: cvisionKeys.compliance.all });
    queryClient.invalidateQueries({ queryKey: cvisionKeys.safety.all });
  };

  const completeMutation = useMutation({
    mutationFn: (itemId: string) => cvisionMutate<any>('/api/cvision/compliance', 'POST', { action: 'complete', itemId }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم الإكمال', 'Completed')), invalidateAll()) : toast.error(d.error); },
  });
  const handleComplete = (itemId: string) => completeMutation.mutate(itemId);

  const incidentMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/safety', 'POST', { action: 'report-incident', ...incForm }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم الإبلاغ عن الحادث', 'Incident reported')), setShowIncident(false), invalidateAll()) : toast.error(d.error); },
  });
  const handleReportIncident = () => {
    if (!incForm.description) { toast.error(tr('الوصف مطلوب', 'Description required')); return; }
    incidentMutation.mutate();
  };

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  const tabs = [
    { id: 'compliance', label: tr('الامتثال', 'Compliance'), labelAr: 'الامتثال', icon: <Scale size={14} /> },
    { id: 'safety', label: tr('السلامة', 'Safety'), labelAr: 'السلامة', icon: <ShieldAlert size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('الامتثال والسلامة', 'Compliance & Safety')} titleEn="Compliance & Safety" icon={Scale} isRTL={isRTL} />
      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="compliance" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {overdue.length > 0 && (
            <CVisionCard C={C} style={{ border: `1px solid ${C.red}30` }}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.red }}>{tr('متأخرة', 'Overdue')} ({overdue.length})</span>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {overdue.map(o => (
                    <div key={o.itemId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                      <AlertTriangle size={14} color={C.red} />
                      <CVisionBadge C={C} variant={authVariant(o.authority)}>{o.authority}</CVisionBadge>
                      <span style={{ color: C.text, flex: 1 }}>{o.title}</span>
                      <span style={{ fontSize: 11, color: C.textMuted }}>{new Date(o.dueDate).toLocaleDateString()}</span>
                      <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" icon={<CheckCircle2 size={12} />} onClick={() => handleComplete(o.itemId)}>{tr('تم', 'Done')}</CVisionButton>
                    </div>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {compliance.map(c => {
              const now = new Date(); const due = new Date(c.dueDate);
              const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
              const status = c.status === 'COMPLETED' ? 'COMPLETED' : daysUntil < 0 ? 'OVERDUE' : daysUntil <= 7 ? 'DUE' : 'UPCOMING';
              return (
                <CVisionCard key={c.itemId} C={C}>
                  <CVisionCardBody style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <CVisionBadge C={C} variant={statusVariant(status)}>{status}</CVisionBadge>
                      <CVisionBadge C={C} variant={authVariant(c.authority)}>{c.authority}</CVisionBadge>
                      <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{c.title}</span>
                      <CVisionBadge C={C} variant="muted">{c.frequency}</CVisionBadge>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{new Date(c.dueDate).toLocaleDateString()}</span>
                      {status !== 'COMPLETED' && <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => handleComplete(c.itemId)}>{tr('إكمال', 'Complete')}</CVisionButton>}
                    </div>
                  </CVisionCardBody>
                </CVisionCard>
              );
            })}
          </div>
        </div>
      </CVisionTabContent>

      <CVisionTabContent id="safety" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {safetyStats && (
            <CVisionStatsRow>
              <CVisionMiniStat C={C} label={tr('إجمالي الحوادث', 'Total Incidents')} value={safetyStats.totalIncidents} icon={ShieldAlert} color={C.blue} colorDim={C.blueDim} />
              <CVisionMiniStat C={C} label={tr('هذا العام', 'This Year')} value={safetyStats.thisYear} icon={Clock} color={C.orange} colorDim={C.orangeDim} />
              <CVisionMiniStat C={C} label={tr('التفتيشات', 'Inspections')} value={safetyStats.totalInspections} icon={Scale} color={C.purple} colorDim={C.purpleDim} />
              <CVisionMiniStat C={C} label={tr('نسبة النجاح', 'Pass Rate')} value={`${safetyStats.inspectionPassRate}%`} icon={CheckCircle2} color={C.green} colorDim={C.greenDim} />
            </CVisionStatsRow>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <CVisionButton C={C} isDark={isDark} variant="primary" icon={<AlertTriangle size={14} />} onClick={() => setShowIncident(!showIncident)}>
              {showIncident ? tr('إلغاء', 'Cancel') : tr('الإبلاغ عن حادث', 'Report Incident')}
            </CVisionButton>
          </div>

          {showIncident && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الإبلاغ عن حادث سلامة', 'Report Safety Incident')}</span>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CVisionInput C={C} placeholder={tr('الموقع', 'Location')} value={incForm.location} onChange={e => setIncForm({ ...incForm, location: e.target.value })} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <CVisionSelect C={C} label={tr('النوع', 'Type')} value={incForm.type} onChange={v => setIncForm({ ...incForm, type: v })} options={['INJURY','NEAR_MISS','PROPERTY_DAMAGE','FIRE','CHEMICAL','OTHER'].map(t => ({ value: t, label: t }))} />
                    <CVisionSelect C={C} label={tr('الخطورة', 'Severity')} value={incForm.severity} onChange={v => setIncForm({ ...incForm, severity: v })} options={['MINOR','MODERATE','MAJOR','CRITICAL'].map(s => ({ value: s, label: s }))} />
                  </div>
                  <CVisionTextarea C={C} placeholder={tr('الوصف', 'Description')} value={incForm.description} onChange={e => setIncForm({ ...incForm, description: e.target.value })} rows={3} />
                  <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleReportIncident}>{tr('إبلاغ', 'Report')}</CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incidents.map(i => (
              <CVisionCard key={i.incidentId} C={C}>
                <CVisionCardBody style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <CVisionBadge C={C} variant={sevVariant(i.severity)}>{i.severity}</CVisionBadge>
                    <CVisionBadge C={C} variant="muted">{i.type}</CVisionBadge>
                    <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{i.location || tr('غير متوفر', 'N/A')}</span>
                    <CVisionBadge C={C} variant={i.status === 'RESOLVED' ? 'success' : 'info'}>{i.status}</CVisionBadge>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{new Date(i.date).toLocaleDateString()}</span>
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description}</p>
                </CVisionCardBody>
              </CVisionCard>
            ))}
          </div>
        </div>
      </CVisionTabContent>
    </CVisionPageLayout>
  );
}
