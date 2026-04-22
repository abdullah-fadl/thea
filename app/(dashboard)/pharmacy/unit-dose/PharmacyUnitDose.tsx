'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Pill } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type DoseStatus = 'PREPARED' | 'VERIFIED' | 'DISPENSED' | 'ADMINISTERED' | 'RETURNED' | 'WASTED';

interface UnitDoseItem {
  id: string;
  patientId?: string;
  patientName?: string;
  mrn?: string;
  wardUnit?: string;
  bedLabel?: string;
  medication: string;
  genericName?: string;
  strength?: string;
  form?: string;
  route?: string;
  dose?: string;
  frequency?: string;
  scheduledTime?: string;
  preparedByName?: string;
  preparedAt?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  dispensedByName?: string;
  dispensedAt?: string;
  administeredByName?: string;
  administeredAt?: string;
  administrationNotes?: string;
  returnReason?: string;
  wasteReason?: string;
  wasteWitnessName?: string;
  status: DoseStatus;
  notes?: string;
}

interface Summary {
  total: number;
  prepared: number;
  verified: number;
  dispensed: number;
  administered: number;
  returned: number;
  wasted: number;
  overdue: number;
}

type TabValue = 'ALL' | DoseStatus;

const STATUS_TABS: { value: TabValue; ar: string; en: string }[] = [
  { value: 'ALL', ar: 'الكل', en: 'All' },
  { value: 'PREPARED', ar: 'جاهزة', en: 'Prepared' },
  { value: 'VERIFIED', ar: 'محققة', en: 'Verified' },
  { value: 'DISPENSED', ar: 'مصروفة', en: 'Dispensed' },
  { value: 'ADMINISTERED', ar: 'مُعطاة', en: 'Administered' },
  { value: 'RETURNED', ar: 'مُرتجعة', en: 'Returned' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function statusColor(status: string) {
  switch (status) {
    case 'PREPARED':
      return 'bg-amber-100 text-amber-700';
    case 'VERIFIED':
      return 'bg-blue-100 text-blue-700';
    case 'DISPENSED':
      return 'bg-indigo-100 text-indigo-700';
    case 'ADMINISTERED':
      return 'bg-emerald-100 text-emerald-700';
    case 'RETURNED':
      return 'bg-orange-100 text-orange-700';
    case 'WASTED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-muted text-foreground';
  }
}

function statusLabel(status: string, tr: (ar: string, en: string) => string) {
  switch (status) {
    case 'PREPARED':
      return tr('جاهزة', 'Prepared');
    case 'VERIFIED':
      return tr('محققة', 'Verified');
    case 'DISPENSED':
      return tr('مصروفة', 'Dispensed');
    case 'ADMINISTERED':
      return tr('مُعطاة', 'Administered');
    case 'RETURNED':
      return tr('مُرتجعة', 'Returned');
    case 'WASTED':
      return tr('مهدرة', 'Wasted');
    default:
      return status;
  }
}

function fmtTime(iso: string | undefined, language: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Create Dialog
// ---------------------------------------------------------------------------
function CreateDoseDialog({
  language,
  loading,
  onClose,
  onSubmit,
}: {
  language: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [form, setForm] = useState({
    patientName: '',
    mrn: '',
    medication: '',
    genericName: '',
    strength: '',
    dose: '',
    form: 'TABLET',
    route: 'ORAL',
    frequency: '',
    wardUnit: '',
    bedLabel: '',
    scheduledTime: '',
    notes: '',
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const FORMS = [
    { value: 'TABLET', ar: 'قرص', en: 'Tablet' },
    { value: 'CAPSULE', ar: 'كبسولة', en: 'Capsule' },
    { value: 'INJECTION', ar: 'حقنة', en: 'Injection' },
    { value: 'SYRUP', ar: 'شراب', en: 'Syrup' },
    { value: 'INHALER', ar: 'بخاخ', en: 'Inhaler' },
    { value: 'PATCH', ar: 'لصقة', en: 'Patch' },
  ];

  const ROUTES = [
    { value: 'ORAL', ar: 'فموي', en: 'Oral' },
    { value: 'IV', ar: 'وريدي', en: 'IV' },
    { value: 'IM', ar: 'عضلي', en: 'IM' },
    { value: 'SC', ar: 'تحت الجلد', en: 'SC' },
    { value: 'TOPICAL', ar: 'موضعي', en: 'Topical' },
    { value: 'INHALATION', ar: 'استنشاق', en: 'Inhalation' },
    { value: 'RECTAL', ar: 'شرجي', en: 'Rectal' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {tr('جرعة وحدة جديدة', 'New Unit Dose')}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr('تحضير جرعة وحدة للمريض', 'Prepare a unit dose for a patient')}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Patient info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('اسم المريض', 'Patient Name')} *
              </label>
              <input
                value={form.patientName}
                onChange={(e) => set('patientName', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tr('اسم المريض', 'Patient name')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('رقم الملف', 'MRN')}
              </label>
              <input
                value={form.mrn}
                onChange={(e) => set('mrn', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tr('رقم الملف', 'MRN')}
              />
            </div>
          </div>

          {/* Medication */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('اسم الدواء', 'Medication')} *
              </label>
              <input
                value={form.medication}
                onChange={(e) => set('medication', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tr('اسم الدواء', 'Drug name')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الاسم العلمي', 'Generic Name')}
              </label>
              <input
                value={form.genericName}
                onChange={(e) => set('genericName', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tr('الاسم العلمي', 'Generic name')}
              />
            </div>
          </div>

          {/* Dose / Strength */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الجرعة', 'Dose')}
              </label>
              <input
                value={form.dose}
                onChange={(e) => set('dose', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="500mg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('التركيز', 'Strength')}
              </label>
              <input
                value={form.strength}
                onChange={(e) => set('strength', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="500mg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('التكرار', 'Frequency')}
              </label>
              <input
                value={form.frequency}
                onChange={(e) => set('frequency', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tr('كل 8 ساعات', 'Every 8h')}
              />
            </div>
          </div>

          {/* Form / Route */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الشكل الصيدلاني', 'Form')}
              </label>
              <select
                value={form.form}
                onChange={(e) => set('form', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FORMS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {tr(f.ar, f.en)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('طريقة الإعطاء', 'Route')}
              </label>
              <select
                value={form.route}
                onChange={(e) => set('route', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROUTES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {tr(r.ar, r.en)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ward / Bed / Schedule */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('القسم/الجناح', 'Ward/Unit')}
              </label>
              <input
                value={form.wardUnit}
                onChange={(e) => set('wardUnit', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tr('الجناح', 'Ward')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('السرير', 'Bed')}
              </label>
              <input
                value={form.bedLabel}
                onChange={(e) => set('bedLabel', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="B-12"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الوقت المجدول', 'Scheduled')}
              </label>
              <input
                type="datetime-local"
                value={form.scheduledTime}
                onChange={(e) => set('scheduledTime', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              {tr('ملاحظات', 'Notes')}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder={tr('ملاحظات اختيارية...', 'Optional notes...')}
            />
          </div>
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={() => {
              if (!form.medication.trim() || !form.patientName.trim()) return;
              onSubmit({
                ...form,
                scheduledTime: form.scheduledTime || undefined,
              });
            }}
            disabled={loading || !form.medication.trim() || !form.patientName.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="animate-spin text-xs">...</span>}
            {tr('تحضير الجرعة', 'Prepare Dose')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Return / Waste Dialog
// ---------------------------------------------------------------------------
function ReasonDialog({
  title,
  description,
  language,
  loading,
  onClose,
  onConfirm,
  confirmLabel,
  variant,
}: {
  title: string;
  description: string;
  language: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  confirmLabel: string;
  variant: 'orange' | 'red';
}) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [reason, setReason] = useState('');

  const btnClass =
    variant === 'red'
      ? 'bg-red-600 text-white hover:bg-red-700'
      : 'bg-orange-600 text-white hover:bg-orange-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md mx-4"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="p-6">
          <label className="block text-sm font-medium text-foreground mb-1">
            {tr('السبب', 'Reason')} *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder={tr('أدخل السبب...', 'Enter reason...')}
          />
        </div>
        <div className="px-6 pb-5 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim() || loading}
            className={`px-4 py-2 text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 ${btnClass}`}
          >
            {loading && <span className="animate-spin text-xs">...</span>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function PharmacyUnitDose() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabValue>('ALL');
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [returnTarget, setReturnTarget] = useState<UnitDoseItem | null>(null);
  const [wasteTarget, setWasteTarget] = useState<UnitDoseItem | null>(null);

  // Build query
  const params = new URLSearchParams();
  if (activeTab !== 'ALL') params.set('status', activeTab);
  if (search.trim()) params.set('search', search.trim());
  if (wardFilter.trim()) params.set('ward', wardFilter.trim());

  const { data, mutate, isLoading } = useSWR(
    `/api/pharmacy/unit-dose?${params.toString()}`,
    fetcher,
    { refreshInterval: 15000 },
  );

  const doses: UnitDoseItem[] = Array.isArray(data?.doses) ? data.doses : [];
  const summary: Summary = data?.summary || {
    total: 0,
    prepared: 0,
    verified: 0,
    dispensed: 0,
    administered: 0,
    returned: 0,
    wasted: 0,
    overdue: 0,
  };

  // Collect unique wards for filter dropdown
  const wards = Array.from(new Set(doses.map((d) => d.wardUnit).filter(Boolean))) as string[];

  // ── Action handler ─────────────────────────────────────────────────────────
  const handleAction = async (id: string, action: string, extra?: Record<string, any>) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/pharmacy/unit-dose', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || tr('فشلت العملية', 'Action failed'));
      }
      const actionLabels: Record<string, string> = {
        verify: tr('تم التحقق', 'Verified'),
        dispense: tr('تم الصرف', 'Dispensed'),
        administer: tr('تم الإعطاء', 'Administered'),
        return: tr('تم الإرجاع', 'Returned'),
        waste: tr('تم التسجيل كهدر', 'Recorded as waste'),
      };
      toast({ title: actionLabels[action] || tr('تمت العملية', 'Done') });
      mutate();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Create handler ─────────────────────────────────────────────────────────
  const handleCreate = async (formData: any) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/pharmacy/unit-dose', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...formData }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || tr('فشل إنشاء الجرعة', 'Failed to create dose'));
      }
      toast({ title: tr('تم تحضير الجرعة', 'Dose prepared') });
      setShowCreate(false);
      mutate();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Action buttons per status ──────────────────────────────────────────────
  function renderActions(item: UnitDoseItem) {
    const btns: React.JSX.Element[] = [];
    switch (item.status) {
      case 'PREPARED':
        btns.push(
          <button
            key="verify"
            onClick={() => handleAction(item.id, 'verify')}
            disabled={actionLoading}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {tr('تحقق', 'Verify')}
          </button>,
        );
        break;
      case 'VERIFIED':
        btns.push(
          <button
            key="dispense"
            onClick={() => handleAction(item.id, 'dispense')}
            disabled={actionLoading}
            className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {tr('صرف', 'Dispense')}
          </button>,
        );
        break;
      case 'DISPENSED':
        btns.push(
          <button
            key="administer"
            onClick={() => handleAction(item.id, 'administer')}
            disabled={actionLoading}
            className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {tr('إعطاء', 'Administer')}
          </button>,
        );
        break;
    }
    // Return & Waste available for PREPARED, VERIFIED, DISPENSED
    if (['PREPARED', 'VERIFIED', 'DISPENSED'].includes(item.status)) {
      btns.push(
        <button
          key="return"
          onClick={() => setReturnTarget(item)}
          disabled={actionLoading}
          className="px-3 py-1 text-xs border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50 transition-colors"
        >
          {tr('إرجاع', 'Return')}
        </button>,
        <button
          key="waste"
          onClick={() => setWasteTarget(item)}
          disabled={actionLoading}
          className="px-3 py-1 text-xs border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {tr('هدر', 'Waste')}
        </button>,
      );
    }
    return <div className="flex items-center gap-1.5 flex-wrap">{btns}</div>;
  }

  // ── KPI card helper ────────────────────────────────────────────────────────
  function KPI({
    label,
    value,
    color,
  }: {
    label: string;
    value: number;
    color: string;
  }) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-2xl font-bold mt-1 ${color}`}>{value}</span>
      </div>
    );
  }

  // ── Check if overdue ───────────────────────────────────────────────────────
  function isOverdue(item: UnitDoseItem) {
    if (!item.scheduledTime) return false;
    if (['ADMINISTERED', 'RETURNED', 'WASTED'].includes(item.status)) return false;
    return new Date(item.scheduledTime) < new Date();
  }

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('نظام الجرعة الوحدة', 'Unit Dose System')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {tr(
                'تحضير وتتبع الجرعات الفردية للمرضى المنومين',
                'Prepare and track individual doses for inpatient administration',
              )}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            {tr('جرعة جديدة', 'New Dose')}
          </button>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPI label={tr('إجمالي الجرعات', 'Total Doses')} value={summary.total} color="text-foreground" />
          <KPI label={tr('بانتظار التحقق', 'Pending Verification')} value={summary.prepared} color="text-amber-600" />
          <KPI label={tr('مصروفة', 'Dispensed')} value={summary.dispensed} color="text-indigo-600" />
          <KPI label={tr('مُعطاة', 'Administered')} value={summary.administered} color="text-emerald-600" />
          <KPI label={tr('متأخرة', 'Overdue')} value={summary.overdue} color="text-red-600" />
        </div>

        {/* ── Filters Row ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Status tabs */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tr(tab.ar, tab.en)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={tr('بحث بالمريض أو الدواء...', 'Search by patient or drug...')}
            />
          </div>

          {/* Ward filter */}
          <select
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{tr('كل الأجنحة', 'All Wards')}</option>
            {wards.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        {/* ── Data Table ────────────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 text-start font-medium">{tr('المريض', 'Patient')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الدواء', 'Drug')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الجرعة', 'Dose')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الطريقة', 'Route')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الوقت المجدول', 'Scheduled Time')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الجناح/السرير', 'Ward/Bed')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الحالة', 'Status')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      {tr('جاري التحميل...', 'Loading...')}
                    </td>
                  </tr>
                ) : doses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex justify-center mb-2"><Pill className="h-8 w-8 text-muted-foreground" /></div>
                      <p className="text-sm text-muted-foreground">
                        {search
                          ? tr('لا توجد نتائج للبحث', 'No results found')
                          : tr('لا توجد جرعات في هذه الحالة', 'No doses in this status')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  doses.map((dose) => {
                    const overdue = isOverdue(dose);
                    return (
                      <tr
                        key={dose.id}
                        className={`hover:bg-muted/30 transition-colors ${overdue ? 'bg-red-50/50' : ''}`}
                      >
                        {/* Patient */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{dose.patientName || '—'}</div>
                          {dose.mrn && (
                            <div className="text-xs text-muted-foreground">
                              {tr('ملف:', 'MRN:')} {dose.mrn}
                            </div>
                          )}
                        </td>
                        {/* Drug */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{dose.medication}</div>
                          {dose.genericName && (
                            <div className="text-xs text-muted-foreground">{dose.genericName}</div>
                          )}
                          {dose.strength && (
                            <div className="text-xs text-muted-foreground">{dose.strength}</div>
                          )}
                        </td>
                        {/* Dose */}
                        <td className="px-4 py-3 text-foreground">
                          {dose.dose || '—'}
                          {dose.form && (
                            <span className="text-xs text-muted-foreground ms-1">({dose.form})</span>
                          )}
                        </td>
                        {/* Route */}
                        <td className="px-4 py-3 text-foreground">{dose.route || '—'}</td>
                        {/* Scheduled Time */}
                        <td className="px-4 py-3">
                          <div className={overdue ? 'text-red-600 font-medium' : 'text-foreground'}>
                            {fmtTime(dose.scheduledTime, language)}
                          </div>
                          {overdue && (
                            <div className="text-[10px] font-bold text-red-500">
                              {tr('متأخرة', 'OVERDUE')}
                            </div>
                          )}
                        </td>
                        {/* Ward / Bed */}
                        <td className="px-4 py-3 text-foreground">
                          {dose.wardUnit || '—'}
                          {dose.bedLabel && (
                            <span className="text-xs text-muted-foreground ms-1">/ {dose.bedLabel}</span>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(dose.status)}`}
                          >
                            {statusLabel(dose.status, tr)}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">{renderActions(dose)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Workflow legend ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-2">
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
            {tr('جاهزة', 'Prepared')}
          </span>
          <span>&#8594;</span>
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
            {tr('محققة', 'Verified')}
          </span>
          <span>&#8594;</span>
          <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">
            {tr('مصروفة', 'Dispensed')}
          </span>
          <span>&#8594;</span>
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
            {tr('مُعطاة', 'Administered')}
          </span>
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateDoseDialog
          language={language}
          loading={actionLoading}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      {returnTarget && (
        <ReasonDialog
          title={tr('إرجاع الجرعة', 'Return Dose')}
          description={tr(
            `إرجاع ${returnTarget.medication} — ${returnTarget.patientName}`,
            `Return ${returnTarget.medication} — ${returnTarget.patientName}`,
          )}
          language={language}
          loading={actionLoading}
          onClose={() => setReturnTarget(null)}
          onConfirm={(reason) => {
            handleAction(returnTarget.id, 'return', { returnReason: reason });
            setReturnTarget(null);
          }}
          confirmLabel={tr('تأكيد الإرجاع', 'Confirm Return')}
          variant="orange"
        />
      )}

      {wasteTarget && (
        <ReasonDialog
          title={tr('تسجيل هدر', 'Record Waste')}
          description={tr(
            `تسجيل هدر ${wasteTarget.medication} — ${wasteTarget.patientName}`,
            `Record waste for ${wasteTarget.medication} — ${wasteTarget.patientName}`,
          )}
          language={language}
          loading={actionLoading}
          onClose={() => setWasteTarget(null)}
          onConfirm={(reason) => {
            handleAction(wasteTarget.id, 'waste', { wasteReason: reason });
            setWasteTarget(null);
          }}
          confirmLabel={tr('تأكيد الهدر', 'Confirm Waste')}
          variant="red"
        />
      )}
    </div>
  );
}
