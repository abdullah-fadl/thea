'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import {
  Scissors, Search, RefreshCw, CheckCircle2, Clock,
  Activity, Users, Stethoscope, ClipboardCheck, Heart,
  AlertTriangle,
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
import OrNursingPreOpForm from '@/components/or/OrNursingPreOpForm';
import OrAnesthesiaPreOpForm from '@/components/or/OrAnesthesiaPreOpForm';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
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
  roomName?: string;
  status?: string;
  priority?: string;
  surgeonName?: string;
  anesthesiologistName?: string;
  asaClass?: string;
  currentStep?: string;
  nursingPreOpStatus?: string;
  anesthesiaPreOpStatus?: string;
}

export default function ORPreOpAssessment() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/or/pre-op');

  /* ── Data ── */
  const { data, mutate, isLoading } = useSWR('/api/or/cases/today', fetcher, { refreshInterval: 15000 });
  const allCases: CaseRow[] = data?.items || [];
  // Pre-op assessment is relevant for cases not yet completed
  const cases = useMemo(() => allCases.filter((c) => c.status !== 'CANCELLED'), [allCases]);

  /* ── Local state ── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState('nursing');

  /* ── Derived ── */
  const filtered = useMemo(() => {
    let list = cases;
    if (statusFilter === 'NEEDS_ASSESSMENT') {
      list = list.filter((c) =>
        c.nursingPreOpStatus !== 'COMPLETED' || c.anesthesiaPreOpStatus !== 'COMPLETED',
      );
    } else if (statusFilter === 'ASSESSED') {
      list = list.filter((c) =>
        c.nursingPreOpStatus === 'COMPLETED' && c.anesthesiaPreOpStatus === 'COMPLETED',
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.procedureName || '').toLowerCase().includes(q) ||
          (c.patientName || '').toLowerCase().includes(q) ||
          (c.mrn || '').toLowerCase().includes(q) ||
          (c.roomName || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [cases, statusFilter, search]);

  const selectedCase = useMemo(() => cases.find((c) => c.id === selectedCaseId) || null, [cases, selectedCaseId]);

  const openCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setDialogTab('nursing');
  }, []);

  /* ── KPIs ── */
  const totalToday = cases.length;
  const nursingDone = cases.filter((c) => c.nursingPreOpStatus === 'COMPLETED').length;
  const anesthesiaDone = cases.filter((c) => c.anesthesiaPreOpStatus === 'COMPLETED').length;
  const fullyAssessed = cases.filter((c) => c.nursingPreOpStatus === 'COMPLETED' && c.anesthesiaPreOpStatus === 'COMPLETED').length;

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
          <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {tr('تقييم ما قبل العملية', 'Pre-Op Assessment')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tr('التقييم التمريضي وتقييم التخدير قبل العملية', 'Nursing & anesthesia pre-operative evaluation')}
            </p>
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
          label={tr('حالات اليوم', 'Today\'s Cases')}
          value={totalToday}
          icon={<Scissors className="h-4 w-4 text-blue-500" />}
        />
        <TheaKpiCard
          label={tr('تقييم تمريضي مكتمل', 'Nursing Done')}
          value={nursingDone}
          icon={<Heart className="h-4 w-4 text-pink-500" />}
        />
        <TheaKpiCard
          label={tr('تقييم تخدير مكتمل', 'Anesthesia Done')}
          value={anesthesiaDone}
          icon={<Stethoscope className="h-4 w-4 text-purple-500" />}
        />
        <TheaKpiCard
          label={tr('جاهز للعملية', 'Fully Assessed')}
          value={fullyAssessed}
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
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('جميع الحالات', 'All Cases')}</SelectItem>
            <SelectItem value="NEEDS_ASSESSMENT">{tr('يحتاج تقييم', 'Needs Assessment')}</SelectItem>
            <SelectItem value="ASSESSED">{tr('مكتمل التقييم', 'Fully Assessed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Cases Grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? tr('جاري التحميل...', 'Loading...')
              : tr('لا توجد حالات عمليات اليوم', 'No OR cases found for today')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const nursingOk = c.nursingPreOpStatus === 'COMPLETED';
            const anesthesiaOk = c.anesthesiaPreOpStatus === 'COMPLETED';
            const fullyReady = nursingOk && anesthesiaOk;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => openCase(c.id)}
                className={`text-left border rounded-xl p-4 space-y-3 transition-all hover:shadow-md hover:border-primary/40 cursor-pointer ${
                  fullyReady
                    ? 'border-green-300 dark:border-green-700 bg-green-50/30 dark:bg-green-950/10'
                    : 'border-border bg-card'
                }`}
              >
                {/* Top row */}
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
                    {c.priority === 'EMERGENCY' && (
                      <Badge className="text-[10px] bg-red-600 text-white">{tr('طوارئ', 'EMERGENCY')}</Badge>
                    )}
                    {c.asaClass && (
                      <Badge variant="outline" className="text-[10px]">ASA {c.asaClass}</Badge>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {c.roomName && (
                    <span className="flex items-center gap-1">
                      <Scissors className="h-3 w-3" /> {c.roomName}
                    </span>
                  )}
                  {c.scheduledStartTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.scheduledStartTime).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {c.surgeonName && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.surgeonName}
                    </span>
                  )}
                </div>

                {/* Assessment status badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] gap-1 ${nursingOk ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                    <Heart className="h-3 w-3" />
                    {nursingOk
                      ? tr('تمريض مكتمل', 'Nursing Done')
                      : tr('تمريض معلّق', 'Nursing Pending')}
                  </Badge>
                  <Badge className={`text-[10px] gap-1 ${anesthesiaOk ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                    <Stethoscope className="h-3 w-3" />
                    {anesthesiaOk
                      ? tr('تخدير مكتمل', 'Anesthesia Done')
                      : tr('تخدير معلّق', 'Anesthesia Pending')}
                  </Badge>
                  {fullyReady && (
                    <Badge className="text-[10px] gap-1 bg-green-600 text-white">
                      <CheckCircle2 className="h-3 w-3" /> {tr('جاهز', 'Ready')}
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
                      {selectedCase.procedureName || tr('تقييم قبل العملية', 'Pre-Op Assessment')}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedCase.patientName} {selectedCase.mrn ? `(${selectedCase.mrn})` : ''}
                      {selectedCase.roomName ? ` — ${selectedCase.roomName}` : ''}
                      {selectedCase.asaClass ? ` — ASA ${selectedCase.asaClass}` : ''}
                    </p>
                  </div>
                  {selectedCase.priority === 'EMERGENCY' && (
                    <Badge className="text-[10px] bg-red-600 text-white">{tr('طوارئ', 'EMERGENCY')}</Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="px-6 pb-6">
                <Tabs value={dialogTab} onValueChange={setDialogTab} className="mt-4">
                  <TabsList className="grid w-full grid-cols-2 h-auto">
                    <TabsTrigger value="nursing" className="text-xs gap-1.5 py-2">
                      <Heart className="h-4 w-4" />
                      {tr('تقييم تمريضي', 'Nursing Assessment')}
                      {selectedCase.nursingPreOpStatus === 'COMPLETED' && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="anesthesia" className="text-xs gap-1.5 py-2">
                      <Stethoscope className="h-4 w-4" />
                      {tr('تقييم التخدير', 'Anesthesia Assessment')}
                      {selectedCase.anesthesiaPreOpStatus === 'COMPLETED' && (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="nursing" className="mt-4">
                    <OrNursingPreOpForm
                      caseId={selectedCase.id}
                      tr={tr}
                      language={language}
                      onSaved={() => mutate()}
                    />
                  </TabsContent>

                  <TabsContent value="anesthesia" className="mt-4">
                    <OrAnesthesiaPreOpForm
                      caseId={selectedCase.id}
                      tr={tr}
                      language={language}
                      onSaved={() => mutate()}
                    />
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
