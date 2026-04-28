'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { FlaskConical, Play, RotateCcw, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

type Scenario = {
  id: string;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  parameters: Array<{
    key: string;
    labelAr: string;
    labelEn: string;
    type: 'slider' | 'select';
    min?: number;
    max?: number;
    step?: number;
    defaultValue: number;
    options?: Array<{ value: number; labelAr: string; labelEn: string }>;
  }>;
};

const SCENARIOS: Scenario[] = [
  {
    id: 'vendor_loss',
    labelAr: 'فقدان مورد رئيسي',
    labelEn: 'Key Vendor Loss',
    descriptionAr: 'ماذا لو فقدنا مورد رئيسي فجأة؟',
    descriptionEn: 'What if we suddenly lose a key vendor?',
    parameters: [
      { key: 'vendorShare', labelAr: 'حصة المورد %', labelEn: 'Vendor Share %', type: 'slider', min: 10, max: 80, step: 5, defaultValue: 30 },
      { key: 'recoveryDays', labelAr: 'أيام التعافي', labelEn: 'Recovery Days', type: 'slider', min: 7, max: 90, step: 7, defaultValue: 30 },
    ],
  },
  {
    id: 'budget_cut',
    labelAr: 'تخفيض الميزانية',
    labelEn: 'Budget Cut',
    descriptionAr: 'تأثير تخفيض الميزانية على العمليات',
    descriptionEn: 'Impact of budget reduction on operations',
    parameters: [
      { key: 'cutPct', labelAr: 'نسبة التخفيض %', labelEn: 'Cut Percentage %', type: 'slider', min: 5, max: 40, step: 5, defaultValue: 15 },
    ],
  },
  {
    id: 'demand_spike',
    labelAr: 'ارتفاع مفاجئ بالطلب',
    labelEn: 'Demand Spike',
    descriptionAr: 'ارتفاع مفاجئ بالطلب على المستهلكات الطبية',
    descriptionEn: 'Sudden surge in demand for medical consumables',
    parameters: [
      { key: 'spikePct', labelAr: 'نسبة الارتفاع %', labelEn: 'Spike %', type: 'slider', min: 20, max: 200, step: 10, defaultValue: 50 },
      { key: 'duration', labelAr: 'المدة بالأيام', labelEn: 'Duration (days)', type: 'slider', min: 7, max: 60, step: 7, defaultValue: 14 },
    ],
  },
];

interface SimResult {
  riskDelta: number;
  costImpact: number;
  stockoutProbability: number;
  recommendations: Array<{ textAr: string; textEn: string; severity: 'low' | 'medium' | 'high' }>;
}

function simulateScenario(scenario: Scenario, params: Record<string, number>): SimResult {
  // Deterministic simulation with placeholder logic
  const base = scenario.id === 'vendor_loss'
    ? { riskDelta: (params.vendorShare || 30) * 0.8, costImpact: (params.vendorShare || 30) * 45000, stockoutProbability: Math.min((params.vendorShare || 30) * 1.2, 95) }
    : scenario.id === 'budget_cut'
      ? { riskDelta: (params.cutPct || 15) * 1.5, costImpact: -(params.cutPct || 15) * 120000, stockoutProbability: (params.cutPct || 15) * 2 }
      : { riskDelta: (params.spikePct || 50) * 0.4, costImpact: (params.spikePct || 50) * 30000, stockoutProbability: Math.min((params.spikePct || 50) * 0.6, 85) };

  return {
    ...base,
    recommendations: [
      { textAr: 'تنويع قاعدة الموردين', textEn: 'Diversify vendor base', severity: 'high' as const },
      { textAr: 'زيادة مخزون الأمان', textEn: 'Increase safety stock', severity: 'medium' as const },
      { textAr: 'تفعيل الاتفاقيات الاحتياطية', textEn: 'Activate backup agreements', severity: 'low' as const },
    ],
  };
}

export function WhatIfEngine() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    SCENARIOS[0].parameters.forEach((p) => { init[p.key] = p.defaultValue; });
    return init;
  });
  const [result, setResult] = useState<SimResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleSelectScenario = (s: Scenario) => {
    setSelectedScenario(s);
    const init: Record<string, number> = {};
    s.parameters.forEach((p) => { init[p.key] = p.defaultValue; });
    setParams(init);
    setResult(null);
  };

  const runSimulation = () => {
    setIsRunning(true);
    setTimeout(() => {
      setResult(simulateScenario(selectedScenario, params));
      setIsRunning(false);
    }, 800);
  };

  const resetSimulation = () => {
    const init: Record<string, number> = {};
    selectedScenario.parameters.forEach((p) => { init[p.key] = p.defaultValue; });
    setParams(init);
    setResult(null);
  };

  const fmtSAR = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  const severityColor = { low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-red-400' };

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-400" />
          {tr('محرك ماذا لو', 'What-If Engine')}
        </h3>
      </div>

      {/* Scenario selector */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            onClick={() => handleSelectScenario(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedScenario.id === s.id
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60'
            }`}
          >
            {tr(s.labelAr, s.labelEn)}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-xs text-white/40 mb-4">
        {tr(selectedScenario.descriptionAr, selectedScenario.descriptionEn)}
      </p>

      {/* Parameters */}
      <div className="space-y-4 mb-5">
        {selectedScenario.parameters.map((p) => (
          <div key={p.key}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-white/50">{tr(p.labelAr, p.labelEn)}</label>
              <span className="text-xs font-mono text-cyan-400">{params[p.key] ?? p.defaultValue}</span>
            </div>
            <input
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={params[p.key] ?? p.defaultValue}
              onChange={(e) => setParams({ ...params, [p.key]: Number(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none bg-white/[0.06] cursor-pointer accent-violet-500"
            />
            <div className="flex justify-between text-[9px] text-white/20 mt-0.5">
              <span>{p.min}</span>
              <span>{p.max}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={runSimulation}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30 text-xs font-medium hover:bg-violet-500/30 transition-colors disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5" />
          {isRunning ? tr('جاري المحاكاة...', 'Simulating...') : tr('تشغيل', 'Run')}
        </button>
        <button
          onClick={resetSimulation}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.03] text-white/40 border border-white/[0.06] text-xs font-medium hover:text-white/60 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {tr('إعادة', 'Reset')}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="border-t border-white/[0.06] pt-4 space-y-4">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            {tr('نتائج المحاكاة', 'Simulation Results')}
          </h4>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-red-400" />
              <p className="text-lg font-bold font-mono text-red-400">+{result.riskDelta.toFixed(0)}%</p>
              <p className="text-[10px] text-white/30">{tr('زيادة المخاطر', 'Risk Increase')}</p>
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-center">
              <TrendingDown className="h-4 w-4 mx-auto mb-1 text-amber-400" />
              <p className="text-lg font-bold font-mono text-amber-400">{fmtSAR(result.costImpact)} {tr('ر.س', 'SAR')}</p>
              <p className="text-[10px] text-white/30">{tr('التأثير المالي', 'Cost Impact')}</p>
            </div>
            <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-center">
              <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-orange-400" />
              <p className="text-lg font-bold font-mono text-orange-400">{result.stockoutProbability.toFixed(0)}%</p>
              <p className="text-[10px] text-white/30">{tr('احتمال النفاد', 'Stockout Prob.')}</p>
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h5 className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
              {tr('التوصيات', 'Recommendations')}
            </h5>
            <div className="space-y-1.5">
              {result.recommendations.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.severity === 'high' ? 'bg-red-500' : r.severity === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className={`text-xs ${severityColor[r.severity]}`}>
                    {tr(r.textAr, r.textEn)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
