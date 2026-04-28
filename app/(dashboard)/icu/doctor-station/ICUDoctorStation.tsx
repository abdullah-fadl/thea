'use client';

import React, { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { TheaKpiCard } from '@/components/thea-ui/TheaKpiCard';
import { useToast } from '@/hooks/use-toast';
import ICUFlowsheet from './ICUFlowsheet';
import {
  Users, Wind, AlertTriangle, ClipboardList, Search, RefreshCw,
  Stethoscope, Activity, Droplets, FileText, FlaskConical, Heart,
  LogOut, ArrowUpDown, ChevronRight, Plus, Check, Clock,
  Pill, Syringe, Bed, Brain, Thermometer, ShieldAlert,
} from 'lucide-react';

// ---------- Fetcher ----------
const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------- Types ----------
interface PatientEpisode {
  id: string;
  status: string;
  patientName: string;
  patientId: string;
  encounterCoreId: string;
  location: { ward?: string; unit?: string; room?: string; bed?: string };
  ownership: { attendingPhysicianUserId?: string };
  reasonForAdmission: string;
  admittedAt: string;
  losDays: number;
  serviceUnit: string;
  latestVitals: any;
  latestAssessment: any;
  sofaScore: { totalScore: number; respiratory: number; coagulation: number; liver: number; cardiovascular: number; cns: number; renal: number; scoredAt: string } | null;
  isOnVentilator: boolean;
  ventilatorMode: string | null;
  ventilatorFio2: number | null;
  activeDripsCount: number;
  activeDrips: { drugName: string; rate: number; dose: string }[];
  hasProgressToday: boolean;
  lastProgressDate: string | null;
  pendingOrdersCount: number;
  pendingResultsCount: number;
  allergiesCount: number;
  allergies: { name: string; severity: string; type: string }[];
  activeProblems: { name: string; icd10: string }[];
  riskFlags: any;
}

interface RoundingSummary {
  episode: any;
  vitalsTrend: any[];
  latestAssessment: any;
  medOrders: any[];
  labImagingOrders: any[];
  progressNotes: any[];
  carePlans: any[];
  fluidBalance: { intake: number; output: number; net: number; entries: any[] };
  allergies: any[];
  activeProblems: any[];
  results: any[];
  sofaScores: any[];
  ventilatorRecords: any[];
  ventilatorChecks: any[];
  icuCarePlans: any[];
  icuEvents: any[];
  latestHemodynamic: any;
  activeDrips: any[];
}

// ---------- Helpers ----------
function sofaColor(score: number): string {
  if (score <= 6) return 'bg-green-100 text-green-800';
  if (score <= 9) return 'bg-yellow-100 text-yellow-800';
  if (score <= 12) return 'bg-orange-100 text-orange-800';
  if (score <= 14) return 'bg-red-100 text-red-800';
  return 'bg-purple-100 text-purple-800';
}

function sofaRisk(score: number, tr: (a: string, e: string) => string): string {
  if (score <= 6) return tr('منخفض', 'Low');
  if (score <= 9) return tr('متوسط', 'Moderate');
  if (score <= 12) return tr('مرتفع', 'High');
  if (score <= 14) return tr('مرتفع جداً', 'Very High');
  return tr('حرج', 'Critical');
}

function mewsColor(score: number | null): string {
  if (score === null || score === undefined) return 'bg-muted text-muted-foreground';
  if (score <= 2) return 'bg-green-100 text-green-800';
  if (score <= 4) return 'bg-yellow-100 text-yellow-800';
  if (score <= 6) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

// ---------- Component ----------
export default function ICUDoctorStation() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();
  useRoutePermission('/icu/doctor-station');

  // State
  const [searchQ, setSearchQ] = useState('');
  const [bedFilter, setBedFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'bed' | 'sofa' | 'mews' | 'los'>('sofa');
  const [selectedEpId, setSelectedEpId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showAllPatients, setShowAllPatients] = useState(false);

  // Progress note form
  const [progressForm, setProgressForm] = useState({
    assessment: '', changesToday: '', planNext24h: '', dispositionPlan: '',
  });
  const [savingProgress, setSavingProgress] = useState(false);

  // Order dialog
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [orderKind, setOrderKind] = useState<'LAB' | 'IMAGING' | 'NURSING'>('LAB');
  const [orderTitle, setOrderTitle] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  // Data fetching
  const { data: ptData, mutate: mutatePt } = useSWR(
    `/api/icu/doctors/my-patients?all=${showAllPatients}`,
    fetcher,
    { refreshInterval: 30000 },
  );

  const { data: rounding, mutate: mutateRounding } = useSWR(
    selectedEpId ? `/api/icu/doctors/rounding-summary?episodeId=${selectedEpId}` : null,
    fetcher,
    { refreshInterval: 30000 },
  );

  const items: PatientEpisode[] = ptData?.items || [];
  const kpis = ptData?.kpis || { myPatients: 0, onVentilator: 0, highSofa: 0, needRounding: 0 };
  const beds: string[] = ptData?.beds || [];
  const rd: RoundingSummary | null = rounding || null;

  // Filter & sort
  const filtered = useMemo(() => {
    let arr = [...items];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      arr = arr.filter(
        (e) =>
          e.patientName.toLowerCase().includes(q) ||
          (e.location?.bed || '').toLowerCase().includes(q) ||
          e.patientId.toLowerCase().includes(q),
      );
    }
    if (bedFilter !== 'ALL') {
      arr = arr.filter((e) => (e.location?.bed || '') === bedFilter);
    }
    if (statusFilter !== 'ALL') {
      arr = arr.filter((e) => e.status === statusFilter);
    }
    arr.sort((a, b) => {
      if (sortBy === 'bed') return (a.location?.bed || '').localeCompare(b.location?.bed || '');
      if (sortBy === 'sofa') return (b.sofaScore?.totalScore || 0) - (a.sofaScore?.totalScore || 0);
      if (sortBy === 'mews') return (b.latestAssessment?.mewsScore || 0) - (a.latestAssessment?.mewsScore || 0);
      if (sortBy === 'los') return b.losDays - a.losDays;
      return 0;
    });
    return arr;
  }, [items, searchQ, bedFilter, statusFilter, sortBy]);

  // Reset tab when switching patients
  React.useEffect(() => {
    if (selectedEpId) setActiveTab('overview');
  }, [selectedEpId]);

  // Handlers
  const handleSaveProgress = useCallback(async () => {
    if (!selectedEpId || !rd?.episode?.encounterCoreId) return;
    setSavingProgress(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${selectedEpId}/doctor-progress`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          ...progressForm,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم حفظ الملاحظة', 'Progress note saved') });
      setProgressForm({ assessment: '', changesToday: '', planNext24h: '', dispositionPlan: '' });
      mutateRounding();
      mutatePt();
    } catch {
      toast({ title: tr('خطأ في الحفظ', 'Save error'), variant: 'destructive' });
    } finally {
      setSavingProgress(false);
    }
  }, [selectedEpId, rd, progressForm, toast, tr, mutateRounding, mutatePt]);

  const handleCreateOrder = useCallback(async () => {
    if (!selectedEpId || !orderTitle.trim()) return;
    setSavingOrder(true);
    try {
      const res = await fetch(`/api/ipd/episodes/${selectedEpId}/orders`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: orderKind, title: orderTitle, notes: orderNotes }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم إنشاء الطلب', 'Order created') });
      setOrderDialogOpen(false);
      setOrderTitle('');
      setOrderNotes('');
      mutateRounding();
    } catch {
      toast({ title: tr('خطأ في الطلب', 'Order error'), variant: 'destructive' });
    } finally {
      setSavingOrder(false);
    }
  }, [selectedEpId, orderKind, orderTitle, orderNotes, toast, tr, mutateRounding]);

  const handleAckResult = useCallback(async (resultId: string) => {
    try {
      const res = await fetch(`/api/ipd/results/${resultId}/acknowledge`, { credentials: 'include', method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم الاعتراف', 'Acknowledged') });
      mutateRounding();
    } catch {
      toast({ title: tr('خطأ', 'Error'), variant: 'destructive' });
    }
  }, [toast, tr, mutateRounding]);

  const handleTransfer = useCallback(async (destination: string) => {
    if (!selectedEpId) return;
    try {
      const res = await fetch(`/api/icu/episodes/${selectedEpId}/transfer`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, note: '' }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: tr('تم النقل', 'Transfer complete') });
      mutatePt();
      mutateRounding();
    } catch {
      toast({ title: tr('خطأ في النقل', 'Transfer error'), variant: 'destructive' });
    }
  }, [selectedEpId, toast, tr, mutatePt, mutateRounding]);

  // ---------- Sub-components ----------

  function SofaBadge({ score }: { score: number | null }) {
    if (score === null || score === undefined) return <span className="text-xs text-muted-foreground">--</span>;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${sofaColor(score)}`}>
        SOFA {score}
      </span>
    );
  }

  function VentChip({ mode, fio2, isOn }: { mode: string | null; fio2: number | null; isOn: boolean }) {
    if (!isOn) return <span className="text-xs text-muted-foreground">{tr('تنفس ذاتي', 'Self-vent')}</span>;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
        <Wind className="w-3 h-3" />
        {mode || '?'} {fio2 ? `${fio2}%` : ''}
      </span>
    );
  }

  function MewsBadgeInline({ score }: { score: number | null }) {
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${mewsColor(score)}`}>
        {score ?? '--'}
      </span>
    );
  }

  // ---------- TAB VIEWS ----------

  function OverviewTab() {
    if (!rd) return <LoadingPlaceholder />;
    const ep = rd.episode;
    const sofa = rd.sofaScores?.[0] || null;
    const vent = rd.ventilatorRecords?.find((v: any) => v.isActive) || null;
    return (
      <div className="space-y-4">
        {/* Patient Info */}
        <div className="grid grid-cols-2 gap-3">
          <InfoRow label={tr('المريض', 'Patient')} value={ep.patientName} />
          <InfoRow label={tr('السبب', 'Admission Reason')} value={ep.reasonForAdmission} />
          <InfoRow label={tr('الموقع', 'Location')} value={`${ep.location?.unit || ''} - ${tr('سرير', 'Bed')} ${ep.location?.bed || ''}`} />
          <InfoRow label={tr('الحالة', 'Status')} value={ep.status} />
        </div>

        {/* SOFA Score Card */}
        {sofa && (
          <div className="border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-2">{tr('درجة SOFA الحالية', 'Current SOFA Score')}</h4>
            <div className="flex items-center gap-4 mb-2">
              <span className={`text-3xl font-bold px-3 py-1 rounded-lg ${sofaColor(sofa.totalScore)}`}>
                {sofa.totalScore}/24
              </span>
              <span className="text-sm text-muted-foreground">{sofaRisk(sofa.totalScore, tr)}</span>
            </div>
            <div className="grid grid-cols-6 gap-2 text-xs text-center">
              {[
                { label: tr('تنفس', 'Resp'), val: sofa.respiratory },
                { label: tr('تخثر', 'Coag'), val: sofa.coagulation },
                { label: tr('كبد', 'Liver'), val: sofa.liver },
                { label: tr('قلب', 'Cardio'), val: sofa.cardiovascular },
                { label: tr('عصبي', 'CNS'), val: sofa.cns },
                { label: tr('كلوي', 'Renal'), val: sofa.renal },
              ].map((o) => (
                <div key={o.label} className="border rounded p-1">
                  <div className="text-muted-foreground">{o.label}</div>
                  <div className="font-bold text-lg">{o.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ventilator Status */}
        <div className="border rounded-lg p-3">
          <h4 className="font-semibold text-sm mb-2">{tr('جهاز التنفس', 'Ventilator Status')}</h4>
          {vent ? (
            <div className="grid grid-cols-3 gap-2 text-sm">
              <InfoRow label={tr('الوضع', 'Mode')} value={vent.mode} />
              <InfoRow label="FiO2" value={`${vent.settings?.fio2 || '--'}%`} />
              <InfoRow label="PEEP" value={`${vent.settings?.peep || '--'} cmH₂O`} />
              <InfoRow label={tr('خطة الفطام', 'Weaning Plan')} value={vent.weaningPlan || tr('لا يوجد', 'None')} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{tr('تنفس ذاتي', 'Self-ventilating')}</p>
          )}
        </div>

        {/* Active Drips */}
        {rd.activeDrips.length > 0 && (
          <div className="border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-2">{tr('الأدوية المستمرة', 'Active Drips')}</h4>
            <div className="space-y-1">
              {rd.activeDrips.map((d: any, i: number) => (
                <div key={i} className="flex justify-between text-sm border-b pb-1">
                  <span className="font-medium">{d.drugName}</span>
                  <span className="text-muted-foreground">{d.dose || `${d.rate} mL/hr`}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Allergies & Problems */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-1">{tr('الحساسية', 'Allergies')}</h4>
            {rd.allergies.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا يوجد', 'None')}</p>
            ) : (
              rd.allergies.map((a: any, i: number) => (
                <span key={i} className="inline-block px-2 py-0.5 mr-1 mb-1 rounded-full text-xs bg-red-50 text-red-700 border border-red-200">
                  {a.name} {a.severity && `(${a.severity})`}
                </span>
              ))
            )}
          </div>
          <div className="border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-1">{tr('المشاكل النشطة', 'Active Problems')}</h4>
            {rd.activeProblems.length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا يوجد', 'None')}</p>
            ) : (
              rd.activeProblems.map((p: any, i: number) => (
                <div key={i} className="text-xs mb-0.5">
                  {p.name} {p.icd10 && <span className="text-muted-foreground">({p.icd10})</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ICU Events Timeline */}
        {rd.icuEvents.length > 0 && (
          <div className="border rounded-lg p-3">
            <h4 className="font-semibold text-sm mb-2">{tr('أحداث العناية', 'ICU Events')}</h4>
            <div className="space-y-1">
              {rd.icuEvents.slice(0, 10).map((ev: any) => (
                <div key={ev.id} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${ev.type === 'ADMIT' ? 'bg-green-500' : ev.type === 'DISCHARGE' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <span className="font-medium">{ev.type}</span>
                  {ev.source && <span className="text-muted-foreground">{tr('من', 'from')} {ev.source}</span>}
                  {ev.destination && <span className="text-muted-foreground">{tr('إلى', 'to')} {ev.destination}</span>}
                  <span className="text-muted-foreground ml-auto">{new Date(ev.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function FlowsheetTab() {
    if (!selectedEpId) return null;
    return <ICUFlowsheet episodeId={selectedEpId} />;
  }

  function ProgressTab() {
    if (!rd) return <LoadingPlaceholder />;
    return (
      <div className="space-y-4">
        {/* Write progress note */}
        <div className="border rounded-lg p-3 space-y-2">
          <h4 className="font-semibold text-sm">{tr('كتابة ملاحظة الجولة', 'Write Rounding Note')}</h4>
          <textarea className="w-full border rounded p-2 text-sm" rows={2}
            placeholder={tr('التقييم العام...', 'Assessment...')}
            value={progressForm.assessment}
            onChange={(e) => setProgressForm((p) => ({ ...p, assessment: e.target.value }))}
          />
          <textarea className="w-full border rounded p-2 text-sm" rows={2}
            placeholder={tr('التغييرات اليوم...', 'Changes today...')}
            value={progressForm.changesToday}
            onChange={(e) => setProgressForm((p) => ({ ...p, changesToday: e.target.value }))}
          />
          <textarea className="w-full border rounded p-2 text-sm" rows={2}
            placeholder={tr('خطة الـ 24 ساعة القادمة...', 'Plan next 24h...')}
            value={progressForm.planNext24h}
            onChange={(e) => setProgressForm((p) => ({ ...p, planNext24h: e.target.value }))}
          />
          <textarea className="w-full border rounded p-2 text-sm" rows={1}
            placeholder={tr('خطة التصرف...', 'Disposition plan...')}
            value={progressForm.dispositionPlan}
            onChange={(e) => setProgressForm((p) => ({ ...p, dispositionPlan: e.target.value }))}
          />
          <button onClick={handleSaveProgress} disabled={savingProgress || !progressForm.assessment.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {savingProgress ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الملاحظة', 'Save Note')}
          </button>
        </div>
        {/* History */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">{tr('السجل', 'History')}</h4>
          {rd.progressNotes.length === 0 && <p className="text-xs text-muted-foreground">{tr('لا توجد ملاحظات', 'No notes yet')}</p>}
          {rd.progressNotes.map((n: any) => (
            <div key={n.id} className="border rounded p-2 text-xs space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>{n.date || ''}</span>
                <span>{n.author?.name || ''}</span>
              </div>
              {n.assessment && <p><strong>{tr('التقييم:', 'Assessment:')}</strong> {n.assessment}</p>}
              {n.changesToday && <p><strong>{tr('التغييرات:', 'Changes:')}</strong> {n.changesToday}</p>}
              {n.planNext24h && <p><strong>{tr('الخطة:', 'Plan:')}</strong> {n.planNext24h}</p>}
              {n.dispositionPlan && <p><strong>{tr('التصرف:', 'Disposition:')}</strong> {n.dispositionPlan}</p>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function OrdersTab() {
    if (!rd) return <LoadingPlaceholder />;
    const vasopressors = rd.medOrders.filter((o: any) => o.isVasopressor);
    const sedation = rd.medOrders.filter((o: any) => o.isSedation);
    const antibiotics = rd.medOrders.filter((o: any) => o.isAntibiotic);
    const others = rd.medOrders.filter((o: any) => !o.isVasopressor && !o.isSedation && !o.isAntibiotic);

    function OrderSection({ title, icon, orders, color }: { title: string; icon: React.ReactNode; orders: any[]; color: string }) {
      if (orders.length === 0) return null;
      return (
        <div className={`border-l-4 ${color} rounded-lg p-2 mb-2`}>
          <h5 className="flex items-center gap-1 font-semibold text-xs mb-1">{icon} {title} ({orders.length})</h5>
          {orders.map((o: any) => (
            <div key={o.id} className="flex justify-between text-xs py-0.5 border-b last:border-0">
              <span>{o.drugName}</span>
              <span className="text-muted-foreground">{o.dose} {o.doseUnit} {o.route} {o.frequency}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-semibold text-sm">{tr('الطلبات', 'Orders')}</h4>
          <button onClick={() => setOrderDialogOpen(true)}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
            <Plus className="w-3 h-3" /> {tr('طلب جديد', 'New Order')}
          </button>
        </div>

        <OrderSection title={tr('مقويات الضغط', 'Vasopressors')} icon={<Heart className="w-3 h-3 text-red-600" />} orders={vasopressors} color="border-red-400" />
        <OrderSection title={tr('التخدير', 'Sedation')} icon={<Brain className="w-3 h-3 text-purple-600" />} orders={sedation} color="border-purple-400" />
        <OrderSection title={tr('المضادات الحيوية', 'Antibiotics')} icon={<ShieldAlert className="w-3 h-3 text-amber-600" />} orders={antibiotics} color="border-amber-400" />
        <OrderSection title={tr('أدوية أخرى', 'Other Medications')} icon={<Pill className="w-3 h-3 text-blue-600" />} orders={others} color="border-blue-400" />

        {/* Lab/Imaging Orders */}
        {rd.labImagingOrders.length > 0 && (
          <div className="border rounded-lg p-2">
            <h5 className="font-semibold text-xs mb-1">{tr('فحوصات مخبرية / أشعة', 'Lab / Imaging')}</h5>
            {rd.labImagingOrders.map((o: any) => (
              <div key={o.id} className="flex justify-between text-xs py-0.5 border-b last:border-0">
                <span>{o.title}</span>
                <span className={`px-1.5 rounded ${o.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function ResultsTab() {
    if (!rd) return <LoadingPlaceholder />;
    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">{tr('النتائج', 'Results')}</h4>
        {rd.results.length === 0 && <p className="text-xs text-muted-foreground">{tr('لا توجد نتائج', 'No results')}</p>}
        {rd.results.map((r: any) => (
          <div key={r.id} className={`border rounded p-2 text-xs ${r.criticalFlag ? 'border-red-300 bg-red-50' : r.abnormal ? 'border-yellow-300 bg-yellow-50' : ''}`}>
            <div className="flex justify-between items-center">
              <span className="font-medium">{r.orderName || r.resultType}</span>
              <div className="flex items-center gap-2">
                {r.criticalFlag && <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold">{tr('حرج', 'CRITICAL')}</span>}
                {r.abnormal && !r.criticalFlag && <span className="px-1.5 py-0.5 bg-yellow-500 text-white rounded text-[10px] font-bold">{tr('غير طبيعي', 'ABN')}</span>}
                {!r.acknowledged && (
                  <button onClick={() => handleAckResult(r.id)}
                    className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700">
                    <Check className="w-3 h-3 inline" /> {tr('اعتراف', 'Ack')}
                  </button>
                )}
                {r.acknowledged && <span className="text-green-600"><Check className="w-3 h-3 inline" /></span>}
              </div>
            </div>
            {r.value !== null && (
              <p className="mt-1">{r.value} {r.unit || ''}</p>
            )}
            <p className="text-muted-foreground mt-0.5">{new Date(r.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    );
  }

  function VitalsTab() {
    if (!rd) return <LoadingPlaceholder />;
    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">{tr('الإشارات الحيوية — آخر 48 ساعة', 'Vitals — Last 48h')}</h4>
        {rd.vitalsTrend.length === 0 && <p className="text-xs text-muted-foreground">{tr('لا توجد بيانات', 'No data')}</p>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-2 py-1 border">{tr('الوقت', 'Time')}</th>
                <th className="px-2 py-1 border">HR</th>
                <th className="px-2 py-1 border">BP</th>
                <th className="px-2 py-1 border">RR</th>
                <th className="px-2 py-1 border">{tr('حرارة', 'Temp')}</th>
                <th className="px-2 py-1 border">SpO2</th>
                <th className="px-2 py-1 border">{tr('ألم', 'Pain')}</th>
              </tr>
            </thead>
            <tbody>
              {rd.vitalsTrend.slice(-30).map((v: any, i: number) => {
                const vit = v.vitals || {};
                return (
                  <tr key={i} className={v.critical ? 'bg-red-50' : ''}>
                    <td className="px-2 py-1 border text-muted-foreground">{new Date(v.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-2 py-1 border">{vit.heartRate || '--'}</td>
                    <td className="px-2 py-1 border">{vit.systolic && vit.diastolic ? `${vit.systolic}/${vit.diastolic}` : '--'}</td>
                    <td className="px-2 py-1 border">{vit.respiratoryRate || '--'}</td>
                    <td className="px-2 py-1 border">{vit.temperature || '--'}</td>
                    <td className="px-2 py-1 border">{vit.spo2 || '--'}</td>
                    <td className="px-2 py-1 border">{v.painScore ?? '--'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function CarePlansTab() {
    if (!rd) return <LoadingPlaceholder />;
    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">{tr('خطط رعاية العناية', 'ICU Care Plans')}</h4>
        {rd.icuCarePlans.length === 0 && <p className="text-xs text-muted-foreground">{tr('لا يوجد', 'None')}</p>}
        {rd.icuCarePlans.map((cp: any) => (
          <div key={cp.id} className="border rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="font-medium">{new Date(cp.date).toLocaleDateString()} — {cp.shift}</span>
            </div>
            {cp.dailyGoals && typeof cp.dailyGoals === 'object' && (
              <div><strong>{tr('الأهداف:', 'Goals:')}</strong> {JSON.stringify(cp.dailyGoals)}</div>
            )}
            {cp.careBundle && typeof cp.careBundle === 'object' && (
              <div><strong>{tr('حزمة الرعاية:', 'Care Bundle:')}</strong> {Object.entries(cp.careBundle).filter(([, v]) => v).map(([k]) => k).join(', ') || tr('لا يوجد', 'None')}</div>
            )}
            <div className="grid grid-cols-3 gap-2 mt-1">
              {cp.sedationLevel && <span>{tr('التخدير:', 'Sedation:')} {cp.sedationLevel}</span>}
              {cp.painScore !== null && <span>{tr('الألم:', 'Pain:')} {cp.painScore}/10</span>}
              {cp.deliriumScreen && <span>{tr('الهذيان:', 'Delirium:')} {cp.deliriumScreen}</span>}
              {cp.mobilityGoal && <span>{tr('التحرك:', 'Mobility:')} {cp.mobilityGoal}</span>}
              {cp.nutritionStatus && <span>{tr('التغذية:', 'Nutrition:')} {cp.nutritionStatus}</span>}
            </div>
            {cp.notes && <p className="text-muted-foreground mt-1">{cp.notes}</p>}
          </div>
        ))}

        {/* Standard IPD care plans */}
        {rd.carePlans.length > 0 && (
          <>
            <h4 className="font-semibold text-sm mt-4">{tr('خطط الرعاية العامة', 'General Care Plans')}</h4>
            {rd.carePlans.map((cp: any) => (
              <div key={cp.id} className="border rounded p-2 text-xs">
                <strong>{cp.problem}</strong>
                {cp.goals && <p>{tr('الأهداف:', 'Goals:')} {cp.goals}</p>}
                {cp.interventions && <p>{tr('التدخلات:', 'Interventions:')} {cp.interventions}</p>}
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  function DischargeTab() {
    if (!rd) return <LoadingPlaceholder />;
    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-sm">{tr('النقل / التخريج', 'Transfer / Discharge')}</h4>
        <p className="text-xs text-muted-foreground">
          {tr('اختر وجهة النقل للمريض', 'Select transfer destination for patient')}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => handleTransfer('WARD')}
            className="px-4 py-2 border rounded text-sm hover:bg-blue-50">
            {tr('نقل للجناح', 'Transfer to Ward')}
          </button>
          <button onClick={() => handleTransfer('ICU')}
            className="px-4 py-2 border rounded text-sm hover:bg-blue-50">
            {tr('نقل لعناية أخرى', 'Transfer to Other ICU')}
          </button>
          <button onClick={() => handleTransfer('DISCHARGE')}
            className="px-4 py-2 border rounded text-sm hover:bg-red-50 border-red-200 text-red-700">
            {tr('تخريج من العناية', 'Discharge from ICU')}
          </button>
        </div>

        {/* Fluid Balance Summary */}
        <div className="border rounded-lg p-3">
          <h5 className="font-semibold text-xs mb-2">{tr('ملخص السوائل — 48 ساعة', 'Fluid Balance — 48h')}</h5>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border rounded p-2">
              <div className="text-xs text-muted-foreground">{tr('الدخل', 'Intake')}</div>
              <div className="text-lg font-bold text-blue-600">{rd.fluidBalance.intake} mL</div>
            </div>
            <div className="border rounded p-2">
              <div className="text-xs text-muted-foreground">{tr('الخرج', 'Output')}</div>
              <div className="text-lg font-bold text-amber-600">{rd.fluidBalance.output} mL</div>
            </div>
            <div className="border rounded p-2">
              <div className="text-xs text-muted-foreground">{tr('الصافي', 'Net')}</div>
              <div className={`text-lg font-bold ${rd.fluidBalance.net > 0 ? 'text-blue-600' : rd.fluidBalance.net < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                {rd.fluidBalance.net > 0 ? '+' : ''}{rd.fluidBalance.net} mL
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function LoadingPlaceholder() {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> {tr('جاري التحميل...', 'Loading...')}
      </div>
    );
  }

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="text-sm">
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{value || '--'}</span>
      </div>
    );
  }

  // ---------- TABS ----------
  const tabs = [
    { key: 'overview', label: tr('نظرة عامة', 'Overview'), icon: <FileText className="w-3.5 h-3.5" /> },
    { key: 'flowsheet', label: tr('ورقة المتابعة', 'Flowsheet'), icon: <Activity className="w-3.5 h-3.5" /> },
    { key: 'progress', label: tr('الجولة اليومية', 'Daily Progress'), icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { key: 'orders', label: tr('الطلبات', 'Orders'), icon: <Syringe className="w-3.5 h-3.5" /> },
    { key: 'results', label: tr('النتائج', 'Results'), icon: <FlaskConical className="w-3.5 h-3.5" /> },
    { key: 'vitals', label: tr('الحيوية', 'Vitals'), icon: <Thermometer className="w-3.5 h-3.5" /> },
    { key: 'careplans', label: tr('خطط الرعاية', 'Care Plans'), icon: <Heart className="w-3.5 h-3.5" /> },
    { key: 'discharge', label: tr('النقل', 'Transfer'), icon: <LogOut className="w-3.5 h-3.5" /> },
  ];

  // ---------- RENDER ----------
  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-blue-600" />
          {tr('محطة طبيب العناية المركزة', 'ICU Doctor Station')}
        </h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showAllPatients}
            onChange={(e) => setShowAllPatients(e.target.checked)}
            className="rounded" />
          {tr('عرض الكل', 'Show All')}
        </label>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <TheaKpiCard
          label={tr('مرضاي', 'My ICU Patients')}
          value={kpis.myPatients}
          icon={<Users className="w-5 h-5 text-blue-600" />}
        />
        <TheaKpiCard
          label={tr('على جهاز تنفس', 'On Ventilator')}
          value={kpis.onVentilator}
          icon={<Wind className="w-5 h-5 text-cyan-600" />}
        />
        <TheaKpiCard
          label={tr('SOFA عالي', 'High SOFA')}
          value={kpis.highSofa}
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
        />
        <TheaKpiCard
          label={tr('يحتاج جولة', 'Need Rounding')}
          value={kpis.needRounding}
          icon={<ClipboardList className="w-5 h-5 text-amber-600" />}
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
          <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            placeholder={tr('بحث: اسم، سرير، معرف...', 'Search: name, bed, ID...')}
            className="w-full pl-8 pr-3 py-2 border rounded text-sm" />
        </div>
        <select value={bedFilter} onChange={(e) => setBedFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="ALL">{tr('كل الأسرة', 'All Beds')}</option>
          {beds.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          <option value="ALL">{tr('كل الحالات', 'All Status')}</option>
          <option value="ACTIVE">{tr('نشط', 'Active')}</option>
          <option value="DISCHARGE_READY">{tr('جاهز للنقل', 'Discharge Ready')}</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'bed' | 'sofa' | 'mews' | 'los')}
          className="border rounded px-3 py-2 text-sm">
          <option value="sofa">{tr('الأعلى SOFA', 'Highest SOFA')}</option>
          <option value="mews">{tr('الأعلى MEWS', 'Highest MEWS')}</option>
          <option value="bed">{tr('حسب السرير', 'By Bed')}</option>
          <option value="los">{tr('مدة البقاء', 'By LOS')}</option>
        </select>
        <button onClick={() => { mutatePt(); mutateRounding(); }}
          className="p-2 border rounded hover:bg-muted/50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content: Patient List + Detail */}
      <div className="flex gap-4" style={{ minHeight: 500 }}>
        {/* Left: Patient List */}
        <div className="w-[340px] shrink-0 border rounded-lg overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
            {tr('قائمة المرضى', 'Patient List')} ({filtered.length})
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 600 }}>
            {filtered.length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">{tr('لا يوجد مرضى', 'No patients')}</p>
            )}
            {filtered.map((ep) => (
              <div key={ep.id}
                onClick={() => setSelectedEpId(ep.id)}
                className={`p-3 border-b cursor-pointer hover:bg-blue-50 transition ${selectedEpId === ep.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {!ep.hasProgressToday && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" title={tr('لم تُكتب ملاحظة الجولة', 'No progress note today')} />}
                      <span className="font-semibold text-sm truncate">{ep.patientName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Bed className="w-3 h-3" /> {ep.location?.bed || '--'}
                      </span>
                      <SofaBadge score={ep.sofaScore?.totalScore ?? null} />
                      <MewsBadgeInline score={ep.latestAssessment?.mewsScore ?? null} />
                      <VentChip mode={ep.ventilatorMode} fio2={ep.ventilatorFio2} isOn={ep.isOnVentilator} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>{tr('اليوم', 'Day')} {ep.losDays}</span>
                      {ep.activeDripsCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Droplets className="w-3 h-3 text-red-400" /> {ep.activeDripsCount} {tr('تسريب', 'drips')}
                        </span>
                      )}
                      {ep.pendingResultsCount > 0 && (
                        <span className="flex items-center gap-0.5 text-purple-500">
                          <FlaskConical className="w-3 h-3" /> {ep.pendingResultsCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Detail View */}
        <div className="flex-1 border rounded-lg overflow-hidden">
          {!selectedEpId ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <Stethoscope className="w-5 h-5 mr-2 opacity-50" />
              {tr('اختر مريض من القائمة', 'Select a patient from the list')}
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b overflow-x-auto bg-muted/50">
                {tabs.map((tab) => (
                  <button key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition
                      ${activeTab === tab.key ? 'border-blue-600 text-blue-700 bg-card' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-4 overflow-y-auto" style={{ maxHeight: 560 }}>
                {activeTab === 'overview' && <OverviewTab />}
                {activeTab === 'flowsheet' && <FlowsheetTab />}
                {activeTab === 'progress' && <ProgressTab />}
                {activeTab === 'orders' && <OrdersTab />}
                {activeTab === 'results' && <ResultsTab />}
                {activeTab === 'vitals' && <VitalsTab />}
                {activeTab === 'careplans' && <CarePlansTab />}
                {activeTab === 'discharge' && <DischargeTab />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Order Dialog */}
      {orderDialogOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setOrderDialogOpen(false)}>
          <div className="bg-card rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{tr('طلب جديد', 'New Order')}</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['LAB', 'IMAGING', 'NURSING'] as const).map((k) => (
                  <button key={k} onClick={() => setOrderKind(k)}
                    className={`px-3 py-1 rounded text-sm ${orderKind === k ? 'bg-blue-600 text-white' : 'border'}`}>
                    {k === 'LAB' ? tr('مخبري', 'Lab') : k === 'IMAGING' ? tr('أشعة', 'Imaging') : tr('تمريض', 'Nursing')}
                  </button>
                ))}
              </div>
              <input type="text" value={orderTitle} onChange={(e) => setOrderTitle(e.target.value)}
                placeholder={tr('عنوان الطلب...', 'Order title...')}
                className="w-full border rounded p-2 text-sm" />
              <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={tr('ملاحظات...', 'Notes...')}
                className="w-full border rounded p-2 text-sm" rows={2} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setOrderDialogOpen(false)}
                  className="px-4 py-1.5 border rounded text-sm">{tr('إلغاء', 'Cancel')}</button>
                <button onClick={handleCreateOrder} disabled={savingOrder || !orderTitle.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                  {savingOrder ? tr('جاري...', 'Saving...') : tr('إنشاء', 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
