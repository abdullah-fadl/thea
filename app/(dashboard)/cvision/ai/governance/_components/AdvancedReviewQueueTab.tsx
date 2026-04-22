'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Pencil,
  RefreshCw,
  Star,
  Loader2,
  Timer,
  ArrowUpRight,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
interface ReviewItem {
  reviewId: string;
  moduleId: string;
  moduleName: string;
  decisionType: string;
  confidenceScore: number;
  aiDecision: string;
  aiReasoning: string;
  entityType: string;
  entityId: string;
  entityName: string;
  relatedData: Record<string, any>;
  autoApproveThreshold: number;
  reviewThreshold: number;
  gap: number;
  status: string;
  priority: string;
  assignedTo?: string;
  assignedToName?: string;
  humanDecision?: string;
  humanReasoning?: string;
  feedbackScore?: number;
  createdAt: string;
  expiresAt: string;
  escalatedAt?: string;
}

interface QueueStats {
  totalPending: number;
  inReview: number;
  escalated: number;
  completedToday: number;
  completedAllTime: number;
  avgWaitHours: number;
  overdueCount: number;
}

const PRIORITY_STYLES: Record<string, { label: string; border: string; badge: string; dot: string }> = {
  URGENT: { label: 'URGENT', border: 'border-l-red-500', badge: 'bg-red-100 text-red-800', dot: 'bg-red-500 animate-pulse' },
  HIGH: { label: 'HIGH', border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  MEDIUM: { label: 'MEDIUM', border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  LOW: { label: 'LOW', border: 'border-l-green-500', badge: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
};

const MODULE_COLORS: Record<string, string> = {
  'ai-matching': 'bg-purple-100 text-purple-800',
  'retention-risk': 'bg-rose-100 text-rose-800',
  'candidate-ranking': 'bg-cyan-100 text-cyan-800',
  'skills-assessment': 'bg-teal-100 text-teal-800',
  'interview-scoring': 'bg-indigo-100 text-indigo-800',
  'whatif-simulation': 'bg-amber-100 text-amber-800',
  'promotion-readiness': 'bg-emerald-100 text-emerald-800',
};

function timeLeft(expiresAt: string, isAr?: boolean): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return isAr ? 'متأخر' : 'Overdue';
  const hours = Math.floor(diff / 3600000);
  if (hours >= 24) return `${Math.floor(hours / 24)}${isAr ? 'ي' : 'd'} ${hours % 24}${isAr ? 'س' : 'h'}`;
  return `${hours}${isAr ? 'س' : 'h'}`;
}

function timeAgo(dateStr: string, isAr?: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return isAr ? 'الآن' : 'Just now';
  if (mins < 60) return isAr ? `منذ ${mins}د` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return isAr ? `منذ ${hrs}س` : `${hrs}h ago`;
  return isAr ? `منذ ${Math.floor(hrs / 24)}ي` : `${Math.floor(hrs / 24)}d ago`;
}

export default function AdvancedReviewQueueTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterModule, setFilterModule] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');

  // Review dialog
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<ReviewItem | null>(null);
  const [decision, setDecision] = useState<'AGREE' | 'DISAGREE' | 'MODIFY'>('AGREE');
  const [reasoning, setReasoning] = useState('');
  const [modifiedDecision, setModifiedDecision] = useState('');
  const [feedbackScore, setFeedbackScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Context dialog
  const [contextOpen, setContextOpen] = useState(false);
  const [contextItem, setContextItem] = useState<ReviewItem | null>(null);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'queue' });
      if (filterModule !== 'all') params.set('moduleId', filterModule);
      if (filterPriority !== 'all') params.set('priority', filterPriority);

      const [qRes, sRes] = await Promise.all([
        fetch(`/api/cvision/ai/threshold?${params}`, { credentials: 'include', signal }),
        fetch('/api/cvision/ai/threshold?action=queue-stats', { credentials: 'include', signal }),
      ]);
      const qData = await qRes.json();
      const sData = await sRes.json();

      if (qData.success) setItems(qData.data?.items || []);
      if (sData.success) setStats(sData.data);
    } catch {
      toast.error(tr('فشل تحميل قائمة المراجعة', 'Failed to load review queue'));
    } finally {
      setLoading(false);
    }
  }, [filterModule, filterPriority]);

  useEffect(() => { const ac = new AbortController(); loadData(ac.signal); return () => ac.abort(); }, [loadData]);

  const openReview = (item: ReviewItem) => {
    setReviewingItem(item);
    setDecision('AGREE');
    setReasoning('');
    setModifiedDecision('');
    setFeedbackScore(0);
    setReviewOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewingItem || !reasoning.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cvision/ai/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'review',
          reviewId: reviewingItem.reviewId,
          decision,
          reasoning,
          modifiedDecision: decision === 'MODIFY' ? modifiedDecision : undefined,
          feedbackScore: feedbackScore || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم إرسال المراجعة بنجاح', 'Review submitted successfully'));
        setReviewOpen(false);
        loadData();
      } else {
        toast.error(data.error || tr('فشل إرسال المراجعة', 'Failed to submit review'));
      }
    } catch {
      toast.error(tr('فشل إرسال المراجعة', 'Failed to submit review'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async (reviewId: string) => {
    try {
      const res = await fetch('/api/cvision/ai/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'escalate', reviewId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم تصعيد العنصر', 'Item escalated'));
        loadData();
      }
    } catch {
      toast.error(tr('فشل التصعيد', 'Failed to escalate'));
    }
  };

  const modules = [...new Set(items.map(i => i.moduleId))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats Bar */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <Clock style={{ height: 20, width: 20, marginBottom: 4, color: C.orange }} />
              <div style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{stats.totalPending}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('قيد الانتظار', 'Pending')}</div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <Eye style={{ height: 20, width: 20, marginBottom: 4, color: C.blue }} />
              <div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{stats.inReview}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('قيد المراجعة', 'In Review')}</div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <AlertTriangle style={{ height: 20, width: 20, marginBottom: 4, color: C.red }} />
              <div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{stats.escalated}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تم التصعيد', 'Escalated')}</div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <CheckCircle style={{ height: 20, width: 20, marginBottom: 4, color: C.green }} />
              <div style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{stats.completedAllTime}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('مكتمل', 'Completed')}</div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      )}

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ paddingTop: 12, paddingBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الوحدة:', 'Module:')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={filterModule}
                onChange={setFilterModule}
                placeholder={tr('كل الوحدات', 'All Modules')}
                options={[
                  { value: 'all', label: tr('كل الوحدات', 'All Modules') },
                  ...modules.map(m => (
                    ({ value: m, label: m })
                  )),
                ]}
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الأولوية:', 'Priority:')}</CVisionLabel>
              <CVisionSelect
                C={C}
                value={filterPriority}
                onChange={setFilterPriority}
                placeholder={tr('الكل', 'All')}
                options={[
                  { value: 'all', label: tr('الكل', 'All') },
                  { value: 'URGENT', label: tr('عاجل', 'Urgent') },
                  { value: 'HIGH', label: tr('عالي', 'High') },
                  { value: 'MEDIUM', label: tr('متوسط', 'Medium') },
                  { value: 'LOW', label: tr('منخفض', 'Low') },
                ]}
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 32 }} onClick={() => loadData()}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Queue Items */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 192, borderRadius: 16 }}  />)}
        </div>
      ) : items.filter(i => ['PENDING', 'IN_REVIEW', 'ESCALATED'].includes(i.status)).length === 0 ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
            <CheckCircle style={{ height: 48, width: 48, color: C.green, marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: C.green }}>{tr('لا توجد مراجعات معلقة', 'No pending reviews')}</p>
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              {tr('جميع قرارات الذكاء الاصطناعي استوفت حدود الثقة', 'All AI decisions met confidence thresholds')}
            </p>
          </CVisionCardBody>
        </CVisionCard>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items
            .filter(i => ['PENDING', 'IN_REVIEW', 'ESCALATED'].includes(i.status))
            .map((item, idx) => {
              const ps = PRIORITY_STYLES[item.priority] || PRIORITY_STYLES.MEDIUM;
              const mc = MODULE_COLORS[item.moduleId] || 'bg-gray-100 text-gray-800';
              const isOverdue = new Date(item.expiresAt) <= new Date();

              return (
                <CVisionCard C={C} key={`${item.reviewId}-${idx}`} className={`border-l-4 ${ps.border}`}>
                  <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                          <CVisionBadge C={C} className={ps.badge} variant="secondary">
                            <span className={`h-1.5 w-1.5 rounded-full ${ps.dot} mr-1`} />
                            {ps.label}
                          </CVisionBadge>
                          <CVisionBadge C={C} className={mc} variant="secondary">{item.moduleName}</CVisionBadge>
                          {item.status === 'ESCALATED' && (
                            <CVisionBadge C={C} variant="danger">{tr('تم التصعيد', 'ESCALATED')}</CVisionBadge>
                          )}
                          <span style={{ fontSize: 12, color: C.textMuted }}>
                            {item.reviewId} &middot; {timeAgo(item.createdAt)}
                          </span>
                        </div>

                        {/* AI Decision */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13 }}>🤖</span>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500 }}>
                              {tr('قرار الذكاء الاصطناعي:', 'AI Decision:')} {item.aiDecision}
                            </p>
                            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                              {tr('الكيان:', 'Entity:')} {item.entityName} ({item.entityType})
                            </p>
                          </div>
                        </div>

                        {/* Confidence */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: C.textMuted }}>{tr('الثقة:', 'Confidence:')}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            <div style={{ flex: 1, height: 8, borderRadius: '50%', overflow: 'hidden' }}>
                              <div
                                className={`h-full rounded-full ${
                                  item.confidenceScore >= 80 ? 'bg-green-500' :
                                  item.confidenceScore >= 60 ? 'bg-blue-500' :
                                  item.confidenceScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${item.confidenceScore}%` }}
                              />
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{item.confidenceScore}%</span>
                            <span style={{ fontSize: 12, color: C.textMuted }}>({tr('الحد:', 'threshold:')} {item.autoApproveThreshold}%)</span>
                          </div>
                        </div>

                        {/* Gap */}
                        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
                          {tr('الفجوة:', 'Gap:')} -{item.gap} {tr('نقطة من الموافقة التلقائية', 'points from auto-approve')}
                        </p>

                        {/* AI Reasoning */}
                        <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, padding: 12, marginBottom: 12 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 4 }}>{tr('تحليل الذكاء الاصطناعي:', 'AI Reasoning:')}</p>
                          <p style={{ fontSize: 13 }}>{item.aiReasoning}</p>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => openReview(item)}>
                            <Pencil style={{ height: 14, width: 14, marginRight: 4 }} />
                            {tr('مراجعة', 'Review')}
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => { setContextItem(item); setContextOpen(true); }}>
                            <Eye style={{ height: 14, width: 14, marginRight: 4 }} />
                            {tr('عرض السياق الكامل', 'View Full Context')}
                          </CVisionButton>
                          {!item.escalatedAt && (
                            <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ color: C.orange }} onClick={() => handleEscalate(item.reviewId)}>
                              <ArrowUpRight style={{ height: 14, width: 14, marginRight: 4 }} />
                              {tr('تصعيد', 'Escalate')}
                            </CVisionButton>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textMuted }}>
                            <Timer style={{ height: 14, width: 14 }} />
                            {isOverdue ? (
                              <span style={{ color: C.red, fontWeight: 500 }}>{tr('متأخر — التصعيد التلقائي معلق', 'Overdue — auto-escalation pending')}</span>
                            ) : (
                              <span>{tr('ينتهي في:', 'Expires in:')} {timeLeft(item.expiresAt, isRTL)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CVisionCardBody>
                </CVisionCard>
              );
            })}
        </div>
      )}

      {/* ── Review Dialog ── */}
      <CVisionDialog C={C} open={reviewOpen} onClose={() => setReviewOpen(false)} title={tr('مراجعة قرار الذكاء الاصطناعي', 'Review AI Decision')} isDark={isDark}>
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
            {reviewingItem
              ? `${reviewingItem.reviewId} · ${reviewingItem.moduleName}`
              : tr('مراجعة والموافقة أو رفض قرار الذكاء الاصطناعي', 'Review and approve or reject an AI decision')}
          </p>

          {reviewingItem && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              {/* Decision summary */}
              <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, padding: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 500 }}>{reviewingItem.aiDecision}</p>
                <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  {tr('الثقة:', 'Confidence:')} {reviewingItem.confidenceScore}% &middot;
                  {tr('الكيان:', 'Entity:')} {reviewingItem.entityName}
                </p>
              </div>

              {/* Your Decision */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('قرارك', 'Your Decision')}</CVisionLabel>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {([
                    { value: 'AGREE' as const, icon: CheckCircle, label: tr('موافق مع الذكاء الاصطناعي', 'Agree with AI'), color: 'border-green-500 bg-green-50 text-green-700' },
                    { value: 'DISAGREE' as const, icon: XCircle, label: tr('غير موافق', 'Disagree'), color: 'border-red-500 bg-red-50 text-red-700' },
                    { value: 'MODIFY' as const, icon: Pencil, label: tr('تعديل', 'Modify'), color: 'border-blue-500 bg-blue-50 text-blue-700' },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDecision(opt.value)}
                      className={`rounded-lg border-2 p-3 text-center transition-all ${
                        decision === opt.value ? opt.color : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <opt.icon style={{ height: 20, width: 20, marginBottom: 4 }} />
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modified Decision */}
              {decision === 'MODIFY' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('القرار المعدل', 'Modified Decision')}</CVisionLabel>
                  <CVisionTextarea C={C}
                    value={modifiedDecision}
                    onChange={e => setModifiedDecision(e.target.value)}
                    placeholder={tr('ما الذي يجب أن يكون عليه القرار بدلاً من ذلك؟', 'What should the decision be instead?')}
                    rows={2}
                  />
                </div>
              )}

              {/* Reasoning */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('السبب *', 'Reasoning *')}</CVisionLabel>
                <CVisionTextarea C={C}
                  value={reasoning}
                  onChange={e => setReasoning(e.target.value)}
                  placeholder={tr('اشرح سببك...', 'Explain your reasoning...')}
                  rows={3}
                />
              </div>

              {/* Feedback */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>{tr('ما مدى فائدة توصية الذكاء الاصطناعي هذه؟', 'How useful was this AI recommendation?')}</CVisionLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      onClick={() => setFeedbackScore(s)}
                      style={{ padding: 4 }}
                    >
                      <Star
                        className={`h-6 w-6 ${s <= feedbackScore ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                      />
                    </button>
                  ))}
                  {feedbackScore > 0 && (
                    <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{feedbackScore}/5</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setReviewOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSubmitReview} disabled={submitting || !reasoning.trim()}>
              {submitting && <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} />}
              {tr('إرسال المراجعة', 'Submit Review')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Context Dialog ── */}
      <CVisionDialog C={C} open={contextOpen} onClose={() => setContextOpen(false)} title={tr('السياق الكامل لقرار الذكاء الاصطناعي', 'Full AI Decision Context')} isDark={isDark}>
          <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('عرض تفصيلي لقرار الذكاء الاصطناعي ودرجات الثقة والبيانات ذات الصلة', 'Detailed view of the AI decision, confidence scores, and related data')}</p>

          {contextItem && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الوحدة', 'Module')}</p>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{contextItem.moduleName}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الثقة', 'Confidence')}</p>
                  <p style={{ fontSize: 13, fontWeight: 700 }}>{contextItem.confidenceScore}/100</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('القرار', 'Decision')}</p>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{contextItem.aiDecision}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الكيان', 'Entity')}</p>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{contextItem.entityName} ({contextItem.entityType})</p>
                </div>
              </div>

              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tr('تحليل الذكاء الاصطناعي', 'AI Reasoning')}</p>
                <p style={{ fontSize: 13 }}>{contextItem.aiReasoning}</p>
              </div>

              {Object.keys(contextItem.relatedData).length > 0 && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tr('البيانات ذات الصلة', 'Related Data')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(contextItem.relatedData).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}:
                        </span>
                        <span style={{ fontSize: 13 }}>
                          {Array.isArray(value) ? value.join(', ') : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Threshold visualization */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tr('لماذا تحت الحد', 'Why Below Threshold')}</p>
                <div style={{ position: 'relative', height: 32, borderRadius: '50%', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', background: C.redDim, width: `${contextItem.reviewThreshold}%` }} />
                  <div style={{ position: 'absolute', background: C.orangeDim, left: `${contextItem.reviewThreshold}%`, width: `${contextItem.autoApproveThreshold - contextItem.reviewThreshold}%` }} />
                  <div style={{ position: 'absolute', background: C.greenDim, left: `${contextItem.autoApproveThreshold}%`, width: `${100 - contextItem.autoApproveThreshold}%` }} />
                  <div style={{ position: 'absolute', width: 2, background: C.blueDim, left: `${contextItem.confidenceScore}%` }} />
                  <div style={{ position: 'absolute', background: C.blueDim, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: '50%', fontWeight: 700, left: `${Math.min(contextItem.confidenceScore, 90)}%` }}>
                    {contextItem.confidenceScore}%
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ color: C.red }}>{tr('رفض', 'Reject')} &lt;{contextItem.reviewThreshold}%</span>
                  <span style={{ color: C.orange }}>{tr('مراجعة', 'Review')}</span>
                  <span style={{ color: C.green }}>{tr('موافقة تلقائية', 'Auto-approve')} &ge;{contextItem.autoApproveThreshold}%</span>
                </div>
              </div>
            </div>
          )}

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setContextOpen(false)}>{tr('إغلاق', 'Close')}</CVisionButton>
            {contextItem && (
              <CVisionButton C={C} isDark={isDark} onClick={() => { setContextOpen(false); openReview(contextItem); }}>
                {tr('مراجعة هذا العنصر', 'Review This Item')}
              </CVisionButton>
            )}
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
