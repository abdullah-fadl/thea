'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { CVisionPalette } from '@/lib/cvision/theme';

interface CVisionEmployeeRowProps {
  name: string;
  nameAr: string;
  dept: string;
  status: string;
  initials: string;
  role: string;
  C: CVisionPalette;
  isDark: boolean;
}

const STATUS_KEYS = ['نشط', 'تحت التجربة', 'إجازة', 'مستقيل'] as const;

export default function CVisionEmployeeRow({
  name,
  nameAr,
  dept,
  status,
  initials,
  role,
  C,
  isDark,
}: CVisionEmployeeRowProps) {
  const [hovered, setHovered] = useState(false);

  const statusColors: Record<string, { bg: string; text: string }> = {
    'نشط': { bg: C.greenBadge, text: C.green },
    'Active': { bg: C.greenBadge, text: C.green },
    'تحت التجربة': { bg: C.orangeBadge, text: C.orange },
    'Probation': { bg: C.orangeBadge, text: C.orange },
    'إجازة': { bg: C.blueBadge, text: C.blue },
    'On Leave': { bg: C.blueBadge, text: C.blue },
    'مستقيل': { bg: C.redBadge, text: C.red },
    'Resigned': { bg: C.redBadge, text: C.red },
  };

  const sc = statusColors[status] || { bg: C.greenBadge, text: C.green };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 20px',
        borderBottom: `1px solid ${C.border}`,
        cursor: 'pointer',
        background: hovered ? C.bgSubtle : 'transparent',
        transition: 'background 0.2s',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          marginLeft: 12,
          background: isDark
            ? `linear-gradient(135deg, ${C.gold}30, ${C.purple}30)`
            : `linear-gradient(135deg, ${C.goldDim}, ${C.purpleDim})`,
          border: `1px solid ${isDark ? C.gold + '20' : C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: C.gold,
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      {/* Name */}
      <div style={{ flex: 1, marginRight: 12, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{name}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>{nameAr}</div>
      </div>
      {/* Department */}
      <div style={{ width: 110, fontSize: 12, color: C.textSecondary, flexShrink: 0 }}>{dept}</div>
      {/* Role */}
      <div style={{ width: 90, fontSize: 12, color: C.textMuted, flexShrink: 0 }}>{role}</div>
      {/* Status Badge */}
      <div
        style={{
          padding: '3px 10px',
          borderRadius: 6,
          fontSize: 10,
          fontWeight: 500,
          background: sc.bg,
          color: sc.text,
          flexShrink: 0,
        }}
      >
        {status}
      </div>
      <MoreHorizontal size={16} color={C.textMuted} style={{ marginRight: 12, flexShrink: 0 }} />
    </div>
  );
}
