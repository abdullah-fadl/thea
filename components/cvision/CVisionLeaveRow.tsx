'use client';

import type { LucideIcon } from 'lucide-react';
import type { CVisionPalette } from '@/lib/cvision/theme';

interface CVisionLeaveRowProps {
  name: string;
  type: string;
  typeIcon: LucideIcon;
  days: string;
  date: string;
  status: string;
  C: CVisionPalette;
}

export default function CVisionLeaveRow({
  name,
  type,
  typeIcon: TypeIcon,
  days,
  date,
  status,
  C,
}: CVisionLeaveRowProps) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'معتمد': { bg: C.greenBadge, text: C.green },
    'Approved': { bg: C.greenBadge, text: C.green },
    'مرفوض': { bg: C.redBadge, text: C.red },
    'Rejected': { bg: C.redBadge, text: C.red },
    'بانتظار': { bg: C.orangeBadge, text: C.orange },
    'Pending': { bg: C.orangeBadge, text: C.orange },
  };

  const sc = statusColors[status] || { bg: C.orangeBadge, text: C.orange };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '11px 18px',
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: C.purpleDim,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginInlineEnd: 12,
          flexShrink: 0,
        }}
      >
        <TypeIcon size={15} color={C.purple} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{name}</div>
        <div style={{ fontSize: 10, color: C.textMuted }}>
          {type} — {days} — {date}
        </div>
      </div>
      <div
        style={{
          padding: '2px 9px',
          borderRadius: 5,
          fontSize: 10,
          fontWeight: 500,
          background: sc.bg,
          color: sc.text,
          flexShrink: 0,
        }}
      >
        {status}
      </div>
    </div>
  );
}
