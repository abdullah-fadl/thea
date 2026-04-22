'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import {
  Activity, Heart, Clock, User, Search, RefreshCw, AlertCircle, CheckCircle2,
  ChevronRight, ChevronDown, X, Clipboard, Stethoscope, Plus, FileText,
  BedDouble, ArrowUpDown, Filter, ClipboardList, Pill, FlaskConical,
  TrendingUp, Droplets, LogOut, AlertTriangle, Calendar, Thermometer,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TheaKpiCard } from '@/components/thea-ui';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

/* ── Types ── */
interface PatientEpisode {
  id: string;
  status: string;
  patientName: string;
  patientId: string;
  encounterCoreId: string;
  location: { ward?: string; unit?: string; room?: string; bed?: string };
  ownership: { attendingPhysicianUserId?: string; primaryInpatientNurseUserId?: string };
  reasonForAdmission: string;
  riskFlags: Record<string, unknown>;
  admittedAt: string;
  losDays: number;
  serviceUnit: string;
  latestVitals: Record<string, unknown>;
  latestAssessment: Record<string, unknown>;
  hasProgressToday: boolean;
  lastProgressDate: string | null;
  pendingOrdersCount: number;
  pendingResultsCount: number;
  allergiesCount: number;
  allergies: { name: string; severity: string; type: string }[];
  activeProblems: { name: string; icd10: string }[];
}

interface RoundingSummary {
  episode: Record<string, unknown>;
  vitalsTrend: Record<string, unknown>[];
  latestAssessment: Record<string, unknown>;
  medOrders: Record<string, unknown>[];
  labImagingOrders: Record<string, unknown>[];
  progressNotes: Record<string, unknown>[];
  carePlans: Record<string, unknown>[];
  fluidBalance: { intake: number; output: number; net: number };
  allergies: Record<string, unknown>[];
  activeProblems: Record<string, unknown>[];
  results: Record<string, unknown>[];
}

/* ══════════════════════════════════════════════════════════════
   محطة طبيب التنويم — IPD Doctor Station
   ══════════════════════════════════════════════════════════════ */
export default function IPDDoctorStation() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/ipd/doctor-station');
  const userId = String(me?.user?.id || me?.userId || '');

  // ── State ──
  const [searchQ, setSearchQ] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'bed' | 'acuity' | 'los' | 'name'>('bed');
  const [selectedEpId, setSelectedEpId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAllPatients, setShowAllPatients] = useState(false);

  // Progress note form
  const [progressForm, setProgressForm] = useState({
    assessment: '',
    changesToday: '',
    planNext24h: '',
    dispositionPlan: '',
    progressSummary: '',
  });
  const [savingProgress, setSavingProgress] = useState(false);

  // New order dialog
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [newOrderKind, setNewOrderKind] = useState<'LAB' | 'IMAGING' | 'NURSING'>('LAB');
  const [newOrderTitle, setNewOrderTitle] = useState('');
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  // Discharge dialog
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [dischargeDisposition, setDischargeDisposition] = useState('HOME');
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [dischargeBusy, setDischargeBusy] = useState(false);

  // ── Data fetching ──
  const allParam = showAllPatients ? '&all=true' : '';
  const { data: patientsData, mutate: mutatePt, isValidating } = useSWR(
    hasPermission ? `/api/ipd/doctors/my-patients?ward=${wardFilter === 'ALL' ? '' : wardFilter}&status=${statusFilter === 'ALL' ? '' : statusFilter}${allParam}` : null,
    fetcher,
    { refreshInterval: 30000, keepPreviousData: true },
  );

  const { data: roundingData, mutate: mutateRounding } = useSWR(
    selectedEpId ? `/api/ipd/doctors/rounding-summary?episodeId=${selectedEpId}` : null,
    fetcher,
    { keepPreviousData: true },
  );

  const episodes: PatientEpisode[] = useMemo(
    () => (Array.isArray(patientsData?.items) ? patientsData.items : []),
    [patientsData],
  );
  const kpis = patientsData?.kpis || { myPatients: 0, needRounding: 0, pendingResults: 0, dischargeReady: 0 };
  const wards: string[] = patientsData?.wards || [];
  const rounding: RoundingSummary | null = roundingData || null;

  // ── Filter & sort ──
  const filtered = useMemo(() => {
    let list = episodes;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (ep) =>
          ep.patientName.toLowerCase().includes(q) ||
          ep.patientId.toLowerCase().includes(q) ||
          (ep.location?.bed || '').toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'bed':
          return (a.location?.bed || '').localeCompare(b.location?.bed || '');
        case 'acuity':
          return (Number(b.latestAssessment?.mewsScore) || 0) - (Number(a.latestAssessment?.mewsScore) || 0);
        case 'los':
          return b.losDays - a.losDays;
        case 'name':
          return a.patientName.localeCompare(b.patientName);
        default:
          return 0;
      }
    });
    return list;
  }, [episodes, searchQ, sortBy]);

  const selectedEp = useMemo(() => episodes.find((ep) => ep.id === selectedEpId) || null, [episodes, selectedEpId]);

  // Reset tab on patient change
  useEffect(() => {
    setActiveTab('overview');
    setProgressForm({ assessment: '', changesToday: '', planNext24h: '', dispositionPlan: '', progressSummary: '' });
  }, [selectedEpId]);

  // ── Handlers ──
  const handleSaveProgress = useCallback(async () => {
    if (!selectedEpId) return;
    if (!progressForm.assessment.trim() || !progressForm.planNext24h.trim()) {
      toast({ title: tr('يرجى تعبئة التقييم وخطة الـ 24 ساعة', 'Please fill assessment and 24h plan'), variant: 'destructive' });
      return;
    }
    setSavingProgress(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${selectedEpId}/doctor-progress`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.noOp) {
        toast({ title: tr('تم تسجيل الملاحظة مسبقاً اليوم', 'Progress note already recorded today') });
      } else {
        toast({ title: tr('تم حفظ الملاحظة اليومية', 'Daily progress saved') });
        setProgressForm({ assessment: '', changesToday: '', planNext24h: '', dispositionPlan: '', progressSummary: '' });
      }
      mutateRounding();
      mutatePt();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err as Error)?.message || String(err), variant: 'destructive' });
    } finally {
      setSavingProgress(false);
    }
  }, [selectedEpId, progressForm, toast, tr, mutateRounding, mutatePt]);

  const handleCreateOrder = useCallback(async () => {
    if (!selectedEpId || !newOrderTitle.trim()) return;
    setSavingOrder(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${selectedEpId}/orders`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: newOrderKind, title: newOrderTitle.trim(), notes: newOrderNotes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: tr('تم إنشاء الطلب', 'Order created') });
      setOrderDialogOpen(false);
      setNewOrderTitle('');
      setNewOrderNotes('');
      mutateRounding();
      mutatePt();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err as Error)?.message || String(err), variant: 'destructive' });
    } finally {
      setSavingOrder(false);
    }
  }, [selectedEpId, newOrderKind, newOrderTitle, newOrderNotes, toast, tr, mutateRounding, mutatePt]);

  const handleAckResult = useCallback(async (resultId: string) => {
    if (!selectedEp) return;
    try {
      const res = await fetch(`/api/results/${resultId}/ack`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      toast({ title: tr('تم الإقرار', 'Acknowledged') });
      mutateRounding();
      mutatePt();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err as Error)?.message || String(err), variant: 'destructive' });
    }
  }, [selectedEp, toast, tr, mutateRounding, mutatePt]);

  const handleDischarge = useCallback(async () => {
    if (!selectedEp || !dischargeSummary.trim()) return;
    setDischargeBusy(true);
    try {
      const res = await fetch('/api/discharge/finalize', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encounterCoreId: selectedEp.encounterCoreId,
          disposition: dischargeDisposition,
          summary: dischargeSummary.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: tr('تم إنهاء الخروج', 'Discharge finalized') });
      setDischargeOpen(false);
      setDischargeSummary('');
      mutatePt();
    } catch (err: unknown) {
      toast({ title: tr('خطأ', 'Error'), description: (err as Error)?.message || String(err), variant: 'destructive' });
    } finally {
      setDischargeBusy(false);
    }
  }, [selectedEp, dischargeDisposition, dischargeSummary, toast, tr, mutatePt]);

  // ── Loading & permissions ──
  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {tr('لا تملك صلاحية الوصول', 'Access denied')}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold">{tr('محطة طبيب التنويم', 'IPD Doctor Station')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showAllPatients}
              onChange={(e) => setShowAllPatients(e.target.checked)}
              className="rounded"
            />
            {tr('عرض جميع المرضى', 'Show all patients')}
          </label>
          <Button variant="outline" size="sm" onClick={() => mutatePt()} disabled={isValidating}>
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 border-b">
        <TheaKpiCard
          label={tr('مرضاي', 'My Patients')}
          value={kpis.myPatients}
          icon={<User className="w-5 h-5 text-blue-600" />}
        />
        <TheaKpiCard
          label={tr('بحاجة لجولة', 'Need Rounding')}
          value={kpis.needRounding}
          icon={<ClipboardList className="w-5 h-5 text-amber-600" />}

        />
        <TheaKpiCard
          label={tr('نتائج معلقة', 'Pending Results')}
          value={kpis.pendingResults}
          icon={<FlaskConical className="w-5 h-5 text-purple-600" />}
        />
        <TheaKpiCard
          label={tr('جاهز للخروج', 'Discharge Ready')}
          value={kpis.dischargeReady}
          icon={<LogOut className="w-5 h-5 text-green-600" />}
        />
      </div>

      {/* ── Main Layout (List + Detail) ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Patient List ── */}
        <div className={`${selectedEpId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-${isRTL ? 'l' : 'r'} bg-card overflow-y-auto`}>
          {/* Filters */}
          <div className="p-3 border-b space-y-2">
            <div className="relative">
              <Search className={`absolute ${isRTL ? 'right-2' : 'left-2'} top-2.5 w-4 h-4 text-muted-foreground`} />
              <Input
                placeholder={tr('بحث بالاسم أو السرير...', 'Search by name or bed...')}
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className={`${isRTL ? 'pr-8' : 'pl-8'} h-9`}
              />
            </div>
            <div className="flex gap-2">
              <Select value={wardFilter} onValueChange={setWardFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={tr('الجناح', 'Ward')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                  {wards.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder={tr('الحالة', 'Status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
                  <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
                  <SelectItem value="DISCHARGE_READY">{tr('جاهز للخروج', 'Discharge Ready')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'bed' | 'acuity' | 'los' | 'name')}>
                <SelectTrigger className="h-8 text-xs w-24">
                  <ArrowUpDown className="w-3 h-3" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bed">{tr('السرير', 'Bed')}</SelectItem>
                  <SelectItem value="acuity">{tr('الحدة', 'Acuity')}</SelectItem>
                  <SelectItem value="los">{tr('مدة الإقامة', 'LOS')}</SelectItem>
                  <SelectItem value="name">{tr('الاسم', 'Name')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Patient Cards */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <User className="w-10 h-10 mb-2" />
              <p className="text-sm">{tr('لا يوجد مرضى', 'No patients')}</p>
            </div>
          )}
          {filtered.map((ep) => (
            <button
              key={ep.id}
              onClick={() => setSelectedEpId(ep.id)}
              className={`w-full text-${isRTL ? 'right' : 'left'} p-3 border-b hover:bg-blue-50 transition-colors ${
                selectedEpId === ep.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!ep.hasProgressToday && (
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title={tr('لم يتم الجولة', 'Not rounded')} />
                    )}
                    <span className="font-medium text-sm truncate">{ep.patientName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <BedDouble className="w-3 h-3" />
                    <span>
                      {[ep.location?.ward, ep.location?.room, ep.location?.bed].filter(Boolean).join(' / ') || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {tr('يوم', 'Day')} {ep.losDays}
                    </span>
                    {ep.pendingResultsCount > 0 && (
                      <span className="text-purple-600 font-medium">
                        {ep.pendingResultsCount} {tr('نتيجة', 'result')}
                      </span>
                    )}
                    {ep.pendingOrdersCount > 0 && (
                      <span className="text-amber-600 font-medium">
                        {ep.pendingOrdersCount} {tr('طلب', 'order')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {/* Status badge */}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    ep.status === 'DISCHARGE_READY'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {ep.status === 'DISCHARGE_READY' ? tr('جاهز للخروج', 'Ready') : tr('نشط', 'Active')}
                  </span>
                  {/* MEWS badge */}
                  {ep.latestAssessment && (
                    <MewsBadgeInline score={ep.latestAssessment.mewsScore as number} level={ep.latestAssessment.mewsLevel as string} tr={tr} />
                  )}
                </div>
              </div>
              {ep.reasonForAdmission && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{ep.reasonForAdmission}</p>
              )}
            </button>
          ))}
        </div>

        {/* ── RIGHT: Detail Panel ── */}
        <div className={`${selectedEpId ? 'flex' : 'hidden md:flex'} flex-col flex-1 overflow-y-auto bg-muted/50`}>
          {!selectedEpId ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Stethoscope className="w-12 h-12 mb-3" />
              <p>{tr('اختر مريضاً للبدء', 'Select a patient to begin')}</p>
            </div>
          ) : (
            <>
              {/* Patient header */}
              <div className="bg-card border-b p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedEpId(null)} className="md:hidden p-1 rounded hover:bg-muted">
                        <ChevronRight className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
                      </button>
                      <h2 className="text-lg font-semibold">{selectedEp?.patientName || '...'}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        selectedEp?.status === 'DISCHARGE_READY' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {selectedEp?.status === 'DISCHARGE_READY' ? tr('جاهز للخروج', 'Discharge Ready') : tr('نشط', 'Active')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {[selectedEp?.location?.ward, selectedEp?.location?.room, selectedEp?.location?.bed].filter(Boolean).join(' / ')}
                      {' — '}
                      {tr('يوم', 'Day')} {selectedEp?.losDays || 1}
                      {selectedEp?.reasonForAdmission ? ` — ${selectedEp.reasonForAdmission}` : ''}
                    </p>
                  </div>
                  {/* Allergy warning */}
                  {selectedEp && selectedEp.allergiesCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {selectedEp.allergiesCount} {tr('حساسية', 'Allergies')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="mx-4 mt-2 flex flex-wrap gap-1 justify-start bg-transparent">
                  <TabsTrigger value="overview" className="text-xs">{tr('نظرة عامة', 'Overview')}</TabsTrigger>
                  <TabsTrigger value="progress" className="text-xs">
                    {tr('الجولة اليومية', 'Daily Progress')}
                    {selectedEp && !selectedEp.hasProgressToday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 ms-1" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="orders" className="text-xs">{tr('الطلبات', 'Orders')}</TabsTrigger>
                  <TabsTrigger value="results" className="text-xs">
                    {tr('النتائج', 'Results')}
                    {(rounding?.results?.filter((r) => !r.acknowledged).length || 0) > 0 && (
                      <span className="ms-1 text-[10px] bg-purple-100 text-purple-700 px-1 rounded-full">
                        {rounding?.results?.filter((r) => !r.acknowledged).length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="vitals" className="text-xs">{tr('المؤشرات الحيوية', 'Vitals')}</TabsTrigger>
                  <TabsTrigger value="careplans" className="text-xs">{tr('خطط العلاج', 'Care Plans')}</TabsTrigger>
                  <TabsTrigger value="discharge" className="text-xs">{tr('الخروج', 'Discharge')}</TabsTrigger>
                </TabsList>

                {/* ─── TAB: Overview ─── */}
                <TabsContent value="overview" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <OverviewTab rounding={rounding} ep={selectedEp} tr={tr} />
                </TabsContent>

                {/* ─── TAB: Daily Progress ─── */}
                <TabsContent value="progress" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <ProgressTab
                    rounding={rounding}
                    form={progressForm}
                    setForm={setProgressForm}
                    saving={savingProgress}
                    onSave={handleSaveProgress}
                    hasProgressToday={selectedEp?.hasProgressToday || false}
                    tr={tr}
                  />
                </TabsContent>

                {/* ─── TAB: Orders ─── */}
                <TabsContent value="orders" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <OrdersTab
                    rounding={rounding}
                    onNewOrder={() => setOrderDialogOpen(true)}
                    tr={tr}
                  />
                </TabsContent>

                {/* ─── TAB: Results ─── */}
                <TabsContent value="results" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <ResultsTab rounding={rounding} onAck={handleAckResult} tr={tr} />
                </TabsContent>

                {/* ─── TAB: Vitals ─── */}
                <TabsContent value="vitals" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <VitalsTab rounding={rounding} tr={tr} />
                </TabsContent>

                {/* ─── TAB: Care Plans ─── */}
                <TabsContent value="careplans" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <CarePlansTab rounding={rounding} tr={tr} />
                </TabsContent>

                {/* ─── TAB: Discharge ─── */}
                <TabsContent value="discharge" className="flex-1 overflow-y-auto p-4 space-y-4">
                  <DischargeTab
                    ep={selectedEp}
                    rounding={rounding}
                    onDischarge={() => setDischargeOpen(true)}
                    tr={tr}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* ── New Order Dialog ── */}
      <Dialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('طلب جديد', 'New Order')}</DialogTitle>
            <DialogDescription>{tr('إنشاء طلب مختبر أو أشعة أو تمريض', 'Create a lab, imaging, or nursing order')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={newOrderKind} onValueChange={(v) => setNewOrderKind(v as 'LAB' | 'IMAGING' | 'NURSING')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LAB">{tr('مختبر', 'Lab')}</SelectItem>
                <SelectItem value="IMAGING">{tr('أشعة', 'Imaging')}</SelectItem>
                <SelectItem value="NURSING">{tr('تمريض', 'Nursing')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={tr('اسم الفحص / الطلب', 'Test / Order name')}
              value={newOrderTitle}
              onChange={(e) => setNewOrderTitle(e.target.value)}
            />
            <Textarea
              placeholder={tr('ملاحظات (اختياري)', 'Notes (optional)')}
              value={newOrderNotes}
              onChange={(e) => setNewOrderNotes(e.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderDialogOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleCreateOrder} disabled={savingOrder || !newOrderTitle.trim()}>
              {savingOrder ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Discharge Dialog ── */}
      <Dialog open={dischargeOpen} onOpenChange={setDischargeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tr('إنهاء الخروج', 'Finalize Discharge')}</DialogTitle>
            <DialogDescription>{tr('تأكد من جميع البيانات قبل إنهاء الخروج', 'Verify all data before finalizing discharge')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{tr('التصرف', 'Disposition')}</label>
              <Select value={dischargeDisposition} onValueChange={setDischargeDisposition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">{tr('خروج للمنزل', 'Home')}</SelectItem>
                  <SelectItem value="AMA">{tr('خروج ضد النصيحة الطبية', 'AMA')}</SelectItem>
                  <SelectItem value="LAMA">{tr('خروج بناءً على طلب المريض', 'LAMA')}</SelectItem>
                  <SelectItem value="TRANSFER_OUT">{tr('تحويل', 'Transfer Out')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{tr('ملخص الخروج', 'Discharge Summary')}</label>
              <Textarea
                value={dischargeSummary}
                onChange={(e) => setDischargeSummary(e.target.value)}
                rows={5}
                placeholder={tr('تشخيص، علاج، تعليمات المتابعة...', 'Diagnosis, treatment, follow-up instructions...')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDischargeOpen(false)}>
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button onClick={handleDischarge} disabled={dischargeBusy || !dischargeSummary.trim()} variant="destructive">
              {dischargeBusy ? tr('جاري الإنهاء...', 'Finalizing...') : tr('إنهاء الخروج', 'Finalize Discharge')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Sub-components (Tabs)
   ══════════════════════════════════════════════════════════════ */

function MewsBadgeInline({ score, level, tr }: { score: number; level: string; tr: (ar: string, en: string) => string }) {
  const colors: Record<string, string> = {
    LOW: 'bg-green-100 text-green-700',
    MEDIUM: 'bg-amber-100 text-amber-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[level] || colors.LOW}`}>
      {tr('MEWS', 'MEWS')} {score}
    </span>
  );
}

/* ── Overview Tab ── */
function OverviewTab({ rounding, ep, tr }: { rounding: RoundingSummary | null; ep: PatientEpisode | null; tr: (ar: string, en: string) => string }) {
  if (!rounding || !ep) return <LoadingPlaceholder tr={tr} />;

  const vitals = (rounding.vitalsTrend.length > 0 ? rounding.vitalsTrend[rounding.vitalsTrend.length - 1]?.vitals : null) as Record<string, unknown> | null;

  return (
    <>
      {/* Demographics */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-medium text-sm mb-3">{tr('بيانات المريض', 'Patient Info')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <InfoRow label={tr('الاسم', 'Name')} value={ep.patientName} />
          <InfoRow label={tr('الموقع', 'Location')} value={[ep.location?.ward, ep.location?.room, ep.location?.bed].filter(Boolean).join(' / ')} />
          <InfoRow label={tr('مدة الإقامة', 'LOS')} value={`${ep.losDays} ${tr('يوم', 'days')}`} />
          <InfoRow label={tr('سبب الدخول', 'Reason')} value={ep.reasonForAdmission || '—'} />
          <InfoRow label={tr('القسم', 'Service')} value={ep.serviceUnit || '—'} />
          <InfoRow label={tr('الحالة', 'Status')} value={ep.status} />
        </div>
      </div>

      {/* Latest Vitals */}
      {vitals && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-red-500" />
            {tr('آخر المؤشرات الحيوية', 'Latest Vitals')}
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <VitalBox label={tr('ضغط الدم', 'BP')} value={vitals.systolic && vitals.diastolic ? `${vitals.systolic}/${vitals.diastolic}` : '—'} unit="mmHg" />
            <VitalBox label={tr('النبض', 'HR')} value={String(vitals.hr || '—')} unit="bpm" />
            <VitalBox label={tr('التنفس', 'RR')} value={String(vitals.rr || '—')} unit="/min" />
            <VitalBox label={tr('الحرارة', 'Temp')} value={String(vitals.temp || '—')} unit="°C" />
            <VitalBox label={tr('تشبع الأكسجين', 'SpO2')} value={String(vitals.spo2 || '—')} unit="%" />
            <VitalBox label={tr('وزن', 'Wt')} value={String(vitals.weight || '—')} unit="kg" />
          </div>
        </div>
      )}

      {/* Assessment */}
      {rounding.latestAssessment && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-3">{tr('التقييم التمريضي', 'Nursing Assessment')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex flex-col items-center p-2 bg-muted/50 rounded">
              <span className="text-xs text-muted-foreground">{tr('مقياس MEWS', 'MEWS')}</span>
              <MewsBadgeInline score={rounding.latestAssessment.mewsScore as number} level={rounding.latestAssessment.mewsLevel as string} tr={tr} />
            </div>
            {rounding.latestAssessment.bradenScore != null && (
              <div className="flex flex-col items-center p-2 bg-muted/50 rounded">
                <span className="text-xs text-muted-foreground">{tr('مقياس برادن', 'Braden')}</span>
                <span className="text-sm font-medium">{String(rounding.latestAssessment.bradenScore)}</span>
              </div>
            )}
            {rounding.latestAssessment.fallRiskScore != null && (
              <div className="flex flex-col items-center p-2 bg-muted/50 rounded">
                <span className="text-xs text-muted-foreground">{tr('خطر السقوط', 'Fall Risk')}</span>
                <span className="text-sm font-medium">{String(rounding.latestAssessment.fallRiskScore)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fluid Balance */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-500" />
          {tr('ميزان السوائل (48 ساعة)', 'Fluid Balance (48h)')}
        </h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 bg-blue-50 rounded">
            <span className="text-xs text-muted-foreground">{tr('الداخل', 'Intake')}</span>
            <p className="font-semibold">{rounding.fluidBalance.intake} ml</p>
          </div>
          <div className="p-2 bg-amber-50 rounded">
            <span className="text-xs text-muted-foreground">{tr('الخارج', 'Output')}</span>
            <p className="font-semibold">{rounding.fluidBalance.output} ml</p>
          </div>
          <div className={`p-2 rounded ${rounding.fluidBalance.net >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <span className="text-xs text-muted-foreground">{tr('الصافي', 'Net')}</span>
            <p className="font-semibold">{rounding.fluidBalance.net > 0 ? '+' : ''}{rounding.fluidBalance.net} ml</p>
          </div>
        </div>
      </div>

      {/* Allergies & Problems */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            {tr('الحساسية', 'Allergies')}
          </h3>
          {rounding.allergies.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا يوجد حساسية مسجلة', 'No known allergies')}</p>
          ) : (
            <ul className="space-y-1">
              {rounding.allergies.map((a: Record<string, unknown>, i: number) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${a.severity === 'SEVERE' ? 'bg-red-500' : a.severity === 'MODERATE' ? 'bg-amber-500' : 'bg-yellow-400'}`} />
                  {String(a.name)}
                  <span className="text-xs text-muted-foreground">({String(a.type)})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-2">{tr('المشاكل النشطة', 'Active Problems')}</h3>
          {rounding.activeProblems.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا يوجد', 'None')}</p>
          ) : (
            <ul className="space-y-1">
              {rounding.activeProblems.map((p: Record<string, unknown>, i: number) => (
                <li key={i} className="text-sm">
                  {String(p.name)}
                  {p.icd10 && <span className="text-xs text-muted-foreground ms-1">({String(p.icd10)})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Progress Tab ── */
function ProgressTab({
  rounding, form, setForm, saving, onSave, hasProgressToday, tr,
}: {
  rounding: RoundingSummary | null;
  form: { assessment: string; changesToday: string; planNext24h: string; dispositionPlan: string; progressSummary: string };
  setForm: (f: { assessment: string; changesToday: string; planNext24h: string; dispositionPlan: string; progressSummary: string }) => void;
  saving: boolean;
  onSave: () => void;
  hasProgressToday: boolean;
  tr: (ar: string, en: string) => string;
}) {
  return (
    <>
      {/* New Progress Note Form */}
      <div className="bg-card rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">{tr('ملاحظة الجولة اليومية', 'Daily Rounding Note')}</h3>
          {hasProgressToday && (
            <Badge className="bg-green-100 text-green-700 text-xs">{tr('تم التسجيل اليوم', 'Recorded today')}</Badge>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {tr('التقييم السريري', 'Clinical Assessment')} <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={form.assessment}
            onChange={(e) => setForm({ ...form, assessment: e.target.value })}
            rows={3}
            placeholder={tr('الحالة العامة، الفحص السريري، المخاوف...', 'General condition, clinical exam, concerns...')}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{tr('التغييرات اليوم', 'Changes Today')}</label>
          <Textarea
            value={form.changesToday}
            onChange={(e) => setForm({ ...form, changesToday: e.target.value })}
            rows={2}
            placeholder={tr('تعديلات الأدوية، نتائج جديدة، مستجدات...', 'Med adjustments, new results, updates...')}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">
            {tr('خطة الـ 24 ساعة القادمة', 'Plan for Next 24 Hours')} <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={form.planNext24h}
            onChange={(e) => setForm({ ...form, planNext24h: e.target.value })}
            rows={2}
            placeholder={tr('الخطة العلاجية، الفحوصات، المتابعة...', 'Treatment plan, investigations, follow-up...')}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">{tr('خطة التصرف', 'Disposition Plan')}</label>
          <Textarea
            value={form.dispositionPlan}
            onChange={(e) => setForm({ ...form, dispositionPlan: e.target.value })}
            rows={1}
            placeholder={tr('استمرار التنويم، خروج متوقع، تحويل...', 'Continue admission, expected discharge, transfer...')}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving || !form.assessment.trim() || !form.planNext24h.trim()}>
            {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save Progress Note')}
          </Button>
        </div>
      </div>

      {/* Previous Notes */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-medium text-sm mb-3">{tr('الملاحظات السابقة', 'Previous Notes')}</h3>
        {!rounding?.progressNotes?.length ? (
          <p className="text-xs text-muted-foreground">{tr('لا يوجد ملاحظات سابقة', 'No previous notes')}</p>
        ) : (
          <div className="space-y-3">
            {rounding.progressNotes.map((note: Record<string, unknown>) => (
              <div key={String(note.id)} className="border rounded p-3 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-600">{String(note.date || '—')}</span>
                  <span className="text-xs text-muted-foreground">{String((note.author as Record<string, unknown>)?.name || '—')}</span>
                </div>
                <div className="space-y-1 text-xs">
                  {note.assessment && (
                    <div>
                      <span className="font-medium">{tr('التقييم: ', 'Assessment: ')}</span>
                      {String(note.assessment)}
                    </div>
                  )}
                  {note.changesToday && (
                    <div>
                      <span className="font-medium">{tr('التغييرات: ', 'Changes: ')}</span>
                      {String(note.changesToday)}
                    </div>
                  )}
                  {note.planNext24h && (
                    <div>
                      <span className="font-medium">{tr('الخطة: ', 'Plan: ')}</span>
                      {String(note.planNext24h)}
                    </div>
                  )}
                  {note.dispositionPlan && (
                    <div>
                      <span className="font-medium">{tr('التصرف: ', 'Disposition: ')}</span>
                      {String(note.dispositionPlan)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Orders Tab ── */
function OrdersTab({ rounding, onNewOrder, tr }: { rounding: RoundingSummary | null; onNewOrder: () => void; tr: (ar: string, en: string) => string }) {
  if (!rounding) return <LoadingPlaceholder tr={tr} />;

  const STATUS_STYLE: Record<string, string> = {
    ORDERED: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-blue-100 text-blue-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-700 line-through',
    DRAFT: 'bg-muted text-muted-foreground',
  };

  return (
    <>
      {/* Medication Orders */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Pill className="w-4 h-4 text-blue-600" />
            {tr('أوامر الأدوية', 'Medication Orders')}
          </h3>
        </div>
        {rounding.medOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">{tr('لا يوجد أوامر أدوية', 'No medication orders')}</p>
        ) : (
          <div className="space-y-2">
            {rounding.medOrders.map((o: Record<string, unknown>) => (
              <div key={String(o.id)} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <div>
                  <span className="font-medium">{String(o.drugName)}</span>
                  <span className="text-xs text-muted-foreground ms-2">
                    {String(o.dose)} {String(o.doseUnit)} — {String(o.route)} — {String(o.frequency || o.orderType)}
                  </span>
                  {o.isNarcotic && (
                    <Badge className="ms-2 text-[10px] bg-red-100 text-red-700">{tr('مخدر', 'Narcotic')}</Badge>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status as string] || STATUS_STYLE.DRAFT}`}>
                  {String(o.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lab/Imaging Orders */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-purple-600" />
            {tr('طلبات مختبر / أشعة', 'Lab / Imaging Orders')}
          </h3>
          <Button size="sm" variant="outline" onClick={onNewOrder} className="gap-1 text-xs">
            <Plus className="w-3 h-3" />
            {tr('طلب جديد', 'New Order')}
          </Button>
        </div>
        {rounding.labImagingOrders.length === 0 ? (
          <p className="text-xs text-muted-foreground">{tr('لا يوجد طلبات', 'No orders')}</p>
        ) : (
          <div className="space-y-2">
            {rounding.labImagingOrders.map((o: Record<string, unknown>) => (
              <div key={String(o.id)} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                <div>
                  <Badge variant="outline" className="text-[10px] me-2">{String(o.kind)}</Badge>
                  <span>{String(o.title)}</span>
                  {o.notes && <span className="text-xs text-muted-foreground ms-2">— {String(o.notes)}</span>}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status as string] || STATUS_STYLE.DRAFT}`}>
                  {String(o.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ── Results Tab ── */
function ResultsTab({ rounding, onAck, tr }: { rounding: RoundingSummary | null; onAck: (id: string) => void; tr: (ar: string, en: string) => string }) {
  if (!rounding) return <LoadingPlaceholder tr={tr} />;
  const unacked = rounding.results.filter((r) => !r.acknowledged);
  const acked = rounding.results.filter((r) => r.acknowledged);

  return (
    <>
      {/* Pending */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-medium text-sm mb-3 text-purple-700">
          {tr('نتائج تنتظر الإقرار', 'Pending Acknowledgment')} ({unacked.length})
        </h3>
        {unacked.length === 0 ? (
          <p className="text-xs text-muted-foreground">{tr('لا يوجد نتائج معلقة', 'No pending results')}</p>
        ) : (
          <div className="space-y-2">
            {unacked.map((r: Record<string, unknown>) => (
              <div key={String(r.id)} className={`flex items-center justify-between p-2 rounded text-sm ${r.criticalFlag ? 'bg-red-50 border border-red-200' : r.abnormal ? 'bg-amber-50 border border-amber-200' : 'bg-muted/50'}`}>
                <div>
                  <span className="font-medium">{String(r.orderName)}</span>
                  {r.value != null && (
                    <span className="ms-2 text-xs">
                      {String(r.value)} {String(r.unit)}
                    </span>
                  )}
                  {r.criticalFlag && (
                    <Badge className="ms-2 text-[10px] bg-red-100 text-red-800">{tr('حرج', 'Critical')}</Badge>
                  )}
                  {r.abnormal && !r.criticalFlag && (
                    <Badge className="ms-2 text-[10px] bg-amber-100 text-amber-800">{tr('غير طبيعي', 'Abnormal')}</Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => onAck(String(r.id))} className="text-xs">
                  <CheckCircle2 className="w-3 h-3 me-1" />
                  {tr('إقرار', 'Ack')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acknowledged */}
      {acked.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-3 text-muted-foreground">
            {tr('نتائج تم إقرارها', 'Acknowledged Results')} ({acked.length})
          </h3>
          <div className="space-y-1">
            {acked.map((r: Record<string, unknown>) => (
              <div key={String(r.id)} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm text-muted-foreground">
                <div>
                  <span>{String(r.orderName)}</span>
                  {r.value != null && <span className="ms-2 text-xs">{String(r.value)} {String(r.unit)}</span>}
                </div>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Vitals Tab ── */
function VitalsTab({ rounding, tr }: { rounding: RoundingSummary | null; tr: (ar: string, en: string) => string }) {
  if (!rounding) return <LoadingPlaceholder tr={tr} />;
  const trend = rounding.vitalsTrend || [];

  return (
    <div className="bg-card rounded-lg border p-4">
      <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-600" />
        {tr('اتجاه المؤشرات الحيوية (48 ساعة)', 'Vitals Trend (48h)')}
      </h3>
      {trend.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr('لا يوجد بيانات', 'No data')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 text-start">{tr('الوقت', 'Time')}</th>
                <th className="py-2">{tr('ضغط الدم', 'BP')}</th>
                <th className="py-2">{tr('النبض', 'HR')}</th>
                <th className="py-2">{tr('التنفس', 'RR')}</th>
                <th className="py-2">{tr('الحرارة', 'Temp')}</th>
                <th className="py-2">{tr('تشبع الأكسجين', 'SpO2')}</th>
                <th className="py-2">{tr('ألم', 'Pain')}</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((v: Record<string, unknown>, i: number) => {
                const vit = (v.vitals || {}) as Record<string, unknown>;
                const time = v.time ? new Date(v.time as string).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                return (
                  <tr key={i} className={`border-b ${v.critical ? 'bg-red-50' : ''}`}>
                    <td className="py-1.5 text-start">{time}</td>
                    <td className="py-1.5 text-center">{vit.systolic && vit.diastolic ? `${vit.systolic}/${vit.diastolic}` : '—'}</td>
                    <td className="py-1.5 text-center">{String(vit.hr || '—')}</td>
                    <td className="py-1.5 text-center">{String(vit.rr || '—')}</td>
                    <td className="py-1.5 text-center">{String(vit.temp || '—')}</td>
                    <td className="py-1.5 text-center">{String(vit.spo2 || '—')}</td>
                    <td className="py-1.5 text-center">{String(v.painScore ?? '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Care Plans Tab ── */
function CarePlansTab({ rounding, tr }: { rounding: RoundingSummary | null; tr: (ar: string, en: string) => string }) {
  if (!rounding) return <LoadingPlaceholder tr={tr} />;

  return (
    <div className="bg-card rounded-lg border p-4">
      <h3 className="font-medium text-sm mb-3">{tr('خطط العلاج النشطة', 'Active Care Plans')}</h3>
      {rounding.carePlans.length === 0 ? (
        <p className="text-xs text-muted-foreground">{tr('لا يوجد خطط علاجية نشطة', 'No active care plans')}</p>
      ) : (
        <div className="space-y-3">
          {rounding.carePlans.map((cp: Record<string, unknown>) => (
            <div key={String(cp.id)} className="border rounded p-3 text-sm space-y-1">
              <div>
                <span className="font-medium text-xs text-muted-foreground">{tr('المشكلة', 'Problem')}: </span>
                <span>{String(cp.problem)}</span>
              </div>
              {cp.goals && (
                <div>
                  <span className="font-medium text-xs text-muted-foreground">{tr('الأهداف', 'Goals')}: </span>
                  <span>{String(cp.goals)}</span>
                </div>
              )}
              {cp.interventions && (
                <div>
                  <span className="font-medium text-xs text-muted-foreground">{tr('التدخلات', 'Interventions')}: </span>
                  <span>{String(cp.interventions)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Discharge Tab ── */
function DischargeTab({ ep, rounding, onDischarge, tr }: { ep: PatientEpisode | null; rounding: RoundingSummary | null; onDischarge: () => void; tr: (ar: string, en: string) => string }) {
  if (!ep || !rounding) return <LoadingPlaceholder tr={tr} />;

  const pendingMeds = rounding.medOrders.filter((o) => o.status === 'ORDERED' || o.status === 'ACTIVE');
  const pendingOrders = rounding.labImagingOrders.filter((o) => o.status === 'DRAFT' || o.status === 'ORDERED');
  const unackedResults = rounding.results.filter((r) => !r.acknowledged);
  const hasBlockers = pendingMeds.length > 0 || pendingOrders.length > 0 || unackedResults.length > 0;

  return (
    <>
      {/* Discharge Readiness */}
      <div className="bg-card rounded-lg border p-4">
        <h3 className="font-medium text-sm mb-3">{tr('جاهزية الخروج', 'Discharge Readiness')}</h3>
        <div className="space-y-2">
          <ReadinessItem
            ok={pendingMeds.length === 0}
            label={tr('أوامر الأدوية', 'Medication Orders')}
            detail={pendingMeds.length === 0 ? tr('لا يوجد أوامر نشطة', 'No active orders') : `${pendingMeds.length} ${tr('أمر نشط', 'active order(s)')}`}
          />
          <ReadinessItem
            ok={pendingOrders.length === 0}
            label={tr('طلبات المختبر / الأشعة', 'Lab/Imaging Orders')}
            detail={pendingOrders.length === 0 ? tr('لا يوجد طلبات معلقة', 'No pending orders') : `${pendingOrders.length} ${tr('طلب معلق', 'pending')}`}
          />
          <ReadinessItem
            ok={unackedResults.length === 0}
            label={tr('النتائج', 'Results')}
            detail={unackedResults.length === 0 ? tr('جميع النتائج تم إقرارها', 'All results acknowledged') : `${unackedResults.length} ${tr('نتيجة لم يتم إقرارها', 'unacknowledged')}`}
          />
        </div>
      </div>

      {/* Discharge Button */}
      <div className="bg-card rounded-lg border p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{tr('إنهاء خروج المريض', 'Finalize Patient Discharge')}</p>
          {hasBlockers && (
            <p className="text-xs text-amber-600 mt-1">
              {tr('توجد عناصر معلقة — يمكنك الاستمرار مع تحذير', 'Pending items exist — you can proceed with a warning')}
            </p>
          )}
        </div>
        <Button onClick={onDischarge} variant={hasBlockers ? 'outline' : 'default'} className="gap-1">
          <LogOut className="w-4 h-4" />
          {tr('إنهاء الخروج', 'Discharge')}
        </Button>
      </div>

      {/* Active Medications for Reconciliation */}
      {pendingMeds.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-medium text-sm mb-3">{tr('الأدوية النشطة (للمراجعة)', 'Active Medications (for Review)')}</h3>
          <div className="space-y-1">
            {pendingMeds.map((m: Record<string, unknown>) => (
              <div key={String(m.id)} className="text-sm p-1.5 bg-muted/50 rounded">
                {String(m.drugName)} — {String(m.dose)} {String(m.doseUnit)} {String(m.route)} {String(m.frequency)}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Helpers ── */
function LoadingPlaceholder({ tr }: { tr: (ar: string, en: string) => string }) {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <RefreshCw className="w-5 h-5 animate-spin me-2" />
      {tr('جاري التحميل...', 'Loading...')}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

function VitalBox({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="text-center p-2 bg-muted/50 rounded">
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      <p className="text-sm font-semibold">{value}</p>
      <span className="text-[10px] text-muted-foreground">{unit}</span>
    </div>
  );
}

function ReadinessItem({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      )}
      <div>
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground ms-2">{detail}</span>
      </div>
    </div>
  );
}
