'use client';

import { useLang } from '@/hooks/use-lang';
import { ShieldAlert } from 'lucide-react';

interface PressureDimension {
  key: string;
  label?: string;
  labelAr?: string;
  pressure: number;
}

interface PressureData {
  composite: number;
  dimensions: PressureDimension[];
  trend?: string;
}

export function RiskRadar({ pressureData }: { pressureData: PressureData }) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const compositeColor = pressureData.composite >= 70 ? '#ef4444'
    : pressureData.composite >= 40 ? '#f59e0b'
    : '#22c55e';

  const dimensionLabel = (d: PressureDimension) => {
    if (language === 'ar' && d.labelAr) return d.labelAr;
    if (d.label) return d.label;
    const map: Record<string, [string, string]> = {
      supply: ['سلسلة الإمداد', 'Supply Chain'],
      financial: ['المالية', 'Financial'],
      quality: ['الجودة', 'Quality'],
      assets: ['الأصول', 'Assets'],
      procurement: ['المشتريات', 'Procurement'],
      compliance: ['الامتثال', 'Compliance'],
      clinical: ['السريري', 'Clinical'],
      operational: ['التشغيلي', 'Operational'],
    };
    return tr(map[d.key]?.[0] ?? d.key, map[d.key]?.[1] ?? d.key);
  };

  const barColor = (p: number) =>
    p >= 70 ? 'bg-red-500' : p >= 40 ? 'bg-amber-500' : 'bg-emerald-500';

  const barGlow = (p: number) =>
    p >= 70 ? 'shadow-red-500/30' : p >= 40 ? 'shadow-amber-500/20' : 'shadow-emerald-500/20';

  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-4 h-full"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-400" />
          {tr('رادار المخاطر', 'Risk Radar')}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">
            {tr('المركب', 'Composite')}
          </span>
          <span className="text-lg font-bold font-mono" style={{ color: compositeColor }}>
            {Math.round(pressureData.composite)}%
          </span>
        </div>
      </div>

      {/* Composite bar */}
      <div className="mb-5">
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.min(pressureData.composite, 100)}%`,
              backgroundColor: compositeColor,
              boxShadow: `0 0 12px ${compositeColor}40`,
            }}
          />
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="space-y-2.5">
        {pressureData.dimensions.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-white/50">{dimensionLabel(d)}</span>
              <span className="text-[11px] font-mono text-white/60">{Math.round(d.pressure)}%</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-sm ${barColor(d.pressure)} ${barGlow(d.pressure)}`}
                style={{ width: `${Math.min(d.pressure, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {pressureData.dimensions.length === 0 && (
        <div className="text-center py-6 text-white/20 text-xs">
          {tr('لا توجد بيانات ضغط', 'No pressure data')}
        </div>
      )}
    </div>
  );
}
