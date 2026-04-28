'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Inbox,
  Eye,
  X,
  Lock,
  CheckCircle,
  Clock,
  Star,
  Users,
  Zap,
  Send,
  Circle,
} from 'lucide-react';
import {
  type EmployeeReview,
  type CriterionScore,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_BADGE,
  RATING_BADGE_COLORS,
  DEFAULT_REVIEW_TEMPLATE,
  calculateCategoryScore,
} from '@/lib/cvision/performance/performance-engine';
import ScoreSelector from './ScoreSelector';

interface TeamReviewsTabProps {
  activeCycleId: string | null;
  isAdmin?: boolean;
}

type WizardTarget = 'manager' | 'self-admin';

export default function TeamReviewsTab({ activeCycleId, isAdmin = false }: TeamReviewsTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [reviews, setReviews] = useState<EmployeeReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [wizardTarget, setWizardTarget] = useState<WizardTarget>('manager');
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [wizardScores, setWizardScores] = useState<Record<string, number>>({});
  const [wizardComments, setWizardComments] = useState<Record<string, string>>({});
  const [managerComment, setManagerComment] = useState('');
  const [developmentPlan, setDevelopmentPlan] = useState('');
  const [promotionRec, setPromotionRec] = useState(false);
  const [salaryRec, setSalaryRec] = useState(false);
  const [employeeComment, setEmployeeComment] = useState('');
  const [wizardMode, setWizardMode] = useState<'scoring' | 'summary'>('scoring');

  const { toast } = useToast();

  const fetchTeamReviews = useCallback(async (signal?: AbortSignal) => {
    if (!activeCycleId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/cvision/performance?action=reviews&cycleId=${activeCycleId}`,
        { credentials: 'include', signal }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reviews');
      setReviews(data.data?.items || data.data || []);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [activeCycleId, toast]);

  useEffect(() => { const ac = new AbortController(); fetchTeamReviews(ac.signal); return () => ac.abort(); }, [fetchTeamReviews]);

  function openWizard(reviewId: string, target: WizardTarget) {
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;
    setSelectedReviewId(reviewId);
    setWizardTarget(target);
    setCurrentCategoryIndex(0);
    setWizardMode('scoring');
    setWizardComments({});

    const scoreMap: Record<string, number> = {};
    if (target === 'manager') {
      for (const s of review.managerScores || []) scoreMap[s.criterionId] = s.score;
      if (Object.keys(scoreMap).length === 0) {
        for (const s of review.selfScores || []) scoreMap[s.criterionId] = s.score;
      }
      setManagerComment(review.managerComments || '');
      setDevelopmentPlan(review.developmentPlan || '');
      setPromotionRec(review.promotionRecommendation || false);
      setSalaryRec(review.salaryIncreaseRecommendation || false);
    } else {
      for (const s of review.selfScores || []) {
        scoreMap[s.criterionId] = s.score;
        if (s.comment) setWizardComments(prev => ({ ...prev, [s.criterionId]: s.comment }));
      }
      setEmployeeComment(review.employeeComments || '');
    }
    setWizardScores(scoreMap);
  }

  function closeWizard() {
    setSelectedReviewId(null);
    setWizardScores({});
    setWizardComments({});
    setManagerComment('');
    setDevelopmentPlan('');
    setPromotionRec(false);
    setSalaryRec(false);
    setEmployeeComment('');
    setCurrentCategoryIndex(0);
    setWizardMode('scoring');
  }

  async function handleSubmitManagerReview() {
    if (!selectedReviewId) return;
    const scoreArray: CriterionScore[] = [];
    for (const cat of DEFAULT_REVIEW_TEMPLATE.categories) {
      for (const crit of cat.criteria) {
        const score = wizardScores[crit.id];
        if (!score || score < 1) {
          toast({ title: 'Incomplete Scores', description: `Missing: ${crit.name}`, variant: 'destructive' });
          return;
        }
        scoreArray.push({ criterionId: crit.id, score, comment: '' });
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cvision/performance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'submit-manager-review',
          reviewId: selectedReviewId,
          scores: scoreArray,
          comment: managerComment,
          developmentPlan,
          promotionRecommendation: promotionRec,
          salaryIncreaseRecommendation: salaryRec,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit manager review');
      toast({ title: 'Manager Review Submitted' });
      closeWizard();
      fetchTeamReviews();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitSelfReviewAdmin() {
    if (!selectedReviewId) return;
    const scoreArray: CriterionScore[] = [];
    for (const cat of DEFAULT_REVIEW_TEMPLATE.categories) {
      for (const crit of cat.criteria) {
        const score = wizardScores[crit.id];
        if (!score || score < 1) {
          toast({ title: 'Incomplete Scores', description: `Missing: ${crit.name}`, variant: 'destructive' });
          return;
        }
        scoreArray.push({ criterionId: crit.id, score, comment: wizardComments[crit.id] || '' });
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/cvision/performance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          action: 'submit-self-review-admin',
          reviewId: selectedReviewId,
          scores: scoreArray,
          comment: employeeComment,
          goals: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit self-review');
      toast({ title: 'Self-Review Submitted', description: 'Manager review is now unlocked.' });
      closeWizard();
      fetchTeamReviews();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  const categories = DEFAULT_REVIEW_TEMPLATE.categories;
  const currentCategory = categories[currentCategoryIndex];
  const selectedReview = reviews.find(r => r.id === selectedReviewId);

  const selfScoreMap: Record<string, { score: number; comment: string }> = {};
  if (selectedReview) {
    for (const s of selectedReview.selfScores || []) {
      selfScoreMap[s.criterionId] = { score: s.score, comment: s.comment || '' };
    }
  }

  const completedCount = reviews.filter(r => ['COMPLETED', 'ACKNOWLEDGED'].includes(r.status)).length;
  const awaitingSelf = reviews.filter(r => r.status === 'NOT_STARTED').length;
  const awaitingManager = reviews.filter(r => r.status === 'SELF_REVIEW' || r.status === 'MANAGER_REVIEW').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 112, borderRadius: 12 }}  />)}
      </div>
    );
  }

  if (!activeCycleId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
        <Inbox style={{ height: 48, width: 48, marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>No Active Review Cycle</h3>
      </div>
    );
  }

  // ── Employee card list ────────────────────────────────────────────────────

  if (!selectedReview) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {reviews.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
            <Inbox style={{ height: 48, width: 48, marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>No Reviews Found</h3>
            <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
              No employee reviews are assigned to you for this cycle.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Users style={{ height: 20, width: 20, color: C.gold }} />
                <h3 style={{ fontWeight: 600 }}>Your Team&apos;s Reviews ({reviews.length} employees)</h3>
              </div>
              <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                <span style={{ color: C.orange, fontWeight: 500 }}>{awaitingSelf} awaiting self-review</span>
                <span style={{ color: C.blue, fontWeight: 500 }}>{awaitingManager} awaiting manager review</span>
                <span style={{ color: C.green, fontWeight: 500 }}>{completedCount} completed</span>
              </div>
            </div>

            {/* Employee cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reviews.map(review => {
                const hasSelfScores = Array.isArray(review.selfScores) && review.selfScores.length > 0;
                const selfDone = review.overallSelfScore > 0 || hasSelfScores;
                const managerDone = review.overallManagerScore > 0 || (Array.isArray(review.managerScores) && review.managerScores.length > 0);
                const isComplete = review.status === 'COMPLETED' || review.status === 'ACKNOWLEDGED';
                const selfReviewReady = selfDone && !managerDone;

                return (
                  <div key={review.id} style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
                    {/* Employee info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ height: 40, width: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontWeight: 700 }}>
                          {review.employeeName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600 }}>{review.employeeName}</p>
                          <p style={{ fontSize: 13, color: C.textMuted }}>{review.jobTitle} &middot; {review.department}</p>
                        </div>
                      </div>
                    </div>

                    {/* Two-step pipeline */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 12 }}>
                      {/* Step 1: Self-Review */}
                      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>Step 1: Self-Review</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {selfDone ? (
                            <>
                              <CheckCircle style={{ height: 16, width: 16, color: C.green }} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.green }}>
                                Completed ({review.overallSelfScore > 0 ? review.overallSelfScore.toFixed(1) : '—'})
                              </span>
                            </>
                          ) : (
                            <>
                              <Circle style={{ height: 16, width: 16 }} />
                              <span style={{ fontSize: 13, color: C.textMuted }}>Not Started</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Step 2: Manager Review */}
                      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>Step 2: Manager Review</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {managerDone ? (
                            <>
                              <CheckCircle style={{ height: 16, width: 16, color: C.green }} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.green }}>
                                Completed ({review.overallManagerScore.toFixed(1)})
                              </span>
                            </>
                          ) : selfReviewReady ? (
                            <>
                              <Clock style={{ height: 16, width: 16, color: C.blue }} />
                              <span style={{ fontSize: 13, fontWeight: 500, color: C.blue }}>Ready for review</span>
                            </>
                          ) : (
                            <>
                              <Lock style={{ height: 16, width: 16 }} />
                              <span style={{ fontSize: 13, color: C.textMuted }}>Locked</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Final score if complete */}
                    {isComplete && review.finalScore > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 12, background: C.greenDim, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10 }}>
                        <Star style={{ height: 16, width: 16, color: C.orange }} />
                        <span style={{ fontWeight: 600 }}>Final Score: {review.finalScore.toFixed(2)}</span>
                        <span style={{ color: C.textMuted }}>—</span>
                        <CVisionBadge C={C} className={`text-xs ${
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
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* CASE 1: Self-review NOT done → admin can do it on behalf */}
                      {!selfDone && !isComplete && (
                        <>
                          {isAdmin && (
                            <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => openWizard(review.id, 'self-admin')} style={{ gap: 6 }}>
                              <Zap style={{ height: 14, width: 14 }} />
                              Do Self-Review for Employee
                            </CVisionButton>
                          )}
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ gap: 6, color: C.textMuted }} onClick={() => {
                            toast({ title: 'Reminder Sent', description: `Notification sent to ${review.employeeName} to complete their self-review.` });
                          }}>
                            <Send style={{ height: 14, width: 14 }} />Send Reminder
                          </CVisionButton>
                        </>
                      )}

                      {/* CASE 2: Self-review done, manager NOT done → start manager review */}
                      {selfReviewReady && (
                        <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => openWizard(review.id, 'manager')}>
                          Start Manager Review <ChevronRight style={{ height: 16, width: 16, marginLeft: 4 }} />
                        </CVisionButton>
                      )}

                      {/* CASE 3: Both complete → view details */}
                      {isComplete && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => openWizard(review.id, 'manager')}>
                          <Eye style={{ height: 16, width: 16, marginRight: 4 }} /> View Details
                        </CVisionButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Wizard (Manager Review OR Admin Self-Review) ─────────────────────────

  const isReadOnly = selectedReview.status === 'COMPLETED' || selectedReview.status === 'ACKNOWLEDGED';
  const isSelfMode = wizardTarget === 'self-admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>
            {isSelfMode ? 'Self-Review' : 'Manager Review'}: {selectedReview.employeeName}
          </h3>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            {selectedReview.jobTitle} &middot; {selectedReview.department}
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={closeWizard}>
          <X style={{ height: 16, width: 16, marginRight: 4 }} /> Close
        </CVisionButton>
      </div>

      {isSelfMode && !isReadOnly && (
        <div style={{ borderRadius: 12, background: C.orangeDim, border: `1px solid ${C.border}`, padding: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap style={{ height: 16, width: 16, color: C.orange }} />
          <span style={{ color: C.orange, fontWeight: 500 }}>Admin Mode: You are completing this self-review on behalf of {selectedReview.employeeName}.</span>
        </div>
      )}

      {wizardMode === 'scoring' && currentCategory && (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, textTransform: 'uppercase' }}>
                Category {currentCategoryIndex + 1} of {categories.length}
              </p>
              <h4 style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{currentCategory.name}</h4>
            </div>
            <CVisionBadge C={C} variant="outline">{currentCategory.weight}%</CVisionBadge>
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {categories.map((_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${
                i === currentCategoryIndex ? 'bg-primary' : i < currentCategoryIndex ? 'bg-green-400' : 'bg-muted'
              }`} />
            ))}
          </div>

          {/* Column headers */}
          {!isSelfMode && (
            <div style={{ display: 'grid', gap: 12, fontSize: 12, fontWeight: 500, color: C.textMuted, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
              <span>Criterion</span>
              <span style={{ textAlign: 'center' }}>Employee Self-Score</span>
              <span style={{ textAlign: 'center' }}>Your Rating</span>
            </div>
          )}

          {/* Criteria */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {currentCategory.criteria.map(criterion => {
              const selfInfo = selfScoreMap[criterion.id];
              return (
                <div key={criterion.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{criterion.name}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{criterion.description}</p>

                  {isSelfMode ? (
                    /* Self-review mode: single score column + comment */
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: C.textMuted, width: 64 }}>Rating:</span>
                        <ScoreSelector
                          value={wizardScores[criterion.id] || 0}
                          onChange={(score) => setWizardScores(prev => ({ ...prev, [criterion.id]: score }))}
                          disabled={isReadOnly}
                        />
                      </div>
                      <CVisionTextarea C={C}
                        value={wizardComments[criterion.id] || ''}
                        onChange={(e) => setWizardComments(prev => ({ ...prev, [criterion.id]: e.target.value }))}
                        placeholder="Comment (optional)..."
                        rows={1}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  ) : (
                    /* Manager review: side-by-side with self-scores */
                    <div style={{ display: 'grid', gap: 12, alignItems: 'flex-start', marginTop: 8 }}>
                      <div>
                        {selfInfo?.comment && (
                          <p style={{ fontSize: 12, color: C.textMuted, borderRadius: 6, padding: 8 }}>
                            &ldquo;{selfInfo.comment}&rdquo;
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {selfInfo?.score ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {Array.from({ length: 5 }, (_, i) => (
                              <Star key={i} className={`h-4 w-4 ${i < selfInfo.score ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                            ))}
                            <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 4 }}>({selfInfo.score})</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: C.textMuted }}>Not submitted</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <ScoreSelector
                          value={wizardScores[criterion.id] || 0}
                          onChange={(score) => setWizardScores(prev => ({ ...prev, [criterion.id]: score }))}
                          disabled={isReadOnly}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCurrentCategoryIndex(prev => prev - 1)} disabled={currentCategoryIndex === 0}>
              <ChevronLeft style={{ height: 16, width: 16, marginRight: 4 }} /> Previous
            </CVisionButton>
            {currentCategoryIndex < categories.length - 1 ? (
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
      )}

      {/* ── Summary / Submit ─────────────────────────────────────────── */}
      {wizardMode === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Score comparison (only for manager mode when self-scores exist) */}
          {!isSelfMode && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
              <h4 style={{ fontWeight: 600, marginBottom: 12 }}>Score Comparison: Self vs Manager</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.map((cat) => {
                  const selfCat = calculateCategoryScore(selectedReview.selfScores || [], cat);
                  const mgrScoresArr = Object.entries(wizardScores).map(([criterionId, score]) => ({ criterionId, score }));
                  const mgrCat = calculateCategoryScore(mgrScoresArr, cat);
                  return (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{cat.name} ({cat.weight}%)</span>
                      <div style={{ display: 'flex', gap: 24 }}>
                        <span style={{ color: C.textMuted, width: 80, textAlign: 'right' }}>Self: {selfCat.rawAverage > 0 ? selfCat.rawAverage.toFixed(1) : '—'}</span>
                        <span style={{ fontWeight: 500, width: 80, textAlign: 'right' }}>Mgr: {mgrCat.rawAverage > 0 ? mgrCat.rawAverage.toFixed(1) : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Overall</span>
                <div style={{ display: 'flex', gap: 24 }}>
                  <span style={{ color: C.textMuted, width: 80, textAlign: 'right' }}>
                    {selectedReview.overallSelfScore > 0 ? selectedReview.overallSelfScore.toFixed(2) : '—'}
                  </span>
                  <span style={{ color: C.gold, width: 80, textAlign: 'right' }}>
                    {(() => {
                      const allMgr = Object.values(wizardScores).filter(s => s > 0);
                      return allMgr.length > 0 ? (allMgr.reduce((a, b) => a + b, 0) / allMgr.length).toFixed(2) : '—';
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Self-review admin: simple score summary */}
          {isSelfMode && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }}>
              <h4 style={{ fontWeight: 600, marginBottom: 12 }}>Self-Review Score Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categories.map((cat) => {
                  const scoresArr = Object.entries(wizardScores).map(([criterionId, score]) => ({ criterionId, score }));
                  const catScore = calculateCategoryScore(scoresArr, cat);
                  return (
                    <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                      <span>{cat.name} ({cat.weight}%)</span>
                      <span style={{ fontWeight: 500 }}>{catScore.rawAverage > 0 ? catScore.rawAverage.toFixed(1) : '—'}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ height: 1, background: C.border, margin: "8px 0" }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                <span>Overall</span>
                <span style={{ color: C.gold }}>
                  {(() => {
                    const all = Object.values(wizardScores).filter(s => s > 0);
                    return all.length > 0 ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(2) : '—';
                  })()}
                </span>
              </div>
            </div>
          )}

          {/* Manager review inputs */}
          {!isReadOnly && !isSelfMode && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Manager Comments</label>
                <CVisionTextarea C={C} value={managerComment} onChange={(e) => setManagerComment(e.target.value)} placeholder="Overall assessment comments..." rows={3} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Development Plan</label>
                <CVisionTextarea C={C} value={developmentPlan} onChange={(e) => setDevelopmentPlan(e.target.value)} placeholder="Recommended development areas and actions..." rows={2} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={promotionRec} onChange={(e) => setPromotionRec(e.target.checked)} style={{ borderRadius: 6 }} />
                  Recommend for promotion
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input type="checkbox" checked={salaryRec} onChange={(e) => setSalaryRec(e.target.checked)} style={{ borderRadius: 6 }} />
                  Recommend salary increase
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setWizardMode('scoring'); setCurrentCategoryIndex(categories.length - 1); }}>
                  <ChevronLeft style={{ height: 16, width: 16, marginRight: 4 }} /> Back
                </CVisionButton>
                <CVisionButton C={C} isDark={isDark} onClick={handleSubmitManagerReview} disabled={submitting}>
                  {submitting && <Loader2 style={{ marginRight: 8, height: 16, width: 16, animation: 'spin 1s linear infinite' }} />}
                  Submit Manager Review
                </CVisionButton>
              </div>
            </>
          )}

          {/* Self-review admin inputs */}
          {!isReadOnly && isSelfMode && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Employee Comments</label>
                <CVisionTextarea C={C} value={employeeComment} onChange={(e) => setEmployeeComment(e.target.value)} placeholder="Employee comments (entered on their behalf)..." rows={3} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setWizardMode('scoring'); setCurrentCategoryIndex(categories.length - 1); }}>
                  <ChevronLeft style={{ height: 16, width: 16, marginRight: 4 }} /> Back
                </CVisionButton>
                <CVisionButton C={C} isDark={isDark} onClick={handleSubmitSelfReviewAdmin} disabled={submitting} style={{ gap: 6 }}>
                  {submitting && <Loader2 style={{ marginRight: 8, height: 16, width: 16, animation: 'spin 1s linear infinite' }} />}
                  <Zap style={{ height: 16, width: 16 }} /> Submit Self-Review (Admin)
                </CVisionButton>
              </div>
            </>
          )}

          {isReadOnly && (
            <div style={{ display: 'flex' }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={closeWizard}>
                <ChevronLeft style={{ height: 16, width: 16, marginRight: 4 }} /> Back to Team
              </CVisionButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
