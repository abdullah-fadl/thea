'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton,
  CVisionBadge,
  CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Compass, ArrowRight, Activity, Heart, Gauge, Target, Users, Shield, Workflow as WorkflowIcon, XCircle } from 'lucide-react';

const METRIC_CONFIG: { key: string; labelAr: string; label: string; icon: any; color: string }[] = [
  { key: 'orgHealthScore', labelAr: 'صحة المنظمة', label: 'Org Health', icon: Activity, color: '#3b82f6' },
  { key: 'cultureScore', labelAr: 'الثقافة', label: 'Culture', icon: Heart, color: '#ec4899' },
  { key: 'processEfficiency', labelAr: 'العمليات', label: 'Process', icon: Gauge, color: '#f59e0b' },
  { key: 'employeeEngagement', labelAr: 'التفاعل', label: 'Engagement', icon: Users, color: '#16a34a' },
  { key: 'okrCompletion', labelAr: 'الاهداف', label: 'OKR', icon: Target, color: '#8b5cf6' },
  { key: 'talentReadiness', labelAr: 'المواهب', label: 'Talent', icon: Users, color: '#6366f1' },
  { key: 'changeAdoption', labelAr: 'التغيير', label: 'Change', icon: WorkflowIcon, color: '#14b8a6' },
  { key: 'complianceScore', labelAr: 'الامتثال', label: 'Compliance', icon: Shield, color: '#ef4444' },
];

const CHAIN_LINKS = [
  { key: 'strategyToStructure', from: 'Strategy', fromAr: 'الاستراتيجية', to: 'Structure', toAr: 'الهيكل' },
  { key: 'structureToCulture', from: 'Structure', fromAr: 'الهيكل', to: 'Culture', toAr: 'الثقافة' },
  { key: 'cultureToProcesses', from: 'Culture', fromAr: 'الثقافة', to: 'Processes', toAr: 'العمليات' },
  { key: 'processesToPeople', from: 'Processes', fromAr: 'العمليات', to: 'People', toAr: 'الاشخاص' },
  { key: 'peopleToResults', from: 'People', fromAr: 'الاشخاص', to: 'Results', toAr: 'النتائج' },
];

function chainColor(score: number): string { return score >= 80 ? '#16a34a' : score >= 60 ? '#3b82f6' : score >= 40 ? '#eab308' : '#dc2626'; }

export default function AlignmentPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [showStrategy, setShowStrategy] = useState(false);
  const [stratForm, setStratForm] = useState({ vision: '', visionAr: '', mission: '', missionAr: '' });

  const { data: rawData, isLoading: loading, refetch } = useQuery({
    queryKey: cvisionKeys.strategicAlignment.list({ action: 'dashboard' }),
    queryFn: async () => {
      const d = await cvisionFetch<any>('/api/cvision/strategic-alignment', { params: { action: 'dashboard' } });
      if (d.ok && d.data?.strategy) {
        setStratForm({ vision: d.data.strategy.vision || '', visionAr: d.data.strategy.visionAr || '', mission: d.data.strategy.mission || '', missionAr: d.data.strategy.missionAr || '' });
      }
      return d;
    },
  });

  const data = rawData?.ok ? rawData.data : null;

  const strategyMutation = useMutation({
    mutationFn: () => cvisionMutate('/api/cvision/strategic-alignment', 'POST', { action: 'set-strategy', ...stratForm }),
    onSuccess: (d: any) => {
      d.ok ? (toast.success(tr('تم حفظ الاستراتيجية', 'Strategy saved')), setShowStrategy(false), refetch()) : toast.error(d.error);
    },
  });

  const handleSetStrategy = () => strategyMutation.mutate();

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const snapshot = data?.dataSnapshot || {};
  const chain = data?.alignmentChain || {};
  const strategy = data?.strategy || {};
  const chainEntries = CHAIN_LINKS.map(l => ({ ...l, score: chain[l.key]?.score || 0 }));
  const weakest = chainEntries.length > 0 ? chainEntries.reduce((a, b) => a.score < b.score ? a : b) : null;
  const alignScore = data?.overallAlignmentScore || 0;
  const alignColor = alignScore >= 80 ? C.green : alignScore >= 60 ? C.blue : alignScore >= 40 ? C.orange : C.red;

  const alignVariant = () => {
    const l = data?.alignmentLevel;
    if (l === 'FULLY_ALIGNED') return 'success' as const;
    if (l === 'MOSTLY') return 'info' as const;
    if (l === 'PARTIALLY') return 'warning' as const;
    return 'danger' as const;
  };

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('التوافق الاستراتيجي', 'Strategic Alignment')}
        titleEn={isRTL ? 'Strategic Alignment' : undefined}
        icon={Compass}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant={showStrategy ? 'outline' : 'primary'} icon={showStrategy ? XCircle : Compass} onClick={() => setShowStrategy(!showStrategy)}>
            {showStrategy ? tr('الغاء', 'Cancel') : tr('تحديد الاستراتيجية', 'Set Strategy')}
          </CVisionButton>
        }
      />

      {(strategy.vision || strategy.mission) && (
        <CVisionCard C={C} style={{ background: isDark ? `linear-gradient(135deg, ${C.blueDim}, ${C.purpleDim})` : `linear-gradient(135deg, #eff6ff, #f5f3ff)`, border: `1px solid ${C.blueDim}` }}>
          <CVisionCardBody style={{ padding: 18 }}>
            {strategy.vision && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.blue, marginBottom: 2 }}>{tr('الرؤية', 'VISION')}</div>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{strategy.vision}</p>
                {strategy.visionAr && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }} dir="rtl">{strategy.visionAr}</p>}
              </div>
            )}
            {strategy.mission && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.purple, marginBottom: 2 }}>{tr('الرسالة', 'MISSION')}</div>
                <p style={{ fontSize: 13, color: C.text }}>{strategy.mission}</p>
                {strategy.missionAr && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }} dir="rtl">{strategy.missionAr}</p>}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {showStrategy && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تحديد الاستراتيجية', 'Define Strategy')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CVisionInput C={C} label={tr('الرؤية (EN)', 'Vision')} placeholder={tr('الرؤية', 'Vision')} value={stratForm.vision} onChange={e => setStratForm({ ...stratForm, vision: e.target.value })} />
              <CVisionInput C={C} label={tr('الرؤية', 'Vision (AR)')} placeholder={tr('الرؤية', 'Vision (Arabic)')} dir="rtl" value={stratForm.visionAr} onChange={e => setStratForm({ ...stratForm, visionAr: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CVisionInput C={C} label={tr('الرسالة (EN)', 'Mission')} placeholder={tr('الرسالة', 'Mission')} value={stratForm.mission} onChange={e => setStratForm({ ...stratForm, mission: e.target.value })} />
              <CVisionInput C={C} label={tr('الرسالة', 'Mission (AR)')} placeholder={tr('الرسالة', 'Mission (Arabic)')} dir="rtl" value={stratForm.missionAr} onChange={e => setStratForm({ ...stratForm, missionAr: e.target.value })} />
            </div>
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleSetStrategy}>{tr('حفظ', 'Save')}</CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <CVisionStatsRow>
        <CVisionCard C={C} style={{ flex: '1 1 200px' }}>
          <CVisionCardBody style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 8 }}>
              <svg viewBox="0 0 36 36" style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }}>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={C.barTrack} strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={alignColor} strokeWidth="3" strokeDasharray={`${alignScore} ${100 - alignScore}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.text }}>{alignScore}%</div>
            </div>
            <CVisionBadge C={C} variant={alignVariant()}>{data?.alignmentLevel || 'N/A'}</CVisionBadge>
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C} style={{ flex: '2 1 400px' }}>
          <CVisionCardBody style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary, marginBottom: 8 }}>{tr('سلسلة التوافق', 'Alignment Chain')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {chainEntries.map((link, i) => (
                <div key={link.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: C.textMuted }}>{tr(link.fromAr, link.from)}</div>
                    <div style={{ height: 12, borderRadius: 99, background: chainColor(link.score), width: '100%' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{link.score}%</div>
                  </div>
                  {i < chainEntries.length - 1 && <ArrowRight size={12} color={C.textMuted} style={{ flexShrink: 0 }} />}
                </div>
              ))}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.textMuted }}>{tr('النتائج', 'Results')}</div>
              </div>
            </div>
            {weakest && weakest.score < 60 && (
              <div style={{ marginTop: 8, fontSize: 10, color: C.red }}>
                {tr('اضعف رابط', 'Weakest link')}: {tr(weakest.fromAr, weakest.from)} → {tr(weakest.toAr, weakest.to)} ({weakest.score}%)
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      </CVisionStatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {METRIC_CONFIG.map(m => {
          const val = snapshot[m.key] ?? 0;
          const Icon = m.icon;
          const barBg = val >= 70 ? C.green : val >= 40 ? C.orange : C.red;
          return (
            <CVisionCard key={m.key} C={C}>
              <CVisionCardBody style={{ padding: 14, textAlign: 'center' }}>
                <Icon size={16} color={m.color} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{val}%</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{tr(m.labelAr, m.label)}</div>
                <div style={{ width: '100%', background: C.barTrack, borderRadius: 99, height: 6, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: 6, borderRadius: 99, width: `${val}%`, background: barBg }} />
                </div>
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
      </div>

      {(strategy.strategicObjectives || []).length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الاهداف الاستراتيجية', 'Strategic Objectives')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {strategy.strategicObjectives.map((o: any) => {
              const sv = o.status === 'ON_TRACK' ? 'success' as const : o.status === 'AT_RISK' ? 'warning' as const : 'danger' as const;
              return (
                <div key={o.objectiveId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <CVisionBadge C={C} variant={sv}>{o.status}</CVisionBadge>
                  <span style={{ flex: 1, fontWeight: 500, color: C.text }}>{o.title}</span>
                  <div style={{ width: 80, background: C.barTrack, borderRadius: 99, height: 8, overflow: 'hidden' }}>
                    <div style={{ height: 8, borderRadius: 99, background: C.blue, width: `${o.progress}%` }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 32, textAlign: 'right', color: C.text }}>{o.progress}%</span>
                </div>
              );
            })}
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
