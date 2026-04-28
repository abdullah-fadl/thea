'use client';

import { TheaSparkline } from './TheaSparkline';
import { TheaSoftButton } from './TheaSoftButton';
import { useLang } from '@/hooks/use-lang';

interface TheaChartCardProps {
  title: string;
  subtitle?: string;
  data?: number[];
  color?: string;
  height?: number;
}

export function TheaChartCard({
  title,
  subtitle,
  data,
  color = '#1D4ED8',
  height = 120,
}: TheaChartCardProps) {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  return (
    <div className="bg-card border border-border rounded-2xl p-3.5 thea-hover-lift">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="min-w-0">
          <h3 className="font-extrabold text-sm text-foreground truncate">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        <TheaSoftButton>{tr('التفاصيل', 'Details')}</TheaSoftButton>
      </div>

      {/* Chart area */}
      <div
        className="rounded-xl bg-muted/50 border border-border p-3.5 mt-2.5 flex items-center justify-center"
        style={{ minHeight: height }}
      >
        {data && data.length > 0 ? (
          <TheaSparkline
            data={data}
            width={Math.max(200, 0)}
            height={height - 28}
            color={color}
          />
        ) : (
          /* Placeholder bars */
          <div className="w-full flex flex-col gap-2.5">
            <div className="h-2.5 rounded-full bg-border" style={{ width: '75%' }} />
            <div className="h-2.5 rounded-full bg-border" style={{ width: '50%' }} />
            <div className="h-2.5 rounded-full bg-border" style={{ width: '90%' }} />
          </div>
        )}
      </div>
    </div>
  );
}
