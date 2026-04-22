'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback, useMemo } from 'react';

import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  Inbox,
  Target,
  Star,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  type EmployeeReview,
  type ReviewTemplate,
  type CriterionScore,
  type ReviewGoal,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_BADGE,
  RATING_BADGE_COLORS,
  calculateCategoryScore,
} from '@/lib/cvision/performance/performance-engine';

interface MyReviewTabProps {
  activeCycleId: string | null;
  isAdmin?: boolean;
}

const STATUS_STEPS = [
  'NOT_STARTED',
  'SELF_REVIEW',
  'MANAGER_REVIEW',
  'COMPLETED',
  'ACKNOWLEDGED',
];

function StatusStepper({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STATUS_STEPS.indexOf(currentStatus);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {STATUS_STEPS.map((step, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                isCurrent
                  ? REVIEW_STATUS_BADGE[step]
                  : isPast
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {REVIEW_STATUS_LABELS[step]}
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div className={`w-4 h-0.5 ${isPast ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyReviewTab({ activeCycleId, isAdmin = false }: MyReviewTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [review, setReview] = useState<EmployeeReview | null>(null);
  const [template, setTemplate] = useState<ReviewTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Wizard state
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [wizardMode, setWizardMode] = useState<'scoring' | 'summary'>('scoring');

  // Form state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [employeeComment, setEmployeeComment] = useState('');
  const [goals, setGoals] = useState<ReviewGoal[]>([]);

  const { toast } = useToast();

  const fetchMyReview = useCallback(async (signal?: AbortSignal) => {
    if (!activeCycleId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/cvision/performance?action=my-review&cycleId=${activeCycleId}`,
        { credentials: 'include', signal }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load review');

      setReview(data.review || null);
      setTemplate(data.template || null);

      if (data.review) {
        const r = data.review as EmployeeReview;
        const scoreMap: Record<string, number> = {};
        const commentMap: Record<string, string> = {};
        for (const s of r.selfScores || []) {
          scoreMap[s.criterionId] = s.score;
          if (s.comment) commentMap[s.criterionId] = s.comment;
        }
        setScores(scoreMap);
        setComments(commentMap);
        setEmployeeComment(r.employeeComments || '');
        setGoals(r.goals || []);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeCycleId, toast]);

  useEffect(() => { const ac = new AbortController(); fetchMyReview(ac.signal); return () => ac.abort(); }, [fetchMyReview]);

  const categories = template?.categories || [];
  const currentCategory = categories[currentCategoryIndex];
  const totalCategories = categories.length;

  // Calculate overall progress
  const totalCriteria = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.criteria.length, 0),
    [categories]
  );
  const scoredCriteria = useMemo(
    () => Object.values(scores).filter(s => s > 0).length,
    [scores]
  );
  const overallProgress = totalCriteria > 0 ? Math.round((scoredCriteria / totalCriteria) * 100) : 0;

  // Category-level scores
  const categoryScores = useMemo(() => {
    return categories.map(cat => {
      const catScores = cat.criteria.map(crit => scores[crit.id] || 0);
      const scored = catScores.filter(s => s > 0);
      return scored.length > 0
        ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
        : 0;
    });
  }, [categories, scores]);

  const overallSelfScore = useMemo(() => {
    if (categories.length === 0) return 0;
    let weightedSum = 0;
    let totalWeight = 0;
    categories.forEach((cat, i) => {
      if (categoryScores[i] > 0) {
        weightedSum += categoryScores[i] * cat.weight;
        totalWeight += cat.weight;
      }
    });
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
  }, [categories, categoryScores]);

  function handleScoreChange(criterionId: string, score: number) {
    setScores(prev => ({ ...prev, [criterionId]: score }));
  }

  function handleCommentChange(criterionId: string, comment: string) {
    setComments(prev => ({ ...prev, [criterionId]: comment }));
  }

  function addGoal() {
    setGoals(prev => [...prev, { id: crypto.randomUUID(), goal: '', status: 'NOT_STARTED' }]);
  }

  function removeGoal(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  function updateGoal(id: string, goal: string) {
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, goal } : g)));
  }

  async function handleSubmitSelfReview() {
    if (!review || !template) return;
    const scoreArray: CriterionScore[] = [];
    for (const cat of template.categories) {
      for (const crit of cat.criteria) {
        const score = scores[crit.id];
        if (!score || score < 1) {
          toast({
            title: 'Incomplete Scores',
            description: `Please score all criteria before submitting. Missing: ${crit.name}`,
            variant: 'destructive',
          });
          return;
        }
        scoreArray.push({ criterionId: crit.id, score, comment: comments[crit.id] || '' });
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cvision/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'submit-self-review',
          reviewId: review.id,
          scores: scoreArray,
          comment: employeeComment,
          goals: goals.filter(g => g.goal.trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit self-review');
      toast({ title: 'Self-Review Submitted' });
      fetchMyReview();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcknowledge() {
    if (!review) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/cvision/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'acknowledge', reviewId: review.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to acknowledge');
      toast({ title: 'Review Acknowledged' });
      fetchMyReview();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / Empty states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 48, width: '100%' }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ width: '100%' }}  />
      </div>
    );
  }

  if (!activeCycleId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
        <Inbox style={{ height: 48, width: 48, marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>{tr('لا توجد دورة تقييم نشطة', 'No Active Review Cycle')}</h3>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{tr('تحقق من تبويب النظرة العامة لبدء دورة.', 'Check the Overview tab to start one.')}</p>
      </div>
    );
  }

  if (!review) {
    if (isAdmin) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
          <ShieldCheck style={{ height: 48, width: 48, marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>{tr('عرض المسؤول', 'Administrator View')}</h3>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4, maxWidth: 448 }}>
            {tr('بصفتك مسؤولاً، يمكنك إدارة التقييمات من تبويب تقييمات الفريق.', 'As an administrator, you manage reviews from the Team Reviews tab.')}
            {' '}{tr('يمكنك مراجعة أي موظف حتى لو لم يكمل تقييمه الذاتي.', 'You can review any employee, even if they haven\'t completed their self-review yet.')}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 13, color: C.textMuted }}>
            <Users style={{ height: 16, width: 16 }} />
            {tr('انتقل إلى تبويب تقييمات الفريق للبدء', 'Switch to the Team Reviews tab to get started')}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
        <Inbox style={{ height: 48, width: 48, marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>No Review Found</h3>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          You do not have a review assigned for the current cycle.
          Ask your HR team to generate reviews from the Overview tab.
        </p>
      </div>
    );
  }

  if (!template) return null;

  const isEditable = review.status === 'NOT_STARTED' || review.status === 'SELF_REVIEW';
  const isCompleted = review.status === 'COMPLETED' || review.status === 'ACKNOWLEDGED';
  const canAcknowledge = review.status === 'COMPLETED';

  const displayScores = review.managerScores && review.managerScores.length > 0
    ? review.managerScores : review.selfScores || [];
  const displayScoreMap: Record<string, number> = {};
  for (const s of displayScores) displayScoreMap[s.criterionId] = s.score;

  // ── Read-only / Completed view ────────────────────────────────────────────

  if (!isEditable) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <StatusStepper currentStatus={review.status} />

        {isCompleted && review.finalScore > 0 && (
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, color: C.textMuted }}>{tr('التقييم النهائي', 'Final Score')}</p>
                <p style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>
                  {review.finalScore.toFixed(2)} <span style={{ fontSize: 14, color: C.textMuted }}>/ 5.0</span>
                </p>
              </div>
              <CVisionBadge C={C} className={`text-sm px-3 py-1 ${
                RATING_BADGE_COLORS[
                  review.rating === 'Exceptional' ? 'EXCEPTIONAL' :
                  review.rating === 'Exceeds Expectations' ? 'EXCEEDS_EXPECTATIONS' :
                  review.rating === 'Meets Expectations' ? 'MEETS_EXPECTATIONS' :
                  review.rating === 'Needs Improvement' ? 'NEEDS_IMPROVEMENT' : 'UNSATISFACTORY'
                ] || ''
              }`}>
                {review.rating}
              </CVisionBadge>
            </div>
            {review.managerComments && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{tr('ملاحظات المدير', 'Manager Comments')}</p>
                <p style={{ fontSize: 13, color: C.textMuted }}>{review.managerComments}</p>
              </div>
            )}
            {review.developmentPlan && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Development Plan</p>
                <p style={{ fontSize: 13, color: C.textMuted }}>{review.developmentPlan}</p>
              </div>
            )}
            {canAcknowledge && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <CVisionButton C={C} isDark={isDark} onClick={handleAcknowledge} disabled={submitting}>
                  {submitting && <Loader2 style={{ marginRight: 8, height: 16, width: 16, animation: 'spin 1s linear infinite' }} />}
                  <CheckCircle style={{ marginRight: 8, height: 16, width: 16 }} />
                  Acknowledge Review
                </CVisionButton>
              </div>
            )}
          </div>
        )}

        {review.status === 'MANAGER_REVIEW' && (
          <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
            <div style={{ fontSize: 13, color: C.textSecondary }}>
              Your self-review has been submitted. Your manager is now reviewing your performance.
              You&apos;ll be notified when the review is complete.
            </div>
          </div>
        )}

        {/* Read-only category scores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categories.map(category => {
            const catResult = calculateCategoryScore(displayScores, category);
            return (
              <div key={category.id} style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>{category.name}</span>
                    <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{category.weight}%</CVisionBadge>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {catResult.rawAverage > 0 ? `${catResult.rawAverage.toFixed(1)} / 5.0` : 'Not scored'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {category.criteria.map(crit => (
                    <div key={crit.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: C.textMuted }}>{crit.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < (displayScoreMap[crit.id] || 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Editable Wizard View ──────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <StatusStepper currentStatus={review.status} />

      {/* Title + overall progress */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Your Self-Review</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${overallProgress}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>{overallProgress}%</span>
        </div>
        <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
          {scoredCriteria} of {totalCriteria} criteria scored
        </p>
      </div>

      {wizardMode === 'scoring' && currentCategory && (
        <>
          {/* Category header */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase' }}>
                  Category {currentCategoryIndex + 1} of {totalCategories}
                </p>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{currentCategory.name}</h4>
              </div>
              <CVisionBadge C={C} variant="outline">{currentCategory.weight}% weight</CVisionBadge>
            </div>

            {/* Category progress */}
            <div style={{ display: 'flex', gap: 4 }}>
              {categories.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${
                    i === currentCategoryIndex
                      ? 'bg-primary'
                      : i < currentCategoryIndex
                        ? 'bg-green-400'
                        : 'bg-muted'
                  }`}
                />
              ))}
            </div>

            <p style={{ fontSize: 13, color: C.textMuted }}>
              Rate yourself on each criterion below. Add optional comments to provide context.
            </p>

            {/* Criteria */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {currentCategory.criteria.map((criterion, idx) => (
                <div key={criterion.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500 }}>
                      {idx + 1}. {criterion.name}
                    </p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {criterion.description}
                    </p>
                  </div>

                  {/* Score selector with labels */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    {[1, 2, 3, 4, 5].map(val => (
                      <button
                        key={val}
                        className={`flex-1 py-2 px-1 rounded-lg border-2 text-center transition-all text-xs font-medium ${
                          scores[criterion.id] === val
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted hover:border-primary/40'
                        }`}
                        onClick={() => handleScoreChange(criterion.id, val)}
                      >
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{val}</span>
                        <span style={{ display: 'block', color: C.textMuted }}>
                          {val === 1 ? 'Poor' : val === 2 ? 'Below' : val === 3 ? 'Average' : val === 4 ? 'Good' : 'Excellent'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <CVisionInput C={C}
                    placeholder="Your comment (optional)..."
                    value={comments[criterion.id] || ''}
                    onChange={(e) => handleCommentChange(criterion.id, e.target.value)}
                    style={{ fontSize: 12, height: 32, marginTop: 4 }}
                  />
                </div>
              ))}
            </div>

            {/* Category score summary */}
            {categoryScores[currentCategoryIndex] > 0 && (
              <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 500, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                Category Score: <span style={{ color: C.gold }}>{categoryScores[currentCategoryIndex].toFixed(1)}</span> / 5.0
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
              <CVisionButton C={C} isDark={isDark}
                variant="outline"
                onClick={() => setCurrentCategoryIndex(prev => prev - 1)}
                disabled={currentCategoryIndex === 0}
              >
                <ChevronLeft style={{ height: 16, width: 16, marginRight: 4 }} /> Previous
              </CVisionButton>
              {currentCategoryIndex < totalCategories - 1 ? (
                <CVisionButton C={C} isDark={isDark} onClick={() => setCurrentCategoryIndex(prev => prev + 1)}>
                  Next Category <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} />
                </CVisionButton>
              ) : (
                <CVisionButton C={C} isDark={isDark} onClick={() => setWizardMode('summary')}>
                  Review Summary <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} />
                </CVisionButton>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Summary Page ─────────────────────────────────────────────── */}
      {wizardMode === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Score summary */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
            <h4 style={{ fontWeight: 600, marginBottom: 12 }}>Score Summary</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.map((cat, i) => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      style={{ color: C.gold, textAlign: 'left' }}
                      onClick={() => { setCurrentCategoryIndex(i); setWizardMode('scoring'); }}
                    >
                      {cat.name}
                    </button>
                    <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{cat.weight}%</CVisionBadge>
                  </div>
                  <span className={`font-medium ${categoryScores[i] > 0 ? '' : 'text-red-500'}`}>
                    {categoryScores[i] > 0 ? `${categoryScores[i].toFixed(1)} / 5.0` : 'Incomplete'}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Overall Self-Score</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.gold }}>
                {overallSelfScore > 0 ? overallSelfScore.toFixed(2) : '—'} / 5.0
              </span>
            </div>
          </div>

          {/* Goals */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Target style={{ height: 16, width: 16 }} />
                Goals for Next Period
              </h4>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={addGoal}>
                <Plus style={{ height: 14, width: 14, marginRight: 4 }} /> Add Goal
              </CVisionButton>
            </div>
            <p style={{ fontSize: 12, color: C.textMuted }}>Add 3-5 goals you want to achieve in the next review period.</p>
            {goals.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textMuted }}>No goals added yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {goals.map((goal, idx) => (
                  <div key={goal.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.textMuted, width: 20 }}>{idx + 1}.</span>
                    <CVisionInput C={C}
                      value={goal.goal}
                      onChange={(e) => updateGoal(goal.id, e.target.value)}
                      placeholder="Enter goal..."
                      style={{ flex: 1, fontSize: 13 }}
                    />
                    <CVisionButton C={C} isDark={isDark}
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGoal(goal.id)}
                      style={{ color: C.textMuted }}
                    >
                      <Trash2 style={{ height: 14, width: 14 }} />
                    </CVisionButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Employee Comments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h4 style={{ fontSize: 13, fontWeight: 500 }}>Your Comments</h4>
            <CVisionTextarea C={C}
              value={employeeComment}
              onChange={(e) => setEmployeeComment(e.target.value)}
              placeholder="Add any comments about your performance during this review period..."
              rows={3}
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setWizardMode('scoring'); setCurrentCategoryIndex(totalCategories - 1); }}>
              <ChevronLeft style={{ height: 16, width: 16, marginRight: 4 }} /> Back to Scoring
            </CVisionButton>
            <div style={{ display: 'flex', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleSubmitSelfReview} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Draft'}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleSubmitSelfReview} disabled={submitting || overallProgress < 100}>
                {submitting && <Loader2 style={{ marginRight: 8, height: 16, width: 16, animation: 'spin 1s linear infinite' }} />}
                Submit Self Review
              </CVisionButton>
            </div>
          </div>

          {overallProgress < 100 && (
            <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
              <div style={{ fontSize: 13, color: C.textSecondary }}>
                Please score all criteria before submitting. You have {totalCriteria - scoredCriteria} remaining.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
