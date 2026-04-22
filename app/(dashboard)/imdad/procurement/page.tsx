'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

export default function ProcurementPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  const procPressure = brain.pressure.dimensions.find(d => d.key === 'procurement');
  const vendorPressure = brain.pressure.dimensions.find(d => d.key === 'vendor');
  const procDecisions = brain.decisions.filter((d: any) =>
    d.decisionType === 'EMERGENCY_PROCUREMENT' || d.decisionType === 'VENDOR_SWITCH' || d.domain === 'procurement'
  );
  const procOrders = brain.procurement as any;

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('المشتريات', 'Procurement')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('أوامر الشراء والموردين وسلسلة التوريد', 'Purchase orders, vendors, and supply chain')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Pressure Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-3">{tr('سرعة المشتريات', 'Procurement Velocity')}</h2>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold font-mono" style={{ color: (procPressure?.pressure ?? 0) >= 60 ? '#ef4444' : (procPressure?.pressure ?? 0) >= 35 ? '#f59e0b' : '#22c55e' }}>
                {procPressure?.pressure ?? 0}%
              </p>
              <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-700" style={{ width: `${procPressure?.pressure ?? 0}%` }} />
              </div>
            </div>
            {(procPressure?.drivers?.length ?? 0) > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {procPressure!.drivers.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] rounded bg-white/5 border border-white/10 text-gray-400">{typeof d === 'string' ? d : (d as any).label || JSON.stringify(d)}</span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-3">{tr('مخاطر الموردين', 'Vendor Risk')}</h2>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold font-mono" style={{ color: (vendorPressure?.pressure ?? 0) >= 60 ? '#ef4444' : (vendorPressure?.pressure ?? 0) >= 35 ? '#f59e0b' : '#22c55e' }}>
                {vendorPressure?.pressure ?? 0}%
              </p>
              <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-700" style={{ width: `${vendorPressure?.pressure ?? 0}%` }} />
              </div>
            </div>
            {(vendorPressure?.drivers?.length ?? 0) > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {vendorPressure!.drivers.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] rounded bg-white/5 border border-white/10 text-gray-400">{typeof d === 'string' ? d : (d as any).label || JSON.stringify(d)}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Procurement Orders */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('أوامر الشراء', 'Procurement Orders')}</h2>
          {(procOrders as any).length > 0 ? (
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {(procOrders as any).slice(0, 12).map((o: any, i: number) => (
                <div key={o.id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-xs text-gray-200">{language === 'ar' ? (o.titleAr || o.title || o.description) : (o.title || o.description)}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{o.vendor || o.supplier || o.type}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${o.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : o.status === 'URGENT' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {o.status || 'PENDING'}
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

        {/* Procurement Decisions */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('قرارات المشتريات', 'Procurement Decisions')}</h2>
          {procDecisions.length > 0 ? (
            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              {procDecisions.slice(0, 10).map((d: any, i: number) => (
                <div key={d.id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-xs text-gray-200">{language === 'ar' ? (d.titleAr || d.title) : d.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{d.decisionCode} — {d.decisionType}</p>
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
