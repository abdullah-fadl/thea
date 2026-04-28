'use client';

import { useLang } from '@/hooks/use-lang';
import { useImdadBrain } from '@/hooks/imdad/use-imdad-brain';

export default function FinancialPage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const brain = useImdadBrain();

  const budgetPressure = brain.pressure.dimensions.find(d => d.key === 'budget');
  const completedDecisions = brain.decisions.filter((d: any) => d.status === 'COMPLETED' || d.status === 'AUTO_APPROVED');
  const costDecisions = brain.decisions.filter((d: any) => d.decisionType === 'COST_OPTIMIZATION' || d.decisionType === 'BUDGET_ALLOCATION');

  const totalSavings = completedDecisions.reduce((s: number, d: any) => s + (d.financialImpact?.avoidedLoss ?? d.costSavings ?? 0), 0);
  const totalLosses = brain.decisions.filter((d: any) => d.decisionType === 'EMERGENCY_PROCUREMENT').reduce((s: number, d: any) => s + ((d.financialImpact?.estimatedCost ?? 0) * 0.2), 0);
  const netImpact = totalSavings - totalLosses;

  const fmt = (n: number) => new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-[#050a18] text-white p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              {tr('التقارير المالية', 'Financial Reports')}
            </h1>
            <p className="text-xs text-gray-500 mt-1">{tr('ملخص مالي وتحليل التكاليف والوفورات', 'Financial summary, cost analysis, and savings')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-gray-500 font-mono">{tr('دورة', 'CYCLE')} #{brain.cycleCount}</span>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-emerald-500/20 p-5 text-center">
            <p className="text-[10px] text-gray-500 mb-2">{tr('إجمالي الوفورات', 'Total Savings')}</p>
            <p className="text-2xl font-bold font-mono text-emerald-400">{fmt(totalSavings)}</p>
          </div>
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-red-500/20 p-5 text-center">
            <p className="text-[10px] text-gray-500 mb-2">{tr('إجمالي الخسائر', 'Total Losses')}</p>
            <p className="text-2xl font-bold font-mono text-red-400">{fmt(totalLosses)}</p>
          </div>
          <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-cyan-500/20 p-5 text-center">
            <p className="text-[10px] text-gray-500 mb-2">{tr('صافي الأثر', 'Net Impact')}</p>
            <p className={`text-2xl font-bold font-mono ${netImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(netImpact)}</p>
          </div>
        </div>

        {/* Budget Utilization */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('استهلاك الميزانية', 'Budget Utilization')}</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold font-mono" style={{ color: (budgetPressure?.pressure ?? 0) >= 60 ? '#ef4444' : (budgetPressure?.pressure ?? 0) >= 35 ? '#f59e0b' : '#22c55e' }}>
                {budgetPressure?.pressure ?? 0}%
              </p>
              <p className="text-[10px] text-gray-500 mt-1">{tr('معدل الحرق', 'Burn Rate')}</p>
            </div>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-all duration-700" style={{ width: `${budgetPressure?.pressure ?? 0}%` }} />
            </div>
            <div className="text-xs text-gray-400">
              {tr('الاتجاه', 'Trend')}: <span className="text-white">{budgetPressure?.trend ?? 'stable'}</span>
            </div>
          </div>
          {(budgetPressure?.drivers?.length ?? 0) > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {budgetPressure!.drivers.map((d, i) => (
                <span key={i} className="px-2 py-0.5 text-[10px] rounded bg-white/5 border border-white/10 text-gray-400">{typeof d === 'string' ? d : (d as any).label || JSON.stringify(d)}</span>
              ))}
            </div>
          )}
        </div>

        {/* Cost Optimization Decisions */}
        <div className="rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">{tr('قرارات تحسين التكاليف', 'Cost Optimization Decisions')}</h2>
          {costDecisions.length > 0 ? (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {costDecisions.slice(0, 10).map((d: any, i: number) => (
                <div key={d.id || i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <div>
                    <p className="text-xs text-gray-200">{language === 'ar' ? (d.titleAr || d.title) : d.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{d.decisionCode} — {d.costImpact ? fmt(d.costImpact) : ''}</p>
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
