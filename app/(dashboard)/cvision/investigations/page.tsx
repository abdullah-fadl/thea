'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Scale, Plus, FileText, AlertTriangle, Clock, CheckCircle2,
  Users, Calendar, Shield, ChevronRight, XCircle,
  DollarSign, Gavel, Eye, MessageSquare,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Investigation {
  id: string;
  investigationId: string;
  disciplinaryId?: string;
  employeeId: string;
  employeeName: string;
  department: string;
  incidentDate: string;
  incidentType: string;
  incidentDescription: string;
  incidentLocation?: string;
  reportedBy: string;
  reportedByName: string;
  reportedDate: string;
  investigator: string;
  investigatorName: string;
  status: string;
  evidence: { id: string; type: string; description: string; addedBy: string; addedAt: string }[];
  witnesses: { id: string; name: string; statement: string; statementDate: string }[];
  hearing: {
    scheduledDate?: string; scheduledTime?: string; location?: string;
    attendees: string[]; employeeResponse?: string; employeeAttended?: boolean;
    hearingNotes?: string; completedAt?: string;
  };
  decision: {
    outcome: string; decidedBy: string; decidedByName: string; decidedAt?: string;
    reasoning: string;
    deduction?: { type: string; amount?: number; days?: number; effectiveMonth: string; calculatedAmount: number; description: string };
    suspension?: { startDate: string; endDate: string; withPay: boolean };
  };
  appeal?: { filedDate: string; reason: string; outcome?: string };
  timeline: { date: string; action: string; actionAr: string; by: string; details?: string }[];
  laborLawArticle?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

interface Deduction {
  id: string;
  deductionId: string;
  investigationId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  type: string;
  days?: number;
  calculatedAmount: number;
  dailyRate: number;
  effectiveMonth: string;
  description: string;
  laborLawArticle: string;
  status: string;
  appliedAt?: string;
  createdAt: string;
}

interface Stats {
  total: number; open: number; closed: number; dismissed: number;
  byType: { type: string; count: number }[];
  byOutcome: { outcome: string; count: number }[];
  byStatus: { status: string; count: number }[];
  avgResolutionDays: number;
  pendingDeductions: number;
  totalDeductionAmount: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const getStatusStyles = (tr: (ar: string, en: string) => string): Record<string, { label: string; color: string; icon: typeof Clock }> => ({
  REPORTED: { label: tr('تم الإبلاغ', 'Reported'), color: 'bg-blue-100 text-blue-800', icon: FileText },
  UNDER_INVESTIGATION: { label: tr('قيد التحقيق', 'Investigating'), color: 'bg-yellow-100 text-yellow-800', icon: Eye },
  HEARING_SCHEDULED: { label: tr('جلسة استماع', 'Hearing'), color: 'bg-purple-100 text-purple-800', icon: Calendar },
  HEARING_COMPLETED: { label: tr('تم الاستماع', 'Heard'), color: 'bg-indigo-100 text-indigo-800', icon: MessageSquare },
  DECISION_PENDING: { label: tr('معلق', 'Pending'), color: 'bg-orange-100 text-orange-800', icon: Clock },
  DECISION_MADE: { label: tr('تم البت', 'Decided'), color: 'bg-teal-100 text-teal-800', icon: Gavel },
  APPEAL: { label: tr('استئناف', 'Appeal'), color: 'bg-pink-100 text-pink-800', icon: Scale },
  CLOSED: { label: tr('مغلق', 'Closed'), color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  DISMISSED: { label: tr('مرفوض', 'Dismissed'), color: 'bg-gray-100 text-gray-600', icon: XCircle },
});

const INCIDENT_LABELS: Record<string, string> = {
  ATTENDANCE: 'Attendance', MISCONDUCT: 'Misconduct', POLICY_VIOLATION: 'Policy Violation',
  PERFORMANCE: 'Performance', HARASSMENT: 'Harassment', SAFETY: 'Safety',
  THEFT: 'Theft/Fraud', INSUBORDINATION: 'Insubordination', OTHER: 'Other',
};

const OUTCOME_LABELS: Record<string, string> = {
  NO_ACTION: 'No Action', VERBAL_WARNING: 'Verbal Warning', WRITTEN_WARNING: 'Written Warning',
  FINAL_WARNING: 'Final Warning', SALARY_DEDUCTION: 'Salary Deduction',
  SUSPENSION: 'Suspension', DEMOTION: 'Demotion', TERMINATION: 'Termination',
};

// ─── API ────────────────────────────────────────────────────────────────────

function fetchInv(action: string, params?: Record<string, string>) {
  const sp = new URLSearchParams({ action, ...params });
  return cvisionFetch(`/api/cvision/investigations?${sp}`);
}

function postInv(body: Record<string, any>) {
  return cvisionMutate('/api/cvision/investigations', 'POST', body);
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d === 0) return 'Today';
  if (d === 1) return '1 day ago';
  if (d < 30) return `${d} days ago`;
  return `${Math.floor(d / 30)} months ago`;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function InvestigationsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const STATUS_STYLES = getStatusStyles(tr);

  const [tab, setTab] = useState('active');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Scale style={{ height: 24, width: 24 }} /> Investigations
        </h1>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>Investigation workflow and salary deductions</p>
      </div>
      <CVisionTabs
        C={C}
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'active', label: tr('الحالات النشطة', 'Active Cases'), icon: <FileText style={{ height: 16, width: 16 }} /> },
          { id: 'all', label: tr('كل الحالات', 'All Cases'), icon: <Scale style={{ height: 16, width: 16 }} /> },
          { id: 'deductions', label: tr('الخصومات', 'Deductions'), icon: <DollarSign style={{ height: 16, width: 16 }} /> },
        ]}
      >
        <CVisionTabContent tabId="active"><ActiveCasesTab /></CVisionTabContent>
        <CVisionTabContent tabId="all"><AllCasesTab /></CVisionTabContent>
        <CVisionTabContent tabId="deductions"><DeductionsTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: Active Cases
// ═══════════════════════════════════════════════════════════════════════════

function ActiveCasesTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const STATUS_STYLES = getStatusStyles(tr);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Investigation | null>(null);
  const [decisionOpen, setDecisionOpen] = useState(false);

  const { data: caseRes, isLoading: loadingCases, refetch: load } = useQuery({
    queryKey: cvisionKeys.investigations.list({ action: 'list' }),
    queryFn: () => fetchInv('list'),
  });
  const openStatuses = ['REPORTED', 'UNDER_INVESTIGATION', 'HEARING_SCHEDULED', 'HEARING_COMPLETED', 'DECISION_PENDING', 'APPEAL'];
  const cases: Investigation[] = ((caseRes as any)?.investigations || []).filter((c: Investigation) => openStatuses.includes(c.status));

  const { data: statRes } = useQuery({
    queryKey: cvisionKeys.investigations.list({ action: 'stats' }),
    queryFn: () => fetchInv('stats'),
  });
  const stats: Stats | null = (statRes as any)?.stats || null;

  const loading = loadingCases;

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 160, borderRadius: 12 }}  />)}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {[
            { label: tr('تم الإبلاغ', 'Reported'), value: stats.byStatus.find(s => s.status === 'REPORTED')?.count || 0, color: 'text-blue-600' },
            { label: tr('قيد التحقيق', 'Investigating'), value: stats.byStatus.find(s => s.status === 'UNDER_INVESTIGATION')?.count || 0, color: 'text-yellow-600' },
            { label: tr('جلسة استماع', 'Hearing'), value: (stats.byStatus.find(s => s.status === 'HEARING_SCHEDULED')?.count || 0) + (stats.byStatus.find(s => s.status === 'HEARING_COMPLETED')?.count || 0), color: 'text-purple-600' },
            { label: tr('معلق', 'Pending'), value: stats.byStatus.find(s => s.status === 'DECISION_PENDING')?.count || 0, color: 'text-orange-600' },
            { label: tr('مفتوح', 'Total Open'), value: stats.open, color: 'text-red-600' },
          ].map(s => (
            <CVisionCard C={C} key={s.label}><CVisionCardBody style={{ padding: 12, textAlign: 'center' }}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{s.label}</div>
            </CVisionCardBody></CVisionCard>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CVisionButton C={C} isDark={isDark} onClick={() => setCreateOpen(true)}><Plus style={{ height: 16, width: 16, marginRight: 6 }} />New Investigation</CVisionButton>
      </div>

      {/* Case Cards */}
      {cases.length === 0 ? (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>No active investigations.</CVisionCardBody></CVisionCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cases.map(inv => {
            const st = STATUS_STYLES[inv.status] || STATUS_STYLES.REPORTED;
            return (
              <CVisionCard C={C} key={inv.id} className="hover:shadow-md transition-shadow">
                <CVisionCardBody style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 500 }}>{inv.investigationId}</span>
                      <CVisionBadge C={C} className={st.color} variant="secondary">{st.label}</CVisionBadge>
                      <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{INCIDENT_LABELS[inv.incidentType] || inv.incidentType}</CVisionBadge>
                    </div>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{timeAgo(inv.createdAt)}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                    <p><Users style={{ height: 14, width: 14, marginRight: 4, color: C.textMuted }} /><strong>{inv.employeeName}</strong> — {inv.department}</p>
                    <p style={{ color: C.textMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{inv.incidentDescription}</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                      <span><Eye style={{ height: 12, width: 12, marginRight: 2 }} />Investigator: {inv.investigatorName || 'Unassigned'}</span>
                      <span><FileText style={{ height: 12, width: 12, marginRight: 2 }} />Evidence: {inv.evidence?.length || 0}</span>
                      <span><Users style={{ height: 12, width: 12, marginRight: 2 }} />Witnesses: {inv.witnesses?.length || 0}</span>
                      {inv.laborLawArticle && <span><Shield style={{ height: 12, width: 12, marginRight: 2 }} />{inv.laborLawArticle}</span>}
                    </div>
                  </div>

                  {/* Mini timeline */}
                  {inv.timeline?.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 4 }}>Timeline:</p>
                      {inv.timeline.slice(-3).map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%' }} />
                          <span>{new Date(t.date).toLocaleDateString()}: {t.action}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setSelected(inv); setDetailOpen(true); }}>View Details</CVisionButton>
                    {(inv.status === 'HEARING_COMPLETED' || inv.status === 'DECISION_PENDING') && (
                      <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { setSelected(inv); setDecisionOpen(true); }}>
                        <Gavel style={{ height: 14, width: 14, marginRight: 4 }} />{tr('اتخاذ قرار', 'Make Decision')}
                      </CVisionButton>
                    )}
                    {inv.status === 'REPORTED' && (
                      <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={async () => {
                        try {
                          await postInv({ action: 'update-status', investigationId: inv.investigationId, status: 'UNDER_INVESTIGATION' });
                          load();
                        } catch (e: any) { alert(e.message || tr('حدث خطأ', 'An error occurred')); }
                      }}>{tr('بدء التحقيق', 'Start Investigation')}</CVisionButton>
                    )}
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      <CreateInvestigationDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />
      {selected && <DetailDialog open={detailOpen} onOpenChange={setDetailOpen} inv={selected} onRefresh={load} />}
      {selected && <DecisionDialog open={decisionOpen} onOpenChange={setDecisionOpen} inv={selected} onDecided={load} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: All Cases
// ═══════════════════════════════════════════════════════════════════════════

function AllCasesTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const STATUS_STYLES = getStatusStyles(tr);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  const listParams: Record<string, string> = {};
  if (filterStatus) listParams.status = filterStatus;
  if (filterType) listParams.type = filterType;

  const { data: res, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.investigations.list({ action: 'list-all', ...listParams }),
    queryFn: () => fetchInv('list', Object.keys(listParams).length > 0 ? listParams : undefined),
  });
  const cases: Investigation[] = (res as any)?.investigations || [];

  const filtered = search ? cases.filter(c =>
    c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    c.investigationId.toLowerCase().includes(search.toLowerCase()) ||
    c.department.toLowerCase().includes(search.toLowerCase())
  ) : cases;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CVisionInput C={C} placeholder="Search by name, ID, department..." className="sm:w-64" value={search} onChange={e => setSearch(e.target.value)} />
        <CVisionSelect
                C={C}
                value={filterStatus}
                placeholder="All Status"
                options={[
                  { value: 'all', label: tr('كل الحالات', 'All Status') },
                  ...Object.entries(STATUS_STYLES).map(([k, v]) => ({ value: k, label: v.label })),
                ]}
                style={{ width: 160 }}
              />
        <CVisionSelect
                C={C}
                value={filterType}
                placeholder="All Types"
                options={[
                  { value: 'all', label: tr('كل الأنواع', 'All Types') },
                  ...Object.entries(INCIDENT_LABELS).map(([k, v]) => ({ value: k, label: v })),
                ]}
                style={{ width: 160 }}
              />
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 256, borderRadius: 12 }}  /> : (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>ID</CVisionTh>
                    <CVisionTh C={C}>Employee</CVisionTh>
                    <CVisionTh C={C}>Type</CVisionTh>
                    <CVisionTh C={C}>Status</CVisionTh>
                    <CVisionTh C={C}>Outcome</CVisionTh>
                    <CVisionTh C={C}>Date</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {filtered.map(inv => {
                    const st = STATUS_STYLES[inv.status] || STATUS_STYLES.REPORTED;
                    return (
                      <CVisionTr C={C} key={inv.id}>
                        <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.investigationId}</CVisionTd>
                        <CVisionTd>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{inv.employeeName}</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>{inv.department}</div>
                        </CVisionTd>
                        <CVisionTd><CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{INCIDENT_LABELS[inv.incidentType] || inv.incidentType}</CVisionBadge></CVisionTd>
                        <CVisionTd><CVisionBadge C={C} className={st.color} variant="secondary">{st.label}</CVisionBadge></CVisionTd>
                        <CVisionTd style={{ fontSize: 12 }}>{inv.decision?.outcome && inv.decision.outcome !== 'NO_ACTION' && inv.status !== 'REPORTED' ? OUTCOME_LABELS[inv.decision.outcome] || inv.decision.outcome : '—'}</CVisionTd>
                        <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>{new Date(inv.createdAt).toLocaleDateString()}</CVisionTd>
                      </CVisionTr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <CVisionTr C={C}><CVisionTd align="center" colSpan={6} style={{ paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>No investigations found.</CVisionTd></CVisionTr>
                  )}
                </CVisionTableBody>
              </CVisionTable>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: Deductions
// ═══════════════════════════════════════════════════════════════════════════

function DeductionsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const queryClient = useQueryClient();

  const { data: dedRes, isLoading: loading, refetch: load } = useQuery({
    queryKey: cvisionKeys.investigations.list({ action: 'deductions' }),
    queryFn: () => fetchInv('deductions'),
  });
  const deductions: Deduction[] = (dedRes as any)?.deductions || [];

  const pending = deductions.filter(d => d.status === 'PENDING');
  const applied = deductions.filter(d => d.status === 'APPLIED');
  const cancelled = deductions.filter(d => d.status === 'CANCELLED');

  const handleApply = async (dedId: string) => {
    try {
      await postInv({ action: 'apply-deduction', deductionId: dedId });
      load();
    } catch (e: any) { alert(e.message || tr('حدث خطأ', 'An error occurred')); }
  };

  const handleCancel = async (dedId: string) => {
    const reason = prompt(tr('سبب الإلغاء:', 'Reason for cancellation:'));
    if (!reason) return;
    try {
      await postInv({ action: 'cancel-deduction', deductionId: dedId, reason });
      load();
    } catch (e: any) { alert(e.message || tr('حدث خطأ', 'An error occurred')); }
  };

  if (loading) return <CVisionSkeletonCard C={C} height={200} style={{ height: 256, borderRadius: 12, marginTop: 16 }}  />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <CVisionCard C={C}><CVisionCardBody style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{pending.length}</div><div style={{ fontSize: 12, color: C.textMuted }}>Pending</div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{applied.length}</div><div style={{ fontSize: 12, color: C.textMuted }}>Applied</div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>SAR {pending.reduce((s, d) => s + d.calculatedAmount, 0).toLocaleString()}</div><div style={{ fontSize: 12, color: C.textMuted }}>Pending Total</div></CVisionCardBody></CVisionCard>
      </div>

      {/* Pending */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><Clock style={{ height: 16, width: 16, color: C.orange }} />Pending Deductions</div></CVisionCardHeader>
        <CVisionCardBody>
          {pending.length === 0 ? (
            <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 16, paddingBottom: 16 }}>No pending deductions.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>Employee</CVisionTh>
                    <CVisionTh C={C}>Investigation</CVisionTh>
                    <CVisionTh C={C} align="right">Amount</CVisionTh>
                    <CVisionTh C={C}>Days</CVisionTh>
                    <CVisionTh C={C}>Month</CVisionTh>
                    <CVisionTh C={C}>Actions</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {pending.map(d => (
                    <CVisionTr C={C} key={d.id}>
                      <CVisionTd><div style={{ fontWeight: 500, fontSize: 13 }}>{d.employeeName}</div><div style={{ fontSize: 12, color: C.textMuted }}>{d.department}</div></CVisionTd>
                      <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.investigationId}</CVisionTd>
                      <CVisionTd align="right" style={{ fontWeight: 500 }}>SAR {d.calculatedAmount.toLocaleString()}</CVisionTd>
                      <CVisionTd>{d.days || '—'}</CVisionTd>
                      <CVisionTd>{d.effectiveMonth}</CVisionTd>
                      <CVisionTd>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <CVisionButton C={C} isDark={isDark} size="sm" style={{ height: 28, fontSize: 12 }} onClick={() => handleApply(d.deductionId || d.id)}>Apply</CVisionButton>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => handleCancel(d.deductionId || d.id)}>Cancel</CVisionButton>
                        </div>
                      </CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Applied */}
      {applied.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 style={{ height: 16, width: 16, color: C.green }} />Applied Deductions</div></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>Employee</CVisionTh>
                    <CVisionTh C={C}>Investigation</CVisionTh>
                    <CVisionTh C={C} align="right">Amount</CVisionTh>
                    <CVisionTh C={C}>Month</CVisionTh>
                    <CVisionTh C={C}>Applied</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {applied.map(d => (
                    <CVisionTr C={C} key={d.id}>
                      <CVisionTd style={{ fontWeight: 500, fontSize: 13 }}>{d.employeeName}</CVisionTd>
                      <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.investigationId}</CVisionTd>
                      <CVisionTd align="right">SAR {d.calculatedAmount.toLocaleString()}</CVisionTd>
                      <CVisionTd>{d.effectiveMonth}</CVisionTd>
                      <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>{d.appliedAt ? new Date(d.appliedAt).toLocaleDateString() : '—'}</CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Dialogs
// ═══════════════════════════════════════════════════════════════════════════

function CreateInvestigationDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [form, setForm] = useState({
    employeeName: '', department: '', employeeId: '',
    incidentType: 'ATTENDANCE', incidentDate: new Date().toISOString().slice(0, 10),
    incidentDescription: '', incidentLocation: '', reportedByName: '',
    investigatorName: '', laborLawArticle: '',
  });
  const [saving, setSaving] = useState(false);

  const { data: empsRaw, isLoading: loadingEmps } = useQuery({
    queryKey: cvisionKeys.investigations.employees(),
    queryFn: () => cvisionFetch('/api/cvision/employees?statuses=ACTIVE,PROBATION'),
    enabled: open,
  });
  const employees = (empsRaw?.data?.items || empsRaw?.data || []).map((e: any) => ({
    id: e.id || e._id,
    name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || e.id,
    department: e.departmentName || e.department || '',
  }));

  const handleSubmit = async () => {
    if (!form.employeeId || !form.incidentDescription) { alert(tr('الموظف والوصف مطلوبان', 'Employee and description are required')); return; }
    setSaving(true);
    try {
      await postInv({ action: 'create', ...form });
      onOpenChange(false);
      onCreated();
      setForm({ employeeName: '', department: '', employeeId: '', incidentType: 'ATTENDANCE', incidentDate: new Date().toISOString().slice(0, 10), incidentDescription: '', incidentLocation: '', reportedByName: '', investigatorName: '', laborLawArticle: '' });
    } catch (e: any) { alert(e.message || tr('حدث خطأ', 'An error occurred')); }
    setSaving(false);
  };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title="Details" isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Report a new incident and create an investigation case.</p>        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Employee *</CVisionLabel>
              <CVisionSelect
                C={C}
                value={form.employeeId || undefined}
                placeholder={loadingEmps ? "Loading..." : "Select employee"}
                options={employees.map(emp => (
                    ({ value: emp.id, label: emp.name })
                  ))}
              />
            </div>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Department</CVisionLabel>
              <CVisionInput C={C} value={form.department} disabled style={{ background: C.bgSubtle }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div><CVisionLabel C={C} style={{ fontSize: 12 }}>Incident Type</CVisionLabel>
              <CVisionSelect
                C={C}
                value={form.incidentType}
                options={Object.entries(INCIDENT_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
            <div><CVisionLabel C={C} style={{ fontSize: 12 }}>Incident Date</CVisionLabel><CVisionInput C={C} type="date" value={form.incidentDate} onChange={e => setForm({ ...form, incidentDate: e.target.value })} /></div>
          </div>
          <div><CVisionLabel C={C} style={{ fontSize: 12 }}>Description *</CVisionLabel><CVisionTextarea C={C} rows={3} value={form.incidentDescription} onChange={e => setForm({ ...form, incidentDescription: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Reported By</CVisionLabel>
              <CVisionSelect
                C={C}
                value={form.reportedByName || undefined}
                placeholder="Select reporter"
                options={employees.map(emp => (
                    ({ value: emp.name, label: emp.name })
                  ))}
              />
            </div>
            <div>
              <CVisionLabel C={C} style={{ fontSize: 12 }}>Investigator</CVisionLabel>
              <CVisionSelect
                C={C}
                value={form.investigatorName || undefined}
                placeholder="Select investigator"
                options={employees.map(emp => (
                    ({ value: emp.name, label: emp.name })
                  ))}
              />
            </div>
          </div>
          <div><CVisionLabel C={C} style={{ fontSize: 12 }}>Labor Law Article (optional)</CVisionLabel><CVisionInput C={C} placeholder="e.g. Article 80" value={form.laborLawArticle} onChange={e => setForm({ ...form, laborLawArticle: e.target.value })} /></div>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>Cancel</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleSubmit} disabled={saving}>{saving ? 'Creating...' : 'Create Investigation'}</CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}

function DetailDialog({ open, onOpenChange, inv, onRefresh }: { open: boolean; onOpenChange: (o: boolean) => void; inv: Investigation; onRefresh: () => void }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const STATUS_STYLES = getStatusStyles(tr);
  const st = STATUS_STYLES[inv.status] || STATUS_STYLES.REPORTED;

  // Evidence form
  const [evType, setEvType] = useState('DOCUMENT');
  const [evDesc, setEvDesc] = useState('');
  const addEv = async () => {
    if (!evDesc) return;
    await postInv({ action: 'add-evidence', investigationId: inv.investigationId, evidenceType: evType, description: evDesc });
    setEvDesc(''); onRefresh();
  };

  // Witness form
  const [wName, setWName] = useState('');
  const [wStmt, setWStmt] = useState('');
  const addW = async () => {
    if (!wName || !wStmt) return;
    await postInv({ action: 'add-witness', investigationId: inv.investigationId, witnessName: wName, statement: wStmt });
    setWName(''); setWStmt(''); onRefresh();
  };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title="Details" isDark={isDark}>          
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Review evidence, witnesses, hearing details, and timeline for this investigation.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
          {/* Incident */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Incident</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
              <div><strong>Employee:</strong> {inv.employeeName}</div>
              <div><strong>Department:</strong> {inv.department}</div>
              <div><strong>Date:</strong> {new Date(inv.incidentDate).toLocaleDateString()}</div>
              <div><strong>Reported by:</strong> {inv.reportedByName}</div>
            </div>
            <p style={{ marginTop: 4, color: C.textMuted }}>{inv.incidentDescription}</p>
            {inv.laborLawArticle && <p style={{ fontSize: 12, marginTop: 4 }}><Shield style={{ height: 12, width: 12, marginRight: 2 }} />{inv.laborLawArticle}</p>}
          </div>

          {/* Evidence */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Evidence ({inv.evidence?.length || 0})</p>
            {inv.evidence?.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                <FileText style={{ height: 12, width: 12, marginTop: 2 }} />
                <span><CVisionBadge C={C} variant="outline" style={{ marginRight: 4 }}>{e.type}</CVisionBadge>{e.description}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <CVisionSelect
                C={C}
                value={evType}
                onChange={setEvType}
                options={['DOCUMENT', 'WITNESS', 'CCTV', 'EMAIL', 'PHOTO', 'OTHER'].map(t => ({ value: t, label: t }))}
                style={{ width: 112, height: 28, fontSize: 12 }}
              />
              <CVisionInput C={C} style={{ height: 28, fontSize: 12, flex: 1 }} placeholder="Description..." value={evDesc} onChange={e => setEvDesc(e.target.value)} />
              <CVisionButton C={C} isDark={isDark} size="sm" style={{ height: 28, fontSize: 12 }} onClick={addEv}>Add</CVisionButton>
            </div>
          </div>

          {/* Witnesses */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Witnesses ({inv.witnesses?.length || 0})</p>
            {inv.witnesses?.map(w => (
              <div key={w.id} style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                <strong>{w.name}:</strong> &quot;{w.statement}&quot;
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <CVisionInput C={C} style={{ height: 28, fontSize: 12 }} placeholder="Witness name" value={wName} onChange={e => setWName(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionInput C={C} style={{ height: 28, fontSize: 12, flex: 1 }} placeholder="Statement..." value={wStmt} onChange={e => setWStmt(e.target.value)} />
                <CVisionButton C={C} isDark={isDark} size="sm" style={{ height: 28, fontSize: 12 }} onClick={addW}>Add</CVisionButton>
              </div>
            </div>
          </div>

          {/* Hearing */}
          {inv.hearing?.completedAt && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Hearing</p>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                <p>Attended: {inv.hearing.employeeAttended ? 'Yes' : 'No'}</p>
                {inv.hearing.employeeResponse && <p>Response: &quot;{inv.hearing.employeeResponse}&quot;</p>}
                {inv.hearing.hearingNotes && <p>Notes: {inv.hearing.hearingNotes}</p>}
              </div>
            </div>
          )}

          {/* Decision */}
          {inv.decision?.decidedAt && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Decision</p>
              <CVisionBadge C={C} variant="secondary" style={{ marginBottom: 4 }}>{OUTCOME_LABELS[inv.decision.outcome] || inv.decision.outcome}</CVisionBadge>
              <p style={{ fontSize: 12, color: C.textMuted }}>{inv.decision.reasoning}</p>
              {inv.decision.deduction && (
                <p style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>Deduction: SAR {inv.decision.deduction.calculatedAmount.toLocaleString()} — {inv.decision.deduction.description}</p>
              )}
            </div>
          )}

          {/* Timeline */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>Timeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {inv.timeline?.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: C.textMuted, width: 80 }}>{new Date(t.date).toLocaleDateString()}</span>
                  <ChevronRight style={{ height: 12, width: 12, color: C.textMuted, marginTop: 2 }} />
                  <span>{t.action}{t.details ? ` — ${t.details}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
    </CVisionDialog>
  );
}

function DecisionDialog({ open, onOpenChange, inv, onDecided }: { open: boolean; onOpenChange: (o: boolean) => void; inv: Investigation; onDecided: () => void }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [outcome, setOutcome] = useState<string>('VERBAL_WARNING');
  const [reasoning, setReasoning] = useState('');
  const [dedDays, setDedDays] = useState('2');
  const [dedMonth, setDedMonth] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [suspStart, setSuspStart] = useState('');
  const [suspEnd, setSuspEnd] = useState('');
  const [suspPay, setSuspPay] = useState(false);
  const [saving, setSaving] = useState(false);
  // calcResult is derived from the query below

  // Calculate deduction when days change
  const { data: calcRes } = useQuery({
    queryKey: ['cvision', 'investigations', 'calculate-deduction', dedDays],
    queryFn: () => fetchInv('calculate-deduction', {
      basicSalary: '6500', housingAllowance: '0', type: 'DAYS', days: dedDays,
    }),
    enabled: outcome === 'SALARY_DEDUCTION',
  });
  const calcResult = calcRes?.calculation ?? null;

  const handleSubmit = async () => {
    if (!reasoning) { alert(tr('التسبيب مطلوب', 'Reasoning is required')); return; }
    setSaving(true);
    try {
      const body: Record<string, any> = {
        action: 'make-decision',
        investigationId: inv.investigationId,
        outcome,
        reasoning,
      };
      if (outcome === 'SALARY_DEDUCTION') {
        body.deduction = { type: 'DAYS', days: parseInt(dedDays, 10), effectiveMonth: dedMonth };
      }
      if (outcome === 'SUSPENSION') {
        body.suspension = { startDate: suspStart, endDate: suspEnd, withPay: suspPay };
      }
      const res = await postInv(body);
      if (res.sideEffects?.length) alert(tr(`تم تسجيل القرار.\n\nالآثار الجانبية:\n${res.sideEffects.join('\n')}`, `Decision recorded.\n\nSide effects:\n${res.sideEffects.join('\n')}`));
      onOpenChange(false);
      onDecided();
    } catch (e: any) { alert(e.message || tr('حدث خطأ', 'An error occurred')); }
    setSaving(false);
  };

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title="Details" isDark={isDark}><p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Select an outcome and provide reasoning for the investigation decision.</p>        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            <strong>{inv.employeeName}</strong> — {INCIDENT_LABELS[inv.incidentType] || inv.incidentType}
          </div>

          <div>
            <CVisionLabel C={C} style={{ fontSize: 12 }}>Outcome (Art. 66 Penalty Schedule)</CVisionLabel>
            <CVisionSelect
                C={C}
                value={outcome}
                onChange={setOutcome}
                options={Object.entries(OUTCOME_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
          </div>

          {/* Salary deduction panel */}
          {outcome === 'SALARY_DEDUCTION' && (
            <CVisionCard C={C} style={{ background: C.orangeDim }}>
              <CVisionCardBody style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 500 }}>Salary Deduction — Art. 66 (max 5 days/incident)</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  <div>
                    <CVisionLabel C={C} style={{ fontSize: 12 }}>Days to deduct</CVisionLabel>
                    <CVisionInput C={C} type="number" min="1" max="5" value={dedDays} onChange={e => setDedDays(e.target.value)} />
                  </div>
                  <div>
                    <CVisionLabel C={C} style={{ fontSize: 12 }}>Effective Month</CVisionLabel>
                    <CVisionInput C={C} type="month" value={dedMonth} onChange={e => setDedMonth(e.target.value)} />
                  </div>
                </div>
                {calcResult && (
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <p>Daily rate: <strong>SAR {calcResult.dailyRate.toLocaleString()}</strong></p>
                    <p>Deduction: <strong>SAR {calcResult.calculatedAmount.toLocaleString()}</strong></p>
                    <p>Max per incident: SAR {calcResult.maxPerIncident.toLocaleString()}</p>
                    <p className={calcResult.withinIncidentLimit ? 'text-green-700' : 'text-red-700'}>
                      {calcResult.withinIncidentLimit ? '✓ Within legal limit' : '✗ Exceeds 5-day limit'}
                    </p>
                  </div>
                )}
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Suspension panel */}
          {outcome === 'SUSPENSION' && (
            <CVisionCard C={C} style={{ background: C.purpleDim }}>
              <CVisionCardBody style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 500 }}>Suspension — Art. 66 (max 5 days without pay/month)</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  <div><CVisionLabel C={C} style={{ fontSize: 12 }}>Start Date</CVisionLabel><CVisionInput C={C} type="date" value={suspStart} onChange={e => setSuspStart(e.target.value)} /></div>
                  <div><CVisionLabel C={C} style={{ fontSize: 12 }}>End Date</CVisionLabel><CVisionInput C={C} type="date" value={suspEnd} onChange={e => setSuspEnd(e.target.value)} /></div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <input type="checkbox" checked={suspPay} onChange={e => setSuspPay(e.target.checked)} />
                  With pay
                </label>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* Termination warning */}
          {outcome === 'TERMINATION' && (
            <CVisionCard C={C} style={{ background: C.redDim }}>
              <CVisionCardBody style={{ padding: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.red }}>Termination — Article 80 grounds required</p>
                <p style={{ fontSize: 12, color: C.red, marginTop: 4 }}>This will flag the employee for termination processing. Ensure proper documentation and grounds per Article 80.</p>
              </CVisionCardBody>
            </CVisionCard>
          )}

          <div>
            <CVisionLabel C={C} style={{ fontSize: 12 }}>Reasoning *</CVisionLabel>
            <CVisionTextarea C={C} rows={3} value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="Explain the decision and rationale..." />
          </div>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>Cancel</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting...' : 'Confirm Decision'}</CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}
