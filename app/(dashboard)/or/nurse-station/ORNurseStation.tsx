'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import {
  Scissors, Search, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, Activity, FlaskConical, ClipboardList, FileText,
  Shield, Users, Layers,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TheaKpiCard } from '@/components/thea-ui';
import OrSurgicalCountForm from '@/components/or/OrSurgicalCountForm';
import OrSpecimenLog from '@/components/or/OrSpecimenLog';
import OrCirculatingNurseDoc from '@/components/or/OrCirculatingNurseDoc';
import OrTimeOutForm from '@/components/or/OrTimeOutForm';
import OrImplantsList from '@/components/or/OrImplantsList';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ── OR step phases for the progress bar ── */
const OR_PHASES = ['START', 'PRE_OP', 'TIME_OUT', 'INTRA_OP', 'POST_OP', 'RECOVERY'] as const;

/* ── Status → badge styling ── */
const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  CANCELLED: 'bg-muted text-muted-foreground',
};

interface CaseRow {
  id: string;
  procedureName?: string;
  patientMasterId?: string;
  patientName?: string;
  mrn?: string;
  scheduledDate?: string;
  scheduledStartTime?: string;
  roomNumber?: string;
  status?: string;
  urgency?: string;
  currentStep?: string;
  team?: { role?: string; userName?: string }[];
  countStatus?: {
    preOpDone?: boolean;
    postOpDone?: boolean;
    hasUnresolvedDiscrepancy?: boolean;
  };
  specimenCount?: number;
}

export default function ORNurseStation() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/or/nurse-station');

  /* ── Data ── */
  const { data, mutate, isLoading } = useSWR('/api/or/cases/today', fetcher, { refreshInterval: 15000 });
  const cases: CaseRow[] = data?.items || [];
  const summary = data?.summary || { total: 0, inProgress: 0, completed: 0, pending: 0, discrepancies: 0 };

  /* ── Local state ── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState('counts');

  /* ── Derived ── */
  const filtered = useMemo(() => {
    let list = cases;
    if (statusFilter !== 'ALL') list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.procedureName || '').toLowerCase().includes(q) ||
          (c.patientName || '').toLowerCase().includes(q) ||
          (c.mrn || '').toLowerCase().includes(q) ||
          (c.roomNumber || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [cases, statusFilter, search]);

  const selectedCase = useMemo(() => cases.find((c) => c.id === selectedCaseId) || null, [cases, selectedCaseId]);

  const openCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setDialogTab('counts');
  }, []);

  /* ── Phase progress helper ── */
  const getPhaseIndex = (step?: string) => {
    const idx = (OR_PHASES as readonly string[]).indexOf(step ?? '');
    return idx >= 0 ? idx : 0;
  };

  /* ── Permission gate ── */
  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        {tr('ليس لديك صلاحية الوصول', 'You do not have permission to access this page')}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 bg-background min-h-screen" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Scissors className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{tr('محطة تمريض غرفة العمليات', 'OR Nurse Station')}</h1>
            <p className="text-xs text-muted-foreground">{tr('حالات اليوم والتوثيق التمريضي', "Today's cases & nursing documentation")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => mutate()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {tr('تحديث', 'Refresh')}
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TheaKpiCard
          label={tr('إجمالي اليوم', 'Total Today')}
          value={summary.total}
          icon={<Layers className="h-4 w-4 text-blue-500" />}
        />
        <TheaKpiCard
          label={tr('قيد التنفيذ', 'In Progress')}
          value={summary.inProgress}
          icon={<Activity className="h-4 w-4 text-amber-500" />}
        />
        <TheaKpiCard
          label={tr('تبايُن العدّ', 'Count Discrepancies')}
          value={summary.discrepancies}
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
        />
        <TheaKpiCard
          label={tr('مكتمل', 'Completed')}
          value={summary.completed}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        />
      </div>

      {/* ── Search & Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr('بحث بالمريض / الإجراء / الغرفة...', 'Search by patient / procedure / room...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الحالات', 'All Statuses')}</SelectItem>
            <SelectItem value="SCHEDULED">{tr('مجدولة', 'Scheduled')}</SelectItem>
            <SelectItem value="IN_PROGRESS">{tr('قيد التنفيذ', 'In Progress')}</SelectItem>
            <SelectItem value="COMPLETED">{tr('مكتمل', 'Completed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Cases Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Scissors className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? tr('جاري التحميل...', 'Loading...')
              : tr('لا توجد حالات عمليات اليوم', 'No OR cases found for today')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const phaseIdx = getPhaseIndex(c.currentStep);
            const phasePct = ((phaseIdx + 1) / OR_PHASES.length) * 100;
            const hasDisc = c.countStatus?.hasUnresolvedDiscrepancy;
            const surgeon = c.team?.find((t) => t.role === 'SURGEON');
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openCase(c.id)}
                className={`text-left border rounded-xl p-4 space-y-3 transition-all hover:shadow-md hover:border-primary/40 cursor-pointer ${
                  hasDisc ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/10' : 'border-border bg-card'
                }`}
              >
                {/* Top row: procedure + badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-foreground">
                      {c.procedureName || tr('إجراء غير محدد', 'Unnamed Procedure')}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.patientName || tr('مريض', 'Patient')} {c.mrn ? `(${c.mrn})` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`text-[10px] ${STATUS_COLORS[c.status || ''] || STATUS_COLORS.SCHEDULED}`}>
                      {c.status === 'IN_PROGRESS' ? tr('قيد التنفيذ', 'In Progress')
                        : c.status === 'COMPLETED' ? tr('مكتمل', 'Completed')
                        : c.status === 'CANCELLED' ? tr('ملغاة', 'Cancelled')
                        : tr('مجدولة', 'Scheduled')}
                    </Badge>
                    {c.urgency === 'EMERGENCY' && (
                      <Badge className="text-[10px] bg-red-600 text-white">{tr('طوارئ', 'EMERGENCY')}</Badge>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {c.roomNumber && (
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3 w-3" /> {tr('غرفة', 'Room')} {c.roomNumber}
                    </span>
                  )}
                  {c.scheduledStartTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.scheduledStartTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {surgeon && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {surgeon.userName}
                    </span>
                  )}
                </div>

                {/* Phase progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{c.currentStep || 'START'}</span>
                    <span>{Math.round(phasePct)}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        c.status === 'COMPLETED' ? 'bg-green-500' : 'bg-primary'
                      }`}
                      style={{ width: `${phasePct}%` }}
                    />
                  </div>
                </div>

                {/* Safety indicators */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Count status */}
                  {hasDisc ? (
                    <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse">
                      <AlertTriangle className="h-3 w-3" /> {tr('تباين العدّ', 'Count Discrepancy')}
                    </Badge>
                  ) : c.countStatus?.postOpDone ? (
                    <Badge className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {tr('العدّ مطابق', 'Counts Match')}
                    </Badge>
                  ) : c.countStatus?.preOpDone ? (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <ClipboardList className="h-3 w-3" /> {tr('عدّ قبل العملية ✓', 'Pre-Op Count ✓')}
                    </Badge>
                  ) : null}

                  {/* Specimen count */}
                  {(c.specimenCount || 0) > 0 && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <FlaskConical className="h-3 w-3" /> {c.specimenCount} {tr('عيّنة', 'specimens')}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Case Detail Dialog ── */}
      <Dialog open={!!selectedCaseId} onOpenChange={(open) => !open && setSelectedCaseId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          {selectedCase && (
            <>
              <DialogHeader className="px-6 pt-6 pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-base">
                      {selectedCase.procedureName || tr('حالة عملية', 'OR Case')}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedCase.patientName} {selectedCase.mrn ? `(${selectedCase.mrn})` : ''}
                      {selectedCase.roomNumber ? ` — ${tr('غرفة', 'Room')} ${selectedCase.roomNumber}` : ''}
                    </p>
                  </div>
                  <Badge className={`text-[10px] ${STATUS_COLORS[selectedCase.status || ''] || STATUS_COLORS.SCHEDULED}`}>
                    {selectedCase.status === 'IN_PROGRESS' ? tr('قيد التنفيذ', 'In Progress')
                      : selectedCase.status === 'COMPLETED' ? tr('مكتمل', 'Completed')
                      : tr('مجدولة', 'Scheduled')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="px-6 pb-6">
                <Tabs value={dialogTab} onValueChange={setDialogTab} className="mt-4">
                  <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
                    <TabsTrigger value="counts" className="text-xs gap-1 py-1.5">
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr('العدّ', 'Counts')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="specimens" className="text-xs gap-1 py-1.5">
                      <FlaskConical className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr('العيّنات', 'Specimens')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="nursing-doc" className="text-xs gap-1 py-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr('توثيق', 'Nursing Doc')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="timeout" className="text-xs gap-1 py-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr('التحقق', 'Time-Out')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="implants" className="text-xs gap-1 py-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr('المستلزمات', 'Implants')}</span>
                    </TabsTrigger>
                    <TabsTrigger value="timeline" className="text-xs gap-1 py-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tr('المسار', 'Timeline')}</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="counts" className="mt-4">
                    <OrSurgicalCountForm caseId={selectedCase.id} tr={tr} language={language} />
                  </TabsContent>

                  <TabsContent value="specimens" className="mt-4">
                    <OrSpecimenLog
                      caseId={selectedCase.id}
                      patientMasterId={selectedCase.patientMasterId}
                      tr={tr}
                      language={language}
                    />
                  </TabsContent>

                  <TabsContent value="nursing-doc" className="mt-4">
                    <OrCirculatingNurseDoc caseId={selectedCase.id} tr={tr} language={language} />
                  </TabsContent>

                  <TabsContent value="timeout" className="mt-4">
                    <OrTimeOutForm caseId={selectedCase.id} />
                  </TabsContent>

                  <TabsContent value="implants" className="mt-4">
                    <OrImplantsList caseId={selectedCase.id} />
                  </TabsContent>

                  <TabsContent value="timeline" className="mt-4">
                    <CaseTimeline caseId={selectedCase.id} tr={tr} language={language} />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Inline Case Timeline sub-component
   ──────────────────────────────────────────────────────── */
function CaseTimeline({ caseId, tr, language }: { caseId: string; tr: (ar: string, en: string) => string; language: string }) {
  const { data } = useSWR(caseId ? `/api/or/cases/${caseId}` : null, fetcher);
  const events: any[] = Array.isArray(data?.events) ? data.events : [];

  if (events.length === 0) {
    return (
      <div className="text-center py-10">
        <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{tr('لا توجد أحداث بعد', 'No events yet')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        {tr('سجل الأحداث', 'Event Timeline')}
      </h3>
      <div className="relative border-l-2 border-border ml-3 space-y-4 py-2">
        {events.map((ev: any, i: number) => (
          <div key={ev.id || i} className="ml-6 relative">
            <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{ev.step}</Badge>
              <span className="text-[10px] text-muted-foreground">
                {ev.createdAt
                  ? new Date(ev.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
            {ev.data && Object.keys(ev.data).length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                {Object.entries(ev.data)
                  .filter(([, v]) => v != null && v !== '' && v !== false)
                  .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
