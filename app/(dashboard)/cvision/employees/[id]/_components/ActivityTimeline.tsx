'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionCard, CVisionCardBody, CVisionCardHeader , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { EMPLOYEE_STATUS_LABELS } from '@/lib/cvision/constants';
import { EMPLOYEE_STATUSES as STATUS_DEFS } from '@/lib/cvision/employees/status-engine';

interface StatusHistoryEntry {
  id: string;
  fromStatus?: string;
  toStatus: string;
  reason?: string;
  createdBy?: string;
  effectiveDate?: string;
  createdAt: string;
  endOfServiceAmount?: number;
  lastWorkingDay?: string;
}

interface ActivityTimelineProps {
  statusHistory: StatusHistoryEntry[];
  loading: boolean;
}

const COLOR_MAP: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  gray: 'bg-gray-400',
  slate: 'bg-slate-500',
  black: 'bg-black dark:bg-white',
};

const BADGE_COLOR_MAP: Record<string, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  black: 'bg-gray-900 text-white dark:bg-white dark:text-gray-900',
};

function getStatusBadgeClass(status: string): string {
  const upper = status?.toUpperCase();
  const def = STATUS_DEFS[upper];
  if (def?.color && BADGE_COLOR_MAP[def.color]) return BADGE_COLOR_MAP[def.color];
  const s = status?.toLowerCase();
  if (s === 'active') return BADGE_COLOR_MAP.green;
  if (s === 'probation') return BADGE_COLOR_MAP.amber;
  if (s === 'terminated' || s === 'suspended') return BADGE_COLOR_MAP.red;
  if (s === 'resigned') return BADGE_COLOR_MAP.gray;
  return BADGE_COLOR_MAP.gray;
}

function getDotColor(status: string): string {
  const upper = status?.toUpperCase();
  const def = STATUS_DEFS[upper];
  if (def?.color && COLOR_MAP[def.color]) return COLOR_MAP[def.color];
  return 'bg-muted-foreground/30';
}

function getLabel(status: string): string {
  const upper = status?.toUpperCase();
  const def = STATUS_DEFS[upper];
  if (def) return def.label;
  return EMPLOYEE_STATUS_LABELS[status] || EMPLOYEE_STATUS_LABELS[status?.toLowerCase()] || status;
}

function getCategoryIcon(status: string): string {
  const upper = status?.toUpperCase();
  const def = STATUS_DEFS[upper];
  if (!def) return '';
  switch (def.category) {
    case 'ACTIVE': return '&#x1F7E2;';   // green circle
    case 'LEAVE': return '&#x1F3D6;';    // beach
    case 'SUSPENDED': return '&#x1F6D1;'; // stop sign
    case 'DEPARTING': return '&#x26A0;';  // warning
    case 'DEPARTED': return '&#x1F6AA;';  // door
    default: return '';
  }
}

export default function ActivityTimeline({ statusHistory, loading }: ActivityTimelineProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const entries = statusHistory.slice(0, 8);

  return (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل النشاط', 'Activity Timeline')}</div>
      </CVisionCardHeader>
      <CVisionCardBody>
        {loading ? (
          <p style={{ fontSize: 13, color: C.textMuted }}>{tr('جاري التحميل...', 'Loading...')}</p>
        ) : entries.length === 0 ? (
          <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد تغييرات مسجلة', 'No status changes recorded')}</p>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {entries.map((entry, idx) => (
                <div key={entry.id} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  <div style={{ position: 'relative', zIndex: 10, marginTop: 6 }}>
                    <div className={`h-3.5 w-3.5 rounded-full border-2 border-background ${
                      idx === 0 ? getDotColor(entry.toStatus) : 'bg-muted-foreground/20'
                    }`} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {entry.fromStatus && (
                        <>
                          <CVisionBadge C={C} variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusBadgeClass(entry.fromStatus)}`}>
                            {getLabel(entry.fromStatus)}
                          </CVisionBadge>
                          <span style={{ fontSize: 12, color: C.textMuted }}>&#8594;</span>
                        </>
                      )}
                      <CVisionBadge C={C} variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusBadgeClass(entry.toStatus)}`}>
                        {getLabel(entry.toStatus)}
                      </CVisionBadge>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      {new Date(entry.effectiveDate || entry.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      {entry.createdBy && ` \u00B7 ${entry.createdBy}`}
                    </p>
                    {entry.reason && (
                      <p style={{ fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>&ldquo;{entry.reason}&rdquo;</p>
                    )}
                    {entry.endOfServiceAmount != null && entry.endOfServiceAmount > 0 && (
                      <p style={{ fontSize: 12, color: C.blue, marginTop: 2, fontWeight: 500 }}>
                        {tr('مكافأة نهاية الخدمة:', 'EOS:')} SAR {entry.endOfServiceAmount.toLocaleString()}
                      </p>
                    )}
                    {entry.lastWorkingDay && (
                      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {tr('آخر يوم:', 'Last day:')} {new Date(entry.lastWorkingDay).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CVisionCardBody>
    </CVisionCard>
  );
}
