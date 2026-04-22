'use client';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Bell,
  TrendingUp,
  Bug,
  Activity,
} from 'lucide-react';

const INFECTION_TYPES: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  SSI:       { ar: 'عدوى موضع الجراحة',               en: 'Surgical Site Infection', color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  CAUTI:     { ar: 'عدوى بولية مرتبطة بقثطرة',         en: 'CAUTI',                   color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  CLABSI:    { ar: 'عدوى دموية مركزية',                en: 'CLABSI',                  color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  VAP:       { ar: 'التهاب رئوي بالتنفس الاصطناعي',    en: 'VAP',                     color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  CDIFF:     { ar: 'كلوستريديوم ديفيسيل',              en: 'C. difficile',             color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  MRSA:      { ar: 'مرسا',                             en: 'MRSA',                    color: 'text-pink-700',   bg: 'bg-pink-50 border-pink-200' },
  VRE:       { ar: 'المكورات المعوية المقاومة',         en: 'VRE',                     color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  OTHER_HAI: { ar: 'عدوى أخرى',                       en: 'Other HAI',               color: 'text-foreground',   bg: 'bg-muted/50 border-border' },
};

const ISOLATION_PRECAUTIONS = [
  { value: 'CONTACT',   ar: 'تلامسي',  en: 'Contact' },
  { value: 'DROPLET',   ar: 'قطيرات',  en: 'Droplet' },
  { value: 'AIRBORNE',  ar: 'هوائي',   en: 'Airborne' },
  { value: 'PROTECTIVE',ar: 'وقائي',   en: 'Protective' },
];

const ISOLATION_BADGE_COLORS: Record<string, string> = {
  CONTACT:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  DROPLET:    'bg-blue-100 text-blue-800 border-blue-200',
  AIRBORNE:   'bg-red-100 text-red-800 border-red-200',
  PROTECTIVE: 'bg-green-100 text-green-800 border-green-200',
};

const OUTCOME_CONFIG: Record<string, { ar: string; en: string; color: string }> = {
  ACTIVE:      { ar: 'نشط',   en: 'Active',       color: 'bg-red-100 text-red-700' },
  RESOLVED:    { ar: 'تعافى', en: 'Resolved',     color: 'bg-green-100 text-green-700' },
  TRANSFERRED: { ar: 'محول',  en: 'Transferred',  color: 'bg-blue-100 text-blue-700' },
  DECEASED:    { ar: 'وفاة',  en: 'Deceased',     color: 'bg-muted text-foreground' },
};

const ONSET_OPTIONS = [
  { value: 'COMMUNITY',             ar: 'مجتمعي',                   en: 'Community-acquired' },
  { value: 'HEALTHCARE_ASSOCIATED', ar: 'مرتبط بالرعاية الصحية',     en: 'Healthcare-associated (HCAI)' },
];

interface InfectionTypeCount { type: string; total: number; active: number; hcai: number }
interface OrganismCount { organism: string; count: number }
interface IsolationCount { precaution: string; count: number }
interface DailyTrendEntry { date: string; total: number; hcai: number; notifiable: number }

interface SurveillanceRecord {
  id: string;
  patientMasterId: string;
  infectionType: string;
  organism?: string;
  onset?: string;
  isolationPrecautions?: string[];
  reportDate?: string;
  outcome: string;
  notifiable?: boolean;
}

interface Props {
  tr: (ar: string, en: string) => string;
  language: string;
  periodDays: number;
  statsData: Record<string, unknown> | null;
  records: SurveillanceRecord[];
  isLoading: boolean;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  activeIsolationOnly: boolean;
  setActiveIsolationOnly: (v: boolean) => void;
  notifiableOnly: boolean;
  setNotifiableOnly: (v: boolean) => void;
}

export default function SurveillanceTab({
  tr, language, periodDays, statsData, records, isLoading,
  typeFilter, setTypeFilter,
  activeIsolationOnly, setActiveIsolationOnly,
  notifiableOnly, setNotifiableOnly,
}: Props) {
  const summary         = (statsData?.summary    || {}) as Record<string, unknown>;
  const byType          = (statsData?.byType    || []) as InfectionTypeCount[];
  const byOrganism      = (statsData?.byOrganism|| []) as OrganismCount[];
  const isolationBreakdown = (statsData?.isolationBreakdown || []) as IsolationCount[];
  const dailyTrend      = (statsData?.dailyTrend|| []) as DailyTrendEntry[];

  const typeCountMap: Record<string, { total: number; active: number; hcai: number }> = {};
  for (const t of byType) typeCountMap[t.type] = t;
  const maxTrend = Math.max(...dailyTrend.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: tr('إجمالي الحالات', 'Total Cases'), value: summary.totalCases ?? '—', icon: <Activity className="h-5 w-5" />, color: 'bg-red-50 border-red-200 text-red-800' },
          { label: tr('الحالات النشطة', 'Active Isolation'), value: summary.activeIsolation ?? '—', icon: <ShieldAlert className="h-5 w-5" />, color: 'bg-orange-50 border-orange-200 text-orange-800' },
          { label: tr('عدوى مرتبطة برعاية', 'HCAI Cases'), value: summary.hcaiCases ?? '—', icon: <AlertTriangle className="h-5 w-5" />, color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
          { label: tr('حالات إخطارية', 'Notifiable'), value: summary.notifiableCases ?? '—', icon: <Bell className="h-5 w-5" />, color: 'bg-purple-50 border-purple-200 text-purple-800' },
          { label: tr('مرضى في العزل', 'Patients in Isolation'), value: summary.patientsInIsolation ?? '—', icon: <Users className="h-5 w-5" />, color: 'bg-blue-50 border-blue-200 text-blue-800' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 flex flex-col gap-1 ${kpi.color}`}>
            <div className="opacity-60">{kpi.icon}</div>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-3xl font-extrabold">{kpi.value as React.ReactNode}</p>
          </div>
        ))}
      </div>

      {/* HAI Type Breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Bug className="h-4 w-4" />
          {tr('توزيع حسب نوع العدوى', 'Breakdown by Infection Type')}
          <span className="text-xs font-normal">({tr(`خلال ${periodDays} يوم`, `last ${periodDays} days`)})</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Object.entries(INFECTION_TYPES).map(([key, cfg]) => {
            const counts = typeCountMap[key];
            return (
              <button
                key={key}
                onClick={() => setTypeFilter(typeFilter === key ? '' : key)}
                className={`rounded-2xl border p-3 text-start transition-all ${cfg.bg} ${typeFilter === key ? 'ring-2 ring-offset-1 ring-current shadow-md' : 'hover:opacity-80'}`}
              >
                <p className={`text-xs font-bold ${cfg.color}`}>{key}</p>
                <p className={`text-2xl font-extrabold ${cfg.color}`}>{counts?.total || 0}</p>
                <p className="text-[11px] mt-0.5 opacity-75 leading-tight">{tr(cfg.ar, cfg.en)}</p>
                {(counts?.total || 0) > 0 && (
                  <p className="text-[10px] mt-1 opacity-60">
                    {counts?.active || 0} {tr('نشط', 'active')} · {counts?.hcai || 0} {tr('رعاية', 'HCAI')}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Analytics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Organisms */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Bug className="h-4 w-4 text-muted-foreground" />
            {tr('الكائنات الأكثر شيوعاً', 'Top Organisms')}
          </h3>
          {byOrganism.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
          ) : (
            <div className="space-y-2">
              {byOrganism.slice(0, 8).map((o, i) => {
                const maxC = byOrganism[0]?.count || 1;
                return (
                  <div key={o.organism || i} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{o.organism}</span>
                      <span className="text-muted-foreground">{o.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${Math.round((o.count / maxC) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Isolation Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            {tr('احتياطات العزل النشطة', 'Active Isolation Precautions')}
          </h3>
          {isolationBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
          ) : (
            <div className="space-y-2">
              {isolationBreakdown.map((ip) => {
                const pc = ISOLATION_PRECAUTIONS.find((p) => p.value === ip.precaution);
                return (
                  <div key={ip.precaution} className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ISOLATION_BADGE_COLORS[ip.precaution] || 'bg-muted text-foreground border-border'}`}>
                      {pc ? tr(pc.ar, pc.en) : ip.precaution}
                    </span>
                    <span className="text-sm font-bold">{ip.count} {tr('مريض', 'patients')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 14-Day Trend */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            {tr('اتجاه آخر 14 يوم', 'Last 14-Day Trend')}
          </h3>
          {dailyTrend.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {dailyTrend.slice(-14).map((d) => {
                const barH = maxTrend > 0 ? Math.round((d.total / maxTrend) * 100) : 0;
                const dayLabel = new Date(d.date).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'numeric', day: 'numeric' });
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                      <div className="bg-popover border border-border rounded-lg shadow-md px-2 py-1 text-[11px] whitespace-nowrap">
                        <p className="font-bold">{d.date}</p>
                        <p>{tr('إجمالي', 'Total')}: {d.total}</p>
                        <p className="text-yellow-600">HCAI: {d.hcai}</p>
                        {d.notifiable > 0 && <p className="text-red-600">{tr('إخطاري', 'Notifiable')}: {d.notifiable}</p>}
                      </div>
                    </div>
                    <div className="w-full flex flex-col-reverse items-stretch" style={{ height: '80px' }}>
                      {barH > 0 && (
                        <div className="w-full bg-red-200 rounded-t-sm transition-all" style={{ height: `${barH}%` }}>
                          {d.hcai > 0 && <div className="w-full bg-red-500 rounded-t-sm" style={{ height: `${(d.hcai / d.total) * 100}%` }} />}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground leading-tight text-center">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-200 inline-block" />{tr('إجمالي', 'Total')}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />HCAI</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-muted/30 rounded-xl px-4 py-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={activeIsolationOnly} onCheckedChange={(c) => setActiveIsolationOnly(Boolean(c))} />
          {tr('العزل النشط فقط', 'Active Isolation Only')}
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={notifiableOnly} onCheckedChange={(c) => setNotifiableOnly(Boolean(c))} />
          {tr('الحالات الإخطارية فقط', 'Notifiable Only')}
        </label>
        {typeFilter && (
          <Button variant="ghost" size="sm" onClick={() => setTypeFilter('')} className="text-xs h-7 gap-1 text-red-600">
            {tr('نوع', 'Type')}: {typeFilter} ×
          </Button>
        )}
        {(activeIsolationOnly || notifiableOnly || typeFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setTypeFilter(''); setActiveIsolationOnly(false); setNotifiableOnly(false); }} className="text-xs h-7">
            {tr('مسح الفلاتر', 'Clear all filters')}
          </Button>
        )}
      </div>

      {/* Records Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-base">{tr('سجل المراقبة', 'Surveillance Records')}</h2>
          {records.length > 0 && <span className="text-xs text-muted-foreground">{records.length} {tr('حالة', 'cases')}</span>}
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-muted-foreground text-sm animate-pulse">{tr('جاري التحميل...', 'Loading...')}</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{tr('لا توجد حالات مطابقة للفلاتر', 'No cases match the current filters')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {[tr('المريض', 'Patient'), tr('نوع العدوى', 'Infection Type'), tr('الكائن الدقيق', 'Organism'), tr('البداية', 'Onset'), tr('احتياطات العزل', 'Precautions'), tr('تاريخ الإبلاغ', 'Report Date'), tr('النتيجة', 'Outcome'), tr('إخطاري', 'Notifiable')].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const typeCfg = INFECTION_TYPES[r.infectionType];
                  const outcomeCfg = OUTCOME_CONFIG[r.outcome] || { ar: r.outcome, en: r.outcome, color: 'bg-muted text-foreground' };
                  const precautions: string[] = Array.isArray(r.isolationPrecautions) ? r.isolationPrecautions : [];
                  const onsetCfg = ONSET_OPTIONS.find((o) => o.value === r.onset);
                  return (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.patientMasterId}</td>
                      <td className="px-4 py-3">
                        {typeCfg ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${typeCfg.bg} ${typeCfg.color}`}>{r.infectionType}</span>
                        ) : <span className="text-xs">{r.infectionType}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">{r.organism || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 text-xs">
                        {onsetCfg ? (
                          <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${r.onset === 'HEALTHCARE_ASSOCIATED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                            {tr(onsetCfg.ar, onsetCfg.en)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {precautions.length > 0 ? precautions.map((p) => {
                            const pc = ISOLATION_PRECAUTIONS.find((ip) => ip.value === p);
                            return (
                              <span key={p} className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium ${ISOLATION_BADGE_COLORS[p] || 'bg-muted text-muted-foreground border-border'}`}>
                                {pc ? tr(pc.ar, pc.en) : p}
                              </span>
                            );
                          }) : <span className="text-muted-foreground text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.reportDate ? new Date(r.reportDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${outcomeCfg.color}`}>
                          {tr(outcomeCfg.ar, outcomeCfg.en)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.notifiable ? (
                          <Badge variant="destructive" className="text-[11px]">{tr('إخطاري', 'NOTIFIABLE')}</Badge>
                        ) : <span className="text-muted-foreground text-xs">{tr('لا', 'No')}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
