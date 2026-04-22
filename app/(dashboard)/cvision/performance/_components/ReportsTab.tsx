'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';

import { useToast } from '@/hooks/use-toast';
import {
  Download,
  AlertTriangle,
  Inbox,
  Trophy,
  TrendingDown,
} from 'lucide-react';
import {
  type ReviewCycle,
  type CalibrationReport,
  RATING_MAP,
  RATING_BADGE_COLORS,
} from '@/lib/cvision/performance/performance-engine';
interface ReportsTabProps {
  cycles: ReviewCycle[];
}

export default function ReportsTab({ cycles }: ReportsTabProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    cycles.find((c) => c.status === 'COMPLETED')?.id ||
      cycles.find((c) => c.status === 'ACTIVE')?.id ||
      ''
  );
  const [report, setReport] = useState<CalibrationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchReport = useCallback(async (signal?: AbortSignal) => {
    if (!selectedCycleId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/cvision/performance?action=calibration&cycleId=${selectedCycleId}`,
        { credentials: 'include', signal }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report');

      setReport(data.data || null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedCycleId, toast]);

  useEffect(() => { const ac = new AbortController(); fetchReport(ac.signal); return () => ac.abort(); }, [fetchReport]);

  function handleExportCSV() {
    if (!report) return;

    const rows = [
      [
        'Department',
        'Employees',
        'Completed',
        'Avg Score',
        'Completion Rate',
        ...RATING_MAP.map((r) => r.label),
      ],
    ];

    for (const dept of report.departmentStats) {
      rows.push([
        dept.departmentName,
        String(dept.employeeCount),
        String(dept.completedCount),
        dept.averageScore.toFixed(2),
        `${dept.completionRate}%`,
        ...RATING_MAP.map((r) => String(dept.distribution[r.key] || 0)),
      ]);
    }

    // Add top performers
    rows.push([]);
    rows.push(['Top Performers']);
    rows.push(['Employee', 'Score', 'Rating']);
    for (const p of report.topPerformers) {
      rows.push([p.employeeName, p.score.toFixed(2), p.rating]);
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${selectedCycleId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cycles.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64, textAlign: 'center' }}>
        <Inbox style={{ height: 48, width: 48, marginBottom: 12 }} />
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>
          No Review Cycles
        </h3>
        <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
          Create a review cycle first to view reports.
        </p>
      </div>
    );
  }

  // Compute overall average for calibration flagging
  const orgAvg = report?.averageScore || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cycle Selector + Export */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <CVisionSelect
                C={C}
                value={selectedCycleId}
                onChange={setSelectedCycleId}
                placeholder="Select a review cycle"
                options={[...cycles.map((cycle) => (
              ({ value: cycle.id, label: `${cycle.name} (${cycle.year})` })
            ))]}
              />

        <CVisionButton C={C} isDark={isDark}
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={!report}
        >
          <Download style={{ height: 16, width: 16, marginRight: 8 }} />
          Export CSV
        </CVisionButton>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CVisionSkeletonCard C={C} height={200} className="h-[100px]"  />
          <CVisionSkeletonCard C={C} height={200} className="h-[200px]"  />
          <CVisionSkeletonCard C={C} height={200} className="h-[200px]"  />
        </div>
      ) : report ? (
        <>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي التقييمات', 'Total Reviews')}</p>
              <p style={{ fontSize: 24, fontWeight: 700 }}>{report.totalReviews}</p>
            </div>
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('مكتمل', 'Completed')}</p>
              <p style={{ fontSize: 24, fontWeight: 700 }}>{report.completedReviews}</p>
            </div>
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('متوسط التقييم', 'Average Score')}</p>
              <p style={{ fontSize: 24, fontWeight: 700 }}>
                {report.averageScore.toFixed(2)}
              </p>
            </div>
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
              <p style={{ fontSize: 12, color: C.textMuted }}>{tr('نسبة الإنجاز', 'Completion Rate')}</p>
              <p style={{ fontSize: 24, fontWeight: 700 }}>
                {report.totalReviews > 0
                  ? Math.round(
                      (report.completedReviews / report.totalReviews) * 100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>

          {/* Rating Distribution */}
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 style={{ fontWeight: 600 }}>{tr('توزيع التقييمات', 'Rating Distribution')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {RATING_MAP.map((tier) => {
                const count = report.distribution[tier.key] || 0;
                const total = report.completedReviews || 1;
                const pct = Math.round((count / total) * 100);

                return (
                  <div key={tier.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 160, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tier.label}</div>
                    <div style={{ flex: 1, height: 20, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                      <div
                        className={`h-full rounded-full ${
                          tier.color === 'emerald'
                            ? 'bg-emerald-500'
                            : tier.color === 'blue'
                            ? 'bg-blue-500'
                            : tier.color === 'amber'
                            ? 'bg-amber-500'
                            : tier.color === 'orange'
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                    <div style={{ width: 64, fontSize: 13, textAlign: 'right', color: C.textMuted }}>
                      {count} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Department Comparison Table */}
          {report.departmentStats.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ padding: 16, borderBottom: `1px solid ${C.border}` }}>
                <h4 style={{ fontWeight: 600 }}>Department Comparison</h4>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Department</th>
                      <th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Avg Score</th>
                      {RATING_MAP.map((tier) => (
                        <th
                          key={tier.key}
                          style={{ textAlign: 'center', padding: 12, fontWeight: 500, fontSize: 12 }}
                        >
                          {tier.label.split(' ')[0]}
                        </th>
                      ))}
                      <th style={{ textAlign: 'center', padding: 12, fontWeight: 500 }}>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.departmentStats.map((dept) => {
                      const deviation = orgAvg > 0
                        ? Math.abs(dept.averageScore - orgAvg)
                        : 0;
                      const flagged = deviation > 0.7 && dept.completedCount > 0;

                      return (
                        <tr
                          key={dept.departmentId}
                          style={{ borderBottom: `1px solid ${C.border}` }}
                        >
                          <td style={{ padding: 12 }}>{dept.departmentName}</td>
                          <td style={{ padding: 12, fontFamily: 'monospace' }}>
                            {dept.averageScore > 0
                              ? dept.averageScore.toFixed(2)
                              : '-'}
                          </td>
                          {RATING_MAP.map((tier) => (
                            <td
                              key={tier.key}
                              style={{ padding: 12, textAlign: 'center', color: C.textMuted }}
                            >
                              {dept.distribution[tier.key] || 0}
                            </td>
                          ))}
                          <td style={{ padding: 12, textAlign: 'center' }}>
                            {flagged && (
                              <AlertTriangle style={{ height: 16, width: 16, color: C.orange }} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Performers */}
          {report.topPerformers.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trophy style={{ height: 16, width: 16, color: C.orange }} />
                Top Performers
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.topPerformers.map((p, idx) => (
                  <div
                    key={p.employeeId}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: C.textMuted, width: 24 }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontWeight: 500 }}>{p.employeeName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace' }}>{p.score.toFixed(2)}</span>
                      <CVisionBadge C={C}
                        className={`text-xs ${
                          RATING_BADGE_COLORS[
                            p.rating === 'Exceptional'
                              ? 'EXCEPTIONAL'
                              : p.rating === 'Exceeds Expectations'
                              ? 'EXCEEDS_EXPECTATIONS'
                              : 'MEETS_EXPECTATIONS'
                          ] || ''
                        }`}
                      >
                        {p.rating}
                      </CVisionBadge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employees Needing Attention */}
          {report.bottomPerformers.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingDown style={{ height: 16, width: 16, color: C.orange }} />
                Employees Needing Attention
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {report.bottomPerformers.map((p) => (
                  <div
                    key={p.employeeId}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}
                  >
                    <span style={{ fontWeight: 500 }}>{p.employeeName}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace' }}>{p.score.toFixed(2)}</span>
                      <CVisionBadge C={C}
                        className={`text-xs ${
                          RATING_BADGE_COLORS[
                            p.rating === 'Needs Improvement'
                              ? 'NEEDS_IMPROVEMENT'
                              : 'UNSATISFACTORY'
                          ] || ''
                        }`}
                      >
                        {p.rating}
                      </CVisionBadge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
          <Inbox style={{ height: 40, width: 40, marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Select a review cycle to view reports.
          </p>
        </div>
      )}
    </div>
  );
}
