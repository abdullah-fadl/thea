'use client';

import { useState, useCallback } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionTextarea, CVisionPageHeader, CVisionPageLayout,
  CVisionMiniStat, CVisionStatsRow, CVisionEmptyState, CVisionSkeleton, CVisionSkeletonCard,
  CVisionTabs, CVisionTabContent, CVisionSelect,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd,
  CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import { ShieldAlert, AlertTriangle, ClipboardCheck, HardHat, Flame, BarChart3, Plus, Eye, XCircle, CheckCircle2 } from 'lucide-react';

const api = (action: string, params?: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams({ action, ...params });
  return fetch(`/api/cvision/safety?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};
const post = (body: any) => fetch('/api/cvision/safety', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).then(r => r.json());

/* ════ Dashboard ═══════════════════════════════════════════════════ */

function DashboardTab({ C, isDark, tr }: any) {
  const { data: raw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.safety.list({ action: 'dashboard' }),
    queryFn: () => api('dashboard'),
  });
  const data = (raw as any)?.dashboard || null;

  if (loading) return <CVisionStatsRow>{[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={90} style={{ flex: '1 1 200px' }} />)}</CVisionStatsRow>;
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('إجمالي الحوادث', 'Total Incidents')} value={data.totalIncidents} icon={ShieldAlert} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('حوادث مفتوحة', 'Open Incidents')} value={data.openIncidents} icon={AlertTriangle} color={C.orange} colorDim={C.orangeDim} />
        <CVisionMiniStat C={C} label={tr('إجراءات متأخرة', 'Overdue Actions')} value={data.overdueActionsCount} icon={XCircle} color={C.red} colorDim={C.redDim} />
        <CVisionMiniStat C={C} label={tr('تفتيشات متأخرة', 'Overdue Inspections')} value={data.overdueInspectionsCount} icon={ClipboardCheck} color={C.orange} colorDim={C.orangeDim} />
      </CVisionStatsRow>
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الحوادث حسب الخطورة', 'Incidents by Severity')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(data.bySeverity || {}).map(([sev, count]) => (
              <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CVisionBadge C={C} variant={sev === 'CRITICAL' || sev === 'FATAL' ? 'danger' : sev === 'MAJOR' ? 'warning' : sev === 'MODERATE' ? 'warning' : 'success'}>{sev}</CVisionBadge>
                <span style={{ fontWeight: 700, color: C.text }}>{count as number}</span>
              </div>
            ))}
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

/* ════ Incidents ═══════════════════════════════════════════════════ */

function IncidentsTab({ C, isDark, tr, isRTL }: any) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({ title: '', description: '', type: 'NEAR_MISS', severity: 'MINOR', location: '' });

  const { data: incRaw, isLoading: loading, refetch: load } = useQuery({
    queryKey: cvisionKeys.safety.list({ action: 'incidents' }),
    queryFn: () => api('incidents'),
  });
  const incidents = (incRaw as any)?.incidents || [];

  const sevVariant = (s: string) => s === 'CRITICAL' || s === 'FATAL' ? 'danger' as const : s === 'MAJOR' || s === 'MODERATE' ? 'warning' as const : 'success' as const;
  const statusVariant = (s: string) => s === 'REPORTED' ? 'info' as const : s === 'INVESTIGATING' ? 'warning' as const : s === 'CLOSED' ? 'muted' as const : 'warning' as const;

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={60} />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowReport(true)}>{tr('الإبلاغ عن حادث', 'Report Incident')}</CVisionButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {incidents.map(inc => (
          <CVisionCard key={inc.incidentId} C={C} onClick={() => setSelected(inc)} style={{ cursor: 'pointer' }}>
            <CVisionCardBody style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CVisionBadge C={C} variant="muted">{inc.incidentId}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{inc.title}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CVisionBadge C={C} variant={sevVariant(inc.severity)}>{inc.severity}</CVisionBadge>
                  <CVisionBadge C={C} variant={statusVariant(inc.status)}>{inc.status}</CVisionBadge>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                {inc.type} &middot; {inc.location} &middot; {new Date(inc.dateTime).toLocaleDateString()} &middot; {tr('أبلغ عنه', 'Reported by')} {inc.reportedByName}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      {/* Incident detail dialog */}
      <CVisionDialog C={C} open={!!selected} onClose={() => setSelected(null)} title={selected?.title} isRTL={isRTL}>
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
            <p style={{ color: C.textSecondary }}>{selected.description}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: C.textMuted }}>{tr('النوع:', 'Type:')}</span> {selected.type}</div>
              <div><span style={{ color: C.textMuted }}>{tr('الخطورة:', 'Severity:')}</span> <CVisionBadge C={C} variant={sevVariant(selected.severity)}>{selected.severity}</CVisionBadge></div>
              <div><span style={{ color: C.textMuted }}>{tr('الموقع:', 'Location:')}</span> {selected.location}</div>
              <div><span style={{ color: C.textMuted }}>{tr('مطالبة GOSI:', 'GOSI Claim:')}</span> {selected.gosiClaimFiled ? `${tr('نعم', 'Yes')} (${selected.gosiClaimNumber})` : tr('لا', 'No')}</div>
            </div>
            {selected.rootCause && <div><span style={{ fontWeight: 500, color: C.text }}>{tr('السبب الجذري:', 'Root Cause:')}</span> <span style={{ color: C.textSecondary }}>{selected.rootCause}</span></div>}
            {(selected.affectedEmployees || []).length > 0 && (
              <div>
                <span style={{ fontWeight: 500, color: C.text }}>{tr('الموظفون المتأثرون:', 'Affected Employees:')}</span>
                {selected.affectedEmployees.map((e: any, i: number) => (
                  <div key={i} style={{ fontSize: 12, color: C.textSecondary, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0 }}>{e.employeeName} {e.injuryType ? `— ${e.injuryType}` : ''} {e.daysOff ? `(${e.daysOff} ${tr('أيام إجازة', 'days off')})` : ''}</div>
                ))}
              </div>
            )}
            {(selected.correctiveActions || []).length > 0 && (
              <div>
                <span style={{ fontWeight: 500, color: C.text }}>{tr('الإجراءات التصحيحية:', 'Corrective Actions:')}</span>
                {selected.correctiveActions.map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: isRTL ? 0 : 8, marginRight: isRTL ? 8 : 0, marginTop: 4 }}>
                    {a.status === 'COMPLETED' ? <CheckCircle2 size={12} color={C.green} /> : <XCircle size={12} color={C.orange} />}
                    <span style={{ flex: 1, color: C.textSecondary }}>{a.action}</span>
                    <CVisionBadge C={C} variant="muted">{a.status}</CVisionBadge>
                  </div>
                ))}
              </div>
            )}
            {selected.status !== 'CLOSED' && (
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={async () => {
                await post({ action: 'close-incident', incidentId: selected.incidentId });
                toast.success(tr('تم إغلاق الحادث', 'Incident closed'));
                setSelected(null); load();
              }}>{tr('إغلاق الحادث', 'Close Incident')}</CVisionButton>
            )}
          </div>
        )}
      </CVisionDialog>

      {/* Report incident dialog */}
      <CVisionDialog C={C} open={showReport} onClose={() => setShowReport(false)} title={tr('الإبلاغ عن حادث', 'Report Incident')} titleAr="الإبلاغ عن حادث" isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CVisionInput C={C} placeholder={tr('العنوان', 'Title')} value={reportForm.title} onChange={e => setReportForm(f => ({ ...f, title: e.target.value }))} />
          <CVisionTextarea C={C} placeholder={tr('الوصف', 'Description')} value={reportForm.description} onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))} rows={3} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <CVisionSelect C={C} label={tr('النوع', 'Type')} value={reportForm.type} onChange={v => setReportForm(f => ({ ...f, type: v }))} options={['ACCIDENT','NEAR_MISS','UNSAFE_CONDITION','OCCUPATIONAL_ILLNESS','PROPERTY_DAMAGE','ENVIRONMENTAL'].map(t => ({ value: t, label: t.replace(/_/g, ' ') }))} />
            <CVisionSelect C={C} label={tr('الخطورة', 'Severity')} value={reportForm.severity} onChange={v => setReportForm(f => ({ ...f, severity: v }))} options={['MINOR','MODERATE','MAJOR','CRITICAL','FATAL'].map(s => ({ value: s, label: s }))} />
          </div>
          <CVisionInput C={C} placeholder={tr('الموقع', 'Location')} value={reportForm.location} onChange={e => setReportForm(f => ({ ...f, location: e.target.value }))} />
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={async () => {
            await post({ action: 'report-incident', ...reportForm, dateTime: new Date(), reportedBy: 'EMP-001', reportedByName: 'Current User', affectedEmployees: [] });
            toast.success(tr('تم الإبلاغ عن الحادث', 'Incident reported'));
            setShowReport(false); setReportForm({ title: '', description: '', type: 'NEAR_MISS', severity: 'MINOR', location: '' });
            load();
          }}>{tr('إرسال التقرير', 'Submit Report')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

/* ════ Inspections ════════════════════════════════════════════════ */

function InspectionsTab({ C, isDark, tr }: any) {
  const { data: insRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.safety.list({ action: 'inspections' }),
    queryFn: () => api('inspections'),
  });
  const inspections = (insRaw as any)?.inspections || [];

  if (loading) return <CVisionSkeletonCard C={C} height={140} />;

  const inspStatusVariant = (s: string) => s === 'COMPLETED' ? 'success' as const : s === 'SCHEDULED' ? 'info' as const : 'danger' as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {inspections.map(ins => (
        <CVisionCard key={ins.inspectionId} C={C}>
          <CVisionCardBody style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CVisionBadge C={C} variant="muted">{ins.inspectionId}</CVisionBadge>
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{ins.type?.replace('_', ' ')}</span>
              </div>
              <CVisionBadge C={C} variant={inspStatusVariant(ins.status)}>{ins.status}</CVisionBadge>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {ins.location} &middot; {ins.inspectorName} &middot; {new Date(ins.inspectionDate).toLocaleDateString()}
              {ins.passRate > 0 && <> &middot; {tr('نسبة النجاح:', 'Pass Rate:')} <span style={{ color: ins.passRate >= 80 ? C.green : C.red }}>{ins.passRate}%</span></>}
            </div>
            {(ins.findings || []).length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: C.orange }}>{tr('النتائج:', 'Findings:')} {ins.findings.join('; ')}</div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

/* ════ PPE Tab ════════════════════════════════════════════════════ */

function PPETab({ C, isDark, tr }: any) {
  const { data: ppeRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.safety.list({ action: 'ppe-records' }),
    queryFn: () => api('ppe-records'),
  });
  const records = (ppeRaw as any)?.records || [];

  if (loading) return <CVisionSkeletonCard C={C} height={140} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {records.map((rec, i) => (
        <CVisionCard key={i} C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
              <HardHat size={16} color={C.gold} /> {rec.employeeName} <span style={{ color: C.textMuted, fontWeight: 400 }}>({rec.employeeId})</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('العنصر', 'Item')}</CVisionTh>
                <CVisionTh C={C}>{tr('الكمية', 'Qty')}</CVisionTh>
                <CVisionTh C={C}>{tr('الحالة', 'Condition')}</CVisionTh>
                <CVisionTh C={C}>{tr('تاريخ الإصدار', 'Issued')}</CVisionTh>
                <CVisionTh C={C}>{tr('تاريخ الانتهاء', 'Expiry')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {(rec.items || []).map((item: any, j: number) => (
                  <CVisionTr key={j} C={C}>
                    <CVisionTd style={{ fontSize: 12, color: C.text }}>{item.itemName}</CVisionTd>
                    <CVisionTd style={{ fontSize: 12, color: C.text }}>{item.quantity}</CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant="muted">{item.condition}</CVisionBadge></CVisionTd>
                    <CVisionTd style={{ fontSize: 12, color: C.textSecondary }}>{new Date(item.issuedDate).toLocaleDateString()}</CVisionTd>
                    <CVisionTd style={{ fontSize: 12, color: C.textSecondary }}>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}</CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

/* ════ Main Page ═══════════════════════════════════════════════════ */

export default function SafetyPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', labelAr: 'لوحة المعلومات', icon: <BarChart3 size={14} /> },
    { id: 'incidents', label: 'Incidents', labelAr: 'الحوادث', icon: <AlertTriangle size={14} /> },
    { id: 'inspections', label: 'Inspections', labelAr: 'التفتيشات', icon: <ClipboardCheck size={14} /> },
    { id: 'ppe', label: 'PPE', labelAr: 'معدات الوقاية', icon: <HardHat size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('السلامة المهنية', 'Occupational Health & Safety')} titleEn="Occupational Health & Safety" icon={ShieldAlert} isRTL={isRTL} subtitle={tr('الحوادث، التفتيشات، معدات الوقاية والامتثال', 'Incidents, inspections, PPE & compliance')} />
      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />
      <CVisionTabContent id="dashboard" activeTab={activeTab}><DashboardTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
      <CVisionTabContent id="incidents" activeTab={activeTab}><IncidentsTab C={C} isDark={isDark} tr={tr} isRTL={isRTL} /></CVisionTabContent>
      <CVisionTabContent id="inspections" activeTab={activeTab}><InspectionsTab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
      <CVisionTabContent id="ppe" activeTab={activeTab}><PPETab C={C} isDark={isDark} tr={tr} /></CVisionTabContent>
    </CVisionPageLayout>
  );
}
