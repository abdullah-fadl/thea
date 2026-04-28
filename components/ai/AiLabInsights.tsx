'use client';

import { useState } from 'react';
import { Sparkles, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import AiConfidenceBadge from './AiConfidenceBadge';
import AiDisclaimer from './AiDisclaimer';
import { useLang } from '@/hooks/use-lang';

interface LabResult {
  testCode: string;
  testName: string;
  value: number | string;
  unit: string;
  referenceRange?: string;
  flag?: string;
}

interface AiLabInsightsProps {
  results: LabResult[];
  patientAge?: number;
  patientGender?: string;
  className?: string;
}

interface LabInterpretation {
  summary: { ar: string; en: string };
  findings: {
    testCode: string;
    status: string;
    interpretation: { ar: string; en: string };
    clinicalSignificance: string;
  }[];
  patterns: {
    name: string;
    description: { ar: string; en: string };
    confidence: number;
    suggestedFollowUp: string[];
  }[];
  disclaimer: string;
}

interface RulePattern {
  name: string;
  description: { ar: string; en: string };
  confidence: { value: number; level: string };
  matchedTests: string[];
  suggestedFollowUp: string[];
  severity: string;
}

/**
 * AI Lab Insights panel — shows interpretation of lab results.
 */
export default function AiLabInsights({
  results,
  patientAge,
  patientGender,
  className = '',
}: AiLabInsightsProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const lang = language;

  const [loading, setLoading] = useState(false);
  const [interpretation, setInterpretation] = useState<LabInterpretation | null>(null);
  const [rulePatterns, setRulePatterns] = useState<RulePattern[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/interpret-labs', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results,
          patientAge,
          patientGender,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to interpret results');
      }

      const data = await res.json();
      setInterpretation(data.interpretation);
      setRulePatterns(data.ruleBasedPatterns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!interpretation && !loading) {
    return (
      <div className={`${className}`}>
        <button
          onClick={handleAnalyze}
          disabled={results.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Sparkles className="w-4 h-4" />
          {tr('رؤى الذكاء الاصطناعي', 'AI Insights')}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`bg-violet-50 border border-violet-200 rounded-2xl p-4 ${className}`}>
        <div className="flex items-center gap-2 text-violet-700">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">
            {tr('جاري تحليل النتائج...', 'Analyzing results...')}
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-2xl p-4 ${className}`}>
        <p className="text-sm text-red-700">{error}</p>
        <button onClick={handleAnalyze} className="mt-2 text-xs text-red-600 underline">
          {tr('إعادة المحاولة', 'Retry')}
        </button>
      </div>
    );
  }

  if (!interpretation) return null;

  return (
    <div className={`bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-violet-100/50 border-b border-violet-200 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-600" />
        <h3 className="text-sm font-bold text-violet-900">
          {tr('تحليل الذكاء الاصطناعي', 'AI Analysis')}
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        <div>
          <p className="text-sm text-foreground">{interpretation.summary[lang]}</p>
        </div>

        {/* Abnormal Findings */}
        {interpretation.findings.filter((f) => f.status !== 'normal').length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-2">
              {tr('نتائج غير طبيعية', 'Abnormal Findings')}
            </h4>
            <div className="space-y-1.5">
              {interpretation.findings
                .filter((f) => f.status !== 'normal')
                .map((finding) => (
                  <div
                    key={finding.testCode}
                    className={`px-3 py-2 rounded-lg text-xs ${
                      finding.status === 'critical'
                        ? 'bg-red-100 text-red-800'
                        : finding.clinicalSignificance === 'high'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-yellow-50 text-yellow-800'
                    }`}
                  >
                    <span className="font-bold">{finding.testCode}:</span>{' '}
                    {finding.interpretation[lang]}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Rule-Based Patterns */}
        {rulePatterns.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {tr('أنماط مكتشفة', 'Detected Patterns')}
            </h4>
            <div className="space-y-2">
              {rulePatterns.map((pattern) => (
                <div
                  key={pattern.name}
                  className={`p-3 rounded-xl border ${
                    pattern.severity === 'high'
                      ? 'bg-red-50 border-red-200'
                      : pattern.severity === 'moderate'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{pattern.name}</span>
                    <AiConfidenceBadge value={pattern.confidence.value} />
                  </div>
                  <p className="text-[11px] opacity-80">{pattern.description[lang]}</p>
                  {pattern.suggestedFollowUp.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {pattern.suggestedFollowUp.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 bg-white/60 rounded text-[9px] font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Patterns */}
        {interpretation.patterns.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {tr('أنماط اكتشفها الذكاء الاصطناعي', 'AI-Detected Patterns')}
            </h4>
            <div className="space-y-2">
              {interpretation.patterns.map((pattern) => (
                <div key={pattern.name} className="p-3 bg-violet-100/50 rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold">{pattern.name}</span>
                    <AiConfidenceBadge value={pattern.confidence} />
                  </div>
                  <p className="text-[11px] opacity-80">{pattern.description[lang]}</p>
                  {pattern.suggestedFollowUp.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {pattern.suggestedFollowUp.map((f) => (
                        <span key={f} className="px-1.5 py-0.5 bg-white/60 rounded text-[9px] font-medium">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <AiDisclaimer variant="banner" text={interpretation.disclaimer} />
      </div>
    </div>
  );
}
