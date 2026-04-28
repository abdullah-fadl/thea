'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea, CVisionLabel, CVisionSelect, CVisionDialog, CVisionDialogFooter, CVisionTabs, CVisionTabContent, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionEmptyState } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  Workflow, PlusCircle, AlertTriangle, ArrowLeft, ChevronRight,
  BarChart3, Target, Shield, MessageSquare, Users, Clock, TrendingUp,
  CheckCircle2, XCircle, Pause, Play, ArrowUpRight,
} from 'lucide-react';

/* -- Constants -- */
const STATUS_ICONS: Record<string, any> = {
  PLANNING: Clock, IN_PROGRESS: Play, MONITORING: BarChart3,
  COMPLETED: CheckCircle2, PAUSED: Pause, CANCELLED: XCircle,
};
const KOTTER_STEPS = [
  { name: 'Create Urgency', nameAr: 'خلق الاستعجال', short: 'Urgency' },
  { name: 'Form Coalition', nameAr: 'تشكيل التحالف', short: 'Coalition' },
  { name: 'Create Vision', nameAr: 'خلق الرؤية', short: 'Vision' },
  { name: 'Communicate Vision', nameAr: 'نشر الرؤية', short: 'Communicate' },
  { name: 'Empower Action', nameAr: 'تمكين العمل', short: 'Empower' },
  { name: 'Short-term Wins', nameAr: 'مكاسب قصيرة', short: 'Wins' },
  { name: 'Build on Change', nameAr: 'البناء على التغيير', short: 'Build' },
  { name: 'Anchor in Culture', nameAr: 'ترسيخ في الثقافة', short: 'Anchor' },
];
const ADKAR = ['awareness', 'desire', 'knowledge', 'ability', 'reinforcement'] as const;
const ADKAR_LABELS: Record<string, string> = { awareness: 'Awareness', desire: 'Desire', knowledge: 'Knowledge', ability: 'Ability', reinforcement: 'Reinforcement' };
const ADKAR_LABELS_AR: Record<string, string> = { awareness: 'الوعي', desire: 'الرغبة', knowledge: 'المعرفة', ability: 'القدرة', reinforcement: 'التعزيز' };
const ADKAR_COLORS: Record<string, string> = { awareness: '#0ea5e9', desire: '#8b5cf6', knowledge: '#f59e0b', ability: '#10b981', reinforcement: '#f43f5e' };
const TYPE_LABELS: Record<string, string> = {
  DIGITAL_TRANSFORMATION: 'Digital Transformation', RESTRUCTURING: 'Restructuring',
  MERGER: 'Merger & Acquisition', PROCESS_CHANGE: 'Process Change',
  CULTURE_SHIFT: 'Culture Shift', POLICY_CHANGE: 'Policy Change',
  SYSTEM_IMPLEMENTATION: 'System Implementation', CUSTOM: 'Custom',
};

function fmtDate(d: any) { if (!d) return '\u2014'; try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '\u2014'; } }

function statusVariant(s: string) {
  if (s === 'COMPLETED') return 'success' as const;
  if (s === 'IN_PROGRESS') return 'info' as const;
  if (s === 'MONITORING') return 'purple' as const;
  if (s === 'PAUSED') return 'warning' as const;
  if (s === 'CANCELLED') return 'danger' as const;
  return 'muted' as const;
}
function priorityVariant(p: string) {
  if (p === 'HIGH') return 'danger' as const;
  if (p === 'MEDIUM') return 'warning' as const;
  return 'success' as const;
}
function riskVariant(s: string) {
  if (s === 'OPEN') return 'danger' as const;
  if (s === 'MITIGATED') return 'success' as const;
  return 'warning' as const;
}

/* -- Component -- */
export default function ChangeManagementPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [detailTab, setDetailTab] = useState('overview');
  const [form, setForm] = useState({ title: '', titleAr: '', type: 'CUSTOM', priority: 'MEDIUM', description: '', startDate: '', targetEndDate: '' });
  const [showRisk, setShowRisk] = useState(false);
  const [riskForm, setRiskForm] = useState({ description: '', likelihood: 'MEDIUM', impact: 'MEDIUM', mitigation: '' });
  const [showComm, setShowComm] = useState(false);
  const [commForm, setCommForm] = useState({ channel: 'EMAIL', audience: '', message: '', scheduledDate: '' });
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);

  const api = async (action: string, params?: Record<string, any>) => {
    return cvisionMutate<any>('/api/cvision/change-management', 'POST', { action, ...params });
  };

  const { data: listRaw, isLoading: listLoading, refetch: refetchList } = useQuery({
    queryKey: cvisionKeys.changeManagement.list({ action: 'list' }),
    queryFn: async () => {
      const d = await cvisionFetch<any>('/api/cvision/change-management', { params: { action: 'list' } });
      if (d.ok) setInitiatives(d.data || []);
      return d;
    },
  });
  const { data: dashRaw, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: cvisionKeys.changeManagement.list({ action: 'dashboard' }),
    queryFn: async () => {
      const d = await cvisionFetch<any>('/api/cvision/change-management', { params: { action: 'dashboard' } });
      if (d.ok) setDashboard(d.data);
      return d;
    },
  });

  const fetchData = () => { refetchList(); refetchDash(); };
  const loading = listLoading || dashLoading;

  const handleCreate = async () => {
    if (!form.title) { toast.error(tr('العنوان مطلوب', 'Title is required')); return; }
    const d = await api('create', form);
    if (d.ok) { toast.success(tr('تم انشاء المبادرة', 'Initiative created')); setShowCreate(false); setForm({ title: '', titleAr: '', type: 'CUSTOM', priority: 'MEDIUM', description: '', startDate: '', targetEndDate: '' }); fetchData(); }
    else toast.error(d.error);
  };

  const updateAdkar = async (dim: string, val: number) => {
    if (!selected) return;
    const newScores = { ...selected.adkarScores, [dim]: val };
    const d = await api('update-adoption', { initiativeId: selected.initiativeId, adkarScores: newScores });
    if (d.ok) { const updated = { ...selected, adkarScores: newScores }; setSelected(updated); setInitiatives(prev => prev.map(i => i.initiativeId === selected.initiativeId ? updated : i)); }
  };

  const advanceKotter = async (phase: number) => {
    if (!selected) return;
    const d = await api('update-phase', { initiativeId: selected.initiativeId, kotterPhase: phase });
    if (d.ok) { const updated = { ...selected, kotterPhase: phase }; setSelected(updated); setInitiatives(prev => prev.map(i => i.initiativeId === selected.initiativeId ? updated : i)); toast.success(`${tr('تقدم الى المرحلة', 'Advanced to Phase')} ${phase}: ${tr(KOTTER_STEPS[phase - 1].nameAr, KOTTER_STEPS[phase - 1].name)}`); }
  };

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    const d = await api('update-phase', { initiativeId: selected.initiativeId, status: newStatus });
    if (d.ok) { const updated = { ...selected, status: newStatus }; setSelected(updated); setInitiatives(prev => prev.map(i => i.initiativeId === selected.initiativeId ? updated : i)); setShowStatusUpdate(false); toast.success(`${tr('تم تحديث الحالة الى', 'Status updated to')} ${newStatus}`); fetchData(); }
  };

  const addRisk = async () => {
    if (!riskForm.description) { toast.error(tr('الوصف مطلوب', 'Description required')); return; }
    const d = await api('add-risk', { initiativeId: selected.initiativeId, risk: riskForm });
    if (d.ok) { toast.success(tr('تمت اضافة المخاطر', 'Risk added')); setShowRisk(false); setRiskForm({ description: '', likelihood: 'MEDIUM', impact: 'MEDIUM', mitigation: '' }); const r = await fetch(`/api/cvision/change-management?action=get&id=${selected.initiativeId}`, { credentials: 'include' }); const j = await r.json(); if (j.ok && j.data) setSelected(j.data); }
  };

  const addComm = async () => {
    if (!commForm.message) { toast.error(tr('الرسالة مطلوبة', 'Message required')); return; }
    const d = await api('add-communication', { initiativeId: selected.initiativeId, communication: commForm });
    if (d.ok) { toast.success(tr('تم تخطيط التواصل', 'Communication planned')); setShowComm(false); setCommForm({ channel: 'EMAIL', audience: '', message: '', scheduledDate: '' }); const r = await fetch(`/api/cvision/change-management?action=get&id=${selected.initiativeId}`, { credentials: 'include' }); const j = await r.json(); if (j.ok && j.data) setSelected(j.data); }
  };

  const adkarAvg = (scores: any) => { if (!scores) return 0; const vals = ADKAR.map(d => scores[d] || 0); return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length); };

  /* -- Loading -- */
  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={40} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[...Array(4)].map((_, i) => <CVisionSkeletonCard key={i} C={C} height={96} />)}
      </div>
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  /* -- Detail View -- */
  if (selected) {
    const StatusIcon = STATUS_ICONS[selected.status] || Workflow;
    const avgScore = adkarAvg(selected.adkarScores);

    const detailTabs = [
      { id: 'overview', label: tr('ADKAR', 'ADKAR'), icon: <Target size={14} /> },
      { id: 'kotter', label: tr('كوتر', 'Kotter'), icon: <TrendingUp size={14} /> },
      { id: 'risks', label: tr('المخاطر', 'Risks'), icon: <Shield size={14} /> },
      { id: 'comms', label: tr('التواصل', 'Communications'), icon: <MessageSquare size={14} /> },
    ];

    return (
      <CVisionPageLayout>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={ArrowLeft} onClick={() => { setSelected(null); setDetailTab('overview'); }}>
            {tr('رجوع', 'Back')}
          </CVisionButton>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{selected.title}</span>
              <CVisionBadge C={C} variant={statusVariant(selected.status)}>
                <StatusIcon size={12} style={{ marginRight: 4 }} />{selected.status.replace(/_/g, ' ')}
              </CVisionBadge>
              <CVisionBadge C={C} variant={priorityVariant(selected.priority)}>{selected.priority}</CVisionBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: C.textMuted }}>
              <span>{TYPE_LABELS[selected.type] || selected.type}</span>
              <span>ID: {selected.initiativeId}</span>
              {selected.startDate && <span>{tr('البداية', 'Start')}: {fmtDate(selected.startDate)}</span>}
              {selected.targetEndDate && <span>{tr('الهدف', 'Target')}: {fmtDate(selected.targetEndDate)}</span>}
            </div>
            {selected.description && <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>{selected.description}</p>}
          </div>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setShowStatusUpdate(true)}>
            {tr('تحديث الحالة', 'Update Status')}
          </CVisionButton>
        </div>

        {/* Summary Cards */}
        <CVisionStatsRow>
          {[
            { label: tr('معدل التبني', 'Adoption Rate'), value: `${selected.adoptionRate || 0}%`, bar: selected.adoptionRate || 0 },
            { label: tr('درجة ADKAR', 'ADKAR Score'), value: `${avgScore}%`, bar: avgScore },
            { label: tr('مرحلة كوتر', 'Kotter Phase'), value: `${selected.kotterPhase || 1}/8`, bar: ((selected.kotterPhase || 1) / 8) * 100 },
          ].map((s, i) => (
            <CVisionCard key={i} C={C} style={{ flex: '1 1 160px' }}>
              <CVisionCardBody style={{ padding: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{s.value}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{s.label}</div>
                <div style={{ width: '100%', background: C.barTrack, borderRadius: 99, height: 6, marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: 6, borderRadius: 99, background: C.gold, width: `${s.bar}%`, transition: 'width 0.3s' }} />
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
          <CVisionCard C={C} style={{ flex: '1 1 160px' }}>
            <CVisionCardBody style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.orange }}>{(selected.risks || []).filter((r: any) => r.status === 'OPEN').length}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مخاطر مفتوحة', 'Open Risks')}</div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{(selected.risks || []).length} {tr('اجمالي', 'total')}</div>
            </CVisionCardBody>
          </CVisionCard>
        </CVisionStatsRow>

        {/* Tabs */}
        <CVisionTabs C={C} tabs={detailTabs} activeTab={detailTab} onChange={setDetailTab} isRTL={isRTL} />

        {/* ADKAR Tab */}
        <CVisionTabContent id="overview" activeTab={detailTab}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تقييم ADKAR', 'ADKAR Assessment')}</span>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tr('قياس الجاهزية عبر 5 ابعاد', 'Measure readiness across 5 dimensions. Drag sliders to update scores.')}</div>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ADKAR.map(d => {
                const score = selected.adkarScores?.[d] || 0;
                const scoreColor = score >= 70 ? C.green : score >= 40 ? C.orange : C.red;
                return (
                  <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr(ADKAR_LABELS_AR[d], ADKAR_LABELS[d])}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{score}%</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, background: C.barTrack, borderRadius: 99, height: 12, overflow: 'hidden' }}>
                        <div style={{ height: 12, borderRadius: 99, background: ADKAR_COLORS[d], width: `${score}%`, transition: 'width 0.3s' }} />
                      </div>
                      <input type="range" min="0" max="100" step="5" style={{ width: 112 }} value={score} onChange={e => updateAdkar(d, parseInt(e.target.value))} />
                    </div>
                  </div>
                );
              })}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('الدرجة الاجمالية', 'Overall ADKAR Score')}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: avgScore >= 70 ? C.green : avgScore >= 40 ? C.orange : C.red }}>{avgScore}%</span>
              </div>
              <div style={{ width: '100%', background: C.barTrack, borderRadius: 99, height: 8, overflow: 'hidden' }}>
                <div style={{ height: 8, borderRadius: 99, background: C.gold, width: `${avgScore}%`, transition: 'width 0.3s' }} />
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </CVisionTabContent>

        {/* Kotter Tab */}
        <CVisionTabContent id="kotter" activeTab={detailTab}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('نموذج كوتر للتغيير من 8 خطوات', "Kotter's 8-Step Change Model")}</span>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tr('تتبع التقدم خلال كل مرحلة', 'Track progress through each phase of the change process.')}</div>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {KOTTER_STEPS.map((step, i) => {
                const phase = i + 1;
                const isCurrent = phase === selected.kotterPhase;
                const isDone = phase < selected.kotterPhase;
                const isFuture = phase > selected.kotterPhase;
                const bg = isCurrent ? (isDark ? C.blueDim : '#eff6ff') : isDone ? (isDark ? C.greenDim : '#f0fdf4') : C.bgSubtle;
                const border = isCurrent ? C.blue : isDone ? C.greenDim : C.border;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 10, border: `1px solid ${border}`, background: bg, transition: 'all 0.2s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, background: isDone ? C.green : isCurrent ? C.blue : C.bgSubtle, color: isDone || isCurrent ? '#fff' : C.textMuted }}>
                      {isDone ? <CheckCircle2 size={16} /> : phase}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: isFuture ? C.textMuted : C.text }}>{tr(step.nameAr, step.name)}</div>
                      {isCurrent && <span style={{ fontSize: 11, color: C.blue }}>{tr('المرحلة الحالية', 'Current Phase')}</span>}
                    </div>
                    {isCurrent && phase < 8 && (
                      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => advanceKotter(phase + 1)}>
                        {tr('التالي', 'Next')} <ChevronRight size={12} />
                      </CVisionButton>
                    )}
                    {isDone && !isCurrent && <CVisionBadge C={C} variant="success">{tr('تم', 'Done')}</CVisionBadge>}
                  </div>
                );
              })}
            </CVisionCardBody>
          </CVisionCard>
        </CVisionTabContent>

        {/* Risks Tab */}
        <CVisionTabContent id="risks" activeTab={detailTab}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل المخاطر', 'Risk Register')}</span>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{(selected.risks || []).length} {tr('مخاطر محددة', 'risks identified')}</div>
              </div>
              <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" icon={PlusCircle} onClick={() => setShowRisk(true)}>
                {tr('اضافة خطر', 'Add Risk')}
              </CVisionButton>
            </CVisionCardHeader>
            <CVisionCardBody>
              {(selected.risks || []).length === 0 ? (
                <CVisionEmptyState C={C} icon={Shield} title={tr('لا توجد مخاطر مسجلة', 'No risks registered yet')} description={tr('اضف مخاطر لتتبع المشاكل المحتملة', 'Add risks to track potential issues')} />
              ) : (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                    <CVisionTh C={C}>{tr('الخطر', 'Risk')}</CVisionTh>
                    <CVisionTh C={C} width={100}>{tr('الاحتمال', 'Likelihood')}</CVisionTh>
                    <CVisionTh C={C} width={100}>{tr('الأثر', 'Impact')}</CVisionTh>
                    <CVisionTh C={C} width={100}>{tr('الحالة', 'Status')}</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {(selected.risks || []).map((r: any) => (
                      <CVisionTr key={r.riskId} C={C}>
                        <CVisionTd>
                          <div style={{ fontSize: 13, color: C.text }}>{r.description}</div>
                          {r.mitigation && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tr('التخفيف', 'Mitigation')}: {r.mitigation}</div>}
                        </CVisionTd>
                        <CVisionTd><CVisionBadge C={C} variant="muted">{r.likelihood}</CVisionBadge></CVisionTd>
                        <CVisionTd><CVisionBadge C={C} variant="muted">{r.impact}</CVisionBadge></CVisionTd>
                        <CVisionTd><CVisionBadge C={C} variant={riskVariant(r.status)}>{r.status}</CVisionBadge></CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </CVisionTabContent>

        {/* Comms Tab */}
        <CVisionTabContent id="comms" activeTab={detailTab}>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('خطة التواصل', 'Communication Plan')}</span>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{(selected.communications || []).length} {tr('تواصل مخطط', 'communications planned')}</div>
              </div>
              <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" icon={PlusCircle} onClick={() => setShowComm(true)}>
                {tr('اضافة تواصل', 'Add Communication')}
              </CVisionButton>
            </CVisionCardHeader>
            <CVisionCardBody>
              {(selected.communications || []).length === 0 ? (
                <CVisionEmptyState C={C} icon={MessageSquare} title={tr('لا توجد اتصالات مخططة', 'No communications planned yet')} description={tr('خطط للتواصل لابقاء اصحاب المصلحة على اطلاع', 'Plan communications to keep stakeholders informed')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(selected.communications || []).map((c: any) => (
                    <div key={c.commId} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <CVisionBadge C={C} variant="muted">{c.channel}</CVisionBadge>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: C.text }}>{c.message}</p>
                        {c.audience && <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tr('الجمهور', 'Audience')}: {c.audience}</p>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <CVisionBadge C={C} variant={c.status === 'SENT' ? 'success' : 'muted'}>{c.status}</CVisionBadge>
                        {c.scheduledDate && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{fmtDate(c.scheduledDate)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </CVisionTabContent>

        {/* Status Update Dialog */}
        <CVisionDialog C={C} open={showStatusUpdate} onClose={() => setShowStatusUpdate(false)} title={tr('تحديث الحالة', 'Update Status')} isRTL={isRTL} width={400}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['PLANNING', 'IN_PROGRESS', 'MONITORING', 'COMPLETED', 'PAUSED', 'CANCELLED'].map(s => {
              const Icon = STATUS_ICONS[s] || Workflow;
              return (
                <CVisionButton key={s} C={C} isDark={isDark} variant={selected.status === s ? 'primary' : 'outline'} size="sm" icon={Icon} onClick={() => updateStatus(s)} style={{ justifyContent: 'flex-start' }}>
                  {s.replace(/_/g, ' ')}
                </CVisionButton>
              );
            })}
          </div>
        </CVisionDialog>

        {/* Risk Dialog */}
        <CVisionDialog C={C} open={showRisk} onClose={() => setShowRisk(false)} title={tr('اضافة خطر', 'Add Risk')} isRTL={isRTL}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <CVisionLabel C={C}>{tr('الوصف', 'Description')}</CVisionLabel>
              <CVisionTextarea C={C} placeholder={tr('وصف الخطر...', 'Describe the risk...')} value={riskForm.description} onChange={e => setRiskForm({ ...riskForm, description: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CVisionSelect C={C} label={tr('الاحتمال', 'Likelihood')} value={riskForm.likelihood} onChange={v => setRiskForm({ ...riskForm, likelihood: v })} options={['LOW', 'MEDIUM', 'HIGH'].map(l => ({ value: l, label: l }))} />
              <CVisionSelect C={C} label={tr('الأثر', 'Impact')} value={riskForm.impact} onChange={v => setRiskForm({ ...riskForm, impact: v })} options={['LOW', 'MEDIUM', 'HIGH'].map(l => ({ value: l, label: l }))} />
            </div>
            <CVisionInput C={C} label={tr('خطة التخفيف', 'Mitigation Plan')} placeholder={tr('كيفية تخفيف هذا الخطر...', 'How to mitigate this risk...')} value={riskForm.mitigation} onChange={e => setRiskForm({ ...riskForm, mitigation: e.target.value })} />
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowRisk(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={addRisk}>{tr('اضافة', 'Add Risk')}</CVisionButton>
          </CVisionDialogFooter>
        </CVisionDialog>

        {/* Communication Dialog */}
        <CVisionDialog C={C} open={showComm} onClose={() => setShowComm(false)} title={tr('تخطيط تواصل', 'Plan Communication')} isRTL={isRTL}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CVisionSelect C={C} label={tr('القناة', 'Channel')} value={commForm.channel} onChange={v => setCommForm({ ...commForm, channel: v })} options={['EMAIL', 'MEETING', 'ANNOUNCEMENT', 'TRAINING', 'NEWSLETTER', 'TOWN_HALL'].map(c => ({ value: c, label: c.replace(/_/g, ' ') }))} />
            <CVisionInput C={C} label={tr('الجمهور المستهدف', 'Target Audience')} placeholder={tr('مثلا: جميع الموظفين', 'e.g. All Employees, Department Heads...')} value={commForm.audience} onChange={e => setCommForm({ ...commForm, audience: e.target.value })} />
            <CVisionTextarea C={C} label={tr('الرسالة', 'Message')} placeholder={tr('محتوى التواصل...', 'Communication content...')} value={commForm.message} onChange={e => setCommForm({ ...commForm, message: e.target.value })} />
            <CVisionInput C={C} type="date" label={tr('التاريخ المجدول', 'Scheduled Date')} value={commForm.scheduledDate} onChange={e => setCommForm({ ...commForm, scheduledDate: e.target.value })} />
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowComm(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={addComm}>{tr('تخطيط', 'Plan Communication')}</CVisionButton>
          </CVisionDialogFooter>
        </CVisionDialog>
      </CVisionPageLayout>
    );
  }

  /* -- List View -- */
  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('ادارة التغيير', 'Change Management')}
        titleEn={isRTL ? 'Change Management' : undefined}
        subtitle={tr('تتبع وادارة مبادرات التغيير التنظيمي', 'Track and manage organizational change initiatives')}
        icon={Workflow}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={PlusCircle} onClick={() => setShowCreate(true)}>
            {tr('مبادرة جديدة', 'New Initiative')}
          </CVisionButton>
        }
      />

      {/* Dashboard Stats */}
      {dashboard && (
        <CVisionStatsRow>
          <CVisionCard C={C} style={{ flex: '1 1 120px' }}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{dashboard.total}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('اجمالي المبادرات', 'Total Initiatives')}</div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ flex: '1 1 120px' }}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{dashboard.active}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('نشطة', 'Active')}</div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ flex: '1 1 120px' }}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{dashboard.avgAdoption}%</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('متوسط التبني', 'Avg Adoption')}</div>
              <div style={{ width: '100%', background: C.barTrack, borderRadius: 99, height: 4, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: 4, borderRadius: 99, background: C.gold, width: `${dashboard.avgAdoption}%` }} />
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ flex: '2 1 240px' }}>
            <CVisionCardBody style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textAlign: 'center' }}>{tr('متوسط ADKAR', 'ADKAR Average')}</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {ADKAR.map(d => (
                  <div key={d} style={{ textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', background: ADKAR_COLORS[d] }}>
                      {dashboard.avgAdkar?.[d] || 0}%
                    </div>
                    <div style={{ fontSize: 9, color: C.textMuted, marginTop: 4 }}>{d[0].toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </CVisionStatsRow>
      )}

      {/* Initiatives List */}
      {initiatives.length === 0 ? (
        <CVisionEmptyState
          C={C}
          icon={Workflow}
          title={tr('لا توجد مبادرات تغيير', 'No Change Initiatives')}
          description={tr('انشئ اول مبادرة تغيير للبدء', 'Create your first change initiative to get started')}
          action={
            <CVisionButton C={C} isDark={isDark} variant="primary" icon={PlusCircle} onClick={() => setShowCreate(true)}>
              {tr('انشاء مبادرة', 'Create Initiative')}
            </CVisionButton>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {initiatives.map(init => {
            const StatusIcon = STATUS_ICONS[init.status] || Workflow;
            const avg = adkarAvg(init.adkarScores);
            const iconBg = init.status === 'COMPLETED' ? C.greenDim : init.status === 'IN_PROGRESS' ? C.blueDim : C.bgSubtle;
            const iconColor = init.status === 'COMPLETED' ? C.green : init.status === 'IN_PROGRESS' ? C.blue : C.textMuted;
            return (
              <CVisionCard key={init.initiativeId} C={C} hover onClick={() => setSelected(init)} style={{ cursor: 'pointer' }}>
                <CVisionCardBody style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: iconBg }}>
                      <StatusIcon size={20} color={iconColor} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{init.title}</span>
                        <CVisionBadge C={C} variant={statusVariant(init.status)}>{init.status.replace(/_/g, ' ')}</CVisionBadge>
                        <CVisionBadge C={C} variant="muted">{TYPE_LABELS[init.type] || init.type}</CVisionBadge>
                        <CVisionBadge C={C} variant={priorityVariant(init.priority)}>{init.priority}</CVisionBadge>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: C.textMuted }}>
                        <span>{tr('المرحلة', 'Phase')} {init.kotterPhase}/8: {KOTTER_STEPS[(init.kotterPhase || 1) - 1]?.short}</span>
                        <span>ADKAR: {avg}%</span>
                        {(init.risks || []).length > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <AlertTriangle size={12} color={C.orange} />{(init.risks || []).filter((r: any) => r.status === 'OPEN').length} {tr('مخاطر', 'risks')}
                          </span>
                        )}
                        <span>{fmtDate(init.createdAt)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{init.adoptionRate || 0}%</div>
                      <div style={{ fontSize: 10, color: C.textMuted }}>{tr('التبني', 'Adoption')}</div>
                    </div>
                    <ArrowUpRight size={16} color={C.textMuted} style={{ flexShrink: 0 }} />
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CVisionDialog C={C} open={showCreate} onClose={() => setShowCreate(false)} title={tr('مبادرة تغيير جديدة', 'New Change Initiative')} isRTL={isRTL} width={540}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionInput C={C} label={tr('العنوان (انجليزي)', 'Title (English)')} placeholder={tr('عنوان المبادرة', 'Initiative title')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <CVisionInput C={C} label={tr('العنوان (عربي)', 'Title (Arabic)')} placeholder={tr('العنوان', 'Arabic title')} dir="rtl" value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} />
          </div>
          <CVisionTextarea C={C} label={tr('الوصف', 'Description')} placeholder={tr('وصف مبادرة التغيير واهدافها والنتائج المتوقعة...', 'Describe the change initiative, its goals, and expected outcomes...')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionSelect C={C} label={tr('نوع التغيير', 'Change Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            <CVisionSelect C={C} label={tr('الاولوية', 'Priority')} value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={[{ value: 'HIGH', label: tr('عالية', 'High') }, { value: 'MEDIUM', label: tr('متوسطة', 'Medium') }, { value: 'LOW', label: tr('منخفضة', 'Low') }]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionInput C={C} type="date" label={tr('تاريخ البداية', 'Start Date')} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            <CVisionInput C={C} type="date" label={tr('تاريخ الانتهاء المستهدف', 'Target End Date')} value={form.targetEndDate} onChange={e => setForm({ ...form, targetEndDate: e.target.value })} />
          </div>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setShowCreate(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleCreate}>{tr('انشاء المبادرة', 'Create Initiative')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
