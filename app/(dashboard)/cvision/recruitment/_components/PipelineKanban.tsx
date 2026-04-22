'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useCallback, useEffect, useState } from 'react';

import {
  ChevronRight, ChevronLeft, User, Mail, Phone, Clock,
  AlertTriangle, XCircle, FileText, Calendar, Loader2,
  GripVertical, RefreshCw, MessageSquare, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import InterviewManager from './InterviewManager';
import type { Candidate } from './types';

interface PipelineStage {
  id: string;
  name: string;
  nameAr?: string;
  order: number;
  type: string;
  isRequired: boolean;
  daysLimit?: number;
  color?: string;
  candidates: CandidateCard[];
}

interface CandidateCard {
  id: string;
  _id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  source: string;
  requisitionId?: string;
  status: string;
  screeningScore?: number;
  stageEnteredAt?: string;
  daysInStage: number;
  offer?: any;
  metadata?: any;
}

interface TimelineEvent {
  type: string;
  date: string;
  title: string;
  description?: string;
}

export default function PipelineKanban() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Move dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveCandidate, setMoveCandidate] = useState<CandidateCard | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [moving, setMoving] = useState(false);

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectCandidate, setRejectCandidate] = useState<CandidateCard | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCandidate, setDetailCandidate] = useState<CandidateCard | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Offer dialog
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerCandidate, setOfferCandidate] = useState<CandidateCard | null>(null);
  const [offerSalary, setOfferSalary] = useState('');
  const [offerHousing, setOfferHousing] = useState('');
  const [offerTransport, setOfferTransport] = useState('');
  const [offerStart, setOfferStart] = useState('');
  const [offerCreating, setOfferCreating] = useState(false);

  // Interview dialog
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewCandidate, setInterviewCandidate] = useState<CandidateCard | null>(null);
  const [interviewMode, setInterviewMode] = useState<'schedule' | 'feedback' | 'decision' | 'history'>('schedule');

  // Per-candidate interview info cache
  const [interviewInfoMap, setInterviewInfoMap] = useState<Record<string, { date?: string; panelCount?: number; status?: string; round?: number }>>({});

  const loadPipeline = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cvision/recruitment/pipeline?action=kanban', { credentials: 'include', signal });
      const data = await res.json();
      if (data.success) {
        setStages(data.stages || []);
        setTotal(data.total || 0);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const ac = new AbortController(); loadPipeline(ac.signal); return () => ac.abort(); }, [loadPipeline]);

  // Load interview info for candidates in interview stage
  useEffect(() => {
    const interviewStage = stages.find(s => s.id === 'interview');
    if (!interviewStage || interviewStage.candidates.length === 0) return;
    const ac = new AbortController();
    const ids = interviewStage.candidates.map(c => c.id);
    Promise.all(ids.map(async (cid) => {
      try {
        const res = await fetch(`/api/cvision/recruitment/interviews?action=candidate-interviews&candidateId=${cid}`, { credentials: 'include', signal: ac.signal });
        const data = await res.json();
        if (data.success && data.interviews?.length > 0) {
          const latest = data.interviews[data.interviews.length - 1];
          return [cid, {
            date: latest.scheduledDate || undefined,
            panelCount: latest.panel?.length || 0,
            status: latest.status,
            round: latest.round,
          }] as const;
        }
      } catch { /* ignore */ }
      return null;
    })).then(results => {
      const map: Record<string, any> = {};
      for (const r of results) { if (r) map[r[0]] = r[1]; }
      setInterviewInfoMap(prev => ({ ...prev, ...map }));
    });
    return () => ac.abort();
  }, [stages]);

  async function handleMove() {
    if (!moveCandidate || !moveTarget) return;
    setMoving(true);
    try {
      const res = await fetch('/api/cvision/recruitment/pipeline', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move-stage',
          candidateId: moveCandidate.id,
          stage: moveTarget,
          notes: moveNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || tr('تم نقل المرشح', 'Candidate moved'));
        setMoveOpen(false);
        setMoveNotes('');
        loadPipeline();
      } else {
        toast.error(data.error || tr('فشل النقل', 'Failed to move'));
      }
    } catch { toast.error(tr('فشل نقل المرشح', 'Failed to move candidate')); }
    finally { setMoving(false); }
  }

  async function handleReject() {
    if (!rejectCandidate || !rejectReason) return;
    setRejecting(true);
    try {
      const res = await fetch('/api/cvision/recruitment/pipeline', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          candidateId: rejectCandidate.id,
          reason: rejectReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم رفض المرشح', 'Candidate rejected'));
        setRejectOpen(false);
        setRejectReason('');
        loadPipeline();
      } else {
        toast.error(data.error || tr('فشل الرفض', 'Failed to reject'));
      }
    } catch { toast.error(tr('فشل الرفض', 'Failed to reject')); }
    finally { setRejecting(false); }
  }

  async function openDetail(c: CandidateCard) {
    setDetailCandidate(c);
    setDetailOpen(true);
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/cvision/recruitment/pipeline?action=timeline&id=${c.id}`, { credentials: 'include' });
      const data = await res.json();
      setTimeline(data.timeline || []);
    } catch { setTimeline([]); }
    finally { setTimelineLoading(false); }
  }

  async function handleCreateOffer() {
    if (!offerCandidate || !offerSalary) return;
    setOfferCreating(true);
    try {
      const res = await fetch('/api/cvision/recruitment/pipeline', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-offer',
          candidateId: offerCandidate.id,
          requisitionId: offerCandidate.requisitionId || '',
          basicSalary: Number(offerSalary),
          housingAllowance: Number(offerHousing) || 0,
          transportAllowance: Number(offerTransport) || 0,
          startDate: offerStart || new Date().toISOString().split('T')[0],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم إنشاء خطاب العرض', 'Offer letter created'));
        setOfferOpen(false);
        // Now send the offer
        if (data.offer?.id) {
          await fetch('/api/cvision/recruitment/pipeline', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send-offer', offerId: data.offer.id }),
          });
          toast.success(tr('تم إرسال العرض للمرشح', 'Offer sent to candidate'));
        }
        loadPipeline();
      } else {
        toast.error(data.error || tr('فشل إنشاء العرض', 'Failed to create offer'));
      }
    } catch { toast.error(tr('فشل إنشاء العرض', 'Failed to create offer')); }
    finally { setOfferCreating(false); }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 192 }}  />
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 384, width: 288, flexShrink: 0 }}  />)}
        </div>
      </div>
    );
  }

  const activeStages = stages.filter(s => s.id !== 'rejected');
  const rejectedStage = stages.find(s => s.id === 'rejected');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{tr('خط التوظيف', 'Recruitment Pipeline')}</h2>
          <CVisionBadge C={C} variant="secondary">{total} {tr('مرشحون', 'candidates')}</CVisionBadge>
        </div>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => loadPipeline()}>
          <RefreshCw style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('تحديث', 'Refresh')}
        </CVisionButton>
      </div>

      {/* Kanban Board */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, paddingLeft: 8, paddingRight: 8 }}>
        {activeStages.map(stage => (
          <div
            key={stage.id}
            style={{ flexShrink: 0, width: 256, borderRadius: 12, border: `1px solid ${C.border}` }}
          >
            {/* Stage Header */}
            <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: stage.color || '#6B7280' }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{isRTL && stage.nameAr ? stage.nameAr : stage.name}</span>
              </div>
              <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>
                {stage.candidates.length}
              </CVisionBadge>
            </div>

            {/* Candidate Cards */}
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {stage.candidates.length === 0 && (
                <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>{tr('لا يوجد مرشحون', 'No candidates')}</p>
              )}
              {stage.candidates.map(c => (
                <div
                  key={c.id}
                  style={{ background: C.bgCard, borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
                  onClick={() => openDetail(c)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{c.fullName}</p>
                    {c.screeningScore != null && (
                      <CVisionBadge C={C} variant={c.screeningScore >= 70 ? 'default' : 'secondary'} style={{ paddingLeft: 6, paddingRight: 6 }}>
                        {c.screeningScore}%
                      </CVisionBadge>
                    )}
                  </div>

                  {c.email && (
                    <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Mail style={{ height: 12, width: 12, flexShrink: 0 }} /> {c.email}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <CVisionBadge C={C} variant="outline" className="text-[10px]">{c.source}</CVisionBadge>
                    {c.daysInStage > 0 && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${
                        stage.daysLimit && c.daysInStage > stage.daysLimit ? 'text-red-500 font-medium' : 'text-muted-foreground'
                      }`}>
                        <Clock style={{ height: 10, width: 10 }} /> {c.daysInStage}{tr('ي', 'd')}
                        {stage.daysLimit && c.daysInStage > stage.daysLimit && (
                          <AlertTriangle style={{ height: 10, width: 10, marginLeft: 2 }} />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Interview info for candidates in interview stage */}
                  {stage.id === 'interview' && interviewInfoMap[c.id] && (
                    <div style={{ color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2, background: C.blueDim, borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4 }}>
                      {interviewInfoMap[c.id].date && (
                        <p style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar style={{ height: 10, width: 10 }} /> {new Date(interviewInfoMap[c.id].date!).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' })}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {interviewInfoMap[c.id].panelCount! > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center' }}><User style={{ height: 10, width: 10 }} /> {interviewInfoMap[c.id].panelCount}</span>
                        )}
                        {interviewInfoMap[c.id].status && (
                          <CVisionBadge C={C} variant="outline" style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 0, paddingBottom: 0 }}>{
                            interviewInfoMap[c.id].status === 'COMPLETED' ? tr('مكتمل', 'Completed')
                            : interviewInfoMap[c.id].status === 'SCHEDULED' ? tr('مجدول', 'Scheduled')
                            : interviewInfoMap[c.id].status === 'IN_PROGRESS' ? tr('قيد التنفيذ', 'In Progress')
                            : interviewInfoMap[c.id].status === 'CANCELLED' ? tr('ملغى', 'Cancelled')
                            : interviewInfoMap[c.id].status
                          }</CVisionBadge>
                        )}
                        {interviewInfoMap[c.id].round && interviewInfoMap[c.id].round! > 1 && (
                          <span>{tr('ج', 'R')}{interviewInfoMap[c.id].round}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Quick Actions (visible on hover) */}
                  <div style={{ display: 'flex', gap: 4, opacity: 0, paddingTop: 4, borderTop: `1px solid ${C.border}` }}>
                    {stage.id !== 'hired' && (
                      <CVisionButton C={C} isDark={isDark}
                        size="sm" variant="ghost" style={{ height: 24, paddingLeft: 8, paddingRight: 8 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoveCandidate(c);
                          setMoveTarget('');
                          setMoveOpen(true);
                        }}
                      >
                        <ChevronRight style={{ height: 12, width: 12, marginRight: 2 }} /> {tr('نقل', 'Move')}
                      </CVisionButton>
                    )}
                    {!['hired', 'rejected'].includes(stage.id) && (
                      <CVisionButton C={C} isDark={isDark}
                        size="sm" variant="ghost" style={{ height: 24, paddingLeft: 8, paddingRight: 8, color: C.blue }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInterviewCandidate(c);
                          const info = interviewInfoMap[c.id];
                          if (info?.status === 'COMPLETED') setInterviewMode('decision');
                          else if (info?.status === 'SCHEDULED' || info?.status === 'IN_PROGRESS') setInterviewMode('feedback');
                          else setInterviewMode(stage.id === 'interview' ? 'history' : 'schedule');
                          setInterviewOpen(true);
                        }}
                      >
                        <Calendar style={{ height: 12, width: 12, marginRight: 2 }} />
                        {stage.id === 'interview'
                          ? (interviewInfoMap[c.id]?.status === 'COMPLETED' ? tr('قرار', 'Decide') : interviewInfoMap[c.id] ? tr('تقييم', 'Feedback') : tr('جدولة', 'Schedule'))
                          : tr('مقابلة', 'Interview')}
                      </CVisionButton>
                    )}
                    {!['offer', 'hired'].includes(stage.id) && (
                      <CVisionButton C={C} isDark={isDark}
                        size="sm" variant="ghost" style={{ height: 24, paddingLeft: 8, paddingRight: 8 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOfferCandidate(c);
                          setOfferSalary('');
                          setOfferHousing('');
                          setOfferTransport('');
                          setOfferStart('');
                          setOfferOpen(true);
                        }}
                      >
                        <FileText style={{ height: 12, width: 12, marginRight: 2 }} /> {tr('عرض', 'Offer')}
                      </CVisionButton>
                    )}
                    {stage.id !== 'rejected' && stage.id !== 'hired' && (
                      <CVisionButton C={C} isDark={isDark}
                        size="sm" variant="ghost" style={{ height: 24, paddingLeft: 8, paddingRight: 8, color: C.red }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRejectCandidate(c);
                          setRejectReason('');
                          setRejectOpen(true);
                        }}
                      >
                        <XCircle style={{ height: 12, width: 12, marginRight: 2 }} /> {tr('رفض', 'Reject')}
                      </CVisionButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Rejected column (collapsed) */}
        {rejectedStage && rejectedStage.candidates.length > 0 && (
          <div style={{ flexShrink: 0, width: 224, background: C.redDim, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ padding: 12, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.redDim }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: C.red }}>{tr('مرفوض', 'Rejected')}</span>
              </div>
              <CVisionBadge C={C} variant="danger" style={{ fontSize: 12 }}>{rejectedStage.candidates.length}</CVisionBadge>
            </div>
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
              {rejectedStage.candidates.map(c => (
                <div key={c.id} style={{ background: C.bgCard, borderRadius: 6, padding: 8, border: `1px solid ${C.border}`, fontSize: 12 }}>
                  <p style={{ fontWeight: 500 }}>{c.fullName}</p>
                  {c.email && <p style={{ color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Move Dialog ─────────────────────────────────── */}
      <CVisionDialog C={C} open={moveOpen} onClose={() => setMoveOpen(false)} title="Move Candidate" isDark={isDark}>          <p style={{ fontSize: 13, color: C.textMuted }}>{moveCandidate?.fullName}</p>
          <CVisionSelect
                C={C}
                value={moveTarget}
                onChange={setMoveTarget}
                placeholder={tr('اختر المرحلة...', 'Select stage...')}
                options={activeStages.filter(s => s.id !== moveCandidate?.status).map(s => (
                ({ value: s.id, label: isRTL && s.nameAr ? s.nameAr : s.name })
              ))}
              />
          <CVisionTextarea C={C} placeholder={tr('ملاحظات (اختياري)', 'Notes (optional)')} value={moveNotes} onChange={e => setMoveNotes(e.target.value)} rows={2} />
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setMoveOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleMove} disabled={!moveTarget || moving}>
              {moving ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 4 }} /> : null}
              {tr('نقل', 'Move')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Reject Dialog ───────────────────────────────── */}
      <CVisionDialog C={C} open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject" isDark={isDark}>          <p style={{ fontSize: 13, color: C.textMuted }}>{rejectCandidate?.fullName}</p>
          <CVisionTextarea C={C}
            placeholder={tr('سبب الرفض *', 'Rejection reason *')}
            value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            rows={3}
          />
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setRejectOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleReject} disabled={!rejectReason || rejecting}>
              {rejecting ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 4 }} /> : null}
              {tr('رفض', 'Reject')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Offer Dialog ────────────────────────────────── */}
      <CVisionDialog C={C} open={offerOpen} onClose={() => setOfferOpen(false)} title="Make Offer" isDark={isDark}>          <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 8 }}>{offerCandidate?.fullName}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div className="col-span-2">
              <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('الراتب الأساسي (ريال) *', 'Basic Salary (SAR) *')}</label>
              <CVisionInput C={C} type="number" value={offerSalary} onChange={e => setOfferSalary(e.target.value)} placeholder={tr('مثال: 10000', 'e.g. 10000')} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('بدل السكن', 'Housing Allowance')}</label>
              <CVisionInput C={C} type="number" value={offerHousing} onChange={e => setOfferHousing(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('بدل النقل', 'Transport Allowance')}</label>
              <CVisionInput C={C} type="number" value={offerTransport} onChange={e => setOfferTransport(e.target.value)} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label style={{ fontSize: 12, fontWeight: 500 }}>{tr('تاريخ البدء', 'Start Date')}</label>
              <CVisionInput C={C} type="date" value={offerStart} onChange={e => setOfferStart(e.target.value)} />
            </div>
          </div>
          {offerSalary && (
            <div style={{ background: C.bgSubtle, borderRadius: 6, padding: 12, fontSize: 13 }}>
              <p style={{ fontWeight: 500 }}>{tr('إجمالي الحزمة:', 'Total Package:')} {(Number(offerSalary) + Number(offerHousing || 0) + Number(offerTransport || 0)).toLocaleString()} {tr('ريال/شهر', 'SAR/mo')}</p>
            </div>
          )}
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setOfferOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleCreateOffer} disabled={!offerSalary || offerCreating}>
              {offerCreating ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 4 }} /> : null}
              {tr('إنشاء وإرسال العرض', 'Create & Send Offer')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Detail / Timeline Dialog ────────────────────── */}
      <CVisionDialog C={C} open={detailOpen} onClose={() => setDetailOpen(false)} title="Details" isDark={isDark}>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 13 }}>
              {detailCandidate?.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}><Mail style={{ height: 14, width: 14 }} />{detailCandidate.email}</span>
              )}
              {detailCandidate?.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}><Phone style={{ height: 14, width: 14 }} />{detailCandidate.phone}</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionBadge C={C}>{
                (() => {
                  const st = detailCandidate?.status;
                  const stageObj = stages.find(s => s.id === st);
                  if (stageObj) return isRTL && stageObj.nameAr ? stageObj.nameAr : stageObj.name;
                  return st;
                })()
              }</CVisionBadge>
              <CVisionBadge C={C} variant="outline">{detailCandidate?.source}</CVisionBadge>
              {detailCandidate?.screeningScore != null && (
                <CVisionBadge C={C} variant="secondary">{tr('الدرجة:', 'Score:')} {detailCandidate.screeningScore}%</CVisionBadge>
              )}
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 600, paddingTop: 8 }}>{tr('السجل الزمني', 'Timeline')}</h4>
            {timelineLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 48 }}  />)}</div>
            ) : timeline.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا يوجد سجل بعد', 'No history yet')}</p>
            ) : (
              <div style={{ position: 'relative', marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 24 }}>
                {timeline.map((event, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-background ${
                      event.type === 'HIRED' ? 'bg-green-500'
                        : event.type === 'OFFER' || event.type === 'OFFER_ACCEPTED' ? 'bg-orange-500'
                        : event.type === 'INTERVIEW' ? 'bg-blue-500'
                        : 'bg-muted-foreground'
                    }`} />
                    <p style={{ fontSize: 13, fontWeight: 500 }}>{event.title}</p>
                    {event.description && <p style={{ fontSize: 12, color: C.textMuted }}>{event.description}</p>}
                    <p style={{ color: C.textMuted }}>
                      {event.date ? new Date(event.date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <CVisionDialogFooter C={C}>
            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ flex: 1 }} onClick={() => {
                setDetailOpen(false);
                if (detailCandidate) { setMoveCandidate(detailCandidate); setMoveTarget(''); setMoveOpen(true); }
              }}>
                <ChevronRight style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('نقل المرحلة', 'Move Stage')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ flex: 1 }} onClick={() => {
                setDetailOpen(false);
                if (detailCandidate) {
                  setOfferCandidate(detailCandidate);
                  setOfferSalary(''); setOfferHousing(''); setOfferTransport(''); setOfferStart('');
                  setOfferOpen(true);
                }
              }}>
                <FileText style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('إنشاء عرض', 'Create Offer')}
              </CVisionButton>
            </div>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Interview Manager Dialog */}
      <InterviewManager
        candidate={interviewCandidate ? {
          id: interviewCandidate.id,
          fullName: interviewCandidate.fullName,
          email: interviewCandidate.email,
          status: interviewCandidate.status as Candidate['status'],
          source: interviewCandidate.source,
          requisitionId: interviewCandidate.requisitionId,
          createdAt: '',
        } : null}
        open={interviewOpen}
        onOpenChange={setInterviewOpen}
        mode={interviewMode}
        onDone={loadPipeline}
      />
    </div>
  );
}
