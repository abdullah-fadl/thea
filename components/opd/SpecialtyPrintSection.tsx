'use client';

// =============================================================================
// SpecialtyPrintSection — NEW FILE
// =============================================================================
// Print-ready specialty exam section — used inside prescription/visit prints.
// Pure presentational — reads the stored values and formats them for print.

import { useLang } from '@/hooks/use-lang';
import { getSpecialtyConfig, getSpecialtyGroups, GROUP_LABELS, type SpecialtyField } from '@/lib/opd/specialtyConfig';

interface Props {
  specialtyCode: string;
  examData: Record<string, any>;
  patientName?: string;
  visitDate?: string;
}

export default function SpecialtyPrintSection({ specialtyCode, examData, patientName, visitDate }: Props) {
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const config = getSpecialtyConfig(specialtyCode);
  if (!config) return null;

  // Filter to only fields that have values
  const filledFields = config.examFields.filter(f => {
    const v = examData[f.key];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== '';
  });

  if (filledFields.length === 0) return null;

  const groups = getSpecialtyGroups(filledFields);

  return (
    <section className="print-specialty-section mt-4 pt-4 border-t border-gray-300">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{config.icon}</span>
        <h3 className="font-bold text-sm">
          {tr(`الفحص السريري — ${config.labelAr}`, `Clinical Exam — ${config.labelEn}`)}
        </h3>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        {groups.map(group => {
          const groupFields = filledFields.filter(f => (f.group ?? 'general') === group);
          if (groupFields.length === 0) return null;
          const groupLabel = GROUP_LABELS[group];

          return (
            <div key={group}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                {groupLabel ? tr(groupLabel.ar, groupLabel.en) : group}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {groupFields.map(field => (
                  <div key={field.key} className="flex items-start gap-1.5 text-xs">
                    <span className="text-gray-500 min-w-0 shrink-0">
                      {isRTL ? field.labelAr : field.labelEn}
                      {field.unit ? ` (${field.unit})` : ''}:
                    </span>
                    <span className="font-medium text-gray-900 break-words">
                      {formatFieldValue(examData[field.key], field)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatFieldValue(value: any, field: SpecialtyField): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field.type === 'date' && value) {
    try { return new Date(value).toLocaleDateString('en-US'); } catch { return String(value); }
  }
  return String(value ?? '');
}
