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
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Heart, PlayCircle } from 'lucide-react';

const CULTURE_COLORS: Record<string, string> = { clan: '#3b82f6', adhocracy: '#8b5cf6', market: '#ef4444', hierarchy: '#f59e0b' };
const CULTURE_LABELS: Record<string, string> = { clan: 'Clan (Collaborate)', adhocracy: 'Adhocracy (Create)', market: 'Market (Compete)', hierarchy: 'Hierarchy (Control)' };
const CULTURE_LABELS_AR: Record<string, string> = { clan: 'تعاون', adhocracy: 'ابتكار', market: 'تنافس', hierarchy: 'نظام' };

function CultureBar({ C, type, current, desired, tr }: { C: any; type: string; current: number; desired: number; tr: (ar: string, en: string) => string }) {
  const color = CULTURE_COLORS[type] || '#888';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 144, fontSize: 12, fontWeight: 500, color: C.text }}>{tr(CULTURE_LABELS_AR[type], CULTURE_LABELS[type])}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 40, fontSize: 10, color: C.textMuted }}>{tr('الآن', 'Now')}</span>
        <div style={{ flex: 1, background: C.barTrack, borderRadius: 99, height: 12, overflow: 'hidden' }}>
          <div style={{ height: 12, borderRadius: 99, width: `${current}%`, backgroundColor: color, transition: 'width 0.3s' }} />
        </div>
        <span style={{ width: 32, fontSize: 12, fontWeight: 700, color: C.text }}>{current}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 40, fontSize: 10, color: C.textMuted }}>{tr('الهدف', 'Goal')}</span>
        <div style={{ flex: 1, background: C.barTrack, borderRadius: 99, height: 12, overflow: 'hidden' }}>
          <div style={{ height: 12, borderRadius: 99, width: `${desired}%`, backgroundColor: color, opacity: 0.5, transition: 'width 0.3s' }} />
        </div>
        <span style={{ width: 32, fontSize: 12, fontWeight: 700, color: C.text }}>{desired}%</span>
      </div>
    </div>
  );
}

export default function CulturePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [scoring, setScoring] = useState(false);
  const [profile, setProfile] = useState({ clan: 25, adhocracy: 25, market: 25, hierarchy: 25 });
  const [desired, setDesired] = useState({ clan: 30, adhocracy: 30, market: 20, hierarchy: 20 });

  const { data: latestRaw, isLoading: latestLoading, refetch: refetchLatest } = useQuery({
    queryKey: cvisionKeys.culture.list({ action: 'latest' }),
    queryFn: async () => {
      const l = await cvisionFetch<any>('/api/cvision/culture', { params: { action: 'latest' } });
      if (l.ok && l.data) { setProfile(l.data.currentProfile || profile); setDesired(l.data.desiredProfile || desired); }
      return l;
    },
  });
  const { data: historyRaw, isLoading: historyLoading } = useQuery({
    queryKey: cvisionKeys.culture.list({ action: 'history' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/culture', { params: { action: 'history' } }),
  });

  const latest = latestRaw?.ok ? latestRaw.data : null;
  const history = historyRaw?.ok ? historyRaw.data || [] : [];
  const loading = latestLoading || historyLoading;

  const refetchAll = () => { refetchLatest(); };

  const startMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/culture', 'POST', { action: 'start' }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('بدأ تقييم الثقافة', 'Culture assessment started')), setScoring(true), refetchAll()) : toast.error(d.error); },
  });

  const completeMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/culture', 'POST', { action: 'complete', assessmentId: latest?.assessmentId, cultureDimensions: profile, desiredProfile: desired }),
    onSuccess: (d) => { d.ok ? (toast.success(`${tr('الفجوة', 'Gap')}: ${d.data.cultureGap}%, ${tr('النوع السائد', 'Dominant')}: ${d.data.dominantType}`), setScoring(false), refetchAll()) : toast.error(d.error); },
  });

  const startAssessment = () => startMutation.mutate();
  const completeAssessment = () => { if (!latest) return; completeMutation.mutate(); };

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const cTypes = ['clan', 'adhocracy', 'market', 'hierarchy'] as const;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('تقييم الثقافة', 'Culture Assessment')}
        titleEn={isRTL ? 'Culture Assessment' : undefined}
        icon={Heart}
        iconColor="#ec4899"
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={PlayCircle} onClick={startAssessment}>
            {tr('تقييم جديد', 'New Assessment')}
          </CVisionButton>
        }
      />

      {latest && latest.status === 'COMPLETED' && (
        <CVisionStatsRow>
          <CVisionMiniStat C={C} label={tr('درجة التوافق', 'Alignment Score')} value={`${latest.overallScore || 0}%`} icon={Heart} color="#ec4899" colorDim={isDark ? '#ec489920' : '#fce7f3'} />
          <CVisionCard C={C} style={{ flex: '1 1 140px' }}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.orange }}>{latest.cultureGap || 0}%</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('فجوة الثقافة', 'Culture Gap')}</div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C} style={{ flex: '1 1 200px' }}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                {cTypes.map(t => (
                  <span key={t} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: CULTURE_COLORS[t] + '20', color: CULTURE_COLORS[t], fontWeight: 500 }}>
                    {t}: {latest.currentProfile?.[t] || 0}%
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{tr('الملف الحالي', 'Current Profile')}</div>
            </CVisionCardBody>
          </CVisionCard>
        </CVisionStatsRow>
      )}

      {(scoring || (latest && latest.status === 'IN_PROGRESS')) && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تحديد الملف الثقافي (وزّع 100 نقطة)', 'Set Culture Profile (distribute 100 points)')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 10 }}>{tr('الملف الحالي', 'Current Profile')}</h4>
                {cTypes.map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 96, fontSize: 12, color: C.text }}>{tr(CULTURE_LABELS_AR[t], CULTURE_LABELS[t]?.split('(')[0])}</span>
                    <input type="range" min="0" max="100" style={{ flex: 1 }} value={profile[t]} onChange={e => setProfile({ ...profile, [t]: parseInt(e.target.value) })} />
                    <span style={{ width: 32, fontSize: 12, fontWeight: 700, color: C.text }}>{profile[t]}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: C.textMuted }}>{tr('المجموع', 'Total')}: {cTypes.reduce((s, t) => s + profile[t], 0)}</div>
              </div>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 10 }}>{tr('الملف المرغوب', 'Desired Profile')}</h4>
                {cTypes.map(t => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 96, fontSize: 12, color: C.text }}>{tr(CULTURE_LABELS_AR[t], CULTURE_LABELS[t]?.split('(')[0])}</span>
                    <input type="range" min="0" max="100" style={{ flex: 1 }} value={desired[t]} onChange={e => setDesired({ ...desired, [t]: parseInt(e.target.value) })} />
                    <span style={{ width: 32, fontSize: 12, fontWeight: 700, color: C.text }}>{desired[t]}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: C.textMuted }}>{tr('المجموع', 'Total')}: {cTypes.reduce((s, t) => s + desired[t], 0)}</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <CVisionButton C={C} isDark={isDark} variant="primary" onClick={completeAssessment}>{tr('اكمال التقييم', 'Complete Assessment')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {latest && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الملف الثقافي: الحالي مقابل المرغوب', 'Culture Profile: Current vs Desired')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {cTypes.map(t => <CultureBar key={t} C={C} type={t} current={latest.currentProfile?.[t] || 0} desired={latest.desiredProfile?.[t] || 0} tr={tr} />)}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {latest?.transformationPlan?.initiatives?.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مبادرات التحول', 'Transformation Initiatives')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {latest.transformationPlan.initiatives.map((i: any) => (
              <div key={i.initiativeId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontWeight: 500, color: C.text }}>{i.title}</span>
                <CVisionBadge C={C} variant={i.status === 'ACTIVE' ? 'success' : 'muted'}>{i.status}</CVisionBadge>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textSecondary }}>{i.progress}%</span>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
