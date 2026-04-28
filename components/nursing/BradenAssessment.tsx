'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Shield, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  type BradenInput, type BradenResult,
  DEFAULT_BRADEN, calculateBraden, RISK_CONFIG, BRADEN_SUBSCALES, RECOMMENDATION_LABELS,
} from '@/lib/clinical/bradenScale';

interface BradenAssessmentProps {
  initialData?: BradenInput | null;
  onChange?: (result: BradenResult) => void;
  compact?: boolean;
  disabled?: boolean;
}

export function BradenAssessment({ initialData, onChange, compact = false, disabled = false }: BradenAssessmentProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [input, setInput] = useState<BradenInput>(initialData || DEFAULT_BRADEN);
  const [expanded, setExpanded] = useState(!compact);

  const result = useMemo(() => calculateBraden(input), [input]);
  const cfg = RISK_CONFIG[result.risk];

  const updateField = useCallback((key: keyof BradenInput, value: number) => {
    if (disabled) return;
    const next = { ...input, [key]: value };
    setInput(next);
    onChange?.(calculateBraden(next));
  }, [input, disabled, onChange]);

  if (compact) {
    if (!initialData) return null;
    const compactResult = calculateBraden(initialData);
    const compactCfg = RISK_CONFIG[compactResult.risk];
    if (compactResult.risk === 'NO_RISK') return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${compactCfg.bgClass} ${compactCfg.colorClass}`}>
        <Shield className="w-3 h-3" /> {compactResult.totalScore}
      </span>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between p-3 ${cfg.bgClass} transition-colors`}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-600" />
          <span className="font-semibold text-sm text-violet-700">
            {tr('مقياس برادن — قرح الضغط', 'Braden Scale — Pressure Injury Risk')}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bgClass} ${cfg.colorClass}`}>
            {result.totalScore}/23 — {tr(cfg.labelAr, cfg.labelEn)}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Subscales */}
          {BRADEN_SUBSCALES.map(sub => {
            const val = input[sub.key];
            return (
              <div key={sub.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-foreground">{tr(sub.labelAr, sub.labelEn)}</label>
                  <span className={`text-xs font-bold ${val <= 2 ? 'text-red-600' : val <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {val}/{sub.maxScore}
                  </span>
                </div>
                <div className="flex gap-1">
                  {sub.options.map(opt => (
                    <button
                      key={opt.score}
                      onClick={() => updateField(sub.key, opt.score)}
                      disabled={disabled}
                      className={`flex-1 py-2 px-1 text-[11px] leading-tight rounded-lg font-medium border transition-all text-center
                        ${val === opt.score
                          ? opt.score <= 2
                            ? 'bg-red-600 text-white border-red-600'
                            : opt.score <= 3
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-card text-muted-foreground border-border hover:border-border'}
                        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="font-bold text-xs mb-0.5">{opt.score}</div>
                      {tr(opt.labelAr, opt.labelEn)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Score summary bar */}
          <div className={`p-3 rounded-lg ${cfg.bgClass}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-bold ${cfg.colorClass}`}>
                {tr('المجموع:', 'Total:')} {result.totalScore}/23
              </span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.colorClass} bg-white/60`}>
                {tr(cfg.labelAr, cfg.labelEn)}
              </span>
            </div>
            <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  result.risk === 'NO_RISK' ? 'bg-emerald-500'
                    : result.risk === 'MILD' ? 'bg-yellow-500'
                      : result.risk === 'MODERATE' ? 'bg-amber-500'
                        : result.risk === 'HIGH' ? 'bg-orange-500'
                          : 'bg-red-500'
                }`}
                style={{ width: `${Math.round((result.totalScore / 23) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5 text-muted-foreground">
              <span>6 ({tr('شديد', 'Severe')})</span>
              <span>23 ({tr('لا خطورة', 'No Risk')})</span>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {tr('التوصيات الوقائية', 'Preventive Recommendations')}
              </label>
              <div className="space-y-1">
                {result.recommendations.map(rec => {
                  const lbl = RECOMMENDATION_LABELS[rec];
                  return (
                    <div key={rec} className="flex items-center gap-2 text-xs p-1.5 bg-muted/50 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                      <span className="text-foreground">{lbl ? tr(lbl.labelAr, lbl.labelEn) : rec}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
