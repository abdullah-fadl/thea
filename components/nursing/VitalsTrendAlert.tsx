'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Activity, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { analyzeVitalsTrends, TREND_DIRECTION_ICONS, type TrendResult, type TrendSeverity, type TrendDirection } from '@/lib/clinical/vitalsTrendAnalyzer';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

interface VitalsTrendAlertProps {
  patientId: string;
  currentVitals?: Record<string, any>;
}

export function VitalsTrendAlert({ patientId, currentVitals }: VitalsTrendAlertProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = useSWR(
    patientId ? `/api/patients/${patientId}/vitals-history` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const analysis = useMemo(() => {
    const historyItems = data?.items || [];
    const allPoints = [...historyItems];
    if (currentVitals && (currentVitals.bp || currentVitals.hr || currentVitals.temp)) {
      allPoints.push({ date: new Date().toISOString(), ...currentVitals });
    }
    return analyzeVitalsTrends(allPoints);
  }, [data, currentVitals]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 size={12} className="animate-spin" />
        {tr('تحليل الاتجاهات...', 'Analyzing trends...')}
      </div>
    );
  }

  if (!analysis.trends.length) return null;

  const riskConfig = getRiskConfig(analysis.overallRisk);

  return (
    <div className={`rounded-xl border overflow-hidden ${riskConfig.border}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-3 py-2 ${riskConfig.bg}`}
      >
        <div className="flex items-center gap-2">
          <Activity size={14} className={riskConfig.text} />
          <span className={`text-xs font-bold ${riskConfig.text}`}>
            {tr('تحليل الاتجاهات', 'Trend Analysis')}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${riskConfig.badge}`}>
            {language === 'ar' ? analysis.summaryAr : analysis.summaryEn}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">
            {analysis.analyzedPoints} {tr('نقطة', 'pts')}
          </span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 space-y-2 bg-white/60 dark:bg-black/10">
          {analysis.trends.map((trend) => (
            <TrendRow key={trend.parameter} trend={trend} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendRow({ trend }: { trend: TrendResult }) {
  const { language } = useLang();
  const DirIcon = getDirectionIcon(trend.direction);
  const severityConfig = getSeverityConfig(trend.severity);
  const dirInfo = TREND_DIRECTION_ICONS[trend.direction];

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${severityConfig.bg}`}>
      <DirIcon size={14} className={severityConfig.text} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${severityConfig.text}`}>
            {language === 'ar' ? trend.labelAr : trend.labelEn}
          </span>
          {trend.currentValue != null && (
            <span className="text-xs text-foreground font-medium">
              {trend.currentValue}
            </span>
          )}
          {trend.changePercent != null && trend.changePercent !== 0 && (
            <span className={`text-[10px] font-bold ${trend.changePercent > 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {trend.changePercent > 0 ? '+' : ''}{trend.changePercent}%
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {language === 'ar' ? trend.messageAr : trend.messageEn}
        </div>
      </div>
      {/* Mini sparkline */}
      {trend.values.length >= 2 && (
        <MiniSparkline values={trend.values.map(v => v.value)} severity={trend.severity} />
      )}
    </div>
  );
}

function MiniSparkline({ values, severity }: { values: number[]; severity: TrendSeverity }) {
  const w = 48;
  const h = 20;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  const color = severity === 'CRITICAL' ? '#ef4444' : severity === 'WARNING' ? '#f59e0b' : '#6b7280';

  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(values.length - 1) / (values.length - 1) * w}
        cy={h - ((values[values.length - 1] - min) / range) * (h - 2) - 1}
        r={2}
        fill={color}
      />
    </svg>
  );
}

function getDirectionIcon(dir: TrendDirection) {
  switch (dir) {
    case 'RISING': return TrendingUp;
    case 'FALLING': return TrendingDown;
    case 'FLUCTUATING': return AlertTriangle;
    default: return Minus;
  }
}

function getRiskConfig(risk: TrendSeverity) {
  switch (risk) {
    case 'CRITICAL': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', badge: 'bg-red-100 text-red-700' };
    case 'WARNING': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' };
    default: return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-600' };
  }
}

function getSeverityConfig(sev: TrendSeverity) {
  switch (sev) {
    case 'CRITICAL': return { bg: 'bg-red-50/80', text: 'text-red-600' };
    case 'WARNING': return { bg: 'bg-amber-50/80', text: 'text-amber-600' };
    default: return { bg: 'bg-slate-50/80', text: 'text-slate-500' };
  }
}
