import { cn } from '@/lib/utils';
import { getTheaUiStatus } from '@/lib/thea-ui/tokens';
import { getStatusConfig } from '@/lib/opd/ui-config';

interface TheaStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  language?: 'ar' | 'en';
}

export function TheaStatusBadge({ status, size = 'md', language }: TheaStatusBadgeProps) {
  const cfg = getTheaUiStatus(status);
  const opdCfg = getStatusConfig(status);
  const label = language ? (language === 'ar' ? opdCfg.label : (opdCfg.labelEn ?? opdCfg.label)) : cfg.label;
  const isInDoctor = status === 'IN_DOCTOR';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full text-[11px] font-bold',
        size === 'md' ? 'py-[3px] pe-2.5 ps-[7px]' : 'py-[2px] pe-2 ps-[5px]',
      )}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
      }}
    >
      {/* Status dot */}
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          isInDoctor && 'thea-animate-glow',
        )}
        style={{
          width: 5,
          height: 5,
          backgroundColor: cfg.color,
          ...(isInDoctor ? { '--thea-glow-color': cfg.color } as React.CSSProperties : {}),
        }}
      />
      {label}
    </span>
  );
}
