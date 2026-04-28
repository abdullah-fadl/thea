'use client';

import { useLang } from '@/hooks/use-lang';
import { Layers, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Domain {
  key: string;
  name: string;
  nameAr?: string;
  icon?: string;
  riskScore: number;
  budgetAllocated: number;
  budgetConsumed: number;
  activeItems: number;
  criticalItems: number;
  lifecycleAlerts: number;
  standardizationScore: number;
  topVendor: string;
  trend: 'improving' | 'stable' | 'degrading';
}

export function DomainIntelligence({
  domains,
  onSelectDomain,
}: {
  domains: Domain[];
  onSelectDomain: (domain: Domain) => void;
}) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const fmtSAR = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  const riskColor = (score: number) =>
    score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#10b981';

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'improving') return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    if (trend === 'degrading') return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 h-full"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          {tr('المجالات الاستراتيجية', 'Domain Intelligence')}
        </h3>
        <span className="text-[10px] text-white/30 font-mono">
          {domains.length} {tr('مجال', 'domains')}
        </span>
      </div>

      {domains.length === 0 ? (
        <div className="text-center py-8 text-white/20 text-xs">
          {tr('لا توجد مجالات مرئية', 'No visible domains')}
        </div>
      ) : (
        <div className="space-y-2">
          {domains.map((d) => {
            const rc = riskColor(d.riskScore);
            const budgetPct = d.budgetAllocated > 0 ? ((d.budgetConsumed / d.budgetAllocated) * 100).toFixed(1) : '0';
            return (
              <div
                key={d.key}
                onClick={() => onSelectDomain(d)}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 hover:bg-white/[0.05] cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {d.icon && <span className="text-lg">{d.icon}</span>}
                    <div>
                      <p className="text-xs font-medium text-white/80">
                        {language === 'ar' && d.nameAr ? d.nameAr : d.name}
                      </p>
                      <p className="text-[10px] text-white/30">{d.topVendor}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={d.trend} />
                    <span className="text-sm font-bold font-mono" style={{ color: rc }}>
                      {d.riskScore}%
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-white/10 group-hover:text-white/30 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-white/30">{tr('الميزانية', 'Budget')}</p>
                    <p className="text-[11px] font-mono text-white/60">{budgetPct}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30">{tr('أصناف', 'Items')}</p>
                    <p className="text-[11px] font-mono text-white/60">{d.activeItems}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30">{tr('حرج', 'Critical')}</p>
                    <p className={`text-[11px] font-mono ${d.criticalItems > 0 ? 'text-red-400' : 'text-white/40'}`}>
                      {d.criticalItems}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/30">{tr('توحيد', 'Std.')}</p>
                    <p className="text-[11px] font-mono text-white/60">{d.standardizationScore}%</p>
                  </div>
                </div>

                {/* Budget bar */}
                <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(parseFloat(budgetPct), 100)}%`,
                      backgroundColor: parseFloat(budgetPct) > 80 ? '#ef4444' : parseFloat(budgetPct) > 60 ? '#f59e0b' : '#10b981',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
