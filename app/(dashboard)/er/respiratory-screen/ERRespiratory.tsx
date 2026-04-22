'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { useLang } from '@/hooks/use-lang';

export default function ERRespiratory() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const router = useRouter();
  const { hasPermission, isLoading } = useRoutePermission('/er/respiratory-screen');

  const SYMPTOMS = [
    { key: 'cough', label: tr('سعال', 'Cough') },
    { key: 'shortness_of_breath', label: tr('ضيق في التنفس', 'Shortness of breath') },
    { key: 'fever_chills', label: tr('حمى / قشعريرة', 'Fever / chills') },
    { key: 'sore_throat_runny_nose', label: tr('التهاب حلق / رشح', 'Sore throat / runny nose') },
    { key: 'loss_smell_taste', label: tr('فقدان حاسة الشم أو التذوق', 'Loss of smell or taste') },
  ];

  const RISK_FACTORS = [
    { key: 'contact_case', label: tr('مخالطة حالة تنفسية/معدية', 'Contact with respiratory/infectious case') },
    { key: 'recent_outbreak', label: tr('تعرض لتفشي حديث', 'Recent outbreak exposure') },
    { key: 'healthcare_worker', label: tr('عامل رعاية صحية / تعرض عالي', 'Healthcare worker / high exposure role') },
  ];

  const includeLossSmell = process.env.NEXT_PUBLIC_RESP_SCREEN_LOSS_SMELL !== '0';
  const includeOutbreak = process.env.NEXT_PUBLIC_RESP_SCREEN_OUTBREAK !== '0';

  const symptomsList = useMemo(() => SYMPTOMS.filter((s) => (includeLossSmell ? true : s.key !== 'loss_smell_taste')), [includeLossSmell, language]);
  const risksList = useMemo(() => RISK_FACTORS.filter((r) => (includeOutbreak ? true : r.key !== 'recent_outbreak')), [includeOutbreak, language]);

  const [tempIdentityId, setTempIdentityId] = useState(`RS-${Math.random().toString(36).slice(2, 8)}`);
  const [visitNumberInput, setVisitNumberInput] = useState('');
  const [spo2, setSpo2] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [riskFactors, setRiskFactors] = useState<string[]>([]);
  const [overrideUnconscious, setOverrideUnconscious] = useState(false);
  const [overrideUnstable, setOverrideUnstable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  if (isLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  const toggle = (key: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const computeDecision = () => {
    if (overrideUnconscious || overrideUnstable) return 'PRECAUTIONS';
    if (symptoms.length > 0) return 'ISOLATE';
    if (riskFactors.length > 0) return 'PRECAUTIONS';
    return 'NO';
  };

  const submit = async () => {
    const finalDecision = computeDecision();
    setDecision(finalDecision);
    setSubmitting(true);
    try {
      const res = await fetch('/api/er/respiratory-screen', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempIdentityId: tempIdentityId.trim() || undefined,
          visitNumber: visitNumberInput.trim() || undefined,
          symptoms,
          riskFactors,
          spo2: spo2 ? Number(spo2) : null,
          overrideUnconscious,
          overrideUnstable,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || tr('فشل الفحص', 'Screening failed'));
        return;
      }
      setResult(data?.item || null);
      setDecision(data?.item?.decision || finalDecision);
    } finally {
      setSubmitting(false);
    }
  };

  const decisionValue = decision || computeDecision();
  const routing = decisionValue === 'ISOLATE'
    ? {
        counter: tr('كاونتر العزل', 'Isolation Counter'),
        isolation: tr('مطلوب', 'Required'),
        bracelet: tr('سوار عزل تنفسي', 'Respiratory Isolation Band'),
        instructions: [
          tr('توفير كمامة فوراً', 'Provide mask immediately'),
          tr('التوجيه لمنطقة العزل', 'Direct to isolation area'),
          tr('استخدام معدات الحماية الكاملة', 'Use full PPE'),
        ],
      }
    : decisionValue === 'PRECAUTIONS'
    ? {
        counter: tr('كاونتر الاحتياطات التنفسية', 'Respiratory Precautions Counter'),
        isolation: tr('احتياطات مطلوبة', 'Precautions required'),
        bracelet: tr('سوار احتياطات تنفسية', 'Respiratory Precautions Band'),
        instructions: [
          tr('توفير كمامة', 'Provide mask'),
          tr('استخدام معدات الحماية', 'Use PPE'),
          tr('تجنب منطقة الانتظار المزدحمة', 'Avoid crowded waiting area'),
        ],
      }
    : {
        counter: tr('التسجيل القياسي', 'Standard Registration'),
        isolation: tr('غير مطلوب', 'Not required'),
        bracelet: tr('لا يوجد', 'None'),
        instructions: [tr('المتابعة للتسجيل القياسي', 'Proceed to standard registration')],
      };

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tr('الفرز البصري التنفسي', 'Respiratory Visual Triage')}</h1>
            <p className="text-sm text-muted-foreground">
              {tr('فحص مكافحة العدوى قبل التسجيل (نمط وزارة الصحة). ليس تشخيصاً.', 'Pre-registration infection control screening (MOH-style). Not a diagnosis.')}
            </p>
          </div>
          <button
            onClick={() => router.push('/er/register')}
            className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted thea-transition-fast"
          >
            {tr('الذهاب للتسجيل', 'Go to Registration')}
          </button>
        </div>

        {/* Screening Info */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('معلومات الفحص', 'Screening Info')}</h2>
          </div>
          <div className="p-5 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم الهوية المؤقت (قبل التسجيل)', 'Temp Identity ID (pre-registration)')}</label>
              <input value={tempIdentityId} onChange={(e) => setTempIdentityId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('رقم زيارة الطوارئ (إذا مسجل)', 'ER Visit Number (if already registered)')}</label>
              <input value={visitNumberInput} onChange={(e) => setVisitNumberInput(e.target.value)} placeholder="ER-00000" className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr('تشبع الأكسجين (اختياري)', 'SpO\u2082 (optional)')}</label>
              <input value={spo2} onChange={(e) => setSpo2(e.target.value)} placeholder={tr('مثال: 95', 'e.g. 95')} className="w-full px-3 py-2.5 rounded-xl border-[1.5px] border-border bg-background text-foreground text-sm thea-input-focus" />
            </div>
          </div>
        </div>

        {/* Symptoms */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('الأعراض', 'Symptoms')}</h2>
          </div>
          <div className="p-5 grid gap-3 md:grid-cols-2">
            {symptomsList.map((s) => (
              <label key={s.key} className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={symptoms.includes(s.key)}
                  onChange={() => toggle(s.key, symptoms, setSymptoms)}
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>

        {/* Exposure / Risk */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('التعرض / عوامل الخطر', 'Exposure / Risk')}</h2>
          </div>
          <div className="p-5 grid gap-3 md:grid-cols-2">
            {risksList.map((r) => (
              <label key={r.key} className="flex items-center gap-3 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={riskFactors.includes(r.key)}
                  onChange={() => toggle(r.key, riskFactors, setRiskFactors)}
                  className="h-4 w-4 rounded border-border text-primary accent-primary"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        {/* Safety Override */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('تجاوز السلامة', 'Safety Override')}</h2>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <label className="flex items-center gap-3 text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={overrideUnconscious}
                onChange={(e) => setOverrideUnconscious(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              {tr('المريض فاقد الوعي (تطبيق الاحتياطات)', 'Patient is unconscious (apply precautions)')}
            </label>
            <label className="flex items-center gap-3 text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={overrideUnstable}
                onChange={(e) => setOverrideUnstable(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary accent-primary"
              />
              {tr('المريض غير مستقر (تطبيق الاحتياطات)', 'Patient is unstable (apply precautions)')}
            </label>
          </div>
        </div>

        {/* Decision */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-base font-bold text-foreground">{tr('القرار', 'Decision')}</h2>
          </div>
          <div className="p-5 space-y-3">
            <div className="text-sm text-foreground">
              {tr('القرار الحالي:', 'Current decision:')} <strong>{decisionValue}</strong>
            </div>
            <div
              className={`rounded-xl border p-4 text-sm space-y-1 ${
                decisionValue === 'ISOLATE'
                  ? 'border-destructive/40 bg-destructive/5 text-destructive'
                  : decisionValue === 'PRECAUTIONS'
                  ? 'border-amber-500/40 bg-amber-500/5 text-amber-700'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700'
              }`}
            >
              <div className="font-medium">{tr('تعليمات التوجيه', 'Routing Instructions')}</div>
              <div>{tr('الكاونتر:', 'Counter:')} {routing.counter}</div>
              <div>{tr('العزل:', 'Isolation:')} {routing.isolation}</div>
              <div>{tr('السوار:', 'Band/Bracelet:')} {routing.bracelet}</div>
              <div className="pt-1">
                {routing.instructions.map((line) => (
                  <div key={line}>{'\u2022'} {line}</div>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {tr('الفحص مطلوب قبل تسجيل الطوارئ. يجب اتباع القرار تشغيلياً.', 'Screening is required before ER registration. The decision must be followed operationally.')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 thea-transition-fast disabled:opacity-50"
          >
            {submitting ? tr('جاري الحفظ...', 'Saving...') : tr('إكمال الفحص', 'Complete Screening')}
          </button>
          {result?.decision ? (
            <span className="text-sm text-muted-foreground">{tr('تم الحفظ:', 'Saved:')} {result.decision}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
