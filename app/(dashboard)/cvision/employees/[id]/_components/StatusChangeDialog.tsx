'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionButton, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect } from '@/components/cvision/ui';
import { EMPLOYEE_STATUS_LABELS } from '@/lib/cvision/constants';
import { getAllowedTransitions } from '@/lib/cvision/statusMachine';
import {
  EMPLOYEE_STATUSES as STATUS_DEFS,
  previewStatusChange,
  type StatusChangeImpact,
} from '@/lib/cvision/employees/status-engine';
import type { ProfileResponse } from './types';

export interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileResponse;
  editData: Record<string, Record<string, any>>;
  newStatus: string;
  setNewStatus: (s: string) => void;
  statusReason: string;
  setStatusReason: (s: string) => void;
  statusEffectiveDate: string;
  setStatusEffectiveDate: (s: string) => void;
  lastWorkingDay: string;
  setLastWorkingDay: (s: string) => void;
  statusHistory: any[];
  loadingHistory: boolean;
  changingStatus: boolean;
  handleStatusChange: () => void;
}

export default function StatusChangeDialog({
  open,
  onOpenChange,
  profile,
  editData,
  newStatus,
  setNewStatus,
  statusReason,
  setStatusReason,
  statusEffectiveDate,
  setStatusEffectiveDate,
  lastWorkingDay,
  setLastWorkingDay,
  statusHistory,
  loadingHistory,
  changingStatus,
  handleStatusChange,
}: StatusChangeDialogProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  // ── Impact preview calculation ──
  function renderImpactPreview() {
    if (!newStatus) return null;

    const financialData = editData.FINANCIAL || profile.sections?.FINANCIAL?.dataJson || {};
    const monthlySalary = financialData.basicSalary || financialData.monthlySalary || 0;
    const housingAllowance = financialData.housingAllowance || 0;
    const hiredAt = profile.employee.hiredAt ? new Date(profile.employee.hiredAt as any) : null;
    const yearsOfService = hiredAt ? (Date.now() - hiredAt.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;
    const personalData = editData.PERSONAL || profile.sections?.PERSONAL?.dataJson || {};
    const nationality = personalData.nationality || personalData.nationalityCode || '';
    const isSaudiNat = (() => {
      if (!nationality) return false;
      const n = (nationality as string).toLowerCase().trim();
      return n === 'sa' || n === 'saudi' || n === 'saudi arabian' || n === 'saudi arabia';
    })();

    const impact: StatusChangeImpact = previewStatusChange({
      currentStatus: profile.employee.status.toUpperCase(),
      newStatus,
      monthlySalary,
      housingAllowance,
      yearsOfService,
      isSaudi: isSaudiNat,
    });

    if (impact.warnings.length === 0 && impact.actions.length === 0) return null;

    return (
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase' }}>
          {tr('معاينة التأثير', 'Impact Preview')}
        </p>
        {impact.warnings.map((w, i) => (
          <div key={`w-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <span style={{ color: C.orange }}>&#9888;</span>
            <span style={{ color: C.orange }}>{w}</span>
          </div>
        ))}
        {impact.actions.map((a, i) => (
          <div key={`a-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
            <span style={{ color: C.textMuted }}>&#8226;</span>
            <span>{a}</span>
          </div>
        ))}
        {impact.endOfService && impact.endOfService.totalAmount > 0 && (
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 4 }}>
              {tr('تقدير نهاية الخدمة', 'End of Service Estimate')}
            </p>
            {impact.endOfService.breakdown.map((b, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>{b.period} ({b.rate})</span>
                <span style={{ fontFamily: 'monospace' }}>SAR {b.amount.toLocaleString()}</span>
              </div>
            ))}
            {impact.endOfService.deduction > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.red }}>
                <span>{tr('خصم', 'Deduction')}</span>
                <span style={{ fontFamily: 'monospace' }}>- SAR {impact.endOfService.deduction.toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, borderTop: `1px solid ${C.border}`, marginTop: 4, paddingTop: 4 }}>
              <span>{tr('الإجمالي', 'Total')}</span>
              <span style={{ fontFamily: 'monospace' }}>SAR {impact.endOfService.totalAmount.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <CVisionDialog C={C} open={open} onClose={() => onOpenChange(false)} title={tr('تغيير حالة الموظف', 'Change Employee Status')} isDark={isDark} isRTL={isRTL}>
        <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
          {tr('الحالة الحالية:', 'Current status:')}{' '}
          <strong>
            {EMPLOYEE_STATUS_LABELS[profile.employee.status] ||
              EMPLOYEE_STATUS_LABELS[profile.employee.status?.toLowerCase() || ''] ||
              profile.employee.status}
          </strong>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
          {/* New Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} htmlFor="toStatus">{tr('الحالة الجديدة *', 'New Status *')}</CVisionLabel>
            <CVisionSelect
                C={C}
                value={newStatus}
                onChange={setNewStatus}
                placeholder={tr('اختر الحالة الجديدة', 'Select new status')}
                options={getAllowedTransitions(profile.employee.status.toUpperCase()).map((status) => {
                  const def = STATUS_DEFS[status];
                  return (
                    ({ value: status, label: def?.label || EMPLOYEE_STATUS_LABELS[status] || status })
                  );
                })}
              />
            {getAllowedTransitions(profile.employee.status.toUpperCase()).length === 0 && (
              <p style={{ fontSize: 12, color: C.textMuted }}>
                {tr('لا توجد انتقالات متاحة من الحالة الحالية', 'No transitions available from current status')}
              </p>
            )}
            {newStatus && STATUS_DEFS[newStatus]?.description && (
              <p style={{ fontSize: 12, color: C.textMuted }}>{STATUS_DEFS[newStatus].description}</p>
            )}
          </div>

          {/* Reason */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} htmlFor="statusReason">{tr('السبب *', 'Reason *')}</CVisionLabel>
            <CVisionTextarea
              C={C}
              id="statusReason"
              placeholder={tr('سبب تغيير الحالة...', 'Reason for status change...')}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Effective Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} htmlFor="effectiveDate">{tr('تاريخ السريان', 'Effective Date')}</CVisionLabel>
            <CVisionInput
              C={C}
              id="effectiveDate"
              type="date"
              value={statusEffectiveDate}
              onChange={(e) => setStatusEffectiveDate(e.target.value)}
            />
          </div>

          {/* Last Working Day */}
          {newStatus && ['NOTICE_PERIOD', 'RESIGNED', 'TERMINATED', 'END_OF_CONTRACT', 'RETIRED'].includes(newStatus) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="lastWorkingDay">{tr('آخر يوم عمل', 'Last Working Day')}</CVisionLabel>
              <CVisionInput
                C={C}
                id="lastWorkingDay"
                type="date"
                value={lastWorkingDay}
                onChange={(e) => setLastWorkingDay(e.target.value)}
              />
            </div>
          )}

          {/* Impact Preview */}
          {renderImpactPreview()}

          {/* Recent History */}
          {statusHistory.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('السجل الأخير', 'Recent History')}</CVisionLabel>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, overflowY: 'auto' }}>
                {loadingHistory ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 16, paddingBottom: 16 }}>
                    <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {statusHistory.slice(0, 5).map((entry) => (
                      <div key={entry.id} style={{ fontSize: 13, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 500 }}>
                            {EMPLOYEE_STATUS_LABELS[entry.fromStatus] || entry.fromStatus || 'N/A'} → {EMPLOYEE_STATUS_LABELS[entry.toStatus] || entry.toStatus}
                          </span>
                          <span style={{ fontSize: 12, color: C.textMuted }}>
                            {new Date(entry.effectiveDate || entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {entry.reason && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{entry.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => onOpenChange(false)}>
            {tr('إلغاء', 'Cancel')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleStatusChange} disabled={!newStatus || !statusReason || changingStatus}>
            {changingStatus && <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
            {tr('تأكيد تغيير الحالة', 'Confirm Status Change')}
          </CVisionButton>
        </CVisionDialogFooter>
    </CVisionDialog>
  );
}
