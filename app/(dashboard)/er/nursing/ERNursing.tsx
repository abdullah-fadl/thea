'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Switch } from '@/components/ui/switch';
import { useMe } from '@/lib/hooks/useMe';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { evaluateCriticalVitals } from '@/lib/er/observations';
import { ErPageShell } from '@/components/er/ErPageShell';
import { ErStatusPill } from '@/components/er/ErStatusPill';

/* ────────────────────────────── helpers ────────────────────────────── */

function taskStatusPillClass(status: string) {
  if (status === 'DONE')
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (status === 'CANCELLED')
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (status === 'IN_PROGRESS') return 'bg-primary/10 text-primary';
  return 'border border-border text-foreground';
}

/* ═══════════════════════════════════════════════════════════════════ */

export default function ERNursing() {
  const { isRTL, language } = useLang();
  const { hasPermission, isLoading } = useRoutePermission('/er/nursing');
  const { me } = useMe();
  const { toast } = useToast();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [tab, setTab] = useState<'my' | 'tasks' | 'obs' | 'metrics'>('tasks');
  const [showAll, setShowAll] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [taskActionBusyId, setTaskActionBusyId] = useState<string | null>(null);
  const [cancelDialogTask, setCancelDialogTask] = useState<Record<string, unknown> | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelContext, setCancelContext] = useState<'console' | 'drawer'>('console');
  const [tasksDrawer, setTasksDrawer] = useState<{
    encounterId: string;
    patientName: string;
    mrn: string;
    visitNumber?: string | null;
  } | null>(null);

  const roleLower = String(me?.user?.role || '').toLowerCase();
  const isDev = roleLower.includes('admin') || roleLower.includes('charge');
  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

  const [obsShowAll, setObsShowAll] = useState(false);
  const obsEncountersUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (isDev && obsShowAll) qs.set('showAll', '1');
    const q = qs.toString();
    return `/api/er/nursing/my-patients${q ? `?${q}` : ''}`;
  }, [isDev, obsShowAll]);
  const { data: obsEncountersData, isLoading: obsEncountersLoading } = useSWR(
    hasPermission && tab === 'obs' ? obsEncountersUrl : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const obsEncounters = Array.isArray(obsEncountersData?.items) ? obsEncountersData.items : [];
  const [selectedObsEncounterId, setSelectedObsEncounterId] = useState<string>('');

  const selectedObsEncounter = useMemo(() => {
    return obsEncounters.find((e: Record<string, unknown>) => e.encounterId === selectedObsEncounterId) || null;
  }, [obsEncounters, selectedObsEncounterId]);

  const obsListUrl = useMemo(() => {
    if (!selectedObsEncounterId) return null;
    return `/api/er/nursing/encounters/${selectedObsEncounterId}/observations`;
  }, [selectedObsEncounterId]);
  const { data: obsListData, isLoading: obsListLoading, mutate: mutateObsList } = useSWR(
    hasPermission && tab === 'obs' && obsListUrl ? obsListUrl : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const obsRows = Array.isArray(obsListData?.items) ? obsListData.items : [];

  const [obsForm, setObsForm] = useState({
    systolic: '',
    diastolic: '',
    hr: '',
    rr: '',
    temp: '',
    spo2: '',
    painScore: '',
    avpu: '' as '' | 'A' | 'V' | 'P' | 'U',
  });
  const [obsSaving, setObsSaving] = useState(false);

  const obsCritical = useMemo(() => {
    const toNum = (v: string): number | null => {
      if (v.trim() === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return evaluateCriticalVitals({
      systolic: toNum(obsForm.systolic),
      diastolic: toNum(obsForm.diastolic),
      hr: toNum(obsForm.hr),
      rr: toNum(obsForm.rr),
      temp: toNum(obsForm.temp),
      spo2: toNum(obsForm.spo2),
      painScore: toNum(obsForm.painScore),
      avpu: obsForm.avpu || null,
    });
  }, [obsForm]);

  const saveObservation = async () => {
    if (!selectedObsEncounterId) return;
    setObsSaving(true);
    try {
      const res = await fetch('/api/er/nursing/observations', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterId: selectedObsEncounterId,
          systolic: obsForm.systolic,
          diastolic: obsForm.diastolic,
          hr: obsForm.hr,
          rr: obsForm.rr,
          temp: obsForm.temp,
          spo2: obsForm.spo2,
          painScore: obsForm.painScore,
          avpu: obsForm.avpu,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr('فشل حفظ الملاحظة', 'Failed to save observation'));
      toast({ title: tr('نجاح', 'Success'), description: tr('تم حفظ الملاحظة.', 'Observation saved.') });
      setObsForm({ systolic: '', diastolic: '', hr: '', rr: '', temp: '', spo2: '', painScore: '', avpu: '' });
      await mutateObsList();
    } catch (err: unknown) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err instanceof Error ? err.message : tr('فشل حفظ الملاحظة', 'Failed to save observation'),
        variant: 'destructive' as const,
      });
    } finally {
      setObsSaving(false);
    }
  };

  const myPatientsUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (isDev && showAll) qs.set('showAll', '1');
    const q = qs.toString();
    return `/api/er/nursing/my-patients${q ? `?${q}` : ''}`;
  }, [isDev, showAll]);

  const { data: myData, isLoading: myLoading, mutate: mutateMy } = useSWR(
    hasPermission && tab === 'my' ? myPatientsUrl : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  const rows = Array.isArray(myData?.items) ? myData.items : [];

  const tasksUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (isDev && showAllTasks) qs.set('showAll', '1');
    const q = qs.toString();
    return `/api/er/nursing/tasks${q ? `?${q}` : ''}`;
  }, [isDev, showAllTasks]);

  const { data: tasksData, isLoading: tasksLoading, mutate: mutateTasks } = useSWR(
    hasPermission && tab === 'tasks' ? tasksUrl : null,
    fetcher,
    { refreshInterval: 5000 }
  );
  const taskRows = Array.isArray(tasksData?.items) ? tasksData.items : [];

  const defaultTo = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => new Date(defaultTo.getTime() - 24 * 60 * 60000), [defaultTo]);
  const toInputValue = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [metricsFrom, setMetricsFrom] = useState<string>(toInputValue(defaultFrom));
  const [metricsTo, setMetricsTo] = useState<string>(toInputValue(defaultTo));

  const metricsUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (metricsFrom) qs.set('from', new Date(metricsFrom).toISOString());
    if (metricsTo) qs.set('to', new Date(metricsTo).toISOString());
    return `/api/er/nursing/metrics?${qs.toString()}`;
  }, [metricsFrom, metricsTo]);
  const { data: metricsData, isLoading: metricsLoading, mutate: mutateMetrics } = useSWR(
    hasPermission && tab === 'metrics' ? metricsUrl : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const drawerTasksUrl = useMemo(() => {
    if (!tasksDrawer?.encounterId) return null;
    return `/api/er/nursing/encounters/${tasksDrawer.encounterId}/tasks`;
  }, [tasksDrawer?.encounterId]);

  const { data: drawerTasksData, isLoading: drawerTasksLoading, mutate: mutateDrawerTasks } = useSWR(
    drawerTasksUrl,
    fetcher,
    { refreshInterval: tasksDrawer ? 5000 : 0 }
  );
  const drawerTaskRows = Array.isArray(drawerTasksData?.items) ? drawerTasksData.items : [];

  const taskStatusVariant = (status: string) => {
    if (status === 'DONE') return 'secondary';
    if (status === 'CANCELLED') return 'destructive';
    if (status === 'IN_PROGRESS') return 'default';
    return 'outline';
  };

  const postTaskAction = async (
    taskId: string,
    action: 'START' | 'COMPLETE' | 'CANCEL',
    extra?: { cancelReason?: string; afterMutate?: Array<() => unknown> }
  ) => {
    setTaskActionBusyId(taskId);
    try {
      const res = await fetch('/api/er/nursing/tasks/status', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action, cancelReason: extra?.cancelReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tr('فشل تنفيذ الإجراء', 'Action failed'));
      toast({
        title: tr('نجاح', 'Success'),
        description: language === 'ar' ? `تم تحديث المهمة: ${action}` : `Task ${action.toLowerCase()}d.`,
      });
      if (extra?.afterMutate?.length) {
        await Promise.all(extra.afterMutate.map((fn) => Promise.resolve(fn())));
      } else {
        await mutateTasks();
      }
    } catch (err: unknown) {
      toast({
        title: tr('خطأ', 'Error'),
        description: err instanceof Error ? err.message : tr('فشل تنفيذ الإجراء', 'Action failed'),
        variant: 'destructive' as const,
      });
    } finally {
      setTaskActionBusyId(null);
    }
  };

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  return (
    <>
      <ErPageShell
        isRTL={isRTL}
        title={tr('مركز تمريض الطوارئ', 'ER Nursing Hub')}
        subtitle={tr('مساحة عمل مركزة على المهام لإجراءات التمريض والمؤقتات.', 'Task-focused workspace for nursing actions and timers.')}
      >
        {/* ── Tab pills ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['tasks', 'my', 'obs', 'metrics'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-bold thea-transition-fast ${
                tab === t
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'tasks' ? tr('المهام', 'Tasks') : t === 'my' ? tr('مرضاي', 'My Patients') : t === 'obs' ? tr('الملاحظات', 'Observations') : tr('المقاييس', 'Metrics')}
            </button>
          ))}
        </div>

        {/* ════════════════════ My Patients tab ════════════════════ */}
        {tab === 'my' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-base">{tr('مرضاي', 'My Patients')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr('العرض الافتراضي يظهر الزيارات المعينة لك كـ', 'Default view shows visits where you are the ')} <span className="font-medium text-foreground">{tr('ممرضة رئيسية', 'Primary Nurse')}</span>.
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
              {myLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}

              {!myLoading && rows.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    {tr('لم يتم تعيين أي زيارات طوارئ لك كممرضة رئيسية بعد.', 'No ER visits are assigned to you as Primary Nurse yet.')}
                  </div>
                  <Link
                    href="/er/board"
                    className="inline-block px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                  >
                    {tr('عرض جميع مرضى الطوارئ', 'View all ER patients')}
                  </Link>
                </div>
              )}

              {!myLoading && rows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {tr('عرض', 'Showing')} <span className="text-foreground">{rows.length}</span> {tr('زيارة', 'visit(s)')}
                    {isDev && showAll ? tr(' (الكل)', ' (all)') : tr(' (المعينة لي)', ' (assigned to me)')}.
                  </div>
                  <div className="rounded-2xl border border-border divide-y divide-border">
                    {rows.map((row: Record<string, unknown>) => {
                      const mrn = row.mrn || row.tempMrn || '\u2014';
                      const triage = String(row.triageLevel ?? '\u2014');
                      const pending = Number(row.pendingTasksCount || 0);
                      const tasksOverdueCount = Number(row.tasksOverdueCount || 0);
                      return (
                        <div key={String(row.encounterId)} className="p-4 flex flex-wrap items-center justify-between gap-3 thea-hover-lift thea-transition-fast rounded-xl">
                          <div className="min-w-[240px]">
                            <div className="font-medium">{String(row.patientName || tr('غير معروف', 'Unknown'))}</div>
                            <div className="text-xs text-muted-foreground">{tr('رقم الملف:', 'MRN:')} {String(mrn)}</div>
                            <div className="text-xs text-muted-foreground">{tr('زيارة الطوارئ:', 'ER Visit:')} {String(row.visitNumber || 'ER-\u2014')}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">{tr('الفرز', 'Triage')} {triage}</span>
                            <ErStatusPill status={String(row.status || '\u2014')} />
                            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-bold">{tr('السرير:', 'Bed:')} {String(row.bedLabel || '\u2014')}</span>
                            {row.sepsisSuspected && (
                              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">{tr('إنتان', 'Sepsis')}</span>
                            )}
                            {row.hasOpenEscalation && (
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('تصعيد', 'Escalation')}</span>
                            )}
                            {row.vitalsOverdue && (
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('تأخر العلامات الحيوية', 'Vitals overdue')}</span>
                            )}
                            {row.tasksOverdue && (
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">
                                {tr('مهام متأخرة', 'Tasks overdue')}{tasksOverdueCount > 0 ? ` (${tasksOverdueCount})` : ''}
                              </span>
                            )}
                            {row.hasOpenTransferRequest && (
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('تم طلب النقل', 'Transfer requested')}</span>
                            )}
                            {row.respiratoryDecision && row.respiratoryDecision !== 'NO' && (
                              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
                                {tr('تنفسي', 'Respiratory')} {row.respiratoryDecision === 'ISOLATE' ? tr('عزل', 'Isolate') : tr('احتياطات', 'Precautions')}
                              </span>
                            )}
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${pending > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'}`}>{pending}</span>
                            <span className="text-xs text-muted-foreground">{tr('مهام معلقة', 'Pending tasks')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/er/encounter/${row.encounterId}`}
                              className="px-4 py-2 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90"
                            >
                              {tr('فتح الزيارة', 'Open Visit')}
                            </Link>
                            <button
                              className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                              onClick={() =>
                                setTasksDrawer({
                                  encounterId: String(row.encounterId),
                                  patientName: String(row.patientName || tr('غير معروف', 'Unknown')),
                                  mrn: String(mrn),
                                  visitNumber: (row.visitNumber as string) || null,
                                })
                              }
                            >
                              {tr('عرض المهام', 'View Tasks')}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════ Tasks tab ════════════════════ */}
        {tab === 'tasks' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-extrabold text-base">{tr('المهام', 'Tasks')}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr('المهام عبر زياراتك المعينة في الطوارئ (الممرضة الرئيسية). علامات التأخير للقراءة فقط.', 'Tasks across your assigned ER visits (Primary Nurse). Overdue flags are read-only indicators.')}
                  </p>
                </div>
                {isDev && (
                  <div className="flex items-center gap-2">
                    <Switch checked={showAllTasks} onCheckedChange={(v) => setShowAllTasks(Boolean(v))} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('عرض الكل (مطور)', 'Show all (dev)')}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-5 space-y-3">
              {tasksLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}

              {!tasksLoading && taskRows.length === 0 && (
                <div className="space-y-3">
                  <div className="rounded-md border p-4 text-sm text-muted-foreground">
                    {tr('لم يتم العثور على مهام لـ', 'No tasks found for ')} {isDev && showAllTasks ? tr('النطاق الحالي', 'the current range') : tr('زياراتك المعينة', 'your assigned visits')}.
                  </div>
                  <Link
                    href="/er/board"
                    className="inline-block px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                  >
                    {tr('عرض جميع مرضى الطوارئ', 'View all ER patients')}
                  </Link>
                </div>
              )}

              {!tasksLoading && taskRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {tr('عرض', 'Showing')} <span className="text-foreground">{taskRows.length}</span> {tr('مهمة', 'task(s)')}
                    {isDev && showAllTasks ? tr(' (الكل)', ' (all)') : tr(' (المعينة لي)', ' (assigned to me)')}.
                  </div>

                  {/* Header */}
                  <div className="grid grid-cols-7 gap-3 px-4 py-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المريض', 'Patient')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السرير', 'Bed')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهمة', 'Task')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Kind')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المؤقت', 'Timer')}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('الإجراء', 'Action')}</span>
                  </div>

                  {/* Rows */}
                  {taskRows.map((t: Record<string, unknown>) => {
                    const mrn = t.mrn || t.tempMrn || '\u2014';
                    const age = t.ageMinutes == null ? '\u2014' : `${t.ageMinutes}m`;
                    const busy = taskActionBusyId === t.taskId;
                    const status = String(t.status || '');
                    return (
                      <div key={String(t.taskId)} className="grid grid-cols-7 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                        <div>
                          <div className="font-medium">
                            <Link className="hover:underline" href={`/er/encounter/${t.encounterId}`}>
                              {String(t.patientName || tr('غير معروف', 'Unknown'))}
                            </Link>
                          </div>
                          <div className="text-xs text-muted-foreground">{tr('رقم الملف:', 'MRN:')} {String(mrn)}</div>
                          <div className="text-xs text-muted-foreground">{tr('زيارة الطوارئ:', 'ER Visit:')} {String(t.visitNumber || 'ER-\u2014')}</div>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center">{String(t.bedLabel || '\u2014')}</div>
                        <div className="flex items-center">{String(t.taskName || '\u2014')}</div>
                        <div className="text-xs text-muted-foreground flex items-center">{String(t.kind || '\u2014')}</div>
                        <div className="flex items-center">
                          <div className="inline-flex items-center gap-2">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${taskStatusPillClass(String(t.status || '\u2014'))}`}>
                              {String(t.status || '\u2014')}
                            </span>
                            {t.isOverdue && (
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('متأخر', 'Overdue')}</span>
                            )}
                            {t.respiratoryDecision && t.respiratoryDecision !== 'NO' && (
                              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-[11px] font-bold">
                                {tr('تنفسي', 'Respiratory')} {t.respiratoryDecision === 'ISOLATE' ? tr('عزل', 'Isolate') : tr('احتياطات', 'Precautions')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground tabular-nums flex items-center">{age}</div>
                        <div className="flex items-center justify-end">
                          <div className="inline-flex flex-wrap gap-2 justify-end">
                            {status === 'ORDERED' && (
                              <button
                                className="text-[11px] px-3 py-1.5 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => postTaskAction(String(t.taskId), 'START')}
                              >
                                {tr('بدء', 'Start')}
                              </button>
                            )}
                            {status === 'IN_PROGRESS' && (
                              <button
                                className="text-[11px] px-3 py-1.5 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                                disabled={busy}
                                onClick={() => postTaskAction(String(t.taskId), 'COMPLETE')}
                              >
                                {tr('مكتمل', 'Done')}
                              </button>
                            )}
                            {status === 'ORDERED' && (
                              <button
                                className="text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast disabled:opacity-50"
                                disabled={busy}
                                onClick={() => {
                                  setCancelDialogTask(t);
                                  setCancelContext('console');
                                  setCancelReason('');
                                }}
                              >
                                {tr('تصعيد', 'Escalate')}
                              </button>
                            )}
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

        {/* ════════════════════ Observations tab ════════════════════ */}
        {tab === 'obs' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-extrabold text-base">{tr('الملاحظات', 'Observations')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tr('ملاحظات العلامات الحيوية على مستوى الزيارة (الطوارئ فقط). إضافة فقط. العلامات الحيوية الحرجة مميزة.', 'Visit-level vitals observations (ER only). Append-only. Critical vitals are flagged (no workflow changes yet).')}
              </p>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الزيارة', 'Visit')}</span>
                  <Select
                    value={selectedObsEncounterId}
                    onValueChange={(v) => setSelectedObsEncounterId(v)}
                    disabled={obsEncountersLoading || obsEncounters.length === 0}
                  >
                    <SelectTrigger className="w-[320px]">
                      <SelectValue placeholder={obsEncountersLoading ? tr('جاري التحميل...', 'Loading...') : tr('اختر زيارة', 'Select visit')} />
                    </SelectTrigger>
                    <SelectContent>
                      {obsEncounters.map((e: Record<string, unknown>) => {
                        const mrn = e.mrn || e.tempMrn || '\u2014';
                        const label = `${e.patientName || tr('غير معروف', 'Unknown')} (${mrn}) \u2022 ${tr('زيارة الطوارئ', 'ER Visit')}: ${e.visitNumber || 'ER-\u2014'}`;
                        return (
                          <SelectItem key={String(e.encounterId)} value={String(e.encounterId)}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-muted-foreground">
                    {obsEncounters.length === 0 && !obsEncountersLoading
                      ? tr('لا توجد زيارات معينة متاحة.', 'No assigned visits available.')
                      : tr('مقتصرة على الزيارات حيث أنت الممرضة الرئيسية.', 'Limited to visits where you are Primary Nurse.')}
                  </div>
                </div>

                {isDev && (
                  <div className="flex items-center gap-2">
                    <Switch checked={obsShowAll} onCheckedChange={(v) => setObsShowAll(Boolean(v))} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('عرض الكل (مطور)', 'Show all (dev)')}</span>
                  </div>
                )}
              </div>

              {selectedObsEncounter && (
                <div className="rounded-md border p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-medium">{selectedObsEncounter.patientName || tr('غير معروف', 'Unknown')}</span>{' '}
                      <span className="text-muted-foreground">
                        ({selectedObsEncounter.mrn || selectedObsEncounter.tempMrn || '\u2014'})
                      </span>
                      <span className="text-muted-foreground">
                        {' '}
                        \u2022 ER Visit: {selectedObsEncounter.visitNumber || 'ER-\u2014'}
                      </span>
                    </div>
                    <Link
                      href={`/er/encounter/${selectedObsEncounter.encounterId}`}
                      className="text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                    >
                      {tr('فتح الزيارة', 'Open Visit')}
                    </Link>
                  </div>

                  {obsCritical.critical && (
                    <div className="rounded-md border border-destructive bg-destructive/5 p-3">
                      <div className="text-sm font-medium text-destructive">{tr('علامات حيوية حرجة \u2013 تصعيد', 'Critical vitals \u2013 escalate')}</div>
                      <div className="text-xs text-muted-foreground">
                        {obsCritical.reasons.join(' \u2022 ')}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ضغط الدم الانقباضي', 'BP Systolic')}</span>
                      <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={obsForm.systolic} onChange={(e) => setObsForm((p) => ({ ...p, systolic: e.target.value }))} placeholder="e.g. 120" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ضغط الدم الانبساطي', 'BP Diastolic')}</span>
                      <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={obsForm.diastolic} onChange={(e) => setObsForm((p) => ({ ...p, diastolic: e.target.value }))} placeholder="e.g. 80" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معدل النبض', 'HR')}</span>
                      <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={obsForm.hr} onChange={(e) => setObsForm((p) => ({ ...p, hr: e.target.value }))} placeholder="bpm" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('معدل التنفس', 'RR')}</span>
                      <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={obsForm.rr} onChange={(e) => setObsForm((p) => ({ ...p, rr: e.target.value }))} placeholder="/min" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحرارة', 'Temp')}</span>
                      <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={obsForm.temp} onChange={(e) => setObsForm((p) => ({ ...p, temp: e.target.value }))} placeholder="\u00b0C" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تشبع الأكسجين', 'SpO2')}</span>
                      <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={obsForm.spo2} onChange={(e) => setObsForm((p) => ({ ...p, spo2: e.target.value }))} placeholder="%" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الألم (0\u201310)', 'Pain (0\u201310)')}</span>
                      <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" value={obsForm.painScore} onChange={(e) => setObsForm((p) => ({ ...p, painScore: e.target.value }))} placeholder="0-10" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AVPU</span>
                      <Select value={obsForm.avpu} onValueChange={(v) => setObsForm((p) => ({ ...p, avpu: v as '' | 'A' | 'V' | 'P' | 'U' }))}>
                        <SelectTrigger>
                          <SelectValue placeholder={tr('اختر', 'Select')} />
                        </SelectTrigger>
                        <SelectContent>
                          {(['A', 'V', 'P', 'U'] as const).map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      className="px-4 py-2 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                      disabled={obsSaving}
                      onClick={saveObservation}
                    >
                      {tr('حفظ الملاحظة', 'Save Observation')}
                    </button>
                  </div>
                </div>
              )}

              {selectedObsEncounterId && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <h2 className="font-extrabold text-base">{tr('آخر 5 ملاحظات', 'Last 5 observations')}</h2>
                  </div>
                  <div className="p-5">
                    {obsListLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}
                    {!obsListLoading && obsRows.length === 0 && (
                      <div className="text-sm text-muted-foreground">{tr('لا توجد ملاحظات بعد.', 'No observations yet.')}</div>
                    )}
                    {!obsListLoading && obsRows.length > 0 && (
                      <>
                        {/* Header */}
                        <div className="grid grid-cols-9 gap-2 px-4 py-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوقت', 'Time')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('ضغط الدم', 'BP')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النبض', 'HR')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('التنفس', 'RR')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحرارة', 'Temp')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تشبع الأكسجين', 'SpO2')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الألم', 'Pain')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الوعي', 'AVPU')}</span>
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الممرض/ة', 'Nurse')}</span>
                        </div>
                        {/* Rows */}
                        {obsRows.map((o: Record<string, unknown>) => {
                          const vit = (o.vitals || {}) as Record<string, unknown>;
                          return (
                          <div key={String(o.id)} className="grid grid-cols-9 gap-2 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                            <div className="text-xs text-muted-foreground">
                              {o.createdAt ? new Date(o.createdAt as string).toLocaleString() : '\u2014'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {String(vit.systolic ?? '\u2014')}/{String(vit.diastolic ?? '\u2014')}
                            </div>
                            <div className="text-xs text-muted-foreground">{String(vit.hr ?? '\u2014')}</div>
                            <div className="text-xs text-muted-foreground">{String(vit.rr ?? '\u2014')}</div>
                            <div className="text-xs text-muted-foreground">{String(vit.temp ?? '\u2014')}</div>
                            <div className="text-xs text-muted-foreground">{String(vit.spo2 ?? '\u2014')}</div>
                            <div className="text-xs text-muted-foreground">{String(o.painScore ?? '\u2014')}</div>
                            <div className="text-xs text-muted-foreground">{String(o.avpu ?? '\u2014')}</div>
                            <div className="text-xs text-muted-foreground">{String(o.nurseDisplay || '\u2014')}</div>
                          </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════ Metrics tab ════════════════════ */}
        {tab === 'metrics' && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-extrabold text-base">{tr('مقاييس التمريض (v0.1)', 'Nursing Metrics (v0.1)')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{tr('مؤشرات أداء من المهام والملاحظات وسجلات التدقيق (قراءة فقط).', 'Read-only KPIs derived from tasks + observations + audit logs.')}</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('من', 'From')}</span>
                  <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" type="datetime-local" value={metricsFrom} onChange={(e) => setMetricsFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('إلى', 'To')}</span>
                  <Input className="rounded-xl border-[1.5px] border-border bg-muted/30 thea-input-focus thea-transition-fast" type="datetime-local" value={metricsTo} onChange={(e) => setMetricsTo(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <button
                    className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                    onClick={() => mutateMetrics()}
                  >
                    {tr('تحديث', 'Refresh')}
                  </button>
                </div>
              </div>

              {metricsLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}

              {!metricsLoading && metricsData && (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {/* Metric card 1 */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-border">
                        <h2 className="font-extrabold text-sm">{tr('وقت بدء المهمة (دقيقة)', 'Time to start task (min)')}</h2>
                      </div>
                      <div className="p-5 text-sm text-muted-foreground">
                        {tr('المعدل:', 'Avg:')} <span className="text-foreground">{metricsData.tasks?.timeToStartMinutes?.avg ?? '\u2014'}</span>{' '}
                        {'\u00b7'} {tr('الوسيط:', 'p50:')} <span className="text-foreground">{metricsData.tasks?.timeToStartMinutes?.p50 ?? '\u2014'}</span>{' '}
                        {'\u00b7'} p90: <span className="text-foreground">{metricsData.tasks?.timeToStartMinutes?.p90 ?? '\u2014'}</span>{' '}
                        {'\u00b7'} {tr('العدد:', 'n:')} <span className="text-foreground">{metricsData.tasks?.timeToStartMinutes?.count ?? 0}</span>
                      </div>
                    </div>
                    {/* Metric card 2 */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-border">
                        <h2 className="font-extrabold text-sm">{tr('وقت إنجاز المهمة (دقيقة)', 'Time to complete task (min)')}</h2>
                      </div>
                      <div className="p-5 text-sm text-muted-foreground">
                        {tr('المعدل:', 'Avg:')} <span className="text-foreground">{metricsData.tasks?.timeToCompleteMinutes?.avg ?? '\u2014'}</span>{' '}
                        {'\u00b7'} {tr('الوسيط:', 'p50:')} <span className="text-foreground">{metricsData.tasks?.timeToCompleteMinutes?.p50 ?? '\u2014'}</span>{' '}
                        {'\u00b7'} p90: <span className="text-foreground">{metricsData.tasks?.timeToCompleteMinutes?.p90 ?? '\u2014'}</span>{' '}
                        {'\u00b7'} {tr('العدد:', 'n:')} <span className="text-foreground">{metricsData.tasks?.timeToCompleteMinutes?.count ?? 0}</span>
                      </div>
                    </div>
                    {/* Metric card 3 */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-border">
                        <h2 className="font-extrabold text-sm">{tr('نسبة تأخر المهام (لقطة)', 'Task overdue rate (snapshot)')}</h2>
                      </div>
                      <div className="p-5 text-sm text-muted-foreground">
                        {tr('متأخرة:', 'Overdue:')} <span className="text-foreground">{metricsData.tasks?.overdueSnapshot?.overdueCount ?? 0}</span> /{' '}
                        <span className="text-foreground">{metricsData.tasks?.overdueSnapshot?.totalPending ?? 0}</span>{' '}
                        (<span className="text-foreground">{metricsData.tasks?.overdueSnapshot?.overduePct ?? 0}%</span>)
                      </div>
                    </div>
                    {/* Metric card 4 */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-border">
                        <h2 className="font-extrabold text-sm">{tr('نسبة تأخر العلامات الحيوية (لقطة)', 'Vitals overdue rate (snapshot)')}</h2>
                      </div>
                      <div className="p-5 text-sm text-muted-foreground">
                        {tr('متأخرة:', 'Overdue:')} <span className="text-foreground">{metricsData.vitals?.overdueSnapshot?.overdueCount ?? 0}</span> /{' '}
                        <span className="text-foreground">{metricsData.vitals?.overdueSnapshot?.encountersConsidered ?? 0}</span>{' '}
                        (<span className="text-foreground">{metricsData.vitals?.overdueSnapshot?.overduePct ?? 0}%</span>)
                      </div>
                    </div>
                  </div>

                  {/* Workload per nurse */}
                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                      <h2 className="font-extrabold text-base">{tr('عبء العمل لكل ممرض/ة', 'Workload per nurse')}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{tr('المهام المنجزة + الملاحظات المسجلة (ضمن النطاق).', 'Tasks completed + observations recorded (within range).')}</p>
                    </div>
                    <div className="p-5">
                      {Array.isArray(metricsData.workload?.items) && metricsData.workload.items.length > 0 ? (
                        <>
                          {/* Header */}
                          <div className="grid grid-cols-3 gap-3 px-4 py-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الممرض/ة', 'Nurse')}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهام المنجزة', 'Tasks completed')}</span>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الملاحظات', 'Observations')}</span>
                          </div>
                          {/* Rows */}
                          {metricsData.workload.items.map((w: Record<string, unknown>) => (
                            <div key={String(w.userId)} className="grid grid-cols-3 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                              <div className="text-sm">{String(w.display || w.userId)}</div>
                              <div className="text-sm text-muted-foreground">{String(w.tasksCompleted ?? 0)}</div>
                              <div className="text-sm text-muted-foreground">{String(w.observationsRecorded ?? 0)}</div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">{tr('لا توجد بيانات عبء عمل لهذا النطاق.', 'No workload data for this range.')}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </ErPageShell>

      {/* ════════════════════ Escalate Dialog ════════════════════ */}
      <Dialog
        open={Boolean(cancelDialogTask)}
        onOpenChange={(open) => {
          if (!open) {
            setCancelDialogTask(null);
            setCancelReason('');
          }
        }}
      >
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tr('تصعيد المهمة', 'Escalate Task')}</DialogTitle>
            <DialogDescription>{tr('أدخل سبب التصعيد (مطلوب).', 'Provide an escalation reason (required).')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('السبب', 'Reason')}</span>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="min-h-[120px]"
              placeholder={tr('مثال: المريض غير مستقر / يحتاج مراجعة طبيب / لا يمكن المتابعة...', 'e.g., patient unstable / needs physician review / cannot proceed...')}
            />
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
              onClick={() => {
                setCancelDialogTask(null);
                setCancelReason('');
              }}
            >
              {tr('إغلاق', 'Close')}
            </button>
            <button
              className="px-4 py-2 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
              disabled={!cancelDialogTask || !cancelReason.trim() || taskActionBusyId === String(cancelDialogTask?.taskId)}
              onClick={async () => {
                if (!cancelDialogTask) return;
                const afterMutate =
                  cancelContext === 'drawer'
                    ? [mutateDrawerTasks, mutateMy, mutateTasks]
                    : [mutateTasks];
                await postTaskAction(String(cancelDialogTask.taskId), 'CANCEL', {
                  cancelReason: cancelReason.trim(),
                  afterMutate,
                });
                setCancelDialogTask(null);
                setCancelReason('');
              }}
            >
              {tr('تأكيد التصعيد', 'Confirm Escalation')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════ Tasks Drawer ════════════════════ */}
      <Drawer open={Boolean(tasksDrawer)} onOpenChange={(open) => !open && setTasksDrawer(null)}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>
              {tr('المهام', 'Tasks')} {'\u2014'} {tasksDrawer?.patientName || tr('غير معروف', 'Unknown')} ({tasksDrawer?.mrn || '\u2014'}) {'\u2022'} {tr('زيارة الطوارئ:', 'ER Visit:')}{' '}
              {tasksDrawer?.visitNumber || 'ER-\u2014'}
            </DrawerTitle>
            <DrawerDescription>
              {tr('مهام الزيارة (قائمة قراءة فقط مع إجراءات التمريض). التغييرات مسجلة.', 'Visit tasks (read-only list with nursing actions). Changes are audited.')}
            </DrawerDescription>
            {tasksDrawer?.encounterId && (
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href={`/er/encounter/${tasksDrawer.encounterId}`}
                  className="text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast"
                >
                  {tr('فتح الزيارة', 'Open Visit')}
                </Link>
              </div>
            )}
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-3 overflow-auto">
            {drawerTasksLoading && <div className="text-sm text-muted-foreground">{tr('جاري التحميل...', 'Loading...')}</div>}

            {!drawerTasksLoading && drawerTaskRows.length === 0 && (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">{tr('لا توجد مهام لهذه الزيارة.', 'No tasks for this visit.')}</div>
            )}

            {!drawerTasksLoading && drawerTaskRows.length > 0 && (
              <>
                {/* Header */}
                <div className="grid grid-cols-5 gap-3 px-4 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المهمة', 'Task')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('النوع', 'Kind')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('الحالة', 'Status')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('المؤقت', 'Timer')}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{tr('الإجراء', 'Action')}</span>
                </div>
                {/* Rows */}
                {drawerTaskRows.map((t: Record<string, unknown>) => {
                  const age = t.ageMinutes == null ? '\u2014' : `${t.ageMinutes}m`;
                  const busy = taskActionBusyId === t.taskId;
                  const status = String(t.status || '');
                  return (
                    <div key={String(t.taskId)} className="grid grid-cols-5 gap-3 px-4 py-3 thea-hover-lift thea-transition-fast rounded-xl">
                      <div className="flex items-center">{String(t.taskName || '\u2014')}</div>
                      <div className="text-xs text-muted-foreground flex items-center">{String(t.kind || '\u2014')}</div>
                      <div className="flex items-center">
                        <div className="inline-flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${taskStatusPillClass(String(t.status || '\u2014'))}`}>{String(t.status || '\u2014')}</span>
                          {t.isOverdue && (
                            <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-0.5 text-[11px] font-bold">{tr('متأخرة', 'Overdue')}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground tabular-nums flex items-center">{age}</div>
                      <div className="flex items-center justify-end">
                        <div className="inline-flex flex-wrap gap-2 justify-end">
                          {status === 'ORDERED' && (
                            <button
                              className="text-[11px] px-3 py-1.5 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                              disabled={busy}
                              onClick={() =>
                                postTaskAction(String(t.taskId), 'START', {
                                  afterMutate: [mutateDrawerTasks, mutateMy, mutateTasks],
                                })
                              }
                            >
                              {tr('بدء', 'Start')}
                            </button>
                          )}
                          {status === 'IN_PROGRESS' && (
                            <button
                              className="text-[11px] px-3 py-1.5 rounded-xl bg-primary text-white font-bold thea-transition-fast hover:opacity-90 disabled:opacity-50"
                              disabled={busy}
                              onClick={() =>
                                postTaskAction(String(t.taskId), 'COMPLETE', {
                                  afterMutate: [mutateDrawerTasks, mutateMy, mutateTasks],
                                })
                              }
                            >
                              {tr('تم', 'Done')}
                            </button>
                          )}
                          {status === 'ORDERED' && (
                            <button
                              className="text-[11px] px-3 py-1.5 rounded-xl border border-border font-medium hover:bg-muted thea-transition-fast disabled:opacity-50"
                              disabled={busy}
                              onClick={() => {
                                setCancelDialogTask(t);
                                setCancelContext('drawer');
                                setCancelReason('');
                              }}
                            >
                              {tr('تصعيد', 'Escalate')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
