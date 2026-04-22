'use client';

import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useLang } from '@/hooks/use-lang';
import { SOFAScoreTool } from '@/components/clinical/SOFAScoreTool';
import {
  AlertCircle,
  Scissors,
  Building2,
  Pill,
  HelpCircle,
  Bed,
  Wind,
  CheckCircle2,
  BarChart3,
  Calendar,
  Users,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const EVENT_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  ADMIT:    { ar: 'قبول',      en: 'Admitted',    color: 'bg-emerald-100 text-emerald-800' },
  TRANSFER: { ar: 'نقل',       en: 'Transferred', color: 'bg-blue-100 text-blue-800' },
  DISCHARGE:{ ar: 'خروج',      en: 'Discharged',  color: 'bg-slate-100 text-slate-700' },
};

const SOURCE_ICONS: Record<string, ReactNode> = {
  ER: <AlertCircle className="h-4 w-4 inline-block" />,
  OR: <Scissors className="h-4 w-4 inline-block" />,
  IPD: <Building2 className="h-4 w-4 inline-block" />,
  ICU: <Pill className="h-4 w-4 inline-block" />,
  UNKNOWN: <HelpCircle className="h-4 w-4 inline-block" />,
};

export default function ICUDashboard() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [showSofa, setShowSofa] = useState(false);

  const { data, isLoading } = useSWR('/api/icu/dashboard', fetcher, {
    refreshInterval: 30000,
  });

  const census = data?.census ?? { total: 0, ventilated: 0, critical: 0, stable: 0, highSofa: 0 };
  const los    = data?.los    ?? { avgDays: 0, longStayCount: 0 };
  const admissionSources: Record<string, number> = data?.admissionSources ?? {};
  const recentEvents: any[] = data?.recentEvents ?? [];

  const occupancyPct = census.total > 0
    ? Math.min(100, Math.round((census.total / 20) * 100)) // assume 20-bed ICU
    : 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {tr('لوحة تحكم العناية المركزة', 'ICU Dashboard')}
            </h1>
            <p className="text-muted-foreground">
              {tr('نظرة لحظية على وحدات العناية المركزة', 'Real-time overview of intensive care units')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSofa(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" /> {tr('احسب SOFA', 'SOFA Score')}
            </button>
            <Link
              href="/icu/nurse-station"
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" /> {tr('محطة التمريض', 'Nurse Station')}
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="animate-spin mr-2 h-5 w-5" />
            {tr('جاري التحميل...', 'Loading...')}
          </div>
        ) : (
          <>
            {/* Census KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { icon: <Bed className="h-5 w-5" />, label: tr('المرضى الحاليون', 'Current Patients'), value: census.total, color: 'text-foreground', bg: 'bg-card' },
                { icon: <Wind className="h-5 w-5" />, label: tr('على التنفس الاصطناعي', 'Ventilated'), value: census.ventilated, color: 'text-blue-600', bg: 'bg-blue-50' },
                { icon: <AlertCircle className="h-5 w-5" />, label: tr('حالات حرجة (MEWS≥7)', 'Critical (MEWS≥7)'), value: census.critical, color: 'text-red-600', bg: 'bg-red-50' },
                { icon: <CheckCircle2 className="h-5 w-5" />, label: tr('مستقر (MEWS<3)', 'Stable (MEWS<3)'), value: census.stable, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { icon: <BarChart3 className="h-5 w-5" />, label: tr('SOFA ≥13', 'SOFA ≥13'), value: census.highSofa, color: 'text-purple-600', bg: 'bg-purple-50' },
                { icon: <Calendar className="h-5 w-5" />, label: tr('متوسط الإقامة', 'Avg LOS'), value: `${los.avgDays}d`, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map((kpi, i) => (
                <div key={i} className={`${kpi.bg} border border-border rounded-2xl p-4`}>
                  <div className="mb-1">{kpi.icon}</div>
                  <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Occupancy + Alerts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Bed Occupancy */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-semibold text-foreground mb-4">
                  {tr('إشغال الأسرة', 'Bed Occupancy')}
                </h2>
                {/* Circular progress approximation */}
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke={occupancyPct >= 90 ? '#ef4444' : occupancyPct >= 75 ? '#f59e0b' : '#10b981'}
                        strokeWidth="3"
                        strokeDasharray={`${occupancyPct} ${100 - occupancyPct}`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-foreground">{occupancyPct}%</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-foreground">
                      <span className="font-bold text-lg">{census.total}</span>
                      <span className="text-muted-foreground"> / 20 {tr('سرير', 'beds')}</span>
                    </div>
                    {los.longStayCount > 0 && (
                      <div className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {los.longStayCount} {tr('مريض ≥7 أيام', 'patients ≥7 days')}
                      </div>
                    )}
                    {census.critical > 0 && (
                      <div className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {census.critical} {tr('حالة حرجة', 'critical')}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Admission Sources */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-semibold text-foreground mb-4">
                  {tr('مصادر القبول (7 أيام)', 'Admission Sources (7 days)')}
                </h2>
                {Object.keys(admissionSources).length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    {tr('لا يوجد بيانات', 'No data')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(admissionSources)
                      .sort((a, b) => b[1] - a[1])
                      .map(([src, count]) => {
                        const total = Object.values(admissionSources).reduce((s, v) => s + v, 0);
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={src}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="flex items-center gap-1.5">
                                {SOURCE_ICONS[src] || <Building2 className="h-4 w-4 inline-block" />}
                                <span className="font-medium text-foreground">{src}</span>
                              </span>
                              <span className="text-muted-foreground">{count} ({pct}%)</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="font-semibold text-foreground mb-4">
                  {tr('وصول سريع', 'Quick Access')}
                </h2>
                <div className="space-y-2">
                  {[
                    { href: '/icu/nurse-station', icon: <Users className="h-5 w-5" />, ar: 'محطة التمريض', en: 'Nurse Station', color: 'hover:bg-blue-50' },
                    { href: '#sofa', icon: <BarChart3 className="h-5 w-5" />, ar: 'حساب SOFA Score', en: 'Calculate SOFA Score', color: 'hover:bg-purple-50', onClick: () => setShowSofa(true) },
                  ].map((action, i) => (
                    action.onClick ? (
                      <button
                        key={i}
                        onClick={action.onClick}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${action.color} text-foreground`}
                      >
                        {action.icon}
                        {tr(action.ar, action.en)}
                        <span className="mr-auto text-muted-foreground">←</span>
                      </button>
                    ) : (
                      <Link
                        key={i}
                        href={action.href}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${action.color} text-foreground`}
                      >
                        {action.icon}
                        {tr(action.ar, action.en)}
                        <span className="mr-auto text-muted-foreground">←</span>
                      </Link>
                    )
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            {recentEvents.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">
                    {tr('الأحداث الأخيرة (24 ساعة)', 'Recent Events (24 hours)')}
                  </h2>
                </div>
                <div className="divide-y divide-border/50">
                  {recentEvents.slice(0, 8).map((ev: any) => {
                    const lbl = EVENT_LABELS[ev.type] || { ar: ev.type, en: ev.type, color: 'bg-muted text-foreground' };
                    return (
                      <div key={ev.id} className="px-5 py-3 flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${lbl.color}`}>
                          {tr(lbl.ar, lbl.en)}
                        </span>
                        {ev.source && (
                          <span className="text-xs text-muted-foreground">
                            {tr('من:', 'from:')} {SOURCE_ICONS[ev.source] || ''} {ev.source}
                          </span>
                        )}
                        {ev.destination && (
                          <span className="text-xs text-muted-foreground">
                            {tr('إلى:', 'to:')} {ev.destination}
                          </span>
                        )}
                        {ev.note && (
                          <span className="text-xs text-muted-foreground truncate max-w-xs">{ev.note}</span>
                        )}
                        <span className="mr-auto text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric',
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {census.total === 0 && (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <div className="mb-4 flex justify-center"><Bed className="h-12 w-12 text-muted-foreground" /></div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {tr('لا يوجد مرضى في العناية المركزة حالياً', 'No patients currently in ICU')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tr('يظهر المرضى هنا عند قبولهم في وحدة العناية المركزة', 'Patients appear here when admitted to ICU units')}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* SOFA Score Modal */}
      {showSofa && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{tr('مقياس SOFA', 'SOFA Score')}</h2>
                <p className="text-purple-100 text-sm">{tr('تقييم فشل الأعضاء في العناية المركزة', 'Sequential Organ Failure Assessment')}</p>
              </div>
              <button onClick={() => setShowSofa(false)} className="text-white/80 hover:text-white text-2xl leading-none">✕</button>
            </div>
            <div className="p-6">
              <SOFAScoreTool />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
