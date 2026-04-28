'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionLabel, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionPageHeader, CVisionPageLayout, CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles } from '@/components/cvision/ui';
import { Plus, Eye, Calendar } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface PayrollRun {
  id: string;
  period: string;
  status: 'draft' | 'dry_run' | 'approved' | 'paid';
  totalsJson: {
    totalGross: number;
    totalNet: number;
    employeeCount: number;
  };
  createdAt: string;
}

export default function PayrollRunsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [period, setPeriod] = useState('');
  const router = useRouter();

  const { data: runsData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.payroll.runs.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/payroll/runs'),
  });
  const runs: PayrollRun[] = (runsData?.success && runsData?.runs) ? runsData.runs : [];

  const createMutation = useMutation({
    mutationFn: (body: { period: string }) => cvisionMutate('/api/cvision/payroll/runs', 'POST', body),
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(tr('تم انشاء دورة الرواتب', `Payroll run created for ${period}`));
        setCreateDialogOpen(false);
        setPeriod('');
        queryClient.invalidateQueries({ queryKey: cvisionKeys.payroll.runs.all });
      } else {
        toast.error(data.error || tr('فشل في انشاء دورة الرواتب', 'Failed to create payroll run'));
      }
    },
    onError: () => {
      toast.error(tr('فشل في انشاء دورة الرواتب', 'Failed to create payroll run'));
    },
  });
  const creating = createMutation.isPending;

  function handleCreateRun() {
    if (!period.match(/^\d{4}-\d{2}$/)) {
      toast.error(tr('الصيغة يجب ان تكون YYYY-MM', 'Period must be in YYYY-MM format (e.g., 2024-01)'));
      return;
    }
    createMutation.mutate({ period });
  }

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: tr('مسودة', 'Draft'),
      dry_run: tr('تشغيل تجريبي', 'Dry Run'),
      approved: tr('معتمد', 'Approved'),
      paid: tr('مدفوع', 'Paid'),
    };
    return map[s] || s;
  };

  const statusVariant = (s: string) => {
    if (s === 'approved') return 'success' as const;
    if (s === 'paid') return 'info' as const;
    if (s === 'dry_run') return 'warning' as const;
    return 'muted' as const;
  };

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={40} />
        <CVisionSkeletonCard C={C} height={300} />
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('دورات الرواتب', 'Payroll Runs')}
        titleEn={isRTL ? 'Payroll Runs' : undefined}
        subtitle={tr('ادارة دورات معالجة الرواتب', 'Manage payroll processing runs')}
        icon={Calendar}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={Plus} onClick={() => setCreateDialogOpen(true)}>
            {tr('دورة جديدة', 'New Run')}
          </CVisionButton>
        }
      />

      {runs.length === 0 ? (
        <CVisionEmptyState
          C={C}
          icon={Calendar}
          title={tr('لا توجد دورات رواتب', 'No payroll runs found')}
          action={
            <CVisionButton C={C} isDark={isDark} variant="primary" icon={Plus} onClick={() => setCreateDialogOpen(true)}>
              {tr('انشاء اول دورة', 'Create First Run')}
            </CVisionButton>
          }
        />
      ) : (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الدورات', 'Runs')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ padding: 0 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTr C={C}>
                  <CVisionTh C={C}>{tr('الفترة', 'Period')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الموظفين', 'Employees')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('اجمالي الراتب', 'Total Gross')}</CVisionTh>
                  <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('صافي الراتب', 'Total Net')}</CVisionTh>
                  <CVisionTh C={C}>{tr('اجراءات', 'Actions')}</CVisionTh>
                </CVisionTr>
              </CVisionTableHead>
              <CVisionTableBody>
                {runs.map((run) => (
                  <CVisionTr key={run.id} C={C}>
                    <CVisionTd C={C} style={{ fontWeight: 500 }}>{run.period}</CVisionTd>
                    <CVisionTd C={C}>
                      <CVisionBadge C={C} variant={statusVariant(run.status)}>{statusLabel(run.status)}</CVisionBadge>
                    </CVisionTd>
                    <CVisionTd C={C} style={{ textAlign: 'right' }}>{run.totalsJson?.employeeCount || 0}</CVisionTd>
                    <CVisionTd C={C} style={{ textAlign: 'right' }}>{run.totalsJson?.totalGross?.toLocaleString() || '0'}</CVisionTd>
                    <CVisionTd C={C} style={{ textAlign: 'right' }}>{run.totalsJson?.totalNet?.toLocaleString() || '0'}</CVisionTd>
                    <CVisionTd C={C}>
                      <Link href={`/cvision/payroll/runs/${run.id}`} style={{ textDecoration: 'none' }}>
                        <CVisionButton C={C} isDark={isDark} variant="outline" icon={Eye} />
                      </Link>
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Create Dialog */}
      <CVisionDialog C={C} open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} title={tr('انشاء دورة رواتب', 'Create Payroll Run')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CVisionInput
            C={C}
            label={tr('الفترة (YYYY-MM)', 'Period (YYYY-MM)')}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="2024-01"
          />
          <span style={{ fontSize: 11, color: C.textMuted }}>{tr('الصيغة: YYYY-MM (مثال: 2024-01)', 'Format: YYYY-MM (e.g., 2024-01)')}</span>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setCreateDialogOpen(false)}>
            {tr('الغاء', 'Cancel')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleCreateRun} disabled={creating}>
            {tr('انشاء', 'Create')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
