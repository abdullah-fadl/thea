'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

export default function QualityPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  const qualityPressure = brain.pressure.dimensions.find(d => d.key === 'quality');
  const qualitySignals = brain.signals.filter((s: any) => s.domain === 'quality' || s.type?.includes('QUALITY') || s.type?.includes('INSPECTION') || s.type?.includes('RECALL'));
  const riskDecisions = brain.decisions.filter((d: any) => d.decisionType === 'RISK_MITIGATION' || d.decisionType === 'COMPLIANCE_ACTION' || d.domain === 'quality');

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('الجودة والسلامة', 'Quality & Safety')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('مراقبة الجودة والامتثال والسلامة', 'Quality monitoring, compliance, and safety')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Quality Exposure */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('التعرض للجودة', 'Quality Exposure')}</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold font-mono" style={{ color: (qualityPressure?.pressure ?? 0) >= 60 ? '#ef4444' : (qualityPressure?.pressure ?? 0) >= 35 ? '#f59e0b' : '#22c55e' }}>
                {qualityPressure?.pressure ?? 0}%
              </p>
              <p className="text-[10px] text-gray-500 mt-1">{tr('مستوى التعرض', 'Exposure Level')}</p>
            </div>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-700" style={{ width: `${qualityPressure?.pressure ?? 0}%` }} />
            </div>
            <div className="text-xs text-gray-400">
              {tr('الاتجاه', 'Trend')}: <span className="text-white">{qualityPressure?.trend ?? 'stable'}</span>
            </div>
          </div>
          {(qualityPressure?.drivers?.length ?? 0) > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {qualityPressure!.drivers.map((d, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] rounded bg-white/5 border border-white/10 text-gray-400">{typeof d === 'string' ? d : (d as any).label || JSON.stringify(d)}</span>
              ))}
            </div>
          )}
        </div>

        {/* Grid: Signals + Decisions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Quality Signals */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('إشارات الجودة', 'Quality Signals')}</h2>
            {qualitySignals.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {qualitySignals.map((s: any, i: number) => (
                  <div key={s.id || i} className="py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-200">{language === 'ar' ? (s.titleAr || s.title) : s.title}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${s.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : s.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {s.severity || 'INFO'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{s.type}</p>
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

          {/* Risk Mitigation Decisions */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('قرارات تخفيف المخاطر', 'Risk Mitigation Decisions')}</h2>
            {riskDecisions.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {riskDecisions.slice(0, 10).map((d: any, i: number) => (
                  <div key={d.id || i} className="py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-200">{language === 'ar' ? (d.titleAr || d.title) : d.title}</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${d.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : d.status === 'PENDING_REVIEW' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {d.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{d.decisionCode} — {d.decisionType}</p>
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
