'use client';

import { useLang } from '@/hooks/use-lang';
import { Globe, Building2 } from 'lucide-react';

interface Hospital {
  id: string;
  name: string;
  nameAr: string;
  pressure: number;
  status: string;
  healthScore?: number;
  city?: string;
  cityAr?: string;
  beds?: number;
  activePOs?: number;
  criticalItems?: number;
}

export function GlobalNetworkView({
  hospitals,
  onSelectHospital,
}: {
  hospitals: Hospital[];
  onSelectHospital: (id: string) => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const statusColor = (h: Hospital) => {
    if (h.pressure >= 70 || h.status === 'CRITICAL') return { border: 'border-red-500/40', bg: 'bg-red-500/10', dot: 'bg-red-500 animate-pulse', text: 'text-red-400' };
    if (h.pressure >= 40 || h.status === 'WARNING') return { border: 'border-amber-500/30', bg: 'bg-amber-500/10', dot: 'bg-amber-400', text: 'text-amber-400' };
    return { border: 'border-emerald-500/20', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400', text: 'text-emerald-400' };
  };

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 h-full"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Globe className="h-4 w-4 text-blue-400" />
          {tr('شبكة المستشفيات', 'Hospital Network')}
        </h3>
        <span className="text-[10px] text-white/30 font-mono">
          {hospitals.length} {tr('مستشفى', 'hospitals')}
        </span>
      </div>

      {hospitals.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-white/20 text-xs">
          {tr('لا توجد مستشفيات متصلة', 'No connected hospitals')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {hospitals.map((h) => {
            const colors = statusColor(h);
            return (
              <div
                key={h.id}
                onClick={() => onSelectHospital(h.id)}
                className={`rounded-lg border ${colors.border} ${colors.bg} p-3 cursor-pointer hover:bg-white/[0.06] transition-all group`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 text-white/40 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/80 truncate">
                        {language === 'ar' ? h.nameAr : h.name}
                      </p>
                      {(h.city || h.cityAr) && (
                        <p className="text-[10px] text-white/30">
                          {language === 'ar' && h.cityAr ? h.cityAr : h.city}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colors.dot}`} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/30">{tr('ضغط', 'Pressure')}</span>
                    <span className={`text-sm font-bold font-mono ${colors.text}`}>
                      {h.pressure}%
                    </span>
                  </div>
                  {h.criticalItems != null && h.criticalItems > 0 && (
                    <span className="text-[10px] bg-red-500/20 text-red-400 rounded-full px-1.5 py-0.5">
                      {h.criticalItems} {tr('حرج', 'critical')}
                    </span>
                  )}
                </div>

                {h.healthScore != null && (
                  <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${h.healthScore}%`,
                        backgroundColor: h.healthScore >= 80 ? '#22c55e' : h.healthScore >= 60 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
