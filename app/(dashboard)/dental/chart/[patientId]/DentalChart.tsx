'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

const ADULT_TEETH = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft:  [21, 22, 23, 24, 25, 26, 27, 28],
  lowerLeft:  [31, 32, 33, 34, 35, 36, 37, 38],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
};

const CHILD_TEETH = {
  upperRight: [55, 54, 53, 52, 51],
  upperLeft:  [61, 62, 63, 64, 65],
  lowerLeft:  [71, 72, 73, 74, 75],
  lowerRight: [85, 84, 83, 82, 81],
};

const SURFACES = ['O', 'M', 'D', 'B', 'L'] as const;

const CONDITIONS_DATA = {
  healthy:    { color: '#ffffff', border: '#d1d5db', ar: 'سليم',        en: 'Healthy' },
  decay:      { color: '#ef4444', border: '#dc2626', ar: 'تسوس',        en: 'Decay' },
  filled:     { color: '#3b82f6', border: '#2563eb', ar: 'حشوة',        en: 'Filled' },
  crown:      { color: '#f59e0b', border: '#d97706', ar: 'تاج',         en: 'Crown' },
  missing:    { color: '#e5e7eb', border: '#9ca3af', ar: 'مفقود',       en: 'Missing' },
  implant:    { color: '#8b5cf6', border: '#7c3aed', ar: 'زرعة',        en: 'Implant' },
  rootCanal:  { color: '#ec4899', border: '#db2777', ar: 'علاج عصب',   en: 'Root Canal' },
  extraction: { color: '#dc2626', border: '#b91c1c', ar: 'خلع مطلوب',  en: 'Needs Extraction' },
  bridge:     { color: '#14b8a6', border: '#0d9488', ar: 'جسر',         en: 'Bridge' },
} as const;

type ConditionKey = keyof typeof CONDITIONS_DATA;

interface ToothCondition {
  toothNumber: number;
  surfaces: Record<string, ConditionKey>;
  notes: string;
  mobility?: number;
  pocket?: number[];
}

const SURFACE_NAMES: Record<string, { ar: string; en: string }> = {
  O: { ar: 'إطباقي', en: 'Occlusal' },
  M: { ar: 'إنسي',   en: 'Mesial' },
  D: { ar: 'وحشي',  en: 'Distal' },
  B: { ar: 'شفوي',  en: 'Buccal' },
  L: { ar: 'لساني', en: 'Lingual' },
};

export default function DentalChart() {
  const { patientId } = useParams();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [selectedTooth, setSelectedTooth]     = useState<number | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<string | null>(null);
  const [chartType, setChartType]             = useState<'adult' | 'child'>('adult');
  const [conditions, setConditions]           = useState<Record<number, ToothCondition>>({});
  const [currentCondition, setCurrentCondition] = useState<ConditionKey>('decay');
  const [saving, setSaving]                   = useState(false);
  const [saved, setSaved]                     = useState(false);

  const { data: patientData } = useSWR(`/api/patients/${patientId}`, fetcher);
  const { data: chartData, mutate } = useSWR(`/api/dental/chart/${patientId}`, fetcher);

  useEffect(() => {
    if (chartData?.conditions) {
      setConditions(chartData.conditions);
    }
  }, [chartData]);

  const teeth = chartType === 'adult' ? ADULT_TEETH : CHILD_TEETH;

  const applyCondition = (toothNumber: number, surface: string) => {
    setConditions((prev) => {
      const tooth = prev[toothNumber] || { toothNumber, surfaces: {}, notes: '' };
      return {
        ...prev,
        [toothNumber]: {
          ...tooth,
          surfaces: { ...tooth.surfaces, [surface]: currentCondition },
        },
      };
    });
  };

  const handleToothClick = (toothNumber: number, surface?: string) => {
    setSelectedTooth(toothNumber);
    if (surface) {
      setSelectedSurface(surface);
      applyCondition(toothNumber, surface);
    }
  };

  const saveChart = async () => {
    setSaving(true);
    await fetch(`/api/dental/chart/${patientId}`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conditions }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    mutate();
  };

  const ToothSVG = ({ number, condition }: { number: number; condition?: ToothCondition }) => {
    const isMissing = Object.values(condition?.surfaces || {}).includes('missing');
    const getColor = (surface: string) =>
      CONDITIONS_DATA[condition?.surfaces?.[surface] || 'healthy'].color;

    return (
      <div className="relative">
        <svg
          width="44"
          height="56"
          viewBox="0 0 50 60"
          className={`cursor-pointer transition-transform hover:scale-110 ${
            selectedTooth === number ? 'filter drop-shadow-lg' : ''
          }`}
          onClick={() => handleToothClick(number)}
        >
          {/* Tooth outline */}
          <rect
            x="5" y="5" width="40" height="50" rx="5"
            fill={isMissing ? '#f3f4f6' : '#ffffff'}
            stroke={selectedTooth === number ? '#3b82f6' : '#374151'}
            strokeWidth={selectedTooth === number ? 2.5 : 1.5}
          />
          {/* Occlusal (center) */}
          <rect x="15" y="20" width="20" height="20"
            fill={getColor('O')} stroke="#374151" strokeWidth="1"
            className="cursor-pointer hover:opacity-75"
            onClick={(e) => { e.stopPropagation(); handleToothClick(number, 'O'); }}
          />
          {/* Mesial (left) */}
          <rect x="5" y="15" width="10" height="30"
            fill={getColor('M')} stroke="#374151" strokeWidth="1"
            className="cursor-pointer hover:opacity-75"
            onClick={(e) => { e.stopPropagation(); handleToothClick(number, 'M'); }}
          />
          {/* Distal (right) */}
          <rect x="35" y="15" width="10" height="30"
            fill={getColor('D')} stroke="#374151" strokeWidth="1"
            className="cursor-pointer hover:opacity-75"
            onClick={(e) => { e.stopPropagation(); handleToothClick(number, 'D'); }}
          />
          {/* Buccal (top) */}
          <rect x="15" y="5" width="20" height="15"
            fill={getColor('B')} stroke="#374151" strokeWidth="1"
            className="cursor-pointer hover:opacity-75"
            onClick={(e) => { e.stopPropagation(); handleToothClick(number, 'B'); }}
          />
          {/* Lingual (bottom) */}
          <rect x="15" y="40" width="20" height="15"
            fill={getColor('L')} stroke="#374151" strokeWidth="1"
            className="cursor-pointer hover:opacity-75"
            onClick={(e) => { e.stopPropagation(); handleToothClick(number, 'L'); }}
          />
          {/* Tooth number */}
          <text x="25" y="58" textAnchor="middle" fontSize="9" fill="#6b7280" fontFamily="monospace">
            {number}
          </text>
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('مخطط الأسنان', 'Dental Chart')}</h1>
            <p className="text-muted-foreground">
              {patientData?.patient?.fullName || tr('جاري التحميل...', 'Loading...')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setChartType('adult')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  chartType === 'adult'
                    ? 'bg-blue-600 text-white'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {tr('بالغ', 'Adult')}
              </button>
              <button
                onClick={() => setChartType('child')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  chartType === 'child'
                    ? 'bg-blue-600 text-white'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {tr('طفل', 'Child')}
              </button>
            </div>
            <button
              onClick={saveChart}
              disabled={saving}
              className={`px-5 py-2 rounded-xl font-medium transition-colors ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } disabled:opacity-50`}
            >
              {saving ? tr('جاري الحفظ...', 'Saving...') : saved ? tr('تم الحفظ ✓', 'Saved ✓') : tr('حفظ المخطط', 'Save Chart')}
            </button>
          </div>
        </div>

        {/* Condition Selector */}
        <div className="bg-card rounded-2xl border border-border p-4 mb-5">
          <h3 className="font-medium text-foreground mb-3 text-sm">
            {tr('اختر الحالة للتطبيق على السطح:', 'Select condition to apply to surface:')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(CONDITIONS_DATA) as [ConditionKey, typeof CONDITIONS_DATA[ConditionKey]][]).map(
              ([key, value]) => (
                <button
                  key={key}
                  onClick={() => setCurrentCondition(key)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border-2 flex items-center gap-2 transition-all ${
                    currentCondition === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: value.color, border: `1px solid ${value.border}` }}
                  />
                  <span className="text-foreground">{tr(value.ar, value.en)}</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-card rounded-2xl border border-border p-6">
          {/* Upper jaw */}
          <div className="mb-6">
            <div className="text-center text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
              {tr('الفك العلوي', 'Upper Jaw')}
            </div>
            <div className="flex justify-center gap-0.5">
              <div className={`flex gap-0.5 border-border ${language === 'ar' ? 'border-l-2 pl-2' : 'border-r-2 pr-2'}`}>
                {teeth.upperRight.map((num) => (
                  <ToothSVG key={num} number={num} condition={conditions[num]} />
                ))}
              </div>
              <div className={`flex gap-0.5 border-border ${language === 'ar' ? 'border-r-2 pr-2' : 'border-l-2 pl-2'}`}>
                {teeth.upperLeft.map((num) => (
                  <ToothSVG key={num} number={num} condition={conditions[num]} />
                ))}
              </div>
            </div>
          </div>

          <div className="border-t-2 border-dashed border-border my-2" />

          {/* Lower jaw */}
          <div className="mt-6">
            <div className="flex justify-center gap-0.5">
              <div className={`flex gap-0.5 border-border ${language === 'ar' ? 'border-l-2 pl-2' : 'border-r-2 pr-2'}`}>
                {teeth.lowerRight.map((num) => (
                  <ToothSVG key={num} number={num} condition={conditions[num]} />
                ))}
              </div>
              <div className={`flex gap-0.5 border-border ${language === 'ar' ? 'border-r-2 pr-2' : 'border-l-2 pl-2'}`}>
                {teeth.lowerLeft.map((num) => (
                  <ToothSVG key={num} number={num} condition={conditions[num]} />
                ))}
              </div>
            </div>
            <div className="text-center text-xs font-medium text-muted-foreground mt-3 uppercase tracking-wide">
              {tr('الفك السفلي', 'Lower Jaw')}
            </div>
          </div>
        </div>

        {/* Selected Tooth Detail */}
        {selectedTooth && (
          <div className="mt-5 bg-card rounded-2xl border border-border p-5">
            <h3 className="font-bold text-foreground mb-4">
              {tr(`تفاصيل السن رقم ${selectedTooth}`, `Tooth #${selectedTooth} Details`)}
            </h3>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {SURFACES.map((surface) => {
                const surfaceName = SURFACE_NAMES[surface];
                const condKey = conditions[selectedTooth]?.surfaces?.[surface] || 'healthy';
                const cond = CONDITIONS_DATA[condKey];
                return (
                  <div key={surface} className="text-center">
                    <div className="text-xs text-muted-foreground mb-1 font-medium">
                      {tr(surfaceName.ar, surfaceName.en)}
                    </div>
                    <div
                      className={`w-12 h-12 mx-auto rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                        selectedSurface === surface ? 'border-blue-500 shadow-md' : 'border-border'
                      }`}
                      style={{ backgroundColor: cond.color }}
                      onClick={() => handleToothClick(selectedTooth, surface)}
                      title={tr(cond.ar, cond.en)}
                    />
                    <div className="text-xs text-muted-foreground mt-1">{surface}</div>
                  </div>
                );
              })}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {tr('ملاحظات السن', 'Tooth Notes')}
              </label>
              <textarea
                placeholder={tr('ملاحظات سريرية عن هذا السن...', 'Clinical notes for this tooth...')}
                value={conditions[selectedTooth]?.notes || ''}
                onChange={(e) =>
                  setConditions((prev) => ({
                    ...prev,
                    [selectedTooth]: {
                      ...prev[selectedTooth],
                      toothNumber: selectedTooth,
                      surfaces: prev[selectedTooth]?.surfaces || {},
                      notes: e.target.value,
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-border rounded-xl thea-input-focus bg-background text-foreground"
                rows={2}
              />
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-5 bg-muted/50 rounded-2xl p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">{tr('مفتاح الألوان', 'Color Legend')}</h4>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(CONDITIONS_DATA) as [ConditionKey, typeof CONDITIONS_DATA[ConditionKey]][]).map(
              ([key, value]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="w-3.5 h-3.5 rounded-sm inline-block"
                    style={{ backgroundColor: value.color, border: `1px solid ${value.border}` }}
                  />
                  <span className="text-xs text-muted-foreground">{tr(value.ar, value.en)}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
