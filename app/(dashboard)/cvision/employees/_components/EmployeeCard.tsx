'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { MoreHorizontal, Mail, Hash, Calendar, ArrowRight } from 'lucide-react';
import { EMPLOYEE_STATUS_LABELS } from '@/lib/cvision/constants';
import { getStatusDotColor } from '@/lib/cvision/department-colors';
import type { EmployeeListItem } from './types';
import { calculateProfileCompleteness, formatRelativeDate } from './types';
import { useState, useRef, useEffect } from 'react';

interface EmployeeCardProps {
  employee: EmployeeListItem;
  departmentName: string | null;
  jobTitleName: string | null;
  deptColor: string;
  deptBgLight: string;
  deptTextColor: string;
  statusColorClass: string;
  index: number;
  onClick: () => void;
  onQuickAction: (action: string) => void;
}

export default function EmployeeCard({
  employee,
  departmentName,
  jobTitleName,
  deptColor,
  deptBgLight,
  deptTextColor,
  statusColorClass,
  index,
  onClick,
  onQuickAction,
}: EmployeeCardProps) {
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
  const completeness = calculateProfileCompleteness(employee);
  const hireDate = employee.hireDate || employee.hiredAt;
  const empNo = employee.employeeNumber || employee.employeeNo || '\u2014';
  const isTerminal = ['TERMINATED', 'RESIGNED'].includes(employee.status?.toUpperCase());

  // Map dept color classes to inline color
  const avatarBg = deptColor.includes('bg-') ? C.gold : C.gold;

  return (
    <div
      style={{
        background: C.bgCard,
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = C.shadowHover; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = C.shadow; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ padding: 20 }}>
        {/* Top: Avatar + Actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ height: 48, width: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.gold, flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{initials}</span>
          </div>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              style={{ width: 32, height: 32, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            >
              <MoreHorizontal style={{ width: 16, height: 16 }} />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: isRTL ? 'auto' : 0, left: isRTL ? 0 : 'auto', top: 36, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: `0 4px 12px ${C.text}15`, zIndex: 50, minWidth: 160, padding: 4 }} onClick={e => e.stopPropagation()}>
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

        {/* Name + Title + Department */}
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {employee.firstName} {employee.lastName}
          </p>
          <p style={{ fontSize: 13, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {jobTitleName || '\u2014'}
          </p>
          {departmentName && (
            <span style={{ display: 'inline-block', marginTop: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, border: `1px solid ${C.border}`, color: C.textSecondary, background: `${C.gold}10` }}>
              {departmentName}
            </span>
          )}
        </div>

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${C.border}`, margin: '12px 0' }} />

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted, overflow: 'hidden' }}>
            <Mail style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employee.email || '\u2014'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}>
            <Hash style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span style={{ fontFamily: 'monospace' }}>{empNo}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textMuted }}>
            <Calendar style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span>{formatRelativeDate(hireDate)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: employee.status?.toUpperCase() === 'ACTIVE' ? C.green : employee.status?.toUpperCase() === 'PROBATION' ? C.orange : C.red }} />
            <span style={{ color: C.textMuted }}>{statusLabel}</span>
          </div>
        </div>

        {/* Profile Completeness */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: C.textMuted }}>{tr('الملف الشخصي', 'Profile')}</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: C.textMuted }}>{completeness}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: `${C.textMuted}20`, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: completeness >= 80 ? C.green : completeness >= 50 ? C.orange : C.red, width: `${completeness}%`, transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Footer Link */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: C.gold, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            {tr('عرض الملف', 'View Profile')} <ArrowRight style={{ width: 12, height: 12 }} />
          </span>
        </div>
      </div>
    </div>
  );
}
