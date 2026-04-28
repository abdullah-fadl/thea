'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

export default function AnalyticsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  const totalDecisions = brain.decisions.length;
  const completedDecisions = brain.decisions.filter((d: any) => d.status === 'COMPLETED' || d.status === 'AUTO_APPROVED').length;
  const completionRate = totalDecisions > 0 ? Math.round((completedDecisions / totalDecisions) * 100) : 0;

  const totalSignals = brain.signals.length;
  const resolvedSignals = brain.signals.filter((s: any) => s.resolved || s.status === 'RESOLVED').length;
  const resolutionRate = totalSignals > 0 ? Math.round((resolvedSignals / totalSignals) * 100) : 0;

  const pressureDimensions = brain.pressure.dimensions;

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('التحليلات', 'Analytics')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('إحصائيات النظام ومعدلات الأداء', 'System statistics and performance metrics')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-4 text-center">
            <p className="text-2xl font-bold font-mono text-cyan-400">{(brain.pulse as any).cyclesCompleted}</p>
            <p className="text-[10px] text-gray-500 mt-1">{tr('الدورات المكتملة', 'Cycles Completed')}</p>
          </div>
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-4 text-center">
            <p className="text-2xl font-bold font-mono text-emerald-400">{completionRate}%</p>
            <p className="text-[10px] text-gray-500 mt-1">{tr('معدل إتمام القرارات', 'Decision Completion Rate')}</p>
          </div>
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-4 text-center">
            <p className="text-2xl font-bold font-mono text-violet-400">{resolutionRate}%</p>
            <p className="text-[10px] text-gray-500 mt-1">{tr('معدل حل الإشارات', 'Signal Resolution Rate')}</p>
          </div>
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-4 text-center">
            <p className="text-2xl font-bold font-mono text-amber-400">{brain.pulse.autonomyScore}%</p>
            <p className="text-[10px] text-gray-500 mt-1">{tr('درجة الاستقلالية', 'Autonomy Score')}</p>
          </div>
        </div>

        {/* System Health + Pressure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* System Pulse */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('نبض النظام', 'System Pulse')}</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{tr('صحة النظام', 'System Health')}</span>
                <span className="text-sm font-mono font-bold" style={{ color: brain.pulse.healthScore >= 80 ? '#22c55e' : brain.pulse.healthScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {brain.pulse.healthScore}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{tr('الضغط التشغيلي', 'Operational Pressure')}</span>
                <span className="text-sm font-mono font-bold" style={{ color: brain.pulse.operationalPressure >= 60 ? '#ef4444' : brain.pulse.operationalPressure >= 35 ? '#f59e0b' : '#22c55e' }}>
                  {brain.pulse.operationalPressure}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{tr('الإشارات النشطة', 'Active Signals')}</span>
                <span className="text-sm font-mono font-bold text-cyan-400">{brain.pulse.activeSignals}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{tr('القرارات النشطة', 'Active Decisions')}</span>
                <span className="text-sm font-mono font-bold text-cyan-400">{(brain.pulse as any).activeDecisions}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{tr('الإجراءات اليوم', 'Actions Today')}</span>
                <span className="text-sm font-mono font-bold text-cyan-400">{(brain.pulse as any).actionsToday}</span>
              </div>
            </div>
          </div>

          {/* Pressure Trends */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('اتجاهات الضغط', 'Pressure Trends')}</h2>
            {pressureDimensions.length > 0 ? (
              <div className="space-y-3">
                {pressureDimensions.map((dim) => (
                  <div key={dim.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">{language === 'ar' ? dim.labelAr : dim.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{(dim as any).trend}</span>
                        <span className="text-xs font-mono" style={{ color: dim.pressure >= 60 ? '#ef4444' : dim.pressure >= 35 ? '#f59e0b' : '#22c55e' }}>
                          {dim.pressure}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${dim.pressure}%`, backgroundColor: dim.pressure >= 60 ? '#ef4444' : dim.pressure >= 35 ? '#f59e0b' : '#22c55e' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-6 justify-center text-gray-500 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {tr('النظام يراقب — لا تنبيهات نشطة', 'System monitoring — no active alerts')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
