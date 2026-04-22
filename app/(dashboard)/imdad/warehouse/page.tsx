'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

export default function WarehousePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  const supplyPressure = brain.pressure.dimensions.find(d => d.key === 'supply');
  const warehouseActions = brain.actions.filter((a: any) => a.domain === 'warehouse' || a.type?.includes('TRANSFER') || a.type?.includes('STOCK'));
  const hospitalsByPressure = [...brain.hospitals].sort((a: any, b: any) => (b.pressure || 0) - (a.pressure || 0));

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('المستودعات', 'Warehouse')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('نظرة عامة على المخزون وحركات النقل', 'Inventory overview and transfer movements')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Supply Strain Overview */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-3">{tr('ضغط الإمداد', 'Supply Strain')}</h2>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold font-mono" style={{ color: (supplyPressure?.pressure ?? 0) >= 60 ? '#ef4444' : (supplyPressure?.pressure ?? 0) >= 35 ? '#f59e0b' : '#22c55e' }}>
              {supplyPressure?.pressure ?? 0}%
            </p>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-700" style={{ width: `${supplyPressure?.pressure ?? 0}%` }} />
            </div>
          </div>
        </div>

        {/* Grid: Facility Stock + Transfer Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Facility Stock Levels */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('مستويات المخزون بالمنشآت', 'Facility Stock Levels')}</h2>
            {hospitalsByPressure.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {hospitalsByPressure.map((h: any, i: number) => (
                  <div key={h.id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-xs text-gray-300">{language === 'ar' ? (h.nameAr || h.name) : h.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 rounded-full bg-gray-800">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(100 - (h.pressure || 0), 5)}%`, backgroundColor: (h.pressure || 0) >= 70 ? '#ef4444' : (h.pressure || 0) >= 40 ? '#f59e0b' : '#22c55e' }} />
                      </div>
                      <span className="text-[10px] font-mono text-gray-500 w-8 text-right">{Math.max(100 - (h.pressure || 0), 0)}%</span>
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

          {/* Transfer Actions */}
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
            <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('إجراءات النقل', 'Transfer Actions')}</h2>
            {warehouseActions.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {warehouseActions.map((a: any, i: number) => (
                  <div key={a.id || i} className="py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-200">{language === 'ar' ? (a.titleAr || a.title || a.description) : (a.title || a.description)}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${a.status === 'EXECUTING' ? 'bg-purple-500/20 text-purple-400' : a.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {a.status || 'QUEUED'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">{a.type}</p>
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
