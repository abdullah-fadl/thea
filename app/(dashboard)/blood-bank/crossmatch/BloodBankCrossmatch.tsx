'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Droplets,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Search,
  RefreshCw,
  X,
  Zap,
  FlaskConical,
  Activity,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrossmatchRequest {
  id: string;
  patientMasterId: string;
  bloodType: string | null;
  products: Array<{ product?: string; units?: number; _crossmatchResult?: any }>;
  urgency: string;
  indication: string;
  status: string;
  crossmatch: boolean;
  consentObtained: boolean;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS = ['ALL', 'PENDING', 'IN_PROGRESS', 'COMPATIBLE', 'INCOMPATIBLE', 'CANCELLED'] as const;
const URGENCIES = ['ROUTINE', 'URGENT', 'EMERGENT', 'MASSIVE'] as const;
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const COMPONENTS = ['PRBC', 'FFP', 'PLT', 'CRYO', 'WHOLE_BLOOD'] as const;
const CROSSMATCH_TYPES = ['ELECTRONIC', 'IMMEDIATE_SPIN', 'FULL'] as const;

const URGENCY_CONFIG: Record<string, { en: string; ar: string; cls: string }> = {
  ROUTINE:  { en: 'Routine',  ar: 'عادي',       cls: 'bg-blue-100 text-blue-800' },
  URGENT:   { en: 'Urgent',   ar: 'عاجل',       cls: 'bg-yellow-100 text-yellow-800' },
  EMERGENT: { en: 'Emergent', ar: 'طارئ',       cls: 'bg-orange-100 text-orange-800' },
  MASSIVE:  { en: 'Massive',  ar: 'نقل دم ضخم', cls: 'bg-red-100 text-red-800' },
};

const STATUS_CONFIG: Record<string, { en: string; ar: string; color: string; bg: string }> = {
  PENDING:       { en: 'Pending',       ar: 'معلق',        color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  IN_PROGRESS:   { en: 'In Progress',   ar: 'قيد التنفيذ', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  CROSSMATCH:    { en: 'Crossmatch',    ar: 'تصالب الدم',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  COMPATIBLE:    { en: 'Compatible',    ar: 'متوافق',      color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  INCOMPATIBLE:  { en: 'Incompatible',  ar: 'غير متوافق',  color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  APPROVED:      { en: 'Approved',      ar: 'موافق عليه',  color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  ISSUED:        { en: 'Issued',        ar: 'صادر',        color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  COMPLETED:     { en: 'Completed',     ar: 'مكتمل',       color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  CANCELLED:     { en: 'Cancelled',     ar: 'ملغى',        color: 'text-muted-foreground',   bg: 'bg-muted/50 border-border' },
};

const COMPONENT_LABELS: Record<string, { en: string; ar: string }> = {
  PRBC:        { en: 'PRBC',           ar: 'خلايا دم حمراء' },
  FFP:         { en: 'FFP',            ar: 'بلازما طازجة' },
  PLT:         { en: 'Platelets',      ar: 'صفائح دموية' },
  CRYO:        { en: 'Cryoprecipitate', ar: 'راسب البرودة' },
  WHOLE_BLOOD: { en: 'Whole Blood',    ar: 'دم كامل' },
};

const CROSSMATCH_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  ELECTRONIC:     { en: 'Electronic',      ar: 'إلكتروني' },
  IMMEDIATE_SPIN: { en: 'Immediate Spin',  ar: 'دوران فوري' },
  FULL:           { en: 'Full Crossmatch', ar: 'تصالب كامل' },
};

// ─── Helper Components ────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${accent || 'bg-card border-border'}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const cfg = STATUS_CONFIG[status] || {
    en: status,
    ar: status,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50 border-border',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
      {lang === 'ar' ? cfg.ar : cfg.en}
    </span>
  );
}

function UrgencyBadge({ urgency, lang }: { urgency: string; lang: string }) {
  const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.ROUTINE;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${cfg.cls}`}>
      {lang === 'ar' ? cfg.ar : cfg.en}
    </span>
  );
}

// ─── New Request Dialog ───────────────────────────────────────────────────────

interface NewRequestDialogProps {
  onClose: () => void;
  onCreated: () => void;
  lang: string;
}

function NewRequestDialog({ onClose, onCreated, lang }: NewRequestDialogProps) {
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const [form, setForm] = useState({
    patientMasterId: '',
    bloodType: '',
    component: 'PRBC',
    unitsRequested: 1,
    urgency: 'ROUTINE',
    crossmatchType: 'ELECTRONIC',
    indication: '',
    consentObtained: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.patientMasterId.trim() || !form.bloodType || !form.component) {
      setError(tr('يرجى ملء جميع الحقول المطلوبة', 'Please fill in all required fields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/blood-bank/crossmatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || tr('فشل في إنشاء الطلب', 'Failed to create request'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-foreground">
            {tr('طلب تصالب دم جديد', 'New Crossmatch Request')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {/* Patient ID */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('معرف المريض', 'Patient ID')} *
            </label>
            <input
              type="text"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={tr('أدخل معرف المريض...', 'Enter patient ID...')}
              value={form.patientMasterId}
              onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
            />
          </div>

          {/* Blood Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('فصيلة الدم', 'Blood Type')} *
            </label>
            <div className="grid grid-cols-4 gap-2">
              {BLOOD_TYPES.map((bt) => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, bloodType: bt }))}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.bloodType === bt
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-card text-foreground border-border hover:bg-muted/50'
                  }`}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>

          {/* Component */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('مكون الدم', 'Blood Component')} *
            </label>
            <select
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={form.component}
              onChange={(e) => setForm((f) => ({ ...f, component: e.target.value }))}
            >
              {COMPONENTS.map((c) => (
                <option key={c} value={c}>
                  {lang === 'ar' ? COMPONENT_LABELS[c].ar : COMPONENT_LABELS[c].en}
                </option>
              ))}
            </select>
          </div>

          {/* Units */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('عدد الوحدات', 'Units Requested')}
            </label>
            <input
              type="number"
              min={1}
              max={20}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={form.unitsRequested}
              onChange={(e) => setForm((f) => ({ ...f, unitsRequested: parseInt(e.target.value) || 1 }))}
            />
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('درجة الاستعجال', 'Urgency')} *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {URGENCIES.map((u) => {
                const cfg = URGENCY_CONFIG[u];
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, urgency: u }))}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      form.urgency === u
                        ? cfg.cls + ' border-current ring-2 ring-offset-1 ring-current'
                        : 'bg-card text-foreground border-border hover:bg-muted/50'
                    }`}
                  >
                    {lang === 'ar' ? cfg.ar : cfg.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Crossmatch Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('نوع التصالب', 'Crossmatch Type')} *
            </label>
            <select
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={form.crossmatchType}
              onChange={(e) => setForm((f) => ({ ...f, crossmatchType: e.target.value }))}
            >
              {CROSSMATCH_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {lang === 'ar' ? CROSSMATCH_TYPE_LABELS[ct].ar : CROSSMATCH_TYPE_LABELS[ct].en}
                </option>
              ))}
            </select>
          </div>

          {/* Indication */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('دواعي الاستعمال', 'Indication')}
            </label>
            <textarea
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={tr('أدخل دواعي الاستعمال...', 'Enter indication...')}
              value={form.indication}
              onChange={(e) => setForm((f) => ({ ...f, indication: e.target.value }))}
            />
          </div>

          {/* Consent */}
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={form.consentObtained}
              onChange={(e) => setForm((f) => ({ ...f, consentObtained: e.target.checked }))}
            />
            {tr('تم الحصول على موافقة المريض', 'Patient consent obtained')}
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted/50"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('إنشاء طلب', 'Create Request')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Result Entry Dialog ──────────────────────────────────────────────────────

interface ResultDialogProps {
  request: CrossmatchRequest;
  onClose: () => void;
  onSaved: () => void;
  lang: string;
}

function ResultEntryDialog({ request, onClose, onSaved, lang }: ResultDialogProps) {
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const [form, setForm] = useState({
    result: '' as '' | 'COMPATIBLE' | 'INCOMPATIBLE',
    antibodyScreen: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.result) {
      setError(tr('يرجى تحديد نتيجة التصالب', 'Please select a crossmatch result'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/blood-bank/crossmatch/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || tr('فشل في حفظ النتيجة', 'Failed to save result'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-foreground">
            {tr('إدخال نتيجة التصالب', 'Enter Crossmatch Result')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {/* Request Info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr('فصيلة الدم', 'Blood Type')}</span>
              <span className="font-medium">{request.bloodType || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tr('درجة الاستعجال', 'Urgency')}</span>
              <UrgencyBadge urgency={request.urgency} lang={lang} />
            </div>
          </div>

          {/* Result Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {tr('نتيجة التصالب', 'Crossmatch Result')} *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, result: 'COMPATIBLE' }))}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors flex items-center gap-2 justify-center ${
                  form.result === 'COMPATIBLE'
                    ? 'bg-green-50 border-green-500 text-green-700'
                    : 'bg-card border-border text-foreground hover:bg-muted/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                {tr('متوافق', 'Compatible')}
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, result: 'INCOMPATIBLE' }))}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors flex items-center gap-2 justify-center ${
                  form.result === 'INCOMPATIBLE'
                    ? 'bg-red-50 border-red-500 text-red-700'
                    : 'bg-card border-border text-foreground hover:bg-muted/50'
                }`}
              >
                <XCircle className="w-4 h-4" />
                {tr('غير متوافق', 'Incompatible')}
              </button>
            </div>
          </div>

          {/* Antibody Screen */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('فحص الأجسام المضادة', 'Antibody Screen')}
            </label>
            <select
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              value={form.antibodyScreen}
              onChange={(e) => setForm((f) => ({ ...f, antibodyScreen: e.target.value }))}
            >
              <option value="">{tr('اختر...', 'Select...')}</option>
              <option value="NEGATIVE">{tr('سلبي', 'Negative')}</option>
              <option value="POSITIVE">{tr('إيجابي', 'Positive')}</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('ملاحظات', 'Notes')}
            </label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={tr('ملاحظات إضافية...', 'Additional notes...')}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted/50"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ النتيجة', 'Save Result')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BloodBankCrossmatch() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>('');
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [resultRequest, setResultRequest] = useState<CrossmatchRequest | null>(null);

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusTab !== 'ALL') queryParams.set('status', statusTab);
  if (urgencyFilter) queryParams.set('urgency', urgencyFilter);
  if (bloodTypeFilter) queryParams.set('bloodType', bloodTypeFilter);

  const { data, isLoading, mutate } = useSWR(
    `/api/blood-bank/crossmatch?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const items: CrossmatchRequest[] = data?.items || [];

  // KPI Calculations
  const allData = useSWR('/api/blood-bank/crossmatch', fetcher, { refreshInterval: 15000 });
  const allItems: CrossmatchRequest[] = allData.data?.items || [];

  const kpis = useMemo(() => {
    const total = allItems.length;
    const pending = allItems.filter((i) => i.status === 'PENDING').length;
    const compatible = allItems.filter((i) => i.status === 'COMPATIBLE').length;
    const incompatible = allItems.filter((i) => i.status === 'INCOMPATIBLE').length;
    const emergency = allItems.filter((i) => i.urgency === 'EMERGENT' || i.urgency === 'MASSIVE').length;
    return { total, pending, compatible, incompatible, emergency };
  }, [allItems]);

  // Extract product details from a request
  const getProductInfo = (req: CrossmatchRequest) => {
    const products = Array.isArray(req.products) ? req.products : [];
    const productEntry = products.find((p) => p.product && !p._crossmatchResult);
    return {
      component: productEntry?.product || '—',
      units: productEntry?.units || 1,
    };
  };

  // Get crossmatch type from indication string
  const getCrossmatchType = (req: CrossmatchRequest) => {
    const ind = req.indication || '';
    if (ind.includes('ELECTRONIC')) return 'ELECTRONIC';
    if (ind.includes('IMMEDIATE_SPIN')) return 'IMMEDIATE_SPIN';
    if (ind.includes('FULL')) return 'FULL';
    return 'ELECTRONIC';
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-red-600" />
            {tr('تصالب الدم', 'Blood Bank Crossmatch')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('إدارة طلبات اختبار التصالب ونتائجها', 'Manage crossmatch test requests and results')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { mutate(); allData.mutate(); }}
            className="p-2 rounded-lg border border-border hover:bg-muted/50 text-muted-foreground"
            title={tr('تحديث', 'Refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNewRequest(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
          >
            <Plus className="w-4 h-4" />
            {tr('طلب جديد', 'New Request')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          icon={<Droplets className="w-6 h-6 text-blue-600" />}
          label={tr('إجمالي الطلبات', 'Total Requests')}
          value={kpis.total}
          accent="bg-blue-50 border-blue-200"
        />
        <KpiCard
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          label={tr('معلق', 'Pending')}
          value={kpis.pending}
          accent="bg-amber-50 border-amber-200"
        />
        <KpiCard
          icon={<CheckCircle2 className="w-6 h-6 text-green-600" />}
          label={tr('متوافق', 'Compatible')}
          value={kpis.compatible}
          accent="bg-green-50 border-green-200"
        />
        <KpiCard
          icon={<XCircle className="w-6 h-6 text-red-600" />}
          label={tr('غير متوافق', 'Incompatible')}
          value={kpis.incompatible}
          accent="bg-red-50 border-red-200"
        />
        <KpiCard
          icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
          label={tr('طلبات طوارئ', 'Emergency Requests')}
          value={kpis.emergency}
          accent="bg-orange-50 border-orange-200"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1 bg-muted rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusTab === tab
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'ALL'
                ? tr('الكل', 'All')
                : tab === 'PENDING'
                ? tr('معلق', 'Pending')
                : tab === 'IN_PROGRESS'
                ? tr('قيد التنفيذ', 'In Progress')
                : tab === 'COMPATIBLE'
                ? tr('متوافق', 'Compatible')
                : tab === 'INCOMPATIBLE'
                ? tr('غير متوافق', 'Incompatible')
                : tr('ملغى', 'Cancelled')}
            </button>
          ))}
        </div>

        {/* Urgency Filter */}
        <select
          className="rounded-lg border border-border px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
        >
          <option value="">{tr('كل الاستعجالات', 'All Urgencies')}</option>
          {URGENCIES.map((u) => (
            <option key={u} value={u}>
              {language === 'ar' ? URGENCY_CONFIG[u].ar : URGENCY_CONFIG[u].en}
            </option>
          ))}
        </select>

        {/* Blood Type Filter */}
        <select
          className="rounded-lg border border-border px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500"
          value={bloodTypeFilter}
          onChange={(e) => setBloodTypeFilter(e.target.value)}
        >
          <option value="">{tr('كل فصائل الدم', 'All Blood Types')}</option>
          {BLOOD_TYPES.map((bt) => (
            <option key={bt} value={bt}>{bt}</option>
          ))}
        </select>
      </div>

      {/* Data Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('المريض', 'Patient')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('فصيلة الدم', 'Blood Type')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('المكون', 'Component')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {tr('الوحدات', 'Units')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('الاستعجال', 'Urgency')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('نوع التصالب', 'Crossmatch Type')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('الحالة', 'Status')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('التاريخ', 'Date')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {tr('إجراء', 'Action')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    {tr('جارٍ التحميل...', 'Loading...')}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    {tr('لا توجد طلبات تصالب', 'No crossmatch requests found')}
                  </td>
                </tr>
              ) : (
                items.map((req) => {
                  const pInfo = getProductInfo(req);
                  const cmType = getCrossmatchType(req);
                  const cmTypeLabel = CROSSMATCH_TYPE_LABELS[cmType] || { en: cmType, ar: cmType };
                  const compLabel = COMPONENT_LABELS[pInfo.component] || { en: pInfo.component, ar: pInfo.component };

                  return (
                    <tr key={req.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="text-foreground font-medium text-xs font-mono">
                          {req.patientMasterId.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-bold">
                          {req.bloodType || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {language === 'ar' ? compLabel.ar : compLabel.en}
                      </td>
                      <td className="px-4 py-3 text-center text-foreground font-medium">
                        {pInfo.units}
                      </td>
                      <td className="px-4 py-3">
                        <UrgencyBadge urgency={req.urgency} lang={language} />
                      </td>
                      <td className="px-4 py-3 text-foreground text-xs">
                        {language === 'ar' ? cmTypeLabel.ar : cmTypeLabel.en}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} lang={language} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(req.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(req.status === 'PENDING' || req.status === 'IN_PROGRESS' || req.status === 'CROSSMATCH') && (
                          <button
                            onClick={() => setResultRequest(req)}
                            className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            {tr('إدخال النتيجة', 'Enter Result')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      {showNewRequest && (
        <NewRequestDialog
          lang={language}
          onClose={() => setShowNewRequest(false)}
          onCreated={() => { mutate(); allData.mutate(); }}
        />
      )}
      {resultRequest && (
        <ResultEntryDialog
          request={resultRequest}
          lang={language}
          onClose={() => setResultRequest(null)}
          onSaved={() => { mutate(); allData.mutate(); }}
        />
      )}
    </div>
  );
}
