'use client';

import { useLang } from '@/hooks/use-lang';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Building2 } from 'lucide-react';

interface CEOImpactData {
  totalLost: number;
  totalSaved: number;
  netImpact: number;
  trend: string;
  topLosses: Array<{
    hospitalName: string;
    hospitalNameAr: string;
    domain: string;
    value: number;
    cause: string;
    description: string;
    descriptionAr: string;
  }>;
  topSavings: Array<{
    hospitalName: string;
    hospitalNameAr: string;
    domain: string;
    value: number;
    description: string;
    descriptionAr: string;
  }>;
  totalDailyRevenue: number;
  missedRevenue: number;
  downtimeLoss: number;
  avgUtilization: number;
  topOpportunities: any[];
  worstHospital: { name: string; nameAr: string; pressure: number } | null;
  responsibleRole: string;
}

export function CEOImpactStrip({ data }: { data: CEOImpactData }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const fmtSAR = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  const netPositive = data.netImpact >= 0;

  return (
    <div
      className="border-b border-white/[0.06] bg-gradient-to-r from-black/60 via-black/40 to-black/60 backdrop-blur-xl"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-[1800px] px-4 py-3 md:px-6">
        {/* Main strip */}
        <div className="flex items-center justify-between gap-6 overflow-x-auto">
          {/* Net Impact */}
          <div className="flex items-center gap-3 shrink-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${netPositive ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
              {netPositive ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider">
                {tr('صافي التأثير', 'Net Impact')}
              </p>
              <p className={`text-lg font-bold font-mono ${netPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {netPositive ? '+' : ''}{fmtSAR(data.netImpact)} {tr('ر.س', 'SAR')}
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-white/[0.06] shrink-0" />

          {/* Saved */}
          <div className="shrink-0">
            <p className="text-[10px] text-white/30">{tr('تم التوفير', 'Saved')}</p>
            <p className="text-sm font-bold font-mono text-emerald-400">+{fmtSAR(data.totalSaved)} {tr('ر.س', 'SAR')}</p>
          </div>

          {/* Lost */}
          <div className="shrink-0">
            <p className="text-[10px] text-white/30">{tr('خسائر', 'Lost')}</p>
            <p className="text-sm font-bold font-mono text-red-400">-{fmtSAR(data.totalLost)} {tr('ر.س', 'SAR')}</p>
          </div>

          {/* Separator */}
          <div className="h-8 w-px bg-white/[0.06] shrink-0" />

          {/* Revenue */}
          <div className="shrink-0">
            <p className="text-[10px] text-white/30">{tr('الإيراد اليومي', 'Daily Revenue')}</p>
            <p className="text-sm font-mono text-white/70">{fmtSAR(data.totalDailyRevenue)} {tr('ر.س', 'SAR')}</p>
          </div>

          {/* Utilization */}
          <div className="shrink-0">
            <p className="text-[10px] text-white/30">{tr('الاستخدام', 'Utilization')}</p>
            <p className="text-sm font-mono text-cyan-400">{data.avgUtilization.toFixed(1)}%</p>
          </div>

          {/* Worst Hospital */}
          {data.worstHospital && (
            <>
              <div className="h-8 w-px bg-white/[0.06] shrink-0" />
              <div className="flex items-center gap-2 shrink-0">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400/70" />
                <div>
                  <p className="text-[10px] text-white/30">{tr('أعلى ضغط', 'Highest Pressure')}</p>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-white/30" />
                    <span className="text-xs text-white/70">
                      {language === 'ar' ? data.worstHospital.nameAr : data.worstHospital.name}
                    </span>
                    <span className="text-xs font-mono text-red-400">{data.worstHospital.pressure}%</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top losses / savings */}
        {(data.topLosses.length > 0 || data.topSavings.length > 0) && (
          <div className="mt-2 pt-2 border-t border-white/[0.04] flex gap-4 overflow-x-auto">
            {data.topLosses.slice(0, 2).map((loss, i) => (
              <div key={`loss-${i}`} className="flex items-center gap-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-white/40 truncate max-w-[150px]">
                  {language === 'ar' ? loss.descriptionAr : loss.description}
                </span>
                <span className="text-[10px] font-mono text-red-400/60">-{fmtSAR(loss.value)}</span>
              </div>
            ))}
            {data.topSavings.slice(0, 2).map((sav, i) => (
              <div key={`sav-${i}`} className="flex items-center gap-2 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-white/40 truncate max-w-[150px]">
                  {language === 'ar' ? sav.descriptionAr : sav.description}
                </span>
                <span className="text-[10px] font-mono text-emerald-400/60">+{fmtSAR(sav.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
