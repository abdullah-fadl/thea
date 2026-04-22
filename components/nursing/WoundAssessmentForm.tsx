'use client';

import { useState, useMemo } from 'react';
import { useLang } from '@/hooks/use-lang';
import { Save, AlertCircle, Activity } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WoundAssessmentPayload {
  patientMasterId: string;
  episodeId?: string;
  woundType: string;
  woundLocation: string;
  stage: string;
  length: number | '';
  width: number | '';
  depth: number | '';
  tunneling: boolean;
  undermining: boolean;
  woundBed: { granulationPct: number; sloughPct: number; escharPct: number; epithelialPct: number };
  exudate: { amount: string; type: string };
  periwoundSkin: string;
  odor: string;
  painScore: number;
  treatment: { cleanser: string; primaryDressing: string; secondaryDressing: string; frequency: string; notes: string };
  healingTrajectory: string;
  notes: string;
  assessmentDate: string;
}

interface WoundAssessmentFormProps {
  patientMasterId: string;
  episodeId?: string;
  initialData?: Partial<WoundAssessmentPayload>;
  existingId?: string;
  onSuccess?: (id: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WOUND_TYPES = [
  { value: 'SURGICAL',   labelAr: 'جراحي',         labelEn: 'Surgical' },
  { value: 'PRESSURE',   labelAr: 'قرحة ضغط',      labelEn: 'Pressure Ulcer' },
  { value: 'DIABETIC',   labelAr: 'سكري',           labelEn: 'Diabetic' },
  { value: 'VASCULAR',   labelAr: 'وعائي',          labelEn: 'Vascular' },
  { value: 'TRAUMATIC',  labelAr: 'رضي',            labelEn: 'Traumatic' },
  { value: 'BURN',       labelAr: 'حروق',           labelEn: 'Burn' },
  { value: 'OTHER',      labelAr: 'أخرى',           labelEn: 'Other' },
];

const STAGES = [
  { value: 'I',           labelAr: 'المرحلة الأولى',     labelEn: 'Stage I' },
  { value: 'II',          labelAr: 'المرحلة الثانية',    labelEn: 'Stage II' },
  { value: 'III',         labelAr: 'المرحلة الثالثة',    labelEn: 'Stage III' },
  { value: 'IV',          labelAr: 'المرحلة الرابعة',    labelEn: 'Stage IV' },
  { value: 'UNSTAGEABLE', labelAr: 'غير قابل للتصنيف',  labelEn: 'Unstageable' },
  { value: 'DTI',         labelAr: 'إصابة الأنسجة العميقة', labelEn: 'Deep Tissue Injury' },
];

const EXUDATE_AMOUNTS = [
  { value: 'NONE',     labelAr: 'لا يوجد', labelEn: 'None' },
  { value: 'SCANT',    labelAr: 'قليل',    labelEn: 'Scant' },
  { value: 'MODERATE', labelAr: 'متوسط',   labelEn: 'Moderate' },
  { value: 'HEAVY',    labelAr: 'غزير',    labelEn: 'Heavy' },
];

const EXUDATE_TYPES = [
  { value: 'SEROUS',       labelAr: 'مصلي',      labelEn: 'Serous' },
  { value: 'SANGUINEOUS',  labelAr: 'دموي',      labelEn: 'Sanguineous' },
  { value: 'PURULENT',     labelAr: 'قيحي',      labelEn: 'Purulent' },
  { value: 'MIXED',        labelAr: 'مختلط',     labelEn: 'Mixed' },
];

const ODOR_OPTIONS = [
  { value: 'NONE',     labelAr: 'لا يوجد', labelEn: 'None' },
  { value: 'MILD',     labelAr: 'خفيف',    labelEn: 'Mild' },
  { value: 'MODERATE', labelAr: 'متوسط',   labelEn: 'Moderate' },
  { value: 'STRONG',   labelAr: 'شديد',    labelEn: 'Strong' },
];

const TRAJECTORIES = [
  { value: 'IMPROVING',     labelAr: 'يتحسن',   labelEn: 'Improving',     color: 'bg-green-100 text-green-800 border-green-300' },
  { value: 'STATIC',        labelAr: 'ثابت',    labelEn: 'Static',        color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'DETERIORATING', labelAr: 'يتدهور',  labelEn: 'Deteriorating', color: 'bg-red-100 text-red-800 border-red-300' },
];

const DEFAULT_FORM: WoundAssessmentPayload = {
  patientMasterId: '',
  woundType: 'SURGICAL',
  woundLocation: '',
  stage: '',
  length: '',
  width: '',
  depth: '',
  tunneling: false,
  undermining: false,
  woundBed: { granulationPct: 0, sloughPct: 0, escharPct: 0, epithelialPct: 0 },
  exudate: { amount: 'NONE', type: 'SEROUS' },
  periwoundSkin: '',
  odor: 'NONE',
  painScore: 0,
  treatment: { cleanser: '', primaryDressing: '', secondaryDressing: '', frequency: '', notes: '' },
  healingTrajectory: 'STATIC',
  notes: '',
  assessmentDate: new Date().toISOString().slice(0, 16),
};

// ─── Component ────────────────────────────────────────────────────────────────

export function WoundAssessmentForm({
  patientMasterId, episodeId, initialData, existingId, onSuccess,
}: WoundAssessmentFormProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const [form, setForm] = useState<WoundAssessmentPayload>({
    ...DEFAULT_FORM,
    patientMasterId,
    episodeId,
    ...initialData,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const patch = <K extends keyof WoundAssessmentPayload>(key: K, val: WoundAssessmentPayload[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const patchWoundBed = (key: keyof typeof form.woundBed, val: number) => {
    setForm(prev => ({ ...prev, woundBed: { ...prev.woundBed, [key]: val } }));
  };

  const patchExudate = (key: keyof typeof form.exudate, val: string) => {
    setForm(prev => ({ ...prev, exudate: { ...prev.exudate, [key]: val } }));
  };

  const patchTreatment = (key: keyof typeof form.treatment, val: string) => {
    setForm(prev => ({ ...prev, treatment: { ...prev.treatment, [key]: val } }));
  };

  // Area auto-calc
  const area = useMemo(() => {
    const l = Number(form.length) || 0;
    const w = Number(form.width) || 0;
    return (l * w).toFixed(1);
  }, [form.length, form.width]);

  // Wound bed total validation
  const woundBedTotal = Object.values(form.woundBed).reduce((s, v) => s + v, 0);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!form.woundLocation.trim()) {
      showToast('error', tr('موقع الجرح مطلوب', 'Wound location is required'));
      return;
    }
    setSaving(true);
    try {
      const url = existingId ? `/api/wound-care/${existingId}` : '/api/wound-care';
      const method = existingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      showToast('success', tr('تم حفظ تقييم الجرح', 'Wound assessment saved'));
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

      {/* Section 1: Basic Info */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-600" />
          {tr('معلومات الجرح الأساسية', 'Basic Wound Information')}
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('نوع الجرح', 'Wound Type')}</label>
            <select
              value={form.woundType}
              onChange={e => patch('woundType', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              {WOUND_TYPES.map(w => (
                <option key={w.value} value={w.value}>
                  {language === 'ar' ? w.labelAr : w.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('موقع الجرح', 'Wound Location')}</label>
            <input
              type="text"
              value={form.woundLocation}
              onChange={e => patch('woundLocation', e.target.value)}
              placeholder={tr('مثال: منطقة العجز، الكعب الأيمن...', 'e.g., Sacrum, Right heel...')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('تاريخ التقييم', 'Assessment Date')}</label>
            <input
              type="datetime-local"
              value={form.assessmentDate}
              onChange={e => patch('assessmentDate', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
          {form.woundType === 'PRESSURE' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('مرحلة القرحة', 'Pressure Stage')}</label>
              <select
                value={form.stage}
                onChange={e => patch('stage', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="">{tr('اختر...', 'Select...')}</option>
                {STAGES.map(s => (
                  <option key={s.value} value={s.value}>
                    {language === 'ar' ? s.labelAr : s.labelEn}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Measurements */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('القياسات', 'Measurements')}</h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'length' as const, labelAr: 'الطول (cm)', labelEn: 'Length (cm)' },
            { key: 'width' as const,  labelAr: 'العرض (cm)', labelEn: 'Width (cm)' },
            { key: 'depth' as const,  labelAr: 'العمق (cm)', labelEn: 'Depth (cm)' },
          ].map(({ key, labelAr, labelEn }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr(labelAr, labelEn)}</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form[key]}
                onChange={e => patch(key, e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
        {(Number(form.length) > 0 || Number(form.width) > 0) && (
          <p className="text-xs text-muted-foreground">
            {tr('المساحة التقريبية:', 'Approx. Area:')} <span className="font-semibold text-foreground">{area} cm²</span>
          </p>
        )}

        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.tunneling}
              onChange={e => patch('tunneling', e.target.checked)}
              className="rounded border-border text-rose-600 focus:ring-rose-500"
            />
            <span className="text-sm text-foreground">{tr('نفق (Tunneling)', 'Tunneling')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.undermining}
              onChange={e => patch('undermining', e.target.checked)}
              className="rounded border-border text-rose-600 focus:ring-rose-500"
            />
            <span className="text-sm text-foreground">{tr('تآكل تحتي (Undermining)', 'Undermining')}</span>
          </label>
        </div>
      </section>

      {/* Section 3: Wound Bed */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-foreground text-sm">{tr('قاع الجرح', 'Wound Bed Composition')}</h4>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            woundBedTotal === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {tr('المجموع', 'Total')}: {woundBedTotal}%
          </span>
        </div>
        {woundBedTotal !== 100 && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {tr('يجب أن يكون مجموع النسب 100%', 'Percentages should total 100%')}
          </p>
        )}
        <div className="space-y-3">
          {[
            { key: 'granulationPct' as const, labelAr: 'نسيج حبيبي (Granulation)', labelEn: 'Granulation', color: 'accent-red-500' },
            { key: 'sloughPct' as const,      labelAr: 'نسيج أصفر (Slough)',        labelEn: 'Slough',       color: 'accent-yellow-500' },
            { key: 'escharPct' as const,      labelAr: 'جلبة (Eschar)',             labelEn: 'Eschar',       color: 'accent-gray-700' },
            { key: 'epithelialPct' as const,  labelAr: 'ظهاري (Epithelial)',        labelEn: 'Epithelial',   color: 'accent-pink-400' },
          ].map(({ key, labelAr, labelEn, color }) => (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{tr(labelAr, labelEn)}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={form.woundBed[key]}
                onChange={e => patchWoundBed(key, Number(e.target.value))}
                className={`flex-1 h-2 rounded-lg appearance-none cursor-pointer ${color}`}
              />
              <span className="text-xs font-semibold text-foreground w-10 text-right">{form.woundBed[key]}%</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4: Exudate, Odor, Periwound */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('الإفرازات والمحيط', 'Exudate & Periwound')}</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('كمية الإفراز', 'Exudate Amount')}</label>
            <select
              value={form.exudate.amount}
              onChange={e => patchExudate('amount', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              {EXUDATE_AMOUNTS.map(a => (
                <option key={a.value} value={a.value}>{language === 'ar' ? a.labelAr : a.labelEn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('نوع الإفراز', 'Exudate Type')}</label>
            <select
              value={form.exudate.type}
              onChange={e => patchExudate('type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              {EXUDATE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{language === 'ar' ? t.labelAr : t.labelEn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الرائحة', 'Odor')}</label>
            <select
              value={form.odor}
              onChange={e => patch('odor', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            >
              {ODOR_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{language === 'ar' ? o.labelAr : o.labelEn}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('الجلد المحيط', 'Periwound Skin')}</label>
            <input
              type="text"
              value={form.periwoundSkin}
              onChange={e => patch('periwoundSkin', e.target.value)}
              placeholder={tr('وصف حال الجلد المحيط...', 'Describe periwound skin...')}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Pain Score */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            {tr('درجة الألم', 'Pain Score')}: <span className="font-bold text-rose-600">{form.painScore}/10</span>
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={form.painScore}
            onChange={e => patch('painScore', Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-rose-600"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>0 — {tr('لا ألم', 'No Pain')}</span>
            <span>5</span>
            <span>10 — {tr('أشد ألم', 'Worst Pain')}</span>
          </div>
        </div>
      </section>

      {/* Section 5: Treatment */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('خطة العلاج', 'Treatment Plan')}</h4>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'cleanser' as const,          labelAr: 'مادة التنظيف',       labelEn: 'Wound Cleanser' },
            { key: 'primaryDressing' as const,   labelAr: 'الضماد الأولي',     labelEn: 'Primary Dressing' },
            { key: 'secondaryDressing' as const, labelAr: 'الضماد الثانوي',    labelEn: 'Secondary Dressing' },
            { key: 'frequency' as const,         labelAr: 'تكرار تغيير الضماد', labelEn: 'Dressing Frequency' },
          ].map(({ key, labelAr, labelEn }) => (
            <div key={key}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr(labelAr, labelEn)}</label>
              <input
                type="text"
                value={form.treatment[key]}
                onChange={e => patchTreatment(key, e.target.value)}
                placeholder={tr('', '')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('ملاحظات العلاج', 'Treatment Notes')}</label>
          <textarea
            value={form.treatment.notes}
            onChange={e => patchTreatment('notes', e.target.value)}
            rows={2}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
        </div>
      </section>

      {/* Section 6: Trajectory + Notes + Save */}
      <section className="bg-card border rounded-xl p-5 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">{tr('مسار الشفاء والخلاصة', 'Healing Trajectory & Summary')}</h4>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">{tr('مسار الشفاء', 'Healing Trajectory')}</label>
          <div className="flex gap-2">
            {TRAJECTORIES.map(t => (
              <button
                key={t.value}
                onClick={() => patch('healingTrajectory', t.value)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                  form.healingTrajectory === t.value ? t.color : 'bg-card text-muted-foreground border-border hover:border-border'
                }`}
              >
                {language === 'ar' ? t.labelAr : t.labelEn}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">{tr('ملاحظات عامة', 'General Notes')}</label>
          <textarea
            value={form.notes}
            onChange={e => patch('notes', e.target.value)}
            rows={3}
            placeholder={tr('ملاحظات إضافية عن الجرح...', 'Additional wound notes...')}
            className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-rose-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
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
