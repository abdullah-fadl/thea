'use client';

import { ReactNode } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import Link from 'next/link';
import { Pill, Package, Search, Building2, AlertCircle, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

export default function PharmacyDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // Inventory stats
  const { data: invData } = useSWR('/api/pharmacy/inventory?status=ALL', fetcher, {
    refreshInterval: 60000,
  });
  const stats = invData?.stats || {
    total: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    expired: 0,
    expiringSoon: 0,
    totalValue: 0,
  };

  // Prescription queue
  const { data: pendingData } = useSWR('/api/pharmacy/prescriptions?status=PENDING', fetcher, {
    refreshInterval: 30000,
  });
  const { data: verifiedData } = useSWR('/api/pharmacy/prescriptions?status=VERIFIED', fetcher, {
    refreshInterval: 30000,
  });
  const { data: dispensedData } = useSWR('/api/pharmacy/prescriptions?status=DISPENSED', fetcher, {
    refreshInterval: 60000,
  });
  const { data: alertsData } = useSWR('/api/pharmacy/inventory/alerts', fetcher, {
    refreshInterval: 120000,
  });

  const pendingCount: number = pendingData?.total ?? pendingData?.items?.length ?? 0;
  const verifiedCount: number = verifiedData?.total ?? verifiedData?.items?.length ?? 0;
  const dispensedCount: number = dispensedData?.total ?? dispensedData?.items?.length ?? 0;
  const alerts: any[] = alertsData?.alerts || [];
  const criticalAlerts = alerts.filter((a: any) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a: any) => a.severity === 'warning');

  const quickActions = [
    {
      href: '/pharmacy/dispensing',
      icon: <Pill className="h-6 w-6 text-white" />,
      titleAr: 'صرف الأدوية',
      titleEn: 'Dispensing',
      descAr: 'صرف الوصفات الطبية',
      descEn: 'Process prescriptions',
      color: 'from-emerald-500 to-teal-600',
      badgeCount: pendingCount + verifiedCount,
    },
    {
      href: '/pharmacy/inventory',
      icon: <Package className="h-6 w-6 text-white" />,
      titleAr: 'المخزون',
      titleEn: 'Inventory',
      descAr: 'إدارة مخزون الصيدلية',
      descEn: 'Manage drug inventory',
      color: 'from-blue-500 to-indigo-600',
      badgeCount: stats.lowStock + stats.outOfStock,
    },
    {
      href: '/pharmacy/patient-lookup',
      icon: <Search className="h-6 w-6 text-white" />,
      titleAr: 'بحث عن مريض',
      titleEn: 'Patient Lookup',
      descAr: 'عرض وصفات ووصفات المريض',
      descEn: 'View patient prescriptions',
      color: 'from-purple-500 to-violet-600',
      badgeCount: 0,
    },
    {
      href: '/pharmacy/reception',
      icon: <Building2 className="h-6 w-6 text-white" />,
      titleAr: 'الاستقبال',
      titleEn: 'Reception',
      descAr: 'استقبال المرضى',
      descEn: 'Receive patients',
      color: 'from-orange-500 to-amber-600',
      badgeCount: 0,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('لوحة تحكم الصيدلية', 'Pharmacy Dashboard')}
            </h1>
            <p className="text-muted-foreground">
              {tr('نظرة عامة على الصيدلية', 'Pharmacy overview & quick actions')}
            </p>
          </div>
          <div className="text-sm text-muted-foreground bg-muted px-4 py-2 rounded-xl">
            {new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>

        {/* Critical Alerts Banner */}
        {criticalAlerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div className="flex-1">
              <div className="font-semibold text-red-800">
                {tr(
                  `${criticalAlerts.length} تنبيه حرج يحتاج اهتمام فوري`,
                  `${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? 's' : ''} need immediate attention`
                )}
              </div>
              <div className="text-sm text-red-700 mt-1 space-y-0.5">
                {criticalAlerts.slice(0, 3).map((a: any, i: number) => (
                  <div key={i}>
                    • {language === 'ar' ? (a.message?.ar || a.medicationName) : (a.message?.en || a.medicationName)}
                  </div>
                ))}
                {criticalAlerts.length > 3 && (
                  <div className="text-red-500">
                    {tr(`و ${criticalAlerts.length - 3} تنبيهات أخرى...`, `and ${criticalAlerts.length - 3} more...`)}
                  </div>
                )}
              </div>
            </div>
            <Link
              href="/pharmacy/inventory?status=OUT_OF_STOCK"
              className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 whitespace-nowrap"
            >
              {tr('عرض التفاصيل', 'View Details')}
            </Link>
          </div>
        )}

        {/* Prescription Queue Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {tr('قائمة انتظار الوصفات', 'Prescription Queue')}
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Link href="/pharmacy/dispensing">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="h-8 w-8 text-amber-600" />
                  <span className="text-4xl font-bold text-amber-700">{pendingCount}</span>
                </div>
                <div className="font-semibold text-amber-800">{tr('وصفات معلقة', 'Pending')}</div>
                <div className="text-xs text-amber-600 mt-0.5">{tr('في انتظار التحقق', 'Awaiting verification')}</div>
              </div>
            </Link>

            <Link href="/pharmacy/dispensing">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="h-8 w-8 text-blue-600" />
                  <span className="text-4xl font-bold text-blue-700">{verifiedCount}</span>
                </div>
                <div className="font-semibold text-blue-800">{tr('تم التحقق', 'Verified')}</div>
                <div className="text-xs text-blue-600 mt-0.5">{tr('جاهزة للصرف', 'Ready to dispense')}</div>
              </div>
            </Link>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-2">
                <Pill className="h-8 w-8 text-emerald-600" />
                <span className="text-4xl font-bold text-emerald-700">{dispensedCount}</span>
              </div>
              <div className="font-semibold text-emerald-800">{tr('تم الصرف اليوم', 'Dispensed Today')}</div>
              <div className="text-xs text-emerald-600 mt-0.5">{tr('وصفات مكتملة', 'Completed prescriptions')}</div>
            </div>
          </div>
        </div>

        {/* Inventory Stats */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {tr('ملخص المخزون', 'Inventory Summary')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: tr('إجمالي الأصناف', 'Total Items'), value: stats.total, color: 'text-foreground', bg: '' },
              { label: tr('متوفر', 'In Stock'), value: stats.inStock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: tr('مخزون منخفض', 'Low Stock'), value: stats.lowStock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: tr('نفذ', 'Out of Stock'), value: stats.outOfStock, color: 'text-red-600', bg: 'bg-red-50' },
              { label: tr('قارب الانتهاء', 'Expiring Soon'), value: stats.expiringSoon, color: 'text-orange-600', bg: 'bg-orange-50' },
              {
                label: tr('قيمة المخزون', 'Inventory Value'),
                value: null,
                display: `${(stats.totalValue || 0).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${tr('ر.س', 'SAR')}`,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
              },
            ].map((s, i) => (
              <Link key={i} href="/pharmacy/inventory">
                <div className={`${s.bg || 'bg-card'} border border-border rounded-2xl p-4 hover:shadow-sm transition-shadow cursor-pointer`}>
                  <div className={`text-xl font-bold ${s.color}`}>
                    {s.display ?? s.value}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {tr('الوصول السريع', 'Quick Access')}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-shadow cursor-pointer group relative">
                  {action.badgeCount > 0 && (
                    <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {action.badgeCount}
                    </span>
                  )}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform`}
                  >
                    {action.icon}
                  </div>
                  <div className="font-semibold text-foreground">
                    {tr(action.titleAr, action.titleEn)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tr(action.descAr, action.descEn)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Warning Alerts */}
        {warningAlerts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {tr('تنبيهات المخزون', 'Inventory Alerts')}
            </h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="divide-y divide-border/50">
                {warningAlerts.slice(0, 5).map((alert: any, i: number) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-xl">
                      {alert.severity === 'critical' ? <AlertCircle className="h-5 w-5 text-red-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
                    </span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {language === 'ar'
                          ? alert.medicationNameAr || alert.medicationName
                          : alert.medicationName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {language === 'ar' ? alert.message?.ar : alert.message?.en}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                        alert.severity === 'critical'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {alert.severity === 'critical'
                        ? tr('حرج', 'Critical')
                        : tr('تحذير', 'Warning')}
                    </span>
                  </div>
                ))}
                {warningAlerts.length > 5 && (
                  <div className="px-4 py-3 text-center">
                    <Link href="/pharmacy/inventory" className="text-sm text-blue-600 hover:underline">
                      {tr(`عرض جميع التنبيهات (${alerts.length})`, `View all alerts (${alerts.length})`)}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no alerts */}
        {alerts.length === 0 && stats.total > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <div>
              <div className="font-semibold text-emerald-800">
                {tr('المخزون في حالة جيدة', 'Inventory is in good condition')}
              </div>
              <div className="text-sm text-emerald-700">
                {tr('لا توجد تنبيهات حرجة أو تحذيرات نشطة', 'No critical alerts or active warnings')}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
