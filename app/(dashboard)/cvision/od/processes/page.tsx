'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Gauge, Clock, AlertTriangle, TrendingDown, Activity } from 'lucide-react';

function slaBarColor(rate: number, C: any): string { return rate >= 90 ? C.green : rate >= 70 ? C.orange : C.red; }

export default function ProcessesPage() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.analytics.list({ domain: 'process-analysis', action: 'dashboard' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/process-analysis', { params: { action: 'dashboard' } }),
  });

  const data = rawData?.ok ? rawData.data : null;

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const metrics = data?.processMetrics || [];
  const bottlenecks = data?.topBottlenecks || [];
  const eff = data?.overallEfficiency || 0;
  const gaugeColor = eff >= 80 ? C.green : eff >= 60 ? C.orange : C.red;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('فعالية العمليات', 'Process Effectiveness')}
        titleEn={isRTL ? 'Process Effectiveness' : undefined}
        icon={Activity}
        isRTL={isRTL}
      />

      <CVisionStatsRow>
        <CVisionCard C={C} style={{ flex: '1 1 200px' }}>
          <CVisionCardBody style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 8 }}>
              <svg viewBox="0 0 36 36" style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.barTrack} strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={gaugeColor} strokeWidth="3" strokeDasharray={`${eff} ${100 - eff}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.text }}>{eff}%</div>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{tr('الكفاءة الاجمالية', 'Overall Efficiency')}</div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionMiniStat C={C} label={tr('انواع العمليات المتتبعة', 'Process Types Tracked')} value={metrics.length} icon={Gauge} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('الاختناقات', 'Bottlenecks')} value={bottlenecks.length} icon={AlertTriangle} color={C.orange} colorDim={C.orangeDim} />
      </CVisionStatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {metrics.map((p: any) => (
          <CVisionCard key={p.processType} C={C}>
            <CVisionCardBody style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <CVisionBadge C={C} variant="muted">{p.processType}</CVisionBadge>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{p.totalInstances} {tr('حالة', 'instances')}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center', marginBottom: 10 }}>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.avgDuration}h</div><div style={{ fontSize: 10, color: C.textMuted }}>{tr('متوسط', 'Avg')}</div></div>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.medianDuration}h</div><div style={{ fontSize: 10, color: C.textMuted }}>{tr('وسيط', 'Median')}</div></div>
                <div><div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{p.p90Duration}h</div><div style={{ fontSize: 10, color: C.textMuted }}>P90</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={12} color={C.textMuted} />
                <span style={{ fontSize: 11, color: C.textSecondary }}>SLA: {p.slaTarget}h</span>
                <div style={{ flex: 1, background: C.barTrack, borderRadius: 99, height: 8, overflow: 'hidden' }}>
                  <div style={{ height: 8, borderRadius: 99, width: `${p.slaComplianceRate}%`, background: slaBarColor(p.slaComplianceRate, C), transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: slaBarColor(p.slaComplianceRate, C) }}>{p.slaComplianceRate}%</span>
              </div>
              {p.recommendations.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {p.recommendations.map((r: string, i: number) => (
                    <p key={i} style={{ fontSize: 10, color: C.orange }}>• {r}</p>
                  ))}
                </div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      {bottlenecks.length > 0 && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.orangeDim}` }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.orange }}>{tr('اهم الاختناقات', 'Top Bottlenecks')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            {bottlenecks.map((b: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                <TrendingDown size={14} color={C.red} />
                <CVisionBadge C={C} variant="muted">{b.process}</CVisionBadge>
                <span style={{ fontWeight: 500, color: C.text }}>{b.step}</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: C.red }}>{b.avgDelay}h {tr('تأخير متوسط', 'avg delay')}</span>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
