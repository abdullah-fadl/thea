'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import {
  FileText, DollarSign, CreditCard, Calendar, Users, Wallet,
  TrendingUp, ArrowRight, RefreshCcw, Calculator,
} from 'lucide-react';

interface PayrollStats {
  totalProfiles: number;
  activeLoans: number;
  pendingLoans: number;
  currentMonthPayslips: number;
  totalSalaries: number;
  lastRunDate?: string;
}

export default function PayrollPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const now = useMemo(() => new Date(), []);

  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: cvisionKeys.payroll.profiles.list({ limit: 1000 }),
    queryFn: () => cvisionFetch('/api/cvision/payroll/profiles', { params: { limit: 1000 } }),
  });

  const { data: loansData, isLoading: loansLoading } = useQuery({
    queryKey: cvisionKeys.payroll.loans.list({ limit: 1000 }),
    queryFn: () => cvisionFetch('/api/cvision/payroll/loans', { params: { limit: 1000 } }),
  });

  const { data: payslipsData, isLoading: payslipsLoading } = useQuery({
    queryKey: cvisionKeys.payroll.payslips.list({ month: now.getMonth() + 1, year: now.getFullYear(), limit: 1 }),
    queryFn: () => cvisionFetch('/api/cvision/payroll/payslips', { params: { month: now.getMonth() + 1, year: now.getFullYear(), limit: 1 } }),
  });

  const loading = profilesLoading || loansLoading || payslipsLoading;

  const stats = useMemo(() => {
    const loans = loansData?.loans || loansData?.data?.items || loansData?.data || [];
    const activeLoans = loans.filter((l: any) => l.status === 'active');
    const pendingLoans = loans.filter((l: any) => l.status === 'pending');
    const profiles = profilesData?.profiles || profilesData?.data?.items || profilesData?.data || [];
    return {
      totalProfiles: profilesData?.total || profiles.length || 0,
      activeLoans: activeLoans.length,
      pendingLoans: pendingLoans.length,
      currentMonthPayslips: payslipsData?.total || 0,
      totalSalaries: profiles.reduce((sum: number, p: any) => sum + (p.baseSalary || 0), 0),
    };
  }, [profilesData, loansData, payslipsData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(amount);
  };

  const modules = [
    { title: tr('دورات الرواتب', 'Payroll Runs'), description: tr('إنشاء وإدارة دورات الرواتب الشهرية', 'Create and manage monthly payroll runs'), icon: Calendar, href: '/cvision/payroll/runs', color: C.blue, colorDim: C.blueDim, active: true },
    { title: tr('ملفات الرواتب', 'Payroll Profiles'), description: tr('إدارة ملفات رواتب الموظفين والبدلات', 'Manage employee salary profiles and allowances'), icon: DollarSign, href: '/cvision/payroll/profiles', color: C.green, colorDim: C.greenDim, active: true, stat: stats.totalProfiles > 0 ? `${stats.totalProfiles} ${tr('ملفات', 'profiles')}` : undefined },
    { title: tr('كشوفات الرواتب', 'Payslips'), description: tr('عرض وتحميل كشوفات رواتب الموظفين', 'View and download employee payslips'), icon: FileText, href: '/cvision/payroll/payslips', color: C.purple, colorDim: C.purpleDim, active: true, stat: stats.currentMonthPayslips > 0 ? `${stats.currentMonthPayslips} ${tr('كشوفات', 'payslips')}` : undefined },
    { title: tr('القروض', 'Loans'), description: tr('إدارة قروض وسلف الموظفين', 'Manage employee loans and advances'), icon: CreditCard, href: '/cvision/payroll/loans', color: C.orange, colorDim: C.orangeDim, active: true, stat: stats.activeLoans > 0 ? `${stats.activeLoans} ${tr('نشط', 'active')}` : undefined },
    { title: tr('نهاية الخدمة', 'End of Service'), description: tr('حساب مكافأة نهاية الخدمة حسب نظام العمل السعودي', 'Calculate end of service benefits per Saudi Labor Law'), icon: Calculator, href: '/cvision/payroll/end-of-service', color: C.green, colorDim: C.greenDim, active: true },
    { title: tr('الرواتب المتقدمة', 'Advanced Payroll'), description: tr('التشغيل التجريبي، مقارنات الأشهر، التقارير', 'Dry runs, month comparisons, payslips, cost reports & accounting'), icon: TrendingUp, href: '/cvision/payroll/advanced', color: C.purple, colorDim: C.purpleDim, active: true },
  ];

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={40} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={100} />)}
        </div>
      </CVisionPageLayout>
    );
  }

  const workflowSteps = [
    { label: tr('إعداد الملفات', 'Setup Profiles'), color: C.blue },
    { label: tr('تسجيل الحضور', 'Record Attendance'), color: C.green },
    { label: tr('تشغيل تجريبي', 'Dry Run'), color: C.orange },
    { label: tr('الموافقة والتأكيد', 'Approve & Finalize'), color: C.purple },
    { label: tr('إنشاء الكشوفات', 'Generate Payslips'), color: C.orange },
    { label: tr('قيد محاسبي', 'Journal Entry'), color: C.blue },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('إدارة الرواتب', 'Payroll Management')}
        titleEn={isRTL ? 'Payroll Management' : undefined}
        subtitle={tr('إدارة شاملة للرواتب والبدلات والخصومات', 'Comprehensive management of salaries, allowances, and deductions')}
        icon={DollarSign}
        isRTL={isRTL}
      />

      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('ملفات الرواتب', 'Payroll Profiles')} value={stats.totalProfiles} icon={Users} color={C.text} colorDim={C.bgSubtle} />
        <CVisionMiniStat C={C} label={tr('القروض النشطة', 'Active Loans')} value={stats.activeLoans} icon={CreditCard} color={C.orange} colorDim={C.orangeDim} />
        <CVisionMiniStat C={C} label={tr('كشوفات الشهر', 'Monthly Payslips')} value={stats.currentMonthPayslips} icon={FileText} color={C.purple} colorDim={C.purpleDim} />
        <CVisionMiniStat C={C} label={tr('إجمالي الرواتب', 'Total Salaries')} value={formatCurrency(stats.totalSalaries)} icon={Wallet} color={C.green} colorDim={C.greenDim} />
      </CVisionStatsRow>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {modules.map((mod) => (
          <CVisionCard key={mod.href} C={C} hover style={{ opacity: mod.active ? 1 : 0.5 }}>
            <CVisionCardBody style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: mod.colorDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <mod.icon size={20} color={mod.color} strokeWidth={1.6} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{mod.title}</span>
                </div>
                {mod.stat && <CVisionBadge C={C} variant="muted">{mod.stat}</CVisionBadge>}
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 14 }}>{mod.description}</div>
              <Link href={mod.href} style={{ textDecoration: 'none' }}>
                <CVisionButton C={C} isDark={isDark} variant={mod.active ? 'primary' : 'outline'} style={{ width: '100%' }}>
                  {mod.active ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {tr('عرض', 'View')} <ArrowRight size={14} />
                    </span>
                  ) : tr('قريبا', 'Coming Soon')}
                </CVisionButton>
              </Link>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color={C.text} strokeWidth={1.6} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مسار عملية الرواتب', 'Payroll Workflow')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, fontSize: 13 }}>
            {workflowSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <ArrowRight size={14} color={C.textMuted} />}
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: step.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{i + 1}</div>
                <span style={{ color: C.text }}>{step.label}</span>
              </div>
            ))}
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
