'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionSelect, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat, CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles } from '@/components/cvision/ui';
import {
  Search, Eye, RefreshCcw, Receipt, Users, Wallet, TrendingDown,
  DollarSign, Printer, Building2, Clock, ShieldAlert, Briefcase, CreditCard, FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface Payslip {
  id: string; employeeId: string; employeeName?: string; employeeNo?: string;
  departmentId?: string; departmentName?: string; runId?: string;
  gross: number; net: number; baseSalary?: number; totalAllowances?: number;
  totalDeductions?: number; netSalary?: number; grossSalary?: number;
  status?: string; month?: number; year?: number;
  breakdownJson?: {
    baseSalary?: number; allowances?: Record<string, number>;
    deductions?: Record<string, number>; loanDeduction?: number;
    totalAllowances?: number; totalDeductions?: number;
    overtime?: number; gross?: number; net?: number; employerCost?: number;
  };
  fullCalculation?: {
    earnings?: Record<string, number>;
    deductions?: {
      gosi?: Record<string, number>;
      attendance?: Record<string, number>;
      leaves?: Record<string, number>;
      violations?: Record<string, number>;
      loans?: Record<string, number>;
      totalDeductions?: number;
      [key: string]: unknown;
    };
    employerCost?: Record<string, number>;
    metadata?: { warnings?: string[]; [key: string]: unknown };
    [key: string]: unknown;
  };
  createdAt: string;
}

interface Department { id: string; name: string; code?: string; }

const MONTHS = [
  { value: '1', label: 'January', ar: 'يناير' }, { value: '2', label: 'February', ar: 'فبراير' },
  { value: '3', label: 'March', ar: 'مارس' }, { value: '4', label: 'April', ar: 'ابريل' },
  { value: '5', label: 'May', ar: 'مايو' }, { value: '6', label: 'June', ar: 'يونيو' },
  { value: '7', label: 'July', ar: 'يوليو' }, { value: '8', label: 'August', ar: 'اغسطس' },
  { value: '9', label: 'September', ar: 'سبتمبر' }, { value: '10', label: 'October', ar: 'اكتوبر' },
  { value: '11', label: 'November', ar: 'نوفمبر' }, { value: '12', label: 'December', ar: 'ديسمبر' },
];

export default function PayslipsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  const { data: deptsData } = useQuery({
    queryKey: cvisionKeys.departments.list(),
    queryFn: () => cvisionFetch<Record<string, unknown>>('/api/cvision/org/departments'),
  });
  const departments: Department[] = (deptsData as any)?.items || (deptsData as any)?.data?.items || (deptsData as any)?.data || [];

  const payslipFilters = useMemo(() => ({
    month: selectedMonth, year: selectedYear, limit: 200,
    ...(selectedStatus !== 'all' ? { status: selectedStatus } : {}),
    ...(searchTerm ? { search: searchTerm } : {}),
    ...(selectedDepartment !== 'all' ? { departmentId: selectedDepartment } : {}),
  }), [selectedMonth, selectedYear, selectedStatus, searchTerm, selectedDepartment]);

  const { data: payslipsRaw, isLoading: loading, refetch: fetchPayslips } = useQuery({
    queryKey: cvisionKeys.payroll.payslips.list(payslipFilters),
    queryFn: () => cvisionFetch<Record<string, unknown>>('/api/cvision/payroll/payslips', { params: payslipFilters }),
  });

  const payslips: Payslip[] = (payslipsRaw as any)?.data?.items || (payslipsRaw as any)?.data || [];
  const stats = useMemo(() => ({
    employeeCount: payslips.length,
    totalGross: payslips.reduce((sum, p) => sum + (p.gross || p.grossSalary || 0), 0),
    totalDeductions: payslips.reduce((sum, p) => sum + (p.breakdownJson?.totalDeductions || p.totalDeductions || 0), 0),
    totalNet: payslips.reduce((sum, p) => sum + (p.net || p.netSalary || 0), 0),
  }), [payslips]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(amount);

  const getMonthLabel = (m: string) => {
    const found = MONTHS.find(mo => mo.value === m);
    return found ? (isRTL ? found.ar : found.label) : '';
  };

  const getBaseSalary = (p: Payslip) => p.breakdownJson?.baseSalary || p.baseSalary || 0;
  const getTotalAllowances = (p: Payslip) => p.breakdownJson?.totalAllowances || p.totalAllowances || 0;
  const getTotalDeductions = (p: Payslip) => p.breakdownJson?.totalDeductions || p.totalDeductions || 0;
  const getNet = (p: Payslip) => p.net || p.netSalary || p.breakdownJson?.net || 0;
  const getGross = (p: Payslip) => p.gross || p.grossSalary || p.breakdownJson?.gross || 0;

  const statusVariant = (s?: string) => {
    if (s === 'approved') return 'info' as const;
    if (s === 'paid') return 'success' as const;
    return 'muted' as const;
  };

  const statusLabel = (s?: string) => {
    if (s === 'draft' || s === 'dry_run') return tr('مسودة', 'Draft');
    if (s === 'approved') return tr('معتمد', 'Approved');
    if (s === 'paid') return tr('مدفوع', 'Paid');
    return s || tr('غير محدد', 'N/A');
  };

  const getDetailedEarnings = (p: Payslip) => {
    const fc = p.fullCalculation;
    if (fc?.earnings) return {
      basicSalary: fc.earnings.basicSalary || 0, housing: fc.earnings.housingAllowance || 0,
      transport: fc.earnings.transportAllowance || 0, food: fc.earnings.foodAllowance || 0,
      phone: fc.earnings.phoneAllowance || 0, other: fc.earnings.otherAllowances || 0,
      overtime: fc.earnings.overtimePay || 0, total: fc.earnings.totalEarnings || 0,
    };
    const allowances = p.breakdownJson?.allowances || {};
    return {
      basicSalary: getBaseSalary(p),
      housing: allowances.housing || allowances.housingAllowance || 0,
      transport: allowances.transport || allowances.transportAllowance || 0,
      food: allowances.food || allowances.foodAllowance || 0,
      phone: allowances.phone || allowances.phoneAllowance || 0,
      other: allowances.other || 0, overtime: p.breakdownJson?.overtime || 0, total: getGross(p),
    };
  };

  const getDetailedDeductions = (p: Payslip) => {
    const fc = p.fullCalculation;
    if (fc?.deductions) return {
      gosi: fc.deductions.gosi?.employeeContribution || 0,
      attendance: fc.deductions.attendance?.totalAttendanceDeduction || 0,
      lateDeduction: fc.deductions.attendance?.lateDeduction || 0,
      absentDeduction: fc.deductions.attendance?.absentDeduction || 0,
      leaves: fc.deductions.leaves?.totalLeaveDeduction || 0,
      unpaidLeave: fc.deductions.leaves?.unpaidLeaveDeduction || 0,
      sickLeave: fc.deductions.leaves?.sickLeaveDeduction || 0,
      violations: fc.deductions.violations?.totalViolationDeduction || 0,
      violationCount: fc.deductions.violations?.count || 0,
      loans: fc.deductions.loans?.totalLoanDeduction || 0,
      total: fc.deductions.totalDeductions || 0,
    };
    const bd = p.breakdownJson?.deductions || {};
    return {
      gosi: bd.gosi || 0, attendance: bd.attendance || 0,
      lateDeduction: 0, absentDeduction: 0, leaves: bd.leaves || 0,
      unpaidLeave: 0, sickLeave: 0, violations: bd.violations || 0,
      violationCount: 0, loans: bd.loans || bd.loanDeduction || p.breakdownJson?.loanDeduction || 0,
      total: getTotalDeductions(p),
    };
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(y => ({ value: String(y), label: String(y) }));

  if (loading && payslips.length === 0) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={40} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={100} />)}
        </div>
        <CVisionSkeletonCard C={C} height={300} />
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('كشوفات الرواتب', 'Payslips')}
        titleEn={isRTL ? 'Payslips' : undefined}
        subtitle={tr('عرض وادارة كشوفات رواتب الموظفين', 'View and manage employee payslips')}
        icon={Receipt}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="outline" icon={RefreshCcw} onClick={() => fetchPayslips()}  >
            {tr('تحديث', 'Refresh')}
          </CVisionButton>
        }
      />

      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('الموظفين', 'Employees')} value={stats.employeeCount} icon={Users} color={C.text} colorDim={C.bgSubtle} />
        <CVisionMiniStat C={C} label={tr('اجمالي الراتب', 'Total Gross')} value={formatCurrency(stats.totalGross)} icon={DollarSign} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('اجمالي الخصومات', 'Total Deductions')} value={formatCurrency(stats.totalDeductions)} icon={TrendingDown} color={C.red} colorDim={C.redDim} />
        <CVisionMiniStat C={C} label={tr('صافي التحويل', 'Net Transfer')} value={formatCurrency(stats.totalNet)} icon={Wallet} color={C.green} colorDim={C.greenDim} />
      </CVisionStatsRow>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('التصفية', 'Filters')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ flex: '1 1 200px' }}>
              <CVisionInput C={C} placeholder={tr('بحث بالاسم...', 'Search by employee name...')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div style={{ width: 150 }}>
              <CVisionSelect C={C} value={selectedMonth} onChange={setSelectedMonth}
                options={MONTHS.map(m => ({ value: m.value, label: isRTL ? m.ar : m.label }))} />
            </div>
            <div style={{ width: 120 }}>
              <CVisionSelect C={C} value={selectedYear} onChange={setSelectedYear} options={yearOptions} />
            </div>
            <div style={{ width: 180 }}>
              <CVisionSelect C={C} value={selectedDepartment} onChange={setSelectedDepartment}
                options={[{ value: 'all', label: tr('كل الاقسام', 'All Departments') }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
            </div>
            <div style={{ width: 150 }}>
              <CVisionSelect C={C} value={selectedStatus} onChange={setSelectedStatus}
                options={[
                  { value: 'all', label: tr('كل الحالات', 'All Statuses') },
                  { value: 'draft', label: tr('مسودة', 'Draft') },
                  { value: 'approved', label: tr('معتمد', 'Approved') },
                  { value: 'paid', label: tr('مدفوع', 'Paid') },
                ]} />
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {tr('كشوفات الرواتب', 'Payslips')}
            <span style={{ fontWeight: 400, color: C.textMuted, marginInlineStart: 8 }}>
              {getMonthLabel(selectedMonth)} {selectedYear} — {payslips.length} {tr('كشف', 'payslips')}
            </span>
          </span>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          {payslips.length === 0 ? (
            <CVisionEmptyState C={C} icon={Receipt} title={tr('لا توجد كشوفات رواتب', 'No payslips found')} subtitle={tr('قم بتشغيل دورة رواتب لانشاء كشوفات لهذه الفترة', 'Run a Payroll Run to generate payslips for this period')} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                  <CVisionTr C={C}>
                    <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                    <CVisionTh C={C}>{tr('رقم الموظف', 'Employee No.')}</CVisionTh>
                    <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الراتب الاساسي', 'Base Salary')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('البدلات', 'Allowances')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الخصومات', 'Deductions')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('صافي الراتب', 'Net Salary')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'center' }}>{tr('الحالة', 'Status')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'center' }}>{tr('اجراءات', 'Actions')}</CVisionTh>
                  </CVisionTr>
                </CVisionTableHead>
                <CVisionTableBody>
                  {payslips.map((payslip) => (
                    <CVisionTr key={payslip.id} C={C}>
                      <CVisionTd C={C} style={{ fontWeight: 500 }}>{payslip.employeeName || tr('غير معروف', 'Unknown')}</CVisionTd>
                      <CVisionTd C={C} style={{ color: C.textMuted }}>{payslip.employeeNo || '-'}</CVisionTd>
                      <CVisionTd C={C} style={{ color: C.textMuted }}>{payslip.departmentName || '-'}</CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'right' }}>{formatCurrency(getBaseSalary(payslip))}</CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'right', color: C.green }}>+{formatCurrency(getTotalAllowances(payslip))}</CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'right', color: C.red }}>-{formatCurrency(getTotalDeductions(payslip))}</CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(getNet(payslip))}</CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'center' }}>
                        <CVisionBadge C={C} variant={statusVariant(payslip.status)}>{statusLabel(payslip.status)}</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'center' }}>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" icon={Eye} onClick={() => { setSelectedPayslip(payslip); setViewDialogOpen(true); }} />
                      </CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* View Payslip Dialog */}
      <CVisionDialog C={C} open={viewDialogOpen} onClose={() => setViewDialogOpen(false)}
        title={tr('تفاصيل كشف الراتب', 'Payslip Details')}
        maxWidth={720}>
        {selectedPayslip && (() => {
          const earnings = getDetailedEarnings(selectedPayslip);
          const deductions = getDetailedDeductions(selectedPayslip);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Employee Info */}
              <div style={{ background: C.bgSubtle, borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, fontSize: 13 }}>
                  <div><span style={{ color: C.textMuted, display: 'block', fontSize: 11 }}>{tr('الموظف', 'Employee')}</span><span style={{ fontWeight: 500, color: C.text }}>{selectedPayslip.employeeName}</span></div>
                  <div><span style={{ color: C.textMuted, display: 'block', fontSize: 11 }}>{tr('رقم الموظف', 'Employee No.')}</span><span style={{ fontWeight: 500, color: C.text }}>{selectedPayslip.employeeNo || '-'}</span></div>
                  <div><span style={{ color: C.textMuted, display: 'block', fontSize: 11 }}>{tr('القسم', 'Department')}</span><span style={{ fontWeight: 500, color: C.text }}>{selectedPayslip.departmentName || '-'}</span></div>
                  <div><span style={{ color: C.textMuted, display: 'block', fontSize: 11 }}>{tr('الفترة', 'Period')}</span><span style={{ fontWeight: 500, color: C.text }}>{getMonthLabel(String(selectedPayslip.month || selectedMonth))} {selectedPayslip.year || selectedYear}</span></div>
                </div>
              </div>

              {/* Earnings */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: C.green, fontWeight: 600, fontSize: 14 }}>
                  <DollarSign size={16} /> {tr('الارباح', 'Earnings')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.text }}>{tr('الراتب الاساسي', 'Basic Salary')}</span><span style={{ fontWeight: 500, color: C.text }}>{formatCurrency(earnings.basicSalary)}</span></div>
                  {earnings.housing > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted, paddingInlineStart: 16 }}>{tr('بدل السكن', 'Housing Allowance')}</span><span style={{ color: C.textMuted }}>{formatCurrency(earnings.housing)}</span></div>}
                  {earnings.transport > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted, paddingInlineStart: 16 }}>{tr('بدل النقل', 'Transport Allowance')}</span><span style={{ color: C.textMuted }}>{formatCurrency(earnings.transport)}</span></div>}
                  {earnings.food > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted, paddingInlineStart: 16 }}>{tr('بدل الطعام', 'Food Allowance')}</span><span style={{ color: C.textMuted }}>{formatCurrency(earnings.food)}</span></div>}
                  {earnings.phone > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted, paddingInlineStart: 16 }}>{tr('بدل الهاتف', 'Phone Allowance')}</span><span style={{ color: C.textMuted }}>{formatCurrency(earnings.phone)}</span></div>}
                  {earnings.other > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted, paddingInlineStart: 16 }}>{tr('بدلات اخرى', 'Other Allowances')}</span><span style={{ color: C.textMuted }}>{formatCurrency(earnings.other)}</span></div>}
                  {earnings.overtime > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.blue, paddingInlineStart: 16, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} />{tr('بدل اضافي', 'Overtime Pay')}</span><span style={{ color: C.blue }}>{formatCurrency(earnings.overtime)}</span></div>}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: C.green }}>
                    <span>{tr('اجمالي الارباح', 'Total Earnings')}</span><span>{formatCurrency(earnings.total)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: C.red, fontWeight: 600, fontSize: 14 }}>
                  <TrendingDown size={16} /> {tr('الخصومات', 'Deductions')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  {deductions.gosi > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={12} color={C.textMuted} />{tr('التأمينات الاجتماعية (9.75%)', 'GOSI (Social Insurance 9.75%)')}</span><span style={{ color: C.red }}>{formatCurrency(deductions.gosi)}</span></div>}
                  {deductions.attendance > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} color={C.textMuted} />{tr('خصم الحضور', 'Attendance Deduction')}</span><span style={{ color: C.red }}>{formatCurrency(deductions.attendance)}</span></div>}
                  {deductions.leaves > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={12} color={C.textMuted} />{tr('خصم الاجازات', 'Leave Deduction')}</span><span style={{ color: C.red }}>{formatCurrency(deductions.leaves)}</span></div>}
                  {deductions.violations > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}><ShieldAlert size={12} color={C.textMuted} />{tr('المخالفات', 'Violations')} ({deductions.violationCount})</span><span style={{ color: C.red }}>{formatCurrency(deductions.violations)}</span></div>}
                  {deductions.loans > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={12} color={C.textMuted} />{tr('قسط القرض', 'Loan Installment')}</span><span style={{ color: C.red }}>{formatCurrency(deductions.loans)}</span></div>}
                  <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: C.red }}>
                    <span>{tr('اجمالي الخصومات', 'Total Deductions')}</span><span>{formatCurrency(deductions.total)}</span>
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div style={{ background: C.blueDim, borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{tr('صافي الراتب', 'Net Salary')}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: C.blue }}>{formatCurrency(getNet(selectedPayslip))}</span>
              </div>

              {/* Employer Cost */}
              {selectedPayslip.fullCalculation?.employerCost && (
                <div style={{ background: C.bgSubtle, borderRadius: 10, padding: 12, fontSize: 13, color: C.textMuted }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{tr('تكلفة صاحب العمل الكلية', 'Total Employer Cost')}</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(selectedPayslip.fullCalculation.employerCost.totalCost)}</span>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {selectedPayslip.fullCalculation?.metadata?.warnings?.length > 0 && (
                <div style={{ background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: 10, padding: 12, fontSize: 12 }}>
                  <div style={{ fontWeight: 500, color: C.orange, marginBottom: 4 }}>{tr('ملاحظات', 'Notes')}</div>
                  {selectedPayslip.fullCalculation.metadata.warnings.map((w: string, i: number) => (
                    <div key={i} style={{ color: C.orange, fontSize: 11 }}>{w}</div>
                  ))}
                </div>
              )}

              <CVisionDialogFooter C={C}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setViewDialogOpen(false)}>{tr('اغلاق', 'Close')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" icon={Printer} onClick={() => window.print()}>{tr('طباعة', 'Print')}</CVisionButton>
              </CVisionDialogFooter>
            </div>
          );
        })()}
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
