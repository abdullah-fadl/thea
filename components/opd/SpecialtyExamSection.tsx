'use client';

// =============================================================================
// SpecialtyExamSection — NEW FILE
// =============================================================================
// Reads specialtyConfig to render dynamic exam fields for any specialty.
// Usage in OverviewPanel: <SpecialtyExamSection specialtyCode={...} visitId={...} />

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { ChevronDown, ChevronUp, Save, RefreshCw, BarChart3, Calculator, Check } from 'lucide-react';
import {
  getSpecialtyConfig, getSpecialtyGroups, GROUP_LABELS,
  type SpecialtyField, type SpecialtyConfig,
} from '@/lib/opd/specialtyConfig';
import { calcPregnancy, calcBMI } from '@/lib/opd/specialtyCalc';
import dynamic from 'next/dynamic';

const SpecialtyScoreTools = dynamic(() => import('./SpecialtyScoreTools'), { ssr: false });

interface Props {
  specialtyCode: string;
  visitId: string;
  readOnly?: boolean;
}

export default function SpecialtyExamSection({ specialtyCode, visitId, readOnly = false }: Props) {
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const config: SpecialtyConfig | null = getSpecialtyConfig(specialtyCode);
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showScores, setShowScores] = useState(false);
  const [autoCalc, setAutoCalc] = useState<string | null>(null);

  // Load existing data from encounter (clinicExtensions.specialty)
  useEffect(() => {
    if (!visitId || !config) return;
    fetch(`/api/opd/encounters/${visitId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const existing = (data?.opd?.clinicExtensions as Record<string, unknown> | undefined)?.specialty ?? {};
        setValues(existing);
      })
      .catch(() => {});
  }, [visitId, config]);

  // Auto-calculations
  useEffect(() => {
    if (!config) return;

    // Pregnancy: calculate EDD from LMP
    if (config.codes.some(c => ['gynecology', 'gynaecology', 'obgyn'].includes(c)) && values.lmp) {
      try {
        const result = calcPregnancy(new Date(values.lmp));
        setAutoCalc(
          tr(
            `EDD: ${result.eddFormatted} | ${result.gestationalWeeks} أسابيع و ${result.gestationalDays} أيام | ${['', 'الثلث الأول', 'الثلث الثاني', 'الثلث الثالث'][result.trimester]}`,
            `EDD: ${result.eddFormatted} | ${result.gestationalWeeks}w ${result.gestationalDays}d | Trimester ${result.trimester}`,
          )
        );
      } catch { setAutoCalc(null); }
    }

    // BMI for peds
    if (config.codes.some(c => c === 'pediatric' || c === 'peds') && values.weight && values.height) {
      const bmi = calcBMI(Number(values.weight), Number(values.height));
      setAutoCalc(tr(`BMI: ${bmi.bmi} — ${bmi.categoryAr}`, `BMI: ${bmi.bmi} — ${bmi.category}`));
    }
  }, [values, config]);

  const handleChange = (key: string, value: any) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = useCallback(async () => {
    if (!visitId || !config) return;
    setSaving(true);
    try {
      await fetch(`/api/opd/encounters/${visitId}/clinic-extensions`, {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opdClinicExtensions: { specialty: values },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }, [visitId, config, values]);

  if (!config) return null;

  const groups = getSpecialtyGroups(config.examFields);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{config.icon}</span>
          <span className="font-semibold text-sm">
            {tr(`فحص ${config.labelAr}`, `${config.labelEn} Exam`)}
          </span>
          <span className="text-xs text-muted-foreground">({config.examFields.length} {tr('حقل', 'fields')})</span>
        </div>
        <div className="flex items-center gap-2">
          {config.scoringTools && config.scoringTools.length > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setShowScores(p => !p); }}
              className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 transition"
            >
              <BarChart3 className="h-3.5 w-3.5 inline-block" /> {tr('أدوات التقييم', 'Scoring Tools')}
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Auto-calc banner */}
      {autoCalc && expanded && (
        <div className="mx-4 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 inline-block" /> {autoCalc}
        </div>
      )}

      {/* Scoring Tools */}
      {showScores && config.scoringTools && (
        <div className="mx-4 mb-4">
          <SpecialtyScoreTools tools={config.scoringTools} />
        </div>
      )}

      {/* Fields */}
      {expanded && (
        <div className="px-4 pb-4 space-y-5">
          {groups.map(group => {
            const groupFields = config.examFields.filter(f => (f.group ?? 'general') === group);
            const groupLabel = GROUP_LABELS[group];
            return (
              <div key={group}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {groupLabel ? tr(groupLabel.ar, groupLabel.en) : group}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {groupFields.map(field => (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={values[field.key] ?? ''}
                      onChange={v => handleChange(field.key, v)}
                      isRTL={isRTL}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Save button */}
          {!readOnly && (
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              {saved && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5 inline-block" /> {tr('تم الحفظ', 'Saved')}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {tr('حفظ', 'Save')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Individual field renderer ─────────────────────────────────────────────────
function FieldInput({
  field, value, onChange, isRTL, readOnly,
}: {
  field: SpecialtyField;
  value: any;
  onChange: (v: any) => void;
  isRTL: boolean;
  readOnly: boolean;
}) {
  const label = isRTL ? field.labelAr : field.labelEn;
  const hint = isRTL ? field.hintAr : field.hint;

  const inputClass = `w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-muted`;

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
        {field.unit && <span className="text-muted-foreground ms-1">({field.unit})</span>}
      </label>

      {field.type === 'select' && (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
          className={inputClass}
        >
          <option value="">—</option>
          {(field.options ?? []).map((opt, i) => (
            <option key={opt} value={opt}>
              {isRTL && field.optionsAr?.[i] ? field.optionsAr[i] : opt}
            </option>
          ))}
        </select>
      )}

      {field.type === 'multiselect' && (
        <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-lg bg-card min-h-[42px]">
          {(field.options ?? []).map((opt, i) => {
            const selected = Array.isArray(value) ? value.includes(opt) : false;
            return (
              <button
                key={opt}
                type="button"
                disabled={readOnly}
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(selected ? current.filter((x: string) => x !== opt) : [...current, opt]);
                }}
                className={`text-xs px-2 py-0.5 rounded-full transition ${
                  selected
                    ? 'bg-blue-600 text-white'
                    : 'bg-muted text-foreground hover:bg-muted'
                }`}
              >
                {isRTL && field.optionsAr?.[i] ? field.optionsAr[i] : opt}
              </button>
            );
          })}
        </div>
      )}

      {(field.type === 'text' || field.type === 'number' || field.type === 'date') && (
        <input
          type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={e => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
          disabled={readOnly}
          placeholder={hint ?? ''}
          className={inputClass}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={readOnly}
          rows={3}
          placeholder={hint ?? ''}
          className={`${inputClass} resize-none`}
        />
      )}

      {field.type === 'scale' && (
        <div className="space-y-1">
          <input
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 10}
            step={1}
            value={value || 0}
            onChange={e => onChange(Number(e.target.value))}
            disabled={readOnly}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{field.min ?? 0}</span>
            <span className="font-bold text-blue-600">{value || 0}</span>
            <span>{field.max ?? 10}</span>
          </div>
        </div>
      )}

      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            disabled={readOnly}
            className="rounded border-border"
          />
          <span className="text-sm">{label}</span>
        </label>
      )}
    </div>
  );
}
