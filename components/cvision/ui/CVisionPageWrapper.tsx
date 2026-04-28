'use client';

import { ReactNode, CSSProperties } from 'react';
import { type CVisionPalette } from '@/lib/cvision/theme';
import { LucideIcon } from 'lucide-react';

/* ─── Page Header ────────────────────────────────────────────────────── */

interface CVisionPageHeaderProps {
  C: CVisionPalette;
  title: string;
  titleEn?: string;
  subtitle?: string;
  isRTL?: boolean;
  icon?: LucideIcon;
  iconColor?: string;
  actions?: ReactNode;
  style?: CSSProperties;
}

export function CVisionPageHeader({
  C,
  title,
  titleEn,
  subtitle,
  isRTL,
  icon: Icon,
  iconColor,
  actions,
  style,
}: CVisionPageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {Icon && (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: (iconColor || C.gold) + '18',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={20} color={iconColor || C.gold} strokeWidth={1.8} />
          </div>
        )}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: -0.3 }}>
            {title}
          </div>
          {titleEn && (
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{titleEn}</div>
          )}
          {subtitle && (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{subtitle}</div>
          )}
        </div>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

/* ─── Page Layout ────────────────────────────────────────────────────── */

interface CVisionPageLayoutProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function CVisionPageLayout({ children, style }: CVisionPageLayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, ...style }}>
      {children}
    </div>
  );
}

/* ─── Stats Row ──────────────────────────────────────────────────────── */

interface CVisionStatsRowProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function CVisionStatsRow({ children, style }: CVisionStatsRowProps) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ...style }}>
      {children}
    </div>
  );
}

/* ─── Mini Stat Card (for use inside pages) ──────────────────────────── */

interface CVisionMiniStatProps {
  C: CVisionPalette;
  label: string;
  labelEn?: string;
  value: number | string;
  icon?: LucideIcon;
  color?: string;
  colorDim?: string;
  style?: CSSProperties;
}

export function CVisionMiniStat({ C, label, labelEn, value, icon: Icon, color, colorDim, style }: CVisionMiniStatProps) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        padding: 16,
        borderRadius: 14,
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all 0.25s',
        ...style,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: colorDim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={color} strokeWidth={1.8} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: C.textSecondary }}>{label}</div>
        {labelEn && <div style={{ fontSize: 9, color: C.textMuted }}>{labelEn}</div>}
      </div>
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────── */

interface CVisionEmptyStateProps {
  C: CVisionPalette;
  icon: LucideIcon | React.ComponentType<any>;
  title: string;
  description?: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CVisionEmptyState({ C, icon: Icon, title, description, subtitle, action }: CVisionEmptyStateProps) {
  const desc = description || subtitle;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: C.goldDim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon size={26} color={C.gold} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>{title}</div>
      {desc && (
        <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 360, lineHeight: 1.6 }}>
          {desc}
        </div>
      )}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
