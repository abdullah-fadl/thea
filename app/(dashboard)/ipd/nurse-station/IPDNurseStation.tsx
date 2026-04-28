'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useMe } from '@/lib/hooks/useMe';
import {
  Activity, Heart, Clock, User, Search, RefreshCw, AlertCircle, CheckCircle2,
  ChevronRight, ChevronLeft, ChevronDown, X, Clipboard, Stethoscope, Plus,
  BedDouble, ArrowUpDown, Filter, ClipboardList,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TheaKpiCard } from '@/components/thea-ui';
import { DEPARTMENT_PROFILES } from '@/lib/clinical/departmentNursingConfig';
import { VitalsEntry, type VitalsEntryValues } from '@/components/clinical/VitalsEntry';
import { MEWSBadge } from '@/components/nursing/MEWSBadge';
import {
  CONSCIOUSNESS_OPTIONS, type ConsciousnessLevel, vitalsToMEWSInput, calculateMEWS,
} from '@/lib/clinical/mewsCalculator';
import { FallRiskAssessment } from '@/components/nursing/FallRiskAssessment';
import { GCSAssessment } from '@/components/nursing/GCSAssessment';
import { SBARForm } from '@/components/nursing/SBARForm';
import type { SBARData } from '@/lib/clinical/sbarTemplate';
import { PainAssessment } from '@/components/nursing/PainAssessment';
import type { PainEntry } from '@/lib/clinical/painAssessment';
import { IntakeOutputTracker } from '@/components/nursing/IntakeOutputTracker';
import type { IOData } from '@/lib/clinical/intakeOutput';
import { BradenAssessment } from '@/components/nursing/BradenAssessment';
import type { BradenResult } from '@/lib/clinical/bradenScale';
import { FamilyCommunicationLog } from '@/components/nursing/FamilyCommunicationLog';
import type { FamilyCommData } from '@/lib/clinical/familyCommunication';
import { BedsideProcedureChecklist } from '@/components/nursing/BedsideProcedureChecklist';
import type { ProceduresData } from '@/lib/clinical/bedsideProcedures';
import { NursingCarePlan } from '@/components/nursing/NursingCarePlan';
import type { CarePlanData } from '@/lib/clinical/nursingCarePlan';
import { ShiftHandover } from '@/components/nursing/ShiftHandover';
import type { ShiftHandoverData } from '@/lib/clinical/shiftHandover';
import { NursingTaskTimeline } from '@/components/nursing/NursingTaskTimeline';
import type { NursingTasksData } from '@/lib/clinical/nursingTasks';
import { DeteriorationAlert } from '@/components/nursing/DeteriorationAlert';
import { SepsisScreening } from '@/components/nursing/SepsisScreening';
import { MedicationAdminRecord } from '@/components/nursing/MedicationAdminRecord';
import type { MARData } from '@/lib/clinical/medicationAdminRecord';
import { WorkloadDashboard } from '@/components/nursing/WorkloadDashboard';
import { VitalsTrendAlert } from '@/components/nursing/VitalsTrendAlert';
import { useNursingModules } from '@/lib/hooks/useNursingModules';
import { DailyCarePathView } from '@/components/nursing/DailyCarePathView';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
const profile = DEPARTMENT_PROFILES.IPD;

const DEFAULT_VITALS: VitalsEntryValues = {
  bp: '', hr: '', rr: '', temp: '', spo2: '', weight: '', height: '',
  painScore: null, painLocation: '', glucose: '', headCircumference: '', fetalHr: '', fundalHeight: '',
};

interface EpisodeRow {
  id: string;
  patientName?: string;
  patient?: { id?: string; fullName?: string };
  status: string;
  location?: { ward?: string; unit?: string; room?: string; bed?: string };
  ownership?: { attendingPhysicianUserId?: string; primaryInpatientNurseUserId?: string };
  reasonForAdmission?: string;
  createdAt?: string;
  riskFlags?: any;
  latestVitals?: any;
  latestAssessment?: any;
}

export default function IPDNurseStation() {
  const { isRTL, language } = useLang();
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/ipd/nurse-station');
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { show } = useNursingModules('IPD');
  const userId = String(me?.user?.id || me?.userId || '');

  // Filters
  const [searchQ, setSearchQ] = useState('');
  const [wardFilter, setWardFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'bed' | 'acuity' | 'time'>('bed');

  // Panel
  const [selectedEp, setSelectedEp] = useState<EpisodeRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'carepath' | 'vitals' | 'assessment' | 'history'>('carepath');
  const [saving, setSaving] = useState(false);

  // Vitals state
  const [vitals, setVitals] = useState<VitalsEntryValues>(DEFAULT_VITALS);
  const [consciousness, setConsciousness] = useState<ConsciousnessLevel>('ALERT');

  // Assessment state
  const [painData, setPainData] = useState<PainEntry | null>(null);
  const [ioData, setIoData] = useState<IOData | null>(null);
  const [bradenData, setBradenData] = useState<BradenResult | null>(null);
  const [sbarData, setSbarData] = useState<SBARData | null>(null);
  const [familyCommData, setFamilyCommData] = useState<FamilyCommData | null>(null);
  const [proceduresData, setProceduresData] = useState<ProceduresData | null>(null);
  const [carePlanData, setCarePlanData] = useState<CarePlanData | null>(null);
  const [handoverData, setHandoverData] = useState<ShiftHandoverData | null>(null);
  const [nursingTasksData, setNursingTasksData] = useState<NursingTasksData | null>(null);
  const [marData, setMarData] = useState<MARData | null>(null);

  // Fall risk & GCS
  const [fallRiskScore, setFallRiskScore] = useState<number>(0);
  const [fallRiskLevel, setFallRiskLevel] = useState<string>('low');
  const [gcsScore, setGcsScore] = useState<number>(15);

  // Fetch active episodes
  const { data: episodesData, isLoading: epsLoading } = useSWR(
    '/api/ipd/episodes/active-for-nursing',
    fetcher,
    { refreshInterval: 30000 },
  );

  const episodes: EpisodeRow[] = useMemo(() => {
    const raw = episodesData?.items || episodesData?.episodes || [];
    return raw.map((e: any) => ({
      id: e.id,
      patientName: e.patient?.fullName || e.patientName || 'Unknown',
      patient: e.patient,
      status: e.status || 'ACTIVE',
      location: e.location || {},
      ownership: e.ownership || {},
      reasonForAdmission: e.reasonForAdmission || '',
      createdAt: e.createdAt,
      riskFlags: e.riskFlags,
      latestVitals: e.latestVitals,
      latestAssessment: e.latestAssessment,
    }));
  }, [episodesData]);

  const wards = useMemo(() => {
    const set = new Set<string>();
    episodes.forEach((e) => {
      const w = e.location?.ward || e.location?.unit;
      if (w) set.add(w);
    });
    return Array.from(set).sort();
  }, [episodes]);

  const filtered = useMemo(() => {
    let list = [...episodes];
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (e) =>
          (e.patientName || '').toLowerCase().includes(q) ||
          (e.location?.bed || '').toLowerCase().includes(q) ||
          (e.location?.room || '').toLowerCase().includes(q),
      );
    }
    if (wardFilter !== 'ALL') {
      list = list.filter((e) => (e.location?.ward || e.location?.unit) === wardFilter);
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((e) => e.status === statusFilter);
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return (a.patientName || '').localeCompare(b.patientName || '');
      if (sortBy === 'bed') return (a.location?.bed || '').localeCompare(b.location?.bed || '');
      if (sortBy === 'time') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      // acuity: sort by MEWS score descending
      const aM = a.latestAssessment?.mewsScore ?? 0;
      const bM = b.latestAssessment?.mewsScore ?? 0;
      return bM - aM;
    });
    return list;
  }, [episodes, searchQ, wardFilter, statusFilter, sortBy]);

  // KPIs
  const kpi = useMemo(() => {
    const total = episodes.length;
    const active = episodes.filter((e) => e.status === 'ACTIVE').length;
    const highAcuity = episodes.filter((e) => (e.latestAssessment?.mewsScore ?? 0) >= 5).length;
    const dischargeReady = episodes.filter((e) => e.status === 'DISCHARGE_READY').length;
    return { total, active, highAcuity, dischargeReady };
  }, [episodes]);

  // MEWS computation
  const mewsResult = useMemo(() => {
    return calculateMEWS(vitalsToMEWSInput(vitals, consciousness));
  }, [vitals, consciousness]);

  const resetForm = useCallback(() => {
    setVitals(DEFAULT_VITALS);
    setConsciousness('ALERT');
    setPainData(null);
    setIoData(null);
    setBradenData(null);
    setSbarData(null);
    setFamilyCommData(null);
    setProceduresData(null);
    setCarePlanData(null);
    setHandoverData(null);
    setNursingTasksData(null);
    setMarData(null);
    setFallRiskScore(0);
    setFallRiskLevel('low');
    setGcsScore(15);
  }, []);

  const openPanel = useCallback((ep: EpisodeRow) => {
    setSelectedEp(ep);
    resetForm();
    setPanelTab('vitals');
    setPanelOpen(true);
  }, [resetForm]);

  const saveAssessment = useCallback(async () => {
    if (!selectedEp) return;
    setSaving(true);
    try {
      const payload: any = {
        consciousness,
        painControlled: (painData?.score ?? 0) <= 3,
        fallRisk: fallRiskScore >= 45,
        pressureUlcerRisk: (bradenData?.totalScore ?? 23) <= 18,
        ivLine: false,
        oxygenTherapy: Number(vitals.spo2) > 0 && Number(vitals.spo2) < 94,
        mobility: 'independent',
        diet: 'regular',
        mewsScore: mewsResult.totalScore,
        mewsLevel: mewsResult.riskLevel,
        fallRiskScore,
        fallRiskLevel,
        gcsScore,
      };
      if (painData) payload.painData = painData;
      if (ioData) payload.ioData = ioData;
      if (bradenData) payload.bradenData = bradenData;
      if (sbarData) payload.sbarData = sbarData;
      if (familyCommData) payload.familyCommData = familyCommData;
      if (proceduresData) payload.proceduresData = proceduresData;
      if (carePlanData) payload.carePlanData = carePlanData;
      if (handoverData) payload.handoverData = handoverData;
      if (nursingTasksData) payload.nursingTasksData = nursingTasksData;
      if (marData) payload.marData = marData;

      const res = await fetch(`/api/ipd/episodes/${selectedEp.id}/nursing-assessments`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ تقييم التمريض', 'Nursing assessment saved') });
      mutate('/api/ipd/episodes/active-for-nursing');
      setPanelOpen(false);
      resetForm();
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل حفظ التقييم', 'Failed to save assessment'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [selectedEp, consciousness, vitals, painData, ioData, bradenData, sbarData, familyCommData, proceduresData, carePlanData, handoverData, nursingTasksData, marData, fallRiskScore, fallRiskLevel, gcsScore, mewsResult, toast, tr, resetForm]);

  // Permission check
  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bedLabel = (loc: EpisodeRow['location']) => {
    const parts = [loc?.ward, loc?.room, loc?.bed].filter(Boolean);
    return parts.length ? parts.join(' - ') : tr('بدون سرير', 'No bed');
  };

  const acuityBadge = (assessment: any) => {
    const score = assessment?.mewsScore ?? 0;
    if (score >= 7) return { label: tr('حرج', 'Critical'), cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
    if (score >= 5) return { label: tr('عالي', 'High'), cls: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
    if (score >= 3) return { label: tr('متوسط', 'Medium'), cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: tr('منخفض', 'Low'), cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
  };

  return (
    <div className={`flex flex-col h-full ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-purple-600" />
          <h1 className="text-lg font-bold">{tr('محطة تمريض التنويم', 'IPD Nurse Station')}</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30">
            {profile.defaultVitalsInterval}
          </span>
        </div>
        <button
          onClick={() => mutate('/api/ipd/episodes/active-for-nursing')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <RefreshCw className="h-4 w-4" />
          {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <TheaKpiCard
          label={tr('إجمالي المرضى', 'Total Patients')}
          value={kpi.total}
          icon={<User className="h-4 w-4" />}
          color="blue"
        />
        <TheaKpiCard
          label={tr('نشط', 'Active')}
          value={kpi.active}
          icon={<Activity className="h-4 w-4" />}
          color="green"
        />
        <TheaKpiCard
          label={tr('حدة عالية', 'High Acuity')}
          value={kpi.highAcuity}
          icon={<AlertCircle className="h-4 w-4" />}
          color="red"
        />
        <TheaKpiCard
          label={tr('جاهز للخروج', 'Discharge Ready')}
          value={kpi.dischargeReady}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="purple"
        />
      </div>

      {/* Workload Dashboard */}
      <div className="px-4">
        <WorkloadDashboard patients={episodes.map((e) => ({
          id: e.id,
          opdFlowState: e.status === 'ACTIVE' ? 'WAITING_NURSE' : e.status === 'DISCHARGE_READY' ? 'COMPLETED' : 'IN_NURSING',
          priority: (e.latestAssessment?.mewsScore ?? 0) >= 5 ? 'URGENT' : 'NORMAL',
          latestNursingEntry: { mewsScore: e.latestAssessment?.mewsScore ?? null, vitals: e.latestVitals },
          arrivedAt: e.createdAt,
        }))} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute top-2.5 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
          <Input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={tr('بحث بالاسم أو السرير...', 'Search by name or bed...')}
            className={`h-9 ${isRTL ? 'pr-9' : 'pl-9'}`}
          />
        </div>
        <Select value={wardFilter} onValueChange={setWardFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('كل الأجنحة', 'All Wards')}</SelectItem>
            {wards.map((w) => (
              <SelectItem key={w} value={w}>{w}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('كل الحالات', 'All Status')}</SelectItem>
            <SelectItem value="ACTIVE">{tr('نشط', 'Active')}</SelectItem>
            <SelectItem value="DISCHARGE_READY">{tr('جاهز للخروج', 'Discharge Ready')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-9 w-[140px]">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bed">{tr('السرير', 'Bed')}</SelectItem>
            <SelectItem value="name">{tr('الاسم', 'Name')}</SelectItem>
            <SelectItem value="acuity">{tr('الحدة', 'Acuity')}</SelectItem>
            <SelectItem value="time">{tr('الوقت', 'Time')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Patient Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {epsLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {tr('لا يوجد مرضى مُنوّمين', 'No admitted patients found')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((ep) => {
              const badge = acuityBadge(ep.latestAssessment);
              return (
                <button
                  key={ep.id}
                  onClick={() => openPanel(ep)}
                  className="text-left border rounded-lg p-3 hover:shadow-md transition bg-card group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-sm">{ep.patientName}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <BedDouble className="h-3 w-3" />
                        {bedLabel(ep.location)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {ep.status === 'DISCHARGE_READY' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          {tr('خروج', 'D/C')}
                        </span>
                      )}
                    </div>
                  </div>

                  {ep.reasonForAdmission && (
                    <div className="text-xs text-muted-foreground mb-2 line-clamp-1">
                      {ep.reasonForAdmission}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {ep.latestVitals && (
                      <>
                        <span className="flex items-center gap-0.5">
                          <Heart className="h-3 w-3 text-red-500" />
                          {ep.latestVitals.hr || '-'}
                        </span>
                        <span>{ep.latestVitals.systolic || '-'}/{ep.latestVitals.diastolic || '-'}</span>
                        <span>SpO2: {ep.latestVitals.spo2 || '-'}%</span>
                      </>
                    )}
                    {ep.latestAssessment?.mewsScore != null && (
                      <span className="font-medium">MEWS: {ep.latestAssessment.mewsScore}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-2">
                    {ep.latestAssessment?.bradenRisk && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/20">
                        Braden: {ep.latestAssessment.bradenScore}
                      </span>
                    )}
                    {ep.riskFlags?.fallRisk && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 dark:bg-orange-900/20">
                        {tr('خطر سقوط', 'Fall Risk')}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-purple-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                      {tr('تقييم', 'Assess')}
                      {isRTL ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Assessment Panel (Dialog) */}
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-purple-600" />
              {tr('تقييم تمريضي', 'Nursing Assessment')}
              {selectedEp && (
                <span className="text-sm font-normal text-muted-foreground">
                  — {selectedEp.patientName} ({bedLabel(selectedEp.location)})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={panelTab} onValueChange={(v: any) => setPanelTab(v)}>
            <TabsList className="w-full">
              <TabsTrigger value="carepath" className="flex-1">
                <ClipboardList className="h-3 w-3 mr-1" />
                {tr('المسار اليومي', "Today's Path")}
              </TabsTrigger>
              <TabsTrigger value="vitals" className="flex-1">
                <Heart className="h-3 w-3 mr-1" />
                {tr('العلامات الحيوية', 'Vitals')}
              </TabsTrigger>
              <TabsTrigger value="assessment" className="flex-1">
                <Clipboard className="h-3 w-3 mr-1" />
                {tr('التقييم', 'Assessment')}
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1">
                <Clock className="h-3 w-3 mr-1" />
                {tr('السجل', 'History')}
              </TabsTrigger>
            </TabsList>

            {/* ── Care Path Tab ── */}
            <TabsContent value="carepath" className="mt-4">
              {selectedEp && (
                <DailyCarePathView
                  patientMasterId={selectedEp.patient?.id ?? ''}
                  department="IPD"
                  episodeId={selectedEp.id}
                />
              )}
            </TabsContent>

            {/* ── Vitals Tab ── */}
            <TabsContent value="vitals" className="space-y-4 mt-4">
              {show('deterioration') && (
              <DeteriorationAlert
                input={{
                  mewsScore: mewsResult.totalScore,
                  mewsRiskLevel: mewsResult.riskLevel,
                  gcsScore,
                  bradenScore: bradenData?.totalScore ?? null,
                  painScore: painData?.score ?? null,
                  sbp: Number((vitals.bp || '').split('/')[0]) || null,
                  hr: Number(vitals.hr) || null,
                  rr: Number(vitals.rr) || null,
                  temp: Number(vitals.temp) || null,
                  spo2: Number(vitals.spo2) || null,
                  consciousness,
                }}
              />
              )}

              {show('sepsis') && (
              <SepsisScreening
                vitals={{
                  sbp: Number((vitals.bp || '').split('/')[0]) || 0,
                  hr: Number(vitals.hr) || 0,
                  rr: Number(vitals.rr) || 0,
                  temp: Number(vitals.temp) || 0,
                }}
                gcsScore={gcsScore}
              />
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium">{tr('مستوى الوعي', 'Consciousness Level')}</label>
                <Select value={consciousness} onValueChange={(v: ConsciousnessLevel) => setConsciousness(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONSCIOUSNESS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{tr(o.labelAr, o.labelEn)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <MEWSBadge vitals={vitals} consciousness={consciousness} />

              <VitalsEntry
                value={vitals}
                onChange={(v) => setVitals(v)}
              />

              {show('vitalsTrend') && selectedEp && (
              <VitalsTrendAlert
                patientId={selectedEp.id}
                currentVitals={vitals}
              />
              )}

              {show('painAssessment') && <PainAssessment value={painData} onChange={setPainData} />}
              {show('intakeOutput') && <IntakeOutputTracker value={ioData} onChange={setIoData} />}

              <button
                onClick={saveAssessment}
                disabled={saving}
                className="w-full py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {saving ? tr('جارِ الحفظ...', 'Saving...') : tr('حفظ العلامات الحيوية', 'Save Vitals')}
              </button>
            </TabsContent>

            {/* ── Assessment Tab ── */}
            <TabsContent value="assessment" className="space-y-4 mt-4">
              {show('fallRisk') && (
              <FallRiskAssessment
                onChange={(result) => { setFallRiskScore(result.totalScore); setFallRiskLevel(result.riskLevel); }}
              />
              )}
              {show('braden') && <BradenAssessment initialData={bradenData?.input} onChange={setBradenData} />}
              {show('gcs') && <GCSAssessment onChange={(result) => setGcsScore(result.totalScore)} />}
              {show('sbar') && <SBARForm initialData={sbarData} onChange={setSbarData} />}
              {show('familyComm') && <FamilyCommunicationLog value={familyCommData} onChange={setFamilyCommData} />}
              {show('procedures') && <BedsideProcedureChecklist value={proceduresData} onChange={setProceduresData} />}
              {show('carePlan') && <NursingCarePlan value={carePlanData} onChange={setCarePlanData} />}
              {show('shiftHandover') && <ShiftHandover value={handoverData} onChange={setHandoverData} />}
              {show('taskTimeline') && <NursingTaskTimeline value={nursingTasksData} onChange={setNursingTasksData} />}
              {show('mar') && <MedicationAdminRecord value={marData} onChange={setMarData} />}

              <button
                onClick={saveAssessment}
                disabled={saving}
                className="w-full py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {saving ? tr('جارِ الحفظ...', 'Saving...') : tr('حفظ التقييم', 'Save Assessment')}
              </button>
            </TabsContent>

            {/* ── History Tab ── */}
            <TabsContent value="history" className="space-y-4 mt-4">
              <IPDAssessmentHistory episodeId={selectedEp?.id || ''} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Assessment History sub-component ── */
function IPDAssessmentHistory({ episodeId }: { episodeId: string }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const { data, isLoading } = useSWR(
    episodeId ? `/api/ipd/episodes/${episodeId}/nursing-assessments` : null,
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const items = data?.items || [];
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {tr('لا توجد تقييمات سابقة', 'No previous assessments')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item: any) => (
        <div key={item.id} className="border rounded-lg p-3 text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
            </span>
            <div className="flex items-center gap-2">
              {item.mewsScore != null && (
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  item.mewsLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                  item.mewsLevel === 'MEDIUM' ? 'bg-orange-100 text-orange-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  MEWS {item.mewsScore}
                </span>
              )}
              {item.bradenScore != null && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  Braden: {item.bradenScore}
                </span>
              )}
            </div>
          </div>
          {item.assessment && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>{tr('وعي', 'Consciousness')}: {item.assessment.consciousness || '-'}</span>
              <span>{tr('ألم متحكم', 'Pain Controlled')}: {item.assessment.painControlled ? '✓' : '✗'}</span>
              <span>{tr('خطر سقوط', 'Fall Risk')}: {item.assessment.fallRisk ? '✓' : '✗'}</span>
              <span>{tr('قرحة ضغط', 'Pressure Ulcer')}: {item.assessment.pressureUlcerRisk ? '✓' : '✗'}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
