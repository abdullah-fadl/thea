'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { MoreHorizontal, Eye } from 'lucide-react';
import { EMPLOYEE_STATUS_LABELS } from '@/lib/cvision/constants';
import type { EmployeeListItem } from './types';
import { formatRelativeDate } from './types';
import { useState, useRef, useEffect } from 'react';

interface EmployeeRowProps {
  employee: EmployeeListItem;
  departmentName: string | null;
  jobTitleName: string | null;
  deptColor: string;
  deptBgLight: string;
  deptTextColor: string;
  statusColorClass: string;
  onClick: () => void;
  onQuickAction: (action: string) => void;
}

export default function EmployeeRow({
  employee,
  departmentName,
  jobTitleName,
  deptColor,
  deptBgLight,
  deptTextColor,
  statusColorClass,
  onClick,
  onQuickAction,
}: EmployeeRowProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase();
  const statusLabel = EMPLOYEE_STATUS_LABELS[employee.status?.toLowerCase()] || employee.status;
  const hireDate = employee.hireDate || employee.hiredAt;
  const isTerminal = ['TERMINATED', 'RESIGNED'].includes(employee.status?.toUpperCase());

  const statusColor = employee.status?.toUpperCase() === 'ACTIVE' ? 'success' as const
    : employee.status?.toUpperCase() === 'PROBATION' ? 'warning' as const
    : 'danger' as const;

  return (
    <tr
      style={{ cursor: 'pointer', borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = `${C.gold}06`)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Avatar + Name */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ height: 36, width: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.gold, flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 11 }}>{initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 500, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {employee.firstName} {employee.lastName}
            </p>
            <p style={{ fontSize: 12, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {jobTitleName || '\u2014'}
            </p>
          </div>
        </div>
      </td>

      {/* Department */}
      <td style={{ padding: '10px 12px' }}>
        {departmentName ? (
          <CVisionBadge C={C} variant="muted">{departmentName}</CVisionBadge>
        ) : (
          <span style={{ fontSize: 12, color: C.textMuted }}>{'\u2014'}</span>
        )}
      </td>

      {/* Status */}
      <td style={{ padding: '10px 12px' }}>
        <CVisionBadge C={C} variant={statusColor}>{statusLabel}</CVisionBadge>
      </td>

      {/* Hire Date */}
      <td style={{ padding: '10px 12px' }}>
        <span
          style={{ fontSize: 13, color: C.textMuted }}
          title={hireDate ? new Date(hireDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : undefined}
        >
          {formatRelativeDate(hireDate)}
        </span>
      </td>

      {/* Actions */}
      <td style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
          <button
            style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}
            onClick={() => onQuickAction('view-profile')}
          >
            <Eye style={{ width: 16, height: 16 }} />
          </button>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreHorizontal style={{ width: 16, height: 16 }} />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: isRTL ? 'auto' : 0, left: isRTL ? 0 : 'auto', top: 36, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: `0 4px 12px ${C.text}15`, zIndex: 50, minWidth: 160, padding: 4 }}>
                {[
                  { key: 'view-profile', labelAr: 'عرض الملف', labelEn: 'View Profile' },
                  { key: 'edit-details', labelAr: 'تعديل التفاصيل', labelEn: 'Edit Details' },
                  { key: 'change-status', labelAr: 'تغيير الحالة', labelEn: 'Change Status' },
                  { key: 'view-payroll', labelAr: 'عرض الرواتب', labelEn: 'View Payroll' },
                  { key: 'view-attendance', labelAr: 'عرض الحضور', labelEn: 'View Attendance' },
                ].map(item => (
                  <button
                    key={item.key}
                    style={{ width: '100%', textAlign: isRTL ? 'right' : 'left', padding: '6px 12px', fontSize: 13, color: C.text, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${C.text}08`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { onQuickAction(item.key); setMenuOpen(false); }}
                  >
                    {tr(item.labelAr, item.labelEn)}
                  </button>
                ))}
                {!isTerminal && (
                  <>
                    <div style={{ height: 1, background: C.border, margin: '4px 0' }} />
                    <button
                      style={{ width: '100%', textAlign: isRTL ? 'right' : 'left', padding: '6px 12px', fontSize: 13, color: C.red, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4 }}
                      onMouseEnter={e => (e.currentTarget.style.background = `${C.red}10`)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { onQuickAction('terminate'); setMenuOpen(false); }}
                    >
                      {tr('إنهاء الخدمة', 'Terminate Employee')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
