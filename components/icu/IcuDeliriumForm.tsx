'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const ASE_LETTERS = ['A', 'S', 'A', 'V', 'E', 'A', 'H', 'A', 'A', 'R', 'T'];

const RISK_FACTORS = [
  { key: 'age_over_65', ar: 'العمر > 65', en: 'Age > 65' },
  { key: 'dementia', ar: 'الخرف', en: 'Dementia' },
  { key: 'hypertension', ar: 'ارتفاع ضغط الدم', en: 'Hypertension' },
  { key: 'alcohol', ar: 'إدمان الكحول', en: 'Alcohol abuse' },
  { key: 'severity_of_illness', ar: 'شدة المرض', en: 'Severity of illness' },
  { key: 'benzodiazepines', ar: 'استخدام البنزوديازيبين', en: 'Benzodiazepine use' },
  { key: 'metabolic_disturbance', ar: 'اضطراب أيضي', en: 'Metabolic disturbance' },
  { key: 'infection', ar: 'عدوى / إنتان', en: 'Infection / Sepsis' },
  { key: 'immobilization', ar: 'عدم الحركة', en: 'Immobilization' },
  { key: 'sleep_deprivation', ar: 'حرمان من النوم', en: 'Sleep deprivation' },
];

const NON_PHARM_INTERVENTIONS = [
  { key: 'reorientation', ar: 'إعادة التوجيه', en: 'Reorientation' },
  { key: 'early_mobilization', ar: 'التحريك المبكر', en: 'Early mobilization' },
  { key: 'sleep_protocol', ar: 'بروتوكول النوم', en: 'Sleep protocol' },
  { key: 'hearing_aids', ar: 'المعينات السمعية', en: 'Hearing aids' },
  { key: 'glasses', ar: 'النظارات', en: 'Glasses' },
  { key: 'family_presence', ar: 'حضور العائلة', en: 'Family presence' },
  { key: 'reduce_sedation', ar: 'تقليل التخدير', en: 'Reduce sedation' },
  { key: 'music_therapy', ar: 'العلاج بالموسيقى', en: 'Music therapy' },
  { key: 'natural_light', ar: 'الضوء الطبيعي', en: 'Natural light exposure' },
  { key: 'minimize_restraints', ar: 'تقليل القيود', en: 'Minimize restraints' },
];

const THINKING_QUESTIONS_SET_A = [
  { ar: 'هل يطفو الحجر على الماء؟', en: 'Will a stone float on water?' },
  { ar: 'هل يوجد أسماك في البحر؟', en: 'Are there fish in the sea?' },
  { ar: 'هل يزن رطل واحد أكثر من رطلين؟', en: 'Does one pound weigh more than two?' },
  { ar: 'هل يمكنك استخدام المطرقة لقص الخشب؟', en: 'Can you use a hammer to pound a nail?' },
];

interface Props {
  onSubmit: (data: Record<string, any>) => void;
  saving?: boolean;
}

export default function IcuDeliriumForm({ onSubmit, saving }: Props) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  // Step state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: RASS
  const [rassScore, setRassScore] = useState<number | null>(null);

  // Step 2: Feature 1 - Acute onset / fluctuating
  const [feature1, setFeature1] = useState<boolean | null>(null);

  // Step 3: Feature 2 - Inattention (ASE Letters)
  const [aseErrors, setAseErrors] = useState<boolean[]>(new Array(ASE_LETTERS.length).fill(false));

  // Step 4: Feature 3 - Altered LOC
  const [feature3, setFeature3] = useState<boolean | null>(null);

  // Step 5: Feature 4 - Disorganized thinking
  const [thinkingAnswers, setThinkingAnswers] = useState<(boolean | null)[]>(new Array(4).fill(null));
  const [commandFollowed, setCommandFollowed] = useState<boolean | null>(null);

  // Risk factors + interventions
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [nonPharmInterventions, setNonPharmInterventions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Computed
  const tooSedated = rassScore != null && rassScore <= -4;
  const inattentionErrorCount = aseErrors.filter(Boolean).length;
  const feature2Positive = inattentionErrorCount >= 3;

  // Feature 4: >=2 incorrect answers OR fails command
  const incorrectThinking = thinkingAnswers.filter((a) => a === false).length;
  const feature4Positive = incorrectThinking >= 2 || commandFollowed === false;

  const camIcuResult = useMemo(() => {
    if (tooSedated) return 'TOO_SEDATED';
    if (feature1 == null) return null;
    const f1 = feature1 === true;
    const f2 = feature2Positive;
    const f3 = feature3 === true;
    const f4 = feature4Positive;
    if (f1 && f2 && (f3 || f4)) return 'POSITIVE';
    // If we have all answers, it is negative
    if (feature1 != null && feature3 != null) return 'NEGATIVE';
    return null;
  }, [tooSedated, feature1, feature2Positive, feature3, feature4Positive]);

  const deliriumType = useMemo(() => {
    if (camIcuResult !== 'POSITIVE' || rassScore == null) return null;
    if (rassScore > 0) return 'HYPERACTIVE';
    if (rassScore < 0) return 'HYPOACTIVE';
    return 'MIXED';
  }, [camIcuResult, rassScore]);

  const toggleRiskFactor = (key: string) => {
    setRiskFactors((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  };
  const toggleIntervention = (key: string) => {
    setNonPharmInterventions((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);
  };

  const toggleAseError = (idx: number) => {
    const copy = [...aseErrors];
    copy[idx] = !copy[idx];
    setAseErrors(copy);
  };

  const handleSave = () => {
    onSubmit({
      rassScore,
      feature1AcuteOnset: feature1,
      feature2Inattention: feature2Positive,
      inattentionErrors: inattentionErrorCount,
      feature3AlteredLOC: feature3,
      feature4DisorganizedThinking: feature4Positive,
      camIcuPositive: camIcuResult === 'POSITIVE',
      deliriumType,
      riskFactors,
      nonPharmInterventions,
      notes,
    });
  };

  const RASS_OPTIONS = [
    { score: 4, label: tr('+4 هيجان شديد', '+4 Combative') },
    { score: 3, label: tr('+3 هياج شديد', '+3 Very Agitated') },
    { score: 2, label: tr('+2 هياج', '+2 Agitated') },
    { score: 1, label: tr('+1 حركة زائدة', '+1 Restless') },
    { score: 0, label: tr('0 متيقظ وهادئ', '0 Alert & Calm') },
    { score: -1, label: tr('-1 نعسان', '-1 Drowsy') },
    { score: -2, label: tr('-2 تخدير خفيف', '-2 Light Sedation') },
    { score: -3, label: tr('-3 تخدير متوسط', '-3 Moderate Sedation') },
    { score: -4, label: tr('-4 تخدير عميق', '-4 Deep Sedation') },
    { score: -5, label: tr('-5 غير قابل للإيقاظ', '-5 Unarousable') },
  ];

  const stepTitles = [
    tr('الخطوة 1: فحص RASS', 'Step 1: RASS Check'),
    tr('الخطوة 2: السمة 1 - بداية حادة / تذبذب', 'Step 2: Feature 1 - Acute Onset / Fluctuating'),
    tr('الخطوة 3: السمة 2 - عدم الانتباه (ASE)', 'Step 3: Feature 2 - Inattention (ASE Letters)'),
    tr('الخطوة 4: السمة 3 - تغير مستوى الوعي', 'Step 4: Feature 3 - Altered Level of Consciousness'),
    tr('الخطوة 5: السمة 4 - التفكير غير المنظم', 'Step 5: Feature 4 - Disorganized Thinking'),
  ];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">

      {/* ---- Step Indicator ---- */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { if (!tooSedated || s === 1) setCurrentStep(s); }}
            className={`flex-1 h-2 rounded-full transition-all ${s <= currentStep ? 'bg-primary' : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className="text-sm font-semibold">{stepTitles[currentStep - 1]}</p>

      {/* ================================================================ */}
      {/* STEP 1: RASS Check                                                */}
      {/* ================================================================ */}
      {currentStep === 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('فحص مستوى التخدير (RASS)', 'Sedation Level Check (RASS)')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {tr('إذا كان RASS -4 أو -5: المريض مخدر بشكل عميق ولا يمكن تقييمه', 'If RASS is -4 or -5: patient is too sedated to assess')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {RASS_OPTIONS.map((opt) => (
                <button
                  key={opt.score}
                  type="button"
                  onClick={() => setRassScore(opt.score)}
                  className={`p-2 rounded-lg border text-xs text-center transition-all ${
                    rassScore === opt.score
                      ? 'ring-2 ring-primary bg-primary text-primary-foreground'
                      : opt.score <= -4 ? 'bg-indigo-50 hover:bg-indigo-100'
                      : opt.score === 0 ? 'bg-green-50 hover:bg-green-100'
                      : opt.score > 0 ? 'bg-red-50 hover:bg-red-100'
                      : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {tooSedated && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
                <p className="text-sm font-semibold text-yellow-800">
                  {tr('المريض مخدر بشكل عميق - لا يمكن إجراء تقييم CAM-ICU', 'Patient too sedated - Cannot perform CAM-ICU assessment')}
                </p>
              </div>
            )}
            <div className="flex justify-end mt-4">
              {tooSedated ? (
                <Button onClick={handleSave} disabled={saving || rassScore == null}>
                  {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ (مخدر بعمق)', 'Save (Too Sedated)')}
                </Button>
              ) : (
                <Button onClick={() => setCurrentStep(2)} disabled={rassScore == null}>
                  {tr('التالي', 'Next')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/* STEP 2: Feature 1 - Acute Onset / Fluctuating                    */}
      {/* ================================================================ */}
      {currentStep === 2 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('السمة 1: بداية حادة أو مسار متذبذب', 'Feature 1: Acute Onset or Fluctuating Course')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr(
                'هل يوجد دليل على تغير حاد في الحالة العقلية من الحالة الأساسية؟ أو هل تذبذبت الحالة العقلية خلال الـ24 ساعة الماضية (تغيرات في مستوى الوعي أو RASS)؟',
                'Is there evidence of an acute change in mental status from baseline? Or has mental status fluctuated during the past 24 hours (changes in level of consciousness or RASS)?',
              )}
            </p>
            <div className="flex gap-4">
              <Button
                variant={feature1 === true ? 'default' : 'outline'}
                onClick={() => setFeature1(true)}
                className="flex-1"
              >
                {tr('نعم (إيجابي)', 'Yes (Positive)')}
              </Button>
              <Button
                variant={feature1 === false ? 'default' : 'outline'}
                onClick={() => setFeature1(false)}
                className="flex-1"
              >
                {tr('لا (سلبي)', 'No (Negative)')}
              </Button>
            </div>
            {feature1 === false && (
              <div className="p-3 bg-green-50 border border-green-300 rounded-lg">
                <p className="text-sm font-semibold text-green-800">
                  {tr('CAM-ICU سلبي - لا يوجد بداية حادة', 'CAM-ICU Negative - No acute onset')}
                </p>
              </div>
            )}
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>{tr('السابق', 'Previous')}</Button>
              <Button onClick={() => setCurrentStep(3)} disabled={feature1 == null}>{tr('التالي', 'Next')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/* STEP 3: Feature 2 - Inattention (ASE Letters)                    */}
      {/* ================================================================ */}
      {currentStep === 3 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('السمة 2: عدم الانتباه - اختبار الحروف', 'Feature 2: Inattention - ASE Letters Test')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr(
                'اقرأ الحروف التالية واطلب من المريض الضغط على يدك عند سماع حرف "A". ضع علامة على الأخطاء (لم يضغط عند A أو ضغط عند حرف آخر).',
                'Read the following letters and ask the patient to squeeze your hand when they hear the letter "A". Mark errors (missed squeeze on A or squeezed on non-A).',
              )}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {ASE_LETTERS.map((letter, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleAseError(idx)}
                  className={`w-12 h-12 rounded-lg border-2 text-lg font-bold transition-all ${
                    aseErrors[idx]
                      ? 'bg-red-100 border-red-500 text-red-800'
                      : 'bg-card border-border hover:border-border'
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
            <p className="text-sm">
              {tr('عدد الأخطاء', 'Error count')}: <span className={`font-bold ${inattentionErrorCount >= 3 ? 'text-red-600' : 'text-green-600'}`}>{inattentionErrorCount}</span>
              {' '}
              {inattentionErrorCount >= 3
                ? <Badge className="bg-red-100 text-red-800">{tr('إيجابي (>= 3)', 'Positive (>= 3)')}</Badge>
                : <Badge className="bg-green-100 text-green-800">{tr('سلبي (< 3)', 'Negative (< 3)')}</Badge>
              }
            </p>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>{tr('السابق', 'Previous')}</Button>
              <Button onClick={() => setCurrentStep(4)}>{tr('التالي', 'Next')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/* STEP 4: Feature 3 - Altered Level of Consciousness               */}
      {/* ================================================================ */}
      {currentStep === 4 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('السمة 3: تغير مستوى الوعي', 'Feature 3: Altered Level of Consciousness')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {tr(
                'هل مستوى الوعي الحالي مختلف عن المتيقظ الهادئ (RASS = 0)؟ أي قيمة RASS غير صفر تعتبر إيجابية.',
                'Is the current level of consciousness anything other than Alert & Calm (RASS = 0)? Any RASS score other than 0 is positive.',
              )}
            </p>
            {rassScore != null && (
              <p className="text-sm">
                {tr('RASS الحالي', 'Current RASS')}: <span className="font-bold">{rassScore}</span>
                {rassScore !== 0
                  ? <Badge className="ml-2 bg-red-100 text-red-800">{tr('إيجابي (RASS != 0)', 'Positive (RASS != 0)')}</Badge>
                  : <Badge className="ml-2 bg-green-100 text-green-800">{tr('سلبي (RASS = 0)', 'Negative (RASS = 0)')}</Badge>
                }
              </p>
            )}
            <div className="flex gap-4">
              <Button
                variant={feature3 === true ? 'default' : 'outline'}
                onClick={() => setFeature3(true)}
                className="flex-1"
              >
                {tr('نعم (إيجابي)', 'Yes (Positive)')}
              </Button>
              <Button
                variant={feature3 === false ? 'default' : 'outline'}
                onClick={() => setFeature3(false)}
                className="flex-1"
              >
                {tr('لا (سلبي)', 'No (Negative)')}
              </Button>
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>{tr('السابق', 'Previous')}</Button>
              <Button onClick={() => setCurrentStep(5)} disabled={feature3 == null}>{tr('التالي', 'Next')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/* STEP 5: Feature 4 - Disorganized Thinking                        */}
      {/* ================================================================ */}
      {currentStep === 5 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{tr('السمة 4: التفكير غير المنظم', 'Feature 4: Disorganized Thinking')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {tr(
                'اطرح الأسئلة التالية. خطأان أو أكثر أو فشل في اتباع الأمر = إيجابي.',
                'Ask the following questions. 2+ errors or failure to follow command = positive.',
              )}
            </p>
            {THINKING_QUESTIONS_SET_A.map((q, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded-lg">
                <p className="text-sm flex-1">{tr(q.ar, q.en)}</p>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant={thinkingAnswers[idx] === true ? 'default' : 'outline'}
                    onClick={() => { const copy = [...thinkingAnswers]; copy[idx] = true; setThinkingAnswers(copy); }}
                  >
                    {tr('صح', 'Correct')}
                  </Button>
                  <Button
                    size="sm"
                    variant={thinkingAnswers[idx] === false ? 'destructive' : 'outline'}
                    onClick={() => { const copy = [...thinkingAnswers]; copy[idx] = false; setThinkingAnswers(copy); }}
                  >
                    {tr('خطأ', 'Wrong')}
                  </Button>
                </div>
              </div>
            ))}

            {/* Command */}
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium mb-2">
                {tr('الأمر: "ارفع هذا العدد من الأصابع" (اعرض إصبعين). "الآن افعل الشيء نفسه بالأخرى".', 'Command: "Hold up this many fingers" (show 2). "Now do the same with the other hand".')}
              </p>
              <div className="flex gap-4">
                <Button
                  size="sm"
                  variant={commandFollowed === true ? 'default' : 'outline'}
                  onClick={() => setCommandFollowed(true)}
                >
                  {tr('نفّذ الأمر', 'Followed Command')}
                </Button>
                <Button
                  size="sm"
                  variant={commandFollowed === false ? 'destructive' : 'outline'}
                  onClick={() => setCommandFollowed(false)}
                >
                  {tr('لم ينفذ', 'Failed Command')}
                </Button>
              </div>
            </div>

            <p className="text-sm">
              {tr('أخطاء في الأسئلة', 'Question errors')}: <span className="font-bold">{incorrectThinking}</span> |{' '}
              {tr('الأمر', 'Command')}: <span className="font-bold">{commandFollowed == null ? '-' : commandFollowed ? tr('نجح', 'Passed') : tr('فشل', 'Failed')}</span>
              {' '}
              {feature4Positive
                ? <Badge className="bg-red-100 text-red-800">{tr('إيجابي', 'Positive')}</Badge>
                : <Badge className="bg-green-100 text-green-800">{tr('سلبي', 'Negative')}</Badge>
              }
            </p>

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setCurrentStep(4)}>{tr('السابق', 'Previous')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================================================================ */}
      {/* CAM-ICU Result                                                    */}
      {/* ================================================================ */}
      {!tooSedated && camIcuResult && (
        <Card className={`border-2 ${camIcuResult === 'POSITIVE' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
          <CardContent className="pt-4 text-center space-y-2">
            <p className="text-lg font-bold">
              {tr('نتيجة CAM-ICU', 'CAM-ICU Result')}
            </p>
            <Badge className={`text-lg px-6 py-2 ${camIcuResult === 'POSITIVE' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
              {camIcuResult === 'POSITIVE' ? tr('إيجابي - هذيان', 'POSITIVE - Delirium') : tr('سلبي - لا هذيان', 'NEGATIVE - No Delirium')}
            </Badge>
            {deliriumType && (
              <p className="text-sm font-semibold">
                {tr('نوع الهذيان', 'Delirium Type')}:{' '}
                <Badge variant="outline">
                  {deliriumType === 'HYPERACTIVE' ? tr('مفرط النشاط', 'Hyperactive')
                    : deliriumType === 'HYPOACTIVE' ? tr('ناقص النشاط', 'Hypoactive')
                    : tr('مختلط', 'Mixed')}
                </Badge>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Risk Factors ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('عوامل الخطر', 'Risk Factors')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {RISK_FACTORS.map((rf) => (
              <label key={rf.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={riskFactors.includes(rf.key)} onChange={() => toggleRiskFactor(rf.key)} />
                {tr(rf.ar, rf.en)}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---- Non-Pharmacological Interventions ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tr('التدخلات غير الدوائية', 'Non-Pharmacological Interventions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {NON_PHARM_INTERVENTIONS.map((int) => (
              <label key={int.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={nonPharmInterventions.includes(int.key)} onChange={() => toggleIntervention(int.key)} />
                {tr(int.ar, int.en)}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---- Notes ---- */}
      <div>
        <Label>{tr('ملاحظات', 'Notes')}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr('ملاحظات إضافية...', 'Additional notes...')} />
      </div>

      {/* ---- Save ---- */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || rassScore == null}>
          {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ الفحص', 'Save Screening')}
        </Button>
      </div>
    </div>
  );
}
