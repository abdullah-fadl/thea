'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import {
  Crosshair, AlertTriangle, AlertCircle, Info,
  RefreshCw, Activity, Shield, Zap, Clock,
  TrendingDown, TrendingUp, Cpu, Target,
} from 'lucide-react';

const SEVERITY_CONFIG: Record<string, { label: string; labelAr: string; color: string; dot: string }> = {
  CRITICAL: { label: 'Critical', labelAr: 'حرج', color: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-500' },
  HIGH: { label: 'High', labelAr: 'عالي', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-500' },
  MEDIUM: { label: 'Medium', labelAr: 'متوسط', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
  LOW: { label: 'Low', labelAr: 'منخفض', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', dot: 'bg-blue-500' },
  INFO: { label: 'Info', labelAr: 'معلومات', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', dot: 'bg-gray-500' },
};

const SIGNAL_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  LIFECYCLE_BREACH: { en: 'Lifecycle Breach', ar: 'اختراق دورة الحياة' },
  FAILURE_SPIKE: { en: 'Failure Spike', ar: 'ارتفاع حاد في الأعطال' },
  STOCKOUT_RISK: { en: 'Stockout Risk', ar: 'خطر نفاد المخزون' },
  EXPIRY_WARNING: { en: 'Expiry Warning', ar: 'تحذير انتهاء الصلاحية' },
  BUDGET_OVERRUN: { en: 'Budget Overrun', ar: 'تجاوز الميزانية' },
  COMPLIANCE_GAP: { en: 'Compliance Gap', ar: 'فجوة امتثال' },
  DEMAND_SURGE: { en: 'Demand Surge', ar: 'ارتفاع الطلب' },
  VENDOR_RISK: { en: 'Vendor Risk', ar: 'مخاطر المورد' },
  TEMPERATURE_BREACH: { en: 'Temperature Breach', ar: 'اختراق درجة الحرارة' },
  COMPATIBILITY_GAP: { en: 'Compatibility Gap', ar: 'فجوة التوافق' },
  UTILIZATION_DROP: { en: 'Utilization Drop', ar: 'انخفاض الاستخدام' },
  MAINTENANCE_COST_SPIKE: { en: 'Maintenance Cost Spike', ar: 'ارتفاع تكلفة الصيانة' },
  SAFETY_ALERT: { en: 'Safety Alert', ar: 'تنبيه سلامة' },
  RECALL_TRIGGER: { en: 'Recall Trigger', ar: 'محفز استرجاع' },
};

export default function SignalRadarPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [signals, setSignals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (severityFilter) params.set('severity', severityFilter);
      const res = await fetch(`/api/imdad/decisions/signals?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSignals(data.items || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [severityFilter]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const severityCounts: Record<string, number> = {};
  for (const s of signals) {
    severityCounts[s.severity] = (severityCounts[s.severity] || 0) + 1;
  }

  const timeAgo = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Crosshair className="h-8 w-8 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold">{tr('رادار الإشارات', 'Signal Radar')}</h1>
            <p className="text-xs text-gray-400">{tr('الإشارات التشغيلية المكتشفة عبر سلسلة الإمداد', 'Operational signals detected across the supply chain')}</p>
          </div>
        </div>
        <button onClick={fetchSignals} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm hover:bg-amber-500/20 transition">
          <RefreshCw className="h-3.5 w-3.5" /> {tr('تحديث', 'Refresh')}
        </button>
      </div>

      {/* Severity Summary */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setSeverityFilter(severityFilter === key ? '' : key)}
            className={cn(
              'p-3 rounded-xl border text-center transition',
              severityFilter === key ? cfg.color : 'bg-[#111827] border-gray-700/50 hover:border-gray-600',
            )}
          >
            <div className="flex items-center justify-center gap-1 mb-1">
              <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
              <span className="text-xs">{language === 'ar' ? cfg.labelAr : cfg.label}</span>
            </div>
            <p className="text-2xl font-bold">{severityCounts[key] || 0}</p>
          </button>
        ))}
      </div>

      {/* Signal Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 text-amber-400 animate-spin" />
        </div>
      ) : signals.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Crosshair className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg">{tr('لا توجد إشارات', 'No signals detected')}</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-700" />

          <div className="space-y-3">
            {signals.map((s) => {
              const sevCfg = SEVERITY_CONFIG[s.severity] || SEVERITY_CONFIG.INFO;
              const typeLbl = SIGNAL_TYPE_LABELS[s.signalType] || { en: s.signalType, ar: s.signalType };
              const deviation = Number(s.deviationPct || 0);

              return (
                <div key={s.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={cn('absolute left-2.5 top-4 h-3 w-3 rounded-full border-2 border-[#0a0f1e]', sevCfg.dot, s.severity === 'CRITICAL' && 'animate-pulse')} />

                  <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-4 hover:border-gray-600 transition">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500">{s.signalCode}</span>
                          <span className={cn('px-2 py-0.5 rounded text-xs border', sevCfg.color)}>
                            {language === 'ar' ? sevCfg.labelAr : sevCfg.label}
                          </span>
                          <span className="text-xs bg-gray-700/50 px-2 py-0.5 rounded text-gray-400">
                            {language === 'ar' ? typeLbl.ar : typeLbl.en}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm">{language === 'ar' ? s.titleAr : s.title}</h3>
                        {s.description && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{language === 'ar' ? s.descriptionAr || s.description : s.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{tr('المصدر', 'Source')}: {s.sourceEntity}</span>
                          {s.metricValue != null && s.threshold != null && (
                            <span className="flex items-center gap-1">
                              {deviation >= 0 ? <TrendingUp className="h-3 w-3 text-red-400" /> : <TrendingDown className="h-3 w-3 text-emerald-400" />}
                              {Number(s.metricValue).toFixed(0)} / {Number(s.threshold).toFixed(0)} ({deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%)
                            </span>
                          )}
                          <span>{timeAgo(s.createdAt)} {tr('مضت', 'ago')}</span>
                        </div>
                      </div>
                      {s.acknowledged && (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          {tr('تم الاطلاع', 'Acknowledged')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
