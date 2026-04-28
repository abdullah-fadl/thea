'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import {
  Activity, Heart, Clock, User, Search, RefreshCw, AlertCircle, CheckCircle2,
  ChevronRight, ChevronLeft, Clipboard, Stethoscope, Filter, ArrowUpDown, BedDouble, ClipboardList,
  Building2, Wind, Syringe,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
import { ICUMonitorPanel } from '@/components/nursing/ICUMonitorPanel';
import type { ICUMonitoringData } from '@/lib/clinical/icuMonitoring';
import { useNursingModules } from '@/lib/hooks/useNursingModules';
import { DailyCarePathView } from '@/components/nursing/DailyCarePathView';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
const profile = DEPARTMENT_PROFILES.ICU;

const DEFAULT_VITALS: VitalsEntryValues = {
  bp: '', hr: '', rr: '', temp: '', spo2: '', weight: '', height: '',
  painScore: null, painLocation: '', glucose: '', headCircumference: '', fetalHr: '', fundalHeight: '',
};

interface ICUEpisodeRow {
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

export default function ICUNurseStation() {
  const { isRTL, language } = useLang();
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/icu/nurse-station');
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { show } = useNursingModules('ICU');

  const [searchQ, setSearchQ] = useState('');
  const [sortBy, setSortBy] = useState<'bed' | 'acuity' | 'name'>('acuity');

  // Panel
  const [selectedEp, setSelectedEp] = useState<ICUEpisodeRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'carepath' | 'vitals' | 'icu' | 'assessment' | 'history'>('carepath');
  const [saving, setSaving] = useState(false);

  // Vitals
  const [vitals, setVitals] = useState<VitalsEntryValues>(DEFAULT_VITALS);
  const [consciousness, setConsciousness] = useState<ConsciousnessLevel>('ALERT');

  // ICU-specific
  const [icuMonitoring, setIcuMonitoring] = useState<ICUMonitoringData | null>(null);

  // Assessments
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
  const [fallRiskScore, setFallRiskScore] = useState(0);
  const [fallRiskLevel, setFallRiskLevel] = useState('low');
  const [gcsScore, setGcsScore] = useState(15);

  // Fetch ICU episodes (filtered from IPD with serviceUnit containing 'ICU')
  const { data: episodesData, isLoading: epsLoading } = useSWR(
    '/api/ipd/episodes/active-for-nursing?unit=ICU',
    fetcher,
    { refreshInterval: 15000 },
  );

  const episodes: ICUEpisodeRow[] = useMemo(() => {
    const raw = episodesData?.items || [];
    return raw
      .filter((e: any) => {
        const unit = (e.serviceUnit || e.location?.unit || '').toUpperCase();
        return unit.includes('ICU') || unit.includes('CCU') || unit.includes('NICU') || unit.includes('PICU');
      })
      .map((e: any) => ({
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

  const filtered = useMemo(() => {
    let list = [...episodes];
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (e) =>
          (e.patientName || '').toLowerCase().includes(q) ||
          (e.location?.bed || '').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return (a.patientName || '').localeCompare(b.patientName || '');
      if (sortBy === 'bed') return (a.location?.bed || '').localeCompare(b.location?.bed || '');
      const aM = a.latestAssessment?.mewsScore ?? 0;
      const bM = b.latestAssessment?.mewsScore ?? 0;
      return bM - aM;
    });
    return list;
  }, [episodes, searchQ, sortBy]);

  const kpi = useMemo(() => {
    const total = episodes.length;
    const ventilated = episodes.filter((e) => e.riskFlags?.ventilated).length;
    const critical = episodes.filter((e) => (e.latestAssessment?.mewsScore ?? 0) >= 7).length;
    const stable = episodes.filter((e) => (e.latestAssessment?.mewsScore ?? 0) < 3).length;
    return { total, ventilated, critical, stable };
  }, [episodes]);

  const mewsResult = useMemo(() => {
    return calculateMEWS(vitalsToMEWSInput(vitals, consciousness));
  }, [vitals, consciousness]);

  const resetForm = useCallback(() => {
    setVitals(DEFAULT_VITALS);
    setConsciousness('ALERT');
    setIcuMonitoring(null);
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

  const openPanel = useCallback((ep: ICUEpisodeRow) => {
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
        ivLine: true,
        oxygenTherapy: true,
        mobility: 'bedbound',
        diet: 'npo',
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
      if (icuMonitoring) payload.icuMonitoring = icuMonitoring;

      const res = await fetch(`/api/ipd/episodes/${selectedEp.id}/nursing-assessments`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ تقييم العناية المركزة', 'ICU assessment saved') });
      mutate('/api/ipd/episodes/active-for-nursing?unit=ICU');
      setPanelOpen(false);
      resetForm();
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الحفظ', 'Failed to save'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [selectedEp, consciousness, vitals, painData, ioData, bradenData, sbarData, familyCommData, proceduresData, carePlanData, handoverData, nursingTasksData, marData, icuMonitoring, fallRiskScore, fallRiskLevel, gcsScore, mewsResult, toast, tr, resetForm]);

  const bedLabel = (loc: ICUEpisodeRow['location']) => {
    const parts = [loc?.unit, loc?.room, loc?.bed].filter(Boolean);
    return parts.length ? parts.join(' - ') : tr('بدون سرير', 'No bed');
  };

  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <h1 className="text-lg font-bold">{tr('محطة تمريض العناية المركزة', 'ICU Nurse Station')}</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30">
            Q15MIN
          </span>
        </div>
        <button
          onClick={() => mutate('/api/ipd/episodes/active-for-nursing?unit=ICU')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <RefreshCw className="h-4 w-4" />
          {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <TheaKpiCard
          label={tr('إجمالي المرضى', 'Total Patients')}
          value={kpi.total}
          icon={<User className="h-4 w-4" />}
          color="blue"
        />
        <TheaKpiCard
          label={tr('على جهاز تنفس', 'Ventilated')}
          value={kpi.ventilated}
          icon={<Activity className="h-4 w-4" />}
          color="amber"
        />
        <TheaKpiCard
          label={tr('حالة حرجة', 'Critical')}
          value={kpi.critical}
          icon={<AlertCircle className="h-4 w-4" />}
          color="red"
        />
        <TheaKpiCard
          label={tr('مستقر', 'Stable')}
          value={kpi.stable}
          icon={<CheckCircle2 className="h-4 w-4" />}
          color="green"
        />
      </div>

      {/* Workload */}
      <div className="px-4">
        <WorkloadDashboard patients={episodes.map((e) => ({
          id: e.id,
          opdFlowState: (e.latestAssessment?.mewsScore ?? 0) >= 5 ? 'WAITING_NURSE' : 'IN_NURSING',
          priority: (e.latestAssessment?.mewsScore ?? 0) >= 7 ? 'URGENT' : 'NORMAL',
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
            placeholder={tr('بحث...', 'Search...')}
            className={`h-9 ${isRTL ? 'pr-9' : 'pl-9'}`}
          />
        </div>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-9 w-[140px]">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="acuity">{tr('الحدة', 'Acuity')}</SelectItem>
            <SelectItem value="bed">{tr('السرير', 'Bed')}</SelectItem>
            <SelectItem value="name">{tr('الاسم', 'Name')}</SelectItem>
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
            {tr('لا يوجد مرضى بالعناية المركزة', 'No ICU patients found')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((ep) => {
              const mews = ep.latestAssessment?.mewsScore ?? 0;
              const isCritical = mews >= 7;
              return (
                <button
                  key={ep.id}
                  onClick={() => openPanel(ep)}
                  className={`text-left border rounded-lg p-3 hover:shadow-md transition bg-card group ${
                    isCritical ? 'border-red-400 ring-1 ring-red-200' : ''
                  }`}
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
                      {mews >= 5 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isCritical ? 'bg-red-600 text-white animate-pulse' : 'bg-orange-500 text-white'
                        }`}>
                          MEWS {mews}
                        </span>
                      )}
                      {ep.riskFlags?.ventilated && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30">
                          <Wind className="h-3 w-3 inline" /> Vent
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
                  </div>

                  <div className="flex items-center gap-1 mt-2">
                    {ep.latestAssessment?.bradenScore && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/20">
                        Braden: {ep.latestAssessment.bradenScore}
                      </span>
                    )}
                    {ep.latestAssessment?.gcsScore && ep.latestAssessment.gcsScore < 9 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-900/20">
                        GCS: {ep.latestAssessment.gcsScore}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-rose-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
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

      {/* Assessment Dialog */}
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {tr('تقييم العناية المركزة', 'ICU Nursing Assessment')}
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
                {tr('المسار', 'Path')}
              </TabsTrigger>
              <TabsTrigger value="vitals" className="flex-1">
                <Heart className="h-3 w-3 mr-1" />
                {tr('العلامات', 'Vitals')}
              </TabsTrigger>
              {(show('ventilatorMonitor') || show('hemodynamicMonitor')) && (
              <TabsTrigger value="icu" className="flex-1">
                <Wind className="h-3 w-3 mr-1" />
                {tr('مراقبة ICU', 'ICU Monitor')}
              </TabsTrigger>
              )}
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
                  department="ICU"
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
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
                className="w-full py-2 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {saving ? tr('جارِ الحفظ...', 'Saving...') : tr('حفظ العلامات الحيوية', 'Save Vitals')}
              </button>
            </TabsContent>

            {/* ── ICU Monitor Tab (ventilator + hemodynamics + drips) ── */}
            {(show('ventilatorMonitor') || show('hemodynamicMonitor')) && (
            <TabsContent value="icu" className="space-y-4 mt-4">
              <ICUMonitorPanel value={icuMonitoring} onChange={setIcuMonitoring} />

              <button
                onClick={saveAssessment}
                disabled={saving}
                className="w-full py-2 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {saving ? tr('جارِ الحفظ...', 'Saving...') : tr('حفظ بيانات ICU', 'Save ICU Data')}
              </button>
            </TabsContent>
            )}

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
                className="w-full py-2 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 transition"
              >
                {saving ? tr('جارِ الحفظ...', 'Saving...') : tr('حفظ التقييم', 'Save Assessment')}
              </button>
            </TabsContent>

            {/* ── History Tab ── */}
            <TabsContent value="history" className="space-y-4 mt-4">
              <ICUAssessmentHistory episodeId={selectedEp?.id || ''} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ICUAssessmentHistory({ episodeId }: { episodeId: string }) {
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
              {item.gcsScore != null && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${item.gcsScore < 9 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  GCS: {item.gcsScore}
                </span>
              )}
              {item.bradenScore != null && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  Braden: {item.bradenScore}
                </span>
              )}
            </div>
          </div>
          {item.icuMonitoring && (
            <div className="text-xs grid grid-cols-3 gap-1">
              {item.icuMonitoring.ventilator?.length > 0 && (
                <span className="bg-blue-50 px-1 rounded dark:bg-blue-900/20">
                  <Wind className="h-3 w-3 inline" /> {item.icuMonitoring.ventilator[0]?.settings?.mode} FiO2:{item.icuMonitoring.ventilator[0]?.settings?.fio2}%
                </span>
              )}
              {item.icuMonitoring.drips?.length > 0 && (
                <span className="bg-rose-50 px-1 rounded dark:bg-rose-900/20">
                  <Syringe className="h-3 w-3 inline" /> {item.icuMonitoring.drips.filter((d: any) => !d.stoppedAt).length} {tr('تسريبات', 'drips')}
                </span>
              )}
            </div>
          )}
          {item.assessment && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              <span>{tr('وعي', 'Consciousness')}: {item.consciousness || item.assessment.consciousness || '-'}</span>
              <span>{tr('ألم متحكم', 'Pain Controlled')}: {item.assessment.painControlled ? '✓' : '✗'}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
