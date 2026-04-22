'use client';

import { cn } from '@/lib/utils';

interface TheaKpiCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  trend?: 'up' | 'down' | 'flat';
}

export function TheaKpiCard({ label, value, icon, color, trend }: TheaKpiCardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl p-3.5',
        'flex gap-2.5 items-center cursor-default',
        'thea-hover-lift',
      )}
    >
      {/* Icon */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{
          background: color ? `${color}15` : undefined,
        }}
      >
        {icon}
      </div>

      {/* Label + value */}
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-extrabold text-foreground">{value}</span>
          {trend === 'up' && <span className="text-emerald-500 text-xs">↑</span>}
          {trend === 'down' && <span className="text-red-500 text-xs">↓</span>}
        </div>
      </div>
    </div>
  );
}
