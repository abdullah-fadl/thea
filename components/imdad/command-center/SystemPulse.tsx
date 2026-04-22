'use client';

import { useLang } from '@/hooks/use-lang';
import { Heart, Activity, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PulseData {
  healthScore: number;
  operationalPressure: number;
  activeSignals: number;
  autonomyScore: number;
  trend: string;
  heartbeat?: number;
  networkLatency?: number;
  decisionsPerMinute?: number;
}

export function SystemPulse({ pulse }: { pulse: PulseData }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const healthColor = pulse.healthScore >= 80 ? '#22c55e' : pulse.healthScore >= 60 ? '#f59e0b' : '#ef4444';
  const pressureColor = pulse.operationalPressure >= 70 ? '#ef4444' : pulse.operationalPressure >= 40 ? '#f59e0b' : '#22c55e';

  const TrendIcon = pulse.trend === 'improving' || pulse.trend === 'up'
    ? TrendingUp
    : pulse.trend === 'degrading' || pulse.trend === 'down'
      ? TrendingDown
      : Minus;

  const trendColor = pulse.trend === 'improving' || pulse.trend === 'up'
    ? 'text-emerald-400'
    : pulse.trend === 'degrading' || pulse.trend === 'down'
      ? 'text-red-400'
      : 'text-gray-400';

  const metrics = [
    {
      labelAr: 'صحة النظام',
      labelEn: 'System Health',
      value: `${pulse.healthScore}%`,
      color: healthColor,
      icon: Heart,
    },
    {
      labelAr: 'الضغط التشغيلي',
      labelEn: 'Op. Pressure',
      value: `${pulse.operationalPressure}%`,
      color: pressureColor,
      icon: Activity,
    },
    {
      labelAr: 'الإشارات النشطة',
      labelEn: 'Active Signals',
      value: String(pulse.activeSignals),
      color: '#06b6d4',
      icon: Zap,
    },
    {
      labelAr: 'الاستقلالية',
      labelEn: 'Autonomy',
      value: `${pulse.autonomyScore}%`,
      color: pulse.autonomyScore >= 70 ? '#22c55e' : '#f59e0b',
      icon: Activity,
    },
  ];

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 h-full"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          {tr('نبض النظام', 'System Pulse')}
        </h3>
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase tracking-wider">
            {pulse.trend === 'improving' ? tr('تحسن', 'Improving')
              : pulse.trend === 'degrading' ? tr('تراجع', 'Degrading')
              : tr('مستقر', 'Stable')}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.labelEn} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-white/30" />
                <span className="text-xs text-white/50">{tr(m.labelAr, m.labelEn)}</span>
              </div>
              <span className="text-sm font-bold font-mono" style={{ color: m.color }}>
                {m.value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mini pulse bar */}
      <div className="mt-4 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30">{tr('حالة النظام', 'System Status')}</span>
          <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${pulse.healthScore}%`,
                backgroundColor: healthColor,
                boxShadow: `0 0 8px ${healthColor}40`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
