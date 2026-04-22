'use client';

import { ReactNode, useState, CSSProperties } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { type CVisionPalette } from '@/lib/cvision/theme';

/* ─── Table ──────────────────────────────────────────────────────────── */

interface CVisionTableProps {
  C: CVisionPalette;
  children: ReactNode;
  style?: CSSProperties;
}

export function CVisionTable({ C, children, style }: CVisionTableProps) {
  return (
    <div style={{ width: '100%', overflowX: 'auto', ...style }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'inherit',
        }}
      >
        {children}
      </table>
    </div>
  );
}

/* ─── Table Head ─────────────────────────────────────────────────────── */

interface CVisionTableHeadProps {
  C?: CVisionPalette;
  children: ReactNode;
}

export function CVisionTableHead({ C, children }: CVisionTableHeadProps) {
  return (
    <thead>
      <tr
        style={{
          borderBottom: C ? `1px solid ${C.border}` : '1px solid rgba(255,255,255,0.08)',
          background: C?.headerBg || 'transparent',
        }}
      >
        {children}
      </tr>
    </thead>
  );
}

/* ─── Table Header Cell ──────────────────────────────────────────────── */

export interface CVisionThProps {
  C: CVisionPalette;
  children?: ReactNode;
  sortable?: boolean;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: () => void;
  onClick?: () => void;
  align?: 'left' | 'center' | 'right';
  width?: number | string;
  style?: CSSProperties;
  className?: string;
}

export function CVisionTh({ C, children, sortable, sortDir, onSort, align = 'left', width, style: extraStyle }: CVisionThProps) {
  return (
    <th
      onClick={sortable ? onSort : undefined}
      style={{
        padding: '10px 14px',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: C.textMuted,
        textAlign: align,
        cursor: sortable ? 'pointer' : 'default',
        userSelect: sortable ? 'none' : undefined,
        width,
        whiteSpace: 'nowrap',
        ...extraStyle,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {sortable && sortDir && (
          sortDir === 'asc'
            ? <ChevronUp size={12} color={C.gold} />
            : <ChevronDown size={12} color={C.gold} />
        )}
      </span>
    </th>
  );
}

/* ─── Table Body ─────────────────────────────────────────────────────── */

export function CVisionTableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

/* ─── Table Row ──────────────────────────────────────────────────────── */

export interface CVisionTrProps {
  C?: CVisionPalette;
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;
}

export function CVisionTr({ C, children, onClick, style }: CVisionTrProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: C ? `1px solid ${C.border}` : '1px solid rgba(255,255,255,0.08)',
        background: hovered ? (C?.bgCardHover || 'rgba(255,255,255,0.03)') : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

/* ─── Table Cell ─────────────────────────────────────────────────────── */

export interface CVisionTdProps {
  C?: CVisionPalette;
  children?: ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  align?: 'left' | 'center' | 'right';
  style?: CSSProperties;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
}

export function CVisionTd({ children, onClick, align = 'left', style, colSpan, rowSpan, className }: CVisionTdProps) {
  return (
    <td
      onClick={onClick}
      colSpan={colSpan}
      rowSpan={rowSpan}
      className={className}
      style={{
        padding: '12px 14px',
        fontSize: 13,
        textAlign: align,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {children}
    </td>
  );
}
