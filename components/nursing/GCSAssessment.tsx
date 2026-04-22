'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Brain, ChevronDown, ChevronUp, AlertTriangle, Shield, ShieldAlert } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  calculateGCS, DEFAULT_GCS,
  GCS_EYE_OPTIONS, GCS_VERBAL_OPTIONS, GCS_VERBAL_PEDIATRIC_OPTIONS, GCS_MOTOR_OPTIONS,
  type GCSInput, type GCSResult,
} from '@/lib/clinical/gcsCalculator';
import { getPatientAgeYears } from '@/lib/clinical/fallRiskCalculator';

interface GCSAssessmentProps {
  patientDob?: string | Date | null;
  initialData?: any;
  onChange?: (result: GCSResult & { input: GCSInput }) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function GCSAssessment({ patientDob, initialData, onChange, disabled = false, compact = false }: GCSAssessmentProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const ageYears = getPatientAgeYears(patientDob);
  const isPediatric = ageYears !== null && ageYears < 2;

  const [gcs, setGcs] = useState<GCSInput>({ ...DEFAULT_GCS });
  const [intubated, setIntubated] = useState(false);
  const [showDetails, setShowDetails] = useState(!compact);
  const hasLoadedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    if (!initialData || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    if (initialData.eye != null) {
      setGcs({
        eye: initialData.eye ?? 4,
        verbal: initialData.verbal ?? 5,
        motor: initialData.motor ?? 6,
      });
      if (initialData.intubated != null) setIntubated(initialData.intubated);
    }
  }, [initialData]);

  const result = useMemo(() => calculateGCS(gcs, { intubated, isPediatric }), [gcs, intubated, isPediatric]);

  useEffect(() => {
    if (onChangeRef.current) {
      onChangeRef.current({ ...result, input: gcs });
    }
  }, [result]);

  const verbalOptions = isPediatric ? GCS_VERBAL_PEDIATRIC_OPTIONS : GCS_VERBAL_OPTIONS;

  if (compact) {
    const CategoryIcon = result.category === 'SEVERE' ? ShieldAlert : result.category === 'MODERATE' ? AlertTriangle : Shield;
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${result.bgClass} ${result.colorClass}`}>
        <Brain size={12} />
        <span>GCS {result.totalScore}/15</span>
        <CategoryIcon size={11} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border overflow-hidden ${result.bgClass} border-current/10`}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`w-full flex items-center justify-between px-3 py-2.5 ${result.colorClass}`}
        >
          <div className="flex items-center gap-2">
            <Brain size={18} />
            <span className="text-sm font-bold">
              GCS: E{result.eye} V{intubated ? 'T' : result.verbal} M{result.motor} = {result.totalScore}
              <span className="font-normal text-xs ml-1 opacity-80">/ 15</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              result.category === 'SEVERE' ? 'bg-red-200/60' :
              result.category === 'MODERATE' ? 'bg-amber-200/60' :
              'bg-emerald-200/60'
            }`}>
              {language === 'ar' ? result.labelAr : result.labelEn}
            </span>
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showDetails && (
          <div className="bg-white/60 dark:bg-black/10 p-3 space-y-4">
            {isPediatric && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
                <AlertTriangle size={12} />
                {tr('مقياس الأطفال (أقل من سنتين)', 'Pediatric scale (< 2 years)')}
              </div>
            )}

            {/* Eye Opening */}
            <ScaleSection
              label={tr('فتح العين (E)', 'Eye Opening (E)')}
              options={GCS_EYE_OPTIONS}
              value={gcs.eye}
              maxScore={4}
              onSelect={(v) => !disabled && setGcs({ ...gcs, eye: v })}
              disabled={disabled}
              language={language}
              colorClass={result.colorClass}
            />

            {/* Verbal Response */}
            <div>
              <ScaleSection
                label={tr(
                  isPediatric ? 'الاستجابة اللفظية — أطفال (V)' : 'الاستجابة اللفظية (V)',
                  isPediatric ? 'Verbal Response — Pediatric (V)' : 'Verbal Response (V)'
                )}
                options={verbalOptions}
                value={gcs.verbal}
                maxScore={5}
                onSelect={(v) => !disabled && setGcs({ ...gcs, verbal: v })}
                disabled={disabled || intubated}
                language={language}
                colorClass={result.colorClass}
              />
              <label className="flex items-center gap-2 cursor-pointer mt-2 ml-1">
                <input
                  type="checkbox"
                  checked={intubated}
                  onChange={(e) => {
                    if (disabled) return;
                    setIntubated(e.target.checked);
                    if (e.target.checked) setGcs({ ...gcs, verbal: 1 });
                  }}
                  disabled={disabled}
                  className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                  {tr('المريض على أنبوب حنجري (T) — الاستجابة اللفظية = 1', 'Patient intubated (T) — Verbal = 1')}
                </span>
              </label>
            </div>

            {/* Motor Response */}
            <ScaleSection
              label={tr('الاستجابة الحركية (M)', 'Motor Response (M)')}
              options={GCS_MOTOR_OPTIONS}
              value={gcs.motor}
              maxScore={6}
              onSelect={(v) => !disabled && setGcs({ ...gcs, motor: v })}
              disabled={disabled}
              language={language}
              colorClass={result.colorClass}
            />

            {/* Clinical response */}
            <div className={`rounded-lg px-3 py-2 text-xs ${result.bgClass} ${result.colorClass} border border-current/10`}>
              <div className="font-semibold mb-0.5">{tr('الاستجابة السريرية', 'Clinical Response')}</div>
              <div>{language === 'ar' ? result.clinicalResponseAr : result.clinicalResponseEn}</div>
            </div>

            {/* Visual bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{tr('شديد', 'Severe')} (3–8)</span>
                <span>{tr('متوسط', 'Moderate')} (9–12)</span>
                <span>{tr('خفيف', 'Mild')} (13–15)</span>
              </div>
              <div className="relative h-3 rounded-full overflow-hidden flex">
                <div className="bg-red-400/40 flex-[6]" />
                <div className="bg-amber-400/40 flex-[4]" />
                <div className="bg-emerald-400/40 flex-[3]" />
                <div
                  className={`absolute top-0 h-full w-1 rounded-full ${
                    result.category === 'SEVERE' ? 'bg-red-600' :
                    result.category === 'MODERATE' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}
                  style={{ left: `${((result.totalScore - 3) / 12) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScaleSection({ label, options, value, maxScore, onSelect, disabled, language, colorClass }: {
  label: string;
  options: { value: number; labelAr: string; labelEn: string }[];
  value: number;
  maxScore: number;
  onSelect: (v: number) => void;
  disabled: boolean;
  language: 'ar' | 'en';
  colorClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className={`text-xs font-bold ${colorClass}`}>{value}/{maxScore}</span>
      </div>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            disabled={disabled}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
              value === opt.value
                ? 'bg-primary/10 border border-primary/30 text-foreground font-medium'
                : 'bg-muted/30 border border-transparent text-muted-foreground hover:bg-muted'
            }`}
          >
            <span>{language === 'ar' ? opt.labelAr : opt.labelEn}</span>
            {value === opt.value && (
              <span className="w-5 text-center text-[10px] font-bold text-primary">{opt.value}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
