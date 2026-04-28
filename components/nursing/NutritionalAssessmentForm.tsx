'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Save, AlertCircle, ChevronDown, ChevronUp, Utensils } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NutritionalAssessmentPayload {
  patientMasterId: string;
  episodeId?: string;
  assessmentDate: string;
  // MUST Score sub-questions
  mustBmiScore: number;        // 0, 1, or 2
  mustWeightLossScore: number; // 0, 1, or 2
  mustDiseaseScore: number;    // 0 or 2
  // Anthropometrics
  height: number | '';
  weight: number | '';
  weightChangePct: number | '';
  idealWeight: number | '';
  // Clinical
  appetiteStatus: string;
  swallowingStatus: string;
  route: string;
  // Requirements
  caloricNeed: number | '';
  proteinNeed: number | '';
  fluidNeed: number | '';
  // History
  foodAllergies: string;
  dietaryHistory: string;
  // Output
  recommendations: string;
  followUpDate: string;
}

interface NutritionalAssessmentFormProps {
  patientMasterId: string;
  episodeId?: string;
  initialData?: Partial<NutritionalAssessmentPayload>;
  existingId?: string;
  onSuccess?: (id: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const APPETITE_OPTIONS = [
  { value: 'GOOD', labelAr: 'جيدة',     labelEn: 'Good' },
  { value: 'FAIR', labelAr: 'متوسطة',   labelEn: 'Fair' },
  { value: 'POOR', labelAr: 'ضعيفة',    labelEn: 'Poor' },
  { value: 'NONE', labelAr: 'لا توجد',  labelEn: 'None' },
];

const SWALLOWING_OPTIONS = [
  { value: 'NORMAL',    labelAr: 'طبيعي',              labelEn: 'Normal' },
  { value: 'MODIFIED',  labelAr: 'طعام مهروس/معدل',   labelEn: 'Modified Texture' },
  { value: 'NPO',       labelAr: 'صائم (NPO)',          labelEn: 'NPO' },
  { value: 'TUBE_FED',  labelAr: 'تغذية عبر أنبوب',    labelEn: 'Tube Fed' },
];

const ROUTE_OPTIONS = [
  { value: 'ORAL',       labelAr: 'فموي',             labelEn: 'Oral' },
  { value: 'NGT',        labelAr: 'أنبوب أنفي معدي',  labelEn: 'NG Tube' },
  { value: 'PEG',        labelAr: 'أنبوب معدي جلدي',  labelEn: 'PEG Tube' },
  { value: 'TPN',        labelAr: 'تغذية وريدية كاملة', labelEn: 'Total Parenteral (TPN)' },
  { value: 'SUPPLEMENT', labelAr: 'مكملات غذائية',    labelEn: 'Oral Supplement' },
];

// MUST BMI score options
const BMI_SCORE_OPTIONS = [
  { score: 0, labelAr: 'مؤشر كتلة الجسم > 20 (0 نقطة)',            labelEn: 'BMI > 20 — Score 0' },
  { score: 1, labelAr: 'مؤشر كتلة الجسم 18.5–20 (1 نقطة)',         labelEn: 'BMI 18.5–20 — Score 1' },
  { score: 2, labelAr: 'مؤشر كتلة الجسم < 18.5 (2 نقطة)',          labelEn: 'BMI < 18.5 — Score 2' },
];

// MUST weight loss score options
const WEIGHT_LOSS_SCORE_OPTIONS = [
  { score: 0, labelAr: 'نقص الوزن < 5% في 3-6 شهور (0 نقطة)',      labelEn: 'Weight loss < 5% in 3-6 mo — Score 0' },
  { score: 1, labelAr: 'نقص الوزن 5–10% في 3-6 شهور (1 نقطة)',     labelEn: 'Weight loss 5–10% in 3-6 mo — Score 1' },
  { score: 2, labelAr: 'نقص الوزن > 10% في 3-6 شهور (2 نقطة)',     labelEn: 'Weight loss > 10% in 3-6 mo — Score 2' },
];

// MUST disease effect score
const DISEASE_SCORE_OPTIONS = [
  { score: 0, labelAr: 'لا يوجد تأثير مرض حاد (0 نقطة)',            labelEn: 'No acute disease effect — Score 0' },
  { score: 2, labelAr: 'مريض في حالة حرجة / لن يأكل > 5 أيام (2 نقطة)', labelEn: 'Acutely ill / likely no intake > 5 days — Score 2' },
];

// Risk category
function getMustRisk(score: number): { ar: string; en: string; color: string } {
  if (score === 0) return { ar: 'خطر منخفض', en: 'Low Risk',    color: 'bg-green-100 text-green-800 border-green-300' };
  if (score === 1) return { ar: 'خطر متوسط', en: 'Medium Risk', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  return              { ar: 'خطر مرتفع', en: 'High Risk',   color: 'bg-red-100 text-red-800 border-red-300' };
}

const DEFAULT_FORM: NutritionalAssessmentPayload = {
  patientMasterId: '',
  assessmentDate: new Date().toISOString().slice(0, 16),
  mustBmiScore: 0,
  mustWeightLossScore: 0,
  mustDiseaseScore: 0,
  height: '',
  weight: '',
  weightChangePct: '',
  idealWeight: '',
  appetiteStatus: 'FAIR',
  swallowingStatus: 'NORMAL',
  route: 'ORAL',
  caloricNeed: '',
  proteinNeed: '',
  fluidNeed: '',
  foodAllergies: '',
  dietaryHistory: '',
  recommendations: '',
  followUpDate: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function NutritionalAssessmentForm({
  patientMasterId, episodeId, initialData, existingId, onSuccess,
}: NutritionalAssessmentFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [form, setForm] = useState<NutritionalAssessmentPayload>({
    ...DEFAULT_FORM,
    patientMasterId,
    episodeId,
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [mustExpanded, setMustExpanded] = useState(true);

  const patch = <K extends keyof NutritionalAssessmentPayload>(key: K, val: NutritionalAssessmentPayload[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  // Computed values
  const mustScore = form.mustBmiScore + form.mustWeightLossScore + form.mustDiseaseScore;
  const risk = getMustRisk(mustScore);

  const bmi = useMemo(() => {
    const h = Number(form.height);
    const w = Number(form.weight);
    if (!h || !w) return null;
    return (w / ((h / 100) ** 2)).toFixed(1);
  }, [form.height, form.weight]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!patientMasterId) {
      showToast('error', tr('معرف المريض مطلوب', 'Patient ID is required'));
      return;
    }
    setSaving(true);
    try {
      const url = existingId ? `/api/nutrition/${existingId}` : '/api/nutrition';
      const method = existingId ? 'PUT' : 'POST';

      // Map MUST sub-scores → total
      const payload = {
        ...form,
        mustScore,
        bmi: bmi ? Number(bmi) : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      showToast('success', tr('تم حفظ تقييم التغذية', 'Nutritional assessment saved'));
      onSuccess?.(data.assessment.id);
    } catch {
      showToast('error', tr('فشل الحفظ', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir={dir}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white text-sm shadow-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Section 1: MUST Calculator */}
      <section className="bg-card border rounded-xl overflow-hidden">
        <button
          onClick={() => setMustExpanded(!mustExpanded)}
          className="w-full flex items-center justify-between px-5 py-3 bg-emerald-50 border-b border-emerald-200"
        >
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-emerald-800 text-sm">
              {tr('حاسبة MUST', 'MUST Score Calculator')}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${risk.color}`}>
              {tr('المجموع', 'Total')}: {mustScore} — {language === 'ar' ? risk.ar : risk.en}
            </span>
          </div>
          {mustExpanded ? <ChevronUp className="w-4 h-4 text-emerald-600" /> : <ChevronDown className="w-4 h-4 text-emerald-600" />}
        </button>

        {mustExpanded && (
          <div className="p-5 space-y-5">
            {/* Question 1: BMI */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">
                {tr('السؤال 1: مؤشر كتلة الجسم (BMI)', 'Question 1: BMI Score')}
              </p>
              <div className="space-y-1.5">
                {BMI_SCORE_OPTIONS.map(opt => (
                  <label key={opt.score} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mustBmi"
                      value={opt.score}
                      checked={form.mustBmiScore === opt.score}
                      onChange={() => patch('mustBmiScore', opt.score)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-foreground">{language === 'ar' ? opt.labelAr : opt.labelEn}</span>
                    <span className="ml-auto text-xs font-bold text-emerald-700">{opt.score}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Question 2: Weight Loss */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">
                {tr('السؤال 2: فقدان الوزن', 'Question 2: Weight Loss Score')}
              </p>
              <div className="space-y-1.5">
                {WEIGHT_LOSS_SCORE_OPTIONS.map(opt => (
                  <label key={opt.score} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mustWL"
                      value={opt.score}
                      checked={form.mustWeightLossScore === opt.score}
                      onChange={() => patch('mustWeightLossScore', opt.score)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-foreground">{language === 'ar' ? opt.labelAr : opt.labelEn}</span>
                    <span className="ml-auto text-xs font-bold text-emerald-700">{opt.score}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Question 3: Acute Disease */}
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">
                {tr('السؤال 3: تأثير المرض الحاد', 'Question 3: Acute Disease Effect')}
              </p>
              <div className="space-y-1.5">
                {DISEASE_SCORE_OPTIONS.map(opt => (
                  <label key={opt.score} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="mustDisease"
                      value={opt.score}
                      checked={form.mustDiseaseScore === opt.score}
                      onChange={() => patch('mustDiseaseScore', opt.score)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-foreground">{language === 'ar' ? opt.labelAr : opt.labelEn}</span>
                    <span className="ml-auto text-xs font-bold text-emerald-700">{opt.score}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className={`p-3 rounded-lg border text-center ${risk.color}`}>
              <p className="text-xs mb-0.5">{tr('مجموع درجة MUST', 'MUST Total Score')}</p>
              <p className="text-3xl font-bold">{mustScore}</p>
              <p className="text-sm font-semibold mt-0.5">{language === 'ar' ? risk.ar : risk.en}</p>
              {mustScore >= 2 && (
                <p className="text-xs mt-1 opacity-80">
                  {tr(
                    'يُوصى بتدخل غذائي فوري — راجع أخصائي التغذية',
                    'Nutritional intervention recommended — refer to dietitian'
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Anthropometrics */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('القياسات الجسدية', 'Anthropometric Measurements')}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الطول (cm)', 'Height (cm)')}</label>
            <input
              type="number"
              min={50}
              max={250}
              value={form.height}
              onChange={e => patch('height', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الوزن (kg)', 'Weight (kg)')}</label>
            <input
              type="number"
              min={1}
              max={500}
              step={0.1}
              value={form.weight}
              onChange={e => patch('weight', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Auto-BMI */}
        {bmi && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
            <span className="text-xs text-emerald-700 font-medium">{tr('مؤشر كتلة الجسم المحسوب:', 'Calculated BMI:')}</span>
            <span className="text-lg font-bold text-emerald-800">{bmi}</span>
            <span className="text-xs text-emerald-600">
              {Number(bmi) < 18.5
                ? tr('أقل من الطبيعي', 'Underweight')
                : Number(bmi) < 25
                  ? tr('طبيعي', 'Normal')
                  : Number(bmi) < 30
                    ? tr('زيادة وزن', 'Overweight')
                    : tr('سمنة', 'Obese')
              }
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الوزن المثالي (kg)', 'Ideal Weight (kg)')}</label>
            <input
              type="number"
              min={1}
              step={0.1}
              value={form.idealWeight}
              onChange={e => patch('idealWeight', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('نسبة فقدان الوزن % (3-6 شهور)', 'Weight Loss % (3-6 mo)')}</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.weightChangePct}
              onChange={e => patch('weightChangePct', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Section 3: Clinical Status */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('الحالة السريرية', 'Clinical Status')}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الشهية', 'Appetite')}</label>
            <div className="flex gap-1.5">
              {APPETITE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => patch('appetiteStatus', opt.value)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                    form.appetiteStatus === opt.value
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-card text-muted-foreground border-border hover:border-emerald-300'
                  }`}
                >
                  {language === 'ar' ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('حالة البلع', 'Swallowing Status')}</label>
            <select
              value={form.swallowingStatus}
              onChange={e => patch('swallowingStatus', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {SWALLOWING_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{language === 'ar' ? o.labelAr : o.labelEn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('طريق التغذية', 'Feeding Route')}</label>
            <select
              value={form.route}
              onChange={e => patch('route', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {ROUTE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{language === 'ar' ? r.labelAr : r.labelEn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('تاريخ التقييم', 'Assessment Date')}</label>
            <input
              type="datetime-local"
              value={form.assessmentDate}
              onChange={e => patch('assessmentDate', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Section 4: Nutritional Requirements */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('الاحتياجات الغذائية', 'Nutritional Requirements')}</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('السعرات (kcal/يوم)', 'Calories (kcal/day)')}</label>
            <input
              type="number"
              min={0}
              value={form.caloricNeed}
              onChange={e => patch('caloricNeed', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('البروتين (g/يوم)', 'Protein (g/day)')}</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={form.proteinNeed}
              onChange={e => patch('proteinNeed', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('السوائل (mL/يوم)', 'Fluids (mL/day)')}</label>
            <input
              type="number"
              min={0}
              value={form.fluidNeed}
              onChange={e => patch('fluidNeed', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* BMI-based suggestion hint */}
        {bmi && Number(form.weight) > 0 && (
          <div className="text-xs text-muted-foreground bg-muted/50 border rounded-lg p-3 space-y-1">
            <p className="font-medium text-foreground">{tr('اقتراح بناءً على الوزن الفعلي:', 'Suggested based on actual weight:')}</p>
            <p>{tr('السعرات:', 'Calories:')} {Math.round(Number(form.weight) * 25)}–{Math.round(Number(form.weight) * 30)} kcal/day</p>
            <p>{tr('البروتين:', 'Protein:')} {(Number(form.weight) * 1.2).toFixed(1)}–{(Number(form.weight) * 1.5).toFixed(1)} g/day</p>
            <p>{tr('السوائل:', 'Fluids:')} {Math.round(Number(form.weight) * 30)}–{Math.round(Number(form.weight) * 35)} mL/day</p>
          </div>
        )}
      </section>

      {/* Section 5: History & Allergies */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('التاريخ الغذائي والحساسية', 'Dietary History & Allergies')}</h4>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('حساسية الأطعمة', 'Food Allergies')}</label>
          <input
            type="text"
            value={form.foodAllergies}
            onChange={e => patch('foodAllergies', e.target.value)}
            placeholder={tr('مثال: المكسرات، الغلوتين، اللاكتوز...', 'e.g., Nuts, Gluten, Lactose...')}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('التاريخ الغذائي', 'Dietary History')}</label>
          <textarea
            value={form.dietaryHistory}
            onChange={e => patch('dietaryHistory', e.target.value)}
            rows={3}
            placeholder={tr('وصف نظام الغذاء المعتاد، عادات الأكل...', 'Describe usual dietary pattern, eating habits...')}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </section>

      {/* Section 6: Recommendations & Follow-up */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('التوصيات والمتابعة', 'Recommendations & Follow-up')}</h4>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('التوصيات الغذائية', 'Nutritional Recommendations')}</label>
          <textarea
            value={form.recommendations}
            onChange={e => patch('recommendations', e.target.value)}
            rows={4}
            placeholder={tr('التوصيات التفصيلية لأخصائي التغذية...', 'Detailed dietitian recommendations...')}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('تاريخ المتابعة', 'Follow-up Date')}</label>
          <input
            type="date"
            value={form.followUpDate}
            onChange={e => patch('followUpDate', e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {mustScore >= 2 && !form.recommendations && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {tr(
                'الدرجة ≥ 2 تستوجب تدخلاً غذائياً. الرجاء كتابة التوصيات.',
                'Score ≥ 2 requires nutritional intervention. Please add recommendations.'
              )}
            </p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving
            ? tr('جاري الحفظ...', 'Saving...')
            : existingId
              ? tr('تحديث التقييم', 'Update Assessment')
              : tr('حفظ التقييم', 'Save Assessment')
          }
        </button>
      </section>
    </div>
  );
}
