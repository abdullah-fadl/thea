'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

import {
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
  Inbox,
  Users,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  FileEdit,
  UserCheck,
  ClipboardCheck,
} from 'lucide-react';
import {
  type ReviewCycle,
  CYCLE_STATUS_LABELS,
  CYCLE_STATUS_BADGE,
} from '@/lib/cvision/performance/performance-engine';
import CycleDialog from './CycleDialog';

interface CycleWithStats extends ReviewCycle {
  _stats?: {
    total: number;
    completed: number;
    avgScore: number;
    completionRate: number;
  };
}

interface OverviewTabProps {
  cycles: CycleWithStats[];
  loading: boolean;
  onRefresh: () => void;
}

const WORKFLOW_STEPS = [
  { label: 'HR Creates Cycle', desc: 'Set up review period and deadlines', icon: Plus },
  { label: 'Employees Self-Review', desc: 'Each employee rates their own performance', icon: FileEdit },
  { label: 'Managers Review', desc: 'Managers evaluate their direct reports', icon: UserCheck },
  { label: 'HR Reviews & Calibrate', desc: 'Ensure consistency across the organization', icon: ClipboardCheck },
];

export default function OverviewTab({
  cycles,
  loading,
  onRefresh,
}: OverviewTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    count: number;
    noManagerCount: number;
    noManagerEmployees: string[];
  } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const { toast } = useToast();

  const activeCycle = cycles.find((c) => c.status === 'ACTIVE');
  const pastCycles = cycles.filter((c) => c.status !== 'ACTIVE');
  const hasReviews = (activeCycle?._stats?.total || 0) > 0;

  // Determine which step we're on
  let currentStep = 0;
  if (activeCycle) {
    const stats = activeCycle._stats;
    if (!stats || stats.total === 0) {
      currentStep = 0; // Cycle exists but no reviews generated
    } else if (stats.completed === stats.total && stats.total > 0) {
      currentStep = 3; // All done
    } else if (stats.completed > 0 || (stats as any)?.inManagerReview > 0) {
      currentStep = 2; // Manager review phase
    } else {
      currentStep = 1; // Self-review phase
    }
  }

  const handleGenerateReviews = useCallback(async () => {
    if (!activeCycle) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch('/api/cvision/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'generate-reviews',
          cycleId: activeCycle.id,
          force: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error || data.message || `Server error (${res.status})`;
        setGenerateError(errMsg);
        toast({ title: 'Error', description: errMsg, variant: 'destructive' });
      } else if (data.success) {
        const created = data.reviewsCreated || 0;
        if (created === 0) {
          setGenerateError('No active employees found. Make sure employees have status ACTIVE or PROBATION and are not archived.');
          toast({ title: 'No Reviews Created', description: 'No active employees were found.', variant: 'destructive' });
        } else {
          setGenerateResult({
            count: created,
            noManagerCount: data.noManagerCount || 0,
            noManagerEmployees: data.noManagerEmployees || [],
          });
          toast({ title: 'Reviews Generated', description: `Created ${created} reviews.` });
        }
        onRefresh();
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error — could not reach server';
      setGenerateError(errMsg);
      toast({ title: 'Error', description: errMsg, variant: 'destructive' });
    }
    setGenerating(false);
  }, [activeCycle, onRefresh, toast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <CVisionSkeletonCard C={C} height={200} style={{ borderRadius: 12 }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ borderRadius: 12 }}  />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* How It Works guide */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
        <button
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, textAlign: 'left' }}
          onClick={() => setGuideOpen(!guideOpen)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap style={{ height: 20, width: 20, color: C.gold }} />
            <h3 style={{ fontWeight: 600 }}>How Performance Reviews Work</h3>
          </div>
          {guideOpen ? (
            <ChevronUp style={{ height: 16, width: 16, color: C.textMuted }} />
          ) : (
            <ChevronDown style={{ height: 16, width: 16, color: C.textMuted }} />
          )}
        </button>
        {guideOpen && (
          <div style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 20 }}>
            {/* Step progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginBottom: 4 }}>
              {WORKFLOW_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isPast = i < currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', zIndex: 10 }}>
                    <div
                      className={`h-10 w-10 rounded-full flex items-center justify-center mb-2 ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                          : isPast
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isPast ? <CheckCircle style={{ height: 20, width: 20 }} /> : <StepIcon style={{ height: 20, width: 20 }} />}
                    </div>
                    <span className={`text-xs text-center font-medium ${isCurrent ? 'text-primary' : isPast ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                    <span style={{ color: C.textMuted, textAlign: 'center', marginTop: 2 }}>
                      {step.desc}
                    </span>
                  </div>
                );
              })}
              {/* Connecting line */}
              <div style={{ position: 'absolute', height: 2, background: C.bgSubtle }}>
                <div
                  style={{ background: C.greenDim, transition: 'all 0.2s', width: `${(currentStep / (WORKFLOW_STEPS.length - 1)) * 100}%` }}
                />
              </div>
            </div>
            {activeCycle && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>
                  You are at: Step {currentStep + 1} — {WORKFLOW_STEPS[currentStep]?.label}
                </CVisionBadge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Cycle Card */}
      {activeCycle ? (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>{activeCycle.name}</h3>
                <CVisionBadge C={C} className={CYCLE_STATUS_BADGE[activeCycle.status]}>
                  {CYCLE_STATUS_LABELS[activeCycle.status]}
                </CVisionBadge>
              </div>
              <p style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>
                {activeCycle.startDate} to {activeCycle.endDate}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 24, fontWeight: 700 }}>
                {activeCycle._stats?.completionRate || 0}%
              </p>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('الإنجاز', 'Completion')}</p>
            </div>
          </div>

          <div style={{ height: 6, borderRadius: 3, background: C.bgSubtle, overflow: "hidden" }}><div style={{ height: "100%", width: `${activeCycle._stats?.completionRate || 0}%`, background: C.gold, borderRadius: 3, transition: "width 0.3s" }} /></div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar style={{ height: 16, width: 16, color: C.textMuted }} />
              <div>
                <p style={{ color: C.textMuted }}>{tr('موعد التقييم الذاتي', 'Self-Review Due')}</p>
                <p style={{ fontWeight: 500 }}>
                  {activeCycle.selfReviewDeadline
                    ? new Date(activeCycle.selfReviewDeadline).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle style={{ height: 16, width: 16, color: C.textMuted }} />
              <div>
                <p style={{ color: C.textMuted }}>{tr('مكتمل', 'Completed')}</p>
                <p style={{ fontWeight: 500 }}>
                  {activeCycle._stats?.completed || 0} of{' '}
                  {activeCycle._stats?.total || 0}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp style={{ height: 16, width: 16, color: C.textMuted }} />
              <div>
                <p style={{ color: C.textMuted }}>{tr('متوسط التقييم', 'Avg Score')}</p>
                <p style={{ fontWeight: 500 }}>
                  {activeCycle._stats?.avgScore
                    ? activeCycle._stats.avgScore.toFixed(2)
                    : '-'}{' '}
                  / 5.0
                </p>
              </div>
            </div>
          </div>

          {/* Generate Reviews prompt */}
          {!hasReviews && !generateResult && (
            <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
              <AlertTriangle style={{ height: 16, width: 16, color: C.orange }} />
              <div style={{ fontSize: 13, color: C.textSecondary }}>
                <span style={{ fontWeight: 600 }}>{tr('لا توجد تقييمات موظفين لهذه الدورة بعد.', 'This cycle has no employee reviews yet.')}</span>
                <span style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
                  Generate review records for all active employees to start the evaluation process.
                </span>
                <CVisionButton C={C} isDark={isDark}
                  style={{ marginTop: 12 }}
                  onClick={handleGenerateReviews}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Users style={{ height: 16, width: 16, marginRight: 8 }} />
                  )}
                  {generating ? 'Generating...' : 'Generate Reviews for All Employees'}
                </CVisionButton>
                {generateError && (
                  <span style={{ display: 'block', fontSize: 13, marginTop: 8, color: C.red, fontWeight: 500 }}>
                    Failed: {generateError}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Success message after generation */}
          {generateResult && generateResult.count > 0 && (
            <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
              <CheckCircle style={{ height: 16, width: 16, color: C.green }} />
              <div style={{ fontSize: 13, color: C.textSecondary }}>
                <span style={{ fontWeight: 600 }}>
                  Reviews created for {generateResult.count} employees.
                </span>
                <span style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
                  Employees can now start their self-reviews. Navigate to the &quot;My Review&quot; tab to begin.
                </span>
                {generateResult.noManagerCount > 0 && (
                  <span style={{ display: 'block', fontSize: 13, marginTop: 4, color: C.orange }}>
                    ⚠ {generateResult.noManagerCount} employee{generateResult.noManagerCount > 1 ? 's have' : ' has'} no manager assigned:
                    {' '}{generateResult.noManagerEmployees.join(', ')}
                    {generateResult.noManagerCount > 10 && '...'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 48, textAlign: 'center', borderRadius: 12, border: `1px solid ${C.border}` }}>
          <Inbox style={{ height: 48, width: 48, marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>
            No Active Review Cycle
          </h3>
          <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
            Start a new review cycle to begin the performance evaluation process.
          </p>
          <CVisionButton C={C} isDark={isDark} style={{ marginTop: 16 }} onClick={() => setCycleDialogOpen(true)}>
            <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
            Start New Review Cycle
          </CVisionButton>
        </div>
      )}

      {/* Create New Cycle Button (when active cycle exists) */}
      {activeCycle && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <CVisionButton C={C} isDark={isDark}
            variant="outline"
            size="sm"
            onClick={() => setCycleDialogOpen(true)}
          >
            <Plus style={{ height: 16, width: 16, marginRight: 8 }} />
            New Review Cycle
          </CVisionButton>
        </div>
      )}

      {/* Past Cycles Table */}
      {pastCycles.length > 0 && (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ fontWeight: 600 }}>{tr('دورات التقييم السابقة', 'Past Review Cycles')}</h4>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Year</th>
                  <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Name</th>
                  <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Reviews</th>
                  <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>{tr('متوسط التقييم', 'Avg Score')}</th>
                  <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Period</th>
                </tr>
              </thead>
              <tbody>
                {pastCycles.map((cycle) => (
                  <tr key={cycle.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: 12, fontFamily: 'monospace' }}>{cycle.year}</td>
                    <td style={{ padding: 12 }}>{cycle.name}</td>
                    <td style={{ padding: 12 }}>
                      <CVisionBadge C={C}
                        className={`text-xs ${CYCLE_STATUS_BADGE[cycle.status] || ''}`}
                      >
                        {CYCLE_STATUS_LABELS[cycle.status] || cycle.status}
                      </CVisionBadge>
                    </td>
                    <td style={{ padding: 12 }}>
                      {cycle._stats
                        ? `${cycle._stats.completed}/${cycle._stats.total}`
                        : '-'}
                    </td>
                    <td style={{ padding: 12 }}>
                      {cycle._stats?.avgScore
                        ? cycle._stats.avgScore.toFixed(2)
                        : '-'}
                    </td>
                    <td style={{ padding: 12, color: C.textMuted }}>
                      {cycle.startDate} — {cycle.endDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CycleDialog
        open={cycleDialogOpen}
        onOpenChange={setCycleDialogOpen}
        onSuccess={onRefresh}
      />
    </div>
  );
}
