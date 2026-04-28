'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Timer, Play, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';

export default function CronPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();

  const [running, setRunning] = useState<string | null>(null);

  const { data: cronData } = useQuery({
    queryKey: cvisionKeys.admin.cron.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/cron', { params: { action: 'status' } }),
  });
  const jobs = cronData?.ok ? (cronData.data || []) : [];

  const runMutation = useMutation({
    mutationFn: (jobName: string) => cvisionMutate<any>('/api/cvision/cron', 'POST', { action: 'run', job: jobName }),
    onMutate: (jobName) => setRunning(jobName),
    onSettled: () => { setRunning(null); queryClient.invalidateQueries({ queryKey: cvisionKeys.admin.cron.all }); },
  });

  const runNow = (jobName: string) => runMutation.mutate(jobName);

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('المهام المجدولة', 'Scheduled Jobs')} titleEn="Scheduled Jobs" icon={Timer} iconColor={C.orange} isRTL={isRTL} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {jobs.map(j => (
          <CVisionCard C={C} key={j.name}>
            <CVisionCardBody style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 500, fontSize: 13, fontFamily: 'monospace', color: C.text }}>{j.name}</span>
                    <CVisionBadge C={C} variant={j.enabled ? 'success' : 'muted'}>{j.enabled ? tr('مفعل', 'Enabled') : tr('معطل', 'Disabled')}</CVisionBadge>
                    {j.lastStatus === 'SUCCESS' && <CheckCircle size={16} color={C.green} />}
                    {j.lastStatus === 'FAILED' && <XCircle size={16} color={C.red} />}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary }}>{j.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, fontSize: 11, color: C.textMuted }}>
                    <span style={{ fontFamily: 'monospace' }}>{j.schedule}</span>
                    {j.lastRun && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} />{new Date(j.lastRun).toLocaleString()}</span>}
                    {j.lastDuration != null && <span>{j.lastDuration}ms</span>}
                    {j.lastItems != null && <span>{j.lastItems} {tr('عنصر', 'items')}</span>}
                  </div>
                </div>
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => runNow(j.name)} disabled={running === j.name} icon={running === j.name ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}>
                  {tr('تشغيل الآن', 'Run Now')}
                </CVisionButton>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
