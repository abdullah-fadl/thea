'use client';

import { useLang } from '@/hooks/use-lang';
import { DollarSign, ShieldAlert, Users, TrendingUp, BarChart3, Target } from 'lucide-react';

interface ExecutiveData {
  totalBudget: number;
  budgetUtilized: number;
  budgetUtilizationPct: number;
  riskIndex: number;
  vendorCount: number;
  vendorDependencyScore: number;
  topDecisions: Array<{
    title: string;
    titleAr: string;
    impact: string;
    impactAr: string;
    confidence: number;
    type: string;
  }>;
  standardizationOpportunities: number;
  savingsPotential: number;
  complianceScore: number;
  networkHealthAvg: number;
}

export function ExecutiveKPIs({ data }: { data: ExecutiveData }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const fmtSAR = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toFixed(0);
  };

  const riskColor = data.riskIndex >= 70 ? '#ef4444' : data.riskIndex >= 40 ? '#f59e0b' : '#10b981';
  const complianceColor = data.complianceScore >= 80 ? '#10b981' : data.complianceScore >= 60 ? '#f59e0b' : '#ef4444';

  const kpis = [
    {
      icon: DollarSign,
      labelAr: 'الميزانية',
      labelEn: 'Budget',
      value: `${fmtSAR(data.budgetUtilized)} / ${fmtSAR(data.totalBudget)}`,
      sub: `${data.budgetUtilizationPct}%`,
      color: data.budgetUtilizationPct > 80 ? '#ef4444' : data.budgetUtilizationPct > 60 ? '#f59e0b' : '#10b981',
    },
    {
      icon: ShieldAlert,
      labelAr: 'مؤشر المخاطر',
      labelEn: 'Risk Index',
      value: `${data.riskIndex}%`,
      sub: data.riskIndex >= 70 ? tr('حرج', 'Critical') : data.riskIndex >= 40 ? tr('متوسط', 'Medium') : tr('منخفض', 'Low'),
      color: riskColor,
    },
    {
      icon: Users,
      labelAr: 'الموردون',
      labelEn: 'Vendors',
      value: String(data.vendorCount),
      sub: `${tr('اعتماد', 'Dependency')}: ${data.vendorDependencyScore}%`,
      color: '#3b82f6',
    },
    {
      icon: Target,
      labelAr: 'الامتثال',
      labelEn: 'Compliance',
      value: `${data.complianceScore}%`,
      sub: tr('النتيجة الإجمالية', 'Overall Score'),
      color: complianceColor,
    },
    {
      icon: BarChart3,
      labelAr: 'التوحيد',
      labelEn: 'Standardization',
      value: String(data.standardizationOpportunities),
      sub: `${fmtSAR(data.savingsPotential)} ${tr('ر.س وفورات', 'SAR savings')}`,
      color: '#8b5cf6',
    },
    {
      icon: TrendingUp,
      labelAr: 'صحة الشبكة',
      labelEn: 'Network Health',
      value: `${data.networkHealthAvg}%`,
      sub: tr('المتوسط', 'Average'),
      color: data.networkHealthAvg >= 80 ? '#10b981' : data.networkHealthAvg >= 60 ? '#f59e0b' : '#ef4444',
    },
  ];

  return (
    <div dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.labelEn}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-3 hover:bg-white/[0.04] transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4" style={{ color: kpi.color }} />
                <span className="text-[10px] text-white/40 uppercase tracking-wider">
                  {tr(kpi.labelAr, kpi.labelEn)}
                </span>
              </div>
              <p className="text-lg font-bold font-mono" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Top Decisions */}
      {data.topDecisions.length > 0 && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {data.topDecisions.map((d, i) => (
            <div
              key={i}
              className="shrink-0 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 min-w-[200px]"
            >
              <p className="text-xs text-white/70 truncate mb-1">
                {language === 'ar' ? d.titleAr : d.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-400/60">
                  {language === 'ar' ? d.impactAr : d.impact}
                </span>
                <span className="text-[10px] text-white/30">
                  {d.confidence}% {tr('ثقة', 'conf.')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
