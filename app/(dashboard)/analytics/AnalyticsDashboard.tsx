'use client';

import { useLang } from '@/hooks/use-lang';
import useSWR from 'swr';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users, Activity, AlertTriangle, DollarSign, Stethoscope,
  FlaskConical, Radiation, TrendingUp, TrendingDown, Minus,
  ShieldAlert, Microscope, BarChart3, HeartPulse, Pill,
  Crown, Target, Clock, FileCheck, UserCheck, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import type {
  AnalyticsOpdTrendItem, AnalyticsKpiItem, AnalyticsDepartmentCount,
  AnalyticsHourlyItem, AnalyticsDepartmentRevenue, AnalyticsRegistryItem,
  AnalyticsCareGapItem, AnalyticsAbxDrugItem, AnalyticsAbxAlert,
  AnalyticsAbxMonthlyItem, AnalyticsInfectionTypeItem, AnalyticsOrganismItem,
  AnalyticsInfectionAlert, AnalyticsInfectionMonthlyItem,
  AnalyticsExecDepartmentItem, AnalyticsPeakHour, AnalyticsPeakDay,
  AnalyticsPeakMonth, AnalyticsRankingItem, AnalyticsDoctorPerf,
  AnalyticsDqDepartment, AnalyticsDqDoctor,
} from '@/lib/cvision/types';

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ── Mini bar ────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color = 'bg-blue-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: pct + '%' }} />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-end">{value}</span>
    </div>
  );
}

// ── KPI status dot ──────────────────────────────────────────────────────────
function KpiDot({ status }: { status: string }) {
  const cls = status === 'green'  ? 'bg-green-500'  :
              status === 'yellow' ? 'bg-yellow-400' :
              status === 'red'    ? 'bg-red-500'    : 'bg-muted';
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cls}`} />;
}

// ── Trend icon ───────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (trend === 'declining') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

// ── KPI score ring ───────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} stroke="#e5e7eb" strokeWidth="6" fill="none" />
      <circle
        cx="36" cy="36" r={r}
        stroke={color} strokeWidth="6" fill="none"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function AnalyticsDashboard() {
  const { language, isRTL } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  const [period, setPeriod] = useState('30');
  const [activeTab, setActiveTab] = useState('overview');

  // ── Data ──
  const { data: dash }    = useSWR(`/api/analytics/dashboard?period=${period}`,     fetcher, { refreshInterval: 120000 });
  const { data: opdD }    = useSWR(`/api/analytics/opd?days=${period}`,              fetcher, { refreshInterval: 120000 });
  const { data: finD }    = useSWR(`/api/analytics/financial?days=${period}`,        fetcher, { refreshInterval: 120000 });
  const { data: kpiD }    = useSWR(`/api/analytics/kpis?days=${period}`,             fetcher, { refreshInterval: 300000 });
  const { data: opD }     = useSWR(`/api/analytics/operational?days=${period}`,      fetcher, { refreshInterval: 120000 });
  const { data: popD }    = useSWR('/api/analytics/population',                       fetcher, { refreshInterval: 300000 });
  const { data: abxD }    = useSWR(`/api/analytics/antibiotic?days=${period}`,        fetcher, { refreshInterval: 300000 });
  const { data: infD }    = useSWR(`/api/analytics/infection?days=${period}`,         fetcher, { refreshInterval: 300000 });
  const { data: execD }   = useSWR(`/api/analytics/executive?period=${period}d`,      fetcher, { refreshInterval: 120000 });
  const { data: docPerfD }= useSWR(`/api/analytics/doctor-performance?period=${period}d`, fetcher, { refreshInterval: 120000 });
  const { data: dqD }     = useSWR(`/api/analytics/data-quality?period=${period}d`,   fetcher, { refreshInterval: 300000 });

  const trend     = (opdD?.trend || []) as AnalyticsOpdTrendItem[];
  const maxVisits = Math.max(...trend.map((t) => t.total), 1);

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
  const fmtNum = (n: number) => new Intl.NumberFormat(locale).format(n);

  const TABS = [
    { key: 'overview',    icon: <BarChart3 className="h-4 w-4" />,    ar: 'نظرة عامة',     en: 'Overview' },
    { key: 'kpis',        icon: <HeartPulse className="h-4 w-4" />,   ar: 'مؤشرات الأداء',  en: 'KPIs' },
    { key: 'operational', icon: <Activity className="h-4 w-4" />,     ar: 'التشغيلي',      en: 'Operational' },
    { key: 'financial',   icon: <DollarSign className="h-4 w-4" />,   ar: 'المالي',         en: 'Financial' },
    { key: 'population',  icon: <Users className="h-4 w-4" />,        ar: 'صحة السكان',    en: 'Population Health' },
    { key: 'antibiotic',  icon: <Pill className="h-4 w-4" />,         ar: 'إدارة المضادات', en: 'Antibiotic Stewardship' },
    { key: 'infection',   icon: <ShieldAlert className="h-4 w-4" />,  ar: 'مكافحة العدوى', en: 'Infection Surveillance' },
    { key: 'executive',   icon: <Crown className="h-4 w-4" />,       ar: 'التقرير التنفيذي', en: 'Executive' },
    { key: 'doctors',     icon: <UserCheck className="h-4 w-4" />,   ar: 'أداء الأطباء',    en: 'Doctor Performance' },
    { key: 'dataQuality', icon: <FileCheck className="h-4 w-4" />,   ar: 'جودة البيانات',   en: 'Data Quality' },
  ];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            {tr('لوحة التحليلات', 'Analytics Dashboard')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tr('مؤشرات الأداء الرئيسية والتحليلات السريرية والمالية', 'Clinical, financial and operational performance indicators')}
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[
              { v: '7',   ar: 'آخر 7 أيام',    en: 'Last 7 Days' },
              { v: '30',  ar: 'آخر 30 يومًا',   en: 'Last 30 Days' },
              { v: '60',  ar: 'آخر 60 يومًا',   en: 'Last 60 Days' },
              { v: '90',  ar: 'آخر 90 يومًا',   en: 'Last 90 Days' },
              { v: '180', ar: 'آخر 6 أشهر',     en: 'Last 6 Months' },
              { v: '365', ar: 'آخر سنة',        en: 'Last Year' },
            ].map((o) => (
              <SelectItem key={o.v} value={o.v}>{tr(o.ar, o.en)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: tr('إجمالي المرضى', 'Total Patients'),
            value: dash?.patients?.total ?? '—',
            sub:   `+${dash?.patients?.newThisPeriod ?? 0} ${tr('جديد', 'new')}`,
            subColor: 'text-green-600',
            icon: <Users className="h-5 w-5" />,
            color: 'bg-blue-50 border-blue-200 text-blue-800',
          },
          {
            label: tr('حجوزات العيادات', 'OPD Bookings'),
            value: dash?.opd?.bookings ?? '—',
            sub:   `${dash?.opd?.completionRate ?? 0}% ${tr('اكتمال', 'completion')}`,
            subColor: 'text-muted-foreground',
            icon: <Stethoscope className="h-5 w-5" />,
            color: 'bg-teal-50 border-teal-200 text-teal-800',
          },
          {
            label: tr('رقادات نشطة', 'Active IPD'),
            value: dash?.ipd?.activeAdmissions ?? '—',
            sub:   `${dash?.ipd?.dischargesThisPeriod ?? 0} ${tr('تصريح', 'discharged')}`,
            subColor: 'text-muted-foreground',
            icon: <Activity className="h-5 w-5" />,
            color: 'bg-purple-50 border-purple-200 text-purple-800',
          },
          {
            label: tr('تنبيهات حرجة', 'Critical Alerts'),
            value: dash?.alerts?.criticalLabs ?? '—',
            sub:   tr('نتائج مختبر حرجة', 'critical lab results'),
            subColor: 'text-red-500',
            icon: <AlertTriangle className="h-5 w-5" />,
            color: 'bg-red-50 border-red-200 text-red-800',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 flex flex-col gap-1 ${kpi.color}`}>
            <div className="opacity-60">{kpi.icon}</div>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-3xl font-extrabold">{typeof kpi.value === 'number' ? fmtNum(kpi.value) : kpi.value}</p>
            <p className={`text-xs ${kpi.subColor}`}>{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs navigation */}
      <div className="border-b border-border">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {tr(t.ar, t.en)}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Orders */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base">{tr('الطلبات', 'Orders')}</h3>
            {[
              { label: tr('مختبر', 'Lab'),     value: dash?.orders?.lab      ?? 0, color: 'bg-blue-500' },
              { label: tr('أشعة', 'Radiology'), value: dash?.orders?.radiology ?? 0, color: 'bg-purple-500' },
            ].map((o) => (
              <div key={o.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span>{o.label}</span>
                  <span className="font-semibold">{fmtNum(o.value)}</span>
                </div>
                <MiniBar value={o.value} max={Math.max(dash?.orders?.lab ?? 0, dash?.orders?.radiology ?? 0, 1)} color={o.color} />
              </div>
            ))}
            <div className="pt-2 border-t flex justify-between text-sm">
              <span className="text-orange-600">{tr('طلبات معلقة', 'Pending')}</span>
              <span className="font-bold text-orange-600">{dash?.orders?.pending ?? 0}</span>
            </div>
          </div>

          {/* OPD Trend (mini) */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-bold text-base mb-4">{tr('اتجاه العيادات (آخر 14 يوم)', 'OPD Trend (last 14 days)')}</h3>
            {trend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{tr('لا بيانات', 'No data')}</p>
            ) : (
              <div className="flex items-end gap-1 h-20">
                {trend.slice(-14).map((t) => {
                  const barH = maxVisits > 0 ? Math.round((t.total / maxVisits) * 100) : 0;
                  const compH = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
                  const d = new Date(t.date).toLocaleDateString(locale, { month: 'numeric', day: 'numeric' });
                  return (
                    <div key={t.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-popover border rounded-lg shadow px-2 py-1 text-[10px] whitespace-nowrap z-10 flex-col">
                        <p className="font-bold">{t.date}</p>
                        <p>{tr('إجمالي', 'Total')}: {t.total}</p>
                        <p className="text-green-600">{tr('مكتمل', 'Done')}: {t.completed}</p>
                      </div>
                      <div className="w-full flex flex-col-reverse" style={{ height: '72px' }}>
                        <div className="w-full bg-blue-100 rounded-t-sm" style={{ height: `${barH}%` }}>
                          <div className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${compH}%` }} />
                        </div>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{d}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-100 inline-block" />{tr('إجمالي', 'Total')}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />{tr('مكتمل', 'Completed')}</span>
            </div>
          </div>

          {/* Quality */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base">{tr('الجودة', 'Quality')}</h3>
            {[
              { label: tr('الحوادث المبلغ عنها', 'Reported Incidents'), value: dash?.quality?.incidents ?? 0, color: 'text-orange-600' },
              { label: tr('طلبات الزراعة', 'Transplant Cases'),         value: dash?.transplant?.total ?? 0,   color: 'text-blue-600' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
                <span className="text-sm">{item.label}</span>
                <span className={`text-xl font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Department Encounter Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base">{tr('الأقسام', 'Departments')}</h3>
            {(opD?.byDepartment || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              ((opD?.byDepartment || []) as AnalyticsDepartmentCount[]).slice(0, 7).map((d) => (
                <div key={d.department}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{d.department}</span>
                    <span className="font-semibold">{fmtNum(d.count)}</span>
                  </div>
                  <MiniBar
                    value={d.count}
                    max={Math.max(...((opD?.byDepartment || []) as AnalyticsDepartmentCount[]).map((x) => x.count), 1)}
                    color="bg-teal-500"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── KPIs TAB ─────────────────────────────────────────────────────────── */}
      {activeTab === 'kpis' && (
        <div className="space-y-6">
          {/* Score banner */}
          <div className="flex items-center gap-6 bg-card border border-border rounded-2xl p-5">
            <ScoreRing score={kpiD?.overall?.score ?? 0} />
            <div>
              <p className="text-xs text-muted-foreground font-medium">{tr('النتيجة الإجمالية', 'Overall Quality Score')}</p>
              <p className="text-3xl font-extrabold">{kpiD?.overall?.score ?? '—'}<span className="text-lg text-muted-foreground">/100</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {tr('يشمل', 'Covers')} {kpiD?.kpis?.length ?? 0} {tr('مؤشر أداء', 'KPIs')}
              </p>
            </div>
            {kpiD?.overall?.categoryScores && (
              <div className="flex flex-wrap gap-3 ms-auto">
                {Object.entries(kpiD.overall.categoryScores as Record<string, number>).map(([cat, sc]) => (
                  <div key={cat} className="text-center bg-muted/30 rounded-xl px-4 py-2 min-w-[80px]">
                    <p className="text-[10px] text-muted-foreground">{cat}</p>
                    <p className="text-lg font-bold">{sc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KPI list */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <div className="grid grid-cols-5 text-xs font-semibold text-muted-foreground">
                <span className="col-span-2">{tr('المؤشر', 'Indicator')}</span>
                <span className="text-center">{tr('القيمة الحالية', 'Current')}</span>
                <span className="text-center">{tr('الهدف', 'Target')}</span>
                <span className="text-center">{tr('الوضع', 'Status')}</span>
              </div>
            </div>
            {(kpiD?.kpis || []).length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">{tr('لا بيانات', 'No KPI data')}</div>
            ) : (
              <div className="divide-y divide-border">
                {(kpiD.kpis as AnalyticsKpiItem[]).map((kpi) => (
                  <div key={kpi.id} className="px-5 py-3 grid grid-cols-5 items-center text-sm hover:bg-muted/20 transition-colors">
                    <div className="col-span-2 flex items-center gap-2">
                      <KpiDot status={kpi.status} />
                      <div>
                        <p className="font-medium">{kpi.name}</p>
                        <p className="text-[11px] text-muted-foreground">{kpi.category}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className={`font-bold ${
                        kpi.status === 'green'  ? 'text-green-600' :
                        kpi.status === 'yellow' ? 'text-yellow-600' :
                        kpi.status === 'red'    ? 'text-red-600' : ''
                      }`}>
                        {kpi.value != null ? `${kpi.value}${kpi.unit || ''}` : '—'}
                      </span>
                    </div>
                    <div className="text-center text-muted-foreground text-xs">
                      {kpi.target != null ? `${kpi.target}${kpi.unit || ''}` : '—'}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <TrendIcon trend={kpi.trend} />
                      <span className={`text-xs capitalize ${
                        kpi.status === 'green'  ? 'text-green-600' :
                        kpi.status === 'yellow' ? 'text-yellow-600' :
                        kpi.status === 'red'    ? 'text-red-600' : 'text-muted-foreground'
                      }`}>
                        {tr(
                          kpi.status === 'green' ? 'ممتاز' : kpi.status === 'yellow' ? 'مقبول' : kpi.status === 'red' ? 'بحاجة تحسين' : '—',
                          kpi.status === 'green' ? 'Good'  : kpi.status === 'yellow' ? 'Fair'   : kpi.status === 'red' ? 'Needs Work' : '—'
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OPERATIONAL TAB ──────────────────────────────────────────────────── */}
      {activeTab === 'operational' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Summary metrics */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base">{tr('ملخص التشغيل', 'Operational Summary')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: tr('إجمالي اللقاءات', 'Total Encounters'), value: fmtNum(opD?.totalEncounters ?? 0) },
                { label: tr('معدل يومي', 'Daily Average'),           value: fmtNum(opD?.avgDailyVolume ?? 0) },
                { label: tr('اللقاءات الطارئة', 'ER Encounters'),    value: fmtNum(opD?.byType?.ER ?? 0) },
                { label: tr('لقاءات العيادات', 'OPD Encounters'),    value: fmtNum(opD?.byType?.OPD ?? 0) },
                { label: tr('الرقادات', 'IPD'),                       value: fmtNum(opD?.byType?.IPD ?? 0) },
                { label: tr('متوسط وقت الانتظار', 'Avg Wait (min)'), value: opD?.avgWaitMinutes ?? tr('غير متاح', 'N/A') },
              ].map((m) => (
                <div key={m.label} className="bg-muted/30 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Department breakdown */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base">{tr('حجم اللقاءات حسب القسم', 'Encounters by Department')}</h3>
            {(opD?.byDepartment || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              (opD.byDepartment as AnalyticsDepartmentCount[]).slice(0, 10).map((d) => (
                <div key={d.department}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{d.department}</span>
                    <span className="font-semibold">{fmtNum(d.count)}</span>
                  </div>
                  <MiniBar
                    value={d.count}
                    max={Math.max(...(opD.byDepartment as AnalyticsDepartmentCount[]).map((x) => x.count), 1)}
                    color="bg-teal-500"
                  />
                </div>
              ))
            )}
          </div>

          {/* Hourly distribution */}
          <div className="bg-card border border-border rounded-2xl p-5 md:col-span-2">
            <h3 className="font-bold text-base mb-4">{tr('التوزيع بالساعة', 'Hourly Distribution')}</h3>
            {(opD?.hourlyDistribution || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              <div className="flex items-end gap-1 h-28">
                {(opD.hourlyDistribution as AnalyticsHourlyItem[]).map((h) => {
                  const maxH = Math.max(...(opD.hourlyDistribution as AnalyticsHourlyItem[]).map((x) => x.count), 1);
                  const pct  = Math.round((h.count / maxH) * 100);
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border rounded-lg shadow px-2 py-1 text-[10px] z-10 whitespace-nowrap">
                        {h.hour}:00 — {h.count}
                      </div>
                      <div className="w-full bg-blue-400 rounded-t-sm" style={{ height: `${Math.max(pct, 2)}%`, maxHeight: '104px' }} />
                      {h.hour % 4 === 0 && (
                        <span className="text-[9px] text-muted-foreground">{h.hour}h</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FINANCIAL TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'financial' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: tr('إجمالي الفواتير', 'Total Billed'),     value: finD ? fmt(finD.totalBilled)     : '—', color: 'bg-blue-50 border-blue-200 text-blue-800' },
            { label: tr('إجمالي المحصل', 'Total Collected'),    value: finD ? fmt(finD.totalCollected)  : '—', color: 'bg-green-50 border-green-200 text-green-800' },
            { label: tr('معدل التحصيل', 'Collection Rate'),     value: finD ? `${finD.collectionRate}%` : '—', color: 'bg-teal-50 border-teal-200 text-teal-800' },
            { label: tr('الرسوم المعلقة', 'Outstanding'),        value: finD ? fmt(finD.totalBilled - finD.totalCollected) : '—', color: 'bg-orange-50 border-orange-200 text-orange-800' },
          ].map((card) => (
            <div key={card.label} className={`rounded-2xl border p-5 ${card.color}`}>
              <p className="text-xs font-medium opacity-70">{card.label}</p>
              <p className="text-2xl font-extrabold mt-1">{card.value}</p>
            </div>
          ))}

          {finD?.byMethod && Object.keys(finD.byMethod).length > 0 && (
            <div className="md:col-span-3 bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base">{tr('توزيع طرق الدفع', 'Payment Method Breakdown')}</h3>
              {Object.entries(finD.byMethod as Record<string, number>)
                .sort(([, a], [, b]) => b - a)
                .map(([method, amount]) => (
                  <div key={method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{method}</span>
                      <span className="font-semibold">{fmt(amount)}</span>
                    </div>
                    <MiniBar
                      value={amount}
                      max={Math.max(...Object.values(finD.byMethod as Record<string, number>), 1)}
                      color="bg-green-500"
                    />
                  </div>
                ))}
            </div>
          )}

          {finD?.byDepartment && (finD.byDepartment as AnalyticsDepartmentRevenue[]).length > 0 && (
            <div className="md:col-span-3 bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base">{tr('الإيرادات حسب القسم', 'Revenue by Department')}</h3>
              {(finD.byDepartment as AnalyticsDepartmentRevenue[]).slice(0, 8).map((d) => (
                <div key={d.department}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{d.department}</span>
                    <span className="font-semibold">{fmt(d.revenue ?? d.amount ?? 0)}</span>
                  </div>
                  <MiniBar
                    value={d.revenue ?? d.amount ?? 0}
                    max={Math.max(...(finD.byDepartment as AnalyticsDepartmentRevenue[]).map((x) => x.revenue ?? x.amount ?? 0), 1)}
                    color="bg-blue-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── POPULATION HEALTH TAB ────────────────────────────────────────────── */}
      {activeTab === 'population' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Risk distribution */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base">{tr('توزيع الخطر', 'Risk Stratification')}</h3>
            {[
              { key: 'critical', ar: 'حرج',      en: 'Critical',  color: 'bg-red-500' },
              { key: 'high',     ar: 'مرتفع',     en: 'High',      color: 'bg-orange-500' },
              { key: 'moderate', ar: 'متوسط',     en: 'Moderate',  color: 'bg-yellow-500' },
              { key: 'low',      ar: 'منخفض',     en: 'Low',       color: 'bg-green-500' },
            ].map((r) => {
              const count = popD?.riskDistribution?.[r.key] ?? 0;
              const total = Object.values(popD?.riskDistribution || {}).reduce((a: number, b: number) => a + b, 0) || 1;
              return (
                <div key={r.key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${r.color} inline-block`} />
                      {tr(r.ar, r.en)}
                    </span>
                    <span className="font-semibold">{fmtNum(count)} <span className="text-muted-foreground font-normal">({Math.round((count / (total as number)) * 100)}%)</span></span>
                  </div>
                  <MiniBar value={count} max={total as number} color={r.color} />
                </div>
              );
            })}
          </div>

          {/* Disease Registries */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base">{tr('سجلات الأمراض المزمنة', 'Disease Registries')}</h3>
            {(popD?.registries || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              (popD.registries as AnalyticsRegistryItem[]).map((reg) => (
                <div key={reg.name} className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{reg.name}</p>
                    {reg.controlRate != null && (
                      <p className="text-xs text-muted-foreground">{tr('معدل التحكم', 'Control rate')}: {reg.controlRate}%</p>
                    )}
                  </div>
                  <span className="text-xl font-bold">{fmtNum(reg.count)}</span>
                </div>
              ))
            )}
          </div>

          {/* Care Gaps */}
          <div className="bg-card border border-border rounded-2xl p-5 md:col-span-2 space-y-3">
            <h3 className="font-bold text-base">{tr('فجوات الرعاية الوقائية', 'Care Gaps')}</h3>
            {(popD?.careGapSummary || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(popD.careGapSummary as AnalyticsCareGapItem[]).map((gap) => (
                  <div key={gap.gapType} className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-orange-700">{gap.gapType?.replace(/_/g, ' ')}</p>
                    <p className="text-2xl font-bold text-orange-800 mt-0.5">{fmtNum(gap.count)}</p>
                    <p className="text-[11px] text-orange-600">{tr('مريض بحاجة لمتابعة', 'patients need follow-up')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANTIBIOTIC STEWARDSHIP TAB ────────────────────────────────────────── */}
      {activeTab === 'antibiotic' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Summary metrics */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Pill className="h-4 w-4 text-teal-600" />
              {tr('ملخص إدارة المضادات الحيوية', 'Stewardship Summary')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: tr('الاستخدام الموجه بالمزرعة', 'Culture-Guided Rate'), value: `${abxD?.cultureGuidedRate ?? 0}%`, color: 'text-green-600' },
                { label: tr('معدل التخفيف', 'De-escalation Rate'),               value: `${abxD?.deEscalationRate ?? 0}%`,  color: 'text-blue-600' },
                { label: tr('تحويل IV→PO', 'IV→Oral Conversion'),               value: `${abxD?.ivToOralRate ?? 0}%`,      color: 'text-purple-600' },
                { label: tr('إجمالي الدورات', 'Total Courses'),                   value: fmtNum(abxD?.totalCourses ?? 0),    color: '' },
              ].map((m) => (
                <div key={m.label} className="bg-muted/30 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top drugs */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base">{tr('أكثر المضادات استخداماً', 'Top Antibiotics')}</h3>
            {(abxD?.topDrugs || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              (abxD.topDrugs as AnalyticsAbxDrugItem[]).slice(0, 8).map((d) => (
                <div key={d.drug}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{d.drug}</span>
                    <span className="text-xs text-muted-foreground">{d.count} {tr('دورة', 'courses')} · {d.ddd?.toFixed(1) ?? '—'} DDD</span>
                  </div>
                  <MiniBar
                    value={d.count}
                    max={Math.max(...(abxD.topDrugs as AnalyticsAbxDrugItem[]).map((x) => x.count), 1)}
                    color="bg-teal-500"
                  />
                </div>
              ))
            )}
          </div>

          {/* Stewardship alerts */}
          {(abxD?.alerts || []).length > 0 && (
            <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                {tr('تنبيهات الإدارة', 'Stewardship Alerts')}
              </h3>
              <div className="space-y-2">
                {(abxD.alerts as AnalyticsAbxAlert[]).map((alert, i) => (
                  <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                    alert.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                    alert.severity === 'warning'  ? 'bg-orange-50 border-orange-200 text-orange-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-sm">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly DDD trend */}
          {(abxD?.monthlyTrend || []).length > 0 && (
            <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">{tr('اتجاه الاستخدام الشهري (DDD)', 'Monthly Usage Trend (DDD)')}</h3>
              <div className="flex items-end gap-2 h-28">
                {(abxD.monthlyTrend as AnalyticsAbxMonthlyItem[]).map((m) => {
                  const maxDDD = Math.max(...(abxD.monthlyTrend as AnalyticsAbxMonthlyItem[]).map((x) => x.totalDDD), 1);
                  const pct = Math.round((m.totalDDD / maxDDD) * 100);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border rounded-lg shadow px-2 py-1 text-[10px] z-10 whitespace-nowrap">
                        {m.month}: {m.totalDDD?.toFixed(1)} DDD
                      </div>
                      <div className="w-full bg-teal-400 rounded-t-sm" style={{ height: `${Math.max(pct, 2)}%`, maxHeight: '112px' }} />
                      <span className="text-[9px] text-muted-foreground">{m.month?.slice(-2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INFECTION SURVEILLANCE TAB ────────────────────────────────────────── */}
      {activeTab === 'infection' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Summary */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              {tr('ملخص المراقبة', 'Surveillance Summary')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: tr('إجمالي HAIs', 'Total HAIs'),           value: fmtNum(infD?.totalHAIs ?? 0) },
                { label: tr('معدل HAI (×1000)', 'HAI Rate /1000'),  value: `${infD?.haiRatePer1000 ?? '0.0'}` },
                { label: tr('أنواع عدوى مختلفة', 'Unique Types'),   value: fmtNum(infD?.byType?.length ?? 0) },
                { label: tr('التنبيهات', 'Active Alerts'),           value: fmtNum(infD?.alerts?.length ?? 0) },
              ].map((m) => (
                <div key={m.label} className="bg-muted/30 rounded-xl px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* By type */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base">{tr('حسب نوع العدوى', 'By Infection Type')}</h3>
            {(infD?.byType || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              (infD.byType as AnalyticsInfectionTypeItem[]).map((t) => (
                <div key={t.type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{t.type}</span>
                    <span className="text-xs text-muted-foreground">{t.count} {tr('حالة', 'cases')}</span>
                  </div>
                  <MiniBar
                    value={t.count}
                    max={Math.max(...(infD.byType as AnalyticsInfectionTypeItem[]).map((x) => x.count), 1)}
                    color="bg-red-400"
                  />
                </div>
              ))
            )}
          </div>

          {/* By organism */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h3 className="font-bold text-base">{tr('أكثر الكائنات شيوعاً', 'Top Organisms')}</h3>
            {(infD?.byOrganism || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
            ) : (
              (infD.byOrganism as AnalyticsOrganismItem[]).slice(0, 6).map((o) => (
                <div key={o.organism}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{o.organism}</span>
                    <span className="font-semibold">{o.count}</span>
                  </div>
                  <MiniBar
                    value={o.count}
                    max={Math.max(...(infD.byOrganism as AnalyticsOrganismItem[]).map((x) => x.count), 1)}
                    color="bg-orange-400"
                  />
                </div>
              ))
            )}
          </div>

          {/* Outbreak alerts */}
          {(infD?.alerts || []).length > 0 && (
            <div className="bg-card border border-red-200 rounded-2xl p-5 space-y-2">
              <h3 className="font-bold text-base text-red-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {tr('تنبيهات التفشي', 'Outbreak Alerts')}
              </h3>
              {(infD.alerts as AnalyticsInfectionAlert[]).map((a, i) => (
                <div key={i} className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
                  a.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-orange-50 border-orange-200 text-orange-800'
                }`}>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="text-sm">{a.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Monthly trend */}
          {(infD?.monthlyTrend || []).length > 0 && (
            <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">{tr('الاتجاه الشهري', 'Monthly HAI Trend')}</h3>
              <div className="flex items-end gap-2 h-28">
                {(infD.monthlyTrend as AnalyticsInfectionMonthlyItem[]).map((m) => {
                  const maxC = Math.max(...(infD.monthlyTrend as AnalyticsInfectionMonthlyItem[]).map((x) => x.count), 1);
                  const pct  = Math.round((m.count / maxC) * 100);
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border rounded-lg shadow px-2 py-1 text-[10px] z-10 whitespace-nowrap">
                        {m.month}: {m.count}
                      </div>
                      <div className="w-full bg-red-400 rounded-t-sm" style={{ height: `${Math.max(pct, 2)}%`, maxHeight: '112px' }} />
                      <span className="text-[9px] text-muted-foreground">{m.month?.slice(-2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXECUTIVE TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'executive' && (
        <div className="space-y-6">

          {/* Growth KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: tr('حجم المرضى اليومي', 'Avg Daily Volume'),
                value: execD?.summary?.avgDailyVolume ?? '—',
                sub: (() => {
                  const g = execD?.summary?.growthWoW;
                  return g != null ? `${g >= 0 ? '+' : ''}${g}% ${tr('أسبوعي', 'WoW')}` : '';
                })(),
                subColor: (execD?.summary?.growthWoW ?? 0) >= 0 ? 'text-green-600' : 'text-red-500',
                icon: <TrendingUp className="h-5 w-5" />,
                color: 'bg-indigo-50 border-indigo-200 text-indigo-800',
              },
              {
                label: tr('النمو الشهري', 'Growth MoM'),
                value: execD?.summary?.growthMoM != null ? `${execD.summary.growthMoM >= 0 ? '+' : ''}${execD.summary.growthMoM}%` : '—',
                sub: tr('مقارنة بالشهر السابق', 'vs previous month'),
                subColor: 'text-muted-foreground',
                icon: (execD?.summary?.growthMoM ?? 0) >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />,
                color: (execD?.summary?.growthMoM ?? 0) >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800',
              },
              {
                label: tr('النمو السنوي', 'Growth YoY'),
                value: execD?.summary?.growthYoY != null ? `${execD.summary.growthYoY >= 0 ? '+' : ''}${execD.summary.growthYoY}%` : '—',
                sub: tr('مقارنة بالسنة السابقة', 'vs previous year'),
                subColor: 'text-muted-foreground',
                icon: (execD?.summary?.growthYoY ?? 0) >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />,
                color: (execD?.summary?.growthYoY ?? 0) >= 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800',
              },
              {
                label: tr('إجمالي المرضى', 'Total Patients (All-Time)'),
                value: fmtNum(execD?.summary?.totalPatients ?? 0),
                sub: '',
                subColor: 'text-muted-foreground',
                icon: <Users className="h-5 w-5" />,
                color: 'bg-blue-50 border-blue-200 text-blue-800',
              },
            ].map((kpi) => (
              <div key={kpi.label} className={`rounded-2xl border p-4 flex flex-col gap-1 ${kpi.color}`}>
                <div className="opacity-60">{kpi.icon}</div>
                <p className="text-xs font-medium opacity-70">{kpi.label}</p>
                <p className="text-2xl font-extrabold">{kpi.value}</p>
                {kpi.sub && <p className={`text-xs ${kpi.subColor}`}>{kpi.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Hourly distribution */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">{tr('التوزيع بالساعة', 'Hourly Distribution')}</h3>
              {(execD?.trends?.hourly || []).length > 0 ? (
                <div className="flex items-end gap-0.5 h-28">
                  {(execD.trends.hourly as Array<{hour: number; count: number}>).map((h) => {
                    const maxH = Math.max(...(execD.trends.hourly as Array<{hour: number; count: number}>).map((x) => x.count), 1);
                    const barPct = Math.round((h.count / maxH) * 100);
                    const isPeak = execD?.peaks?.peakHours?.some((p: AnalyticsPeakHour) => p.hour === h.hour);
                    return (
                      <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border rounded-lg shadow px-2 py-1 text-[10px] z-10 whitespace-nowrap">
                          {h.hour}:00 — {h.count} {tr('لقاء', 'enc.')}
                        </div>
                        <div
                          className={`w-full rounded-t-sm ${isPeak ? 'bg-orange-500' : 'bg-indigo-400'}`}
                          style={{ height: `${Math.max(barPct, 2)}%`, maxHeight: '112px' }}
                        />
                        {h.hour % 4 === 0 && <span className="text-[9px] text-muted-foreground">{h.hour}h</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{tr('لا بيانات', 'No data')}</p>
              )}
              <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-400 inline-block" />{tr('عادي', 'Normal')}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500 inline-block" />{tr('ساعة ذروة', 'Peak Hour')}</span>
              </div>
            </div>

            {/* Peak Analysis */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-base">{tr('تحليل الذروة', 'Peak Analysis')}</h3>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{tr('ساعات الذروة', 'Peak Hours')}</p>
                <div className="flex gap-2">
                  {((execD?.peaks?.peakHours || []) as AnalyticsPeakHour[]).map((p, i) => (
                    <div key={i} className="flex-1 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-center">
                      <p className="text-lg font-bold text-orange-800">{p.label}</p>
                      <p className="text-[10px] text-orange-600">{fmtNum(p.count)} {tr('لقاء', 'enc.')}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{tr('أيام الذروة', 'Peak Days')}</p>
                <div className="flex gap-2">
                  {((execD?.peaks?.peakDays || []) as AnalyticsPeakDay[]).map((p, i) => (
                    <div key={i} className="flex-1 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-center">
                      <p className="text-sm font-bold text-blue-800">{p.dayName}</p>
                      <p className="text-[10px] text-blue-600">{tr('متوسط', 'avg')} {p.avgCount}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{tr('أشهر الذروة', 'Peak Months')}</p>
                <div className="flex gap-2">
                  {((execD?.peaks?.peakMonths || []) as AnalyticsPeakMonth[]).map((p, i) => (
                    <div key={i} className="flex-1 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-center">
                      <p className="text-sm font-bold text-purple-800">{p.monthName}</p>
                      <p className="text-[10px] text-purple-600">{tr('متوسط', 'avg')} {p.avgCount}</p>
                    </div>
                  ))}
                </div>
              </div>

              {execD?.peaks?.busiestDayEver && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-700">{tr('أكثر يوم ازدحامًا على الإطلاق', 'Busiest Day Ever')}</p>
                    <p className="text-sm text-amber-900">{execD.peaks.busiestDayEver.date}</p>
                  </div>
                  <p className="text-2xl font-extrabold text-amber-800">{fmtNum(execD.peaks.busiestDayEver.count)}</p>
                </div>
              )}
            </div>

            {/* Source breakdown */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base">{tr('توزيع المصدر', 'Source Breakdown')}</h3>
              {(() => {
                const src = execD?.breakdown?.bySource;
                if (!src) return <p className="text-sm text-muted-foreground">{tr('لا بيانات', 'No data')}</p>;
                const total = (src.walkIn || 0) + (src.booked || 0) + (src.emergency || 0) || 1;
                return [
                  { label: tr('حجز مسبق', 'Booked'), value: src.booked || 0, color: 'bg-blue-500' },
                  { label: tr('حضور مباشر', 'Walk-in'), value: src.walkIn || 0, color: 'bg-teal-500' },
                  { label: tr('طوارئ', 'Emergency'), value: src.emergency || 0, color: 'bg-red-500' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{item.label}</span>
                      <span className="font-semibold">{fmtNum(item.value)} <span className="text-muted-foreground text-xs">({Math.round((item.value / total) * 100)}%)</span></span>
                    </div>
                    <MiniBar value={item.value} max={total} color={item.color} />
                  </div>
                ));
              })()}
            </div>

            {/* Patient type + payment type */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-base">{tr('توزيع المرضى', 'Patient Distribution')}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-[11px] text-green-700 font-medium">{tr('مريض جديد', 'New Patients')}</p>
                  <p className="text-xl font-bold text-green-800">{fmtNum(execD?.breakdown?.byPatientType?.newPatients ?? 0)}</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-[11px] text-blue-700 font-medium">{tr('مراجعة', 'Follow-up')}</p>
                  <p className="text-xl font-bold text-blue-800">{fmtNum(execD?.breakdown?.byPatientType?.followUp ?? 0)}</p>
                </div>
                <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-[11px] text-teal-700 font-medium">{tr('نقدي', 'Cash')}</p>
                  <p className="text-xl font-bold text-teal-800">{fmtNum(execD?.breakdown?.byPaymentType?.cash ?? 0)}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 text-center">
                  <p className="text-[11px] text-purple-700 font-medium">{tr('تأمين', 'Insured')}</p>
                  <p className="text-xl font-bold text-purple-800">{fmtNum(execD?.breakdown?.byPaymentType?.insured ?? 0)}</p>
                </div>
              </div>
            </div>

            {/* Daily trend chart (full-width) */}
            <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5">
              <h3 className="font-bold text-base mb-4">{tr('الاتجاه اليومي', 'Daily Volume Trend')}</h3>
              {(execD?.trends?.daily || []).length > 0 ? (
                <div className="flex items-end gap-0.5 h-28">
                  {(execD.trends.daily as Array<{date: string; count: number}>).slice(-60).map((d) => {
                    const maxD = Math.max(...(execD.trends.daily as Array<{date: string; count: number}>).map((x) => x.count), 1);
                    const barPct = Math.round((d.count / maxD) * 100);
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-0 group relative min-w-0">
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border rounded-lg shadow px-2 py-1 text-[10px] z-10 whitespace-nowrap">
                          {d.date}: {d.count}
                        </div>
                        <div className="w-full bg-indigo-500 rounded-t-sm" style={{ height: `${Math.max(barPct, 1)}%`, maxHeight: '112px' }} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{tr('لا بيانات', 'No data')}</p>
              )}
            </div>

            {/* Department breakdown */}
            <div className="md:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base">{tr('الأقسام الأكثر ازدحامًا', 'Top Departments')}</h3>
              {(execD?.breakdown?.byDepartment || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(execD.breakdown.byDepartment as Array<{departmentId: string; name: string; count: number}>).map((d) => (
                    <div key={d.departmentId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{d.name}</span>
                        <span className="font-semibold">{fmtNum(d.count)}</span>
                      </div>
                      <MiniBar
                        value={d.count}
                        max={Math.max(...(execD.breakdown.byDepartment as AnalyticsExecDepartmentItem[]).map((x) => x.count), 1)}
                        color="bg-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DOCTOR PERFORMANCE TAB ─────────────────────────────────────────── */}
      {activeTab === 'doctors' && (
        <div className="space-y-6">

          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-800">
              <p className="text-xs font-medium opacity-70">{tr('عدد الأطباء', 'Total Doctors')}</p>
              <p className="text-3xl font-extrabold">{docPerfD?.totalDoctors ?? '—'}</p>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-teal-800">
              <p className="text-xs font-medium opacity-70">{tr('إجمالي المرضى', 'Total Patients')}</p>
              <p className="text-3xl font-extrabold">{fmtNum(docPerfD?.departmentTotalPatients ?? 0)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-green-800">
              <p className="text-xs font-medium opacity-70">{tr('هذا الأسبوع', 'This Week')}</p>
              <p className="text-3xl font-extrabold">{fmtNum(docPerfD?.weeklyComparison?.thisWeek ?? 0)}</p>
              <p className="text-xs text-green-600">
                {(() => {
                  const c = docPerfD?.weeklyComparison?.changePct;
                  return c != null ? `${c >= 0 ? '+' : ''}${c}%` : '';
                })()}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-purple-800">
              <p className="text-xs font-medium opacity-70">{tr('الأسبوع الماضي', 'Last Week')}</p>
              <p className="text-3xl font-extrabold">{fmtNum(docPerfD?.weeklyComparison?.lastWeek ?? 0)}</p>
            </div>
          </div>

          {/* Rankings row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: tr('الأعلى حجمًا', 'Top by Volume'), data: docPerfD?.rankings?.byVolume || [], valueKey: 'count', unit: '' },
              { title: tr('الأعلى استخدامًا', 'Top by Utilization'), data: docPerfD?.rankings?.byUtilization || [], valueKey: 'pct', unit: '%' },
              { title: tr('الأعلى توثيقًا', 'Top by Documentation'), data: docPerfD?.rankings?.byDocumentation || [], valueKey: 'pct', unit: '%' },
            ].map((rank) => (
              <div key={rank.title} className="bg-card border border-border rounded-2xl p-5 space-y-2">
                <h3 className="font-bold text-sm">{rank.title}</h3>
                {(rank.data as AnalyticsRankingItem[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
                ) : (
                  (rank.data as AnalyticsRankingItem[]).slice(0, 5).map((d, i) => (
                    <div key={d.doctorId} className="flex items-center gap-2 text-sm">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'
                      }`}>{i + 1}</span>
                      <span className="flex-1 truncate">{d.name}</span>
                      <span className="font-semibold">{d[rank.valueKey]}{rank.unit}</span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>

          {/* Doctor table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/30">
              <div className="grid grid-cols-7 text-xs font-semibold text-muted-foreground">
                <span className="col-span-2">{tr('الطبيب', 'Doctor')}</span>
                <span className="text-center">{tr('المرضى', 'Patients')}</span>
                <span className="text-center">{tr('الهدف', 'Target')}</span>
                <span className="text-center">{tr('الاستخدام', 'Utilization')}</span>
                <span className="text-center">{tr('حصة السينسس', 'Census Share')}</span>
                <span className="text-center">{tr('التوثيق', 'Documentation')}</span>
              </div>
            </div>
            {(docPerfD?.doctors || []).length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">{tr('لا بيانات', 'No doctor data')}</div>
            ) : (
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {(docPerfD.doctors as AnalyticsDoctorPerf[]).map((doc) => {
                  const util = doc.utilization?.utilizationPct ?? 0;
                  const utilColor = util >= 80 ? 'text-green-600' : util >= 50 ? 'text-yellow-600' : 'text-red-600';
                  const docPct = doc.productivity?.documentationPct ?? 0;
                  const docColor = docPct >= 80 ? 'text-green-600' : docPct >= 50 ? 'text-yellow-600' : 'text-red-600';
                  return (
                    <div key={doc.doctorId} className="px-5 py-3 grid grid-cols-7 items-center text-sm hover:bg-muted/20 transition-colors">
                      <div className="col-span-2">
                        <p className="font-medium truncate">{doc.name}</p>
                        <p className="text-[11px] text-muted-foreground">{doc.specialty}</p>
                      </div>
                      <div className="text-center">
                        <span className="font-bold">{doc.metrics?.totalPatients ?? 0}</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {doc.metrics?.completionRate ?? 0}% {tr('اكتمال', 'done')}
                        </span>
                      </div>
                      <div className="text-center text-muted-foreground">
                        {doc.utilization?.target ?? '—'}/{tr('يوم', 'day')}
                      </div>
                      <div className="text-center">
                        <span className={`font-bold ${utilColor}`}>{util}%</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {doc.utilization?.avgDaily ?? 0}/{tr('يوم', 'day')}
                        </span>
                      </div>
                      <div className="text-center font-semibold">
                        {doc.utilization?.censusSharePct ?? 0}%
                      </div>
                      <div className="text-center">
                        <span className={`font-bold ${docColor}`}>{docPct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DATA QUALITY TAB ───────────────────────────────────────────────── */}
      {activeTab === 'dataQuality' && (
        <div className="space-y-6">

          {/* Score banner */}
          <div className="flex items-center gap-6 bg-card border border-border rounded-2xl p-5">
            <ScoreRing score={dqD?.overallScore ?? 0} />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium">{tr('نتيجة جودة البيانات', 'Data Quality Score')}</p>
              <p className="text-3xl font-extrabold">
                {dqD?.overallScore ?? '—'}<span className="text-lg text-muted-foreground">/100</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <KpiDot status={dqD?.overallStatus ?? 'gray'} />
                <span className="text-xs text-muted-foreground">
                  {tr(
                    dqD?.overallStatus === 'green' ? 'ممتاز' : dqD?.overallStatus === 'yellow' ? 'مقبول' : 'بحاجة تحسين',
                    dqD?.overallStatus === 'green' ? 'Excellent' : dqD?.overallStatus === 'yellow' ? 'Acceptable' : 'Needs Improvement'
                  )}
                </span>
                {dqD?.prevScore != null && (
                  <span className={`text-xs ${dqD.overallScore >= dqD.prevScore ? 'text-green-600' : 'text-red-500'}`}>
                    ({dqD.overallScore >= dqD.prevScore ? '+' : ''}{dqD.overallScore - dqD.prevScore} {tr('عن السابق', 'from prev.')})
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-center bg-muted/30 rounded-xl px-4 py-2 min-w-[80px]">
                <p className="text-[10px] text-muted-foreground">{tr('لقاءات', 'Encounters')}</p>
                <p className="text-lg font-bold">{fmtNum(dqD?.totalEncounters ?? 0)}</p>
              </div>
              <div className="text-center bg-muted/30 rounded-xl px-4 py-2 min-w-[80px]">
                <p className="text-[10px] text-muted-foreground">{tr('مرضى', 'Patients')}</p>
                <p className="text-lg font-bold">{fmtNum(dqD?.totalPatientsSeen ?? 0)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Documentation KPIs */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-blue-600" />
                {tr('اكتمال التوثيق', 'Documentation Completeness')}
              </h3>
              {[
                { label: tr('العلامات الحيوية الناقصة', 'Missing Vitals'), value: dqD?.kpis?.documentation?.missingVitalsPct ?? 0 },
                { label: tr('الملاحظات الناقصة', 'Missing Notes'), value: dqD?.kpis?.documentation?.missingNotesPct ?? 0 },
                { label: tr('التشخيص الناقص', 'Missing Diagnosis'), value: dqD?.kpis?.documentation?.missingDiagnosisPct ?? 0 },
                { label: tr('الفحص البدني الناقص', 'Missing Physical Exam'), value: dqD?.kpis?.documentation?.missingPhysicalExamPct ?? 0 },
                { label: tr('فحص الحساسية الناقص', 'Missing Allergy Check'), value: dqD?.kpis?.documentation?.missingAllergyCheckPct ?? 0 },
              ].map((kpi) => {
                const color = kpi.value <= 10 ? 'text-green-600' : kpi.value <= 30 ? 'text-yellow-600' : 'text-red-600';
                const barColor = kpi.value <= 10 ? 'bg-green-500' : kpi.value <= 30 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div key={kpi.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{kpi.label}</span>
                      <span className={`font-bold ${color}`}>{kpi.value}%</span>
                    </div>
                    <MiniBar value={100 - kpi.value} max={100} color={barColor} />
                  </div>
                );
              })}
            </div>

            {/* Timeliness KPIs */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-600" />
                {tr('مؤشرات الوقت', 'Timeliness KPIs')}
              </h3>
              {[
                { label: tr('وقت أخذ العلامات الحيوية', 'Time to Vitals'), value: dqD?.kpis?.timeliness?.avgTimeToVitals, target: 5, unit: tr('دقيقة', 'min') },
                { label: tr('وقت الوصول للطبيب', 'Time to Doctor'), value: dqD?.kpis?.timeliness?.avgTimeToDoctor, target: 15, unit: tr('دقيقة', 'min') },
                { label: tr('وقت أول طلب', 'Time to First Order'), value: dqD?.kpis?.timeliness?.avgTimeToFirstOrder, target: 20, unit: tr('دقيقة', 'min') },
              ].map((kpi) => {
                const val = kpi.value ?? 0;
                const pctVal = kpi.target > 0 ? Math.min(100, Math.round((val / kpi.target) * 100)) : 0;
                const color = val <= kpi.target ? 'text-green-600' : val <= kpi.target * 2 ? 'text-yellow-600' : 'text-red-600';
                return (
                  <div key={kpi.label} className="bg-muted/30 rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{kpi.label}</p>
                      <p className="text-[11px] text-muted-foreground">{tr('الهدف', 'Target')}: {kpi.target} {kpi.unit}</p>
                    </div>
                    <div className="text-end">
                      <p className={`text-xl font-bold ${color}`}>{val > 0 ? val.toFixed(1) : '—'}</p>
                      <p className="text-[10px] text-muted-foreground">{kpi.unit}</p>
                    </div>
                  </div>
                );
              })}

              <div className="pt-3 border-t space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">{tr('حالة الطلبات', 'Order Tracking')}</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-2 py-2 text-center">
                    <p className="text-[10px] text-orange-700">{tr('طلبات متأخرة', 'Overdue')}</p>
                    <p className="text-lg font-bold text-orange-800">{dqD?.kpis?.orders?.pendingOverduePct ?? 0}%</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-2 py-2 text-center">
                    <p className="text-[10px] text-blue-700">{tr('نتائج بدون تأكيد', 'Unacked Results')}</p>
                    <p className="text-lg font-bold text-blue-800">{dqD?.kpis?.orders?.unackedResultsPct ?? 0}%</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl px-2 py-2 text-center">
                    <p className="text-[10px] text-red-700">{tr('حرجة بدون تأكيد', 'Critical Unacked')}</p>
                    <p className="text-lg font-bold text-red-800">{dqD?.kpis?.orders?.criticalNotAcked ?? 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Department breakdown */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3 md:col-span-2">
              <h3 className="font-bold text-base">{tr('جودة البيانات حسب القسم', 'Data Quality by Department')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b">
                      <th className="text-start py-2 font-semibold">{tr('القسم', 'Department')}</th>
                      <th className="text-center py-2 font-semibold">{tr('النتيجة', 'Score')}</th>
                      <th className="text-center py-2 font-semibold">{tr('لقاءات', 'Enc.')}</th>
                      <th className="text-center py-2 font-semibold">{tr('فايتل ناقص', 'Missing Vitals')}</th>
                      <th className="text-center py-2 font-semibold">{tr('ملاحظات ناقصة', 'Missing Notes')}</th>
                      <th className="text-center py-2 font-semibold">{tr('تشخيص ناقص', 'Missing Dx')}</th>
                      <th className="text-center py-2 font-semibold">{tr('متوسط الانتظار', 'Avg Wait')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(dqD?.byDepartment || []).length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">{tr('لا بيانات', 'No data')}</td></tr>
                    ) : (
                      (dqD.byDepartment as AnalyticsDqDepartment[]).map((dept) => (
                        <tr key={dept.departmentId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2 font-medium">{dept.name}</td>
                          <td className="text-center">
                            <span className={`font-bold ${
                              dept.score >= 80 ? 'text-green-600' : dept.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                            }`}>{dept.score}</span>
                          </td>
                          <td className="text-center text-muted-foreground">{dept.encounters}</td>
                          <td className="text-center">
                            <span className={dept.missingVitalsPct > 30 ? 'text-red-600 font-semibold' : ''}>{dept.missingVitalsPct}%</span>
                          </td>
                          <td className="text-center">
                            <span className={dept.missingNotesPct > 30 ? 'text-red-600 font-semibold' : ''}>{dept.missingNotesPct}%</span>
                          </td>
                          <td className="text-center">
                            <span className={dept.missingDiagnosisPct > 30 ? 'text-red-600 font-semibold' : ''}>{dept.missingDiagnosisPct}%</span>
                          </td>
                          <td className="text-center">{dept.avgWaitMinutes > 0 ? `${dept.avgWaitMinutes} ${tr('د', 'min')}` : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Worst doctors */}
            {(dqD?.worstDoctors || []).length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h3 className="font-bold text-base flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  {tr('أطباء بحاجة تحسين في التوثيق', 'Doctors Needing Documentation Improvement')}
                </h3>
                {(dqD.worstDoctors as AnalyticsDqDoctor[]).slice(0, 10).map((doc) => (
                  <div key={doc.doctorId} className="flex items-center justify-between text-sm bg-muted/30 rounded-xl px-4 py-2.5">
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-[11px] text-muted-foreground">{doc.encounters} {tr('لقاء', 'encounters')}</p>
                    </div>
                    <span className={`text-lg font-bold ${doc.documentationPct < 50 ? 'text-red-600' : 'text-yellow-600'}`}>
                      {doc.documentationPct}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Daily trend */}
            {(dqD?.dailyTrend || []).length > 0 && (
              <div className={`bg-card border border-border rounded-2xl p-5 ${(dqD?.worstDoctors || []).length > 0 ? '' : 'md:col-span-2'}`}>
                <h3 className="font-bold text-base mb-4">{tr('اتجاه النتيجة اليومي', 'Daily Quality Score Trend')}</h3>
                <div className="flex items-end gap-1 h-28">
                  {(dqD.dailyTrend as Array<{date: string; score: number; encounters: number}>).slice(-30).map((d) => {
                    const barPct = Math.max(d.score, 2);
                    const barColor = d.score >= 80 ? 'bg-green-400' : d.score >= 60 ? 'bg-yellow-400' : 'bg-red-400';
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative min-w-0">
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-popover border rounded-lg shadow px-2 py-1 text-[10px] z-10 whitespace-nowrap">
                          {d.date}: {tr('نتيجة', 'score')} {d.score} · {d.encounters} {tr('لقاء', 'enc.')}
                        </div>
                        <div className={`w-full rounded-t-sm ${barColor}`} style={{ height: `${barPct}%`, maxHeight: '112px' }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400 inline-block" />{'>'}80</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-400 inline-block" />60-80</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />{'<'}60</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
