'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import {
  Activity, Heart, Clock, User, Search, RefreshCw, AlertCircle, CheckCircle2,
  ChevronRight, ChevronLeft, X, Clipboard, Stethoscope, Siren, Filter, ArrowUpDown, ClipboardList,
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
import { FamilyCommunicationLog } from '@/components/nursing/FamilyCommunicationLog';
import type { FamilyCommData } from '@/lib/clinical/familyCommunication';
import { BedsideProcedureChecklist } from '@/components/nursing/BedsideProcedureChecklist';
import type { ProceduresData } from '@/lib/clinical/bedsideProcedures';
import { NursingTaskTimeline } from '@/components/nursing/NursingTaskTimeline';
import type { NursingTasksData } from '@/lib/clinical/nursingTasks';
import { ShiftHandover } from '@/components/nursing/ShiftHandover';
import type { ShiftHandoverData } from '@/lib/clinical/shiftHandover';
import { DeteriorationAlert } from '@/components/nursing/DeteriorationAlert';
import { SepsisScreening } from '@/components/nursing/SepsisScreening';
import { MedicationAdminRecord } from '@/components/nursing/MedicationAdminRecord';
import type { MARData } from '@/lib/clinical/medicationAdminRecord';
import { WorkloadDashboard } from '@/components/nursing/WorkloadDashboard';
import { VitalsTrendAlert } from '@/components/nursing/VitalsTrendAlert';
import { ErPageShell } from '@/components/er/ErPageShell';
import { useNursingModules } from '@/lib/hooks/useNursingModules';
import { DailyCarePathView } from '@/components/nursing/DailyCarePathView';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
const profile = DEPARTMENT_PROFILES.ER;

const DEFAULT_VITALS: VitalsEntryValues = {
  bp: '', hr: '', rr: '', temp: '', spo2: '', weight: '', height: '',
  painScore: null, painLocation: '', glucose: '', headCircumference: '', fetalHr: '', fundalHeight: '',
};

const ESI_CONFIG: Record<number, { label: string; labelAr: string; cls: string }> = {
  1: { label: 'Resuscitation', labelAr: 'إنعاش', cls: 'bg-red-600 text-white' },
  2: { label: 'Emergent', labelAr: 'طوارئ', cls: 'bg-orange-500 text-white' },
  3: { label: 'Urgent', labelAr: 'عاجل', cls: 'bg-amber-500 text-white' },
  4: { label: 'Less Urgent', labelAr: 'أقل استعجالاً', cls: 'bg-green-500 text-white' },
  5: { label: 'Non-urgent', labelAr: 'غير مستعجل', cls: 'bg-blue-500 text-white' },
};

interface ERPatientRow {
  encounterId: string;
  patientName: string;
  mrn?: string;
  status: string;
  triageLevel?: number;
  chiefComplaint?: string;
  bed?: { zone?: string; bedLabel?: string };
  waitTimeMin?: number;
  latestVitals?: any;
  latestMews?: number;
}

export default function ERNurseStation() {
  const { isRTL, language } = useLang();
  const { toast } = useToast();
  const { me } = useMe();
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/er/nursing');
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { show } = useNursingModules('ER');

  const [searchQ, setSearchQ] = useState('');
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'triage' | 'wait' | 'name' | 'bed'>('triage');

  // Panel
  const [selectedPt, setSelectedPt] = useState<ERPatientRow | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'carepath' | 'vitals' | 'assessment' | 'history'>('carepath');
  const [saving, setSaving] = useState(false);

  // Vitals
  const [vitals, setVitals] = useState<VitalsEntryValues>(DEFAULT_VITALS);
  const [consciousness, setConsciousness] = useState<ConsciousnessLevel>('ALERT');

  // Assessments
  const [painData, setPainData] = useState<PainEntry | null>(null);
  const [ioData, setIoData] = useState<IOData | null>(null);
  const [sbarData, setSbarData] = useState<SBARData | null>(null);
  const [familyCommData, setFamilyCommData] = useState<FamilyCommData | null>(null);
  const [proceduresData, setProceduresData] = useState<ProceduresData | null>(null);
  const [nursingTasksData, setNursingTasksData] = useState<NursingTasksData | null>(null);
  const [handoverData, setHandoverData] = useState<ShiftHandoverData | null>(null);
  const [marData, setMarData] = useState<MARData | null>(null);
  const [fallRiskScore, setFallRiskScore] = useState(0);
  const [fallRiskLevel, setFallRiskLevel] = useState('low');
  const [gcsScore, setGcsScore] = useState(15);

  // Fetch ER patients
  const roleLower = String(me?.user?.role || '').toLowerCase();
  const isDev = roleLower.includes('admin') || roleLower.includes('charge');
  const patientsUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (isDev) qs.set('showAll', '1');
    const q = qs.toString();
    return `/api/er/nursing/my-patients${q ? `?${q}` : ''}`;
  }, [isDev]);
  const { data: ptsData, isLoading: ptsLoading } = useSWR(patientsUrl, fetcher, { refreshInterval: 10000 });

  const patients: ERPatientRow[] = useMemo(() => {
    const items = ptsData?.items || [];
    return items.map((p: any) => ({
      encounterId: p.encounterId || p.id,
      patientName: p.patientName || p.patient?.fullName || 'Unknown',
      mrn: p.mrn || p.patient?.mrn || '',
      status: p.status || 'ARRIVED',
      triageLevel: p.triageLevel || p.triage?.level || 5,
      chiefComplaint: p.chiefComplaint || p.triage?.chiefComplaint || '',
      bed: p.bed || null,
      waitTimeMin: p.waitTimeMin || 0,
      latestVitals: p.latestVitals || null,
      latestMews: p.latestMews ?? null,
    }));
  }, [ptsData]);

  const zones = useMemo(() => {
    const set = new Set<string>();
    patients.forEach((p) => { if (p.bed?.zone) set.add(p.bed.zone); });
    return Array.from(set).sort();
  }, [patients]);

  const filtered = useMemo(() => {
    let list = [...patients];
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(
        (p) =>
          p.patientName.toLowerCase().includes(q) ||
          (p.mrn || '').toLowerCase().includes(q) ||
          (p.bed?.bedLabel || '').toLowerCase().includes(q),
      );
    }
    if (zoneFilter !== 'ALL') {
      list = list.filter((p) => p.bed?.zone === zoneFilter);
    }
    if (statusFilter !== 'ALL') {
      list = list.filter((p) => p.status === statusFilter);
    }
    list.sort((a, b) => {
      if (sortBy === 'triage') return (a.triageLevel || 5) - (b.triageLevel || 5);
      if (sortBy === 'wait') return (b.waitTimeMin || 0) - (a.waitTimeMin || 0);
      if (sortBy === 'name') return a.patientName.localeCompare(b.patientName);
      return (a.bed?.bedLabel || '').localeCompare(b.bed?.bedLabel || '');
    });
    return list;
  }, [patients, searchQ, zoneFilter, statusFilter, sortBy]);

  // KPIs
  const kpi = useMemo(() => {
    const total = patients.length;
    const esi12 = patients.filter((p) => (p.triageLevel || 5) <= 2).length;
    const waiting = patients.filter((p) => ['ARRIVED', 'TRIAGED'].includes(p.status)).length;
    const inProgress = patients.filter((p) => ['IN_TREATMENT', 'ASSIGNED'].includes(p.status)).length;
    return { total, esi12, waiting, inProgress };
  }, [patients]);

  const mewsResult = useMemo(() => {
    return calculateMEWS(vitalsToMEWSInput(vitals, consciousness));
  }, [vitals, consciousness]);

  const resetForm = useCallback(() => {
    setVitals(DEFAULT_VITALS);
    setConsciousness('ALERT');
    setPainData(null);
    setIoData(null);
    setSbarData(null);
    setFamilyCommData(null);
    setProceduresData(null);
    setNursingTasksData(null);
    setHandoverData(null);
    setMarData(null);
    setFallRiskScore(0);
    setFallRiskLevel('low');
    setGcsScore(15);
  }, []);

  const openPanel = useCallback((pt: ERPatientRow) => {
    setSelectedPt(pt);
    resetForm();
    setPanelTab('vitals');
    setPanelOpen(true);
  }, [resetForm]);

  const saveAssessment = useCallback(async () => {
    if (!selectedPt) return;
    setSaving(true);
    try {
      const payload: any = {
        encounterId: selectedPt.encounterId,
        consciousness,
        content: `ER Nursing assessment: MEWS ${mewsResult.totalScore}`,
        vitals: {
          bp: vitals.bp || '',
          hr: Number(vitals.hr) || 0,
          rr: Number(vitals.rr) || 0,
          temp: Number(vitals.temp) || 0,
          spo2: Number(vitals.spo2) || 0,
        },
        mewsScore: mewsResult.totalScore,
        mewsLevel: mewsResult.riskLevel,
        fallRiskScore,
        fallRiskLevel,
        gcsScore,
      };
      if (painData) payload.painData = painData;
      if (ioData) payload.ioData = ioData;
      if (sbarData) payload.sbarData = sbarData;
      if (familyCommData) payload.familyCommData = familyCommData;
      if (proceduresData) payload.proceduresData = proceduresData;
      if (nursingTasksData) payload.nursingTasksData = nursingTasksData;
      if (handoverData) payload.handoverData = handoverData;
      if (marData) payload.marData = marData;

      const res = await fetch('/api/er/nursing/assessment', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(tr('فشلت العملية', 'Failed'));
      toast({ title: tr('تم الحفظ', 'Saved'), description: tr('تم حفظ تقييم الطوارئ', 'ER assessment saved') });
      mutate(patientsUrl);
      setPanelOpen(false);
      resetForm();
    } catch {
      toast({ title: tr('خطأ', 'Error'), description: tr('فشل الحفظ', 'Failed to save'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [selectedPt, consciousness, vitals, painData, ioData, sbarData, familyCommData, proceduresData, nursingTasksData, handoverData, marData, fallRiskScore, fallRiskLevel, gcsScore, mewsResult, toast, tr, patientsUrl, resetForm]);

  if (permLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const triageBadge = (level: number) => {
    const cfg = ESI_CONFIG[level] || ESI_CONFIG[5];
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${cfg.cls}`}>
        ESI-{level} {tr(cfg.labelAr, cfg.label)}
      </span>
    );
  };

  return (
    <ErPageShell title={tr('محطة تمريض الطوارئ', 'ER Nurse Station')}>
      <div className={`flex flex-col h-full ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <Siren className="h-5 w-5 text-red-600" />
            <h1 className="text-lg font-bold">{tr('محطة تمريض الطوارئ', 'ER Nurse Station')}</h1>
            <span className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30">
              {profile.defaultVitalsInterval}
            </span>
          </div>
          <button
            onClick={() => mutate(patientsUrl)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className="h-4 w-4" />
            {tr('تحديث', 'Refresh')}
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
          <TheaKpiCard
            label={tr('إجمالي', 'Total')}
            value={kpi.total}
            icon={<User className="h-4 w-4" />}
            color="blue"
          />
          <TheaKpiCard
            label={tr('ESI 1-2 حرج', 'ESI 1-2 Critical')}
            value={kpi.esi12}
            icon={<AlertCircle className="h-4 w-4" />}
            color="red"
          />
          <TheaKpiCard
            label={tr('ينتظر', 'Waiting')}
            value={kpi.waiting}
            icon={<Clock className="h-4 w-4" />}
            color="amber"
          />
          <TheaKpiCard
            label={tr('قيد العلاج', 'In Treatment')}
            value={kpi.inProgress}
            icon={<Activity className="h-4 w-4" />}
            color="green"
          />
        </div>

        {/* Workload */}
        <div className="px-4">
          <WorkloadDashboard patients={patients.map((p) => ({
            id: p.encounterId,
            opdFlowState: ['ARRIVED', 'TRIAGED'].includes(p.status) ? 'WAITING_NURSE' : (p.status === 'DISCHARGED' || p.status === 'DEATH') ? 'COMPLETED' : 'IN_NURSING',
            priority: (p.triageLevel || 5) <= 2 ? 'URGENT' : 'NORMAL',
            latestNursingEntry: { mewsScore: p.latestMews ?? null, vitals: p.latestVitals },
            arrivedAt: undefined,
          }))} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute top-2.5 h-4 w-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={tr('بحث بالاسم أو رقم الملف...', 'Search by name or MRN...')}
              className={`h-9 ${isRTL ? 'pr-9' : 'pl-9'}`}
            />
          </div>
          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="h-9 w-[140px]">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{tr('كل المناطق', 'All Zones')}</SelectItem>
              {zones.map((z) => (
                <SelectItem key={z} value={z}>{z}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-9 w-[140px]">
              <ArrowUpDown className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="triage">{tr('الفرز', 'Triage')}</SelectItem>
              <SelectItem value="wait">{tr('الانتظار', 'Wait Time')}</SelectItem>
              <SelectItem value="name">{tr('الاسم', 'Name')}</SelectItem>
              <SelectItem value="bed">{tr('السرير', 'Bed')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Patient List */}
        <div className="flex-1 overflow-y-auto p-4">
          {ptsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {tr('لا يوجد مرضى', 'No patients found')}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((pt) => (
                <button
                  key={pt.encounterId}
                  onClick={() => openPanel(pt)}
                  className="w-full text-left border rounded-lg p-3 hover:shadow-md transition bg-card group flex items-center gap-3"
                >
                  {/* Triage stripe */}
                  <div
                    className={`w-1.5 self-stretch rounded-full ${
                      (pt.triageLevel || 5) <= 1 ? 'bg-red-600' :
                      (pt.triageLevel || 5) <= 2 ? 'bg-orange-500' :
                      (pt.triageLevel || 5) <= 3 ? 'bg-amber-500' :
                      (pt.triageLevel || 5) <= 4 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{pt.patientName}</span>
                        {pt.mrn && <span className="text-xs text-muted-foreground">#{pt.mrn}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {triageBadge(pt.triageLevel || 5)}
                        {pt.latestMews != null && pt.latestMews >= 5 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 font-medium">
                            MEWS {pt.latestMews}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {pt.chiefComplaint && (
                        <span className="truncate max-w-[200px]">{pt.chiefComplaint}</span>
                      )}
                      {pt.bed?.bedLabel && (
                        <span className="flex items-center gap-0.5 font-medium">
                          {pt.bed.zone}-{pt.bed.bedLabel}
                        </span>
                      )}
                      {(pt.waitTimeMin ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {pt.waitTimeMin}m
                        </span>
                      )}
                      {pt.latestVitals && (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-red-500" />
                          HR:{pt.latestVitals.hr || '-'} BP:{pt.latestVitals.systolic || '-'}/{pt.latestVitals.diastolic || '-'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-red-600 opacity-0 group-hover:opacity-100 transition">
                    {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assessment Dialog */}
        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Siren className="h-5 w-5 text-red-600" />
                {tr('تقييم تمريض الطوارئ', 'ER Nursing Assessment')}
                {selectedPt && (
                  <span className="text-sm font-normal text-muted-foreground">
                    — {selectedPt.patientName}
                    {selectedPt.bed?.bedLabel ? ` (${selectedPt.bed.zone}-${selectedPt.bed.bedLabel})` : ''}
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

              {/* Care Path Tab */}
              <TabsContent value="carepath" className="mt-4">
                {selectedPt && (
                  <DailyCarePathView
                    patientMasterId={selectedPt.mrn ?? ''}
                    department="ER"
                    erEncounterId={selectedPt.encounterId}
                  />
                )}
              </TabsContent>

              {/* Vitals Tab */}
              <TabsContent value="vitals" className="space-y-4 mt-4">
                {show('deterioration') && (
                <DeteriorationAlert
                  input={{
                    mewsScore: mewsResult.totalScore,
                    mewsRiskLevel: mewsResult.riskLevel,
                    gcsScore,
                    bradenScore: null,
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

                {show('vitalsTrend') && selectedPt && (
                <VitalsTrendAlert
                  patientId={selectedPt.encounterId}
                  currentVitals={vitals}
                />
                )}

                {show('painAssessment') && <PainAssessment value={painData} onChange={setPainData} />}
                {show('intakeOutput') && <IntakeOutputTracker value={ioData} onChange={setIoData} />}

                <button
                  onClick={saveAssessment}
                  disabled={saving}
                  className="w-full py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {saving ? tr('جارِ الحفظ...', 'Saving...') : tr('حفظ العلامات الحيوية', 'Save Vitals')}
                </button>
              </TabsContent>

              {/* Assessment Tab */}
              <TabsContent value="assessment" className="space-y-4 mt-4">
                {show('fallRisk') && (
                <FallRiskAssessment
                  onChange={(result) => { setFallRiskScore(result.totalScore); setFallRiskLevel(result.riskLevel); }}
                />
                )}
                {show('gcs') && <GCSAssessment onChange={(result) => setGcsScore(result.totalScore)} />}
                {show('sbar') && <SBARForm initialData={sbarData} onChange={setSbarData} />}
                {show('familyComm') && <FamilyCommunicationLog value={familyCommData} onChange={setFamilyCommData} />}
                {show('procedures') && <BedsideProcedureChecklist value={proceduresData} onChange={setProceduresData} />}
                {show('shiftHandover') && <ShiftHandover value={handoverData} onChange={setHandoverData} />}
                {show('taskTimeline') && <NursingTaskTimeline value={nursingTasksData} onChange={setNursingTasksData} />}
                {show('mar') && <MedicationAdminRecord value={marData} onChange={setMarData} />}

                <button
                  onClick={saveAssessment}
                  disabled={saving}
                  className="w-full py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {saving ? tr('جارِ الحفظ...', 'Saving...') : tr('حفظ التقييم', 'Save Assessment')}
                </button>
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 mt-4">
                <ERAssessmentHistory encounterId={selectedPt?.encounterId || ''} />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </ErPageShell>
  );
}

function ERAssessmentHistory({ encounterId }: { encounterId: string }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());
  const { data, isLoading } = useSWR(
    encounterId ? `/api/er/nursing/assessment?encounterId=${encounterId}` : null,
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
            </div>
          </div>
          {item.consciousness && (
            <div className="text-xs">
              {tr('الوعي', 'Consciousness')}: {item.consciousness}
            </div>
          )}
          {item.vitals && (
            <div className="grid grid-cols-3 gap-1 text-xs">
              <span>BP: {item.vitals.systolic}/{item.vitals.diastolic}</span>
              <span>HR: {item.vitals.hr}</span>
              <span>SpO2: {item.vitals.spo2}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
