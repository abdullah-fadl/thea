'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import {
  Brain, Activity, HeartPulse, Radar, Zap, Shield,
  AlertTriangle, Target, CheckCircle, ArrowUpCircle,
  TrendingUp, TrendingDown, Minus, Clock, Server,
  RefreshCw, Eye, Lock, BarChart3,
} from 'lucide-react';

interface HistoryData {
  pulses: any[];
  signals: any[];
  decisionStats: Record<string, number>;
  actionStats: Record<string, number>;
  totals: {
    totalDecisions: number;
    totalActions: number;
    totalSignals: number;
    autoExecuted: number;
    pendingReview: number;
    active: number;
  };
}

function MiniGauge({ value, size = 80, label }: { value: number; size?: number; label: string }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center relative">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1f2937" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth="6" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold" style={{ color }}>{value}%</span>
      </div>
      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function NerveCenterPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [pulse, setPulse] = useState<any>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [effectiveness, setEffectiveness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [pulseRes, historyRes, feedbackRes] = await Promise.all([
        fetch('/api/imdad/decisions/pulse'),
        fetch('/api/imdad/decisions/autonomous/history'),
        fetch('/api/imdad/decisions/autonomous/feedback', { method: 'POST' }),
      ]);
      if (pulseRes.ok) {
        const d = await pulseRes.json();
        setPulse(d.pulse);
      }
      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d);
      }
      if (feedbackRes.ok) {
        const d = await feedbackRes.json();
        setEffectiveness(d.effectiveness);
      }
      setLastUpdate(new Date());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 15000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center">
        <Brain className="h-16 w-16 text-[#D4A017] animate-pulse" />
      </div>
    );
  }

  const overallHealth = Number(pulse?.overallHealthScore ?? 0);
  const inventoryHealth = Number(pulse?.inventoryHealth ?? 0);
  const budgetHealth = Number(pulse?.budgetHealth ?? 0);
  const complianceHealth = Number(pulse?.complianceHealth ?? 0);
  const pressure = Number(pulse?.operationalPressure ?? 0);
  const trend = pulse?.trendDirection || 'STABLE';
  const TrendIcon = trend === 'IMPROVING' ? TrendingUp : trend === 'DECLINING' ? TrendingDown : Minus;
  const trendColor = trend === 'IMPROVING' ? 'text-emerald-400' : trend === 'DECLINING' ? 'text-red-400' : 'text-gray-400';

  const totals = history?.totals ?? {
    totalDecisions: 0, totalActions: 0, totalSignals: 0,
    autoExecuted: 0, pendingReview: 0, active: 0,
  };

  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const sig of (history?.signals || [])) {
    const s = sig.severity as keyof typeof severityCounts;
    if (s in severityCounts) severityCounts[s]++;
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Brain className="h-10 w-10 text-[#D4A017]" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tr('مركز الأعصاب', 'Nerve Center')}</h1>
            <p className="text-xs text-gray-400">
              {tr('الدماغ التشغيلي المستقل لإمداد — رؤية شاملة للنظام', 'Imdad Autonomous Operational Brain — Unified System View')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm', trendColor)}>
            <TrendIcon className="h-4 w-4" />
            {trend === 'IMPROVING' ? tr('تحسن', 'Improving') : trend === 'DECLINING' ? tr('تراجع', 'Declining') : tr('مستقر', 'Stable')}
          </div>
          {lastUpdate && (
            <span className="text-[10px] text-gray-600">
              {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Top Row: Health Gauges + Pressure */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="col-span-2 bg-[#111827] border border-gray-700/50 rounded-xl p-5 flex items-center justify-center gap-6">
          <MiniGauge value={overallHealth} label={tr('الصحة العامة', 'Overall')} size={100} />
          <div className="space-y-3">
            <MiniGauge value={inventoryHealth} label={tr('المخزون', 'Inventory')} size={64} />
            <MiniGauge value={budgetHealth} label={tr('الميزانية', 'Budget')} size={64} />
            <MiniGauge value={complianceHealth} label={tr('الامتثال', 'Compliance')} size={64} />
          </div>
        </div>

        {/* Operational Pressure */}
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5 flex flex-col items-center justify-center">
          <Activity className={cn('h-8 w-8 mb-2', pressure > 70 ? 'text-red-400' : pressure > 40 ? 'text-amber-400' : 'text-emerald-400')} />
          <p className={cn('text-3xl font-bold', pressure > 70 ? 'text-red-400' : pressure > 40 ? 'text-amber-400' : 'text-emerald-400')}>
            {pressure}%
          </p>
          <p className="text-xs text-gray-400 mt-1">{tr('ضغط تشغيلي', 'Op. Pressure')}</p>
        </div>

        {/* Decision Pipeline */}
        <div className="col-span-2 bg-[#111827] border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[#D4A017]" />
            {tr('خط أنابيب القرارات', 'Decision Pipeline')}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{totals.active}</p>
              <p className="text-[10px] text-gray-500">{tr('نشط', 'Active')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{totals.autoExecuted}</p>
              <p className="text-[10px] text-gray-500">{tr('تنفيذ تلقائي', 'Auto-Executed')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{totals.pendingReview}</p>
              <p className="text-[10px] text-gray-500">{tr('قيد المراجعة', 'Pending Review')}</p>
            </div>
          </div>
          <div className="mt-3 h-2 bg-gray-700 rounded-full overflow-hidden flex">
            {totals.totalDecisions > 0 && (
              <>
                <div className="bg-emerald-500 transition-all" style={{ width: `${(totals.autoExecuted / totals.totalDecisions) * 100}%` }} />
                <div className="bg-blue-500 transition-all" style={{ width: `${(totals.active / totals.totalDecisions) * 100}%` }} />
                <div className="bg-orange-500 transition-all" style={{ width: `${(totals.pendingReview / totals.totalDecisions) * 100}%` }} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: Signal Radar + Key Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Signal Radar */}
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <Radar className="h-3.5 w-3.5 text-amber-400" />
            {tr('رادار الإشارات', 'Signal Radar')}
          </h3>
          <div className="space-y-2">
            {[
              { label: tr('حرجة', 'Critical'), count: severityCounts.CRITICAL, color: 'bg-red-500', textColor: 'text-red-400' },
              { label: tr('عالية', 'High'), count: severityCounts.HIGH, color: 'bg-orange-500', textColor: 'text-orange-400' },
              { label: tr('متوسطة', 'Medium'), count: severityCounts.MEDIUM, color: 'bg-amber-500', textColor: 'text-amber-400' },
              { label: tr('منخفضة', 'Low'), count: severityCounts.LOW, color: 'bg-gray-500', textColor: 'text-gray-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', s.color)} />
                <span className="text-xs text-gray-400 flex-1">{s.label}</span>
                <span className={cn('text-sm font-bold', s.textColor)}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Counters */}
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-blue-400" />
            {tr('مؤشرات رئيسية', 'Key Metrics')}
          </h3>
          <div className="space-y-3">
            {[
              { icon: Radar, label: tr('إشارات', 'Signals'), value: totals.totalSignals, color: 'text-amber-400' },
              { icon: Zap, label: tr('قرارات', 'Decisions'), value: totals.totalDecisions, color: 'text-blue-400' },
              { icon: Target, label: tr('إجراءات', 'Actions'), value: totals.totalActions, color: 'text-purple-400' },
              { icon: Server, label: tr('أصول', 'Assets'), value: pulse?.totalAssets ?? 0, color: 'text-gray-400' },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <m.icon className={cn('h-3.5 w-3.5', m.color)} />
                <span className="text-xs text-gray-400 flex-1">{m.label}</span>
                <span className={cn('text-sm font-bold', m.color)}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-purple-400" />
            {tr('نشاط حديث', 'Recent Activity')}
          </h3>
          <div className="space-y-2 max-h-[180px] overflow-y-auto">
            {(history?.signals || []).slice(0, 8).map((sig: any) => (
              <div key={sig.id} className="flex items-start gap-2 text-xs">
                <div className={cn(
                  'h-1.5 w-1.5 rounded-full mt-1.5 shrink-0',
                  sig.severity === 'CRITICAL' ? 'bg-red-500' :
                  sig.severity === 'HIGH' ? 'bg-orange-500' :
                  sig.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-gray-500',
                )} />
                <div className="min-w-0">
                  <p className="text-gray-300 truncate">
                    {language === 'ar' ? sig.titleAr : sig.title}
                  </p>
                  <p className="text-gray-600 text-[10px]">
                    {new Date(sig.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {(!history?.signals?.length) && (
              <p className="text-gray-600 text-center py-4">{tr('لا يوجد نشاط', 'No activity')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Autonomy Effectiveness */}
      {effectiveness && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: tr('نقاط الاستقلالية', 'Autonomy Score'), value: `${effectiveness.autonomyScore ?? 0}%`, color: (effectiveness.autonomyScore ?? 0) >= 70 ? 'text-emerald-400' : 'text-amber-400', icon: Brain },
            { label: tr('معدل الإتمام', 'Completion Rate'), value: `${effectiveness.completionRate ?? 0}%`, color: 'text-blue-400', icon: CheckCircle },
            { label: tr('الموافقة التلقائية', 'Auto-Approval'), value: `${effectiveness.autoApprovalRate ?? 0}%`, color: 'text-purple-400', icon: Zap },
            { label: tr('معدل التصعيد', 'Escalation Rate'), value: `${effectiveness.escalationRate ?? 0}%`, color: 'text-orange-400', icon: ArrowUpCircle },
            { label: tr('زمن التنفيذ', 'Exec Latency'), value: `${effectiveness.avgExecutionLatencySeconds ?? 0}s`, color: 'text-cyan-400', icon: Clock },
          ].map(m => (
            <div key={m.label} className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <m.icon className={cn('h-3.5 w-3.5', m.color)} />
                <span className="text-[10px] text-gray-500">{m.label}</span>
              </div>
              <p className={cn('text-xl font-bold', m.color)}>{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pulse Timeline */}
      {(history?.pulses?.length ?? 0) > 0 && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-emerald-400" />
            {tr('خط زمني للنبض', 'Pulse Timeline')}
          </h3>
          <div className="flex items-end gap-1 h-20">
            {(history?.pulses || []).slice(0, 30).reverse().map((p: any, i: number) => {
              const val = Number(p.overallHealthScore ?? 0);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      'w-full rounded-t transition-all',
                      val >= 80 ? 'bg-emerald-500' : val >= 60 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                    style={{ height: `${Math.max(val, 5)}%` }}
                    title={`${val}% — ${new Date(p.pulseTimestamp).toLocaleTimeString()}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Decision Status Distribution */}
      {history?.decisionStats && Object.keys(history.decisionStats).length > 0 && (
        <div className="mt-4 bg-[#111827] border border-gray-700/50 rounded-xl p-5">
          <h3 className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-[#D4A017]" />
            {tr('توزيع حالات القرارات', 'Decision Status Distribution')}
          </h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(history.decisionStats).map(([status, count]) => {
              const statusColors: Record<string, string> = {
                COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                AUTO_APPROVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
                GENERATED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
                PENDING_REVIEW: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                EXECUTING: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
                REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
                OVERRIDDEN: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                EXPIRED: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
              };
              return (
                <div key={status} className={cn('px-3 py-2 rounded-lg border text-sm', statusColors[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30')}>
                  <span className="font-bold">{count}</span>
                  <span className="text-xs ml-1.5 opacity-70">{status.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
