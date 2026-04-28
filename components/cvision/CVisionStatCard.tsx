'use client';

import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import type { CVisionPalette } from '@/lib/cvision/theme';

interface CVisionStatCardProps {
  label: string;
  labelAr: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  color: string;
  colorDim: string;
  C: CVisionPalette;
  isRTL?: boolean;
}

export default function CVisionStatCard({
  label,
  labelAr,
  value,
  change,
  icon: Icon,
  color,
  colorDim,
  C,
  isRTL,
}: CVisionStatCardProps) {
  const [hovered, setHovered] = useState(false);
  const isPositive = change?.startsWith('+');

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '18px 20px',
        flex: 1,
        minWidth: 180,
        background: hovered ? C.bgCardHover : C.bgCard,
        border: `1px solid ${hovered ? C.borderHover : C.border}`,
        borderRadius: 14,
        transition: 'all 0.25s ease',
        boxShadow: hovered ? C.shadowHover : C.shadow,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2, opacity: 0.7 }}>
            {labelAr}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.text, marginTop: 8, letterSpacing: -1 }}>
            {value}
          </div>
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: colorDim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={18} color={color} strokeWidth={1.8} />
        </div>
      </div>
      {change && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
          {isPositive ? (
            <ArrowUpRight size={13} color={C.green} />
          ) : (
            <ArrowDownRight size={13} color={C.red} />
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: isPositive ? C.green : C.red }}>
            {change}
          </span>
          <span style={{ fontSize: 11, color: C.textMuted }}>
            {isRTL ? 'عن الشهر الماضي' : 'from last month'}
          </span>
        </div>
      )}
    </div>
  );
}
