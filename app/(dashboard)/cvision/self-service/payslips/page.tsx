'use client';
import { useQuery } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardBody,
  CVisionPageHeader, CVisionPageLayout,
  CVisionSkeletonCard, CVisionSkeletonStyles,
  CVisionEmptyState, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { CreditCard, FileText } from 'lucide-react';

export default function PayslipsPage() {
  const { C } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.selfService.list({ action: 'my-payslips' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/self-service', { params: { action: 'my-payslips' } }),
  });
  const payslips = rawData?.ok ? (rawData.data || []) : [];

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('كشوفات الرواتب', 'My Payslips')}
        titleEn={isRTL ? 'My Payslips' : undefined}
        icon={CreditCard}
        isRTL={isRTL}
      />

      {payslips.length === 0 ? (
        <CVisionEmptyState C={C} icon={FileText} title={tr('لا توجد كشوفات رواتب', 'No payslips found.')} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {payslips.map((p: any, i: number) => (
            <CVisionCard key={i} C={C} hover>
              <CVisionCardBody style={{ padding: 18 }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>
                  {p.month || new Date(p.createdAt).toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: -0.5 }}>
                  {(p.netSalary || p.totalSalary || 0).toLocaleString()} {tr('ر.س', 'SAR')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 10 }}>
                  {[
                    { label: tr('الاساسي', 'Basic'), value: p.basicSalary },
                    { label: tr('السكن', 'Housing'), value: p.housingAllowance },
                    { label: tr('النقل', 'Transport'), value: p.transportAllowance },
                    { label: tr('الخصومات', 'Deductions'), value: p.deductions },
                  ].map((item, j) => (
                    <span key={j} style={{ fontSize: 11, color: C.textMuted }}>
                      {item.label}: {(item.value || 0).toLocaleString()}
                    </span>
                  ))}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}
    </CVisionPageLayout>
  );
}
