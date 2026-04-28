'use client';

import { ReactNode, useState, CSSProperties } from 'react';
import { type CVisionPalette } from '@/lib/cvision/theme';

/* ─── Card ───────────────────────────────────────────────────────────── */

interface CVisionCardProps {
  C: CVisionPalette;
  children: ReactNode;
  style?: CSSProperties;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CVisionCard({ C, children, style, hover = true, onClick, className }: CVisionCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={hover ? () => setHovered(true) : undefined}
      onMouseLeave={hover ? () => setHovered(false) : undefined}
      style={{
        borderRadius: 14,
        background: hovered ? C.bgCardHover : C.bgCard,
        border: `1px solid ${hovered ? C.borderHover : C.border}`,
        boxShadow: hovered ? C.shadowHover : C.shadow,
        transition: 'all 0.25s',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Card Header ────────────────────────────────────────────────────── */

interface CVisionCardHeaderProps {
  C: CVisionPalette;
  children: ReactNode;
  style?: CSSProperties;
  noBorder?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CVisionCardHeader({ C, children, style, noBorder, onClick, className }: CVisionCardHeaderProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        padding: '14px 20px',
        borderBottom: noBorder ? 'none' : `1px solid ${C.border}`,
        background: C.headerBg,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Card Body ──────────────────────────────────────────────────────── */

interface CVisionCardBodyProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function CVisionCardBody({ children, style }: CVisionCardBodyProps) {
  return (
    <div style={{ padding: '16px 20px', ...style }}>
      {children}
    </div>
  );
}
