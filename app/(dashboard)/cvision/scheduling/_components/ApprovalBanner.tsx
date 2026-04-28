'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  FileCheck,
  RotateCcw,
  Lock,
  Send,
} from 'lucide-react';

import type {
  ApprovalStatus,
  UnitOption,
  PendingApproval,
  CurrentApprovalRecord,
} from './types';

// ─── Props ──────────────────────────────────────────────────────

interface ApprovalBannerProps {
  approvalStatus: ApprovalStatus;
  currentApproval: CurrentApprovalRecord | null;
  selectedUnit: string;
  availableUnits: UnitOption[];
  days: Date[];
  canManageApprovals: boolean;
  pendingApprovals: PendingApproval[];
  // Callbacks
  handleSubmitForApproval: () => void;
  handleApprove: (approvalId: string) => void;
  onReject: (approvalId: string) => void;
}

// ─── Component ──────────────────────────────────────────────────

export function ApprovalBanner({
  approvalStatus,
  currentApproval,
  selectedUnit,
  availableUnits,
  days,
  canManageApprovals,
  pendingApprovals,
  handleSubmitForApproval,
  handleApprove,
  onReject,
}: ApprovalBannerProps) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <>
      {/* ── Approval Status Banner ────────────────────────── */}
      {selectedUnit && selectedUnit !== 'all' && (
        <CVisionCard C={C} className={`border-l-4 ${
          approvalStatus === 'DRAFT' ? 'border-l-slate-400' :
          approvalStatus === 'PENDING_APPROVAL' ? 'border-l-amber-400' :
          approvalStatus === 'APPROVED' ? 'border-l-green-500' :
          approvalStatus === 'REJECTED' ? 'border-l-red-500' :
          approvalStatus === 'PUBLISHED' ? 'border-l-blue-500' :
          'border-l-slate-400'
        }`}>
          <CVisionCardBody style={{ padding: 16 }}>
            {/* --- DRAFT --- */}
            {approvalStatus === 'DRAFT' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%' }}>
                    <Calendar style={{ height: 20, width: 20 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{tr('حالة الجدول:', 'Schedule Status:')}</span>
                      <CVisionBadge C={C} variant="outline" className="font-normal">{tr('مسودة', 'DRAFT')}</CVisionBadge>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted }}>
                      {availableUnits.find(u => u.id === selectedUnit)?.name || tr('الوحدة', 'Unit')}
                      {days.length > 0 && ` \u2022 ${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${days[days.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </p>
                  </div>
                </div>
                <CVisionButton C={C} isDark={isDark} size="sm" onClick={handleSubmitForApproval}>
                  <Send style={{ height: 16, width: 16, marginRight: 4 }} />
                  {tr('ارسال للموافقة', 'Submit for Approval')}
                </CVisionButton>
              </div>
            )}

            {/* --- PENDING_APPROVAL --- */}
            {approvalStatus === 'PENDING_APPROVAL' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: C.orangeDim }}>
                    <Clock style={{ height: 20, width: 20, color: C.orange }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.orange, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{tr('حالة الجدول:', 'Schedule Status:')}</span>
                      <CVisionBadge C={C} style={{ background: C.orangeDim }}>{tr('بانتظار الموافقة', 'PENDING APPROVAL')}</CVisionBadge>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted }}>
                      {tr('تم الارسال', 'Submitted')} {currentApproval?.submittedAt ? new Date(currentApproval.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      {currentApproval?.submittedByName && ` ${tr('بواسطة', 'by')} ${currentApproval.submittedByName}`}
                      {` \u2022 ${tr('بانتظار: مدير التمريض', 'Waiting for: Nursing Manager')}`}
                    </p>
                  </div>
                </div>
                {canManageApprovals && currentApproval && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="outline"
                      style={{ color: C.green }}
                      onClick={() => handleApprove(currentApproval.id)}>
                      <CheckCircle style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('موافقة', 'Approve')}
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark} size="sm" variant="outline"
                      style={{ color: C.red }}
                      onClick={() => onReject(currentApproval.id)}>
                      <XCircle style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('رفض', 'Reject')}
                    </CVisionButton>
                  </div>
                )}
              </div>
            )}

            {/* --- APPROVED --- */}
            {approvalStatus === 'APPROVED' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: C.greenDim }}>
                    <CheckCircle style={{ height: 20, width: 20, color: C.green }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.green, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{tr('حالة الجدول:', 'Schedule Status:')}</span>
                      <CVisionBadge C={C} style={{ background: C.greenDim }}>{tr('تمت الموافقة', 'APPROVED')}</CVisionBadge>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted }}>
                      {tr('تمت الموافقة', 'Approved')} {currentApproval?.approvedAt ? new Date(currentApproval.approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                      {currentApproval?.approvedByName && ` ${tr('بواسطة', 'by')} ${currentApproval.approvedByName}`}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.green, background: C.greenDim, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 8 }}>
                  <Lock style={{ height: 16, width: 16 }} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{tr('مقفل - لا يمكن التعديل', 'Locked - Cannot be edited')}</span>
                </div>
              </div>
            )}

            {/* --- REJECTED --- */}
            {approvalStatus === 'REJECTED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: C.redDim }}>
                      <XCircle style={{ height: 20, width: 20, color: C.red }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.red, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{tr('حالة الجدول:', 'Schedule Status:')}</span>
                        <CVisionBadge C={C} style={{ background: C.redDim }}>{tr('مرفوض', 'REJECTED')}</CVisionBadge>
                      </div>
                      <p style={{ fontSize: 12, color: C.textMuted }}>
                        {tr('تم الرفض', 'Rejected')} {currentApproval?.rejectedAt ? new Date(currentApproval.rejectedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        {currentApproval?.rejectedByName && ` ${tr('بواسطة', 'by')} ${currentApproval.rejectedByName}`}
                      </p>
                    </div>
                  </div>
                  <CVisionButton C={C} isDark={isDark} size="sm" onClick={handleSubmitForApproval}>
                    <RotateCcw style={{ height: 16, width: 16, marginRight: 4 }} />
                    {tr('تعديل واعادة الارسال', 'Edit & Resubmit')}
                  </CVisionButton>
                </div>
                {currentApproval?.rejectionReason && (
                  <div style={{ borderRadius: 8, background: C.redDim, border: `1px solid ${C.border}`, padding: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: C.red, marginBottom: 2 }}>{tr('سبب الرفض:', 'Rejection Reason:')}</p>
                    <p style={{ fontSize: 13, color: C.red }}>{currentApproval.rejectionReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* --- PUBLISHED --- */}
            {approvalStatus === 'PUBLISHED' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: '50%', background: C.blueDim }}>
                    <FileCheck style={{ height: 20, width: 20, color: C.blue }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.blue, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{tr('حالة الجدول:', 'Schedule Status:')}</span>
                      <CVisionBadge C={C} style={{ background: C.blueDim }}>{tr('منشور', 'PUBLISHED')}</CVisionBadge>
                    </div>
                    <p style={{ fontSize: 12, color: C.textMuted }}>
                      {tr('تم النشر', 'Published')} {currentApproval?.publishedAt ? new Date(currentApproval.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.blue, background: C.blueDim, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, borderRadius: 8 }}>
                  <Lock style={{ height: 16, width: 16 }} />
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{tr('مقفل - منشور', 'Locked - Published')}</span>
                </div>
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* ── Pending Approvals (Nursing Manager) ──────────── */}
      {pendingApprovals.length > 0 && (
        <CVisionCard C={C} className="border-amber-200">
          <CVisionCardHeader C={C} style={{ padding: 16, paddingBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileCheck style={{ height: 20, width: 20, color: C.orange }} />
              {tr('موافقات معلقة', 'Pending Approvals')}
              <CVisionBadge C={C} variant="secondary" style={{ background: C.orangeDim, color: C.orange }}>
                {pendingApprovals.length}
              </CVisionBadge>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ padding: 16, paddingTop: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingApprovals.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: `1px solid ${C.border}`, background: C.orangeDim, padding: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{a.unitName || tr('جدول', 'Schedule')}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>
                    {tr('ارسل بواسطة', 'Submitted by')} {a.submittedByName || tr('غير معروف', 'Unknown')}
                    {a.startDate && ` \u2022 ${new Date(a.startDate).toLocaleDateString()} - ${new Date(a.endDate!).toLocaleDateString()}`}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline"
                    style={{ color: C.green }}
                    onClick={() => handleApprove(a.id)}>
                    <CheckCircle style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('موافقة', 'Approve')}
                  </CVisionButton>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline"
                    style={{ color: C.red }}
                    onClick={() => onReject(a.id)}>
                    <XCircle style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('رفض', 'Reject')}
                  </CVisionButton>
                </div>
              </div>
            ))}
          </CVisionCardBody>
        </CVisionCard>
      )}
    </>
  );
}
