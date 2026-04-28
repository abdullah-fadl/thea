'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertOctagon, ShieldAlert, Zap } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  type DeteriorationInput,
  predictDeterioration, RISK_CFG,
} from '@/lib/clinical/deteriorationPredictor';

interface DeteriorationAlertProps {
  input: DeteriorationInput;
}

export function DeteriorationAlert({ input }: DeteriorationAlertProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [expanded, setExpanded] = useState(false);

  const result = useMemo(() => predictDeterioration(input), [input]);
  const cfg = RISK_CFG[result.riskLevel];

  if (result.riskLevel === 'LOW' && result.factors.length === 0) return null;

  return (
    <div className={`border rounded-lg overflow-hidden ${cfg.border}`}>
      <button onClick={() => setExpanded(!expanded)} className={`w-full flex items-center justify-between p-3 ${cfg.bg} transition-colors`}>
        <div className="flex items-center gap-2">
          {result.riskLevel === 'CRITICAL' ? <AlertOctagon className={`w-5 h-5 ${cfg.text} animate-pulse`} /> : <ShieldAlert className={`w-4 h-4 ${cfg.text}`} />}
          <span className={`font-semibold text-sm ${cfg.text}`}>{tr('مؤشر التدهور', 'Deterioration Predictor')}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} ring-1 ring-current/20`}>
            {tr(cfg.labelAr, cfg.labelEn)}
          </span>
          {result.factors.length > 0 && (
            <span className="text-xs text-muted-foreground">{result.factors.length} {tr('عامل خطر', 'risk factor(s)')}</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Recommendation */}
          <div className={`p-2.5 rounded-lg ${cfg.bg} border ${cfg.border}`}>
            <p className={`text-xs font-semibold ${cfg.text}`}>
              <Zap className="h-3.5 w-3.5 inline mr-1" />{tr(result.recommendation.labelAr, result.recommendation.labelEn)}
            </p>
          </div>

          {/* Factors */}
          {result.factors.length > 0 && (
            <div className="space-y-1">
              {result.factors.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className={`w-2 h-2 rounded-full ${j < f.weight ? f.weight === 3 ? 'bg-red-500' : f.weight === 2 ? 'bg-orange-500' : 'bg-amber-400' : 'bg-muted'}`} />
                    ))}
                  </div>
                  <span className="font-medium text-muted-foreground w-12 shrink-0">{f.source}</span>
                  <span className="text-foreground flex-1">{tr(f.labelAr, f.labelEn)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Score bar */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{tr('مجموع الخطر:', 'Risk Score:')}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${result.riskLevel === 'CRITICAL' ? 'bg-red-500' : result.riskLevel === 'HIGH' ? 'bg-orange-500' : result.riskLevel === 'MODERATE' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${result.maxScore > 0 ? Math.min(100, (result.totalScore / Math.max(result.maxScore, 12)) * 100) : 0}%` }} />
            </div>
            <span className="font-medium">{result.totalScore}</span>
          </div>
        </div>
      )}
    </div>
  );
}
