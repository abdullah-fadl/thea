'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { Switch } from '@/components/ui/switch';

function toInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ERCommand() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { me } = useMe();
  const { hasPermission, isLoading } = useRoutePermission('/er/command');

  const tenantId = String(me?.tenantId || '');
  const email = String(me?.user?.email || '');
  const role = String(me?.user?.role || '');
  const canAccess = canAccessChargeConsole({ email, tenantId, role });
  const isDev = canAccess;

  const now = useMemo(() => new Date(), []);
  const fromDefault = useMemo(() => new Date(now.getTime() - 24 * 60 * 60 * 1000), [now]);
  const [from, setFrom] = useState(toInputValue(fromDefault));
  const [to, setTo] = useState(toInputValue(now));
  const [demoMode, setDemoMode] = useState(false);

  const url = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('from', new Date(from).toISOString());
    qs.set('to', new Date(to).toISOString());
    if (isDev && demoMode) qs.set('demo', '1');
    return `/api/er/command/overview?${qs.toString()}`;
  }, [from, to, isDev, demoMode]);

  const fetcher = (u: string) => fetch(u, { credentials: 'include' }).then((r) => r.json());
  const { data, isLoading: loading, mutate } = useSWR(
    hasPermission && canAccess ? url : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  if (!canAccess) {
    return (
      <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-extrabold text-base">{tr('لوحة قيادة الطوارئ', 'ER Command Board')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{tr('الوصول محدود لأدوار المسؤول/المشرف.', 'Access is limited to charge/supervisor/admin roles.')}</p>
            </div>
            <div className="p-5 text-sm text-muted-foreground">{tr('ممنوع.', 'Forbidden.')}</div>
          </div>
        </div>
      </div>
    );
  }

  const header = data?.headerCounts || {};
  const stageSummary = Array.isArray(data?.stageSummary) ? data.stageSummary : [];
  const bottlenecks = data?.bottlenecks || {};
  const sla = data?.sla || {};

  const renderBottleneckTable = (title: string, rows: any[]) => (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="font-extrabold text-base">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{tr('أعلى 10 (الأقدم أولاً).', 'Top 10 (oldest first).')}</p>
      </div>
      <div className="p-5">
        {!rows.length && <div className="text-sm text-muted-foreground">{tr('لا يوجد.', 'None.')}</div>}
        {!!rows.length && (
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
            {/* Header */}
            <div className="grid grid-cols-7 gap-3 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم الملف', 'MRN')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفرز', 'Triage')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السرير', 'Bed')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المدة', 'Age')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الشارات', 'Badges')}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('إجراء', 'Action')}</span>
            </div>
            {/* Rows */}
            {rows.map((r: any) => (
              <div key={r.encounterId} className="grid grid-cols-7 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                <div className="font-medium">{r.patientName || tr('غير معروف', 'Unknown')}</div>
                <div className="text-xs text-muted-foreground">
                  {r.mrn || '\u2014'}
                  <div className="text-[11px] text-muted-foreground">{tr('زيارة طوارئ:', 'ER Visit:')} {r.visitNumber || 'ER-\u2014'}</div>
                </div>
                <div className="text-xs text-muted-foreground">{r.triageLevel ?? '\u2014'}</div>
                <div className="text-xs text-muted-foreground">{r.bedLabel || '\u2014'}</div>
                <div className="text-xs text-muted-foreground">
                  {r.stageAgeMinutes == null ? '\u2014' : `${r.stageAgeMinutes}m`}
                </div>
                <div>
                  <div className="flex flex-wrap gap-2">
                    {r.vitalsOverdue && <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('تأخر العلامات الحيوية', 'Vitals overdue')}</span>}
                    {r.tasksOverdue && <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('تأخر المهام', 'Tasks overdue')}</span>}
                    {r.unackedResultsCount > 0 && <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('غير مؤكد', 'Unacked')}</span>}
                    {r.sepsisSuspected && <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">{tr('إنتان', 'Sepsis')}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <Link className="inline-flex items-center text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast" href={`/er/encounter/${r.encounterId}`}>{tr('فتح', 'Open')}</Link>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{tr('لوحة قيادة الطوارئ', 'ER Command Board')}</h1>
            <p className="text-sm text-muted-foreground">{tr('لوحة العمليات (حتمية؛ بطاقات + جداول).', 'Operations dashboard (deterministic; cards + tables).')}</p>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('من', 'From')}</span>
              <input type="datetime-local" className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إلى', 'To')}</span>
              <input type="datetime-local" className="w-full rounded-xl border-[1.5px] border-border bg-muted/30 px-3 py-2 text-sm thea-input-focus thea-transition-fast" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {isDev && (
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={demoMode} onCheckedChange={(v) => setDemoMode(Boolean(v))} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('وضع العرض', 'Demo Mode')}</span>
              </div>
            )}
            <div className="flex items-end">
              <button className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast" onClick={() => mutate()}>
                {tr('تحديث', 'Refresh')}
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}

        {!loading && (
          <>
            {isDev && demoMode && (
              <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-300 dark:border-red-900/40 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-extrabold text-base">{tr('وضع العرض مُفعّل', 'Demo Mode is ON')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr('جميع الإحصائيات والمراحل والاختناقات والتأخيرات وحسابات SLA محدودة بنطاق التاريخ المحدد.', 'All snapshot counts, stage ages, bottlenecks, overdue flags, and SLA calculations are limited to the selected date range.')}
                  </p>
                </div>
              </div>
            )}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-extrabold text-base">{tr('إحصائيات اللحظة', 'Snapshot counts')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDev && demoMode
                    ? tr('الإحصائية محسوبة ضمن نطاق التاريخ المحدد فقط.', 'Snapshot is computed strictly within the selected date range.')
                    : tr('لقطة العمليات النشطة الحالية.', 'Current active operational snapshot.')}
                </p>
              </div>
              <div className="p-5 grid gap-3 md:grid-cols-3">
                {[
                  [tr('إجمالي الزيارات النشطة', 'Total active visits'), header.totalActiveEncounters],
                  [tr('بانتظار الفرز', 'Waiting for triage'), header.waitingForTriage],
                  [tr('بانتظار سرير', 'Waiting for bed'), header.waitingForBed],
                  [tr('بانتظار طبيب', 'Waiting for doctor'), header.waitingForDoctor],
                  [tr('بانتظار مراجعة النتائج', 'Waiting for results review'), header.waitingForResults],
                  [tr('قرار معلق', 'Decision pending'), header.decisionPending],
                  [tr('تصعيدات مفتوحة', 'Open escalations'), header.openEscalationsCount],
                  [tr('علامات حيوية متأخرة', 'Overdue vitals'), header.overdueVitalsCount],
                  [tr('مهام متأخرة', 'Overdue tasks'), header.overdueTasksCount],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-muted/30 border border-border p-4 thea-hover-lift thea-transition-fast">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                    <div className="text-2xl font-extrabold mt-1">{value ?? '\u2014'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-extrabold text-base">{tr('ملخص المراحل', 'Stage summary')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{tr('العدد + متوسط المدة (دقائق) في المرحلة الحالية.', 'Count + median age (minutes) in current stage.')}</p>
              </div>
              <div className="p-5">
                {/* Header */}
                <div className="grid grid-cols-3 gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المرحلة', 'Stage')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العدد', 'Count')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('متوسط المدة (دقيقة)', 'Median age (min)')}</span>
                </div>
                {/* Rows */}
                {stageSummary.map((r: any) => (
                  <div key={r.stage} className="grid grid-cols-3 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                    <div className="font-medium">{r.stage}</div>
                    <div className="text-sm text-muted-foreground">{r.count ?? 0}</div>
                    <div className="text-sm text-muted-foreground">
                      {r.medianAgeMinutes == null ? '\u2014' : `${Math.round(r.medianAgeMinutes)}m`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {renderBottleneckTable(
                tr('أطول انتظار للفرز', 'Longest waiting for triage'),
                Array.isArray(bottlenecks.longestWaitingTriage) ? bottlenecks.longestWaitingTriage : []
              )}
              {renderBottleneckTable(
                tr('أطول انتظار لسرير', 'Longest waiting for bed'),
                Array.isArray(bottlenecks.longestWaitingBed) ? bottlenecks.longestWaitingBed : []
              )}
              {renderBottleneckTable(
                tr('أطول انتظار لطبيب', 'Longest waiting for doctor'),
                Array.isArray(bottlenecks.longestWaitingDoctor) ? bottlenecks.longestWaitingDoctor : []
              )}
              {renderBottleneckTable(
                tr('أطول انتظار لمراجعة النتائج', 'Longest waiting for results review'),
                Array.isArray(bottlenecks.longestWaitingResultsReview) ? bottlenecks.longestWaitingResultsReview : []
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-extrabold text-base">{tr('مخالفات SLA (النافذة)', 'SLA breaches (window)')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{tr('الأهداف: باب→فرز ≤10د، سرير→كشف ≤15د، مدة الإقامة للتنويم ≤4س.', 'Targets: Door→Triage ≤10m, Bed→Seen ≤15m, LOS Admit ≤4h.')}</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    [tr('باب→فرز', 'Door\u2192Triage'), sla.doorToTriage],
                    [tr('سرير→كشف', 'Bed\u2192Seen'), sla.bedToSeen],
                    [tr('مدة الإقامة (تنويم)', 'LOS (Admit)'), sla.losAdmit],
                  ].map(([label, obj]: any) => (
                    <div key={label} className="rounded-2xl bg-muted/30 border border-border p-4 thea-hover-lift thea-transition-fast">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
                      <div className="text-sm text-muted-foreground">
                        {tr('مخالفات:', 'Breaches:')} <span className="text-foreground font-medium">{obj?.breaches ?? 0}</span> /{' '}
                        <span className="text-foreground font-medium">{obj?.eligible ?? 0}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {tr('نسبة المخالفة:', 'Breach %:')} <span className="text-foreground font-medium">{obj?.breachPct ?? 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium">{tr('المخالفات النشطة الحالية (أعلى 10)', 'Current active breaches (top 10)')}</div>
                  {Array.isArray(sla.activeBreaches) && sla.activeBreaches.length ? (
                    <>
                      {/* Header */}
                      <div className="grid grid-cols-4 gap-3 px-4 py-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Type')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المدة', 'Age')}</span>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('إجراء', 'Action')}</span>
                      </div>
                      {/* Rows */}
                      {sla.activeBreaches.map((b: any) => (
                        <div key={`${b.breachType}:${b.encounterId}`} className="grid grid-cols-4 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                          <div className="text-xs text-muted-foreground">{b.breachType}</div>
                          <div className="font-medium">
                            {b.patientName || tr('غير معروف', 'Unknown')}
                            <div className="text-[11px] text-muted-foreground">{tr('زيارة طوارئ:', 'ER Visit:')} {b.visitNumber || 'ER-\u2014'}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{b.breachAgeMinutes}m</div>
                          <div className="text-right">
                            <Link className="inline-flex items-center text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast" href={`/er/encounter/${b.encounterId}`}>{tr('فتح', 'Open')}</Link>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">{tr('لا يوجد.', 'None.')}</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
