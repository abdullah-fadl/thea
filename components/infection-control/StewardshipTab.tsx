'use client';

import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import {
  Pill,
  TrendingUp,
  AlertTriangle,
  FlaskConical,
  Clock,
  Activity,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const ALERT_TYPE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  prolonged_course:  { ar: 'دورة علاج مطولة',    en: 'Prolonged Course',     color: 'bg-orange-100 text-orange-800' },
  restricted_drug:   { ar: 'دواء مقيد',           en: 'Restricted Drug',      color: 'bg-red-100 text-red-800' },
  carbapenem_use:    { ar: 'استخدام كاربابينيم',   en: 'Carbapenem Use',       color: 'bg-purple-100 text-purple-800' },
  no_culture:        { ar: 'بدون مزرعة',           en: 'No Culture Guided',    color: 'bg-yellow-100 text-yellow-800' },
  de_escalation:     { ar: 'تحتاج تقليل',          en: 'Needs De-escalation',  color: 'bg-blue-100 text-blue-800' },
};

interface DrugEntry { name: string; nameAr?: string; ddd: number; count: number }
interface CategoryEntry { category: string; ddd: number; count: number }
interface StewardshipAlert { id: string; type: string; severity: string; drugName?: string; message: string; messageAr?: string; createdAt?: string }

interface Props {
  tr: (ar: string, en: string) => string;
  language: string;
  periodDays: number;
}

export default function StewardshipTab({ tr, language, periodDays }: Props) {
  const { data } = useSWR(
    `/api/infection-control/stewardship?days=${periodDays}`,
    fetcher, { refreshInterval: 120000 }
  );

  const metrics = data?.metrics || {};
  const topDrugs = (data?.topDrugs || []) as DrugEntry[];
  const byCategory = (data?.byCategory || []) as CategoryEntry[];
  const byDepartment = (data?.byDepartment || []) as Record<string, unknown>[];
  const alerts = (data?.alerts || []) as StewardshipAlert[];
  const alertsByType = (data?.alertsByType || {}) as Record<string, number>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: tr('DDD/1000 يوم مريض', 'DDD/1000 Patient-Days'), value: metrics.dddPer1000PatientDays ?? '—', icon: <Pill className="h-5 w-5" />, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: tr('إجمالي الوصفات', 'Total Prescriptions'), value: metrics.totalPrescriptions ?? '—', icon: <Activity className="h-5 w-5" />, color: 'bg-purple-50 border-purple-200 text-purple-800' },
          { label: tr('متوسط المدة (أيام)', 'Avg Duration (days)'), value: metrics.avgDurationDays ?? '—', icon: <Clock className="h-5 w-5" />, color: 'bg-orange-50 border-orange-200 text-orange-800' },
          { label: tr('معدل التوجيه بالمزرعة', 'Culture-Guided Rate'), value: `${metrics.cultureGuidedRate ?? 0}%`, icon: <FlaskConical className="h-5 w-5" />, color: 'bg-green-50 border-green-200 text-green-800' },
          { label: tr('معدل التقليل', 'De-escalation Rate'), value: `${metrics.deEscalationRate ?? 0}%`, icon: <TrendingUp className="h-5 w-5" />, color: 'bg-teal-50 border-teal-200 text-teal-800' },
          { label: tr('أدوية مقيدة', 'Restricted Drugs'), value: metrics.restrictedDrugCount ?? '—', icon: <AlertTriangle className="h-5 w-5" />, color: 'bg-red-50 border-red-200 text-red-800' },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 flex flex-col gap-1 ${kpi.color}`}>
            <div className="opacity-60">{kpi.icon}</div>
            <p className="text-xs font-medium opacity-70">{kpi.label}</p>
            <p className="text-2xl font-extrabold">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Drugs */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Pill className="h-4 w-4 text-muted-foreground" />
            {tr('أكثر المضادات استخداماً', 'Top Antibiotics by DDD')}
          </h3>
          {topDrugs.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
          ) : (
            <div className="space-y-2">
              {topDrugs.map((d) => {
                const maxDDD = topDrugs[0]?.ddd || 1;
                return (
                  <div key={d.name} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{language === 'ar' && d.nameAr ? d.nameAr : d.name}</span>
                      <span className="text-muted-foreground font-mono">{d.ddd} DDD ({d.count})</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.round((d.ddd / maxDDD) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* By Category */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-3">{tr('حسب الفئة الدوائية', 'By Antibiotic Category')}</h3>
          {byCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground">{tr('لا بيانات', 'No data')}</p>
          ) : (
            <div className="space-y-2">
              {byCategory.map((c) => {
                const maxDDD = byCategory[0]?.ddd || 1;
                return (
                  <div key={c.category} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium capitalize">{c.category}</span>
                      <span className="text-muted-foreground font-mono">{c.ddd} DDD ({c.count})</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.round((c.ddd / maxDDD) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stewardship Alerts */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            {tr('تنبيهات إشراف المضادات', 'Stewardship Alerts')}
          </h3>
          <div className="flex gap-2">
            {Object.entries(alertsByType).map(([type, count]) => {
              const cfg = ALERT_TYPE_LABELS[type];
              return (
                <Badge key={type} className={cfg?.color || 'bg-muted text-foreground'}>
                  {cfg ? tr(cfg.ar, cfg.en) : type}: {count}
                </Badge>
              );
            })}
          </div>
        </div>
        {alerts.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">{tr('لا تنبيهات في هذه الفترة', 'No alerts in this period')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {[tr('النوع', 'Type'), tr('الشدة', 'Severity'), tr('الدواء', 'Drug'), tr('الرسالة', 'Message'), tr('التاريخ', 'Date')].map((h) => (
                    <th key={h} className="px-4 py-3 text-start font-semibold text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.slice(0, 20).map((a) => {
                  const cfg = ALERT_TYPE_LABELS[a.type];
                  return (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-2.5">
                        <Badge className={cfg?.color || 'bg-muted text-foreground'}>
                          {cfg ? tr(cfg.ar, cfg.en) : a.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs capitalize">{a.severity}</td>
                      <td className="px-4 py-2.5 text-xs font-medium">{a.drugName || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                        {language === 'ar' && a.messageAr ? a.messageAr : a.message}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '—'}
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
