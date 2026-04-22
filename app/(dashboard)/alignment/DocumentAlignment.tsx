'use client';

// =============================================================================
// DocumentAlignment — Compare & align operational documents side-by-side
// =============================================================================

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  FileText,
  ArrowLeftRight,
  Upload,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Types ────────────────────────────────────────────────────────────────────
type MatchStatus = 'aligned' | 'partial' | 'gap' | 'conflict';

const STATUS_CONFIG: Record<MatchStatus, { labelEn: string; labelAr: string; color: string; bg: string; icon: any }> = {
  aligned:  { labelEn: 'Aligned',  labelAr: 'متوافق',    color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-100 dark:bg-green-900/30',  icon: CheckCircle2 },
  partial:  { labelEn: 'Partial',  labelAr: 'جزئي',      color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-100 dark:bg-amber-900/30',  icon: AlertTriangle },
  gap:      { labelEn: 'Gap',      labelAr: 'فجوة',      color: 'text-red-700 dark:text-red-300',      bg: 'bg-red-100 dark:bg-red-900/30',      icon: XCircle },
  conflict: { labelEn: 'Conflict', labelAr: 'تعارض',     color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30', icon: AlertTriangle },
};

export default function DocumentAlignment() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  const [sourceText, setSourceText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [mode, setMode] = useState<'paste' | 'policy'>('paste');
  const [selectedPolicy, setSelectedPolicy] = useState('');

  // Fetch policies for the policy comparison mode
  const { data: policiesData } = useSWR(
    mode === 'policy' ? '/api/sam/thea-engine/policies' : null,
    fetcher
  );
  const policies: any[] = policiesData?.policies || policiesData?.items || [];

  // ── Client-side paragraph alignment ──
  const analyzeAlignment = () => {
    if (!sourceText.trim() || !targetText.trim()) return;
    setIsAnalyzing(true);

    // Simple paragraph-level comparison
    const sourceParagraphs = sourceText.split(/\n\n+/).filter(p => p.trim());
    const targetParagraphs = targetText.split(/\n\n+/).filter(p => p.trim());

    const alignments: any[] = [];

    for (const sp of sourceParagraphs) {
      const spWords = new Set(sp.toLowerCase().split(/\s+/).filter(w => w.length > 3));
      let bestMatch = { index: -1, score: 0, text: '' };

      for (let i = 0; i < targetParagraphs.length; i++) {
        const tp = targetParagraphs[i];
        const tpWords = new Set(tp.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        const intersection = [...spWords].filter(w => tpWords.has(w)).length;
        const union = new Set([...spWords, ...tpWords]).size;
        const score = union > 0 ? intersection / union : 0;
        if (score > bestMatch.score) {
          bestMatch = { index: i, score, text: tp };
        }
      }

      let status: MatchStatus;
      if (bestMatch.score >= 0.5) status = 'aligned';
      else if (bestMatch.score >= 0.2) status = 'partial';
      else status = 'gap';

      alignments.push({
        source: sp.trim(),
        target: bestMatch.score >= 0.1 ? bestMatch.text.trim() : null,
        status,
        score: Math.round(bestMatch.score * 100),
      });
    }

    // Check for target paragraphs not matched
    const matchedTargets = new Set(alignments.filter(a => a.target).map(a => a.target));
    for (const tp of targetParagraphs) {
      if (!matchedTargets.has(tp.trim())) {
        alignments.push({
          source: null,
          target: tp.trim(),
          status: 'gap' as MatchStatus,
          score: 0,
        });
      }
    }

    const summary = {
      total: alignments.length,
      aligned: alignments.filter(a => a.status === 'aligned').length,
      partial: alignments.filter(a => a.status === 'partial').length,
      gap: alignments.filter(a => a.status === 'gap').length,
      overallScore: alignments.length > 0
        ? Math.round(alignments.reduce((s, a) => s + a.score, 0) / alignments.length)
        : 0,
    };

    setTimeout(() => {
      setResults({ alignments, summary });
      setIsAnalyzing(false);
    }, 800);
  };

  // ── AI-powered analysis via harmonize endpoint ──
  const analyzeWithAI = async () => {
    if (!sourceText.trim() || !targetText.trim()) return;
    setIsAnalyzing(true);

    try {
      const res = await fetch('/api/sam/thea-engine/harmonize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceDocument: sourceText,
          targetDocument: targetText,
          mode: 'alignment',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.alignments) {
          setResults(data);
        } else {
          // Fallback to local analysis
          analyzeAlignment();
          return;
        }
      } else {
        // Fallback to local analysis
        analyzeAlignment();
        return;
      }
    } catch {
      // Fallback to local analysis
      analyzeAlignment();
      return;
    }

    setIsAnalyzing(false);
  };

  const overallColor = results?.summary?.overallScore >= 70
    ? 'text-green-600'
    : results?.summary?.overallScore >= 40
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-indigo-500" />
          {tr('محاذاة المستندات', 'Document Alignment')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tr('مقارنة ومحاذاة المستندات التشغيلية وتحليل الفجوات', 'Compare and align operational documents, identify gaps and conflicts')}
        </p>
      </div>

      {/* ── Mode Tabs ── */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'paste' as const, labelEn: 'Paste Text', labelAr: 'لصق نص' },
          { key: 'policy' as const, labelEn: 'vs Policy', labelAr: 'مقارنة بسياسة' },
        ]).map(m => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); setResults(null); }}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition ${
              mode === m.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {isAr ? m.labelAr : m.labelEn}
          </button>
        ))}
      </div>

      {/* ── Input Areas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Source */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            {tr('المستند المصدر', 'Source Document')}
          </label>
          <textarea
            className="w-full h-64 p-3 text-sm border border-border rounded-xl bg-card focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono"
            placeholder={tr('الصق نص المستند المصدر هنا...', 'Paste source document text here...')}
            value={sourceText}
            onChange={e => setSourceText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{sourceText.split(/\s+/).filter(Boolean).length} {tr('كلمة', 'words')}</p>
        </div>

        {/* Target */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-500" />
            {mode === 'policy' ? tr('السياسة المرجعية', 'Reference Policy') : tr('المستند الهدف', 'Target Document')}
          </label>
          {mode === 'policy' && policies.length > 0 && (
            <select
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none mb-2"
              value={selectedPolicy}
              onChange={async (e) => {
                setSelectedPolicy(e.target.value);
                if (e.target.value) {
                  try {
                    const res = await fetch(`/api/sam/thea-engine/policies/${e.target.value}/text`, { credentials: 'include' });
                    if (res.ok) {
                      const d = await res.json();
                      setTargetText(d.text || d.content || '');
                    }
                  } catch { /* ignore */ }
                }
              }}
            >
              <option value="">{tr('اختر سياسة...', 'Select a policy...')}</option>
              {policies.map((p: any) => (
                <option key={p.id} value={p.id}>{p.title || p.originalFileName || p.id}</option>
              ))}
            </select>
          )}
          <textarea
            className="w-full h-64 p-3 text-sm border border-border rounded-xl bg-card focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono"
            placeholder={tr('الصق نص المستند الهدف هنا...', 'Paste target document text here...')}
            value={targetText}
            onChange={e => setTargetText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{targetText.split(/\s+/).filter(Boolean).length} {tr('كلمة', 'words')}</p>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="flex gap-3">
        <button
          onClick={analyzeAlignment}
          disabled={isAnalyzing || !sourceText.trim() || !targetText.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {isAnalyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {tr('تحليل المحاذاة', 'Analyze Alignment')}
        </button>
        <button
          onClick={analyzeWithAI}
          disabled={isAnalyzing || !sourceText.trim() || !targetText.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {isAnalyzing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {tr('تحليل بالذكاء الاصطناعي', 'AI Analysis')}
        </button>
      </div>

      {/* ── Results ── */}
      {results && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">{tr('النتيجة الكلية', 'Overall Score')}</p>
              <p className={`text-3xl font-bold ${overallColor}`}>{results.summary.overallScore}%</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">{tr('الفقرات', 'Paragraphs')}</p>
              <p className="text-2xl font-bold text-foreground">{results.summary.total}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">{tr('متوافق', 'Aligned')}</p>
              <p className="text-2xl font-bold text-green-600">{results.summary.aligned}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">{tr('جزئي', 'Partial')}</p>
              <p className="text-2xl font-bold text-amber-600">{results.summary.partial}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">{tr('فجوات', 'Gaps')}</p>
              <p className="text-2xl font-bold text-red-600">{results.summary.gap}</p>
            </div>
          </div>

          {/* Alignment Details */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {tr('تفاصيل المحاذاة', 'Alignment Details')}
            </h2>
            {results.alignments.map((a: any, idx: number) => {
              const sc = STATUS_CONFIG[a.status as MatchStatus] || STATUS_CONFIG.gap;
              const Icon = sc.icon;
              return (
                <div key={idx} className={`rounded-xl border-2 overflow-hidden ${
                  a.status === 'aligned' ? 'border-green-200 dark:border-green-800' :
                  a.status === 'partial' ? 'border-amber-200 dark:border-amber-800' :
                  'border-red-200 dark:border-red-800'
                }`}>
                  {/* Status bar */}
                  <div className={`flex items-center gap-2 px-4 py-2 ${sc.bg}`}>
                    <Icon className={`h-4 w-4 ${sc.color}`} />
                    <span className={`text-xs font-bold ${sc.color}`}>
                      {isAr ? sc.labelAr : sc.labelEn}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{a.score}% {tr('تطابق', 'match')}</span>
                  </div>
                  {/* Side by side */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                    <div className="p-4">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr('المصدر', 'Source')}</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {a.source || <span className="italic text-muted-foreground">{tr('— لا يوجد مقطع مقابل —', '— No matching paragraph —')}</span>}
                      </p>
                    </div>
                    <div className="p-4">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr('الهدف', 'Target')}</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {a.target || <span className="italic text-muted-foreground">{tr('— لا يوجد مقطع مقابل —', '— No matching paragraph —')}</span>}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
