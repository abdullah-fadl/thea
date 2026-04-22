'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

export default function AssetsPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  const assetPressure = brain.pressure.dimensions.find(d => d.key === 'assets');
  const deviceDecisions = brain.decisions.filter((d: any) => d.decisionType === 'DEVICE_REPLACEMENT' || d.domain === 'assets');
  const assetSignals = brain.signals.filter((s: any) => s.domain === 'assets' || s.type?.includes('DEVICE') || s.type?.includes('ASSET'));
  const hospitalsByPressure = [...brain.hospitals].sort((a: any, b: any) => (b.pressure || 0) - (a.pressure || 0));

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('الأجهزة الطبية', 'Medical Devices')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('إدارة دورة حياة الأجهزة والصيانة', 'Device lifecycle management and maintenance')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Asset Risk Pressure */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('مخاطر الأصول', 'Asset Risk')}</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold font-mono" style={{ color: (assetPressure?.pressure ?? 0) >= 60 ? '#ef4444' : (assetPressure?.pressure ?? 0) >= 35 ? '#f59e0b' : '#22c55e' }}>
                {assetPressure?.pressure ?? 0}%
              </p>
              <p className="text-[10px] text-gray-500 mt-1">{tr('مستوى المخاطر', 'Risk Level')}</p>
            </div>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-700" style={{ width: `${assetPressure?.pressure ?? 0}%` }} />
            </div>
          </div>
          {(assetPressure?.drivers?.length ?? 0) > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {assetPressure!.drivers.map((d, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] rounded bg-white/5 border border-white/10 text-gray-400">{typeof d === 'string' ? d : (d as any).label || JSON.stringify(d)}</span>
              ))}
            </div>
          )}
        </div>

        {/* Grid: Hospitals + Lifecycle Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Hospital Asset Status */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('حالة الأجهزة بالمنشآت', 'Facility Device Status')}</h2>
            {hospitalsByPressure.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {hospitalsByPressure.map((h: any, i: number) => (
                  <div key={h.id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-xs text-gray-300">{language === 'ar' ? (h.nameAr || h.name) : h.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${h.status === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : h.status === 'WARNING' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {h.status || 'STABLE'}
                    </span>
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

          {/* Lifecycle Alerts */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('تنبيهات دورة الحياة', 'Lifecycle Alerts')}</h2>
            {assetSignals.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {assetSignals.map((s: any, i: number) => (
                  <div key={s.id || i} className="py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <p className="text-xs text-gray-200">{language === 'ar' ? (s.titleAr || s.title) : s.title}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{s.severity || s.type}</p>
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

        {/* Device Decisions */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('قرارات الأجهزة', 'Device Decisions')}</h2>
          {deviceDecisions.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {deviceDecisions.slice(0, 10).map((d: any, i: number) => (
                <div key={d.id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-xs text-gray-200">{language === 'ar' ? (d.titleAr || d.title) : d.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{d.decisionCode || d.decisionType}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${d.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : d.status === 'PENDING_REVIEW' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {d.status}
                  </span>
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
  );
}
