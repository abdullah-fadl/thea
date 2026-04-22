'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Plus,
  ChevronRight,
  Activity,
  FlaskConical,
  Pill,
  FileText,
  CalendarCheck,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Constants ──────────────────────────────────────────────────────────────

const ORGAN_TYPES = [
  { value: 'KIDNEY',                   ar: 'كلية',               en: 'Kidney' },
  { value: 'LIVER',                    ar: 'كبد',                en: 'Liver' },
  { value: 'HEART',                    ar: 'قلب',                en: 'Heart' },
  { value: 'LUNG',                     ar: 'رئة',                en: 'Lung' },
  { value: 'PANCREAS',                 ar: 'بنكرياس',            en: 'Pancreas' },
  { value: 'COMBINED_KIDNEY_PANCREAS', ar: 'كلية + بنكرياس',      en: 'Kidney–Pancreas' },
];

const TRANSPLANT_TYPES = [
  { value: 'DECEASED_DONOR',   ar: 'متبرع متوفى',    en: 'Deceased Donor' },
  { value: 'LIVING_RELATED',   ar: 'متبرع حي (أقارب)', en: 'Living Related' },
  { value: 'LIVING_UNRELATED', ar: 'متبرع حي (غير أقارب)', en: 'Living Unrelated' },
];

const STATUSES: Record<string, { ar: string; en: string; color: string }> = {
  EVALUATION:    { ar: 'تقييم',           en: 'Evaluation',    color: 'bg-muted text-foreground' },
  WAITLISTED:    { ar: 'قائمة الانتظار',  en: 'Waitlisted',    color: 'bg-amber-100 text-amber-700' },
  TRANSPLANTED:  { ar: 'تم الزرع',        en: 'Transplanted',  color: 'bg-green-100 text-green-700' },
  FOLLOW_UP:     { ar: 'متابعة',          en: 'Follow-Up',     color: 'bg-blue-100 text-blue-700' },
  REJECTED:      { ar: 'رُفض',            en: 'Rejected',      color: 'bg-red-100 text-red-700' },
  LOST_GRAFT:    { ar: 'فشل الزرع',       en: 'Graft Loss',    color: 'bg-red-900 text-red-100' },
};

const GRAFT_FUNCTION = [
  { value: 'EXCELLENT', ar: 'ممتاز',  en: 'Excellent' },
  { value: 'GOOD',      ar: 'جيد',   en: 'Good' },
  { value: 'REDUCED',   ar: 'منخفض', en: 'Reduced' },
  { value: 'POOR',      ar: 'ضعيف',  en: 'Poor' },
  { value: 'FAILED',    ar: 'فاشل',  en: 'Failed' },
];

const REJECTION_TYPES = [
  { value: 'HYPERACUTE',           ar: 'رفض فوري',           en: 'Hyperacute' },
  { value: 'ACUTE_CELLULAR',       ar: 'رفض خلوي حاد',       en: 'Acute Cellular' },
  { value: 'ACUTE_ANTIBODY',       ar: 'رفض بالأجسام المضادة', en: 'Acute Antibody-Mediated' },
  { value: 'CHRONIC_ACTIVE',       ar: 'رفض مزمن نشط',       en: 'Chronic Active' },
];

const BANFF_GRADES = ['IA', 'IB', 'IIA', 'IIB', 'III', 'V (chronic)', 'Not graded'];

const ORGAN_COLORS: Record<string, string> = {
  KIDNEY:                   'bg-blue-50 border-blue-200 text-blue-700',
  LIVER:                    'bg-amber-50 border-amber-200 text-amber-700',
  HEART:                    'bg-red-50 border-red-200 text-red-700',
  LUNG:                     'bg-cyan-50 border-cyan-200 text-cyan-700',
  PANCREAS:                 'bg-purple-50 border-purple-200 text-purple-700',
  COMBINED_KIDNEY_PANCREAS: 'bg-indigo-50 border-indigo-200 text-indigo-700',
};

// ── Helper ─────────────────────────────────────────────────────────────────

const fmtDate = (d: string | undefined | null, locale: string) =>
  d ? new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US') : '—';

// ── Component ──────────────────────────────────────────────────────────────

export function TransplantDashboard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';

  // list state
  const [search, setSearch]           = useState('');
  const [organFilter, setOrganFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // selected case for detail
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [detailTab, setDetailTab]     = useState<'overview' | 'followups' | 'rejections' | 'surgery'>('overview');

  // Create case dialog
  const [showCreate, setShowCreate]   = useState(false);
  const [createBusy, setCreateBusy]   = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm]   = useState({
    patientMasterId: '', organType: '', transplantType: 'DECEASED_DONOR',
    evaluationDate: new Date().toISOString().slice(0, 10),
    pra: '', notes: '',
  });

  // Follow-up form
  const [showFU, setShowFU]           = useState(false);
  const [fuBusy, setFuBusy]           = useState(false);
  const [fuError, setFuError]         = useState('');
  const [fuForm, setFuForm]           = useState({
    visitDate: new Date().toISOString().slice(0, 10),
    daysPostTransplant: '',
    graftFunction: 'GOOD',
    creatinine: '', tacrolimus: '', wbc: '',
    hemoglobin: '', platelets: '',
    complications: '', biopsyDone: false, biopsyResult: '', plan: '',
    nextVisit: '',
  });

  // Rejection form
  const [showRej, setShowRej]         = useState(false);
  const [rejBusy, setRejBusy]         = useState(false);
  const [rejError, setRejError]       = useState('');
  const [rejForm, setRejForm]         = useState({
    onsetDate: new Date().toISOString().slice(0, 10),
    type: '', banffGrade: '', treatment: '', response: '', graftLoss: false,
  });

  // Status update
  const [statusBusy, setStatusBusy]   = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data, mutate: mutateCases, isLoading } = useSWR(
    '/api/transplant/cases',
    fetcher,
    { refreshInterval: 60000 }
  );
  const cases: any[] = data?.cases ?? [];

  const { data: detailData, mutate: mutateDetail } = useSWR(
    selectedId ? `/api/transplant/cases/${selectedId}` : null,
    fetcher,
    { refreshInterval: 30000 }
  );
  const detail     = detailData?.case || null;
  const followUps: any[]  = detailData?.followUps  || detail?.followUps  || [];
  const rejections: any[] = detailData?.rejections  || detail?.rejectionEpisodes || [];

  // ── Derived KPIs ─────────────────────────────────────────────────────────

  const kpis = {
    total:       cases.length,
    waitlisted:  cases.filter((c) => c.status === 'WAITLISTED').length,
    transplanted:cases.filter((c) => ['TRANSPLANTED', 'FOLLOW_UP'].includes(c.status)).length,
    evaluation:  cases.filter((c) => c.status === 'EVALUATION').length,
    graftLoss:   cases.filter((c) => c.status === 'LOST_GRAFT').length,
  };

  // Organ breakdown
  const organCounts: Record<string, number> = {};
  for (const c of cases) {
    organCounts[c.organType] = (organCounts[c.organType] || 0) + 1;
  }

  // Filtered list
  const filtered = cases.filter((c) => {
    if (organFilter && c.organType !== organFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.patientMasterId?.toLowerCase().includes(q) ||
        c.organType?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleCreateCase = async () => {
    setCreateError('');
    if (!createForm.patientMasterId.trim() || !createForm.organType) {
      setCreateError(tr('الحقول المطلوبة ناقصة', 'Required fields are missing'));
      return;
    }
    setCreateBusy(true);
    try {
      const res = await fetch('/api/transplant/cases', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: createForm.patientMasterId.trim(),
          organType:       createForm.organType,
          transplantType:  createForm.transplantType,
          evaluationDate:  createForm.evaluationDate || undefined,
          pra:             createForm.pra ? Number(createForm.pra) : undefined,
          notes:           createForm.notes || undefined,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ patientMasterId: '', organType: '', transplantType: 'DECEASED_DONOR',
          evaluationDate: new Date().toISOString().slice(0, 10), pra: '', notes: '' });
        await mutateCases();
      } else {
        const err = await res.json().catch(() => ({}));
        setCreateError(err?.error || tr('حدث خطأ', 'An error occurred'));
      }
    } finally {
      setCreateBusy(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedId) return;
    setStatusBusy(true);
    try {
      await fetch(`/api/transplant/cases/${selectedId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await Promise.all([mutateDetail(), mutateCases()]);
    } finally {
      setStatusBusy(false);
    }
  };

  const handleAddFollowUp = async () => {
    setFuError('');
    if (!fuForm.visitDate || !fuForm.graftFunction) {
      setFuError(tr('تاريخ الزيارة ووظيفة الكسبة مطلوبان', 'Visit date and graft function are required'));
      return;
    }
    setFuBusy(true);
    try {
      const labs: Record<string, number> = {};
      if (fuForm.creatinine)  labs.creatinine  = Number(fuForm.creatinine);
      if (fuForm.tacrolimus)  labs.tacrolimus  = Number(fuForm.tacrolimus);
      if (fuForm.wbc)         labs.wbc         = Number(fuForm.wbc);
      if (fuForm.hemoglobin)  labs.hemoglobin  = Number(fuForm.hemoglobin);
      if (fuForm.platelets)   labs.platelets   = Number(fuForm.platelets);

      const res = await fetch(`/api/transplant/cases/${selectedId}/follow-ups`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitDate:         fuForm.visitDate,
          daysPostTransplant: fuForm.daysPostTransplant ? Number(fuForm.daysPostTransplant) : undefined,
          graftFunction:     fuForm.graftFunction,
          labs:              Object.keys(labs).length ? labs : undefined,
          complications:     fuForm.complications || undefined,
          biopsyDone:        fuForm.biopsyDone,
          biopsyResult:      fuForm.biopsyResult || undefined,
          plan:              fuForm.plan || undefined,
          nextVisit:         fuForm.nextVisit || undefined,
        }),
      });
      if (res.ok) {
        setShowFU(false);
        setFuForm({ visitDate: new Date().toISOString().slice(0, 10), daysPostTransplant: '',
          graftFunction: 'GOOD', creatinine: '', tacrolimus: '', wbc: '', hemoglobin: '',
          platelets: '', complications: '', biopsyDone: false, biopsyResult: '', plan: '', nextVisit: '' });
        await mutateDetail();
      } else {
        const err = await res.json().catch(() => ({}));
        setFuError(err?.error || tr('حدث خطأ', 'An error occurred'));
      }
    } finally {
      setFuBusy(false);
    }
  };

  const handleAddRejection = async () => {
    setRejError('');
    if (!rejForm.onsetDate || !rejForm.type || !rejForm.treatment) {
      setRejError(tr('التاريخ والنوع والعلاج مطلوبة', 'Date, type, and treatment are required'));
      return;
    }
    setRejBusy(true);
    try {
      const res = await fetch(`/api/transplant/cases/${selectedId}/rejections`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onsetDate:  rejForm.onsetDate,
          type:       rejForm.type,
          banffGrade: rejForm.banffGrade || undefined,
          treatment:  rejForm.treatment,
          response:   rejForm.response || undefined,
          graftLoss:  rejForm.graftLoss,
        }),
      });
      if (res.ok) {
        setShowRej(false);
        setRejForm({ onsetDate: new Date().toISOString().slice(0, 10), type: '',
          banffGrade: '', treatment: '', response: '', graftLoss: false });
        await mutateDetail();
        if (rejForm.graftLoss) await mutateCases();
      } else {
        const err = await res.json().catch(() => ({}));
        setRejError(err?.error || tr('حدث خطأ', 'An error occurred'));
      }
    } finally {
      setRejBusy(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const organLabel = (v: string) => {
    const o = ORGAN_TYPES.find((x) => x.value === v);
    return o ? tr(o.ar, o.en) : v;
  };
  const txTypeLabel = (v: string) => {
    const t = TRANSPLANT_TYPES.find((x) => x.value === v);
    return t ? tr(t.ar, t.en) : (v || '—');
  };
  const graftLabel = (v: string) => {
    const g = GRAFT_FUNCTION.find((x) => x.value === v);
    return g ? tr(g.ar, g.en) : v;
  };
  const graftColor = (v: string) => {
    const m: Record<string, string> = {
      EXCELLENT: 'bg-green-100 text-green-700',
      GOOD:      'bg-teal-100 text-teal-700',
      REDUCED:   'bg-yellow-100 text-yellow-700',
      POOR:      'bg-orange-100 text-orange-700',
      FAILED:    'bg-red-100 text-red-700',
    };
    return m[v] || 'bg-muted text-muted-foreground';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-600" />
            {tr('زراعة الأعضاء', 'Transplant Program')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة حالات زراعة الأعضاء والمتابعة', 'Organ transplant case management and follow-up')}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          {tr('حالة جديدة', 'New Case')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: tr('إجمالي الحالات', 'Total Cases'),    value: kpis.total,       icon: <Users className="h-5 w-5" />,       color: 'bg-slate-50 border-slate-200 text-slate-800' },
          { label: tr('قائمة الانتظار', 'Waitlisted'),     value: kpis.waitlisted,  icon: <Clock className="h-5 w-5" />,       color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: tr('تم الزرع', 'Transplanted'),          value: kpis.transplanted,icon: <Heart className="h-5 w-5" />,      color: 'bg-green-50 border-green-200 text-green-800' },
          { label: tr('تقييم', 'Under Evaluation'),         value: kpis.evaluation,  icon: <CheckCircle className="h-5 w-5" />, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: tr('فشل الزرع', 'Graft Loss'),           value: kpis.graftLoss,   icon: <AlertTriangle className="h-5 w-5" />, color: 'bg-red-50 border-red-200 text-red-800' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 flex flex-col gap-1 ${kpi.color}`}>
            <div className="opacity-60">{kpi.icon}</div>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-3xl font-extrabold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Organ filter tiles */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">{tr('فلترة حسب العضو', 'Filter by Organ')}</p>
        <div className="flex flex-wrap gap-2">
          {ORGAN_TYPES.filter((o) => organCounts[o.value] > 0).map((o) => (
            <button
              key={o.value}
              onClick={() => setOrganFilter(organFilter === o.value ? '' : o.value)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-all ${
                organFilter === o.value
                  ? `${ORGAN_COLORS[o.value] || 'bg-slate-100 text-slate-700 border-slate-300'} ring-2 ring-offset-1 ring-current`
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              {tr(o.ar, o.en)}
              <span className="ml-1.5 text-xs opacity-70">({organCounts[o.value] || 0})</span>
            </button>
          ))}
          {organFilter && (
            <button onClick={() => setOrganFilter('')} className="text-xs text-muted-foreground underline hover:no-underline">
              {tr('مسح', 'Clear')}
            </button>
          )}
        </div>
      </div>

      {/* Search + Status filter */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder={tr('بحث بالمريض أو العضو...', 'Search by patient or organ...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9 text-sm"
        />
        <Select value={statusFilter || '_all'} onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v)}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder={tr('كل الحالات', 'All statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{tr('كل الحالات', 'All statuses')}</SelectItem>
            {Object.entries(STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cases table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-base">{tr('قائمة الحالات', 'Cases')}</h2>
          {filtered.length > 0 && (
            <span className="text-xs text-muted-foreground">{filtered.length} {tr('حالة', 'cases')}</span>
          )}
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">{tr('جاري التحميل...', 'Loading...')}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Heart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{tr('لا توجد حالات مطابقة', 'No matching cases')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[
                    tr('المريض', 'Patient'),
                    tr('العضو', 'Organ'),
                    tr('نوع الزراعة', 'Transplant Type'),
                    tr('تاريخ التقييم', 'Evaluation'),
                    tr('تاريخ الزرع', 'Transplant Date'),
                    'PRA %',
                    tr('الحالة', 'Status'),
                    '',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-semibold whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any) => {
                  const statusCfg = STATUSES[c.status] || { ar: c.status, en: c.status, color: 'bg-muted text-muted-foreground' };
                  const organColor = ORGAN_COLORS[c.organType] || 'bg-slate-100 text-slate-700 border-slate-200';
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => { setSelectedId(c.id); setDetailTab('overview'); }}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.patientMasterId}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${organColor}`}>
                          {organLabel(c.organType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{txTypeLabel(c.transplantType)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(c.evaluationDate, language)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(c.transplantDate, language)}</td>
                      <td className="px-4 py-3 text-xs">{c.pra != null ? `${c.pra}%` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                          {tr(statusCfg.ar, statusCfg.en)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Case Detail Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col overflow-hidden p-0">
          {detail ? (
            <>
              {/* Dialog Header */}
              <div className="px-6 pt-5 pb-4 border-b border-border flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full border ${ORGAN_COLORS[detail.organType] || ''}`}>
                      {organLabel(detail.organType)}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(STATUSES[detail.status] || STATUSES.EVALUATION).color}`}>
                      {tr((STATUSES[detail.status] || STATUSES.EVALUATION).ar, (STATUSES[detail.status] || STATUSES.EVALUATION).en)}
                    </span>
                    {detail.status !== 'LOST_GRAFT' && (
                      <Select
                        value={detail.status}
                        onValueChange={handleUpdateStatus}
                        disabled={statusBusy}
                      >
                        <SelectTrigger className="h-7 w-auto text-xs border-dashed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUSES).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{tr(v.ar, v.en)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{detail.patientMasterId}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-0 border-b border-border px-6">
                {([
                  { key: 'overview',    icon: <FileText className="h-3.5 w-3.5" />,    ar: 'نظرة عامة',   en: 'Overview' },
                  { key: 'followups',   icon: <CalendarCheck className="h-3.5 w-3.5" />,ar: 'المتابعة',  en: 'Follow-Ups' },
                  { key: 'rejections',  icon: <AlertTriangle className="h-3.5 w-3.5" />,ar: 'حالات الرفض', en: 'Rejections' },
                  { key: 'surgery',     icon: <Activity className="h-3.5 w-3.5" />,     ar: 'التفاصيل الجراحية', en: 'Surgery Details' },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === tab.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.icon}
                    {tr(tab.ar, tab.en)}
                    {tab.key === 'followups'  && followUps.length  > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{followUps.length}</Badge>
                    )}
                    {tab.key === 'rejections' && rejections.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{rejections.length}</Badge>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto px-6 py-5">

                {/* ── Overview Tab ── */}
                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {[
                        { label: tr('نوع الزراعة', 'Transplant Type'),  value: txTypeLabel(detail.transplantType) },
                        { label: tr('تاريخ التقييم', 'Evaluation Date'), value: fmtDate(detail.evaluationDate, language) },
                        { label: tr('تاريخ الإدراج', 'Listing Date'),    value: fmtDate(detail.listingDate, language) },
                        { label: tr('تاريخ الزرع', 'Transplant Date'),   value: fmtDate(detail.transplantDate, language) },
                        { label: 'PRA %',                                 value: detail.pra != null ? `${detail.pra}%` : '—' },
                        { label: tr('زمن نقص التروية البارد', 'Cold Ischemia Time'), value: detail.coldIschemiaTime ? `${detail.coldIschemiaTime}h` : '—' },
                      ].map((field) => (
                        <div key={field.label} className="bg-muted/30 rounded-xl p-3">
                          <p className="text-[11px] text-muted-foreground font-medium">{field.label}</p>
                          <p className="text-sm font-semibold mt-0.5">{field.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* HLA Matching */}
                    {detail.hlaMatch && typeof detail.hlaMatch === 'object' && Object.keys(detail.hlaMatch).length > 0 && (
                      <div className="bg-muted/20 rounded-xl p-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">{tr('مطابقة HLA', 'HLA Matching')}</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(detail.hlaMatch as Record<string, string>).map(([locus, match]) => (
                            <span key={locus} className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold border ${
                              match === 'MATCH' ? 'bg-green-100 text-green-700 border-green-200' :
                              match === 'MISMATCH' ? 'bg-red-100 text-red-700 border-red-200' :
                              'bg-muted text-muted-foreground border-border'
                            }`}>
                              {locus}: {match}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Crossmatch */}
                    {detail.crossmatchResult && (
                      <div className="flex items-center gap-3 bg-muted/20 rounded-xl p-3">
                        <FlaskConical className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[11px] text-muted-foreground">{tr('نتيجة التطابق المتقاطع', 'Crossmatch Result')}</p>
                          <p className={`text-sm font-semibold ${
                            detail.crossmatchResult.toLowerCase().includes('negative') ? 'text-green-600' :
                            detail.crossmatchResult.toLowerCase().includes('positive') ? 'text-red-600' : ''
                          }`}>
                            {detail.crossmatchResult}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Post-Tx summary */}
                    {followUps.length > 0 && (
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                          <Activity className="h-3.5 w-3.5" />
                          {tr('آخر متابعة', 'Latest Follow-Up')} — {fmtDate(followUps[0].visitDate, language)}
                        </p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full font-semibold ${graftColor(followUps[0].graftFunction)}`}>
                            {tr('وظيفة الكسبة:', 'Graft:')} {graftLabel(followUps[0].graftFunction)}
                          </span>
                          {followUps[0].labs?.creatinine && (
                            <span className="text-muted-foreground">
                              {tr('كرياتينين', 'Creatinine')}: <strong>{followUps[0].labs.creatinine} mg/dL</strong>
                            </span>
                          )}
                          {followUps[0].labs?.tacrolimus && (
                            <span className="text-muted-foreground">
                              {tr('تاكروليموس', 'Tacrolimus')}: <strong>{followUps[0].labs.tacrolimus} ng/mL</strong>
                            </span>
                          )}
                        </div>
                        {followUps[0].complications && (
                          <p className="text-xs text-orange-600 mt-1.5 font-medium">
                            <AlertTriangle className="h-3 w-3 inline" /> {followUps[0].complications}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {detail.notes && (
                      <div className="bg-muted/20 rounded-xl p-3">
                        <p className="text-[11px] text-muted-foreground font-medium mb-1">{tr('ملاحظات', 'Notes')}</p>
                        <p className="text-sm whitespace-pre-line">{detail.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Follow-Ups Tab ── */}
                {detailTab === 'followups' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-base">{tr('سجل المتابعة', 'Follow-Up Records')}</h3>
                      <Button size="sm" onClick={() => setShowFU(true)} className="gap-1 h-8 text-xs">
                        <Plus className="h-3.5 w-3.5" />
                        {tr('إضافة متابعة', 'Add Follow-Up')}
                      </Button>
                    </div>

                    {followUps.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground text-sm">
                        <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {tr('لا توجد متابعات مسجلة', 'No follow-up visits recorded')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {followUps.map((fu: any, i: number) => {
                          const labs = fu.labs || {};
                          return (
                            <div key={fu.id || i} className="border border-border rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm">{fmtDate(fu.visitDate, language)}</p>
                                  {fu.daysPostTransplant && (
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                      +{fu.daysPostTransplant} {tr('يوم', 'days')}
                                    </span>
                                  )}
                                </div>
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${graftColor(fu.graftFunction)}`}>
                                  {tr('الكسبة', 'Graft')}: {graftLabel(fu.graftFunction)}
                                </span>
                              </div>

                              {/* Labs */}
                              {Object.keys(labs).length > 0 && (
                                <div className="flex flex-wrap gap-3 bg-muted/20 rounded-lg p-2 text-xs">
                                  {labs.creatinine  != null && <span>{tr('كرياتينين', 'Creatinine')}: <strong>{labs.creatinine} mg/dL</strong></span>}
                                  {labs.tacrolimus  != null && <span>{tr('تاكروليموس', 'FK506')}: <strong>{labs.tacrolimus} ng/mL</strong></span>}
                                  {labs.wbc         != null && <span>WBC: <strong>{labs.wbc} ×10³</strong></span>}
                                  {labs.hemoglobin  != null && <span>{tr('هيموجلوبين', 'Hgb')}: <strong>{labs.hemoglobin} g/dL</strong></span>}
                                  {labs.platelets   != null && <span>{tr('صفائح', 'PLT')}: <strong>{labs.platelets} ×10³</strong></span>}
                                </div>
                              )}

                              {fu.complications && (
                                <p className="text-xs text-orange-600 font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {fu.complications}</p>
                              )}
                              {fu.biopsyDone && (
                                <p className="text-xs">
                                  <span className="font-semibold">{tr('خزعة:', 'Biopsy:')} </span>
                                  {fu.biopsyResult || tr('تمت، بانتظار النتيجة', 'Done, awaiting result')}
                                </p>
                              )}
                              {fu.plan && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">{tr('الخطة:', 'Plan:')} </span>
                                  {fu.plan}
                                </p>
                              )}
                              {fu.nextVisit && (
                                <p className="text-xs text-blue-600">
                                  {tr('الزيارة التالية:', 'Next visit:')} {fmtDate(fu.nextVisit, language)}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Rejections Tab ── */}
                {detailTab === 'rejections' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-base">{tr('حالات رفض الزرع', 'Rejection Episodes')}</h3>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowRej(true)}
                        className="gap-1 h-8 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {tr('تسجيل رفض', 'Record Rejection')}
                      </Button>
                    </div>

                    {rejections.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground text-sm">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {tr('لا توجد حالات رفض مسجلة', 'No rejection episodes recorded')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rejections.map((rej: any, i: number) => {
                          const rejType = REJECTION_TYPES.find((r) => r.value === rej.type);
                          return (
                            <div key={rej.id || i} className={`border rounded-xl p-4 space-y-2 ${rej.graftLoss ? 'border-red-400 bg-red-50' : 'border-border'}`}>
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                  <p className="font-semibold text-sm">
                                    {rejType ? tr(rejType.ar, rejType.en) : rej.type}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{fmtDate(rej.onsetDate, language)}</p>
                                </div>
                                <div className="flex gap-2 items-center">
                                  {rej.banffGrade && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-mono font-bold">
                                      Banff {rej.banffGrade}
                                    </span>
                                  )}
                                  {rej.graftLoss && (
                                    <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                                      {tr('فشل الكسبة', 'GRAFT LOSS')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs"><span className="font-semibold">{tr('العلاج:', 'Treatment:')} </span>{rej.treatment}</p>
                              {rej.response && (
                                <p className="text-xs"><span className="font-semibold">{tr('الاستجابة:', 'Response:')} </span>{rej.response}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Surgery Details Tab ── */}
                {detailTab === 'surgery' && (
                  <SurgeryDetailsPanel
                    detail={detail}
                    selectedId={selectedId!}
                    mutateDetail={mutateDetail}
                    mutateCases={mutateCases}
                    tr={tr}
                    locale={locale}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-muted-foreground text-sm animate-pulse">
              {tr('جاري التحميل...', 'Loading...')}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Create Case Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-600" />
              {tr('تسجيل حالة زراعة جديدة', 'New Transplant Case')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{tr('رقم المريض', 'Patient Master ID')} <span className="text-red-500">*</span></Label>
              <Input
                value={createForm.patientMasterId}
                onChange={(e) => setCreateForm((f) => ({ ...f, patientMasterId: e.target.value }))}
                placeholder="PM-..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr('نوع العضو', 'Organ Type')} <span className="text-red-500">*</span></Label>
                <Select value={createForm.organType} onValueChange={(v) => setCreateForm((f) => ({ ...f, organType: v }))}>
                  <SelectTrigger><SelectValue placeholder={tr('اختر...', 'Select...')} /></SelectTrigger>
                  <SelectContent>
                    {ORGAN_TYPES.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{tr(o.ar, o.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{tr('نوع الزراعة', 'Transplant Type')}</Label>
                <Select value={createForm.transplantType} onValueChange={(v) => setCreateForm((f) => ({ ...f, transplantType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSPLANT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{tr(t.ar, t.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr('تاريخ التقييم', 'Evaluation Date')}</Label>
                <Input type="date" value={createForm.evaluationDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, evaluationDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>PRA % ({tr('تفاعل مضادات الأجسام', 'Panel Reactive Antibody')})</Label>
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={createForm.pra}
                  onChange={(e) => setCreateForm((f) => ({ ...f, pra: e.target.value }))}
                  placeholder="0–100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr('ملاحظات سريرية', 'Clinical Notes')}</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder={tr('السيرة المرضية، تاريخ المرض، ملاحظات...', 'Clinical history, disease course, notes...')}
              />
            </div>
            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{createError}</div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={createBusy}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button
                onClick={handleCreateCase}
                disabled={createBusy || !createForm.patientMasterId.trim() || !createForm.organType}
              >
                {createBusy ? tr('جاري الحفظ...', 'Saving...') : tr('إنشاء الحالة', 'Create Case')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Follow-Up Dialog ────────────────────────────────────────────── */}
      <Dialog open={showFU} onOpenChange={setShowFU}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('إضافة زيارة متابعة', 'Add Follow-Up Visit')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr('تاريخ الزيارة', 'Visit Date')} <span className="text-red-500">*</span></Label>
                <Input type="date" value={fuForm.visitDate}
                  onChange={(e) => setFuForm((f) => ({ ...f, visitDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('أيام بعد الزرع', 'Days Post-Transplant')}</Label>
                <Input type="number" min={0} value={fuForm.daysPostTransplant}
                  onChange={(e) => setFuForm((f) => ({ ...f, daysPostTransplant: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr('وظيفة الكسبة', 'Graft Function')} <span className="text-red-500">*</span></Label>
              <Select value={fuForm.graftFunction} onValueChange={(v) => setFuForm((f) => ({ ...f, graftFunction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRAFT_FUNCTION.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{tr(g.ar, g.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lab Values */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <FlaskConical className="h-3.5 w-3.5" />
                {tr('نتائج المختبر', 'Lab Results')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'creatinine', label: tr('كرياتينين (mg/dL)', 'Creatinine (mg/dL)') },
                  { key: 'tacrolimus', label: tr('تاكروليموس (ng/mL)', 'Tacrolimus (ng/mL)') },
                  { key: 'wbc',        label: tr('WBC (×10³/µL)', 'WBC (×10³/µL)') },
                  { key: 'hemoglobin', label: tr('هيموجلوبين (g/dL)', 'Hemoglobin (g/dL)') },
                  { key: 'platelets',  label: tr('الصفائح (×10³/µL)', 'Platelets (×10³/µL)') },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number" step="0.1"
                      value={String((fuForm as Record<string, unknown>)[key] ?? '')}
                      onChange={(e) => setFuForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{tr('المضاعفات', 'Complications')}</Label>
              <Input value={fuForm.complications}
                onChange={(e) => setFuForm((f) => ({ ...f, complications: e.target.value }))}
                placeholder={tr('إن وجدت...', 'If any...')} />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox checked={fuForm.biopsyDone}
                onCheckedChange={(c) => setFuForm((f) => ({ ...f, biopsyDone: Boolean(c) }))} />
              <Label className="cursor-pointer">{tr('تمت الخزعة', 'Biopsy Performed')}</Label>
            </div>
            {fuForm.biopsyDone && (
              <div className="space-y-1.5">
                <Label>{tr('نتيجة الخزعة', 'Biopsy Result')}</Label>
                <Textarea value={fuForm.biopsyResult}
                  onChange={(e) => setFuForm((f) => ({ ...f, biopsyResult: e.target.value }))}
                  rows={2} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{tr('خطة العلاج', 'Management Plan')}</Label>
              <Textarea value={fuForm.plan}
                onChange={(e) => setFuForm((f) => ({ ...f, plan: e.target.value }))}
                rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr('الزيارة التالية', 'Next Visit')}</Label>
              <Input type="date" value={fuForm.nextVisit}
                onChange={(e) => setFuForm((f) => ({ ...f, nextVisit: e.target.value }))} />
            </div>

            {fuError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{fuError}</div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowFU(false)} disabled={fuBusy}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button onClick={handleAddFollowUp} disabled={fuBusy}>
                {fuBusy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Add Rejection Dialog ────────────────────────────────────────────── */}
      <Dialog open={showRej} onOpenChange={setShowRej}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-red-600">
              {tr('تسجيل حالة رفض', 'Record Rejection Episode')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{tr('تاريخ الظهور', 'Onset Date')} <span className="text-red-500">*</span></Label>
                <Input type="date" value={rejForm.onsetDate}
                  onChange={(e) => setRejForm((f) => ({ ...f, onsetDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{tr('نوع الرفض', 'Rejection Type')} <span className="text-red-500">*</span></Label>
                <Select value={rejForm.type} onValueChange={(v) => setRejForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue placeholder={tr('اختر...', 'Select...')} /></SelectTrigger>
                  <SelectContent>
                    {REJECTION_TYPES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{tr(r.ar, r.en)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{tr('درجة Banff', 'Banff Grade')}</Label>
              <Select value={rejForm.banffGrade} onValueChange={(v) => setRejForm((f) => ({ ...f, banffGrade: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختياري', 'Optional')} /></SelectTrigger>
                <SelectContent>
                  {BANFF_GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tr('العلاج', 'Treatment')} <span className="text-red-500">*</span></Label>
              <Textarea value={rejForm.treatment}
                onChange={(e) => setRejForm((f) => ({ ...f, treatment: e.target.value }))}
                rows={2}
                placeholder={tr('مثال: ميثيل بريدنيزولون 500mg IV × 3 أيام', 'e.g. IV Methylprednisolone 500mg × 3 days')} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr('الاستجابة للعلاج', 'Treatment Response')}</Label>
              <Select value={rejForm.response} onValueChange={(v) => setRejForm((f) => ({ ...f, response: v }))}>
                <SelectTrigger><SelectValue placeholder={tr('اختياري', 'Optional')} /></SelectTrigger>
                <SelectContent>
                  {[
                    { value: 'COMPLETE',    ar: 'استجابة كاملة',  en: 'Complete Response' },
                    { value: 'PARTIAL',     ar: 'استجابة جزئية',  en: 'Partial Response' },
                    { value: 'NO_RESPONSE', ar: 'لا استجابة',     en: 'No Response' },
                  ].map((r) => (
                    <SelectItem key={r.value} value={r.value}>{tr(r.ar, r.en)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border border-red-200 bg-red-50 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={rejForm.graftLoss}
                  onCheckedChange={(c) => setRejForm((f) => ({ ...f, graftLoss: Boolean(c) }))}
                  className="mt-0.5" />
                <div>
                  <p className="font-semibold text-red-700 text-sm">{tr('فشل الكسبة', 'Graft Loss / Failure')}</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    {tr('تحديد هذا سيغير حالة الحالة إلى "فشل الزرع"', 'Selecting this will update the case status to Graft Loss')}
                  </p>
                </div>
              </label>
            </div>

            {rejError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{rejError}</div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => setShowRej(false)} disabled={rejBusy}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleAddRejection}
                disabled={rejBusy || !rejForm.type || !rejForm.treatment}
              >
                {rejBusy ? tr('جاري الحفظ...', 'Saving...') : tr('تسجيل', 'Record')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Surgery Details Panel ────────────────────────────────────────────────────

interface SurgeryDetailsPanelProps {
  detail: any;
  selectedId: string;
  mutateDetail: () => Promise<any>;
  mutateCases: () => Promise<any>;
  tr: (ar: string, en: string) => string;
  locale: string;
}

function SurgeryDetailsPanel({ detail, selectedId, mutateDetail, mutateCases, tr, locale }: SurgeryDetailsPanelProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState({
    transplantDate:    detail.transplantDate    ? detail.transplantDate.slice(0, 10)    : '',
    listingDate:       detail.listingDate       ? detail.listingDate.slice(0, 10)       : '',
    crossmatchResult:  detail.crossmatchResult  || '',
    coldIschemiaTime:  detail.coldIschemiaTime  != null ? String(detail.coldIschemiaTime) : '',
    donorId:           detail.donorId           || '',
  });

  const handleSave = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/transplant/cases/${selectedId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transplantDate:   form.transplantDate   || undefined,
          listingDate:      form.listingDate      || undefined,
          crossmatchResult: form.crossmatchResult || undefined,
          coldIschemiaTime: form.coldIschemiaTime ? Number(form.coldIschemiaTime) : undefined,
          donorId:          form.donorId          || undefined,
        }),
      });
      if (res.ok) {
        setEditing(false);
        await Promise.all([mutateDetail(), mutateCases()]);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || tr('حدث خطأ', 'An error occurred'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-base">{tr('التفاصيل الجراحية', 'Surgical Details')}</h3>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="h-8 text-xs">
            {tr('تعديل', 'Edit')}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setEditing(false); setError(''); }} disabled={busy} className="h-8 text-xs">
              {tr('إلغاء', 'Cancel')}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={busy} className="h-8 text-xs">
              {busy ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </Button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: tr('تاريخ الإدراج في القائمة', 'Listing Date'),          value: detail.listingDate ? new Date(detail.listingDate).toLocaleDateString(locale) : '—' },
            { label: tr('تاريخ الزرع', 'Transplant Date'),                     value: detail.transplantDate ? new Date(detail.transplantDate).toLocaleDateString(locale) : '—' },
            { label: tr('نتيجة التطابق المتقاطع', 'Crossmatch Result'),        value: detail.crossmatchResult || '—' },
            { label: tr('زمن نقص التروية البارد (ساعات)', 'Cold Ischemia (h)'), value: detail.coldIschemiaTime != null ? `${detail.coldIschemiaTime}h` : '—' },
            { label: tr('معرف المتبرع', 'Donor ID'),                            value: detail.donorId || '—' },
          ].map((field) => (
            <div key={field.label} className="bg-muted/30 rounded-xl p-3">
              <p className="text-[11px] text-muted-foreground font-medium">{field.label}</p>
              <p className="text-sm font-semibold mt-0.5">{field.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{tr('تاريخ الإدراج', 'Listing Date')}</Label>
              <Input type="date" value={form.listingDate}
                onChange={(e) => setForm((f) => ({ ...f, listingDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr('تاريخ الزرع', 'Transplant Date')}</Label>
              <Input type="date" value={form.transplantDate}
                onChange={(e) => setForm((f) => ({ ...f, transplantDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{tr('نتيجة التطابق المتقاطع', 'Crossmatch Result')}</Label>
            <Select value={form.crossmatchResult || '_none'}
              onValueChange={(v) => setForm((f) => ({ ...f, crossmatchResult: v === '_none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder={tr('اختر...', 'Select...')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{tr('—', '—')}</SelectItem>
                <SelectItem value="Negative">{tr('سلبي (مناسب للزرع)', 'Negative (favorable)')}</SelectItem>
                <SelectItem value="Positive">{tr('إيجابي (خطر مرتفع)', 'Positive (high risk)')}</SelectItem>
                <SelectItem value="Positive — DSA Low">{tr('إيجابي — DSA منخفض', 'Positive — DSA Low')}</SelectItem>
                <SelectItem value="Positive — DSA High">{tr('إيجابي — DSA مرتفع', 'Positive — DSA High')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{tr('زمن نقص التروية البارد (ساعات)', 'Cold Ischemia Time (hours)')}</Label>
              <Input type="number" min={0} max={72} value={form.coldIschemiaTime}
                onChange={(e) => setForm((f) => ({ ...f, coldIschemiaTime: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{tr('معرف المتبرع', 'Donor ID')}</Label>
              <Input value={form.donorId}
                onChange={(e) => setForm((f) => ({ ...f, donorId: e.target.value }))}
                placeholder={tr('اختياري', 'Optional')} />
            </div>
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>
      )}

      {/* HLA Match display — read only */}
      {detail.hlaMatch && typeof detail.hlaMatch === 'object' && Object.keys(detail.hlaMatch).length > 0 && (
        <div className="bg-muted/20 rounded-xl p-4 mt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">{tr('مطابقة HLA', 'HLA Compatibility')}</p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start pb-1 font-semibold">{tr('الموضع', 'Locus')}</th>
                  <th className="text-start pb-1 font-semibold">{tr('النتيجة', 'Result')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(detail.hlaMatch as Record<string, string>).map(([locus, match]) => (
                  <tr key={locus} className="border-b border-border/50 last:border-0">
                    <td className="py-1 pr-6 font-mono font-bold">{locus}</td>
                    <td className="py-1">
                      <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                        match === 'MATCH'    ? 'bg-green-100 text-green-700' :
                        match === 'MISMATCH' ? 'bg-red-100 text-red-700'    :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {match}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransplantDashboard;
