'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useLang } from '@/hooks/use-lang';
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  ChevronRight,
  Loader2,
  User,
  Stethoscope,
  Search,
  X,
  Filter,
} from 'lucide-react';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

const STATUS_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; color: string; bg: string }
> = {
  PENDING: { labelAr: 'في الانتظار', labelEn: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  ACKNOWLEDGED: { labelAr: 'تم الاستلام', labelEn: 'Acknowledged', color: 'text-blue-700', bg: 'bg-blue-100' },
  IN_PROGRESS: { labelAr: 'قيد المراجعة', labelEn: 'In Progress', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  COMPLETED: { labelAr: 'مكتمل', labelEn: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  CANCELLED: { labelAr: 'ملغي', labelEn: 'Cancelled', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const URGENCY_CONFIG: Record<
  string,
  { labelAr: string; labelEn: string; color: string; bg: string }
> = {
  STAT: { labelAr: 'فوري', labelEn: 'STAT', color: 'text-red-700', bg: 'bg-red-100' },
  URGENT: { labelAr: 'عاجل', labelEn: 'Urgent', color: 'text-orange-700', bg: 'bg-orange-100' },
  ROUTINE: { labelAr: 'روتيني', labelEn: 'Routine', color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

const SPECIALTIES_EN = [
  'Cardiology', 'Pulmonology', 'Gastroenterology', 'Nephrology', 'Neurology',
  'Endocrinology', 'Hematology', 'Rheumatology', 'Infectious Disease', 'Oncology',
  'Psychiatry', 'Dermatology', 'Ophthalmology', 'ENT', 'Orthopedics',
  'Urology', 'OB/GYN', 'Pediatrics', 'General Surgery', 'Vascular Surgery',
  'Plastic Surgery', 'Anesthesia', 'Radiology', 'Pathology', 'Physiotherapy',
  'Nutrition/Dietetics', 'Social Work', 'Other',
];

type TabKey = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

interface ConsultRequest {
  id: string;
  patientMasterId: string;
  specialty: string;
  urgency: string;
  clinicalQuestion: string;
  requestedBy?: string;
  status: string;
  createdAt: string;
}

const BLANK_FORM = {
  patientMasterId: '',
  specialty: '',
  urgency: 'ROUTINE',
  clinicalQuestion: '',
  clinicalSummary: '',
};

export default function ConsultsListing() {
  const router = useRouter();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [activeTab, setActiveTab] = useState<TabKey>('ALL');
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const params = new URLSearchParams();
  if (activeTab !== 'ALL') params.set('status', activeTab);
  const apiUrl = `/api/consults?${params.toString()}`;

  const { data, isLoading, mutate } = useSWR(apiUrl, fetcher, { refreshInterval: 30000 });
  const { data: allData } = useSWR('/api/consults', fetcher, { refreshInterval: 60000 });

  const rawConsults: ConsultRequest[] = data?.items ?? [];
  const allConsults: ConsultRequest[] = allData?.items ?? [];

  // Client-side search + specialty + urgency filter
  const consults = useMemo(() => {
    let list = rawConsults;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.patientMasterId.toLowerCase().includes(q) ||
          c.clinicalQuestion.toLowerCase().includes(q) ||
          c.specialty.toLowerCase().includes(q),
      );
    }
    if (specialtyFilter) list = list.filter((c) => c.specialty === specialtyFilter);
    if (urgencyFilter) list = list.filter((c) => c.urgency === urgencyFilter);
    return list;
  }, [rawConsults, search, specialtyFilter, urgencyFilter]);

  const kpiTotal = allConsults.length;
  const kpiPending = allConsults.filter((c) => c.status === 'PENDING').length;
  const kpiInProgress = allConsults.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'ACKNOWLEDGED').length;
  const kpiCompleted = allConsults.filter((c) => c.status === 'COMPLETED').length;

  const tabs: { key: TabKey; labelAr: string; labelEn: string }[] = [
    { key: 'PENDING', labelAr: 'في الانتظار', labelEn: 'Pending' },
    { key: 'IN_PROGRESS', labelAr: 'قيد المراجعة', labelEn: 'In Progress' },
    { key: 'COMPLETED', labelAr: 'مكتملة', labelEn: 'Completed' },
    { key: 'ALL', labelAr: 'الكل', labelEn: 'All' },
  ];

  // ─── Create consult ───────────────────────────────────────────────────────
  async function handleCreate() {
    setSaveError('');
    if (!form.patientMasterId.trim() || !form.specialty || !form.clinicalQuestion.trim()) {
      setSaveError(tr('يرجى ملء جميع الحقول المطلوبة', 'Please fill all required fields'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/consults', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientMasterId: form.patientMasterId.trim(),
          specialty: form.specialty,
          urgency: form.urgency,
          clinicalQuestion: form.clinicalQuestion.trim(),
          clinicalSummary: form.clinicalSummary.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setSaveError(json.error || tr('فشل الحفظ', 'Failed to save'));
        return;
      }
      const { consult } = await res.json();
      setShowCreate(false);
      setForm(BLANK_FORM);
      mutate();
      router.push(`/consults/${consult.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/50 p-4 sm:p-6" dir={dir}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {tr('طلبات الاستشارة', 'Consultation Requests')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tr('إدارة استشارات الأطباء بين التخصصات', 'Inter-specialty physician consultation management')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted/50"
          >
            <RefreshCw className="h-4 w-4" />
            {tr('تحديث', 'Refresh')}
          </button>
          <button
            onClick={() => { setShowCreate(true); setSaveError(''); setForm(BLANK_FORM); }}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            {tr('طلب استشارة', 'New Consult')}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={<MessageSquare className="h-5 w-5 text-violet-600" />} bg="bg-violet-50" value={kpiTotal} label={tr('إجمالي الطلبات', 'Total Requests')} />
        <KpiCard icon={<Clock className="h-5 w-5 text-amber-600" />} bg="bg-amber-50" value={kpiPending} label={tr('في الانتظار', 'Pending')} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-indigo-600" />} bg="bg-indigo-50" value={kpiInProgress} label={tr('قيد المراجعة', 'In Progress')} />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} bg="bg-green-50" value={kpiCompleted} label={tr('مكتملة', 'Completed')} />
      </div>

      {/* ── Search + Filter bar ─────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tr('بحث بالمريض، السؤال السريري، التخصص…', 'Search by patient, clinical question, specialty…')}
            className="w-full rounded-lg border border-border bg-card py-2 ps-9 pe-9 text-sm text-foreground placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-muted-foreground hover:text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-violet-400 focus:outline-none"
          >
            <option value="">{tr('كل التخصصات', 'All Specialties')}</option>
            {SPECIALTIES_EN.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-violet-400 focus:outline-none"
          >
            <option value="">{tr('كل الأولويات', 'All Urgencies')}</option>
            <option value="STAT">{tr('فوري', 'STAT')}</option>
            <option value="URGENT">{tr('عاجل', 'Urgent')}</option>
            <option value="ROUTINE">{tr('روتيني', 'Routine')}</option>
          </select>
        </div>
      </div>

      {/* ── Status Tabs ────────────────────────────────────────────── */}
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-violet-600 text-white shadow'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            {tr(tab.labelAr, tab.labelEn)}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : consults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageSquare className="mb-3 h-12 w-12 opacity-30" />
            <p className="text-base font-medium">
              {search || specialtyFilter || urgencyFilter
                ? tr('لا توجد نتائج مطابقة', 'No matching consultations')
                : tr('لا توجد استشارات', 'No consultations found')}
            </p>
            {!search && !specialtyFilter && !urgencyFilter && (
              <p className="mt-1 text-sm">{tr('ابدأ بإنشاء طلب استشارة جديد', 'Start by creating a new consult request')}</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-muted/50">
                  {[
                    tr('رقم المريض', 'Patient ID'),
                    tr('التخصص', 'Specialty'),
                    tr('الأولوية', 'Urgency'),
                    tr('السؤال السريري', 'Clinical Question'),
                    tr('الحالة', 'Status'),
                    tr('التاريخ', 'Date'),
                    '',
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {consults.map((c) => {
                  const status = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.PENDING;
                  const urgency = URGENCY_CONFIG[c.urgency] ?? URGENCY_CONFIG.ROUTINE;
                  const isStat = c.urgency === 'STAT';

                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/consults/${c.id}`)}
                      className={`cursor-pointer transition-colors hover:bg-violet-50/40 ${isStat ? 'border-s-2 border-s-red-400' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-sm text-foreground">
                            {c.patientMasterId.slice(0, 8)}…
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.specialty}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${urgency.bg} ${urgency.color} ${isStat ? 'ring-1 ring-red-400' : ''}`}>
                          {language === 'ar' ? urgency.labelAr : urgency.labelEn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <span className="line-clamp-1 max-w-[220px]">{c.clinicalQuestion}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${status.bg} ${status.color}`}>
                          {language === 'ar' ? status.labelAr : status.labelEn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <button className="flex items-center gap-1 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100">
                          {tr('عرض', 'View')}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Consult Dialog ───────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir={dir}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <h2 className="font-bold text-foreground">{tr('طلب استشارة جديد', 'New Consultation Request')}</h2>
              </div>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 p-5">
              {/* Patient ID */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  {tr('رقم المريض *', 'Patient ID *')}
                </label>
                <input
                  type="text"
                  value={form.patientMasterId}
                  onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
                  placeholder={tr('أدخل رقم المريض…', 'Enter patient master ID…')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Specialty */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  {tr('التخصص المستشار *', 'Consulting Specialty *')}
                </label>
                <select
                  value={form.specialty}
                  onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  <option value="">{tr('اختر التخصص…', 'Select specialty…')}</option>
                  {SPECIALTIES_EN.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Urgency */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  {tr('الأولوية *', 'Urgency *')}
                </label>
                <div className="flex gap-2">
                  {(['STAT', 'URGENT', 'ROUTINE'] as const).map((u) => {
                    const cfg = URGENCY_CONFIG[u];
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, urgency: u }))}
                        className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                          form.urgency === u
                            ? `${cfg.bg} ${cfg.color} border-current ring-1 ring-current`
                            : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {language === 'ar' ? cfg.labelAr : cfg.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Clinical Question */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  {tr('السؤال السريري *', 'Clinical Question *')}
                </label>
                <textarea
                  rows={3}
                  value={form.clinicalQuestion}
                  onChange={(e) => setForm((f) => ({ ...f, clinicalQuestion: e.target.value }))}
                  placeholder={tr('ما هو السؤال الطبي الذي تحتاج إجابة عليه؟', 'What specific clinical question needs to be answered?')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder-gray-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {/* Clinical Summary */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  {tr('الملخص السريري', 'Clinical Summary')}
                </label>
                <textarea
                  rows={2}
                  value={form.clinicalSummary}
                  onChange={(e) => setForm((f) => ({ ...f, clinicalSummary: e.target.value }))}
                  placeholder={tr('ملخص الحالة، الشكاوى، الإجراءات السابقة…', 'Brief case summary, complaints, prior workup…')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder-gray-300 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                />
              </div>

              {saveError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                  {saveError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50"
              >
                {tr('إلغاء', 'Cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {tr('إنشاء الطلب', 'Create Request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, bg, value, label }: { icon: React.ReactNode; bg: string; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
