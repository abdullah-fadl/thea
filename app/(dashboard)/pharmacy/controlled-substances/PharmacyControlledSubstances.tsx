'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Lock } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TxType = 'RECEIVE' | 'DISPENSE' | 'WASTE' | 'RETURN' | 'ADJUST' | 'TRANSFER';

interface SubstanceLog {
  id: string;
  medication: string;
  genericName?: string;
  schedule?: string;
  strength?: string;
  form?: string;
  transactionType: TxType;
  quantity: number;
  unit?: string;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  patientId?: string;
  patientName?: string;
  mrn?: string;
  performedByName?: string;
  witnessName?: string;
  witnessUserId?: string;
  wasteMethod?: string;
  wasteAmount?: number | null;
  sourceLocation?: string;
  destinationLocation?: string;
  lotNumber?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  discrepancyFound: boolean;
  discrepancyNote?: string;
  discrepancyResolved: boolean;
  notes?: string;
  createdAt: string;
}

interface Summary {
  total: number;
  discrepancies: number;
  pendingWitness: number;
  waste: number;
  receive: number;
  dispense: number;
  returns: number;
  adjust: number;
  transfer: number;
}

type TabValue = 'ALL' | TxType;

const TX_TABS: { value: TabValue; ar: string; en: string }[] = [
  { value: 'ALL', ar: 'الكل', en: 'All' },
  { value: 'RECEIVE', ar: 'استلام', en: 'Receipt' },
  { value: 'DISPENSE', ar: 'صرف', en: 'Dispensing' },
  { value: 'WASTE', ar: 'إهدار', en: 'Waste' },
  { value: 'RETURN', ar: 'إرجاع', en: 'Return' },
  { value: 'ADJUST', ar: 'تعديل', en: 'Count' },
];

const SCHEDULES = ['II', 'III', 'IV', 'V'];

const WASTE_METHODS = [
  { value: 'WITNESSED_WASTE', ar: 'إهدار بشاهد', en: 'Witnessed Waste' },
  { value: 'PHARMACEUTICAL_WASTE', ar: 'إهدار صيدلاني', en: 'Pharmaceutical Waste' },
  { value: 'RETURN_TO_PHARMACY', ar: 'إعادة للصيدلية', en: 'Return to Pharmacy' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function txTypeColor(type: string) {
  switch (type) {
    case 'RECEIVE':
      return 'bg-emerald-100 text-emerald-700';
    case 'DISPENSE':
      return 'bg-blue-100 text-blue-700';
    case 'WASTE':
      return 'bg-red-100 text-red-700';
    case 'RETURN':
      return 'bg-orange-100 text-orange-700';
    case 'ADJUST':
      return 'bg-purple-100 text-purple-700';
    case 'TRANSFER':
      return 'bg-cyan-100 text-cyan-700';
    default:
      return 'bg-muted text-foreground';
  }
}

function txTypeLabel(type: string, tr: (ar: string, en: string) => string) {
  switch (type) {
    case 'RECEIVE':
      return tr('استلام', 'Receipt');
    case 'DISPENSE':
      return tr('صرف', 'Dispense');
    case 'WASTE':
      return tr('إهدار', 'Waste');
    case 'RETURN':
      return tr('إرجاع', 'Return');
    case 'ADJUST':
      return tr('تعديل/جرد', 'Adjust/Count');
    case 'TRANSFER':
      return tr('تحويل', 'Transfer');
    default:
      return type;
  }
}

function scheduleColor(schedule: string | undefined) {
  switch (schedule) {
    case 'II':
      return 'bg-red-100 text-red-800';
    case 'III':
      return 'bg-orange-100 text-orange-800';
    case 'IV':
      return 'bg-amber-100 text-amber-800';
    case 'V':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function fmtDateTime(iso: string | undefined, language: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// New Transaction Dialog
// ---------------------------------------------------------------------------
function NewTransactionDialog({
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
    medication: '',
    genericName: '',
    schedule: 'II',
    strength: '',
    form: '',
    transactionType: 'DISPENSE' as TxType,
    quantity: '',
    unit: 'TABLET',
    balanceBefore: '',
    patientName: '',
    mrn: '',
    witnessName: '',
    witnessUserId: 'witness-placeholder',
    wasteMethod: '',
    wasteAmount: '',
    sourceLocation: '',
    destinationLocation: '',
    lotNumber: '',
    discrepancyFound: false,
    discrepancyNote: '',
    notes: '',
  });

  const set = (key: string, val: any) => setForm((p) => ({ ...p, [key]: val }));

  const UNITS = [
    { value: 'TABLET', ar: 'قرص', en: 'Tablet' },
    { value: 'ML', ar: 'مل', en: 'mL' },
    { value: 'MG', ar: 'مجم', en: 'mg' },
    { value: 'AMPULE', ar: 'أمبولة', en: 'Ampule' },
    { value: 'VIAL', ar: 'قارورة', en: 'Vial' },
    { value: 'PATCH', ar: 'لصقة', en: 'Patch' },
  ];

  const TX_TYPES: { value: TxType; ar: string; en: string }[] = [
    { value: 'RECEIVE', ar: 'استلام', en: 'Receive' },
    { value: 'DISPENSE', ar: 'صرف', en: 'Dispense' },
    { value: 'WASTE', ar: 'إهدار', en: 'Waste' },
    { value: 'RETURN', ar: 'إرجاع', en: 'Return' },
    { value: 'ADJUST', ar: 'تعديل/جرد', en: 'Adjust/Count' },
    { value: 'TRANSFER', ar: 'تحويل', en: 'Transfer' },
  ];

  const showPatient = ['DISPENSE', 'WASTE', 'RETURN'].includes(form.transactionType);
  const showWaste = form.transactionType === 'WASTE';
  const showLocations = form.transactionType === 'TRANSFER';
  const requiresWitness = ['WASTE', 'DISPENSE'].includes(form.transactionType);

  const canSubmit =
    form.medication.trim() &&
    form.quantity &&
    Number(form.quantity) > 0 &&
    (!requiresWitness || form.witnessName.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        dir={language === 'ar' ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {tr('معاملة مادة مراقبة جديدة', 'New Controlled Substance Transaction')}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr(
              'تسجيل حركة مادة مراقبة مع التحقق المزدوج',
              'Record controlled substance movement with dual verification',
            )}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              {tr('نوع المعاملة', 'Transaction Type')} *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TX_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => set('transactionType', t.value)}
                  className={`px-3 py-2 text-sm rounded-xl border text-center transition-colors ${
                    form.transactionType === t.value
                      ? 'border-blue-400 bg-blue-50 text-blue-800 font-medium'
                      : 'border-border hover:bg-muted/50 text-foreground'
                  }`}
                >
                  {tr(t.ar, t.en)}
                </button>
              ))}
            </div>
          </div>

          {/* Medication info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('اسم الدواء', 'Drug Name')} *
              </label>
              <input
                value={form.medication}
                onChange={(e) => set('medication', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={tr('مثال: مورفين', 'e.g. Morphine')}
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
              />
            </div>
          </div>

          {/* Schedule / Strength */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الجدول', 'Schedule')} *
              </label>
              <select
                value={form.schedule}
                onChange={(e) => set('schedule', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SCHEDULES.map((s) => (
                  <option key={s} value={s}>
                    {tr(`الجدول ${s}`, `Schedule ${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('التركيز', 'Strength')}
              </label>
              <input
                value={form.strength}
                onChange={(e) => set('strength', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="10mg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('رقم الدفعة', 'Lot Number')}
              </label>
              <input
                value={form.lotNumber}
                onChange={(e) => set('lotNumber', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Quantity / Unit / Balance */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الكمية', 'Quantity')} *
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.quantity}
                onChange={(e) => set('quantity', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الوحدة', 'Unit')}
              </label>
              <select
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {tr(u.ar, u.en)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {tr('الرصيد قبل', 'Balance Before')}
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.balanceBefore}
                onChange={(e) => set('balanceBefore', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          {/* Patient info (for dispense/waste/return) */}
          {showPatient && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tr('اسم المريض', 'Patient Name')}
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
                />
              </div>
            </div>
          )}

          {/* Witness (required for waste & dispense) */}
          {requiresWitness && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-amber-800 mb-2">
                {tr('التحقق المزدوج مطلوب', 'Dual Verification Required')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">
                    {tr('اسم الشاهد', 'Witness Name')} *
                  </label>
                  <input
                    value={form.witnessName}
                    onChange={(e) => set('witnessName', e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={tr('اسم الشاهد/المتحقق', 'Witness/Verifier name')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-900 mb-1">
                    {tr('معرف الشاهد', 'Witness ID')}
                  </label>
                  <input
                    value={form.witnessUserId === 'witness-placeholder' ? '' : form.witnessUserId}
                    onChange={(e) => set('witnessUserId', e.target.value || 'witness-placeholder')}
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl text-sm bg-card focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder={tr('معرف المستخدم', 'User ID')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Waste details */}
          {showWaste && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tr('طريقة الإهدار', 'Waste Method')}
                </label>
                <select
                  value={form.wasteMethod}
                  onChange={(e) => set('wasteMethod', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{tr('اختر...', 'Select...')}</option>
                  {WASTE_METHODS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {tr(w.ar, w.en)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tr('الكمية المهدرة', 'Waste Amount')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.wasteAmount}
                  onChange={(e) => set('wasteAmount', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Transfer locations */}
          {showLocations && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tr('من الموقع', 'Source Location')}
                </label>
                <input
                  value={form.sourceLocation}
                  onChange={(e) => set('sourceLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  {tr('إلى الموقع', 'Destination Location')}
                </label>
                <input
                  value={form.destinationLocation}
                  onChange={(e) => set('destinationLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Discrepancy */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.discrepancyFound}
                onChange={(e) => set('discrepancyFound', e.target.checked)}
                className="w-4 h-4 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-red-700 font-medium">
                {tr('تم اكتشاف فرق', 'Discrepancy Found')}
              </span>
            </label>
          </div>
          {form.discrepancyFound && (
            <div>
              <label className="block text-xs font-medium text-red-700 mb-1">
                {tr('وصف الفرق', 'Discrepancy Details')} *
              </label>
              <textarea
                value={form.discrepancyNote}
                onChange={(e) => set('discrepancyNote', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-red-300 rounded-xl text-sm bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                placeholder={tr('صف الفرق بالتفصيل...', 'Describe the discrepancy in detail...')}
              />
            </div>
          )}

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
              placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
            />
          </div>
        </div>

        {/* Footer */}
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
              if (!canSubmit) return;
              onSubmit({
                ...form,
                quantity: Number(form.quantity),
                balanceBefore: form.balanceBefore ? Number(form.balanceBefore) : undefined,
                wasteAmount: form.wasteAmount ? Number(form.wasteAmount) : undefined,
                witnessUserId:
                  form.witnessUserId === 'witness-placeholder' ? undefined : form.witnessUserId || undefined,
              });
            }}
            disabled={loading || !canSubmit}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <span className="animate-spin text-xs">...</span>}
            {tr('تسجيل المعاملة', 'Record Transaction')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function PharmacyControlledSubstances() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabValue>('ALL');
  const [search, setSearch] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Build query
  const params = new URLSearchParams();
  if (activeTab !== 'ALL') params.set('transactionType', activeTab);
  if (search.trim()) params.set('search', search.trim());
  if (scheduleFilter) params.set('schedule', scheduleFilter);

  const { data, mutate, isLoading } = useSWR(
    `/api/pharmacy/controlled-substances?${params.toString()}`,
    fetcher,
    { refreshInterval: 15000 },
  );

  const logs: SubstanceLog[] = Array.isArray(data?.logs) ? data.logs : [];
  const summary: Summary = data?.summary || {
    total: 0,
    discrepancies: 0,
    pendingWitness: 0,
    waste: 0,
    receive: 0,
    dispense: 0,
    returns: 0,
    adjust: 0,
    transfer: 0,
  };

  // ── Create handler ─────────────────────────────────────────────────────────
  const handleCreate = async (formData: any) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/pharmacy/controlled-substances', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || tr('فشل تسجيل المعاملة', 'Failed to record transaction'));
      }
      toast({ title: tr('تم تسجيل المعاملة بنجاح', 'Transaction recorded successfully') });
      setShowCreate(false);
      mutate();
    } catch (e: any) {
      toast({ title: tr('خطأ', 'Error'), description: e.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── KPI card helper ────────────────────────────────────────────────────────
  function KPI({
    label,
    value,
    color,
    alert,
  }: {
    label: string;
    value: number;
    color: string;
    alert?: boolean;
  }) {
    return (
      <div
        className={`rounded-xl border p-4 flex flex-col ${
          alert && value > 0 ? 'bg-red-50 border-red-200' : 'bg-card border-border'
        }`}
      >
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-2xl font-bold mt-1 ${alert && value > 0 ? 'text-red-600' : color}`}>
          {value}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('سجل المواد المراقبة', 'Controlled Substance Log')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {tr(
                'تتبع المواد المراقبة مع التحقق المزدوج والجرد وتسجيل الإهدار',
                'Track controlled substances with dual verification, counting, and waste witnessing',
              )}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            {tr('معاملة جديدة', 'New Transaction')}
          </button>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI
            label={tr('إجمالي المعاملات', 'Total Transactions')}
            value={summary.total}
            color="text-foreground"
          />
          <KPI
            label={tr('الفروقات', 'Discrepancies')}
            value={summary.discrepancies}
            color="text-red-600"
            alert
          />
          <KPI
            label={tr('بانتظار شاهد', 'Pending Witness')}
            value={summary.pendingWitness}
            color="text-amber-600"
            alert
          />
          <KPI
            label={tr('حالات الإهدار', 'Waste Count')}
            value={summary.waste}
            color="text-red-500"
          />
        </div>

        {/* ── Filters Row ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Transaction type tabs */}
          <div className="flex gap-2 flex-wrap">
            {TX_TABS.map((tab) => (
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
              placeholder={tr('بحث بالدواء أو المريض...', 'Search drug or patient...')}
            />
          </div>

          {/* Schedule filter */}
          <select
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{tr('كل الجداول', 'All Schedules')}</option>
            {SCHEDULES.map((s) => (
              <option key={s} value={s}>
                {tr(`الجدول ${s}`, `Schedule ${s}`)}
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
                  <th className="px-4 py-3 text-start font-medium">{tr('الدواء', 'Drug')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الجدول', 'Schedule')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('المعاملة', 'Transaction')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الكمية', 'Qty')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('قبل', 'Before')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('بعد', 'After')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('المنفذ', 'Performed By')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('الشاهد', 'Witness')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('التاريخ', 'Timestamp')}</th>
                  <th className="px-4 py-3 text-start font-medium">{tr('فرق', 'Disc.')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      {tr('جاري التحميل...', 'Loading...')}
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <div className="flex justify-center mb-2"><Lock className="h-8 w-8 text-muted-foreground" /></div>
                      <p className="text-sm text-muted-foreground">
                        {search
                          ? tr('لا توجد نتائج للبحث', 'No results found')
                          : tr('لا توجد سجلات مواد مراقبة', 'No controlled substance records')}
                      </p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        log.discrepancyFound && !log.discrepancyResolved ? 'bg-red-50/60' : ''
                      }`}
                    >
                      {/* Drug */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{log.medication}</div>
                        {log.genericName && (
                          <div className="text-xs text-muted-foreground">{log.genericName}</div>
                        )}
                        {log.strength && (
                          <div className="text-xs text-muted-foreground">{log.strength}</div>
                        )}
                        {log.patientName && (
                          <div className="text-xs text-blue-600 mt-0.5">
                            {log.patientName}
                            {log.mrn && ` (${log.mrn})`}
                          </div>
                        )}
                      </td>
                      {/* Schedule */}
                      <td className="px-4 py-3">
                        {log.schedule ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${scheduleColor(log.schedule)}`}
                          >
                            {log.schedule}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      {/* Transaction type */}
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${txTypeColor(log.transactionType)}`}
                        >
                          {txTypeLabel(log.transactionType, tr)}
                        </span>
                      </td>
                      {/* Quantity */}
                      <td className="px-4 py-3 font-medium text-foreground">
                        {log.quantity}
                        {log.unit && (
                          <span className="text-xs text-muted-foreground ms-1">{log.unit}</span>
                        )}
                      </td>
                      {/* Balance before */}
                      <td className="px-4 py-3 text-muted-foreground">
                        {log.balanceBefore != null ? log.balanceBefore : '—'}
                      </td>
                      {/* Balance after */}
                      <td className="px-4 py-3 font-medium text-foreground">
                        {log.balanceAfter != null ? log.balanceAfter : '—'}
                      </td>
                      {/* Performed by */}
                      <td className="px-4 py-3 text-foreground text-xs">
                        {log.performedByName || '—'}
                      </td>
                      {/* Witness */}
                      <td className="px-4 py-3 text-xs">
                        {log.witnessName ? (
                          <span className="text-emerald-700 font-medium">{log.witnessName}</span>
                        ) : (
                          <span className="text-amber-600 font-medium">
                            {tr('بدون شاهد', 'No witness')}
                          </span>
                        )}
                      </td>
                      {/* Timestamp */}
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {fmtDateTime(log.createdAt, language)}
                      </td>
                      {/* Discrepancy */}
                      <td className="px-4 py-3">
                        {log.discrepancyFound ? (
                          <div className="flex flex-col items-start">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                              {log.discrepancyResolved
                                ? tr('تم الحل', 'Resolved')
                                : tr('فرق!', 'DISC!')}
                            </span>
                            {log.discrepancyNote && (
                              <span className="text-[10px] text-red-500 mt-0.5 max-w-[120px] truncate">
                                {log.discrepancyNote}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-emerald-600 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Compliance notice ──────────────────────────────────────────────── */}
        <div className="text-center text-xs text-muted-foreground py-2">
          {tr(
            'جميع معاملات المواد المراقبة تُسجّل بشكل تلقائي وتخضع للتدقيق بما يتوافق مع لوائح هيئة الغذاء والدواء',
            'All controlled substance transactions are automatically logged and auditable per SFDA/DEA compliance requirements',
          )}
        </div>
      </div>

      {/* ── New Transaction Dialog ─────────────────────────────────────────────── */}
      {showCreate && (
        <NewTransactionDialog
          language={language}
          loading={actionLoading}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
