'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionBadge , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { ArrowLeft, Save, UserCheck, Loader2, MoreHorizontal, Printer } from 'lucide-react';
import { EMPLOYEE_STATUS_LABELS } from '@/lib/cvision/constants';
import { getDeptColor, getStatusColor } from '@/lib/cvision/department-colors';
import type { ProfileResponse, ProfileCompletenessData, ReferenceData } from './types';

interface ProfileHeaderProps {
  profile: ProfileResponse;
  referenceData: ReferenceData;
  completeness: ProfileCompletenessData;
  hasChanges: boolean;
  saving: boolean;
  canChangeStatus: boolean;
  onSaveAll: () => void;
  onStatusChangeOpen: () => void;
  onBack: () => void;
}

export default function ProfileHeader({
  profile,
  referenceData,
  completeness,
  hasChanges,
  saving,
  canChangeStatus,
  onSaveAll,
  onStatusChangeOpen,
  onBack,
}: ProfileHeaderProps) {
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

  const emp = profile.employee;

  const deptName = useMemo(() => {
    const dept = referenceData.departments.find((d) => d.id === emp.departmentId);
    return dept ? `${dept.name}${dept.code ? ` (${dept.code})` : ''}` : '';
  }, [referenceData.departments, emp.departmentId]);

  const jobTitleName = useMemo(() => {
    const jt = referenceData.jobTitles.find((j) => j.id === emp.jobTitleId);
    return jt?.name || '';
  }, [referenceData.jobTitles, emp.jobTitleId]);

  const initials = `${emp.firstName?.charAt(0) || ''}${emp.lastName?.charAt(0) || ''}`.toUpperCase();

  const statusLabel = EMPLOYEE_STATUS_LABELS[emp.status?.toLowerCase() || ''] || emp.status;
  const statusVariant = emp.status?.toUpperCase() === 'ACTIVE' ? 'success' as const
    : emp.status?.toUpperCase() === 'PROBATION' ? 'warning' as const
    : 'danger' as const;

  // SVG completeness ring
  const ringSize = 52;
  const strokeWidth = 4;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (completeness.percentage / 100) * circumference;
  const ringColor = completeness.percentage >= 80 ? C.green : completeness.percentage >= 50 ? C.orange : C.red;

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, background: C.bg, borderBottom: `1px solid ${C.border}`, boxShadow: `0 1px 3px ${C.text}08` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Back button */}
          <button
            style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, flexShrink: 0 }}
            onClick={onBack}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
          </button>

          {/* Avatar */}
          <div style={{ height: 64, width: 64, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{initials}</span>
          </div>

          {/* Name and info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.firstName} {emp.lastName}
              </h1>
              <CVisionBadge C={C} variant={statusVariant}>{statusLabel}</CVisionBadge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 13, color: C.textMuted }}>
              <span style={{ fontWeight: 500 }}>{emp.employeeNo}</span>
              {deptName && (
                <>
                  <span style={{ color: `${C.textMuted}60` }}>{'\u00b7'}</span>
                  <span>{deptName}</span>
                </>
              )}
              {jobTitleName && (
                <>
                  <span style={{ color: `${C.textMuted}60` }}>{'\u00b7'}</span>
                  <span>{jobTitleName}</span>
                </>
              )}
            </div>
          </div>

          {/* Completeness ring */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <svg width={ringSize} height={ringSize} style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                strokeWidth={strokeWidth}
                stroke={`${C.textMuted}30`}
                fill="none"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                strokeWidth={strokeWidth}
                stroke={ringColor}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <span style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
              {completeness.filled} {tr('من', 'of')} {completeness.total} {tr('حقول', 'fields')}
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <CVisionButton
              C={C}
              isDark={isDark}
              variant="primary"
              onClick={onSaveAll}
              disabled={!hasChanges || saving}
              icon={saving
                ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                : <Save style={{ width: 16, height: 16 }} />
              }
            >
              {tr('حفظ الكل', 'Save All')}
            </CVisionButton>

            {canChangeStatus && (
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={onStatusChangeOpen} icon={<UserCheck style={{ width: 16, height: 16 }} />}>
                {tr('تغيير الحالة', 'Change Status')}
              </CVisionButton>
            )}

            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                style={{ width: 36, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted }}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreHorizontal style={{ width: 16, height: 16 }} />
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', right: isRTL ? 'auto' : 0, left: isRTL ? 0 : 'auto', top: 40, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: `0 4px 12px ${C.text}15`, zIndex: 50, minWidth: 160, padding: 4 }}>
                  <button
                    style={{ width: '100%', textAlign: isRTL ? 'right' : 'left', padding: '8px 12px', fontSize: 13, color: C.text, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${C.text}08`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { window.print(); setMenuOpen(false); }}
                  >
                    <Printer style={{ width: 16, height: 16 }} />
                    {tr('طباعة', 'Print')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
