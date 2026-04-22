import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ErPageShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  patientHeader?: ReactNode;
  children: ReactNode;
  isRTL?: boolean;
  className?: string;
};

export function ErPageShell({
  title,
  subtitle,
  actions,
  patientHeader,
  children,
  isRTL,
  className,
}: ErPageShellProps) {
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className={cn('min-h-screen bg-background', className)}>
      {patientHeader && (
        <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-3">{patientHeader}</div>
        </div>
      )}
      <div className="mx-auto max-w-6xl px-6 py-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
