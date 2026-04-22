'use client';

import { CSSProperties } from 'react';
import { type CVisionPalette } from '@/lib/cvision/theme';

/* ─── Skeleton ───────────────────────────────────────────────────────── */

interface CVisionSkeletonProps {
  C: CVisionPalette;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: CSSProperties;
}

export function CVisionSkeleton({ C, width = '100%', height = 16, borderRadius = 8, style }: CVisionSkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: C.bgSubtle,
        border: `1px solid ${C.border}`,
        animation: 'cvision-pulse 2s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/* ─── Skeleton Card ──────────────────────────────────────────────────── */

interface CVisionSkeletonCardProps {
  C: CVisionPalette;
  height?: number;
  style?: CSSProperties;
  className?: string;
}

export function CVisionSkeletonCard({ C, height = 120, style, className }: CVisionSkeletonCardProps) {
  return (
    <div
      style={{
        borderRadius: 14,
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        height,
        animation: 'cvision-pulse 2s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/* ─── Skeleton Row ───────────────────────────────────────────────────── */

interface CVisionSkeletonRowProps {
  C: CVisionPalette;
  cols?: number;
}

export function CVisionSkeletonRow({ C, cols = 4 }: CVisionSkeletonRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
      <CVisionSkeleton C={C} width={32} height={32} borderRadius={8} />
      {Array.from({ length: cols }).map((_, i) => (
        <CVisionSkeleton key={i} C={C} width={i === 0 ? 120 : 80} height={12} />
      ))}
    </div>
  );
}

/* ─── Global Keyframes (inject once) ─────────────────────────────────── */

export function CVisionSkeletonStyles() {
  return (
    <style>{`
      @keyframes cvision-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `}</style>
  );
}
