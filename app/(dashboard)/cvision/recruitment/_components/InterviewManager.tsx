'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import { toast } from 'sonner';
import {
  Calendar, Clock, Video, Phone, MapPin, Users, Star, Loader2,
  Send, CheckCircle, XCircle, Pause, RotateCw, ChevronRight,
  MessageSquare, User, Sparkles, Copy, ExternalLink,
} from 'lucide-react';
import type { Candidate } from './types';

// ── Types ──────────────────────────────────────────────────────

interface InterviewRecord {
  interviewId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  department: string;
  type: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  location?: string;
  videoLink?: string;
  panel: PanelMember[];
  status: string;
  invitationSent: boolean;
  invitationSentAt?: string;
  candidateConfirmed: boolean;
  feedback: FeedbackEntry[];
  decision?: string;
  decisionNotes?: string;
  round: number;
  notes?: string;
  createdAt: string;
}

interface PanelMember {
  interviewerId: string;
  interviewerName: string;
  interviewerTitle: string;
  role: string;
  confirmed: boolean;
}

interface FeedbackEntry {
  interviewerId: string;
  interviewerName: string;
  scores: { category: string; score: number; notes?: string }[];
  overallScore: number;
  recommendation: string;
  strengths: string;
  concerns: string;
  submittedAt: string;
}

interface ScoreCategory {
  id: string;
  label: string;
  labelAr: string;
}

interface Employee {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobTitle?: string;
  positionTitle?: string;
}

// ── Main Component ─────────────────────────────────────────────

interface InterviewManagerProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'schedule' | 'feedback' | 'decision' | 'history';
  onDone?: () => void;
  preselectedJobId?: string;
  defaultType?: string;
  onVideoSessionCreated?: (candidate: Candidate, inviteLink: string) => void;
}

export default function InterviewManager({ candidate, open, onOpenChange, mode, onDone, preselectedJobId, defaultType, onVideoSessionCreated }: InterviewManagerProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeMode, setActiveMode] = useState(mode);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<InterviewRecord | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<ScoreCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Schedule form
  const [schedType, setSchedType] = useState('IN_PERSON');
  const [schedVideoLang, setSchedVideoLang] = useState<'en' | 'ar'>('en');
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('10:00');
  const [schedDuration, setSchedDuration] = useState('30');
  const [schedLocation, setSchedLocation] = useState('');
  const [schedVideoLink, setSchedVideoLink] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [panelMembers, setPanelMembers] = useState<{ interviewerId: string; role: string; name: string }[]>([]);
  const [panelSelectId, setPanelSelectId] = useState('');

  // Feedback form
  const [feedbackScores, setFeedbackScores] = useState<Record<string, number>>({});
  const [feedbackRec, setFeedbackRec] = useState('');
  const [feedbackStrengths, setFeedbackStrengths] = useState('');
  const [feedbackConcerns, setFeedbackConcerns] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');

  // Decision form
  const [decisionChoice, setDecisionChoice] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');

  // AI Video Interview session (created automatically for VIDEO interviews)
  const [aiVideoInviteLink, setAiVideoInviteLink] = useState<string | null>(null);
  const [creatingVideoSession, setCreatingVideoSession] = useState(false);

  useEffect(() => {
    if (open && candidate) {
      setActiveMode(mode);

      // Reset all form state for the new candidate
      setSelectedInterview(null);
      setInterviews([]);
      setFeedbackScores({});
      setFeedbackRec('');
      setFeedbackStrengths('');
      setFeedbackConcerns('');
      setFeedbackNotes('');
      setDecisionChoice('');
      setDecisionNotes('');
      setPanelMembers([]);
      setPanelSelectId('');
      setSchedNotes('');
      setSchedLocation('');
      setSchedVideoLink('');
      setSchedType(defaultType || 'IN_PERSON');
      setSchedDuration('30');
      setSchedTime('10:00');
      setAiVideoInviteLink(null);
      setCreatingVideoSession(false);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSchedDate(tomorrow.toISOString().split('T')[0]);

      loadInterviews();
      loadEmployees();
      loadCategories();
    }
  }, [open, candidate?.id, mode]);

  const loadInterviews = useCallback(async (signal?: AbortSignal) => {
    if (!candidate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/interviews?action=candidate-interviews&candidateId=${candidate.id}`, { credentials: 'include', signal });
      const data = await res.json();
      if (data.success) {
        setInterviews(data.interviews || []);
        const latest = (data.interviews || []).find((i: any) => ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(i.status));
        if (latest) setSelectedInterview(latest);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [candidate?.id]);

  async function loadEmployees() {
    try {
      const res = await fetch('/api/cvision/employees?limit=200&status=ACTIVE', { credentials: 'include' });
      const data = await res.json();
      setEmployees((data.items || data.data?.items || data.data || []).map((e: any) => ({
        id: e.id, firstName: e.firstName, lastName: e.lastName, fullName: e.fullName,
        jobTitle: e.jobTitle || e.positionTitle,
      })));
    } catch { /* ignore */ }
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/cvision/recruitment/interviews?action=score-categories', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setCategories(data.categories || []);
    } catch { /* ignore */ }
  }

  function empName(emp: Employee) {
    return emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unknown';
  }

  function addPanelMember() {
    if (!panelSelectId) return;
    if (panelMembers.some(p => p.interviewerId === panelSelectId)) return;
    const emp = employees.find(e => e.id === panelSelectId);
    if (!emp) return;
    setPanelMembers([...panelMembers, {
      interviewerId: emp.id,
      role: panelMembers.length === 0 ? 'LEAD' : 'MEMBER',
      name: empName(emp),
    }]);
    setPanelSelectId('');
  }

  function removePanelMember(id: string) {
    setPanelMembers(panelMembers.filter(p => p.interviewerId !== id));
  }

  // ── Schedule ─────────────────────────────────────────────────

  async function handleSchedule(sendInvite = false) {
    if (!candidate || !schedDate || !schedTime) { toast.error(tr('التاريخ والوقت مطلوبان', 'Date and time are required')); return; }
    if (panelMembers.length === 0) { toast.error(tr('أضف عضو لجنة واحد على الأقل', 'Add at least one panel member')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/cvision/recruitment/interviews', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule',
          candidateId: candidate.id,
          jobId: preselectedJobId || candidate.requisitionId || '',
          scheduledDate: schedDate,
          scheduledTime: schedTime,
          type: schedType,
          duration: parseInt(schedDuration) || 30,
          location: schedLocation || undefined,
          videoLink: schedVideoLink || undefined,
          panel: panelMembers.map(p => ({ interviewerId: p.interviewerId, role: p.role })),
          notes: schedNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (sendInvite && data.interview?.interviewId) {
          await fetch('/api/cvision/recruitment/interviews', {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send-invitation', interviewId: data.interview.interviewId }),
          });
        }

        // ── Auto-create AI Video Interview for VIDEO-type interviews ──
        let videoInvite: string | null = null;
        if (schedType === 'VIDEO') {
          try {
            setCreatingVideoSession(true);
            // 1. Find a matching job requisition
            let requisition: any = null;

            // Priority 1: Use candidate's direct requisitionId
            if (candidate.requisitionId) {
              try {
                const directRes = await fetch('/api/cvision/recruitment/requisitions?limit=100', { credentials: 'include' });
                const directData = await directRes.json();
                requisition = (directData.data?.items || directData.data || []).find((r: any) => r.id === candidate.requisitionId);
              } catch { /* continue */ }
            }

            // Priority 2: Search by jobTitleId + departmentId
            if (!requisition) {
              const reqRes = await fetch('/api/cvision/recruitment/requisitions?limit=100', { credentials: 'include' });
              const reqData = await reqRes.json();
              const openReqs = (reqData.data?.items || reqData.data || []).filter((r: any) => r.status === 'open' || r.status === 'approved');
              const reqs = openReqs.length > 0 ? openReqs : (reqData.data?.items || reqData.data || []);

              if (candidate.jobTitleId) {
                requisition = reqs.find((r: any) => r.jobTitleId === candidate.jobTitleId && r.departmentId === candidate.departmentId);
                if (!requisition) requisition = reqs.find((r: any) => r.jobTitleId === candidate.jobTitleId);
              }

              // Fuzzy title name match
              if (!requisition && candidate.jobTitleName) {
                const candTitle = candidate.jobTitleName.toLowerCase().trim();
                requisition = reqs.find((r: any) => {
                  const rt = (r.title || '').toLowerCase().trim();
                  const rjt = (r.jobTitleName || '').toLowerCase().trim();
                  return rt === candTitle || rjt === candTitle || rt.includes(candTitle) || candTitle.includes(rt);
                });
              }
              // DO NOT fall back to reqs[0]
            }

            {
              // 2. Create AI interview session (with or without requisition)
              const createRes = await fetch('/api/cvision/ai/chatbot', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'create-session',
                  candidateId: candidate.id,
                  ...(requisition
                    ? { requisitionId: requisition.id }
                    : { jobTitle: candidate.jobTitleName || candidate.departmentName || 'General' }),
                  language: schedVideoLang,
                  questionCount: 8,
                }),
              });
              const createData = await createRes.json();
              const newSessionId = createData.data?.session?.id;
              videoInvite = createData.data?.session?.inviteLink || createData.data?.inviteLink || null;

              // 3. Send invite email if we have a session and email
              if (newSessionId && candidate.email) {
                const inviteRes = await fetch('/api/cvision/ai/chatbot', {
                  method: 'POST', credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'send-invite', sessionId: newSessionId, email: candidate.email }),
                });
                const inviteData = await inviteRes.json();
                if (inviteData.data?.inviteLink) videoInvite = inviteData.data.inviteLink;
              }

              if (videoInvite) {
                setAiVideoInviteLink(videoInvite);
                onVideoSessionCreated?.(candidate, videoInvite);
              }
            }
          } catch (e) {
            console.error('Failed to create AI video session:', e);
          } finally {
            setCreatingVideoSession(false);
          }
        }

        if (schedType === 'VIDEO' && videoInvite) {
          toast.success(tr('تم جدولة المقابلة + إنشاء وإرسال مقابلة فيديو بالذكاء الاصطناعي!', 'Interview scheduled + AI Video Interview created & sent!'));
        } else if (sendInvite) {
          toast.success(tr(`تم جدولة الجولة ${data.interview.round} وإرسال الدعوة`, `Interview Round ${data.interview.round} scheduled & invitation sent`));
        } else {
          toast.success(tr(`تم جدولة الجولة ${data.interview.round}`, `Interview Round ${data.interview.round} scheduled`));
        }

        onDone?.();
        // Don't close dialog if we have a video invite to show
        if (!videoInvite) {
          onOpenChange(false);
        }
      } else {
        toast.error(data.error || tr('فشل في الجدولة', 'Failed to schedule'));
      }
    } catch { toast.error(tr('فشل في جدولة المقابلة', 'Failed to schedule interview')); }
    finally { setSaving(false); }
  }

  // ── Submit Feedback ──────────────────────────────────────────

  async function handleSubmitFeedback() {
    if (!selectedInterview) return;
    const scores = categories.map(c => ({ category: c.id, score: feedbackScores[c.id] || 0 }));
    if (scores.some(s => s.score === 0)) { toast.error(tr('يرجى تقييم جميع الفئات', 'Please score all categories')); return; }
    if (!feedbackRec) { toast.error(tr('يرجى اختيار توصية', 'Please select a recommendation')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/cvision/recruitment/interviews', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit-feedback',
          interviewId: selectedInterview.interviewId,
          scores,
          recommendation: feedbackRec,
          strengths: feedbackStrengths,
          concerns: feedbackConcerns,
          additionalNotes: feedbackNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.allFeedbackSubmitted ? tr('اكتمل تقييم جميع أعضاء اللجنة!', 'All panel feedback complete!') : tr(`تم إرسال التقييم (${data.feedbackCount}/${data.panelSize})`, `Feedback submitted (${data.feedbackCount}/${data.panelSize})`));
        await loadInterviews();
        if (data.allFeedbackSubmitted) setActiveMode('decision');
      } else {
        toast.error(data.error || tr('فشل في إرسال التقييم', 'Failed to submit feedback'));
      }
    } catch { toast.error(tr('فشل في إرسال التقييم', 'Failed to submit feedback')); }
    finally { setSaving(false); }
  }

  // ── Decide ───────────────────────────────────────────────────

  async function handleDecision() {
    if (!selectedInterview || !decisionChoice) { toast.error(tr('اختر قرارًا', 'Select a decision')); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/cvision/recruitment/interviews', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decide',
          interviewId: selectedInterview.interviewId,
          decision: decisionChoice,
          notes: decisionNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const msgs: Record<string, string> = {
          PASS: tr(`تم نقل ${candidate?.fullName} إلى مرحلة العرض — أنشئ وأرسل العرض`, `${candidate?.fullName} moved to Offer stage — create and send the offer`),
          FAIL: tr(`تم رفض ${candidate?.fullName}`, `${candidate?.fullName} has been rejected`),
          HOLD: tr(`${candidate?.fullName} قيد الانتظار`, `${candidate?.fullName} is on hold`),
          NEXT_ROUND: tr(`${candidate?.fullName} يحتاج جولة أخرى`, `${candidate?.fullName} needs another round`),
        };
        toast.success(msgs[decisionChoice] || tr('تم تسجيل القرار', 'Decision recorded'));
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(data.error || tr('فشل في تسجيل القرار', 'Failed to record decision'));
      }
    } catch { toast.error(tr('فشل في تسجيل القرار', 'Failed to record decision')); }
    finally { setSaving(false); }
  }

  // ── Send Invitation ──────────────────────────────────────────

  async function handleSendInvitation(intId: string) {
    try {
      const res = await fetch('/api/cvision/recruitment/interviews', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-invitation', interviewId: intId }),
      });
      const data = await res.json();
      if (data.success) { toast.success(tr(`تم إرسال الدعوة إلى ${data.to}`, `Invitation sent to ${data.to}`)); await loadInterviews(); }
    } catch { toast.error(tr('فشل في إرسال الدعوة', 'Failed to send invitation')); }
  }

  // ── Render ───────────────────────────────────────────────────

  if (!candidate) {
    return (
      <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title="Details" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('لم يتم اختيار مرشح', 'No candidate selected')}</p>      </CVisionDialog>
    );
  }

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title="Details" isDark={isDark}>          
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
            {activeMode === 'schedule' ? tr(`جدولة مقابلة لـ ${candidate.fullName}`, `Schedule an interview for ${candidate.fullName}`) :
             activeMode === 'feedback' ? tr(`تسجيل تقييم لـ ${candidate.fullName}`, `Record feedback for ${candidate.fullName}`) :
             activeMode === 'decision' ? tr(`اتخاذ قرار لـ ${candidate.fullName}`, `Make a decision for ${candidate.fullName}`) :
             tr(`سجل مقابلات ${candidate.fullName}`, `Interview history for ${candidate.fullName}`)}
          </p>
        {/* Candidate Info Bar */}
        <div style={{ background: C.bgSubtle, borderRadius: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontWeight: 500, fontSize: 13 }}>{candidate.fullName}</p>
            <p style={{ fontSize: 12, color: C.textMuted }}>{candidate.jobTitleName || candidate.departmentName || tr('مرشح', 'Candidate')}</p>
          </div>
          {interviews.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {['schedule', 'feedback', 'decision', 'history'].map(m => (
                <CVisionButton C={C} isDark={isDark} key={m} variant={activeMode === m ? 'default' : 'ghost'} size="sm" style={{ height: 28, fontSize: 12 }}
                  onClick={() => setActiveMode(m as 'schedule' | 'feedback' | 'decision' | 'history')}>
                  {m === 'schedule' ? tr('جدولة', 'Schedule') : m === 'feedback' ? tr('تقييم', 'Feedback') : m === 'decision' ? tr('قرار', 'Decision') : tr('السجل', 'History')}
                </CVisionButton>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 48 }}><Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite' }} /></div>
        ) : (
          <>
            {/* ── Schedule Mode ──────────────────────────────── */}
            {activeMode === 'schedule' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted }}>
                  <RotateCw style={{ height: 16, width: 16 }} />
                  {tr('الجولة', 'Round')} {interviews.filter(i => i.status !== 'CANCELLED').length + 1}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>{tr('النوع', 'Type')}</CVisionLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[
                      { v: 'IN_PERSON', icon: MapPin, label: tr('حضوري', 'In Person') },
                      { v: 'VIDEO', icon: Video, label: tr('فيديو', 'Video') },
                      { v: 'PHONE', icon: Phone, label: tr('هاتف', 'Phone') },
                    ].map(t => (
                      <CVisionButton C={C} isDark={isDark} key={t.v} variant={schedType === t.v ? 'default' : 'outline'} size="sm"
                        onClick={() => setSchedType(t.v)} style={{ flex: 1 }}>
                        <t.icon style={{ height: 16, width: 16, marginRight: 4 }} /> {t.label}
                      </CVisionButton>
                    ))}
                  </div>
                </div>

                {/* AI Video Interview info banner + language selector */}
                {schedType === 'VIDEO' && !aiVideoInviteLink && (
                  <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, background: C.blueDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <Sparkles style={{ height: 16, width: 16, color: C.blue, marginTop: 2 }} />
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.blue }}>{tr('مقابلة فيديو بالذكاء الاصطناعي', 'AI Video Interview')}</p>
                        <p style={{ color: C.blue, marginTop: 2 }}>{tr('سيتم إنشاء مقابلة فيديو بالذكاء الاصطناعي تلقائيًا وإرسال رابط الدعوة للمرشح.', 'An AI-powered video interview will be automatically created and the invite link sent to the candidate.')}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24 }}>
                      <span style={{ color: C.blue, fontWeight: 500 }}>{tr('لغة المقابلة:', 'Interview Language:')}</span>
                      <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
                        <button type="button" onClick={() => setSchedVideoLang('en')}
                          className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${schedVideoLang === 'en' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-100'}`}>
                          {tr('الإنجليزية', 'English')}
                        </button>
                        <button type="button" onClick={() => setSchedVideoLang('ar')}
                          className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${schedVideoLang === 'ar' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-100'}`}>
                          {tr('العربية', 'العربية')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show AI Video invite link after creation */}
                {aiVideoInviteLink && (
                  <div style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle style={{ height: 16, width: 16, color: C.green }} />
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.green }}>{tr('تم إنشاء مقابلة فيديو بالذكاء الاصطناعي!', 'AI Video Interview Created!')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <CVisionInput C={C}
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}${aiVideoInviteLink}`}
                        readOnly style={{ fontSize: 12, height: 32 }}
                      />
                      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ height: 32, paddingLeft: 8, paddingRight: 8 }} onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${aiVideoInviteLink}`);
                        toast.success(tr('تم نسخ رابط الدعوة!', 'Invite link copied!'));
                      }}>
                        <Copy style={{ height: 14, width: 14 }} />
                      </CVisionButton>
                    </div>
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ width: '100%', fontSize: 12 }} onClick={() => { setAiVideoInviteLink(null); onOpenChange(false); }}>
                      {tr('تم', 'Done')}
                    </CVisionButton>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>{tr('التاريخ *', 'Date *')}</CVisionLabel>
                    <CVisionInput C={C} type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>{tr('الوقت *', 'Time *')}</CVisionLabel>
                    <CVisionInput C={C} type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>{tr('المدة', 'Duration')}</CVisionLabel>
                    <CVisionSelect
                C={C}
                value={schedDuration}
                onChange={setSchedDuration}
                options={[
                  { value: '15', label: tr('15 دقيقة', '15 min') },
                  { value: '30', label: tr('30 دقيقة', '30 min') },
                  { value: '45', label: tr('45 دقيقة', '45 min') },
                  { value: '60', label: tr('60 دقيقة', '60 min') },
                  { value: '90', label: tr('90 دقيقة', '90 min') },
                ]}
              />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>{schedType === 'IN_PERSON' ? tr('الموقع', 'Location') : tr('رابط الفيديو', 'Video Link')}</CVisionLabel>
                    {schedType === 'IN_PERSON' ? (
                      <CVisionInput C={C} placeholder={tr('قاعة الاجتماعات 1', 'Meeting Room 1')} value={schedLocation} onChange={e => setSchedLocation(e.target.value)} />
                    ) : (
                      <CVisionInput C={C} placeholder={tr('https://meet.google.com/...', 'https://meet.google.com/...')} value={schedVideoLink} onChange={e => setSchedVideoLink(e.target.value)} />
                    )}
                  </div>
                </div>

                {/* Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>{tr('لجنة المقابلة *', 'Interview Panel *')}</CVisionLabel>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CVisionSelect
                C={C}
                value={panelSelectId}
                onChange={setPanelSelectId}
                placeholder={tr('اختر موظف...', 'Select employee...')}
                options={employees.filter(e => !panelMembers.some(p => p.interviewerId === e.id)).map(e => (
                          ({ value: e.id, label: `${empName(e)} ${e.jobTitle ? `- ${e.jobTitle}` : ''}` })
                        ))}
                style={{ flex: 1 }}
              />
                    <CVisionButton C={C} isDark={isDark} variant="outline" onClick={addPanelMember} disabled={!panelSelectId}>{tr('إضافة', 'Add')}</CVisionButton>
                  </div>
                  {panelMembers.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {panelMembers.map(p => (
                        <div key={p.interviewerId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bgSubtle, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 13 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User style={{ height: 16, width: 16, color: C.textMuted }} />
                            <span style={{ fontWeight: 500 }}>{p.name}</span>
                            <CVisionBadge C={C} variant="outline" className="text-[10px]">{p.role === 'LEAD' ? tr('رئيس', 'LEAD') : tr('عضو', 'MEMBER')}</CVisionBadge>
                          </div>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 24, width: 24, padding: 0, color: C.red }} onClick={() => removePanelMember(p.interviewerId)}>
                            <XCircle style={{ height: 14, width: 14 }} />
                          </CVisionButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel>
                  <CVisionTextarea C={C} placeholder={tr('ملاحظات التحضير...', 'Preparation notes...')} value={schedNotes} onChange={e => setSchedNotes(e.target.value)} rows={2} />
                </div>

                {!aiVideoInviteLink && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                    <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => handleSchedule(false)} disabled={saving || creatingVideoSession}>
                      {saving && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                      {tr('جدولة فقط', 'Schedule Only')}
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark} onClick={() => handleSchedule(true)} disabled={saving || creatingVideoSession}>
                      {(saving || creatingVideoSession) && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                      <Send style={{ height: 16, width: 16, marginRight: 8 }} />
                      {schedType === 'VIDEO' ? tr('جدولة وإنشاء مقابلة ذكية', 'Schedule & Create AI Interview') : tr('جدولة وإرسال دعوة', 'Schedule & Send Invite')}
                    </CVisionButton>
                  </div>
                )}
              </div>
            )}

            {/* ── Feedback Mode ──────────────────────────────── */}
            {activeMode === 'feedback' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
                {!selectedInterview ? (
                  <p style={{ textAlign: 'center', color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لم يتم اختيار مقابلة. قم بجدولة واحدة أولاً.', 'No interview selected. Schedule one first.')}</p>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: C.textMuted }}>
                      {tr('الجولة', 'Round')} {selectedInterview.round} &middot; {new Date(selectedInterview.scheduledDate).toLocaleDateString()} {tr('في', 'at')} {selectedInterview.scheduledTime}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('قيّم كل فئة (1-5)', 'Score Each Category (1-5)')}</CVisionLabel>
                      {categories.map(cat => (
                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bgSubtle, borderRadius: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{isRTL ? (cat.labelAr || cat.label) : cat.label}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <button key={s} onClick={() => setFeedbackScores({ ...feedbackScores, [cat.id]: s })}
                                className={`w-8 h-8 rounded-full text-sm font-medium transition ${
                                  (feedbackScores[cat.id] || 0) >= s
                                    ? 'bg-yellow-400 text-yellow-900'
                                    : 'bg-background border hover:bg-yellow-100'
                                }`}>
                                {s}
                              </button>
                            ))}
                            <span style={{ fontSize: 12, color: C.textMuted, width: 32, textAlign: 'center' }}>
                              {feedbackScores[cat.id] || '-'}/5
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {categories.length > 0 && Object.keys(feedbackScores).length > 0 && (
                      <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 500 }}>
                        {tr('الإجمالي:', 'Overall:')} {(Object.values(feedbackScores).reduce((a, b) => a + b, 0) / Object.values(feedbackScores).length).toFixed(1)}/5
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('التوصية', 'Recommendation')}</CVisionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {[
                          { v: 'STRONG_HIRE', l: tr('توظيف قوي', 'Strong Hire'), c: 'border-green-500 bg-green-50 text-green-700' },
                          { v: 'HIRE', l: tr('توظيف', 'Hire'), c: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
                          { v: 'MAYBE', l: tr('ربما', 'Maybe'), c: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
                          { v: 'NO_HIRE', l: tr('عدم توظيف', 'No Hire'), c: 'border-orange-500 bg-orange-50 text-orange-700' },
                          { v: 'STRONG_NO_HIRE', l: tr('رفض قوي', 'Strong No'), c: 'border-red-500 bg-red-50 text-red-700' },
                        ].map(r => (
                          <button key={r.v}
                            onClick={() => setFeedbackRec(r.v)}
                            className={`px-2 py-2 rounded-lg border-2 text-xs font-medium transition ${
                              feedbackRec === r.v ? r.c : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}>
                            {r.l}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <CVisionLabel C={C}>{tr('نقاط القوة *', 'Strengths *')}</CVisionLabel>
                      <CVisionTextarea C={C} value={feedbackStrengths} onChange={e => setFeedbackStrengths(e.target.value)}
                        placeholder={tr('نقاط القوة الملاحظة...', 'Key strengths observed...')} rows={2} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <CVisionLabel C={C}>{tr('المخاوف', 'Concerns')}</CVisionLabel>
                      <CVisionTextarea C={C} value={feedbackConcerns} onChange={e => setFeedbackConcerns(e.target.value)}
                        placeholder={tr('أي مخاوف أو مجالات للتحسين...', 'Any concerns or areas for improvement...')} rows={2} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                      <CVisionButton C={C} isDark={isDark} onClick={handleSubmitFeedback} disabled={saving}>
                        {saving && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                        {tr('إرسال التقييم', 'Submit Feedback')}
                      </CVisionButton>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Decision Mode ──────────────────────────────── */}
            {activeMode === 'decision' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
                {!selectedInterview ? (
                  <p style={{ textAlign: 'center', color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد مقابلة لاتخاذ قرار بشأنها.', 'No interview to decide on.')}</p>
                ) : (
                  <>
                    {/* Panel Feedback Summary */}
                    {selectedInterview.feedback && selectedInterview.feedback.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('ملخص تقييم اللجنة', 'Panel Feedback Summary')}</CVisionLabel>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedInterview.feedback.map((fb, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.bgSubtle, borderRadius: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 13 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <User style={{ height: 16, width: 16, color: C.textMuted }} />
                                <span style={{ fontWeight: 500 }}>{fb.interviewerName}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontWeight: 500 }}>{fb.overallScore}/5</span>
                                <CVisionBadge C={C} variant="outline" className={`text-[10px] ${
                                  fb.recommendation.includes('HIRE') && !fb.recommendation.includes('NO')
                                    ? 'text-green-600 border-green-300'
                                    : fb.recommendation === 'MAYBE' ? 'text-yellow-600 border-yellow-300'
                                    : 'text-red-600 border-red-300'
                                }`}>
                                  {{ STRONG_HIRE: tr('توظيف قوي', 'Strong Hire'), HIRE: tr('توظيف', 'Hire'), MAYBE: tr('ربما', 'Maybe'), NO_HIRE: tr('عدم توظيف', 'No Hire'), STRONG_NO_HIRE: tr('رفض قوي', 'Strong No') }[fb.recommendation] || fb.recommendation.replace(/_/g, ' ')}
                                </CVisionBadge>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 500, paddingTop: 4 }}>
                          {tr('متوسط الدرجة:', 'Average Score:')} {(selectedInterview.feedback.reduce((s, f) => s + f.overallScore, 0) / selectedInterview.feedback.length).toFixed(1)}/5
                        </div>
                      </div>
                    )}

                    {/* Decision Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('القرار', 'Decision')}</CVisionLabel>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                        {[
                          { v: 'PASS', icon: CheckCircle, label: tr('قبول', 'Pass'), desc: tr('الانتقال لمرحلة العرض', 'Move to Offer stage'), cls: 'border-green-500 bg-green-50 text-green-700' },
                          { v: 'FAIL', icon: XCircle, label: tr('رفض', 'Fail'), desc: tr('رفض المرشح', 'Reject candidate'), cls: 'border-red-500 bg-red-50 text-red-700' },
                          { v: 'HOLD', icon: Pause, label: tr('تعليق', 'Hold'), desc: tr('الإبقاء في مرحلة المقابلة', 'Keep at Interview'), cls: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
                          { v: 'NEXT_ROUND', icon: RotateCw, label: tr('جولة أخرى', 'Next Round'), desc: tr('جدولة جولة أخرى', 'Schedule another'), cls: 'border-blue-500 bg-blue-50 text-blue-700' },
                        ].map(d => (
                          <button key={d.v}
                            onClick={() => setDecisionChoice(d.v)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 text-left transition ${
                              decisionChoice === d.v ? d.cls : 'border-transparent bg-muted hover:bg-muted/80'
                            }`}>
                            <d.icon style={{ height: 20, width: 20, flexShrink: 0 }} />
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 500 }}>{d.label}</p>
                              <p style={{ color: C.textMuted }}>{d.desc}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {decisionChoice && (
                      <div className={`text-xs px-3 py-2 rounded ${
                        decisionChoice === 'PASS' ? 'bg-green-50 text-green-700' :
                        decisionChoice === 'FAIL' ? 'bg-red-50 text-red-700' :
                        decisionChoice === 'HOLD' ? 'bg-yellow-50 text-yellow-700' :
                        'bg-blue-50 text-blue-700'
                      }`}>
                        {decisionChoice === 'PASS' && tr(`سينتقل ${candidate.fullName} إلى مرحلة العرض (يجب إنشاء وإرسال العرض بشكل منفصل)`, `${candidate.fullName} will move to Offer stage (you must create and send the offer separately)`)}
                        {decisionChoice === 'FAIL' && tr(`سيتم رفض ${candidate.fullName}`, `${candidate.fullName} will be Rejected`)}
                        {decisionChoice === 'HOLD' && tr(`${candidate.fullName} يبقى في مرحلة المقابلة`, `${candidate.fullName} stays at Interview stage`)}
                        {decisionChoice === 'NEXT_ROUND' && tr(`${candidate.fullName} يحتاج جولة مقابلة أخرى`, `${candidate.fullName} needs another interview round`)}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <CVisionLabel C={C}>{tr('ملاحظات', 'Notes')}</CVisionLabel>
                      <CVisionTextarea C={C} value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)}
                        placeholder={tr('ملاحظات القرار...', 'Decision notes...')} rows={2} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                      <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                      <CVisionButton C={C} isDark={isDark} onClick={handleDecision} disabled={saving || !decisionChoice}>
                        {saving && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                        {tr('تأكيد القرار', 'Confirm Decision')}
                      </CVisionButton>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── History Mode ───────────────────────────────── */}
            {activeMode === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
                {interviews.length === 0 ? (
                  <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>
                    <Calendar style={{ height: 40, width: 40, color: C.textMuted, marginBottom: 8 }} />
                    <p style={{ color: C.textMuted, fontSize: 13 }}>{tr('لم تتم جدولة مقابلات بعد', 'No interviews scheduled yet')}</p>
                    <CVisionButton C={C} isDark={isDark} size="sm" style={{ marginTop: 12 }} onClick={() => setActiveMode('schedule')}>
                      <Calendar style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('جدولة أول مقابلة', 'Schedule First Interview')}
                    </CVisionButton>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {interviews.map(int => {
                      const statusColors: Record<string, string> = {
                        SCHEDULED: 'bg-blue-100 text-blue-800',
                        CONFIRMED: 'bg-indigo-100 text-indigo-800',
                        IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
                        COMPLETED: 'bg-green-100 text-green-800',
                        CANCELLED: 'bg-gray-100 text-gray-800',
                        NO_SHOW: 'bg-red-100 text-red-800',
                        RESCHEDULED: 'bg-orange-100 text-orange-800',
                      };
                      const avgScore = int.feedback?.length
                        ? (int.feedback.reduce((s, f) => s + f.overallScore, 0) / int.feedback.length).toFixed(1)
                        : null;

                      return (
                        <CVisionCard C={C} key={int.interviewId} className={`${selectedInterview?.interviewId === int.interviewId ? 'ring-2 ring-primary' : ''}`}>
                          <CVisionCardBody style={{ paddingTop: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('الجولة', 'Round')} {int.round}</p>
                                <p style={{ fontSize: 12, color: C.textMuted }}>
                                  {new Date(int.scheduledDate).toLocaleDateString()} {tr('في', 'at')} {int.scheduledTime}
                                </p>
                              </div>
                              <CVisionBadge C={C} className={statusColors[int.status] || 'bg-gray-100'}>{{ SCHEDULED: tr('مجدولة', 'Scheduled'), CONFIRMED: tr('مؤكدة', 'Confirmed'), IN_PROGRESS: tr('جارية', 'In Progress'), COMPLETED: tr('مكتملة', 'Completed'), CANCELLED: tr('ملغية', 'Cancelled'), NO_SHOW: tr('لم يحضر', 'No Show'), RESCHEDULED: tr('أعيدت جدولتها', 'Rescheduled') }[int.status] || int.status}</CVisionBadge>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                              {int.type === 'IN_PERSON' && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ height: 12, width: 12 }} /> {int.location || tr('يحدد لاحقًا', 'TBD')}</span>}
                              {int.type === 'VIDEO' && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Video style={{ height: 12, width: 12 }} /> {tr('فيديو', 'Video')}</span>}
                              {int.type === 'PHONE' && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone style={{ height: 12, width: 12 }} /> {tr('هاتف', 'Phone')}</span>}
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users style={{ height: 12, width: 12 }} /> {int.panel?.length || 0} {tr('أعضاء', 'panelists')}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock style={{ height: 12, width: 12 }} /> {int.duration}{tr('د', 'min')}</span>
                            </div>

                            {int.panel && int.panel.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                                {int.panel.map((p, i) => (
                                  <CVisionBadge C={C} key={i} variant="outline" className="text-[10px]">
                                    {p.interviewerName} ({p.role === 'LEAD' ? tr('رئيس', 'Lead') : tr('عضو', 'Member')})
                                  </CVisionBadge>
                                ))}
                              </div>
                            )}

                            {avgScore && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
                                <Star style={{ height: 16, width: 16, color: C.orange }} />
                                <span style={{ fontWeight: 500 }}>{avgScore}/5</span>
                                <span style={{ color: C.textMuted }}>({int.feedback.length} {tr('مراجعة', 'review')}{!isRTL && int.feedback.length !== 1 ? 's' : ''})</span>
                              </div>
                            )}

                            {int.decision && (
                              <CVisionBadge C={C} className={`text-xs ${
                                int.decision === 'PASS' ? 'bg-green-100 text-green-800' :
                                int.decision === 'FAIL' ? 'bg-red-100 text-red-800' :
                                int.decision === 'HOLD' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {tr('القرار:', 'Decision:')} {{ PASS: tr('قبول', 'Pass'), FAIL: tr('رفض', 'Fail'), HOLD: tr('تعليق', 'Hold'), NEXT_ROUND: tr('جولة أخرى', 'Next Round') }[int.decision] || int.decision}
                              </CVisionBadge>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 4, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                              {int.status === 'SCHEDULED' && !int.invitationSent && (
                                <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => handleSendInvitation(int.interviewId)}>
                                  <Send style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('إرسال دعوة', 'Send Invite')}
                                </CVisionButton>
                              )}
                              {['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(int.status) && (
                                <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }}
                                  onClick={() => { setSelectedInterview(int); setActiveMode('feedback'); }}>
                                  <MessageSquare style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('تقييم', 'Feedback')}
                                </CVisionButton>
                              )}
                              {int.status === 'COMPLETED' && !int.decision && (
                                <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }}
                                  onClick={() => { setSelectedInterview(int); setActiveMode('decision'); }}>
                                  <CheckCircle style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('اتخاذ قرار', 'Decide')}
                                </CVisionButton>
                              )}
                            </div>
                          </CVisionCardBody>
                        </CVisionCard>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>{tr('إغلاق', 'Close')}</CVisionButton>
                  <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setActiveMode('schedule')}>
                    <Calendar style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('جدولة الجولة التالية', 'Schedule Next Round')}
                  </CVisionButton>
                </div>
              </div>
            )}
          </>
        )}
    </CVisionDialog>
  );
}
