'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Play, CheckCircle, ArrowLeft, DollarSign, Users, Wallet, FileText } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface PayrollRun {
  id: string;
  period: string;
  status: 'draft' | 'dry_run' | 'approved' | 'paid';
  totalsJson: { totalGross: number; totalNet: number; employeeCount: number };
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

interface Payslip {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeNo?: string;
  gross: number;
  net: number;
  breakdownJson: {
    baseSalary: number;
    allowances: Record<string, number>;
    deductions: Record<string, number>;
    loanDeduction?: number;
  };
}

export default function PayrollRunDetailPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const params = useParams();
  const runId = params?.id as string;
  const [processing, setProcessing] = useState(false);

  const { data: runsData, isLoading: runLoading } = useQuery({
    queryKey: cvisionKeys.payroll.runs.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/payroll/runs'),
    enabled: !!runId,
  });
  const run: PayrollRun | null = (runsData?.success && runsData?.runs) ? runsData.runs.find((r: PayrollRun) => r.id === runId) || null : null;

  const { data: payslipsData, isLoading: payslipsLoading } = useQuery({
    queryKey: cvisionKeys.payroll.payslips.detail(runId),
    queryFn: () => cvisionFetch<any>(`/api/cvision/payroll/runs/${runId}/payslips`),
    enabled: !!runId,
  });
  const payslips: Payslip[] = (payslipsData?.success && payslipsData?.data) ? payslipsData.data : [];
  const loading = runLoading || payslipsLoading;

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: cvisionKeys.payroll.runs.all });
    queryClient.invalidateQueries({ queryKey: cvisionKeys.payroll.payslips.detail(runId) });
  }

  async function handleDryRun() {
    try {
      setProcessing(true);
      const data = await cvisionMutate<any>(`/api/cvision/payroll/runs/${runId}/dry-run`, 'POST');
      if (data.success) {
        toast.success(tr(`تم التشغيل التجريبي. تم انشاء ${data.payslipsGenerated || 0} كشوفات`, `Dry run completed. Generated ${data.payslipsGenerated || 0} payslips.`));
        invalidateAll();
      } else {
        toast.error(data.error || tr('فشل التشغيل التجريبي', 'Failed to run dry-run'));
      }
    } catch { toast.error(tr('فشل التشغيل التجريبي', 'Failed to run dry-run')); }
    finally { setProcessing(false); }
  }

  async function handleApprove() {
    try {
      setProcessing(true);
      const data = await cvisionMutate<any>(`/api/cvision/payroll/runs/${runId}/approve`, 'POST');
      if (data.success) {
        toast.success(tr('تم اعتماد دورة الرواتب', 'Payroll run approved successfully'));
        invalidateAll();
      } else {
        toast.error(data.error || tr('فشل الاعتماد', 'Failed to approve run'));
      }
    } catch { toast.error(tr('فشل الاعتماد', 'Failed to approve run')); }
    finally { setProcessing(false); }
  }

  async function handleMarkPaid() {
    try {
      setProcessing(true);
      const data = await cvisionMutate<any>(`/api/cvision/payroll/runs/${runId}/mark-paid`, 'POST');
      if (data.success) {
        toast.success(tr('تم تسجيل الدفع بنجاح', 'Payroll marked as paid successfully'));
        invalidateAll();
      } else {
        toast.error(data.error || tr('فشل تسجيل الدفع', 'Failed to mark as paid'));
      }
    } catch { toast.error(tr('فشل تسجيل الدفع', 'Failed to mark as paid')); }
    finally { setProcessing(false); }
  }

  // Normalize status to lowercase for consistent comparison (API returns UPPERCASE)
  const normalizedStatus = run?.status?.toLowerCase() || '';

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: tr('مسودة', 'Draft'), dry_run: tr('تشغيل تجريبي', 'Dry Run'), approved: tr('معتمد', 'Approved'), paid: tr('مدفوع', 'Paid') };
    return map[s.toLowerCase()] || s;
  };

  const statusVariant = (s: string) => {
    const sl = s.toLowerCase();
    if (sl === 'approved') return 'success' as const;
    if (sl === 'paid') return 'info' as const;
    if (sl === 'dry_run') return 'warning' as const;
    return 'muted' as const;
  };

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={40} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[1,2,3].map(i => <CVisionSkeletonCard key={i} C={C} height={100} />)}
        </div>
        <CVisionSkeletonCard C={C} height={300} />
      </CVisionPageLayout>
    );
  }

  if (!run) {
    return (
      <CVisionPageLayout>
        <CVisionEmptyState
          C={C}
          icon={FileText}
          title={tr('لم يتم العثور على دورة الرواتب', 'Payroll run not found')}
          action={
            <Link href="/cvision/payroll/runs" style={{ textDecoration: 'none' }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" icon={ArrowLeft}>
                {tr('العودة', 'Back to Runs')}
              </CVisionButton>
            </Link>
          }
        />
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={`${tr('دورة الرواتب', 'Payroll Run')}: ${run.period}`}
        titleEn={isRTL ? `Payroll Run: ${run.period}` : undefined}
        subtitle={tr('عرض وادارة تفاصيل دورة الرواتب', 'View and manage payroll run details')}
        icon={FileText}
        isRTL={isRTL}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/cvision/payroll/runs" style={{ textDecoration: 'none' }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" icon={ArrowLeft}>
                {tr('رجوع', 'Back')}
              </CVisionButton>
            </Link>
            {normalizedStatus === 'draft' && (
              <CVisionButton C={C} isDark={isDark} variant="primary" icon={Play} onClick={handleDryRun} disabled={processing}>
                {tr('تشغيل تجريبي', 'Dry Run')}
              </CVisionButton>
            )}
            {normalizedStatus === 'dry_run' && (
              <CVisionButton C={C} isDark={isDark} variant="primary" icon={CheckCircle} onClick={handleApprove} disabled={processing}>
                {tr('اعتماد', 'Approve')}
              </CVisionButton>
            )}
            {normalizedStatus === 'approved' && (
              <CVisionButton C={C} isDark={isDark} variant="primary" icon={DollarSign} onClick={handleMarkPaid} disabled={processing}>
                {tr('تسجيل الدفع', 'Mark as Paid')}
              </CVisionButton>
            )}
          </div>
        }
      />

      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('الحالة', 'Status')} value={statusLabel(run.status)} icon={FileText} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('اجمالي الراتب', 'Total Gross')} value={(run.totalsJson?.totalGross || 0).toLocaleString()} icon={DollarSign} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('صافي الراتب', 'Total Net')} value={(run.totalsJson?.totalNet || 0).toLocaleString()} icon={Wallet} color={C.purple} colorDim={C.purpleDim} />
      </CVisionStatsRow>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {tr('كشوفات الرواتب', 'Payslips')} ({payslips.length})
          </span>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          {payslips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.textMuted, fontSize: 13 }}>
              {tr('لم يتم انشاء كشوفات بعد. قم بتشغيل تجريبي لانشاء الكشوفات', 'No payslips generated yet. Run a dry-run to generate payslips.')}
            </div>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTr C={C}>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الراتب الاساسي', 'Base Salary')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('اجمالي', 'Gross')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الخصومات', 'Deductions')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الصافي', 'Net')}</CVisionTh>
                </CVisionTr>
              </CVisionTableHead>
              <CVisionTableBody>
                {payslips.map((payslip) => (
                  <CVisionTr key={payslip.id} C={C}>
                    <CVisionTd C={C}>
                      <div>
                        <span style={{ fontWeight: 500, color: C.text }}>{payslip.employeeName || payslip.employeeNo || payslip.employeeId}</span>
                        {payslip.employeeNo && (
                          <div style={{ fontSize: 11, color: C.textMuted }}>{payslip.employeeNo}</div>
                        )}
                      </div>
                    </CVisionTd>
                    <CVisionTd C={C} style={{ textAlign: 'right' }}>{payslip.breakdownJson?.baseSalary?.toLocaleString() || '0'}</CVisionTd>
                    <CVisionTd C={C} style={{ textAlign: 'right' }}>{payslip.gross.toLocaleString()}</CVisionTd>
                    <CVisionTd C={C} style={{ textAlign: 'right', color: C.red }}>
                      {Object.values(payslip.breakdownJson?.deductions || {}).reduce((sum, val) => sum + (val || 0), 0).toLocaleString()}
                    </CVisionTd>
                    <CVisionTd C={C} style={{ textAlign: 'right', fontWeight: 700 }}>{payslip.net.toLocaleString()}</CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
