'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useCallback, useEffect, useState } from 'react';
import {
  MessageSquare, Plus, Send, Clock, CheckCircle, Loader2,
  XCircle, Eye, Copy, ExternalLink,
  RefreshCw, AlertTriangle, RotateCcw, Mail, FileText,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface InterviewSession {
  id: string;
  sessionId: string;
  candidateId: string;
  candidateName: string;
  requisitionId: string;
  jobTitle: string;
  status: string;
  overallScore: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  concerns: string[];
  questions: any[];
  answers: any[];
  inviteLink: string;
  inviteSentAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  language?: string;
}

interface JobOption { id: string; title: string; department?: string }
interface CandidateOption { id: string; fullName: string; email?: string }

const STATUS_CONFIG_LABELS: Record<string, { icon: typeof CheckCircle; labelEn: string; labelAr: string; cls: string }> = {
  COMPLETED: { icon: CheckCircle, labelEn: 'Completed', labelAr: 'مكتمل', cls: 'bg-green-100 text-green-800 border-green-200' },
  SCORED: { icon: CheckCircle, labelEn: 'Scored', labelAr: 'تم التقييم', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  IN_PROGRESS: { icon: Clock, labelEn: 'In Progress', labelAr: 'قيد التنفيذ', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  SENT: { icon: Mail, labelEn: 'Sent', labelAr: 'تم الإرسال', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  PENDING: { icon: Clock, labelEn: 'Pending', labelAr: 'معلق', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  EXPIRED: { icon: XCircle, labelEn: 'Expired', labelAr: 'منتهي', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  CANCELLED: { icon: XCircle, labelEn: 'Cancelled', labelAr: 'ملغي', cls: 'bg-red-100 text-red-700 border-red-200' },
};

const RECOMMENDATION_CONFIG_LABELS: Record<string, { labelEn: string; labelAr: string; cls: string }> = {
  ADVANCE: { labelEn: 'Advance', labelAr: 'تقدم', cls: 'bg-green-100 text-green-800' },
  CONSIDER: { labelEn: 'Consider', labelAr: 'قيد الدراسة', cls: 'bg-amber-100 text-amber-800' },
  REJECT: { labelEn: 'Reject', labelAr: 'رفض', cls: 'bg-red-100 text-red-800' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function AIScreeningTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createJob, setCreateJob] = useState('');
  const [createCandidate, setCreateCandidate] = useState('');
  const [createLang, setCreateLang] = useState('en');
  const [createCount, setCreateCount] = useState('8');
  const [creating, setCreating] = useState(false);

  // Session detail dialog (for ALL statuses — replaces old results-only dialog)
  const [detailSession, setDetailSession] = useState<InterviewSession | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Filter
  const [filterStatus, setFilterStatus] = useState('ALL');

  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'sessions' });
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      const res = await fetch(`/api/cvision/ai/chatbot?${params}`, { credentials: 'include', signal });
      const json = await res.json();
      setSessions(json.data?.items || json.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { const ac = new AbortController(); loadSessions(ac.signal); return () => ac.abort(); }, [loadSessions]);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/cvision/recruitment/openings?status=open&limit=200', { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => setJobs((d.data || d.items || []).map((j: any) => ({ id: j.id, title: j.title, department: j.departmentName }))))
      .catch(() => setJobs([]));
    fetch('/api/cvision/recruitment/candidates?limit=200&stage=all', { credentials: 'include', signal: ac.signal })
      .then(r => r.json())
      .then(d => setCandidates((d.data || d.items || []).map((c: any) => ({
        id: c.id,
        fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        email: c.email,
      }))))
      .catch(() => setCandidates([]));
    return () => ac.abort();
  }, []);

  async function handleCreate() {
    if (!createJob || !createCandidate) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cvision/ai/chatbot', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-session',
          candidateId: createCandidate,
          requisitionId: createJob,
          language: createLang,
          questionCount: Number(createCount) || 8,
        }),
      });
      const json = await res.json();
      setCreateOpen(false);
      setCreateCandidate('');
      setCreateJob('');
      loadSessions();
      // Auto-open the newly created session detail
      if (json.data?.session) {
        openSessionDetail(json.data.session);
      }
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }

  async function handleSendInvite(session: InterviewSession, e?: React.MouseEvent) {
    e?.stopPropagation();
    const cand = candidates.find(c => c.id === session.candidateId);
    if (!cand?.email) return;
    setSendingInvite(true);
    try {
      await fetch('/api/cvision/ai/chatbot', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-invite', sessionId: session.id, email: cand.email }),
      });
      loadSessions();
      // Update detail if open
      if (detailSession?.id === session.id) {
        setDetailSession(prev => prev ? { ...prev, status: 'SENT', inviteSentAt: new Date().toISOString() } : null);
      }
    } catch { /* ignore */ }
    finally { setSendingInvite(false); }
  }

  async function openSessionDetail(session: InterviewSession) {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetailSession(session);
    try {
      const res = await fetch(
        `/api/cvision/ai/chatbot?action=session-detail&sessionId=${session.id}`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (json.data) {
        setDetailSession({ ...session, ...json.data });
      }
    } catch {
      // Keep the session data we already have
    }
    finally { setDetailLoading(false); }
  }

  async function handleRegenerateQuestions() {
    if (!detailSession) return;
    setRegenerating(true);
    try {
      const res = await fetch('/api/cvision/ai/chatbot', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate-questions',
          sessionId: detailSession.id,
        }),
      });
      const json = await res.json();
      if (json.data?.questions) {
        setDetailSession(prev => prev ? { ...prev, questions: json.data.questions, answers: [] } : null);
      }
      loadSessions();
    } catch { /* ignore */ }
    finally { setRegenerating(false); }
  }

  function copyInviteLink(link: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    navigator.clipboard.writeText(window.location.origin + link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const isActiveSession = (status: string) =>
    status === 'PENDING' || status === 'SENT';

  const hasQuestions = (session: InterviewSession) =>
    session.questions && session.questions.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CVisionSelect
                C={C}
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { value: 'ALL', label: tr('جميع الجلسات', 'All Sessions') },
                  { value: 'PENDING', label: tr('معلق', 'Pending') },
                  { value: 'SENT', label: tr('تم الإرسال', 'Sent') },
                  { value: 'IN_PROGRESS', label: tr('قيد التنفيذ', 'In Progress') },
                  { value: 'COMPLETED', label: tr('مكتمل', 'Completed') },
                ]}
                style={{ width: 144 }}
              />
          <button onClick={() => loadSessions()} style={{ padding: 8, border: `1px solid ${C.border}`, borderRadius: 12 }} title={tr('تحديث', 'Refresh')}>
            <RefreshCw style={{ height: 16, width: 16 }} />
          </button>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 500, background: C.gold, color: '#fff', borderRadius: 12 }}
        >
          <Plus style={{ height: 16, width: 16 }} />
          {tr('إنشاء جلسة مقابلة', 'Create Interview Session')}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 80, borderRadius: 16 }}  />)}
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted, maxWidth: 448 }}>
          <MessageSquare style={{ height: 40, width: 40, marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontWeight: 600 }}>{tr('لا توجد مقابلات فحص بعد', 'No screening interviews yet')}</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>
            {tr('تتيح لك مقابلات الفحص بالذكاء الاصطناعي تقييم المرشحين تلقائيًا بأسئلة مخصصة.', 'AI screening interviews let you automatically evaluate candidates with customized questions.')}
          </p>
          <div style={{ textAlign: 'left', marginTop: 16, borderRadius: 12, padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontWeight: 500 }}>{tr('للبدء:', 'To get started:')}</p>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: 4, color: C.textMuted }}>
              <li>{tr('انقر على', 'Click')} <strong className="text-foreground">{tr('إنشاء جلسة مقابلة', 'Create Interview Session')}</strong> {tr('أعلاه', 'above')}</li>
              <li>{tr('اختر وظيفة شاغرة ومرشح', 'Select a job opening and candidate')}</li>
              <li>{tr('أرسل رابط الدعوة إلى المرشح', 'Send the invite link to the candidate')}</li>
              <li>{tr('راجع النتائج بعد إكمال المقابلة', 'Review results once they complete the interview')}</li>
            </ol>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, fontWeight: 500, background: C.gold, color: '#fff', borderRadius: 12 }}
          >
            <Plus style={{ height: 16, width: 16 }} />
            {tr('إنشاء جلسة مقابلة', 'Create Interview Session')}
          </button>
        </div>
      )}

      {/* Sessions table — rows are clickable to open detail */}
      {!loading && sessions.length > 0 && (
        <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ textAlign: 'left', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 500 }}>{tr('المرشح', 'Candidate')}</th>
                <th style={{ textAlign: 'left', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 500, display: 'none' }}>{tr('الوظيفة', 'Job')}</th>
                <th style={{ textAlign: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 500 }}>{tr('الحالة', 'Status')}</th>
                <th style={{ textAlign: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 500, display: 'none' }}>{tr('الأسئلة', 'Questions')}</th>
                <th style={{ textAlign: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 500, display: 'none' }}>{tr('الدرجة', 'Score')}</th>
                <th style={{ textAlign: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 500, display: 'none' }}>{tr('التاريخ', 'Date')}</th>
                <th style={{ textAlign: 'right', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontWeight: 500 }}>{tr('الإجراءات', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => {
                const sc = STATUS_CONFIG_LABELS[s.status] || STATUS_CONFIG_LABELS.PENDING;
                const Icon = sc.icon;
                const qCount = s.questions?.length || 0;
                const aCount = s.answers?.length || 0;
                return (
                  <tr
                    key={s.id}
                    style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}
                    onClick={() => openSessionDetail(s)}
                  >
                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}>
                      <p style={{ fontWeight: 500 }}>{s.candidateName}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>{s.sessionId}</p>
                    </td>
                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, display: 'none', color: C.textMuted }}>{s.jobTitle}</td>
                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'center' }}>
                      <CVisionBadge C={C} className={`text-xs border ${sc.cls}`}>
                        <Icon style={{ height: 12, width: 12, marginRight: 4 }} />{tr(sc.labelAr, sc.labelEn)}
                      </CVisionBadge>
                    </td>
                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'center', display: 'none' }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>
                        {qCount > 0 ? (
                          s.status === 'COMPLETED' || s.status === 'SCORED'
                            ? `${aCount}/${qCount}`
                            : `${qCount} ${tr('س', 'Q')}`
                        ) : (
                          <span style={{ color: C.orange }}>0</span>
                        )}
                      </span>
                    </td>
                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'center', display: 'none' }}>
                      {(s.status === 'COMPLETED' || s.status === 'SCORED') && s.overallScore > 0 ? (
                        <span style={{ fontWeight: 600 }}>{s.overallScore}/100</span>
                      ) : '—'}
                    </td>
                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'center', fontSize: 12, color: C.textMuted, display: 'none' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        {(s.status === 'COMPLETED' || s.status === 'SCORED') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openSessionDetail(s); }}
                            style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Eye style={{ height: 12, width: 12 }} /> {tr('النتائج', 'Results')}
                          </button>
                        )}
                        {s.status === 'PENDING' && (
                          <>
                            <button
                              onClick={(e) => handleSendInvite(s, e)}
                              style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, background: C.blueDim, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <Send style={{ height: 12, width: 12 }} /> {tr('إرسال', 'Send')}
                            </button>
                            <button
                              onClick={(e) => copyInviteLink(s.inviteLink, e)}
                              style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                              title={tr('نسخ رابط الدعوة', 'Copy invite link')}
                            >
                              <Copy style={{ height: 12, width: 12 }} />
                            </button>
                          </>
                        )}
                        {s.status === 'SENT' && (
                          <button
                            onClick={(e) => copyInviteLink(s.inviteLink, e)}
                            style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                            title={tr('نسخ رابط الدعوة', 'Copy invite link')}
                          >
                            <Copy style={{ height: 12, width: 12 }} /> {tr('رابط', 'Link')}
                          </button>
                        )}
                        {s.status === 'IN_PROGRESS' && (
                          <button
                            onClick={(e) => copyInviteLink(s.inviteLink, e)}
                            style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <ExternalLink style={{ height: 12, width: 12 }} /> {tr('رابط', 'Link')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create dialog ──────────────────────────────────────────────────── */}
      <CVisionDialog C={C} open={createOpen} onClose={() => setCreateOpen(false)} title="Create Program" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {tr('اختر وظيفة شاغرة ومرشح لتوليد أسئلة المقابلة تلقائيًا.', 'Select a job opening and candidate to generate interview questions automatically.')}
            </p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الوظيفة الشاغرة *', 'Job Opening *')}</label>
              <CVisionSelect
                C={C}
                value={createJob}
                onChange={setCreateJob}
                placeholder={jobs.length === 0 ? tr('لا توجد وظائف شاغرة — أنشئ واحدة أولاً', 'No openings found — create one first') : tr('اختر وظيفة...', 'Select job...')}
                options={jobs.map(j => (
                    ({ value: j.id, label: `${j.title}${j.department ? ` - ${j.department}` : ''}` })
                  ))}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('المرشح *', 'Candidate *')}</label>
              <CVisionSelect
                C={C}
                value={createCandidate}
                onChange={setCreateCandidate}
                placeholder={tr('اختر مرشح...', 'Select candidate...')}
                options={candidates.map(c => (
                    ({ value: c.id, label: `${c.fullName}${c.email ? ` (${c.email})` : ''}` })
                  ))}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('اللغة', 'Language')}</label>
                <CVisionSelect
                C={C}
                value={createLang}
                onChange={setCreateLang}
                options={[
                  { value: 'en', label: tr('الإنجليزية', 'English') },
                  { value: 'ar', label: tr('العربية', 'Arabic') },
                  { value: 'both', label: tr('كلاهما', 'Both') },
                ]}
              />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الأسئلة', 'Questions')}</label>
                <CVisionInput C={C}
                  type="number" min="5" max="15"
                  value={createCount}
                  onChange={e => setCreateCount(e.target.value)}
                />
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <button onClick={() => setCreateOpen(false)} style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 12 }}>{tr('إلغاء', 'Cancel')}</button>
            <button
              onClick={handleCreate}
              disabled={!createJob || !createCandidate || creating}
              style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 13, background: C.gold, color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {creating && <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} />}
              {tr('إنشاء وتوليد', 'Create & Generate')}
            </button>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Session detail dialog (all statuses) ────────────────────────────── */}
      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)} title="Details" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {detailSession
                ? `${detailSession.candidateName} — ${detailSession.jobTitle}`
                : tr('جاري تحميل تفاصيل الجلسة...', 'Loading session details...')}
            </p>
          {detailLoading ? (
            <div style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}><Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite' }} /></div>
          ) : detailSession ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header with status + score */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <p style={{ fontWeight: 600, fontSize: 16 }}>{detailSession.candidateName}</p>
                  <p style={{ fontSize: 13, color: C.textMuted }}>{detailSession.jobTitle}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {(() => {
                      const sc = STATUS_CONFIG_LABELS[detailSession.status] || STATUS_CONFIG_LABELS.PENDING;
                      const Icon = sc.icon;
                      return (
                        <CVisionBadge C={C} className={`text-xs border ${sc.cls}`}>
                          <Icon style={{ height: 12, width: 12, marginRight: 4 }} />{tr(sc.labelAr, sc.labelEn)}
                        </CVisionBadge>
                      );
                    })()}
                    <span style={{ fontSize: 12, color: C.textMuted }}>{detailSession.sessionId}</span>
                  </div>
                </div>
                {(detailSession.status === 'COMPLETED' || detailSession.status === 'SCORED') && detailSession.overallScore > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 30, fontWeight: 700 }}>{detailSession.overallScore}<span style={{ fontSize: 14, color: C.textMuted }}>/100</span></p>
                    {RECOMMENDATION_CONFIG_LABELS[detailSession.recommendation] && (
                      <CVisionBadge C={C} className={`mt-1 ${RECOMMENDATION_CONFIG_LABELS[detailSession.recommendation].cls}`}>
                        {tr(RECOMMENDATION_CONFIG_LABELS[detailSession.recommendation].labelAr, RECOMMENDATION_CONFIG_LABELS[detailSession.recommendation].labelEn)}
                      </CVisionBadge>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons for active sessions */}
              {isActiveSession(detailSession.status) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
                  {detailSession.status === 'PENDING' && (
                    <button
                      onClick={() => handleSendInvite(detailSession)}
                      disabled={sendingInvite}
                      style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, background: C.blueDim, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {sendingInvite ? <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> : <Send style={{ height: 12, width: 12 }} />}
                      {tr('إرسال دعوة للمرشح', 'Send Invite to Candidate')}
                    </button>
                  )}
                  <button
                    onClick={() => copyInviteLink(detailSession.inviteLink)}
                    style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Copy style={{ height: 12, width: 12 }} />
                    {copiedLink ? tr('تم النسخ!', 'Copied!') : tr('نسخ رابط الدعوة', 'Copy Invite Link')}
                  </button>
                  <button
                    onClick={handleRegenerateQuestions}
                    disabled={regenerating}
                    style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6, color: C.orange }}
                  >
                    {regenerating ? <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> : <RotateCcw style={{ height: 12, width: 12 }} />}
                    {tr('إعادة توليد الأسئلة', 'Regenerate Questions')}
                  </button>
                </div>
              )}

              {/* Invite info */}
              {detailSession.inviteSentAt && (
                <div style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 12 }}>
                  <Mail style={{ height: 14, width: 14 }} />
                  {tr('تم إرسال الدعوة في', 'Invite sent on')} {new Date(detailSession.inviteSentAt).toLocaleString()}
                </div>
              )}

              {/* Summary (for completed) */}
              {detailSession.summary && (
                <div style={{ borderRadius: 16, padding: 16, fontSize: 13 }}>{detailSession.summary}</div>
              )}

              {/* Strengths / Concerns (for completed) */}
              {(detailSession.strengths?.length > 0 || detailSession.concerns?.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                  {detailSession.strengths?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.green, marginBottom: 6 }}>{tr('نقاط القوة', 'Strengths')}</p>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {detailSession.strengths.map((s, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13 }}>
                            <CheckCircle style={{ height: 14, width: 14, color: C.green, marginTop: 2 }} />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {detailSession.concerns?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.orange, marginBottom: 6 }}>{tr('المخاوف', 'Concerns')}</p>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {detailSession.concerns.map((c, i) => (
                          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 13 }}>
                            <AlertTriangle style={{ height: 14, width: 14, color: C.orange, marginTop: 2 }} />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Questions list — shown for ALL statuses */}
              {hasQuestions(detailSession) ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText style={{ height: 14, width: 14 }} />
                      {detailSession.status === 'COMPLETED' || detailSession.status === 'SCORED'
                        ? tr('تفصيل الأسئلة', 'Question Breakdown')
                        : `${tr('أسئلة المقابلة', 'Interview Questions')} (${detailSession.questions.length})`}
                    </p>
                  </div>
                  <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                          <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, width: 32 }}>#</th>
                          <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>{tr('الفئة', 'Category')}</th>
                          <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>{tr('السؤال', 'Question')}</th>
                          {(detailSession.status === 'COMPLETED' || detailSession.status === 'SCORED' || detailSession.answers?.length > 0) && (
                            <th style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, width: 64 }}>{tr('الدرجة', 'Score')}</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {detailSession.questions.map((q: any, i: number) => {
                          const ans = detailSession.answers?.find((a: any) => a.questionId === q.id);
                          const score = ans?.score ?? null;
                          const scoreCls = score !== null
                            ? score >= 70 ? 'text-green-700 bg-green-50' : score >= 40 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'
                            : '';
                          return (
                            <tr key={q.id || i} style={{ borderBottom: `1px solid ${C.border}` }}>
                              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, color: C.textMuted }}>{i + 1}</td>
                              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
                                <CVisionBadge C={C} variant="outline" className="text-[10px]">{q.category}</CVisionBadge>
                              </td>
                              <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, color: C.textMuted }}>
                                {q.question}
                              </td>
                              {(detailSession.status === 'COMPLETED' || detailSession.status === 'SCORED' || detailSession.answers?.length > 0) && (
                                <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>
                                  {score !== null ? (
                                    <span className={`inline-block px-2 py-0.5 rounded font-medium ${scoreCls}`}>{score}</span>
                                  ) : (
                                    <span style={{ color: C.textMuted }}>—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, background: C.orangeDim, borderRadius: 16, border: `1px solid ${C.border}` }}>
                  <AlertTriangle style={{ height: 32, width: 32, marginBottom: 8, color: C.orange }} />
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.orange }}>{tr('لم يتم توليد أسئلة', 'No questions generated')}</p>
                  <p style={{ fontSize: 12, color: C.orange, marginTop: 4 }}>
                    {tr('انقر على "إعادة توليد الأسئلة" لتوليد أسئلة المقابلة لهذه الجلسة.', 'Click "Regenerate Questions" to generate interview questions for this session.')}
                  </p>
                  {isActiveSession(detailSession.status) && (
                    <button
                      onClick={handleRegenerateQuestions}
                      disabled={regenerating}
                      style={{ marginTop: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, fontSize: 12, background: C.orangeDim, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {regenerating ? <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite' }} /> : <RotateCcw style={{ height: 12, width: 12 }} />}
                      {tr('توليد الأسئلة الآن', 'Generate Questions Now')}
                    </button>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div style={{ fontSize: 12, color: C.textMuted, borderTop: `1px solid ${C.border}`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <p>{tr('تاريخ الإنشاء:', 'Created:')} {new Date(detailSession.createdAt).toLocaleString()}</p>
                {detailSession.startedAt && <p>{tr('تاريخ البدء:', 'Started:')} {new Date(detailSession.startedAt).toLocaleString()}</p>}
                {detailSession.completedAt && <p>{tr('تاريخ الإكمال:', 'Completed:')} {new Date(detailSession.completedAt).toLocaleString()}</p>}
                {detailSession.language && <p>{tr('اللغة:', 'Language:')} {detailSession.language === 'en' ? tr('الإنجليزية', 'English') : detailSession.language === 'ar' ? tr('العربية', 'Arabic') : tr('كلاهما', 'Both')}</p>}
              </div>
            </div>
          ) : null}
      </CVisionDialog>
    </div>
  );
}
