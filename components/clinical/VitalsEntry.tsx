'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Activity, Heart, Thermometer, Wind, Droplets, Ruler, Scale, Baby, Stethoscope } from 'lucide-react';
import { validateVitals, VitalsValidationResult, getBMICategory } from '@/lib/clinical/vitalsValidation';

export interface VitalsEntryValues {
  bp: string;
  hr: string;
  rr: string;
  temp: string;
  spo2: string;
  weight: string;
  height: string;
  painScore: number | null;
  painLocation: string;
  glucose: string;
  headCircumference: string;
  fetalHr: string;
  fundalHeight: string;
}

interface Props {
  value?: VitalsEntryValues;
  onChange?: (value: VitalsEntryValues) => void;
  onValidation?: (result: VitalsValidationResult) => void;
  disabled?: boolean;
  showPediatric?: boolean;
  showObstetric?: boolean;
  language?: 'ar' | 'en';
}

const EMPTY_VALUES: VitalsEntryValues = {
  bp: '',
  hr: '',
  rr: '',
  temp: '',
  spo2: '',
  weight: '',
  height: '',
  painScore: null,
  painLocation: '',
  glucose: '',
  headCircumference: '',
  fetalHr: '',
  fundalHeight: '',
};

export function VitalsEntry({
  value,
  onChange,
  onValidation,
  disabled,
  showPediatric = false,
  showObstetric = false,
  language = 'ar',
}: Props) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const [internal, setInternal] = useState<VitalsEntryValues>(value || EMPTY_VALUES);

  const current = value || internal;

  useEffect(() => {
    if (value) setInternal(value);
  }, [value]);

  const updateValue = (patch: Partial<VitalsEntryValues>) => {
    const next = { ...current, ...patch };
    if (onChange) onChange(next);
    if (!value) setInternal(next);
  };

  const bmiValue = useMemo(() => {
    const weight = Number(current.weight || 0);
    const height = Number(current.height || 0);
    if (!weight || !height) return null;
    const bmi = weight / ((height / 100) ** 2);
    return Math.round(bmi * 10) / 10;
  }, [current.weight, current.height]);

  const validation = useMemo(() => {
    return validateVitals({
      bp: current.bp || undefined,
      hr: current.hr ? Number(current.hr) : undefined,
      temp: current.temp ? Number(current.temp) : undefined,
      rr: current.rr ? Number(current.rr) : undefined,
      spo2: current.spo2 ? Number(current.spo2) : undefined,
      weight: current.weight ? Number(current.weight) : undefined,
      height: current.height ? Number(current.height) : undefined,
    });
  }, [current]);

  useEffect(() => {
    if (onValidation) onValidation(validation);
  }, [validation, onValidation]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field
            label={tr('ضغط الدم', 'Blood Pressure')}
            icon={<Heart className="w-4 h-4 text-red-600" />}
            value={current.bp}
            onChange={(value) => updateValue({ bp: value })}
            placeholder="120/80"
            disabled={disabled}
            unit={tr('ملم زئبقي', 'mmHg')}
          />
        </div>
        <Field
          label={tr('معدل النبض', 'Heart Rate')}
          icon={<Activity className="w-4 h-4 text-pink-600" />}
          value={current.hr}
          onChange={(value) => updateValue({ hr: value })}
          placeholder="72"
          disabled={disabled}
          unit={tr('نبضة/د', 'bpm')}
        />
        <Field
          label={tr('الحرارة', 'Temperature')}
          icon={<Thermometer className="w-4 h-4 text-orange-600" />}
          value={current.temp}
          onChange={(value) => updateValue({ temp: value })}
          placeholder="37.0"
          disabled={disabled}
          unit={tr('°م', '°C')}
        />
        <Field
          label={tr('معدل التنفس', 'Resp. Rate')}
          icon={<Wind className="w-4 h-4 text-cyan-600" />}
          value={current.rr}
          onChange={(value) => updateValue({ rr: value })}
          placeholder="16"
          disabled={disabled}
          unit={tr('نفس/د', '/min')}
        />
        <Field
          label={tr('تشبع الأكسجين', 'SpO\u2082')}
          icon={<Droplets className="w-4 h-4 text-blue-600" />}
          value={current.spo2}
          onChange={(value) => updateValue({ spo2: value })}
          placeholder="98"
          disabled={disabled}
          unit="%"
        />
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{tr('القياسات الجسمية', 'Anthropometry')}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={tr('الوزن', 'Weight')}
            icon={<Scale className="w-4 h-4 text-violet-600" />}
            value={current.weight}
            onChange={(value) => updateValue({ weight: value })}
            placeholder="70"
            disabled={disabled}
            unit={tr('كجم', 'kg')}
          />
          <Field
            label={tr('الطول', 'Height')}
            icon={<Ruler className="w-4 h-4 text-indigo-600" />}
            value={current.height}
            onChange={(value) => updateValue({ height: value })}
            placeholder="170"
            disabled={disabled}
            unit={tr('سم', 'cm')}
          />
        </div>
        {bmiValue !== null && (() => {
          const cat = getBMICategory(bmiValue);
          return (
            <div className={`mt-3 flex items-center gap-3 p-3 rounded-xl border border-slate-200 ${cat.bg}`}>
              <div className="text-sm text-slate-500">{tr('مؤشر كتلة الجسم', 'BMI')}</div>
              <div className="text-2xl font-bold text-slate-900">{bmiValue}</div>
              <span className={`text-sm font-medium ${cat.color}`}>
                {cat.icon} {language === 'en' && cat.labelEn ? cat.labelEn : cat.label}
              </span>
            </div>
          );
        })()}
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{tr('مقياس الألم', 'Pain Scale')}</div>
        <div className="flex gap-1.5 flex-wrap">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              onClick={() => updateValue({ painScore: n })}
              disabled={disabled}
              className={`flex-1 min-w-[36px] py-2 rounded-lg text-xs font-bold transition-all ${
                current.painScore === n
                  ? n <= 3
                    ? 'bg-emerald-500 text-white'
                    : n <= 6
                      ? 'bg-amber-500 text-white'
                      : 'bg-red-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <label className="text-xs text-slate-500">{tr('موقع الألم', 'Pain Location')}</label>
          <input
            value={current.painLocation}
            onChange={(e) => updateValue({ painLocation: e.target.value })}
            placeholder={tr('الموقع...', 'Location...')}
            disabled={disabled}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{tr('إضافي', 'Additional')}</div>
        <Field
          label={tr('السكر في الدم', 'Blood Glucose')}
          icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
          value={current.glucose}
          onChange={(value) => updateValue({ glucose: value })}
          placeholder="120"
          disabled={disabled}
          unit="mg/dL"
        />
      </div>

      {showPediatric && (
        <div className="border-t border-slate-200 pt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{tr('الأطفال', 'Pediatric')}</div>
          <Field
            label={tr('محيط الرأس', 'Head Circumference')}
            icon={<Baby className="w-4 h-4 text-pink-600" />}
            value={current.headCircumference}
            onChange={(value) => updateValue({ headCircumference: value })}
            placeholder="34"
            disabled={disabled}
            unit={tr('سم', 'cm')}
          />
        </div>
      )}

      {showObstetric && (
        <div className="border-t border-slate-200 pt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{tr('التوليد', 'Obstetric')}</div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={tr('نبض الجنين', 'Fetal HR')}
              icon={<Stethoscope className="w-4 h-4 text-emerald-600" />}
              value={current.fetalHr}
              onChange={(value) => updateValue({ fetalHr: value })}
              placeholder="140"
              disabled={disabled}
              unit={tr('نبضة/د', 'bpm')}
            />
            <Field
              label={tr('ارتفاع قاع الرحم', 'Fundal Height')}
              icon={<Ruler className="w-4 h-4 text-emerald-600" />}
              value={current.fundalHeight}
              onChange={(value) => updateValue({ fundalHeight: value })}
              placeholder="28"
              disabled={disabled}
              unit={tr('سم', 'cm')}
            />
          </div>
        </div>
      )}

      {validation.criticalAlerts.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-semibold text-red-800 mb-1">{tr('تنبيهات حرجة', 'Critical alerts')}</div>
          {validation.criticalAlerts.map((alert, i) => (
            <div key={i} className="text-sm text-red-700">
              {alert}
            </div>
          ))}
        </div>
      )}
      {validation.errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-semibold text-red-800 mb-1">{tr('أخطاء', 'Errors')}</div>
          {validation.errors.map((err, i) => (
            <div key={i} className="text-sm text-red-700">
              {err}
            </div>
          ))}
        </div>
      )}
      {validation.warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-sm font-semibold text-amber-800 mb-1">{tr('تحذيرات', 'Warnings')}</div>
          {validation.warnings.map((warn, i) => (
            <div key={i} className="text-sm text-amber-700">
              {warn}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  unit,
  icon,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  unit?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}
