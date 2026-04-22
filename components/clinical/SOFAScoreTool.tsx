'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Wind, Droplets, Scan, Heart, Brain, Bean } from 'lucide-react';
import {
  calculateSOFA,
  SOFA_SUBSCORE_LABELS,
  CV_SOFA_OPTIONS,
  type SOFAInput,
  type CVSOFALevel,
  type SOFAResult,
} from '@/lib/clinical/sofaScore';

const EMPTY_INPUT: SOFAInput = {
  pfRatio: null,
  onVentilator: false,
  platelets: null,
  bilirubin: null,
  cardiovascular: { map: null, vasopressors: 'none' },
  gcs: null,
  renal: { creatinine: null, urineOutput24h: null },
};

const RISK_STYLES: Record<SOFAResult['color'], string> = {
  green:  'bg-emerald-50 border-emerald-300 text-emerald-800',
  yellow: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  orange: 'bg-orange-50 border-orange-300 text-orange-800',
  red:    'bg-red-50 border-red-300 text-red-800',
  purple: 'bg-purple-50 border-purple-300 text-purple-800',
};

const SCORE_BAR_COLOR: Record<number, string> = {
  0: 'bg-emerald-400',
  1: 'bg-yellow-400',
  2: 'bg-orange-400',
  3: 'bg-red-500',
  4: 'bg-purple-600',
};

function NumInput({
  label, value, onChange, placeholder, min, max, step,
}: {
  label: string; value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        type="number"
        value={value ?? ''}
        min={min}
        max={max}
        step={step ?? 1}
        placeholder={placeholder ?? '—'}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

interface SOFAScoreToolProps {
  /** Called when a result is calculated — useful for saving */
  onResult?: (result: SOFAResult, input: SOFAInput) => void;
}

export function SOFAScoreTool({ onResult }: SOFAScoreToolProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [inp, setInp] = useState<SOFAInput>(EMPTY_INPUT);
  const [result, setResult] = useState<SOFAResult | null>(null);

  const patch = (partial: Partial<SOFAInput>) =>
    setInp((prev) => ({ ...prev, ...partial }));

  const handleCalculate = () => {
    const r = calculateSOFA(inp);
    setResult(r);
    onResult?.(r, inp);
  };

  const handleReset = () => {
    setInp(EMPTY_INPUT);
    setResult(null);
  };

  const subscores: Array<{ key: keyof typeof SOFA_SUBSCORE_LABELS; score: number }> = result
    ? [
        { key: 'respiration', score: result.respiration },
        { key: 'coagulation', score: result.coagulation },
        { key: 'liver', score: result.liver },
        { key: 'cardiovascular', score: result.cardiovascular },
        { key: 'cns', score: result.cns },
        { key: 'renal', score: result.renal },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">
            {tr('مقياس SOFA لفشل الأعضاء', 'SOFA Score — Organ Failure Assessment')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tr('تقييم وظائف 6 أجهزة • النتيجة الكاملة 0–24', '6 organ systems • Total score 0–24')}
          </p>
        </div>
        {result && (
          <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
            {tr('إعادة تعيين', 'Reset')}
          </button>
        )}
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Respiration */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Wind className="h-4 w-4" /> {tr('التنفس', 'Respiration')}
          </div>
          <NumInput
            label={tr('نسبة PaO₂/FiO₂ (mmHg)', 'PaO₂/FiO₂ ratio (mmHg)')}
            value={inp.pfRatio}
            onChange={(v) => patch({ pfRatio: v })}
            placeholder="e.g. 320"
            min={0}
          />
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={inp.onVentilator}
              onChange={(e) => patch({ onVentilator: e.target.checked })}
              className="rounded"
            />
            {tr('على التنفس الاصطناعي', 'Mechanically ventilated')}
          </label>
        </div>

        {/* Coagulation */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Droplets className="h-4 w-4" /> {tr('التخثر', 'Coagulation')}
          </div>
          <NumInput
            label={tr('الصفائح الدموية ×10³/μL', 'Platelets ×10³/μL')}
            value={inp.platelets}
            onChange={(v) => patch({ platelets: v })}
            placeholder="e.g. 150"
            min={0}
          />
        </div>

        {/* Liver */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Scan className="h-4 w-4" /> {tr('الكبد', 'Liver')}
          </div>
          <NumInput
            label={tr('البيليروبين (mg/dL)', 'Bilirubin (mg/dL)')}
            value={inp.bilirubin}
            onChange={(v) => patch({ bilirubin: v })}
            placeholder="e.g. 1.0"
            min={0}
            step={0.1}
          />
        </div>

        {/* Cardiovascular */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Heart className="h-4 w-4" /> {tr('القلب والأوعية', 'Cardiovascular')}
          </div>
          <NumInput
            label={tr('متوسط الضغط الشرياني MAP (mmHg)', 'Mean Arterial Pressure MAP (mmHg)')}
            value={inp.cardiovascular.map}
            onChange={(v) =>
              patch({ cardiovascular: { ...inp.cardiovascular, map: v } })
            }
            placeholder="e.g. 75"
            min={0}
          />
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {tr('ضاغطات الأوعية', 'Vasopressors')}
            </label>
            <select
              value={inp.cardiovascular.vasopressors}
              onChange={(e) =>
                patch({
                  cardiovascular: {
                    ...inp.cardiovascular,
                    vasopressors: e.target.value as CVSOFALevel,
                  },
                })
              }
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CV_SOFA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {language === 'ar' ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CNS */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Brain className="h-4 w-4" /> {tr('الجهاز العصبي', 'CNS')}
          </div>
          <NumInput
            label={tr('مقياس غلاسكو GCS (3–15)', 'Glasgow Coma Scale GCS (3–15)')}
            value={inp.gcs}
            onChange={(v) => patch({ gcs: v })}
            placeholder="e.g. 15"
            min={3}
            max={15}
          />
          {/* GCS quick reference */}
          <div className="text-[11px] text-muted-foreground space-y-0.5">
            <div>15 = {tr('طبيعي', 'Normal')} · 13–14 = {tr('مرتبك', 'Confused')}</div>
            <div>10–12 = {tr('نعسان', 'Drowsy')} · 6–9 = {tr('شبه غيبوبة', 'Stupor')} · &lt;6 = {tr('غيبوبة', 'Coma')}</div>
          </div>
        </div>

        {/* Renal */}
        <div className="bg-muted/30 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Bean className="h-4 w-4" /> {tr('الكلى', 'Renal')}
          </div>
          <NumInput
            label={tr('الكرياتينين (mg/dL)', 'Creatinine (mg/dL)')}
            value={inp.renal.creatinine}
            onChange={(v) => patch({ renal: { ...inp.renal, creatinine: v } })}
            placeholder="e.g. 1.0"
            min={0}
            step={0.1}
          />
          <NumInput
            label={tr('حجم البول خلال 24 ساعة (mL)', 'Urine Output 24h (mL)')}
            value={inp.renal.urineOutput24h}
            onChange={(v) => patch({ renal: { ...inp.renal, urineOutput24h: v } })}
            placeholder="e.g. 1200"
            min={0}
          />
        </div>
      </div>

      {/* Calculate Button */}
      <button
        onClick={handleCalculate}
        className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors text-sm"
      >
        {tr('احسب SOFA', 'Calculate SOFA Score')}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Total Badge */}
          <div className={`rounded-2xl border-2 p-5 ${RISK_STYLES[result.color]}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold">{result.total}</div>
                <div className="text-sm font-semibold mt-0.5">
                  {tr('النتيجة الكلية لـ SOFA', 'Total SOFA Score')} / 24
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">
                  {language === 'ar' ? result.riskLabelAr : result.riskLabel}
                </div>
                <div className="text-sm opacity-80">
                  {tr('خطر الوفاة:', 'Predicted mortality:')} {result.mortalityRange}
                </div>
              </div>
            </div>
          </div>

          {/* Subscores */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {tr('النتائج الفرعية', 'Subscores')}
              </span>
            </div>
            <div className="divide-y divide-border/50">
              {subscores.map(({ key, score }) => {
                const lbl = SOFA_SUBSCORE_LABELS[key];
                return (
                  <div key={key} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {language === 'ar' ? lbl.labelAr : lbl.labelEn}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {language === 'ar' ? lbl.unitAr : lbl.unitEn}
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2, 3, 4].map((s) => (
                        <div
                          key={s}
                          className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white transition-colors ${
                            s <= score ? SCORE_BAR_COLOR[score] : 'bg-muted'
                          }`}
                        >
                          {s === score ? score : ''}
                        </div>
                      ))}
                    </div>
                    <div className="w-6 text-center font-bold text-lg text-foreground">{score}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
