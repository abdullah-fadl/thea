'use client';

import { useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, Copy, Check } from 'lucide-react';
import AiConfidenceBadge from './AiConfidenceBadge';
import AiDisclaimer from './AiDisclaimer';
import { useLang } from '@/hooks/use-lang';

interface AiRadiologyAssistProps {
  modality: string;
  bodyPart: string;
  clinicalIndication?: string;
  currentFindings?: string;
  priorReports?: { date: string; impression: string }[];
  patientAge?: number;
  patientGender?: string;
  onInsertFinding?: (text: string) => void;
  onInsertImpression?: (text: string) => void;
  className?: string;
}

interface Finding {
  finding: { ar: string; en: string };
  location: string;
  confidence: number;
  severity: string;
}

interface RadiologyResult {
  suggestedFindings: Finding[];
  suggestedImpression: { ar: string; en: string };
  comparisons: string[];
  criticalAlert?: { finding: string; action: string };
}

/**
 * Radiology report AI assistant side panel.
 */
export default function AiRadiologyAssist({
  modality,
  bodyPart,
  clinicalIndication,
  currentFindings,
  priorReports,
  patientAge,
  patientGender,
  onInsertFinding,
  onInsertImpression,
  className = '',
}: AiRadiologyAssistProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const lang = language;

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RadiologyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAssist = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/radiology-assist', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modality,
          bodyPart,
          clinicalIndication,
          currentFindings,
          priorReports,
          patientAge,
          patientGender,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to get assistance');
      }

      const data = await res.json();
      setResult(data.assistance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'urgent': return 'border-red-300 bg-red-50';
      case 'moderate': return 'border-amber-300 bg-amber-50';
      default: return 'border-border bg-card';
    }
  };

  return (
    <div className={`${className}`}>
      {/* Trigger Button */}
      {!result && !loading && (
        <button
          onClick={handleAssist}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          {tr('اقتراح نتائج', 'Suggest Findings')}
        </button>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">
              {tr('جاري تحليل سياق الدراسة...', 'Analyzing study context...')}
            </span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={handleAssist} className="mt-2 text-xs text-red-600 underline">
            {tr('إعادة المحاولة', 'Retry')}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-cyan-100/50 border-b border-cyan-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-bold text-cyan-900">
                {tr('اقتراحات التقرير', 'Report Suggestions')}
              </h3>
            </div>
            <button
              onClick={handleAssist}
              className="text-[10px] text-cyan-600 hover:underline"
            >
              {tr('تحديث', 'Refresh')}
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Critical Alert */}
            {result.criticalAlert && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-xl">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-bold">{tr('حرج', 'CRITICAL')}</span>
                </div>
                <p className="text-xs text-red-700 mt-1">{result.criticalAlert.finding}</p>
                <p className="text-[10px] text-red-600 mt-0.5 font-medium">
                  {result.criticalAlert.action}
                </p>
              </div>
            )}

            {/* Suggested Findings */}
            {result.suggestedFindings.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground mb-2">
                  {tr('النتائج المقترحة', 'Suggested Findings')}
                </h4>
                <div className="space-y-2">
                  {result.suggestedFindings.map((f, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border ${severityColor(f.severity)}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-xs">{f.finding[lang]}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {f.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <AiConfidenceBadge value={f.confidence} showLabel={false} />
                          {onInsertFinding && (
                            <button
                              onClick={() => onInsertFinding(f.finding[lang])}
                              className="p-1 hover:bg-black/5 rounded"
                              title={tr('إدراج في التقرير', 'Insert into report')}
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Impression */}
            <div>
              <h4 className="text-xs font-bold text-muted-foreground mb-2">
                {tr('الانطباع المقترح', 'Suggested Impression')}
              </h4>
              <div className="p-3 bg-white/60 rounded-xl border border-cyan-200">
                <p className="text-xs">{result.suggestedImpression[lang]}</p>
                <div className="flex gap-1 mt-2">
                  {onInsertImpression && (
                    <button
                      onClick={() => onInsertImpression(result.suggestedImpression[lang])}
                      className="text-[10px] text-cyan-600 hover:underline"
                    >
                      {tr('إدراج', 'Insert')}
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(result.suggestedImpression[lang], 'impression')}
                    className="text-[10px] text-muted-foreground hover:underline flex items-center gap-0.5"
                  >
                    {copiedId === 'impression' ? (
                      <><Check className="w-2.5 h-2.5" /> {tr('تم النسخ', 'Copied')}</>
                    ) : (
                      <><Copy className="w-2.5 h-2.5" /> {tr('نسخ', 'Copy')}</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Comparisons */}
            {result.comparisons.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-muted-foreground mb-1">
                  {tr('اقتراحات المقارنة', 'Comparison Suggestions')}
                </h4>
                <ul className="space-y-0.5">
                  {result.comparisons.map((c, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground">
                      {'• '}{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AiDisclaimer variant="inline" />
          </div>
        </div>
      )}
    </div>
  );
}
