'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Shield, ShieldAlert, CheckCircle2, Baby, User, Check } from 'lucide-react';
import { useLang } from '@/hooks/use-lang';
import {
  calculateMorseFall, calculateHumptyDumpty,
  getPatientAgeYears, getRecommendedScale, getHumptyDumptyAgeCategory,
  DEFAULT_MORSE, DEFAULT_HUMPTY_DUMPTY,
  MORSE_OPTIONS, HUMPTY_DUMPTY_OPTIONS,
  type MorseFallInput, type HumptyDumptyInput, type FallRiskResult,
} from '@/lib/clinical/fallRiskCalculator';

interface FallRiskAssessmentProps {
  patientDob?: string | Date | null;
  patientGender?: 'MALE' | 'FEMALE' | string | null;
  initialData?: any;
  onChange?: (result: FallRiskResult & { input: MorseFallInput | HumptyDumptyInput }) => void;
  disabled?: boolean;
}

export function FallRiskAssessment({ patientDob, patientGender, initialData, onChange, disabled = false }: FallRiskAssessmentProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const ageYears = getPatientAgeYears(patientDob);
  const recommendedScale = getRecommendedScale(ageYears);
  const [scaleOverride, setScaleOverride] = useState<'MORSE' | 'HUMPTY_DUMPTY' | null>(null);
  const activeScale = scaleOverride || recommendedScale;

  const [morse, setMorse] = useState<MorseFallInput>({ ...DEFAULT_MORSE });
  const [humpty, setHumpty] = useState<HumptyDumptyInput>(() => {
    const defaults = { ...DEFAULT_HUMPTY_DUMPTY };
    if (ageYears !== null) defaults.age = getHumptyDumptyAgeCategory(ageYears);
    if (patientGender === 'MALE' || patientGender === 'FEMALE') defaults.gender = patientGender;
    return defaults;
  });
  const [showDetails, setShowDetails] = useState(true);
  const [showInterventions, setShowInterventions] = useState(false);
  const hasLoadedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    if (!initialData || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    if (initialData.scale === 'MORSE' && initialData.morseInput) {
      setMorse(initialData.morseInput);
      setScaleOverride('MORSE');
    } else if (initialData.scale === 'HUMPTY_DUMPTY' && initialData.humptyInput) {
      setHumpty(initialData.humptyInput);
      setScaleOverride('HUMPTY_DUMPTY');
    }
  }, [initialData]);

  const result: FallRiskResult = useMemo(() => {
    if (activeScale === 'HUMPTY_DUMPTY') return calculateHumptyDumpty(humpty);
    return calculateMorseFall(morse);
  }, [activeScale, morse, humpty]);

  useEffect(() => {
    if (onChangeRef.current) {
      const input = activeScale === 'HUMPTY_DUMPTY' ? humpty : morse;
      onChangeRef.current({ ...result, input });
    }
  }, [result]);

  const ScaleIcon = activeScale === 'HUMPTY_DUMPTY' ? Baby : User;

  return (
    <div className="space-y-3">
      {/* Scale selector */}
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {tr('تقييم خطر السقوط', 'Fall Risk Assessment')}
        </label>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => !disabled && setScaleOverride('MORSE')}
            disabled={disabled}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${activeScale === 'MORSE' ? 'bg-white dark:bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <User size={12} />
            Morse
            {ageYears !== null && ageYears >= 18 && <Check className="w-2.5 h-2.5 text-emerald-600" />}
          </button>
          <button
            onClick={() => !disabled && setScaleOverride('HUMPTY_DUMPTY')}
            disabled={disabled}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${activeScale === 'HUMPTY_DUMPTY' ? 'bg-white dark:bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Baby size={12} />
            Humpty Dumpty
            {ageYears !== null && ageYears < 18 && <Check className="w-2.5 h-2.5 text-emerald-600" />}
          </button>
        </div>
      </div>

      {ageYears !== null && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ScaleIcon size={12} />
          <span>
            {tr('عمر المريض', 'Patient age')}: {ageYears} {tr('سنة', 'years')} →{' '}
            <span className="font-medium text-foreground">
              {recommendedScale === 'HUMPTY_DUMPTY' ? 'Humpty Dumpty (pediatric)' : 'Morse (adult)'}
            </span>
            {scaleOverride && scaleOverride !== recommendedScale && (
              <span className="text-amber-600 ml-1">({tr('تم تغييره يدوياً', 'manually overridden')})</span>
            )}
          </span>
        </div>
      )}

      {/* Score summary */}
      <div className={`rounded-xl border overflow-hidden ${result.bgClass} border-current/10`}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`w-full flex items-center justify-between px-3 py-2.5 ${result.colorClass}`}
        >
          <div className="flex items-center gap-2">
            {result.riskLevel === 'HIGH' ? <ShieldAlert size={18} /> : result.riskLevel === 'MODERATE' ? <AlertTriangle size={18} /> : <Shield size={18} />}
            <span className="text-sm font-bold">
              {activeScale === 'MORSE' ? 'Morse' : 'Humpty Dumpty'}: {result.totalScore}
              <span className="font-normal text-xs ml-1 opacity-80">
                / {activeScale === 'MORSE' ? '125' : '23'}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${result.riskLevel === 'HIGH' ? 'bg-red-200/60' : result.riskLevel === 'MODERATE' ? 'bg-amber-200/60' : 'bg-emerald-200/60'}`}>
              {language === 'ar' ? result.labelAr : result.labelEn}
            </span>
            <span className={`w-3 h-3 rounded-full border-2 ${result.wristbandColor === 'red' ? 'bg-red-500 border-red-600' : result.wristbandColor === 'yellow' ? 'bg-yellow-400 border-yellow-500' : 'bg-emerald-500 border-emerald-600'}`} title={tr('لون السوار', 'Wristband color')} />
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showDetails && (
          <div className="bg-white/60 dark:bg-black/10 p-3 space-y-3">
            {activeScale === 'MORSE' ? (
              <MorseForm morse={morse} setMorse={setMorse} disabled={disabled} language={language} />
            ) : (
              <HumptyDumptyForm humpty={humpty} setHumpty={setHumpty} disabled={disabled} language={language} />
            )}

            {/* Interventions */}
            <button
              onClick={() => setShowInterventions(!showInterventions)}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCircle2 size={12} />
              {tr('الإجراءات الوقائية المطلوبة', 'Required preventive interventions')}
              {showInterventions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showInterventions && (
              <div className="space-y-1.5 pl-4">
                {(language === 'ar' ? result.interventionsAr : result.interventionsEn).map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Morse Form ───

function MorseForm({ morse, setMorse, disabled, language }: { morse: MorseFallInput; setMorse: (v: MorseFallInput) => void; disabled: boolean; language: 'ar' | 'en' }) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const BooleanRow = ({ label, labelEn, field, score }: { label: string; labelEn: string; field: keyof MorseFallInput; score: number }) => (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-foreground">{tr(label, labelEn)}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => !disabled && setMorse({ ...morse, [field]: !(morse[field] as boolean) })}
          disabled={disabled}
          className={`w-12 h-6 rounded-full transition-all relative ${(morse[field] as boolean) ? 'bg-red-500' : 'bg-muted'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card shadow transition-all ${(morse[field] as boolean) ? 'left-6' : 'left-0.5'}`} />
        </button>
        <span className={`w-6 text-center text-xs font-bold rounded ${(morse[field] as boolean) ? 'bg-red-100 text-red-700' : 'text-muted-foreground'}`}>
          {(morse[field] as boolean) ? score : 0}
        </span>
      </div>
    </div>
  );

  const SelectRow = ({ label, labelEn, options, value, onSelect }: { label: string; labelEn: string; options: { value: string; labelAr: string; labelEn: string; score: number }[]; value: string; onSelect: (v: any) => void }) => (
    <div className="py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-foreground font-medium block mb-1.5">{tr(label, labelEn)}</span>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !disabled && onSelect(opt.value)}
            disabled={disabled}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${value === opt.value ? 'bg-primary/10 border border-primary/30 text-foreground font-medium' : 'bg-muted/30 border border-transparent text-muted-foreground hover:bg-muted'}`}
          >
            <span>{language === 'ar' ? opt.labelAr : opt.labelEn}</span>
            <span className={`w-6 text-center text-[10px] font-bold rounded ${opt.score > 0 && value === opt.value ? 'bg-red-100 text-red-700' : 'text-muted-foreground'}`}>{value === opt.value ? opt.score : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-0.5">
      <BooleanRow label="تاريخ سقوط (خلال 3 أشهر)" labelEn="History of falling (past 3 months)" field="historyOfFalling" score={25} />
      <BooleanRow label="تشخيص ثانوي (أكثر من تشخيص)" labelEn="Secondary diagnosis (> 1 diagnosis)" field="secondaryDiagnosis" score={15} />
      <SelectRow label="مساعد المشي" labelEn="Ambulatory aid" options={MORSE_OPTIONS.ambulatoryAid} value={morse.ambulatoryAid} onSelect={(v) => setMorse({ ...morse, ambulatoryAid: v })} />
      <BooleanRow label="محاليل وريدية / قسطرة" labelEn="IV access / Heparin lock" field="ivAccess" score={20} />
      <SelectRow label="طريقة المشي" labelEn="Gait" options={MORSE_OPTIONS.gait} value={morse.gait} onSelect={(v) => setMorse({ ...morse, gait: v })} />
      <SelectRow label="الحالة الذهنية" labelEn="Mental status" options={MORSE_OPTIONS.mentalStatus} value={morse.mentalStatus} onSelect={(v) => setMorse({ ...morse, mentalStatus: v })} />
    </div>
  );
}

// ─── Humpty Dumpty Form ───

function HumptyDumptyForm({ humpty, setHumpty, disabled, language }: { humpty: HumptyDumptyInput; setHumpty: (v: HumptyDumptyInput) => void; disabled: boolean; language: 'ar' | 'en' }) {
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const SelectRow = ({ label, labelEn, options, value, onSelect }: { label: string; labelEn: string; options: { value: string; labelAr: string; labelEn: string; score: number }[]; value: string; onSelect: (v: any) => void }) => (
    <div className="py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-foreground font-medium block mb-1.5">{tr(label, labelEn)}</span>
      <div className="space-y-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !disabled && onSelect(opt.value)}
            disabled={disabled}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${value === opt.value ? 'bg-primary/10 border border-primary/30 text-foreground font-medium' : 'bg-muted/30 border border-transparent text-muted-foreground hover:bg-muted'}`}
          >
            <span>{language === 'ar' ? opt.labelAr : opt.labelEn}</span>
            <span className={`w-6 text-center text-[10px] font-bold rounded ${opt.score > 0 && value === opt.value ? 'bg-red-100 text-red-700' : 'text-muted-foreground'}`}>{value === opt.value ? opt.score : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const ageOptions = [
    { value: 'LT_3' as const, labelAr: 'أقل من 3 سنوات', labelEn: '< 3 years', score: 4 },
    { value: '3_TO_6' as const, labelAr: '3–6 سنوات', labelEn: '3–6 years', score: 3 },
    { value: '7_TO_12' as const, labelAr: '7–12 سنة', labelEn: '7–12 years', score: 2 },
    { value: 'GTE_13' as const, labelAr: '13+ سنة', labelEn: '≥ 13 years', score: 1 },
  ];

  const genderOptions = [
    { value: 'MALE' as const, labelAr: 'ذكر', labelEn: 'Male', score: 2 },
    { value: 'FEMALE' as const, labelAr: 'أنثى', labelEn: 'Female', score: 1 },
  ];

  return (
    <div className="space-y-0.5">
      <SelectRow label="العمر" labelEn="Age" options={ageOptions} value={humpty.age} onSelect={(v) => setHumpty({ ...humpty, age: v })} />
      <SelectRow label="الجنس" labelEn="Gender" options={genderOptions} value={humpty.gender} onSelect={(v) => setHumpty({ ...humpty, gender: v })} />
      <SelectRow label="التشخيص" labelEn="Diagnosis" options={HUMPTY_DUMPTY_OPTIONS.diagnosis} value={humpty.diagnosis} onSelect={(v) => setHumpty({ ...humpty, diagnosis: v })} />
      <SelectRow label="القصور الذهني" labelEn="Cognitive impairment" options={HUMPTY_DUMPTY_OPTIONS.cognitiveImpairment} value={humpty.cognitiveImpairment} onSelect={(v) => setHumpty({ ...humpty, cognitiveImpairment: v })} />
      <SelectRow label="العوامل البيئية" labelEn="Environmental factors" options={HUMPTY_DUMPTY_OPTIONS.environmentalFactors} value={humpty.environmentalFactors} onSelect={(v) => setHumpty({ ...humpty, environmentalFactors: v })} />
      <SelectRow label="جراحة / أدوية مهدئة" labelEn="Surgery / Sedation medication" options={HUMPTY_DUMPTY_OPTIONS.surgeryMedication} value={humpty.surgeryMedication} onSelect={(v) => setHumpty({ ...humpty, surgeryMedication: v })} />
    </div>
  );
}
