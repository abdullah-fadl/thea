'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton,
  CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Activity, TrendingUp, TrendingDown, Minus, PlayCircle, BarChart3 } from 'lucide-react';

const HEALTH_COLORS: Record<string, string> = { CRITICAL: '#dc2626', WEAK: '#f97316', DEVELOPING: '#eab308', STRONG: '#3b82f6', EXCELLENT: '#16a34a' };
const HEALTH_VARIANTS: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'default'> = { CRITICAL: 'danger', WEAK: 'warning', DEVELOPING: 'warning', STRONG: 'info', EXCELLENT: 'success' };
const TREND_ICONS: Record<string, any> = { IMPROVING: TrendingUp, DECLINING: TrendingDown, STABLE: Minus };
const DIMS = ['strategy', 'structure', 'culture', 'processes', 'people', 'rewards', 'communication', 'innovation', 'governance'];
const DIM_LABELS: Record<string, string> = { strategy: 'Strategy', structure: 'Structure', culture: 'Culture', processes: 'Processes', people: 'People', rewards: 'Rewards', communication: 'Communication', innovation: 'Innovation', governance: 'Governance' };
const DIM_LABELS_AR: Record<string, string> = { strategy: 'الاستراتيجية', structure: 'الهيكل', culture: 'الثقافة', processes: 'العمليات', people: 'الاشخاص', rewards: 'المكافآت', communication: 'التواصل', innovation: 'الابتكار', governance: 'الحوكمة' };

function barColor(score: number): string { return score >= 4.3 ? '#16a34a' : score >= 3.6 ? '#3b82f6' : score >= 3.0 ? '#eab308' : score >= 2.0 ? '#f97316' : '#dc2626'; }

export default function OrgHealthPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [scoring, setScoring] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  const { data: latestRaw, isLoading: latestLoading, refetch: refetchLatest } = useQuery({
    queryKey: cvisionKeys.orgHealth.list({ action: 'latest' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/org-health', { params: { action: 'latest' } }),
  });
  const { data: historyRaw, isLoading: historyLoading } = useQuery({
    queryKey: cvisionKeys.orgHealth.list({ action: 'history' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/org-health', { params: { action: 'history' } }),
  });

  const latest = latestRaw?.ok ? latestRaw.data : null;
  const history: any[] = historyRaw?.ok ? historyRaw.data || [] : [];
  const loading = latestLoading || historyLoading;

  const refetchAll = () => { refetchLatest(); };

  const startMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/org-health', 'POST', { action: 'start' }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('بدأ التقييم', 'Assessment started')), setScoring(true), refetchAll()) : toast.error(d.error); },
  });

  const startAssessment = () => startMutation.mutate();

  const handleSaveScores = async () => {
    if (!latest) return;
    const dims: any = { ...latest.dimensions };
    for (const [dim, score] of Object.entries(scores)) { if (dims[dim]) dims[dim].score = score; }
    await cvisionMutate('/api/cvision/org-health', 'POST', { action: 'save-draft', assessmentId: latest.assessmentId, dimensions: dims });
    toast.success(tr('تم حفظ الدرجات', 'Scores saved'));
  };

  const handleComplete = async () => {
    if (!latest) return;
    await handleSaveScores();
    const d = await cvisionMutate<any>('/api/cvision/org-health', 'POST', { action: 'complete', assessmentId: latest.assessmentId });
    d.ok ? (toast.success(`${tr('اكتمل التقييم', 'Assessment complete')}: ${d.data.healthLevel} (${d.data.overallScore})`), setScoring(false), refetchAll()) : toast.error(d.error);
  };

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const TrendIcon = latest ? TREND_ICONS[latest.trend] || Minus : Minus;
  const trendColor = latest?.trend === 'IMPROVING' ? C.green : latest?.trend === 'DECLINING' ? C.red : C.textMuted;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('صحة المنظمة', 'Organization Health')}
        titleEn={isRTL ? 'Organization Health' : undefined}
        icon={Activity}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={PlayCircle} onClick={startAssessment}>
            {tr('تقييم جديد', 'New Assessment')}
          </CVisionButton>
        }
      />

      {latest && latest.status === 'COMPLETED' && (
        <CVisionStatsRow>
          <CVisionCard C={C} style={{ flex: '1 1 200px' }}>
            <CVisionCardBody style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 8 }}>
                <svg viewBox="0 0 36 36" style={{ width: 96, height: 96, transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.barTrack} strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={HEALTH_COLORS[latest.healthLevel] || C.gold} strokeWidth="3" strokeDasharray={`${(latest.overallScore / 5) * 100} ${100 - (latest.overallScore / 5) * 100}`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{latest.overallScore}</span>
                  <span style={{ fontSize: 10, color: C.textMuted }}>/5.0</span>
                </div>
              </div>
              <CVisionBadge C={C} variant={HEALTH_VARIANTS[latest.healthLevel] || 'default'}>{latest.healthLevel}</CVisionBadge>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ flex: '1 1 200px' }}>
            <CVisionCardBody style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <TrendIcon size={32} color={trendColor} style={{ marginBottom: 4 }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{latest.trend}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{latest.previousScore != null ? `${tr('السابق', 'Previous')}: ${latest.previousScore}` : tr('اول تقييم', 'First assessment')}</div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ flex: '1 1 200px' }}>
            <CVisionCardBody style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{(latest.priorityAreas || []).length}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مناطق الاولوية', 'Priority Areas')}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{latest.period}</div>
            </CVisionCardBody>
          </CVisionCard>
        </CVisionStatsRow>
      )}

      {(scoring || (latest && latest.status === 'IN_PROGRESS')) && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تقييم الابعاد (1-5)', 'Score Dimensions (1-5)')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DIMS.map(dim => (
              <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 110, fontSize: 13, fontWeight: 500, color: C.text }}>{tr(DIM_LABELS_AR[dim], DIM_LABELS[dim])}</span>
                <input type="range" min="1" max="5" step="0.1" style={{ flex: 1 }} value={scores[dim] || latest?.dimensions?.[dim]?.score || 3} onChange={e => setScores({ ...scores, [dim]: parseFloat(e.target.value) })} />
                <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'right' }}>{(scores[dim] || latest?.dimensions?.[dim]?.score || 3).toFixed(1)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleSaveScores}>{tr('حفظ مسودة', 'Save Draft')}</CVisionButton>
              <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleComplete}>{tr('اكمال التقييم', 'Complete Assessment')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {latest && latest.dimensions && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color={C.gold} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('درجات الابعاد', 'Dimension Scores')}</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DIMS.map(dim => {
              const score = latest.dimensions[dim]?.score || 0;
              return (
                <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 110, fontSize: 13, color: C.text }}>{tr(DIM_LABELS_AR[dim], DIM_LABELS[dim])}</span>
                  <div style={{ flex: 1, background: C.barTrack, borderRadius: 99, height: 16, overflow: 'hidden' }}>
                    <div style={{ height: 16, borderRadius: 99, width: `${(score / 5) * 100}%`, background: barColor(score), transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ width: 32, fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'right' }}>{score.toFixed(1)}</span>
                </div>
              );
            })}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {latest?.priorityAreas?.length > 0 && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.redDim}` }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.red }}>{tr('مناطق الاولوية', 'Priority Areas')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {latest.priorityAreas.map((p: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ fontWeight: 500, color: C.text, textTransform: 'capitalize' }}>{p.dimension}</span>
                <CVisionBadge C={C} variant="danger">{p.currentScore} → {p.targetScore}</CVisionBadge>
                <CVisionBadge C={C} variant="muted">{p.interventionType}</CVisionBadge>
                <CVisionBadge C={C} variant="muted">{p.timeframe}</CVisionBadge>
                <div style={{ width: '100%', marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(p.suggestedActions || []).map((a: string, j: number) => (
                    <span key={j} style={{ fontSize: 10, background: C.bgSubtle, padding: '2px 6px', borderRadius: 6, color: C.textSecondary }}>{a}</span>
                  ))}
                </div>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {history.length > 1 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('السجل', 'History')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.map(h => (
              <div key={h.assessmentId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{h.assessmentId}</span>
                <CVisionBadge C={C} variant={HEALTH_VARIANTS[h.healthLevel] || 'default'}>{h.healthLevel}</CVisionBadge>
                <span style={{ fontWeight: 700, color: C.text }}>{h.overallScore?.toFixed(1)}</span>
                <CVisionBadge C={C} variant="muted">{h.status}</CVisionBadge>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{new Date(h.assessmentDate).toLocaleDateString()}</span>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
