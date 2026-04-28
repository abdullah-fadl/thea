'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import {
  HeartPulse, Activity, TrendingUp, TrendingDown, Minus,
  Shield, AlertTriangle, Cpu, RefreshCw, Zap,
  Server, Target, Brain,
} from 'lucide-react';

function HealthGauge({ value, label, size = 120 }: { value: number; label: string; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#1f2937" strokeWidth="8" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-2xl font-bold" style={{ color }}>{value}%</span>
      </div>
      <p className="text-xs text-gray-400 mt-2">{label}</p>
    </div>
  );
}

export default function SystemPulsePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [pulse, setPulse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  const fetchPulse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/imdad/decisions/pulse');
      if (res.ok) {
        const data = await res.json();
        const p = data.pulse;
        setPulse(p);
        setHistory(prev => [...prev, { ...p, timestamp: new Date().toISOString() }].slice(-20));
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPulse();
    const iv = setInterval(fetchPulse, 30000);
    return () => clearInterval(iv);
  }, [fetchPulse]);

  if (loading && !pulse) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] text-white flex items-center justify-center">
        <HeartPulse className="h-12 w-12 text-emerald-400 animate-pulse" />
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

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <HeartPulse className="h-8 w-8 text-emerald-400" />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{tr('نبض النظام', 'System Pulse')}</h1>
            <p className="text-xs text-gray-400">{tr('مراقبة صحة النظام في الوقت الحقيقي', 'Real-time system health monitoring')}</p>
          </div>
        </div>
        <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm', trendColor)}>
          <TrendIcon className="h-4 w-4" />
          {trend === 'IMPROVING' ? tr('تحسن', 'Improving') : trend === 'DECLINING' ? tr('تراجع', 'Declining') : tr('مستقر', 'Stable')}
        </div>
      </div>

      {/* Health Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-6 flex flex-col items-center relative">
          <HealthGauge value={overallHealth} label={tr('الصحة العامة', 'Overall Health')} size={140} />
        </div>
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-6 flex flex-col items-center relative">
          <HealthGauge value={inventoryHealth} label={tr('صحة المخزون', 'Inventory Health')} />
        </div>
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-6 flex flex-col items-center relative">
          <HealthGauge value={budgetHealth} label={tr('صحة الميزانية', 'Budget Health')} />
        </div>
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-6 flex flex-col items-center relative">
          <HealthGauge value={complianceHealth} label={tr('صحة الامتثال', 'Compliance Health')} />
        </div>
      </div>

      {/* Operational Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        {[
          { icon: Zap, label: tr('قرارات نشطة', 'Active Decisions'), value: pulse?.activeDecisions ?? 0, color: 'text-blue-400' },
          { icon: Target, label: tr('إجراءات معلقة', 'Pending Actions'), value: pulse?.pendingActions ?? 0, color: 'text-amber-400' },
          { icon: AlertTriangle, label: tr('إشارات حرجة', 'Critical Signals'), value: pulse?.criticalSignals ?? 0, color: 'text-red-400' },
          { icon: Shield, label: tr('إشارات عالية', 'High Signals'), value: pulse?.highSignals ?? 0, color: 'text-orange-400' },
          { icon: Server, label: tr('إجمالي الأصول', 'Total Assets'), value: pulse?.totalAssets ?? 0, color: 'text-gray-400' },
          { icon: Activity, label: tr('ضغط تشغيلي', 'Op. Pressure'), value: `${pressure}%`, color: pressure > 50 ? 'text-red-400' : 'text-emerald-400' },
        ].map(m => (
          <div key={m.label} className="bg-[#111827] border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <m.icon className={cn('h-4 w-4', m.color)} />
              <span className="text-xs text-gray-400">{m.label}</span>
            </div>
            <p className={cn('text-xl font-bold', m.color)}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Pulse History */}
      {history.length > 1 && (
        <div className="bg-[#111827] border border-gray-700/50 rounded-xl p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#D4A017]" />
            {tr('سجل النبض', 'Pulse History')}
          </h3>
          <div className="flex items-end gap-1 h-24">
            {history.map((h, i) => {
              const val = Number(h.overallHealthScore ?? 0);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={cn('w-full rounded-t', val >= 80 ? 'bg-emerald-500' : val >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ height: `${val}%` }}
                  />
                  <span className="text-[9px] text-gray-600">{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
