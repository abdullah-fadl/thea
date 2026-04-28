'use client';

import { useState } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import {
  Droplets,
  AlertTriangle,
  Clock,
  PackageOpen,
  Activity,
  ChevronRight,
  RefreshCw,
  Plus,
  X,
  Thermometer,
  Zap,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Types ──────────────────────────────────────────────────────────────────

interface BloodBankRequest {
  id: string;
  patientMasterId: string;
  patientName?: string;
  mrn?: string;
  urgency: 'ROUTINE' | 'URGENT' | 'STAT';
  indication: string;
  bloodType: string;
  products: string[];
  crossmatch: boolean;
  consentObtained: boolean;
  status: string;
  createdAt: string;
  notes?: string;
}

interface BloodUnit {
  id: string;
  unitNumber: string;
  product: string;
  bloodType: string;
  expiryDate: string;
  volume: number | null;
  temperature: number | null;
  status: 'AVAILABLE' | 'RESERVED' | 'TRANSFUSING' | 'USED' | 'EXPIRED' | 'QUARANTINE';
  reservedFor: string | null;
}

interface Transfusion {
  id: string;
  requestId: string;
  unitNumber: string;
  patientMasterId: string;
  administeredBy: string;
  startTime: string;
  endTime: string | null;
  rate: number | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'STOPPED';
  preVitals: Record<string, unknown> | null;
  postVitals: Record<string, unknown> | null;
}

// ─── Config Maps ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; labelAr: string; color: string; bg: string }
> = {
  PENDING:     { label: 'Pending',     labelAr: 'معلق',          color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  CROSSMATCH:  { label: 'Crossmatch',  labelAr: 'تصالب الدم',    color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  APPROVED:    { label: 'Approved',    labelAr: 'موافق عليه',    color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  ISSUED:      { label: 'Issued',      labelAr: 'صادر',          color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
  TRANSFUSING: { label: 'Transfusing', labelAr: 'جارٍ نقل الدم', color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200' },
  COMPLETED:   { label: 'Completed',   labelAr: 'مكتمل',         color: 'text-green-700',   bg: 'bg-green-50 border-green-200' },
  CANCELLED:   { label: 'Cancelled',   labelAr: 'ملغى',          color: 'text-muted-foreground',    bg: 'bg-muted/50 border-border' },
};

const PRODUCT_LABELS: Record<string, { ar: string; en: string }> = {
  PRBC:       { ar: 'خلايا دم حمراء',    en: 'Packed Red Blood Cells' },
  FFP:        { ar: 'بلازما طازجة',      en: 'Fresh Frozen Plasma' },
  PLT:        { ar: 'صفائح دموية',        en: 'Platelets' },
  CRYO:       { ar: 'راسب البرودة',      en: 'Cryoprecipitate' },
  WHOLE_BLOOD:{ ar: 'دم كامل',           en: 'Whole Blood' },
};

const UNIT_STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string }> = {
  AVAILABLE:   { label: 'Available',   labelAr: 'متاح',          color: 'text-green-700 bg-green-50' },
  RESERVED:    { label: 'Reserved',    labelAr: 'محجوز',          color: 'text-blue-700 bg-blue-50' },
  TRANSFUSING: { label: 'Transfusing', labelAr: 'جارٍ نقله',     color: 'text-orange-700 bg-orange-50' },
  USED:        { label: 'Used',        labelAr: 'مستخدم',         color: 'text-muted-foreground bg-muted/50' },
  EXPIRED:     { label: 'Expired',     labelAr: 'منتهي الصلاحية', color: 'text-red-700 bg-red-50' },
  QUARANTINE:  { label: 'Quarantine',  labelAr: 'حجر صحي',        color: 'text-red-900 bg-red-100' },
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
    label: status,
    labelAr: status,
    color: 'text-muted-foreground',
    bg: 'bg-muted/50 border-border',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}
    >
      {lang === 'ar' ? cfg.labelAr : cfg.label}
    </span>
  );
}

function UrgencyBadge({ urgency, lang }: { urgency: string; lang: string }) {
  const map: Record<string, { label: string; labelAr: string; cls: string }> = {
    STAT:    { label: 'STAT',    labelAr: 'عاجل جداً', cls: 'bg-red-600 text-white' },
    URGENT:  { label: 'URGENT',  labelAr: 'عاجل',       cls: 'bg-orange-500 text-white' },
    ROUTINE: { label: 'Routine', labelAr: 'عادي',       cls: 'bg-muted text-foreground' },
  };
  const cfg = map[urgency] || map.ROUTINE;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${cfg.cls}`}>
      {lang === 'ar' ? cfg.labelAr : cfg.label}
    </span>
  );
}

// ─── New Request Modal ────────────────────────────────────────────────────────

interface NewRequestModalProps {
  onClose: () => void;
  onCreated: () => void;
  lang: string;
}

function NewRequestModal({ onClose, onCreated, lang }: NewRequestModalProps) {
  const tr = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [form, setForm] = useState({
    patientMasterId: '',
    urgency: 'ROUTINE',
    indication: '',
    bloodType: '',
    products: [] as string[],
    crossmatch: false,
    consentObtained: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const PRODUCTS = ['PRBC', 'FFP', 'PLT', 'CRYO', 'WHOLE_BLOOD'];
  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const toggleProduct = (p: string) => {
    setForm((f) => ({
      ...f,
      products: f.products.includes(p) ? f.products.filter((x) => x !== p) : [...f.products, p],
    }));
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.patientMasterId || !form.indication) {
      setError(tr('يرجى تعبئة الحقول المطلوبة', 'Please fill required fields'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/blood-bank/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      onCreated();
    } catch {
      setError(tr('فشل في إنشاء الطلب', 'Failed to create request'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">
            {tr('طلب دم جديد', 'New Blood Bank Request')}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Patient Master ID */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('معرّف المريض *', 'Patient ID *')}
            </label>
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              value={form.patientMasterId}
              onChange={(e) => setForm((f) => ({ ...f, patientMasterId: e.target.value }))}
              placeholder={tr('أدخل معرّف المريض', 'Enter patient ID')}
            />
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('الأولوية *', 'Urgency *')}
            </label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              value={form.urgency}
              onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
            >
              <option value="ROUTINE">{tr('عادي', 'Routine')}</option>
              <option value="URGENT">{tr('عاجل', 'Urgent')}</option>
              <option value="STAT">{tr('عاجل جداً', 'STAT')}</option>
            </select>
          </div>

          {/* Indication */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('المؤشر السريري *', 'Clinical Indication *')}
            </label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              rows={2}
              value={form.indication}
              onChange={(e) => setForm((f) => ({ ...f, indication: e.target.value }))}
              placeholder={tr('أدخل المؤشر السريري', 'Enter clinical indication')}
            />
          </div>

          {/* Blood Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {tr('فصيلة الدم', 'Blood Type')}
            </label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              value={form.bloodType}
              onChange={(e) => setForm((f) => ({ ...f, bloodType: e.target.value }))}
            >
              <option value="">{tr('-- اختر --', '-- Select --')}</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </div>

          {/* Products */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {tr('المنتجات الدموية', 'Blood Products')}
            </label>
            <div className="flex flex-wrap gap-2">
              {PRODUCTS.map((p) => {
                const selected = form.products.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProduct(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-card text-foreground border-border hover:border-red-400'
                    }`}
                  >
                    {lang === 'ar' ? PRODUCT_LABELS[p]?.ar : PRODUCT_LABELS[p]?.en}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.crossmatch}
                onChange={(e) => setForm((f) => ({ ...f, crossmatch: e.target.checked }))}
                className="rounded text-red-600 focus:ring-red-400"
              />
              <span className="text-sm text-foreground">
                {tr('مطلوب تصالب الدم (Crossmatch)', 'Crossmatch Required')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.consentObtained}
                onChange={(e) => setForm((f) => ({ ...f, consentObtained: e.target.checked }))}
                className="rounded text-red-600 focus:ring-red-400"
              />
              <span className="text-sm text-foreground">
                {tr('تم الحصول على موافقة المريض', 'Patient Consent Obtained')}
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {tr('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {tr('إنشاء الطلب', 'Create Request')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type TabId = 'requests' | 'inventory' | 'transfusions';

export default function BloodBankDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [activeTab, setActiveTab] = useState<TabId>('requests');
  const [showNewRequest, setShowNewRequest] = useState(false);

  // ── Data fetching ──
  const { data: requestsData, mutate: mutateRequests } = useSWR(
    '/api/blood-bank/requests',
    fetcher,
    { refreshInterval: 30000 }
  );
  const { data: unitsData, mutate: mutateUnits } = useSWR(
    '/api/blood-bank/units',
    fetcher,
    { refreshInterval: 60000 }
  );
  const { data: transfusionsData, mutate: mutateTransfusions } = useSWR(
    '/api/blood-bank/transfusions',
    fetcher,
    { refreshInterval: 20000 }
  );

  const requests: BloodBankRequest[] = Array.isArray(requestsData?.items)
    ? requestsData.items
    : [];
  const units: BloodUnit[] = Array.isArray(unitsData?.items) ? unitsData.items : [];
  const transfusions: Transfusion[] = Array.isArray(transfusionsData?.transfusions)
    ? transfusionsData.transfusions
    : [];

  // ── KPIs ──
  const today = new Date().toDateString();
  const todayRequests = requests.filter(
    (r) => new Date(r.createdAt).toDateString() === today
  ).length;
  const pendingRequests = requests.filter((r) =>
    ['PENDING', 'CROSSMATCH'].includes(r.status)
  ).length;
  const statRequests = requests.filter(
    (r) => r.urgency === 'STAT' && !['COMPLETED', 'CANCELLED'].includes(r.status)
  ).length;
  const availableUnits = units.filter((u) => u.status === 'AVAILABLE').length;

  // ── Inventory stats ──
  const byProduct: Record<string, number> = {};
  const byBloodType: Record<string, number> = {};
  for (const u of units.filter((u) => u.status === 'AVAILABLE')) {
    byProduct[u.product] = (byProduct[u.product] || 0) + 1;
    byBloodType[u.bloodType] = (byBloodType[u.bloodType] || 0) + 1;
  }

  const handleRefresh = () => {
    mutateRequests();
    mutateUnits();
    mutateTransfusions();
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'requests',     label: tr('الطلبات',    'Requests') },
    { id: 'inventory',   label: tr('المخزون',     'Inventory') },
    { id: 'transfusions', label: tr('نقل الدم',   'Transfusions') },
  ];

  return (
    <div dir={dir} className="min-h-screen bg-muted/50">
      {/* Header */}
      <div className="bg-card border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {tr('بنك الدم', 'Blood Bank')}
              </h1>
              <p className="text-xs text-muted-foreground">
                {tr('إدارة نقل الدم والمخزون', 'Transfusion & Inventory Management')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 text-muted-foreground hover:text-muted-foreground rounded-lg hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowNewRequest(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              <Plus className="w-4 h-4" />
              {tr('طلب جديد', 'New Request')}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<Activity className="w-6 h-6 text-blue-600" />}
          label={tr('طلبات اليوم', 'Today\'s Requests')}
          value={todayRequests}
        />
        <KpiCard
          icon={<Clock className="w-6 h-6 text-amber-600" />}
          label={tr('في الانتظار', 'Pending')}
          value={pendingRequests}
          accent={pendingRequests > 0 ? 'bg-amber-50 border-amber-200' : undefined}
        />
        <KpiCard
          icon={<Zap className="w-6 h-6 text-red-600" />}
          label={tr('طلبات عاجلة جداً', 'STAT Requests')}
          value={statRequests}
          accent={statRequests > 0 ? 'bg-red-50 border-red-200' : undefined}
        />
        <KpiCard
          icon={<PackageOpen className="w-6 h-6 text-green-600" />}
          label={tr('وحدات متاحة', 'Units Available')}
          value={availableUnits}
          accent={availableUnits < 5 ? 'bg-orange-50 border-orange-200' : undefined}
        />
      </div>

      {/* Tabs */}
      <div className="px-6">
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-4">
        {/* ── Requests Tab ── */}
        {activeTab === 'requests' && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('المريض', 'Patient')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('المؤشر', 'Indication')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('فصيلة الدم', 'Blood Type')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('المنتجات', 'Products')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الأولوية', 'Urgency')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الحالة', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('التاريخ', 'Date')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        {tr('لا توجد طلبات', 'No requests found')}
                      </td>
                    </tr>
                  )}
                  {requests.map((req) => (
                    <tr
                      key={req.id}
                      className={`hover:bg-muted/50 transition-colors ${
                        req.urgency === 'STAT' ? 'bg-red-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {req.patientName || req.patientMasterId}
                        </p>
                        {req.mrn && (
                          <p className="text-xs text-muted-foreground">{req.mrn}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {req.indication}
                      </td>
                      <td className="px-4 py-3">
                        {req.bloodType ? (
                          <span className="font-semibold text-red-700">{req.bloodType}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(req.products || []).map((p) => (
                            <span
                              key={p}
                              className="inline-block px-1.5 py-0.5 bg-muted text-foreground rounded text-xs"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <UrgencyBadge urgency={req.urgency} lang={language} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} lang={language} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString(
                          language === 'ar' ? 'ar-SA' : 'en-US',
                          { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Inventory Tab ── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Low stock warning */}
            {availableUnits < 5 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {tr(
                  `تحذير: المخزون منخفض — ${availableUnits} وحدة متاحة فقط`,
                  `Warning: Low stock — only ${availableUnits} units available`
                )}
              </div>
            )}

            {/* Stats by product */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(PRODUCT_LABELS).map(([code, labels]) => (
                <div
                  key={code}
                  className="bg-card border border-border rounded-xl p-3 text-center"
                >
                  <p className="text-2xl font-bold text-red-600">
                    {byProduct[code] || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'ar' ? labels.ar : labels.en}
                  </p>
                  {(byProduct[code] || 0) < 5 && (byProduct[code] || 0) > 0 && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">
                      {tr('منخفض', 'Low')}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Units table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                        {tr('رقم الوحدة', 'Unit #')}
                      </th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                        {tr('المنتج', 'Product')}
                      </th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                        {tr('فصيلة الدم', 'Blood Type')}
                      </th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                        {tr('الحجم (مل)', 'Volume (mL)')}
                      </th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                        {tr('تاريخ الانتهاء', 'Expiry Date')}
                      </th>
                      <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                        {tr('الحالة', 'Status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {units.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          {tr('لا توجد وحدات في المخزون', 'No units in inventory')}
                        </td>
                      </tr>
                    )}
                    {units.map((unit) => {
                      const expiry = new Date(unit.expiryDate);
                      const daysToExpiry = Math.ceil(
                        (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                      );
                      const isExpiringSoon = daysToExpiry <= 7 && daysToExpiry > 0;
                      const isExpired = daysToExpiry <= 0;
                      const statusCfg =
                        UNIT_STATUS_CONFIG[unit.status] || UNIT_STATUS_CONFIG.AVAILABLE;
                      return (
                        <tr key={unit.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-mono font-medium text-foreground">
                            {unit.unitNumber}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {language === 'ar'
                              ? PRODUCT_LABELS[unit.product]?.ar
                              : PRODUCT_LABELS[unit.product]?.en || unit.product}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-red-700">{unit.bloodType}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {unit.volume ? `${unit.volume} mL` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={
                                  isExpired
                                    ? 'text-red-700 font-medium'
                                    : isExpiringSoon
                                    ? 'text-orange-600 font-medium'
                                    : 'text-muted-foreground'
                                }
                              >
                                {expiry.toLocaleDateString(
                                  language === 'ar' ? 'ar-SA' : 'en-US'
                                )}
                              </span>
                              {isExpired && (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              )}
                              {isExpiringSoon && !isExpired && (
                                <Clock className="w-3.5 h-3.5 text-orange-500" />
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}
                            >
                              {language === 'ar' ? statusCfg.labelAr : statusCfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Transfusions Tab ── */}
        {activeTab === 'transfusions' && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('المريض', 'Patient')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('رقم الوحدة', 'Unit #')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('وقت البدء', 'Start Time')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('المعدل (مل/ساعة)', 'Rate (mL/hr)')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('الحالة', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                      {tr('وقت الانتهاء', 'End Time')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transfusions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                        {tr('لا توجد عمليات نقل دم', 'No transfusions found')}
                      </td>
                    </tr>
                  )}
                  {transfusions.map((t) => {
                    const isActive = t.status === 'IN_PROGRESS';
                    return (
                      <tr
                        key={t.id}
                        className={`hover:bg-muted/50 transition-colors ${
                          isActive ? 'bg-orange-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{t.patientMasterId}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">{t.unitNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(t.startTime).toLocaleString(
                            language === 'ar' ? 'ar-SA' : 'en-US'
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {t.rate != null ? `${t.rate} mL/hr` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                              <Activity className="w-3 h-3 animate-pulse" />
                              {tr('جارٍ النقل', 'In Progress')}
                            </span>
                          ) : t.status === 'COMPLETED' ? (
                            <span className="inline-flex px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              {tr('مكتمل', 'Completed')}
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              {tr('موقوف', 'Stopped')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {t.endTime
                            ? new Date(t.endTime).toLocaleString(
                                language === 'ar' ? 'ar-SA' : 'en-US'
                              )
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Request Modal */}
      {showNewRequest && (
        <NewRequestModal
          lang={language}
          onClose={() => setShowNewRequest(false)}
          onCreated={() => {
            setShowNewRequest(false);
            mutateRequests();
          }}
        />
      )}
    </div>
  );
}
