'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ER_ORDER_SETS } from '@/lib/er/orderSets';
import { ErPageShell } from '@/components/er/ErPageShell';
import { ErStatusPill } from '@/components/er/ErStatusPill';

export default function ERDoctor() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading } = useRoutePermission('/er/doctor');
  const [tab, setTab] = useState<'my' | 'results' | 'notes' | 'decision'>('my');
  const { me } = useMe();
  const { toast } = useToast();
  const roleLower = String(me?.user?.role || '').toLowerCase();
  const isDev = roleLower.includes('admin') || roleLower.includes('charge');
  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
  const [showAll, setShowAll] = useState(false);
  const [resultsShowAll, setResultsShowAll] = useState(false);
  const [showAcked24h, setShowAcked24h] = useState(false);
  const [ackingTaskId, setAckingTaskId] = useState<string | null>(null);
  const [decisionShowAll, setDecisionShowAll] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState<'ready' | 'blocked' | 'all'>('ready');

  const myPatientsUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (isDev && showAll) qs.set('showAll', '1');
    const q = qs.toString();
    return `/api/er/doctor/my-patients${q ? `?${q}` : ''}`;
  }, [isDev, showAll]);

  const { data: myData, isLoading: myLoading } = useSWR(
    hasPermission && tab === 'my' ? myPatientsUrl : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const myRows = Array.isArray(myData?.items) ? myData.items : [];

  const resultsUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (isDev && resultsShowAll) qs.set('showAll', '1');
    if (showAcked24h) qs.set('showAcked', '1');
    const q = qs.toString();
    return `/api/er/doctor/results${q ? `?${q}` : ''}`;
  }, [isDev, resultsShowAll, showAcked24h]);

  const { data: resultsData, isLoading: resultsLoading, mutate: mutateResults } = useSWR(
    hasPermission && tab === 'results' ? resultsUrl : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const resultRows = Array.isArray(resultsData?.items) ? resultsData.items : [];

  const decisionUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (isDev && decisionShowAll) qs.set('showAll', '1');
    const q = qs.toString();
    return `/api/er/doctor/decision-queue${q ? `?${q}` : ''}`;
  }, [isDev, decisionShowAll]);

  const { data: decisionData, isLoading: decisionLoading } = useSWR(
    hasPermission && tab === 'decision' ? decisionUrl : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const decisionRowsAll = Array.isArray(decisionData?.items) ? decisionData.items : [];
  const decisionRows = useMemo(() => {
    if (decisionFilter === 'all') return decisionRowsAll;
    if (decisionFilter === 'ready') return decisionRowsAll.filter((r: any) => Boolean(r.readyForDecision));
    return decisionRowsAll.filter((r: any) => Boolean(r.blocked));
  }, [decisionRowsAll, decisionFilter]);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const ackResult = async (taskId: string) => {
    setAckingTaskId(taskId);
    try {
      const res = await fetch('/api/er/doctor/results/ack', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr('فشل التأكيد', 'Failed to acknowledge'));
      toast({ title: tr('نجاح', 'Success'), description: tr('تم تأكيد النتيجة.', 'Result acknowledged.') });
      await mutateResults();
    } catch (err: any) {
      toast({ title: tr('خطأ', 'Error'), description: err?.message || tr('فشلت العملية', 'Failed'), variant: 'destructive' as const });
    } finally {
      setAckingTaskId(null);
    }
  };

  return (
    <ErPageShell isRTL={isRTL} title={tr('مركز طبيب الطوارئ', 'ER Doctor Hub')} subtitle={tr('عرض مركّز للمرضى النشطين والقرارات.', 'Focused view for active ER patients and decisions.')}>
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['my', 'results', 'decision'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-sm font-bold thea-transition-fast ${
              tab === t
                ? 'bg-primary text-white shadow-sm'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {t === 'my' ? tr('مرضاي', 'My Patients') : t === 'results' ? tr('النتائج', 'Results') : tr('قائمة القرارات', 'Decision Queue')}
          </button>
        ))}
      </div>

      {/* My Patients tab */}
      {tab === 'my' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-base">{tr('مرضاي', 'My Patients')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr('الزيارات التي أنت فيها الطبيب المسؤول أو سبق أن حددت المريض كـ"تمت المعاينة".', 'Visits where you are Primary Doctor, or you previously marked the patient as Seen.')}
                </p>
              </div>
              {isDev && (
                <div className="flex items-center gap-2">
                  <Switch checked={showAll} onCheckedChange={(v) => setShowAll(Boolean(v))} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('عرض الكل (مطور)', 'Show all (dev)')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-5 space-y-3">
            {myLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل…', 'Loading…')}</div>}

            {!myLoading && myRows.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  {tr('لم يتم العثور على زيارات ضمن نطاقك كطبيب مسؤول حتى الآن.', 'No visits found for your doctor-of-record scope yet.')}
                </div>
                <Link
                  className="inline-flex items-center text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                  href="/er/board"
                >
                  {tr('عرض جميع مرضى الطوارئ', 'View all ER patients')}
                </Link>
              </div>
            )}

            {!myLoading && myRows.length > 0 && (
              <div>
                {/* Header row */}
                <div className="grid grid-cols-6 gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الفرز', 'Triage')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السرير', 'Bed')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العلامات', 'Flags')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-end">{tr('إجراء', 'Action')}</span>
                </div>
                {/* Data rows */}
                {myRows.map((r: any) => {
                  const mrn = r.mrn || r.tempMrn || '—';
                  return (
                    <div key={r.encounterId} className="grid grid-cols-6 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                      <div>
                        <div className="font-medium">{r.patientName || tr('غير معروف', 'Unknown')}</div>
                        <div className="text-xs text-muted-foreground">{tr('رقم الملف', 'MRN')}: {mrn}</div>
                        <div className="text-xs text-muted-foreground">{tr('زيارة الطوارئ', 'ER Visit')}: {r.visitNumber || 'ER-—'}</div>
                        <div className="text-xs text-muted-foreground">{tr('زيارة الطوارئ', 'ER Visit')}: {r.visitNumber || 'ER-—'}</div>
                      </div>
                      <div className="flex items-center">
                        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">
                          {tr('فرز', 'Triage')} {r.triageLevel ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <ErStatusPill status={String(r.status || '—')} />
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">{r.bedLabel || '—'}</div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {r.resultsPendingReview && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('نتائج معلقة', 'Results pending')}
                          </span>
                        )}
                        {r.sepsisSuspected && (
                          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('إنتان', 'Sepsis')}
                          </span>
                        )}
                        {r.hasOpenEscalation && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('تصعيد', 'Escalation')}
                          </span>
                        )}
                        {r.transferRequested && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('نقل', 'Transfer')}
                          </span>
                        )}
                        {r.vitalsOverdue && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('العلامات الحيوية متأخرة', 'Vitals overdue')}
                          </span>
                        )}
                        {r.tasksOverdue && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('المهام متأخرة', 'Tasks overdue')}
                          </span>
                        )}
                        {r.respiratoryDecision && r.respiratoryDecision !== 'NO' && (
                          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('تنفسي', 'Respiratory')} {r.respiratoryDecision === 'ISOLATE' ? tr('عزل', 'Isolate') : tr('احتياطات', 'Precautions')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end">
                        <Link
                          className="inline-flex items-center text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                          href={`/er/encounter/${r.encounterId}`}
                        >
                          {tr('فتح الزيارة', 'Open Visit')}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results tab */}
      {tab === 'results' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-base">{tr('النتائج', 'Results')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr('العرض الافتراضي يظهر المهام المكتملة التي تحتاج تأكيد (ACK أولاً).', 'Default view shows DONE tasks that need acknowledgment (ACK-first).')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {isDev && (
                  <div className="flex items-center gap-2">
                    <Switch checked={resultsShowAll} onCheckedChange={(v) => setResultsShowAll(Boolean(v))} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('عرض الكل (مطور)', 'Show all (dev)')}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch checked={showAcked24h} onCheckedChange={(v) => setShowAcked24h(Boolean(v))} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('عرض المؤكدة (24 ساعة)', 'Show acknowledged (24h)')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {resultsLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل…', 'Loading…')}</div>}

            {!resultsLoading && resultRows.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-md border p-4 text-sm text-muted-foreground">
                  {tr('لا توجد نتائج تنتظر التأكيد.', 'No results pending acknowledgment.')}
                </div>
                <Link
                  className="inline-flex items-center text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                  href="/er/board"
                >
                  {tr('عرض جميع مرضى الطوارئ', 'View all ER patients')}
                </Link>
              </div>
            )}

            {!resultsLoading && resultRows.length > 0 && (
              <div>
                {/* Header row */}
                <div className="grid grid-cols-6 gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السرير', 'Bed')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النتيجة', 'Result')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('مجموعة الطلبات', 'Order set')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العمر', 'Age')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-end">{tr('إجراءات', 'Actions')}</span>
                </div>
                {/* Data rows */}
                {resultRows.map((r: any) => {
                  const mrn = r.mrn || r.tempMrn || '—';
                  const age = r.ageMinutes == null ? '—' : `${r.ageMinutes}m`;
                  const setTitle =
                    r.orderSetKey
                      ? (ER_ORDER_SETS.find((s) => s.key === r.orderSetKey)?.title || r.orderSetKey)
                      : '—';
                  const busy = ackingTaskId === r.taskId;
                  return (
                    <div key={r.taskId} className="grid grid-cols-6 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                      <div>
                        <div className="font-medium">{r.patientName || tr('غير معروف', 'Unknown')}</div>
                        <div className="text-xs text-muted-foreground">{tr('رقم الملف', 'MRN')}: {mrn}</div>
                        <div className="text-xs text-muted-foreground">{tr('زيارة الطوارئ', 'ER Visit')}: {r.visitNumber || 'ER-—'}</div>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">{r.bedLabel || '—'}</div>
                      <div>
                        <div className="font-medium">{r.taskName || '—'}</div>
                        <div className="text-xs text-muted-foreground">{r.kind || '—'}</div>
                        {!r.needsAck && r.resultAcknowledgedAt && (
                          <div className="text-xs text-muted-foreground">
                            {tr('تأكيد:', 'Ack:')} {new Date(r.resultAcknowledgedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">{setTitle}</div>
                      <div className="flex items-center text-xs text-muted-foreground">{age}</div>
                      <div className="flex items-center justify-end">
                        <div className="inline-flex flex-wrap gap-2 justify-end">
                          {r.needsAck && (
                            <button
                              className="text-[11px] px-3 py-1.5 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                              disabled={busy}
                              onClick={() => ackResult(r.taskId)}
                            >
                              ACK
                            </button>
                          )}
                          <Link
                            className="inline-flex items-center text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                            href={`/er/encounter/${r.encounterId}`}
                          >
                            {tr('فتح الزيارة', 'Open Visit')}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision Queue tab */}
      {tab === 'decision' && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold text-base">{tr('قائمة القرارات', 'Decision Queue')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr('قائمة للقراءة فقط لجاهزية القرار (عوائق محددة).', 'Read-only queue for decision readiness (deterministic blockers).')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  {(['ready', 'blocked', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setDecisionFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold thea-transition-fast ${
                        decisionFilter === f
                          ? 'bg-primary text-white shadow-sm'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {f === 'ready' ? tr('جاهز', 'Ready') : f === 'blocked' ? tr('معطل', 'Blocked') : tr('الكل', 'All')}
                    </button>
                  ))}
                </div>
                {isDev && (
                  <div className="flex items-center gap-2">
                    <Switch checked={decisionShowAll} onCheckedChange={(v) => setDecisionShowAll(Boolean(v))} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('عرض الكل (مطور)', 'Show all (dev)')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            {decisionLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل…', 'Loading…')}</div>}

            {!decisionLoading && decisionRows.length === 0 && (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                {tr('لا توجد زيارات تنتظر قراراً. جميع الحالات النشطة محلولة أو تم قبولها.', 'No visits awaiting decision. All active cases are resolved or admitted.')}
              </div>
            )}

            {!decisionLoading && decisionRows.length > 0 && (
              <div>
                {/* Header row */}
                <div className="grid grid-cols-5 gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السرير', 'Bed')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('العوائق', 'Blockers')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-end">{tr('إجراء', 'Action')}</span>
                </div>
                {/* Data rows */}
                {decisionRows.map((r: any) => {
                  const mrn = r.mrn || r.tempMrn || '—';
                  return (
                    <div key={r.encounterId} className="grid grid-cols-5 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                      <div>
                        <div className="font-medium">{r.patientName || tr('غير معروف', 'Unknown')}</div>
                        <div className="text-xs text-muted-foreground">{tr('رقم الملف', 'MRN')}: {mrn}</div>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">{r.bedLabel || '—'}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ErStatusPill status={String(r.status || '—')} />
                        {r.moveToDecisionSuggested && r.status !== 'DECISION' && (
                          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('نقل للقرار', 'Move to Decision')}
                          </span>
                        )}
                        {r.readyForDecision && (
                          <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('جاهز', 'Ready')}
                          </span>
                        )}
                        {r.blocked && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('معطل', 'Blocked')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {(r.unackedResultsCount || 0) > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('نتائج غير مؤكدة', 'Unacked results')} ({r.unackedResultsCount})
                          </span>
                        )}
                        {(r.pendingTasksCount || 0) > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('مهام معلقة', 'Pending tasks')} ({r.pendingTasksCount})
                          </span>
                        )}
                        {r.hasOpenEscalation && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('تصعيد', 'Escalation')}
                          </span>
                        )}
                        {r.transferRequested && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('نقل', 'Transfer')}
                          </span>
                        )}
                        {r.vitalsOverdue && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('العلامات الحيوية متأخرة', 'Vitals overdue')}
                          </span>
                        )}
                        {r.tasksOverdue && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                            {tr('المهام متأخرة', 'Tasks overdue')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end">
                        <Link
                          className="inline-flex items-center text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                          href={`/er/encounter/${r.encounterId}`}
                        >
                          {tr('فتح الزيارة', 'Open Visit')}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </ErPageShell>
  );
}
