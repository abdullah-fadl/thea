'use client';

import { ReactNode, CSSProperties } from 'react';
import { type CVisionPalette } from '@/lib/cvision/theme';

export type BadgeVariant = 'default' | 'success' | 'danger' | 'destructive' | 'warning' | 'info' | 'purple' | 'muted' | 'outline' | 'secondary';

interface CVisionBadgeProps {
  C?: CVisionPalette;
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
  style?: CSSProperties;
  className?: string;
  title?: string;
  onClick?: () => void;
}

const FALLBACK_PALETTE = {
  goldDim: 'rgba(200,170,80,0.15)', gold: '#c8aa50',
  greenBadge: 'rgba(80,200,120,0.15)', greenDim: 'rgba(80,200,120,0.15)', green: '#50c878',
  redBadge: 'rgba(220,60,60,0.15)', redDim: 'rgba(220,60,60,0.15)', red: '#dc3c3c',
  orangeBadge: 'rgba(230,160,50,0.15)', orangeDim: 'rgba(230,160,50,0.15)', orange: '#e6a032',
  blueBadge: 'rgba(60,130,220,0.15)', blueDim: 'rgba(60,130,220,0.15)', blue: '#3c82dc',
  purpleDim: 'rgba(140,80,200,0.15)', purple: '#8c50c8',
  bgSubtle: 'rgba(255,255,255,0.04)', textMuted: '#888', textSecondary: '#aaa', border: 'rgba(255,255,255,0.08)',
};

export function CVisionBadge({ C, variant = 'default', children, dot, style, className, title, onClick }: CVisionBadgeProps) {
  const p = C || (FALLBACK_PALETTE as CVisionPalette);
  const variants: Record<BadgeVariant, { bg: string; color: string; border?: string }> = {
    default: { bg: p.goldDim, color: p.gold },
    success: { bg: p.greenBadge || p.greenDim, color: p.green },
    danger: { bg: p.redBadge || p.redDim, color: p.red },
    destructive: { bg: p.redBadge || p.redDim, color: p.red },
    warning: { bg: p.orangeBadge || p.orangeDim, color: p.orange },
    info: { bg: p.blueBadge || p.blueDim, color: p.blue },
    purple: { bg: p.purpleDim, color: p.purple },
    muted: { bg: p.bgSubtle, color: p.textMuted, border: p.border },
    outline: { bg: 'transparent', color: p.textSecondary, border: p.border },
    secondary: { bg: p.bgSubtle, color: p.textSecondary, border: p.border },
  };

  const v = variants[variant] || variants.default;

  return (
    <span
      className={className}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 600,
        background: v.bg,
        color: v.color,
        border: v.border ? `1px solid ${v.border}` : undefined,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: v.color,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}
