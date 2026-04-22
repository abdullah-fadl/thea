'use client';

import { useState, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import {
  Shield, RefreshCw, AlertTriangle, Clock, Trash2,
  ArrowUpCircle, Zap, CheckCircle, Activity, Brain,
} from 'lucide-react';

interface CorrectionResult {
  corrections: {
    staleDecisionsReset: number;
    orphanedSignalsFixed: number;
    deadlinesEscalated: number;
    duplicatesCleaned: number;
    failedActionsRetried: number;
    pulseGapFilled: boolean;
  };
  totalCorrections: number;
  timestamp: string;
}

export default function SelfCorrectionPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<CorrectionResult[]>([]);

  const runCorrection = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/imdad/decisions/autonomous/self-correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data: CorrectionResult = await res.json();
        setHistory(prev => [data, ...prev].slice(0, 30));
      }
    } catch { /* continue */ }
    setRunning(false);
  }, []);

  const totalFixed = history.reduce((s, h) => s + h.totalCorrections, 0);

  const correctionTypes = [
    { key: 'staleDecisionsReset', icon: Clock, label: tr('قرارات عالقة', 'Stale Decisions Reset'), color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20' },
    { key: 'orphanedSignalsFixed', icon: AlertTriangle, label: tr('إشارات يتيمة', 'Orphaned Signals Fixed'), color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/20' },
    { key: 'deadlinesEscalated', icon: ArrowUpCircle, label: tr('مهل مُصعّدة', 'Deadlines Escalated'), color: 'text-orange-400', bgColor: 'bg-orange-500/10 border-orange-500/20' },
    { key: 'duplicatesCleaned', icon: Trash2, label: tr('مكررات منظّفة', 'Duplicates Cleaned'), color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20' },
    { key: 'failedActionsRetried', icon: RefreshCw, label: tr('إجراءات مُعادة', 'Failed Actions Retried'), color: 'text-purple-400', bgColor: 'bg-purple-500/10 border-purple-500/20' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Shield className="h-10 w-10 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold">
              {tr('التصحيح الذاتي', 'Self-Correction Engine')}
            </h1>
            <p className="text-sm text-gray-400">
              {tr('كشف التناقضات ← تصحيح فوري ← استمرار بلا توقف', 'Detect inconsistencies → Correct immediately → Continue without stopping')}
            </p>
          </div>
        </div>

        <button
          onClick={runCorrection}
          disabled={running}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all text-sm',
            'bg-cyan-600/20 border border-cyan-500 text-cyan-400 hover:bg-cyan-600/30',
            running && 'opacity-50 cursor-not-allowed',
          )}
        >
          <Shield className={cn('h-4 w-4', running && 'animate-spin')} />
          {running ? tr('جارٍ التصحيح...', 'Correcting...') : tr('تشغيل التصحيح', 'Run Self-Correct')}
        </button>
      </div>

      {/* Self-Correction DNA */}
      <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-[#D4A017]" />
          <span className="font-semibold text-sm">{tr('قانون التصحيح الذاتي', 'Self-Correction Law')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#0a0f1e] border border-gray-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2 text-amber-400">
              <Activity className="h-4 w-4" />
              <span className="font-semibold">{tr('اكتشاف فوري', 'Detect Immediately')}</span>
            </div>
            <p className="text-gray-400">{tr('أي تناقض أو عطل يتم اكتشافه فوراً', 'Any inconsistency or failure is detected instantly')}</p>
          </div>
          <div className="bg-[#0a0f1e] border border-gray-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              <Zap className="h-4 w-4" />
              <span className="font-semibold">{tr('تصحيح فوري', 'Correct Immediately')}</span>
            </div>
            <p className="text-gray-400">{tr('لا انتظار. لا تقارير. تصحيح مباشر.', 'No waiting. No reporting. Direct correction.')}</p>
          </div>
          <div className="bg-[#0a0f1e] border border-gray-700/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <CheckCircle className="h-4 w-4" />
              <span className="font-semibold">{tr('استمرار التنفيذ', 'Continue Execution')}</span>
            </div>
            <p className="text-gray-400">{tr('الحلقة لا تتوقف أبداً. التنفيذ مستمر.', 'The loop never stops. Execution continues.')}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-4 col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-cyan-400" />
            <span className="text-xs text-gray-400">{tr('إجمالي التصحيحات', 'Total Fixes')}</span>
          </div>
          <p className="text-2xl font-bold text-cyan-400">{totalFixed}</p>
        </div>
        {correctionTypes.map(ct => {
          const total = history.reduce((s, h) => s + ((h.corrections as any)[ct.key] ?? 0), 0);
          return (
            <div key={ct.key} className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ct.icon className={cn('h-4 w-4', ct.color)} />
                <span className="text-[10px] text-gray-400">{ct.label}</span>
              </div>
              <p className={cn('text-xl font-bold', ct.color)}>{total}</p>
            </div>
          );
        })}
      </div>

      {/* History */}
      <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="h-5 w-5 text-[#D4A017]" />
          <span className="font-semibold">{tr('سجل التصحيحات', 'Correction History')}</span>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{tr('لا توجد تصحيحات بعد', 'No corrections yet')}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {history.map((entry, idx) => (
              <div key={idx} className="bg-[#0a0f1e] border border-gray-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded font-semibold',
                    entry.totalCorrections > 0
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'bg-emerald-500/20 text-emerald-400',
                  )}>
                    {entry.totalCorrections > 0
                      ? `${entry.totalCorrections} ${tr('تصحيح', 'fixes')}`
                      : tr('النظام سليم', 'System Clean')}
                  </span>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  {correctionTypes.map(ct => (
                    <div key={ct.key} className={cn('rounded-lg border p-2 text-center', ct.bgColor)}>
                      <ct.icon className={cn('h-3.5 w-3.5 mx-auto mb-1', ct.color)} />
                      <p className={cn('font-bold', ct.color)}>{(entry.corrections as any)[ct.key] ?? 0}</p>
                    </div>
                  ))}
                  <div className={cn(
                    'rounded-lg border p-2 text-center',
                    entry.corrections.pulseGapFilled ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-gray-500/10 border-gray-700/20',
                  )}>
                    <Activity className={cn('h-3.5 w-3.5 mx-auto mb-1', entry.corrections.pulseGapFilled ? 'text-emerald-400' : 'text-gray-500')} />
                    <p className={cn('font-bold text-xs', entry.corrections.pulseGapFilled ? 'text-emerald-400' : 'text-gray-500')}>
                      {entry.corrections.pulseGapFilled ? tr('نبض', 'Pulse') : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
