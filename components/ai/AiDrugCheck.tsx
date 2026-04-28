'use client';

import { useState } from 'react';
import { Pill, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import AiDisclaimer from './AiDisclaimer';
import { useLang } from '@/hooks/use-lang';

interface Medication {
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
}

interface AiDrugCheckProps {
  medications: Medication[];
  allergies?: string[];
  className?: string;
}

interface Interaction {
  drug1: string;
  drug2: string;
  severity: string;
  description: { ar: string; en: string };
  mechanism?: string;
  management: { ar: string; en: string };
}

interface AllergyConflict {
  drug: string;
  allergen: string;
  description: { ar: string; en: string };
  severity: string;
}

interface DrugCheckResult {
  interactions: Interaction[];
  allergyConflicts: AllergyConflict[];
  disclaimer: string;
}

/**
 * Drug interaction checker UI component.
 */
export default function AiDrugCheck({
  medications,
  allergies,
  className = '',
}: AiDrugCheckProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const lang = language;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrugCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/drug-check', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medications, allergies }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to check interactions');
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const severityBadge = (severity: string) => {
    switch (severity) {
      case 'contraindicated':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'major':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const severityLabel = (severity: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      contraindicated: { ar: 'موانع', en: 'Contraindicated' },
      major: { ar: 'شديد', en: 'Major' },
      moderate: { ar: 'متوسط', en: 'Moderate' },
      minor: { ar: 'بسيط', en: 'Minor' },
    };
    return labels[severity]?.[lang] || severity;
  };

  return (
    <div className={className}>
      {/* Trigger */}
      {!result && !loading && (
        <button
          onClick={handleCheck}
          disabled={medications.length < 2}
          className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Pill className="w-3.5 h-3.5" />
          {tr('فحص التداخلات', 'Check Interactions')}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-orange-600 text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {tr('جاري فحص التداخلات...', 'Checking interactions...')}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-red-600 py-1">
          {error}
          <button onClick={handleCheck} className="ml-2 underline">
            {tr('إعادة المحاولة', 'Retry')}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-3 mt-2">
          {/* Allergy Conflicts */}
          {result.allergyConflicts.length > 0 && (
            <div className="space-y-2">
              {result.allergyConflicts.map((conflict, i) => (
                <div
                  key={i}
                  className="p-3 bg-red-50 border border-red-300 rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-bold text-red-800">
                      {tr('تعارض حساسية', 'Allergy Conflict')}
                    </span>
                  </div>
                  <p className="text-xs text-red-700">
                    <strong>{conflict.drug}</strong> {'↔'} <strong>{conflict.allergen}</strong>
                  </p>
                  <p className="text-[11px] text-red-600 mt-0.5">
                    {conflict.description[lang]}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Drug Interactions */}
          {result.interactions.length > 0 ? (
            <div className="space-y-2">
              {result.interactions.map((interaction, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border ${severityBadge(interaction.severity)}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold">
                        {interaction.drug1} {'↔'} {interaction.drug2}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase">
                      {severityLabel(interaction.severity)}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1">{interaction.description[lang]}</p>
                  {interaction.mechanism && (
                    <p className="text-[10px] opacity-60 mt-0.5">
                      {tr('الآلية:', 'Mechanism:')} {interaction.mechanism}
                    </p>
                  )}
                  <p className="text-[11px] mt-1 font-medium">
                    {tr('العلاج:', 'Management:')} {interaction.management[lang]}
                  </p>
                </div>
              ))}
            </div>
          ) : result.allergyConflicts.length === 0 ? (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
              {tr('لم يتم اكتشاف تداخلات دوائية', 'No drug interactions detected')}
            </div>
          ) : null}

          {/* Re-check and disclaimer */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleCheck}
              className="text-[10px] text-orange-600 hover:underline"
            >
              {tr('إعادة الفحص', 'Re-check')}
            </button>
            <AiDisclaimer variant="inline" />
          </div>
        </div>
      )}
    </div>
  );
}
