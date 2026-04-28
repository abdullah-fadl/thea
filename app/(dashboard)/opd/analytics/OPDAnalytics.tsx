'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  Calendar, Users, FileText, TrendingDown, TrendingUp,
  CheckCircle, RefreshCw, Bell, Activity, BarChart2
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

type Period = '7d' | '30d' | '90d';

interface Analytics {
  period: { from: string; to: string };
  kpis: {
    totalBookings: number;
    totalEncounters: number;
    totalPrescriptions: number;
    noShowRate: number;
    completionRate: number;
    totalReminders: number;
  };
  bookings: {
    byStatus: { status: string; count: number }[];
    byDepartment: { department: string; count: number }[];
  };
  encounters: {
    total: number;
    byType: { type: string; count: number }[];
  };
  prescriptions: {
    total: number;
    byStatus: { status: string; count: number }[];
  };
}

export default function OPDAnalytics() {
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [period, setPeriod] = useState<Period>('30d');

  const { data, isLoading, mutate } = useSWR<Analytics>(
    `/api/opd/analytics?period=${period}`,
    fetcher,
    { refreshInterval: 0 },
  );

  const periods: { value: Period; label: string }[] = [
    { value: '7d', label: tr('٧ أيام', '7 days') },
    { value: '30d', label: tr('٣٠ يوم', '30 days') },
    { value: '90d', label: tr('٩٠ يوم', '90 days') },
  ];

  const statusColor: Record<string, string> = {
    ACTIVE: 'bg-blue-500',
    COMPLETED: 'bg-green-500',
    CANCELLED: 'bg-red-400',
    NO_SHOW: 'bg-orange-400',
    CHECKED_IN: 'bg-emerald-500',
    ARRIVED: 'bg-teal-400',
    IN_PROGRESS: 'bg-indigo-400',
    PENDING_PAYMENT: 'bg-yellow-400',
  };

  const statusLabelAr: Record<string, string> = {
    ACTIVE: 'محجوز',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغي',
    NO_SHOW: 'لم يحضر',
    CHECKED_IN: 'تسجيل دخول',
    ARRIVED: 'وصل',
    IN_PROGRESS: 'قيد الفحص',
    PENDING_PAYMENT: 'بانتظار الدفع',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tr('تحليلات العيادة', 'OPD Analytics')}</h1>
            {data && (
              <p className="text-xs text-muted-foreground">
                {new Date(data.period.from).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                {' — '}
                {new Date(data.period.to).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted hover:bg-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => mutate()}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 animate-pulse">
              <div className="h-3 bg-muted rounded mb-2 w-3/4" />
              <div className="h-7 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label={tr('إجمالي الحجوزات', 'Total Bookings')} value={data.kpis.totalBookings} icon={<Calendar className="w-4 h-4" />} color="blue" />
            <KpiCard label={tr('الزيارات', 'Encounters')} value={data.kpis.totalEncounters} icon={<Users className="w-4 h-4" />} color="indigo" />
            <KpiCard label={tr('الوصفات', 'Prescriptions')} value={data.kpis.totalPrescriptions} icon={<FileText className="w-4 h-4" />} color="violet" />
            <KpiCard label={tr('نسبة الإكمال', 'Completion')} value={`${data.kpis.completionRate}%`} icon={<CheckCircle className="w-4 h-4" />} color="green" />
            <KpiCard label={tr('نسبة الغياب', 'No-Show Rate')} value={`${data.kpis.noShowRate}%`} icon={<TrendingDown className="w-4 h-4" />} color={data.kpis.noShowRate > 15 ? 'red' : 'orange'} />
            <KpiCard label={tr('التذكيرات', 'Reminders')} value={data.kpis.totalReminders} icon={<Bell className="w-4 h-4" />} color="sky" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bookings by Status */}
            <ChartCard title={tr('الحجوزات حسب الحالة', 'Bookings by Status')}>
              <div className="space-y-2.5">
                {data.bookings.byStatus
                  .sort((a, b) => b.count - a.count)
                  .map(s => {
                    const max = Math.max(...data.bookings.byStatus.map(x => x.count));
                    const pct = max > 0 ? Math.round((s.count / max) * 100) : 0;
                    return (
                      <div key={s.status}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{isRTL ? (statusLabelAr[s.status] ?? s.status) : s.status}</span>
                          <span className="text-muted-foreground">{s.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${statusColor[s.status] ?? 'bg-muted-foreground'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ChartCard>

            {/* Bookings by Department */}
            <ChartCard title={tr('الحجوزات حسب القسم', 'Bookings by Department')}>
              {data.bookings.byDepartment.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{tr('لا بيانات', 'No data')}</p>
              ) : (
                <div className="space-y-2.5">
                  {data.bookings.byDepartment.map(d => {
                    const max = Math.max(...data.bookings.byDepartment.map(x => x.count));
                    const pct = max > 0 ? Math.round((d.count / max) * 100) : 0;
                    return (
                      <div key={d.department}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium truncate max-w-[70%]">{d.department}</span>
                          <span className="text-muted-foreground">{d.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>

            {/* Encounter Types */}
            <ChartCard title={tr('أنواع الزيارات', 'Visit Types')}>
              {data.encounters.byType.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{tr('لا بيانات', 'No data')}</p>
              ) : (
                <div className="space-y-2.5">
                  {data.encounters.byType.map(t => {
                    const max = Math.max(...data.encounters.byType.map(x => x.count));
                    const pct = max > 0 ? Math.round((t.count / max) * 100) : 0;
                    return (
                      <div key={t.type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{t.type}</span>
                          <span className="text-muted-foreground">{t.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>

            {/* Prescription Status */}
            <ChartCard title={tr('حالة الوصفات', 'Prescription Status')}>
              {data.prescriptions.byStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{tr('لا بيانات', 'No data')}</p>
              ) : (
                <div className="space-y-2.5">
                  {data.prescriptions.byStatus.map(s => {
                    const max = Math.max(...data.prescriptions.byStatus.map(x => x.count));
                    const pct = max > 0 ? Math.round((s.count / max) * 100) : 0;
                    return (
                      <div key={s.status}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{s.status}</span>
                          <span className="text-muted-foreground">{s.count.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
    orange: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300',
  };

  return (
    <div className={`rounded-xl p-4 ${colors[color] ?? colors.blue}`}>
      <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1.5">{icon}{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold mb-4 text-foreground">{title}</h3>
      {children}
    </div>
  );
}
