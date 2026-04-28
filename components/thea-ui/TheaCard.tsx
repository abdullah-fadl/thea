'use client';

import { cn } from '@/lib/utils';

interface TheaCardProps {
  title: string;
  pill?: string;
  right?: React.ReactNode;
  tabs?: string[];
  activeTab?: number;
  onTabChange?: (index: number) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const pillStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  new: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
};

export function TheaCard({
  title,
  pill,
  right,
  tabs,
  activeTab = 0,
  onTabChange,
  children,
  className,
  style,
}: TheaCardProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-2xl p-3.5 thea-hover-lift',
        className,
      )}
      style={style}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="font-extrabold text-sm text-foreground truncate">{title}</h3>
          {pill && (
            <span
              className={cn(
                'text-[11px] px-2.5 py-0.5 rounded-full font-bold flex-shrink-0',
                pillStyles[pill] || 'bg-primary/10 text-foreground',
              )}
            >
              {pill}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Inline tabs */}
          {tabs && tabs.length > 0 && (
            <div className="flex items-center gap-1">
              {tabs.map((tab, idx) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onTabChange?.(idx)}
                  className={cn(
                    'text-[11px] px-2.5 py-0.5 rounded-full border thea-transition-fast',
                    idx === activeTab
                      ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Right slot */}
          {right && (
            <span className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
              {right}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}
