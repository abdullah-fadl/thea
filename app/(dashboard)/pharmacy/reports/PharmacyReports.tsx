'use client';

import { useState, ReactNode } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { Clipboard, Pill, BarChart3, Banknote, CheckCircle2, AlertTriangle, XCircle, Clock, Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const RANGE_OPTIONS = [
  { value: '7', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 days' },
  { value: '30', labelAr: 'آخر 30 يوم', labelEn: 'Last 30 days' },
  { value: '90', labelAr: 'آخر 3 أشهر', labelEn: 'Last 3 months' },
  { value: '365', labelAr: 'آخر سنة', labelEn: 'Last year' },
];

const STATUS_CONFIG: Record<string, { labelAr: string; labelEn: string; color: string }> = {
  PENDING: { labelAr: 'معلقة', labelEn: 'Pending', color: 'bg-amber-100 text-amber-800' },
  VERIFIED: { labelAr: 'محقق', labelEn: 'Verified', color: 'bg-blue-100 text-blue-800' },
  DISPENSED: { labelAr: 'تم الصرف', labelEn: 'Dispensed', color: 'bg-emerald-100 text-emerald-800' },
  PICKED_UP: { labelAr: 'تم الاستلام', labelEn: 'Picked Up', color: 'bg-teal-100 text-teal-800' },
  CANCELLED: { labelAr: 'ملغي', labelEn: 'Cancelled', color: 'bg-red-100 text-red-800' },
};

export default function PharmacyReports() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [range, setRange] = useState('30');

  const { data, isLoading } = useSWR(
    `/api/pharmacy/reports?range=${range}`,
    fetcher,
    { refreshInterval: 300000 }
  );

  const summary = data?.summary || {
    totalDispensed: 0,
    totalPrescribed: 0,
    dispensingRate: 0,
    statusBreakdown: {},
  };
  const topMedications: any[] = data?.topMedications || [];
  const inventoryStats = data?.inventoryStats || {
    total: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    expired: 0,
    totalValue: 0,
  };
  const trend: { date: string; count: number }[] = data?.trend || [];
  const maxTrend = Math.max(...trend.map((t) => t.count), 1);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('تقارير الصيدلية', 'Pharmacy Reports')}
            </h1>
            <p className="text-muted-foreground">
              {tr('إحصائيات الصرف والمخزون', 'Dispensing & inventory analytics')}
            </p>
          </div>

          {/* Range selector */}
          <div className="flex gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  range === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tr(opt.labelAr, opt.labelEn)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {tr('جاري تحميل التقارير...', 'Loading reports...')}
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  icon: <Clipboard className="h-6 w-6" />,
                  label: tr('إجمالي الوصفات', 'Total Prescriptions'),
                  value: summary.totalPrescribed.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US'),
                  color: 'text-foreground',
                  bg: 'bg-card',
                },
                {
                  icon: <Pill className="h-6 w-6" />,
                  label: tr('تم صرفها', 'Dispensed'),
                  value: summary.totalDispensed.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US'),
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                },
                {
                  icon: <BarChart3 className="h-6 w-6" />,
                  label: tr('معدل الصرف', 'Dispensing Rate'),
                  value: `${summary.dispensingRate}%`,
                  color:
                    summary.dispensingRate >= 80
                      ? 'text-emerald-600'
                      : summary.dispensingRate >= 60
                      ? 'text-amber-600'
                      : 'text-red-600',
                  bg:
                    summary.dispensingRate >= 80
                      ? 'bg-emerald-50'
                      : summary.dispensingRate >= 60
                      ? 'bg-amber-50'
                      : 'bg-red-50',
                },
                {
                  icon: <Banknote className="h-6 w-6" />,
                  label: tr('قيمة المخزون', 'Inventory Value'),
                  value: `${(inventoryStats.totalValue || 0).toLocaleString(
                    language === 'ar' ? 'ar-SA' : 'en-US',
                    { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                  )} ${tr('ر.س', 'SAR')}`,
                  color: 'text-blue-600',
                  bg: 'bg-blue-50',
                },
              ].map((kpi, i) => (
                <div key={i} className={`${kpi.bg} border border-border rounded-2xl p-5`}>
                  <div className="text-2xl mb-1">{kpi.icon}</div>
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Two-column: Trend + Status Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Dispensing Trend Chart */}
              <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
                <h2 className="font-semibold text-foreground mb-4">
                  {tr('اتجاه الصرف اليومي', 'Daily Dispensing Trend')}
                </h2>
                {trend.length > 0 ? (
                  <div className="flex items-end gap-1 h-32">
                    {trend.map((point, i) => {
                      const heightPct = maxTrend > 0 ? (point.count / maxTrend) * 100 : 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1 group relative"
                        >
                          <div
                            className="w-full bg-blue-500 rounded-t-sm hover:bg-blue-600 transition-colors cursor-default"
                            style={{ height: `${Math.max(heightPct, point.count > 0 ? 4 : 0)}%` }}
                          />
                          {/* Tooltip */}
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {point.count} · {formatDate(point.date)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    {tr('لا توجد بيانات', 'No data available')}
                  </div>
                )}
                {/* X-axis labels */}
                {trend.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {trend.map((point, i) => (
                      <div
                        key={i}
                        className="flex-1 text-center text-[9px] text-muted-foreground"
                      >
                        {i === 0 || i === Math.floor(trend.length / 2) || i === trend.length - 1
                          ? formatDate(point.date)
                          : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prescription Status Breakdown */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-semibold text-foreground mb-4">
                  {tr('حالة الوصفات', 'Prescription Status')}
                </h2>
                <div className="space-y-3">
                  {Object.entries(summary.statusBreakdown).map(([status, count]) => {
                    const cfg = STATUS_CONFIG[status] || {
                      labelAr: status,
                      labelEn: status,
                      color: 'bg-muted text-foreground',
                    };
                    const total = summary.totalPrescribed || 1;
                    const pct = Math.round(((count as number) / total) * 100);
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${cfg.color}`}>
                            {tr(cfg.labelAr, cfg.labelEn)}
                          </span>
                          <span className="font-medium text-foreground">
                            {(count as number).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                            <span className="text-muted-foreground text-[11px] mr-1">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              status === 'DISPENSED' || status === 'PICKED_UP'
                                ? 'bg-emerald-500'
                                : status === 'CANCELLED'
                                ? 'bg-red-500'
                                : status === 'VERIFIED'
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(summary.statusBreakdown).length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      {tr('لا توجد بيانات', 'No data available')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Top Medications + Inventory Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Dispensed Medications */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">
                    {tr('أكثر الأدوية صرفاً', 'Top Dispensed Medications')}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr(`خلال آخر ${range} يوم`, `Last ${range} days`)}
                  </p>
                </div>
                {topMedications.length > 0 ? (
                  <div className="divide-y divide-border/50">
                    {topMedications.map((med, i) => {
                      const maxCount = topMedications[0]?.count || 1;
                      const pct = Math.round((med.count / maxCount) * 100);
                      return (
                        <div key={i} className="px-5 py-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-muted-foreground w-5 text-center">
                                {i + 1}
                              </span>
                              <div>
                                <div className="text-sm font-medium text-foreground">
                                  {language === 'ar' ? med.medicationAr || med.medication : med.medication}
                                </div>
                                {med.medicationAr && language === 'en' && (
                                  <div className="text-[11px] text-muted-foreground">{med.medicationAr}</div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-foreground">{med.count}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {tr('مرة', 'times')}
                              </div>
                            </div>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-5 py-12 text-center text-muted-foreground text-sm">
                    {tr('لا توجد وصفات مصروفة في هذه الفترة', 'No dispensed prescriptions in this period')}
                  </div>
                )}
              </div>

              {/* Inventory Health */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">
                    {tr('صحة المخزون', 'Inventory Health')}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tr('لحظي', 'Current snapshot')}
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    {
                      label: tr('متوفر', 'In Stock'),
                      value: inventoryStats.inStock,
                      total: inventoryStats.total,
                      barColor: 'bg-emerald-500',
                      icon: <CheckCircle2 className="h-4 w-4" />,
                    },
                    {
                      label: tr('مخزون منخفض', 'Low Stock'),
                      value: inventoryStats.lowStock,
                      total: inventoryStats.total,
                      barColor: 'bg-amber-500',
                      icon: <AlertTriangle className="h-4 w-4" />,
                    },
                    {
                      label: tr('نفذ', 'Out of Stock'),
                      value: inventoryStats.outOfStock,
                      total: inventoryStats.total,
                      barColor: 'bg-red-500',
                      icon: <XCircle className="h-4 w-4" />,
                    },
                    {
                      label: tr('منتهي الصلاحية', 'Expired'),
                      value: inventoryStats.expired,
                      total: inventoryStats.total,
                      barColor: 'bg-muted/500',
                      icon: <Clock className="h-4 w-4" />,
                    },
                  ].map((row, i) => {
                    const pct =
                      inventoryStats.total > 0
                        ? Math.round((row.value / inventoryStats.total) * 100)
                        : 0;
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <span>{row.icon}</span>
                            {row.label}
                          </span>
                          <span className="font-medium text-foreground">
                            {row.value.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                            <span className="text-xs text-muted-foreground mr-1">
                              / {row.total.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US')}
                            </span>
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${row.barColor} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {tr('إجمالي قيمة المخزون', 'Total Inventory Value')}
                      </span>
                      <span className="text-lg font-bold text-blue-600">
                        {(inventoryStats.totalValue || 0).toLocaleString(
                          language === 'ar' ? 'ar-SA' : 'en-US',
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                        )}{' '}
                        {tr('ر.س', 'SAR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
