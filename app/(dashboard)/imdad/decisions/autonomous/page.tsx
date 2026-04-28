'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import {
  Brain, RefreshCw, Zap, Shield, Activity, CheckCircle,
  AlertTriangle, Clock, Play, Pause, TrendingUp, Target,
  Server, Cpu, HeartPulse, Radar, ArrowUpCircle,
  TrendingDown, Minus, Eye, Lock,
} from 'lucide-react';

interface ScanResult {
  summary: {
    totalFindings: number;
    signalsGenerated: number;
    decisionsGenerated: number;
    autoApproved: number;
    duplicatesSkipped: number;
    scannedAt: string;
  };
}

interface ExecuteResult {
  summary: {
    decisionsExecuted: number;
    decisionsEscalated: number;
    actionsCreated: number;
    executedAt: string;
  };
  executions: { decisionCode: string; executionMode: string; actionsCreated: number }[];
  escalations: { decisionCode: string; reason: string; riskScore: number }[];
}

interface LoopEntry {
  cycle: number;
  timestamp: string;
  scan: ScanResult['summary'] | null;
  execute: ExecuteResult['summary'] | null;
  escalations: ExecuteResult['escalations'];
  error?: string;
}

export default function AutonomousOpsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [running, setRunning] = useState(false);
  const [loopHistory, setLoopHistory] = useState<LoopEntry[]>([]);
  const [pulse, setPulse] = useState<any>(null);
  const [cycleCount, setCycleCount] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const runCycle = useCallback(async () => {
    const cycle = cycleCount + 1;
    setCycleCount(cycle);

    const entry: LoopEntry = {
      cycle,
      timestamp: new Date().toISOString(),
      scan: null,
      execute: null,
      escalations: [],
    };

    try {
      // Full Core Loop — single endpoint runs SCAN → DETECT → DECIDE → EXECUTE → SELF-CORRECT → PULSE
      setCurrentPhase('SCAN');
      const coreRes = await fetch('/api/imdad/decisions/autonomous/core-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (coreRes.ok) {
        const data = await coreRes.json();
        setCurrentPhase('EXECUTE');
        entry.scan = {
          totalFindings: data.detect?.findings ?? 0,
          signalsGenerated: data.detect?.signalsCreated ?? 0,
          decisionsGenerated: data.decide?.decisionsCreated ?? 0,
          autoApproved: data.decide?.autoApproved ?? 0,
          duplicatesSkipped: data.detect?.duplicatesSkipped ?? 0,
          scannedAt: data.cycle?.completedAt ?? new Date().toISOString(),
        };
        entry.execute = {
          decisionsExecuted: data.execute?.decisionsExecuted ?? 0,
          decisionsEscalated: data.selfCorrect?.deadlinesEscalated ?? 0,
          actionsCreated: data.execute?.actionsCreated ?? 0,
          executedAt: data.cycle?.completedAt ?? new Date().toISOString(),
        };

        setCurrentPhase('VERIFY');
        setPulse({
          overallHealthScore: data.pulse?.healthScore,
          operationalPressure: data.pulse?.pressure,
          trendDirection: data.pulse?.trend,
          activeDecisions: data.observe?.decisions?.active ?? 0,
          criticalSignals: data.observe?.signals?.critical ?? 0,
        });
      } else {
        // Fallback to individual endpoints
        setCurrentPhase('SCAN');
        const scanRes = await fetch('/api/imdad/decisions/autonomous/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          entry.scan = scanData.summary;
        }

        setCurrentPhase('EXECUTE');
        const execRes = await fetch('/api/imdad/decisions/autonomous/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (execRes.ok) {
          const execData: ExecuteResult = await execRes.json();
          entry.execute = execData.summary;
          entry.escalations = execData.escalations || [];
        }

        setCurrentPhase('VERIFY');
        const pulseRes = await fetch('/api/imdad/decisions/pulse');
        if (pulseRes.ok) {
          const pulseData = await pulseRes.json();
          setPulse(pulseData.pulse);
        }
      }
    } catch (err: any) {
      entry.error = err.message;
    }

    setCurrentPhase(null);
    setLoopHistory(prev => [entry, ...prev].slice(0, 50));
  }, [cycleCount]);

  const startLoop = () => {
    setRunning(true);
    runCycle();
    intervalRef.current = setInterval(runCycle, 30000);
  };

  const stopLoop = () => {
    setRunning(false);
    setCurrentPhase(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const totalSignals = loopHistory.reduce((s, e) => s + (e.scan?.signalsGenerated || 0), 0);
  const totalDecisions = loopHistory.reduce((s, e) => s + (e.scan?.decisionsGenerated || 0), 0);
  const totalExecuted = loopHistory.reduce((s, e) => s + (e.execute?.decisionsExecuted || 0), 0);
  const totalEscalated = loopHistory.reduce((s, e) => s + (e.execute?.decisionsEscalated || 0), 0);
  const totalActions = loopHistory.reduce((s, e) => s + (e.execute?.actionsCreated || 0), 0);

  const phases = [
    { id: 'SCAN', icon: Eye, label: tr('رصد', 'OBSERVE'), color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { id: 'DETECT', icon: Radar, label: tr('اكتشاف', 'DETECT'), color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { id: 'DECIDE', icon: Brain, label: tr('قرار', 'DECIDE'), color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { id: 'EXECUTE', icon: Zap, label: tr('تنفيذ', 'EXECUTE'), color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { id: 'CORRECT', icon: Shield, label: tr('تصحيح', 'CORRECT'), color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    { id: 'VERIFY', icon: CheckCircle, label: tr('تحقق', 'VERIFY'), color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { id: 'LEARN', icon: TrendingUp, label: tr('تعلّم', 'LEARN'), color: 'bg-[#D4A017]/20 text-[#D4A017] border-[#D4A017]/30' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Brain className="h-10 w-10 text-[#D4A017]" />
            {running && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {tr('العمليات الذاتية', 'Autonomous Operations')}
            </h1>
            <p className="text-sm text-gray-400">
              {tr('حلقة التحكم الذاتي — مسح ← اكتشاف ← قرار ← تنفيذ ← تحقق', 'Autonomous Control Loop — Scan → Detect → Decide → Execute → Verify')}
            </p>
          </div>
        </div>

        <button
          onClick={running ? stopLoop : startLoop}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all text-sm',
            running
              ? 'bg-red-600/20 border border-red-500 text-red-400 hover:bg-red-600/30'
              : 'bg-emerald-600/20 border border-emerald-500 text-emerald-400 hover:bg-emerald-600/30',
          )}
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? tr('إيقاف', 'Stop Loop') : tr('بدء الحلقة', 'Start Loop')}
        </button>
      </div>

      {/* Active Phase Indicator */}
      <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-4 mb-8">
        <div className="flex items-center justify-center gap-2 flex-wrap text-xs">
          {phases.map((step, i, arr) => {
            const isActive = currentPhase === step.id || (currentPhase === 'SCAN' && step.id === 'DETECT') || (currentPhase === 'SCAN' && step.id === 'DECIDE');
            const isPast = currentPhase && phases.findIndex(p => p.id === currentPhase) > i;
            return (
              <div key={step.label} className="flex items-center gap-2">
                <div className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all',
                  step.color,
                  currentPhase === step.id && 'ring-2 ring-offset-1 ring-offset-[#0a0f1e] animate-pulse',
                  isPast && 'opacity-50',
                )}>
                  <step.icon className={cn('h-4 w-4', currentPhase === step.id && 'animate-spin')} />
                  <span className="font-semibold">{step.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-gray-600">→</span>
                )}
              </div>
            );
          })}
          <span className="text-gray-600">↻</span>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { icon: Radar, label: tr('إشارات مكتشفة', 'Signals Detected'), value: totalSignals, color: 'text-amber-400' },
          { icon: Zap, label: tr('قرارات مُنتَجة', 'Decisions Generated'), value: totalDecisions, color: 'text-blue-400' },
          { icon: CheckCircle, label: tr('قرارات مُنفَّذة', 'Auto-Executed'), value: totalExecuted, color: 'text-emerald-400' },
          { icon: ArrowUpCircle, label: tr('تم التصعيد', 'Escalated'), value: totalEscalated, color: 'text-orange-400' },
          { icon: Target, label: tr('إجراءات مُكتملة', 'Actions Completed'), value: totalActions, color: 'text-purple-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={cn('h-5 w-5', stat.color)} />
              <span className="text-xs text-gray-400">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* System Pulse Bar */}
      {pulse && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <HeartPulse className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold">{tr('نبض النظام المباشر', 'Live System Pulse')}</span>
            <span className={cn(
              'ml-auto px-2 py-0.5 rounded text-xs font-medium',
              pulse.trendDirection === 'IMPROVING' ? 'bg-emerald-500/20 text-emerald-400' :
              pulse.trendDirection === 'DECLINING' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400',
            )}>
              {pulse.trendDirection === 'IMPROVING' ? tr('تحسن', 'Improving') :
               pulse.trendDirection === 'DECLINING' ? tr('تراجع', 'Declining') :
               tr('مستقر', 'Stable')}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
            {[
              { label: tr('الصحة العامة', 'Overall Health'), value: `${pulse.overallHealthScore ?? 0}%`, color: (pulse.overallHealthScore ?? 0) >= 80 ? 'text-emerald-400' : (pulse.overallHealthScore ?? 0) >= 60 ? 'text-amber-400' : 'text-red-400' },
              { label: tr('صحة المخزون', 'Inventory'), value: `${pulse.inventoryHealth ?? 0}%`, color: 'text-blue-400' },
              { label: tr('صحة الميزانية', 'Budget'), value: `${pulse.budgetHealth ?? 0}%`, color: 'text-purple-400' },
              { label: tr('قرارات نشطة', 'Active Decisions'), value: pulse.activeDecisions ?? 0, color: 'text-amber-400' },
              { label: tr('إشارات حرجة', 'Critical Signals'), value: pulse.criticalSignals ?? 0, color: 'text-red-400' },
              { label: tr('ضغط تشغيلي', 'Op. Pressure'), value: `${pulse.operationalPressure ?? 0}%`, color: 'text-orange-400' },
            ].map(m => (
              <div key={m.label}>
                <p className="text-gray-400 text-xs mb-1">{m.label}</p>
                <p className={cn('text-lg font-bold', m.color)}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cycle History */}
      <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className={cn('h-5 w-5 text-[#D4A017]', running && 'animate-spin')} />
          <span className="font-semibold">
            {tr('سجل الدورات', 'Cycle History')}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            {tr(`${loopHistory.length} دورة`, `${loopHistory.length} cycles`)}
          </span>
        </div>

        {loopHistory.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{tr('اضغط "بدء الحلقة" لتشغيل المحرك الذاتي', 'Press "Start Loop" to activate the autonomous engine')}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {loopHistory.map((entry) => (
              <div
                key={entry.cycle}
                className={cn(
                  'border rounded-lg p-4 transition-all',
                  entry.error ? 'border-red-500/30 bg-red-500/5' : 'border-gray-700/50 bg-[#0a0f1e]',
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-[#D4A017]/20 text-[#D4A017] px-2 py-0.5 rounded font-mono">
                      #{entry.cycle}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(entry.escalations?.length ?? 0) > 0 && (
                      <span className="text-xs text-orange-400 flex items-center gap-1">
                        <ArrowUpCircle className="h-3 w-3" />
                        {entry.escalations.length} {tr('تصعيد', 'escalated')}
                      </span>
                    )}
                    {entry.error && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {entry.error}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">{tr('نتائج', 'Findings')}</span>
                    <p className="text-gray-300 font-bold">{entry.scan?.totalFindings ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{tr('إشارات', 'Signals')}</span>
                    <p className="text-amber-400 font-bold">{entry.scan?.signalsGenerated ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{tr('قرارات', 'Decisions')}</span>
                    <p className="text-blue-400 font-bold">{entry.scan?.decisionsGenerated ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{tr('منفّذ', 'Executed')}</span>
                    <p className="text-emerald-400 font-bold">{entry.execute?.decisionsExecuted ?? '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">{tr('مصعّد', 'Escalated')}</span>
                    <p className="text-orange-400 font-bold">{entry.execute?.decisionsEscalated ?? '-'}</p>
                  </div>
                </div>

                {/* Escalation details */}
                {entry.escalations?.length > 0 && (
                  <div className="mt-3 border-t border-gray-700/50 pt-2">
                    {entry.escalations.map((esc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-orange-400/80 mt-1">
                        <Lock className="h-3 w-3" />
                        <span className="font-mono">{esc.decisionCode}</span>
                        <span className="text-gray-500">—</span>
                        <span>{esc.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
