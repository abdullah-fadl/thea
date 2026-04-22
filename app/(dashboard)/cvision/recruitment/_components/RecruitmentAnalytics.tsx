'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionSkeletonCard, CVisionSkeletonStyles , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useCallback, useEffect, useState } from 'react';

import {
  Users, Briefcase, CheckCircle, XCircle, Clock,
  TrendingUp, AlertTriangle, RefreshCw, BarChart3,
} from 'lucide-react';

interface Metrics {
  pipeline: { stage: string; stageName: string; count: number; color: string }[];
  timeToHire: { avgDays: number; byDepartment: { dept: string; avgDays: number }[] };
  sourceEffectiveness: { source: string; applied: number; hired: number; conversionRate: number }[];
  offerAcceptanceRate: number;
  openPositions: number;
  candidatesInPipeline: number;
  hiredThisMonth: number;
  rejectedThisMonth: number;
  slaBreaches: { stage: string; count: number; avgOverdueDays: number }[];
  avgDaysPerStage: { stage: string; avgDays: number }[];
}

export default function RecruitmentAnalytics() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch('/api/cvision/recruitment/pipeline?action=analytics', { credentials: 'include', signal });
      const data = await res.json();
      if (data.success) setMetrics(data.metrics);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { const ac = new AbortController(); load(ac.signal); return () => ac.abort(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 112 }}  />)}
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 256 }}  />
          <CVisionSkeletonCard C={C} height={200} style={{ height: 256 }}  />
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48, color: C.textMuted }}>
        <BarChart3 style={{ height: 40, width: 40, marginBottom: 12, opacity: 0.4 }} />
        <p>{tr('تعذر تحميل التحليلات', 'Could not load analytics')}</p>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ marginTop: 12 }} onClick={() => load()}>{tr('إعادة المحاولة', 'Retry')}</CVisionButton>
      </div>
    );
  }

  const totalInPipeline = metrics.pipeline.reduce((s, p) => s + p.count, 0);
  const maxStageCount = Math.max(...metrics.pipeline.map(p => p.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>{tr('تحليلات التوظيف', 'Recruitment Analytics')}</h2>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => load()}>
          <RefreshCw style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('تحديث', 'Refresh')}
        </CVisionButton>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.blueDim, borderRadius: 12 }}>
                <Users style={{ height: 20, width: 20, color: C.blue }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 700 }}>{metrics.candidatesInPipeline}</p>
                <p style={{ fontSize: 12, color: C.textMuted }}>{tr('في خط التوظيف', 'In Pipeline')}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.orangeDim, borderRadius: 12 }}>
                <Briefcase style={{ height: 20, width: 20, color: C.orange }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 700 }}>{metrics.openPositions}</p>
                <p style={{ fontSize: 12, color: C.textMuted }}>{tr('وظائف شاغرة', 'Open Positions')}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.greenDim, borderRadius: 12 }}>
                <CheckCircle style={{ height: 20, width: 20, color: C.green }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 700 }}>{metrics.hiredThisMonth}</p>
                <p style={{ fontSize: 12, color: C.textMuted }}>{tr('تم التوظيف (هذا الشهر)', 'Hired (This Month)')}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ paddingTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 8, background: C.purpleDim, borderRadius: 12 }}>
                <Clock style={{ height: 20, width: 20, color: C.purple }} />
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 700 }}>{metrics.timeToHire.avgDays || '—'}</p>
                <p style={{ fontSize: 12, color: C.textMuted }}>{tr('متوسط أيام التوظيف', 'Avg Days to Hire')}</p>
              </div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Pipeline Funnel */}
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('قمع التوظيف', 'Pipeline Funnel')}</div></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {metrics.pipeline.map(stage => (
                <div key={stage.stage} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: stage.color }} />
                      {stage.stageName}
                    </span>
                    <span style={{ fontWeight: 500 }}>{stage.count}</span>
                  </div>
                  <div style={{ height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                    <div
                      style={{ borderRadius: '50%', transition: 'all 0.2s', width: `${Math.max(2, (stage.count / maxStageCount) * 100)}%`, backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>

        {/* Source Effectiveness */}
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('فعالية المصادر', 'Source Effectiveness')}</div></CVisionCardHeader>
          <CVisionCardBody>
            {metrics.sourceEffectiveness.length === 0 ? (
              <p style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد بيانات مصادر بعد', 'No source data yet')}</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: C.textMuted, borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ textAlign: 'left', paddingTop: 8, paddingBottom: 8, fontWeight: 500 }}>{tr('المصدر', 'Source')}</th>
                      <th style={{ textAlign: 'right', paddingTop: 8, paddingBottom: 8, fontWeight: 500 }}>{tr('تقدموا', 'Applied')}</th>
                      <th style={{ textAlign: 'right', paddingTop: 8, paddingBottom: 8, fontWeight: 500 }}>{tr('تم التوظيف', 'Hired')}</th>
                      <th style={{ textAlign: 'right', paddingTop: 8, paddingBottom: 8, fontWeight: 500 }}>{tr('النسبة', 'Rate')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.sourceEffectiveness.map(s => (
                      <tr key={s.source} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ paddingTop: 8, paddingBottom: 8 }}>{s.source}</td>
                        <td style={{ textAlign: 'right', paddingTop: 8, paddingBottom: 8 }}>{s.applied}</td>
                        <td style={{ textAlign: 'right', paddingTop: 8, paddingBottom: 8 }}>{s.hired}</td>
                        <td style={{ textAlign: 'right', paddingTop: 8, paddingBottom: 8 }}>
                          <CVisionBadge C={C} variant={s.conversionRate >= 20 ? 'default' : 'secondary'} style={{ fontSize: 12 }}>
                            {s.conversionRate}%
                          </CVisionBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>

        {/* SLA Breaches */}
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle style={{ height: 16, width: 16, color: C.orange }} />
            {tr('انتهاكات اتفاقية مستوى الخدمة', 'SLA Breaches')}
          </div></CVisionCardHeader>
          <CVisionCardBody>
            {metrics.slaBreaches.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
                <CheckCircle style={{ height: 32, width: 32, marginBottom: 8, color: C.green, opacity: 0.6 }} />
                <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد انتهاكات', 'No SLA breaches')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {metrics.slaBreaches.map(breach => (
                  <div key={breach.stage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, background: C.orangeDim, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{breach.stage}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>{breach.count} {tr(breach.count !== 1 ? 'مرشحين متأخرين' : 'مرشح متأخر', breach.count !== 1 ? 'candidates overdue' : 'candidate overdue')}</p>
                    </div>
                    <CVisionBadge C={C} variant="danger" style={{ fontSize: 12 }}>+{breach.avgOverdueDays}{tr('ي متوسط', 'd avg')}</CVisionBadge>
                  </div>
                ))}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>

        {/* Offer Rate + More KPIs */}
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('المقاييس الرئيسية', 'Key Metrics')}</div></CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12 }}>
              <span style={{ fontSize: 13 }}>{tr('نسبة قبول العروض', 'Offer Acceptance Rate')}</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{metrics.offerAcceptanceRate || 0}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12 }}>
              <span style={{ fontSize: 13 }}>{tr('المرفوضون (هذا الشهر)', 'Rejected (This Month)')}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.red }}>{metrics.rejectedThisMonth}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12 }}>
              <span style={{ fontSize: 13 }}>{tr('الإجمالي في خط التوظيف', 'Total in Pipeline')}</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{totalInPipeline}</span>
            </div>
            {metrics.avgDaysPerStage.length > 0 && (
              <div style={{ paddingTop: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>{tr('متوسط الأيام لكل مرحلة', 'Avg Days per Stage')}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {metrics.avgDaysPerStage.map(s => (
                    <CVisionBadge C={C} key={s.stage} variant="outline" style={{ fontSize: 12 }}>
                      {s.stage}: {s.avgDays}{tr('ي', 'd')}
                    </CVisionBadge>
                  ))}
                </div>
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      </div>
    </div>
  );
}
