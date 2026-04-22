'use client';

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Shield, ShieldAlert, Clock } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import { calculateMEWS, vitalsToMEWSInput, type ConsciousnessLevel, type MEWSResult } from '@/lib/clinical/mewsCalculator';

interface MEWSBadgeProps {
  vitals: Record<string, any>;
  consciousness?: ConsciousnessLevel | null;
  onSupplementalO2?: boolean | null;
  compact?: boolean;
  showDetails?: boolean;
}

const SCORE_CELL_COLORS: Record<number, string> = {
  0: 'bg-emerald-100 text-emerald-800',
  1: 'bg-amber-100 text-amber-800',
  2: 'bg-orange-100 text-orange-800',
  3: 'bg-red-100 text-red-800',
};

const RISK_ICONS: Record<string, typeof Shield> = {
  LOW: Shield,
  LOW_MEDIUM: Activity,
  MEDIUM: AlertTriangle,
  HIGH: ShieldAlert,
};

export function MEWSBadge({ vitals, consciousness, onSupplementalO2, compact = false, showDetails: initialShowDetails = false }: MEWSBadgeProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [showDetails, setShowDetails] = useState(initialShowDetails);

  const result: MEWSResult = useMemo(() => {
    const input = vitalsToMEWSInput(vitals || {}, consciousness, onSupplementalO2);
    return calculateMEWS(input);
  }, [vitals, consciousness, onSupplementalO2]);

  if (result.parametersCompleted === 0) return null;

  const Icon = RISK_ICONS[result.riskLevel] || Activity;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${result.bgClass} ${result.colorClass}`}
        title={`NEWS2: ${result.totalScore} — ${language === 'ar' ? result.clinicalResponseAr : result.clinicalResponseEn}`}
      >
        <Icon size={12} />
        {result.totalScore}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${result.bgClass} border-current/10`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`w-full flex items-center justify-between px-3 py-2 ${result.colorClass}`}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <span className="text-sm font-bold">NEWS2: {result.totalScore}</span>
          <span className="text-xs opacity-80">
            ({result.parametersCompleted}/{result.parametersTotal} {tr('مؤشرات', 'params')})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${result.riskLevel === 'LOW' ? 'bg-emerald-200/50' : result.riskLevel === 'LOW_MEDIUM' ? 'bg-amber-200/50' : result.riskLevel === 'MEDIUM' ? 'bg-orange-200/50' : 'bg-red-200/50'}`}>
            {result.riskLevel === 'LOW' && tr('منخفض', 'Low')}
            {result.riskLevel === 'LOW_MEDIUM' && tr('منخفض–متوسط', 'Low–Medium')}
            {result.riskLevel === 'MEDIUM' && tr('متوسط', 'Medium')}
            {result.riskLevel === 'HIGH' && tr('مرتفع', 'High')}
          </span>
          {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {showDetails && (
        <div className="px-3 py-2 bg-white/60 dark:bg-black/10 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {result.parameters.map((p) => (
              <div key={p.parameter} className="flex items-center justify-between bg-white dark:bg-card rounded-lg px-2 py-1.5 border border-border/50">
                <div className="text-[11px] text-muted-foreground truncate">
                  {language === 'ar' ? p.labelAr : p.labelEn}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{p.value ?? '—'}</span>
                  <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${SCORE_CELL_COLORS[p.score] || 'bg-muted text-muted-foreground'}`}>
                    {p.score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className={`flex items-start gap-2 px-2 py-1.5 rounded-lg ${result.riskLevel === 'HIGH' ? 'bg-red-100 dark:bg-red-950/30' : 'bg-white/50 dark:bg-card/50'}`}>
            <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${result.colorClass}`} />
            <div className="text-xs">
              <div className={`font-semibold ${result.colorClass}`}>
                {language === 'ar' ? result.clinicalResponseAr : result.clinicalResponseEn}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                <Clock size={10} />
                {language === 'ar' ? result.monitoringFrequencyAr : result.monitoringFrequencyEn}
              </div>
            </div>
          </div>

          {result.hasSingleHighParameter && result.riskLevel !== 'HIGH' && (
            <div className="flex items-center gap-2 px-2 py-1 bg-orange-100 dark:bg-orange-950/20 rounded-lg">
              <ShieldAlert size={12} className="text-orange-700 shrink-0" />
              <span className="text-[11px] text-orange-800 dark:text-orange-300">
                {tr(
                  'يوجد مؤشر واحد بدرجة 3 — يتطلب استجابة عاجلة حتى لو المجموع منخفض',
                  'Single parameter score of 3 detected — urgent response required regardless of total'
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
