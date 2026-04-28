'use client';

import { useState, useCallback, useEffect } from 'react';
import { useLang } from '@/hooks/use-lang';
import {
  Activity,
  Gauge,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  ShieldAlert,
  Brain,
  Boxes,
  DollarSign,
  Truck,
  FlaskConical,
  Heart,
  RefreshCw,
} from 'lucide-react';

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

interface PressureDimension {
  value: number;
  severity: string;
  drivers: string[];
}

interface CycleResult {
  cycle: { startedAt: string; completedAt: string; durationMs: number; phases: number; model: string };
  pressure: {
    composite: number;
    state: string;
    dimensions: Record<string, PressureDimension>;
  };
  cluster: { clustersGenerated: number; clusterDecisions: number; detectedSituations: string[] };
  predict: { predictionsGenerated: number; proactiveSignals: number; proactiveDecisions: number; systemOutlook: string };
  detect: { findings: number; signalsCreated: number; duplicatesSkipped: number };
  decide: { decisionsCreated: number; autoApproved: number };
  execute: { decisionsExecuted: number; actionsCreated: number };
  selfCorrect: { staleReset: number; deadlinesEscalated: number; duplicatesCleaned: number };
  pulse: { healthScore: number; pressure: number; trend: string };
}

const DIMENSION_META: Record<string, { icon: typeof Activity; label: string; labelAr: string; color: string }> = {
  clinicalLoad: { icon: Heart, label: 'Clinical Load', labelAr: 'الحمل السريري', color: 'text-red-400' },
  supplyStrain: { icon: Boxes, label: 'Supply Strain', labelAr: 'إجهاد الإمداد', color: 'text-orange-400' },
  assetRisk: { icon: ShieldAlert, label: 'Asset Risk', labelAr: 'مخاطر الأصول', color: 'text-yellow-400' },
  budgetBurn: { icon: DollarSign, label: 'Budget Burn', labelAr: 'استنزاف الميزانية', color: 'text-emerald-400' },
  vendorReliability: { icon: Truck, label: 'Vendor Reliability', labelAr: 'موثوقية المورد', color: 'text-blue-400' },
  procurementVelocity: { icon: Zap, label: 'Procurement Velocity', labelAr: 'سرعة المشتريات', color: 'text-purple-400' },
  qualityExposure: { icon: FlaskConical, label: 'Quality Exposure', labelAr: 'التعرض للجودة', color: 'text-cyan-400' },
};

const STATE_COLORS: Record<string, string> = {
  STABLE: 'text-emerald-400 bg-emerald-950/50 border-emerald-700/40',
  ELEVATED: 'text-amber-400 bg-amber-950/50 border-amber-700/40',
  HIGH_PRESSURE: 'text-orange-400 bg-orange-950/50 border-orange-700/40',
  CRITICAL_PRESSURE: 'text-red-400 bg-red-950/50 border-red-700/40 animate-pulse',
};

const OUTLOOK_COLORS: Record<string, string> = {
  CLEAR: 'text-emerald-400',
  WATCH: 'text-amber-400',
  WARNING: 'text-orange-400',
  CRITICAL: 'text-red-400',
};

export default function PressureModePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [result, setResult] = useState<CycleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CycleResult[]>([]);
  const [autoRun, setAutoRun] = useState(false);

  const runCycle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/imdad/decisions/autonomous/core-loop', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setHistory((prev) => [data, ...prev].slice(0, 20));
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!autoRun) return;
    const iv = setInterval(runCycle, 30000);
    return () => clearInterval(iv);
  }, [autoRun, runCycle]);

  const p = result?.pressure;
  const compositeP = p?.composite ?? 0;
  const state = p?.state ?? 'STABLE';

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Gauge className="h-8 w-8 text-orange-400" />
          <div>
            <h1 className="text-2xl font-bold">{tr('نموذج الضغط التشغيلي', 'Operational Pressure Model')}</h1>
            <p className="text-sm text-gray-500">{tr('النظام المدفوع بالضغط — ٩ مراحل', 'Pressure-Driven System — 9 Phases')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRun(!autoRun)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              autoRun ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300',
            )}
          >
            {autoRun ? tr('إيقاف التكرار', 'Stop Loop') : tr('حلقة تلقائية', 'Auto Loop')}
          </button>
          <button
            onClick={runCycle}
            disabled={loading}
            className="px-4 py-2 bg-orange-600/80 hover:bg-orange-600 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            {tr('تشغيل الدورة', 'Run Cycle')}
          </button>
        </div>
      </div>

      {!result ? (
        <div className="text-center py-24 text-gray-500">
          <Gauge className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg">{tr('اضغط "تشغيل الدورة" لبدء نموذج الضغط', 'Press "Run Cycle" to start Pressure Model')}</p>
        </div>
      ) : (
        <>
          {/* Composite Pressure Gauge */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className={cn('col-span-1 rounded-2xl border p-6 text-center', STATE_COLORS[state])}>
              <p className="text-sm mb-2">{tr('الضغط المركب', 'Composite Pressure')}</p>
              <p className="text-6xl font-black">{compositeP.toFixed(1)}</p>
              <p className="text-lg font-bold mt-1">{state.replace(/_/g, ' ')}</p>
              <div className="mt-3 h-3 bg-black/30 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    compositeP >= 80 ? 'bg-red-500' : compositeP >= 60 ? 'bg-orange-500' : compositeP >= 30 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${Math.min(100, compositeP)}%` }}
                />
              </div>
            </div>

            {/* Cycle Stats */}
            <div className="bg-[#111827] border border-gray-700/50 rounded-2xl p-6">
              <p className="text-sm text-gray-500 mb-3">{tr('ملخص الدورة', 'Cycle Summary')}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">{tr('المدة', 'Duration')}</span><span>{result.cycle.durationMs}ms</span></div>
                <div className="flex justify-between"><span className="text-gray-400">{tr('الإشارات', 'Signals')}</span><span>{result.detect.signalsCreated}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">{tr('القرارات', 'Decisions')}</span><span>{result.decide.decisionsCreated}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">{tr('المجموعات', 'Clusters')}</span><span className="text-purple-400">{result.cluster.clustersGenerated}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">{tr('قرارات المجموعات', 'Cluster Decisions')}</span><span className="text-purple-400">{result.cluster.clusterDecisions}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">{tr('التنبؤات', 'Predictions')}</span><span className="text-cyan-400">{result.predict.predictionsGenerated}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">{tr('القرارات الاستباقية', 'Proactive Decisions')}</span><span className="text-cyan-400">{result.predict.proactiveDecisions}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">{tr('المنفذة', 'Executed')}</span><span className="text-green-400">{result.execute.decisionsExecuted}</span></div>
              </div>
            </div>

            {/* Outlook */}
            <div className="bg-[#111827] border border-gray-700/50 rounded-2xl p-6">
              <p className="text-sm text-gray-500 mb-3">{tr('النظرة المستقبلية', 'System Outlook')}</p>
              <div className="flex items-center gap-3 mb-4">
                <Brain className={cn('h-8 w-8', OUTLOOK_COLORS[result.predict.systemOutlook])} />
                <span className={cn('text-2xl font-bold', OUTLOOK_COLORS[result.predict.systemOutlook])}>
                  {result.predict.systemOutlook}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-3">{tr('صحة النظام', 'System Health')}: <span className="text-white font-bold">{result.pulse.healthScore}%</span></p>
              <p className="text-sm text-gray-400 mb-1">{tr('الاتجاه', 'Trend')}:</p>
              <div className="flex items-center gap-2">
                {result.pulse.trend.includes('IMPROV') ? (
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                ) : result.pulse.trend.includes('DECLIN') ? (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                ) : (
                  <Activity className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm">{result.pulse.trend}</span>
              </div>
              {result.cluster.detectedSituations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <p className="text-xs text-gray-500 mb-1">{tr('المواقف المكتشفة', 'Detected Situations')}</p>
                  <div className="flex flex-wrap gap-1">
                    {result.cluster.detectedSituations.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-red-900/40 border border-red-700/30 rounded text-[10px] text-red-300">
                        {s.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7 Pressure Dimensions */}
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            {tr('أبعاد الضغط السبعة', '7 Pressure Dimensions')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Object.entries(DIMENSION_META).map(([key, meta]) => {
              const dim = p?.dimensions?.[key];
              const val = dim?.value ?? 0;
              const Icon = meta.icon;
              return (
                <div key={key} className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-4 w-4', meta.color)} />
                      <span className="text-xs text-gray-400">{tr(meta.labelAr, meta.label)}</span>
                    </div>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        dim?.severity === 'CRITICAL'
                          ? 'bg-red-900/50 text-red-300'
                          : dim?.severity === 'HIGH'
                            ? 'bg-orange-900/50 text-orange-300'
                            : dim?.severity === 'MEDIUM'
                              ? 'bg-amber-900/50 text-amber-300'
                              : 'bg-gray-800 text-gray-400',
                      )}
                    >
                      {dim?.severity ?? 'LOW'}
                    </span>
                  </div>
                  <p className={cn('text-3xl font-black', meta.color)}>{val.toFixed(1)}</p>
                  <div className="mt-2 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        val >= 80 ? 'bg-red-500' : val >= 50 ? 'bg-orange-500' : val >= 25 ? 'bg-amber-500' : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(100, val)}%` }}
                    />
                  </div>
                  {dim?.drivers && dim.drivers.length > 0 && (
                    <div className="mt-2">
                      {dim.drivers.map((d, i) => (
                        <p key={i} className="text-[10px] text-gray-500 truncate">
                          {d}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cycle History */}
          {history.length > 1 && (
            <>
              <h2 className="text-lg font-bold mb-4">{tr('سجل الدورات', 'Cycle History')}</h2>
              <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700/50">
                      <th className="text-start py-2 px-2">#</th>
                      <th className="text-start py-2 px-2">{tr('الضغط', 'Pressure')}</th>
                      <th className="text-start py-2 px-2">{tr('الحالة', 'State')}</th>
                      <th className="text-start py-2 px-2">{tr('إشارات', 'Signals')}</th>
                      <th className="text-start py-2 px-2">{tr('قرارات', 'Decisions')}</th>
                      <th className="text-start py-2 px-2">{tr('مجموعات', 'Clusters')}</th>
                      <th className="text-start py-2 px-2">{tr('تنبؤات', 'Predictions')}</th>
                      <th className="text-start py-2 px-2">{tr('المدة', 'Duration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i} className="border-b border-gray-800/40">
                        <td className="py-2 px-2 text-gray-500">{history.length - i}</td>
                        <td className="py-2 px-2 font-bold">{h.pressure?.composite?.toFixed(1) ?? '-'}</td>
                        <td className="py-2 px-2">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-[10px]',
                              STATE_COLORS[h.pressure?.state ?? 'STABLE'],
                            )}
                          >
                            {h.pressure?.state?.replace(/_/g, ' ') ?? '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2">{h.detect?.signalsCreated ?? 0}</td>
                        <td className="py-2 px-2">{(h.decide?.decisionsCreated ?? 0) + (h.cluster?.clusterDecisions ?? 0)}</td>
                        <td className="py-2 px-2 text-purple-400">{h.cluster?.clustersGenerated ?? 0}</td>
                        <td className="py-2 px-2 text-cyan-400">{h.predict?.predictionsGenerated ?? 0}</td>
                        <td className="py-2 px-2 text-gray-500">{h.cycle?.durationMs ?? 0}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* 9-Phase Architecture */}
          <div className="mt-8 bg-[#111827] border border-gray-700/50 rounded-xl p-6">
            <h3 className="text-sm font-bold text-gray-400 mb-4">{tr('بنية ٩ مراحل', '9-Phase Architecture')}</h3>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {[
                { n: '1', en: 'OBSERVE', ar: 'مراقبة', c: 'bg-blue-900/40 text-blue-300 border-blue-700/30' },
                { n: '2', en: 'DETECT', ar: 'كشف', c: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/30' },
                { n: '3', en: 'DECIDE', ar: 'قرار', c: 'bg-purple-900/40 text-purple-300 border-purple-700/30' },
                { n: '4', en: 'PRESSURE', ar: 'ضغط', c: 'bg-orange-900/40 text-orange-300 border-orange-700/30' },
                { n: '5', en: 'CLUSTER', ar: 'تجميع', c: 'bg-pink-900/40 text-pink-300 border-pink-700/30' },
                { n: '6', en: 'PREDICT', ar: 'تنبؤ', c: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/30' },
                { n: '7', en: 'EXECUTE', ar: 'تنفيذ', c: 'bg-green-900/40 text-green-300 border-green-700/30' },
                { n: '8', en: 'SELF-CORRECT', ar: 'تصحيح', c: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/30' },
                { n: '9', en: 'PULSE', ar: 'نبض', c: 'bg-red-900/40 text-red-300 border-red-700/30' },
              ].map((phase, i) => (
                <div key={phase.n} className="flex items-center gap-2">
                  <div className={cn('px-3 py-2 rounded-lg border font-bold', phase.c)}>
                    {phase.n}. {tr(phase.ar, phase.en)}
                  </div>
                  {i < 8 && <span className="text-gray-600">→</span>}
                </div>
              ))}
              <span className="text-gray-500 ml-2">↻</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
