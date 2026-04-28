'use client';

import { useState } from 'react';
import { FileText, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import AiDisclaimer from './AiDisclaimer';
import { useLang } from '@/hooks/use-lang';

interface AiPatientSummaryProps {
  patientId: string;
  patientAge?: number;
  patientGender?: string;
  className?: string;
}

interface PatientSummaryData {
  overview: { ar: string; en: string };
  activeDiagnoses: string[];
  currentMedications: string[];
  recentLabs: { test: string; value: string; status: string }[];
  recentRadiology: { study: string; impression: string }[];
  alerts: string[];
  disclaimer: string;
}

/**
 * AI-generated patient summary component.
 */
export default function AiPatientSummary({
  patientId,
  patientAge,
  patientGender,
  className = '',
}: AiPatientSummaryProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const lang = language;

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PatientSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/summarize-patient', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientAge,
          patientGender,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate summary');
      }

      const data = await res.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    const text = [
      summary.overview[lang],
      '',
      `${tr('التشخيصات', 'Diagnoses')}: ${summary.activeDiagnoses.join(', ')}`,
      `${tr('الأدوية', 'Medications')}: ${summary.currentMedications.join(', ')}`,
      '',
      summary.disclaimer,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = (status: string) => {
    if (status === 'critical') return 'text-red-600 font-bold';
    if (status === 'abnormal') return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className={className}>
      {/* Trigger */}
      {!summary && !loading && (
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <FileText className="w-4 h-4" />
          {tr('ملخص المريض بالذكاء الاصطناعي', 'AI Patient Summary')}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">
              {tr('جاري إنشاء الملخص...', 'Generating summary...')}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={handleGenerate} className="mt-2 text-xs text-red-600 underline">
            {tr('إعادة المحاولة', 'Retry')}
          </button>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-emerald-100/50 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-emerald-900">
                {tr('ملخص المريض', 'Patient Summary')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? tr('تم النسخ', 'Copied') : tr('نسخ', 'Copy')}
              </button>
              <button
                onClick={handleGenerate}
                className="text-[10px] text-emerald-600 hover:underline"
              >
                {tr('تحديث', 'Refresh')}
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {/* Overview */}
            <p className="text-sm text-foreground">{summary.overview[lang]}</p>

            {/* Alerts */}
            {summary.alerts.length > 0 && (
              <div className="space-y-1">
                {summary.alerts.map((alert, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Diagnoses */}
            {summary.activeDiagnoses.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                  {tr('التشخيصات النشطة', 'Active Diagnoses')}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {summary.activeDiagnoses.map((d, i) => (
                    <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px]">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Medications */}
            {summary.currentMedications.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                  {tr('الأدوية الحالية', 'Current Medications')}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {summary.currentMedications.map((m, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px]">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Labs */}
            {summary.recentLabs.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                  {tr('آخر التحاليل', 'Recent Labs')}
                </h4>
                <div className="grid grid-cols-2 gap-1">
                  {summary.recentLabs.slice(0, 8).map((lab, i) => (
                    <div key={i} className="text-[11px] flex justify-between bg-white/60 px-2 py-1 rounded">
                      <span className="text-muted-foreground">{lab.test}</span>
                      <span className={statusColor(lab.status)}>{lab.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Radiology */}
            {summary.recentRadiology.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                  {tr('آخر الأشعة', 'Recent Radiology')}
                </h4>
                <div className="space-y-1">
                  {summary.recentRadiology.map((r, i) => (
                    <div key={i} className="text-[11px] bg-white/60 px-2 py-1 rounded">
                      <span className="font-medium">{r.study}</span>
                      <span className="text-muted-foreground"> — {r.impression}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AiDisclaimer variant="banner" text={summary.disclaimer} />
          </div>
        </div>
      )}
    </div>
  );
}
