'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Droplets,
  AlertTriangle,
  Clock,
  RefreshCw,
  PackageOpen,
  ShieldAlert,
  Archive,
  Thermometer,
  TrendingDown,
} from 'lucide-react';
import { useLang } from '@/hooks/use-lang';

// ─── Fetcher ──────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────

interface BloodUnit {
  id: string;
  unitNumber: string;
  product: string;
  bloodType: string;
  expiryDate: string;
  collectionDate: string | null;
  volume: number | null;
  status: string;
  donorId: string | null;
  reservedFor: string | null;
  temperature: number | null;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const;
const COMPONENTS = ['PRBC', 'FFP', 'PLT', 'CRYO', 'WHOLE_BLOOD'] as const;
const STATUS_TABS = ['ALL', 'AVAILABLE', 'RESERVED', 'ISSUED', 'EXPIRED', 'QUARANTINE'] as const;

const COMPONENT_LABELS: Record<string, { en: string; ar: string }> = {
  PRBC:        { en: 'PRBC',            ar: 'خلايا دم حمراء' },
  FFP:         { en: 'FFP',             ar: 'بلازما طازجة' },
  PLT:         { en: 'Platelets',       ar: 'صفائح دموية' },
  CRYO:        { en: 'Cryoprecipitate', ar: 'راسب البرودة' },
  WHOLE_BLOOD: { en: 'Whole Blood',     ar: 'دم كامل' },
};

const STATUS_CONFIG: Record<string, { en: string; ar: string; color: string; bg: string }> = {
  AVAILABLE:  { en: 'Available',  ar: 'متاح',           color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  RESERVED:   { en: 'Reserved',   ar: 'محجوز',           color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  ISSUED:     { en: 'Issued',     ar: 'صادر',            color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  TRANSFUSED: { en: 'Transfused', ar: 'تم نقله',         color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  EXPIRED:    { en: 'Expired',    ar: 'منتهي الصلاحية',  color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  QUARANTINE: { en: 'Quarantine', ar: 'حجر صحي',         color: 'text-red-900',    bg: 'bg-red-100 border-red-300' },
  DISCARDED:  { en: 'Discarded',  ar: 'مهمل',            color: 'text-muted-foreground',   bg: 'bg-muted/50 border-border' },
};

// Adequate >= 10, Low >= 5, Critical < 5
const LOW_THRESHOLD = 5;
const ADEQUATE_THRESHOLD = 10;

// ─── Helper Components ────────────────────────────────────────────────────────

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

function BloodTypeCard({
  bloodType,
  count,
  lang,
  tr,
}: {
  bloodType: string;
  count: number;
  lang: string;
  tr: (ar: string, en: string) => string;
}) {
  const level =
    count >= ADEQUATE_THRESHOLD
      ? 'adequate'
      : count >= LOW_THRESHOLD
      ? 'low'
      : 'critical';

  const colorMap = {
    adequate: 'bg-green-50 border-green-300 text-green-800',
    low: 'bg-yellow-50 border-yellow-300 text-yellow-800',
    critical: 'bg-red-50 border-red-300 text-red-800',
  };

  const iconMap = {
    adequate: <Droplets className="w-5 h-5 text-green-600" />,
    low: <AlertTriangle className="w-5 h-5 text-yellow-600" />,
    critical: <ShieldAlert className="w-5 h-5 text-red-600" />,
  };

  const levelLabels = {
    adequate: tr('كافٍ', 'Adequate'),
    low: tr('منخفض', 'Low'),
    critical: tr('حرج', 'Critical'),
  };

  return (
    <div className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 ${colorMap[level]}`}>
      {iconMap[level]}
      <span className="text-2xl font-black">{bloodType}</span>
      <span className="text-3xl font-bold">{count}</span>
      <span className="text-xs font-medium opacity-80">
        {tr('وحدة', 'unit')}{count !== 1 ? (lang === 'ar' ? '' : 's') : ''}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {levelLabels[level]}
      </span>
    </div>
  );
}

// ─── Visual Bar Chart ─────────────────────────────────────────────────────────

function StockBarChart({
  stockByType,
  lang,
  tr,
}: {
  stockByType: Record<string, number>;
  lang: string;
  tr: (ar: string, en: string) => string;
}) {
  const maxVal = Math.max(...Object.values(stockByType), 1);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        {tr('مستويات المخزون حسب فصيلة الدم', 'Stock Levels by Blood Type')}
      </h3>
      <div className="flex items-end gap-3 h-48">
        {BLOOD_TYPES.map((bt) => {
          const count = stockByType[bt] || 0;
          const height = maxVal > 0 ? (count / maxVal) * 100 : 0;
          const level =
            count >= ADEQUATE_THRESHOLD ? 'green' : count >= LOW_THRESHOLD ? 'yellow' : 'red';

          const barColor = {
            green: 'bg-green-500',
            yellow: 'bg-yellow-500',
            red: 'bg-red-500',
          }[level];

          return (
            <div key={bt} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-foreground">{count}</span>
              <div className="w-full flex flex-col justify-end" style={{ height: '140px' }}>
                <div
                  className={`w-full rounded-t-md ${barColor} transition-all duration-500`}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">{bt}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BloodBankInventory() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [componentTab, setComponentTab] = useState<string>('ALL');
  const [bloodTypeFilter, setBloodTypeFilter] = useState<string>('');

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusTab !== 'ALL') queryParams.set('status', statusTab);
  if (componentTab !== 'ALL') queryParams.set('component', componentTab);
  if (bloodTypeFilter) queryParams.set('bloodType', bloodTypeFilter);

  const { data, isLoading, mutate } = useSWR(
    `/api/blood-bank/inventory?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  // Fetch all available units for summaries
  const allData = useSWR('/api/blood-bank/inventory', fetcher, { refreshInterval: 15000 });
  const allUnits: BloodUnit[] = allData.data?.units || [];
  const filteredUnits: BloodUnit[] = data?.units || [];

  // Expiring soon (within 7 days)
  const expiringData = useSWR('/api/blood-bank/inventory?expiringWithinDays=7', fetcher, { refreshInterval: 15000 });
  const expiringUnits: BloodUnit[] = expiringData.data?.units || [];

  // ─── Computed Data ──────────────────────────────────────────────────────────

  const availableUnits = useMemo(
    () => allUnits.filter((u) => u.status === 'AVAILABLE'),
    [allUnits]
  );

  const stockByType = useMemo(() => {
    const map: Record<string, number> = {};
    BLOOD_TYPES.forEach((bt) => { map[bt] = 0; });
    availableUnits.forEach((u) => {
      if (map[u.bloodType] !== undefined) {
        map[u.bloodType]++;
      }
    });
    return map;
  }, [availableUnits]);

  const stockByComponent = useMemo(() => {
    const map: Record<string, number> = {};
    COMPONENTS.forEach((c) => { map[c] = 0; });
    availableUnits.forEach((u) => {
      if (map[u.product] !== undefined) {
        map[u.product]++;
      }
    });
    return map;
  }, [availableUnits]);

  const lowStockAlerts = useMemo(() => {
    return BLOOD_TYPES.filter((bt) => (stockByType[bt] || 0) < LOW_THRESHOLD);
  }, [stockByType]);

  const daysUntilExpiry = (expiryDate: string) => {
    const now = new Date();
    const exp = new Date(expiryDate);
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
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
            <Droplets className="w-7 h-7 text-red-600" />
            {tr('مخزون بنك الدم', 'Blood Bank Inventory')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('لوحة المراقبة المرئية لمخزون وحدات الدم', 'Visual monitoring dashboard for blood unit inventory')}
          </p>
        </div>
        <button
          onClick={() => { mutate(); allData.mutate(); expiringData.mutate(); }}
          className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 text-muted-foreground"
          title={tr('تحديث', 'Refresh')}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Low Stock Alerts */}
      {lowStockAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h3 className="text-sm font-semibold text-red-800">
              {tr('تنبيه: مخزون منخفض', 'Alert: Low Stock')}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockAlerts.map((bt) => (
              <span
                key={bt}
                className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold"
              >
                <TrendingDown className="w-3.5 h-3.5" />
                {bt}: {stockByType[bt]} {tr('وحدة', 'units')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Blood Type Summary Cards */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        {BLOOD_TYPES.map((bt) => (
          <BloodTypeCard
            key={bt}
            bloodType={bt}
            count={stockByType[bt] || 0}
            lang={language}
            tr={tr}
          />
        ))}
      </div>

      {/* Visual Bar Chart */}
      <StockBarChart stockByType={stockByType} lang={language} tr={tr} />

      {/* Component Breakdown Tabs */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {tr('تفصيل حسب المكون', 'Component Breakdown')}
        </h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setComponentTab('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              componentTab === 'ALL'
                ? 'bg-red-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            {tr('الكل', 'All')}
          </button>
          {COMPONENTS.map((c) => {
            const label = COMPONENT_LABELS[c];
            return (
              <button
                key={c}
                onClick={() => setComponentTab(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  componentTab === c
                    ? 'bg-red-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted'
                }`}
              >
                {language === 'ar' ? label.ar : label.en}
                <span className="ml-1 opacity-70">({stockByComponent[c] || 0})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expiring Soon Section */}
      {expiringUnits.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              {tr('وحدات تنتهي صلاحيتها قريباً (خلال 7 أيام)', 'Expiring Soon (within 7 days)')}
            </h3>
            <span className="ml-auto px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs font-bold">
              {expiringUnits.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {expiringUnits.slice(0, 9).map((unit) => {
              const days = daysUntilExpiry(unit.expiryDate);
              const urgency = days <= 2 ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100';
              return (
                <div
                  key={unit.id}
                  className="flex items-center justify-between bg-card border border-amber-200 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-xs font-bold">
                      {unit.bloodType}
                    </span>
                    <span className="text-xs text-foreground font-mono">{unit.unitNumber}</span>
                    <span className="text-xs text-muted-foreground">
                      {language === 'ar'
                        ? COMPONENT_LABELS[unit.product]?.ar || unit.product
                        : COMPONENT_LABELS[unit.product]?.en || unit.product}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${urgency}`}>
                    {days <= 0
                      ? tr('منتهي', 'Expired')
                      : days === 1
                      ? tr('يوم واحد', '1 day')
                      : `${days} ${tr('أيام', 'days')}`}
                  </span>
                </div>
              );
            })}
          </div>
          {expiringUnits.length > 9 && (
            <p className="text-xs text-amber-700 mt-2 text-center">
              {tr(
                `و ${expiringUnits.length - 9} وحدات أخرى تنتهي صلاحيتها قريباً`,
                `and ${expiringUnits.length - 9} more units expiring soon`
              )}
            </p>
          )}
        </div>
      )}

      {/* Filters Row */}
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
                : tab === 'AVAILABLE'
                ? tr('متاح', 'Available')
                : tab === 'RESERVED'
                ? tr('محجوز', 'Reserved')
                : tab === 'ISSUED'
                ? tr('صادر', 'Issued')
                : tab === 'EXPIRED'
                ? tr('منتهي الصلاحية', 'Expired')
                : tr('حجر صحي', 'Quarantine')}
            </button>
          ))}
        </div>

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
                  {tr('رقم الوحدة', 'Unit ID')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('فصيلة الدم', 'Blood Type')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('المكون', 'Component')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('تاريخ التبرع', 'Donation Date')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('تاريخ الانتهاء', 'Expiry Date')}
                </th>
                <th className="px-4 py-3 text-start font-medium text-muted-foreground">
                  {tr('الحالة', 'Status')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {tr('الحجم (مل)', 'Volume (mL)')}
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  {tr('أيام حتى الانتهاء', 'Days Until Expiry')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    {tr('جارٍ التحميل...', 'Loading...')}
                  </td>
                </tr>
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <PackageOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    {tr('لا توجد وحدات دم', 'No blood units found')}
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit) => {
                  const days = daysUntilExpiry(unit.expiryDate);
                  const isExpiringSoon = days >= 0 && days <= 7;
                  const isExpired = days < 0;
                  const compLabel = COMPONENT_LABELS[unit.product] || { en: unit.product, ar: unit.product };

                  return (
                    <tr
                      key={unit.id}
                      className={`hover:bg-muted/50 transition-colors ${
                        isExpiringSoon ? 'bg-amber-50/50' : isExpired ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-foreground font-mono text-xs font-medium">{unit.unitNumber}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-bold">
                          {unit.bloodType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {language === 'ar' ? compLabel.ar : compLabel.en}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(unit.collectionDate)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={isExpiringSoon ? 'text-amber-700 font-semibold' : isExpired ? 'text-red-700 font-semibold' : 'text-muted-foreground'}>
                          {formatDate(unit.expiryDate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={unit.status} lang={language} />
                      </td>
                      <td className="px-4 py-3 text-center text-foreground text-xs">
                        {unit.volume ? `${unit.volume} mL` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isExpired ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-red-700 bg-red-100">
                            {tr('منتهي', 'Expired')}
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              days <= 2
                                ? 'text-red-700 bg-red-100'
                                : days <= 7
                                ? 'text-amber-700 bg-amber-100'
                                : 'text-green-700 bg-green-100'
                            }`}
                          >
                            {days} {tr('يوم', 'days')}
                          </span>
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
    </div>
  );
}
