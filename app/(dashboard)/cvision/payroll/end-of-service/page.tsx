'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionLabel, CVisionSelect,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import {
  Calculator, CalendarDays, DollarSign, UserMinus, UserCheck, AlertTriangle,
  CheckCircle2, ArrowLeft, Printer, Info, Search, Zap, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface EmployeeSearchResult { id: string; firstName: string; lastName: string; employeeNo: string; employeeNumber?: string; hiredAt?: string | null; status?: string; }
interface EndOfServiceResult { yearsOfService: number; monthsOfService: number; totalDays: number; lastSalary: number; dailyRate: number; isResignation: boolean; first5YearsAmount: number; after5YearsAmount: number; grossAmount: number; resignationDeduction: number; netAmount: number; breakdown: string[]; }
type TerminationReason = 'end_of_contract' | 'employer_termination' | 'resignation' | 'retirement' | 'mutual_agreement' | 'force_majeure';

const today = new Date().toISOString().split('T')[0];
function yearsAgo(n: number) { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().split('T')[0]; }

function formatCurrency(amount: number) { return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 }).format(amount); }

export default function EndOfServicePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const TERMINATION_REASONS: { value: TerminationReason; label: string }[] = [
    { value: 'end_of_contract', label: tr('انتهاء العقد', 'End of Contract') },
    { value: 'employer_termination', label: tr('انهاء من صاحب العمل', 'Employer Termination') },
    { value: 'resignation', label: tr('استقالة', 'Resignation') },
    { value: 'retirement', label: tr('تقاعد', 'Retirement') },
    { value: 'mutual_agreement', label: tr('اتفاق متبادل', 'Mutual Agreement') },
    { value: 'force_majeure', label: tr('قوة قاهرة', 'Force Majeure') },
  ];

  const QUICK_EXAMPLES = [
    { label: tr('موظف 5 سنوات', '5 Years Employee'), startDate: yearsAgo(5), endDate: today, basicSalary: 10000, housingAllowance: 2500, terminationReason: 'end_of_contract' as TerminationReason },
    { label: tr('موظف 10 سنوات', '10 Years Employee'), startDate: yearsAgo(10), endDate: today, basicSalary: 15000, housingAllowance: 3750, terminationReason: 'end_of_contract' as TerminationReason },
    { label: tr('استقالة (3 سنوات)', 'Resignation (3 Years)'), startDate: yearsAgo(3), endDate: today, basicSalary: 8000, housingAllowance: 2000, terminationReason: 'resignation' as TerminationReason },
    { label: tr('تقاعد (20 سنة)', 'Retirement (20 Years)'), startDate: yearsAgo(20), endDate: today, basicSalary: 20000, housingAllowance: 5000, terminationReason: 'retirement' as TerminationReason },
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmployeeSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSearchResult | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);
  const [basicSalary, setBasicSalary] = useState<number>(0);
  const [housingAllowance, setHousingAllowance] = useState<number>(0);
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('end_of_contract');
  const [result, setResult] = useState<EndOfServiceResult | null>(null);
  const [resultSummary, setResultSummary] = useState<{ ar: string; en: string } | null>(null);
  const [showLawReference, setShowLawReference] = useState(false);

  const isResignation = terminationReason === 'resignation';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) setShowSearchDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.length < 2) { setSearchResults([]); setShowSearchDropdown(false); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await cvisionFetch(`/api/cvision/employees?search=${encodeURIComponent(value)}&limit=10`);
        setSearchResults(data.data?.items || data.data || []); setShowSearchDropdown(true);
      } catch {} finally { setSearchLoading(false); }
    }, 300);
  }, []);

  const handleSelectEmployee = useCallback(async (emp: EmployeeSearchResult) => {
    setSelectedEmployee(emp);
    setSearchQuery(`${emp.firstName} ${emp.lastName} (${emp.employeeNo || emp.employeeNumber || ''})`);
    setShowSearchDropdown(false);
    if (emp.hiredAt) setStartDate(new Date(emp.hiredAt).toISOString().split('T')[0]);
    try {
      const data = await cvisionFetch(`/api/cvision/payroll/profiles?employeeId=${emp.id}&limit=1`);
      const profiles = data.profiles || [];
      if (profiles.length > 0) {
        setBasicSalary(profiles[0].baseSalary || 0);
        setHousingAllowance(profiles[0].allowancesJson?.housing || 0);
        toast.success(tr('تم تحميل بيانات الراتب', 'Salary data auto-filled from payroll profile'));
      } else { toast.error(tr('لا يوجد ملف راتب - ادخل يدوياً', 'No payroll profile found. Please enter salary manually.')); }
    } catch {}
  }, []);

  const calculateMutation = useMutation({
    mutationFn: () =>
      cvisionMutate('/api/cvision/gosi', 'POST', {
        action: 'end-of-service', startDate, endDate,
        lastBasicSalary: basicSalary, lastHousingAllowance: housingAllowance, isResignation,
      }),
    onMutate: () => { setResult(null); setResultSummary(null); },
    onSuccess: (data: any) => {
      if (data.success) {
        setResult(data.data.calculation); setResultSummary(data.data.summary);
        toast.success(tr('تم الحساب بنجاح', 'Calculation complete'));
      } else { toast.error(data.error || tr('فشل الحساب', 'Calculation failed')); }
    },
    onError: () => { toast.error(tr('فشل الحساب', 'Failed to calculate')); },
  });
  const calculating = calculateMutation.isPending;

  const handleCalculate = () => {
    if (!startDate) { toast.error(tr('ادخل تاريخ البداية', 'Please enter the start date')); return; }
    if (!endDate) { toast.error(tr('ادخل تاريخ النهاية', 'Please enter the end date')); return; }
    if (basicSalary <= 0) { toast.error(tr('ادخل الراتب الاساسي', 'Please enter the basic salary')); return; }
    if (new Date(endDate) <= new Date(startDate)) { toast.error(tr('تاريخ النهاية يجب ان يكون بعد البداية', 'End date must be after start date')); return; }
    calculateMutation.mutate();
  };

  const handleQuickExample = (ex: typeof QUICK_EXAMPLES[0]) => {
    setStartDate(ex.startDate); setEndDate(ex.endDate); setBasicSalary(ex.basicSalary);
    setHousingAllowance(ex.housingAllowance); setTerminationReason(ex.terminationReason);
    setSelectedEmployee(null); setSearchQuery(''); setResult(null); setResultSummary(null);
  };

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('حاسبة نهاية الخدمة', 'End of Service Calculator')}
        titleEn={isRTL ? 'End of Service Calculator' : undefined}
        subtitle={tr('حساب مكافأة نهاية الخدمة حسب نظام العمل السعودي (المادة 84-86)', 'Calculate end of service award per Saudi Labor Law Articles 84-86')}
        icon={Calculator}
        isRTL={isRTL}
        actions={
          <Link href="/cvision/payroll" style={{ textDecoration: 'none' }}>
            <CVisionButton C={C} isDark={isDark} variant="ghost" icon={ArrowLeft}>{tr('رجوع', 'Back')}</CVisionButton>
          </Link>
        }
      />

      {/* Quick Examples */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Zap size={14} /> {tr('امثلة سريعة:', 'Quick Examples:')}
        </span>
        {QUICK_EXAMPLES.map((ex) => (
          <CVisionButton key={ex.label} C={C} isDark={isDark} variant="outline" onClick={() => handleQuickExample(ex)}>
            {ex.label}
          </CVisionButton>
        ))}
      </div>

      {/* Employee Search */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={16} color={C.green} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('بحث عن موظف', 'Employee Search')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div ref={searchContainerRef} style={{ position: 'relative' }}>
            <CVisionInput C={C} placeholder={tr('بحث بالاسم او رقم الموظف...', 'Search by name or employee number...')}
              value={searchQuery} onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)} />
            {showSearchDropdown && searchResults.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 50, width: '100%', marginTop: 4, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 240, overflowY: 'auto' }}>
                {searchResults.map((emp) => (
                  <button key={emp.id} onClick={() => handleSelectEmployee(emp)}
                    style={{ width: '100%', textAlign: isRTL ? 'right' : 'left', padding: '10px 14px', border: 'none', borderBottom: `1px solid ${C.border}`, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: C.text, fontSize: 13 }}>
                    <span><span style={{ fontWeight: 500 }}>{emp.firstName} {emp.lastName}</span> <span style={{ color: C.textMuted }}>({emp.employeeNo || emp.employeeNumber})</span></span>
                    {emp.hiredAt && <CVisionBadge C={C} variant="muted">{new Date(emp.hiredAt).toLocaleDateString()}</CVisionBadge>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedEmployee && (
            <div style={{ marginTop: 10, padding: 10, background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.green, fontSize: 13 }}>
                <UserCheck size={14} />
                <span style={{ fontWeight: 500 }}>{selectedEmployee.firstName} {selectedEmployee.lastName}</span>
                <span style={{ fontSize: 12 }}>({selectedEmployee.employeeNo || selectedEmployee.employeeNumber})</span>
              </div>
              <CVisionButton C={C} isDark={isDark} variant="ghost" onClick={() => { setSelectedEmployee(null); setSearchQuery(''); }}>
                {tr('مسح', 'Clear')}
              </CVisionButton>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Service Details Form */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={16} color={C.green} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تفاصيل الخدمة', 'Service Details')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionInput C={C} type="date" label={tr('تاريخ البداية', 'Start Date')} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <CVisionInput C={C} type="date" label={tr('تاريخ النهاية', 'End Date')} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionInput C={C} type="number" label={tr('الراتب الاساسي (ر.س)', 'Basic Salary (SAR)')} value={String(basicSalary || '')} onChange={(e) => setBasicSalary(parseFloat(e.target.value) || 0)} placeholder="10000" />
            <CVisionInput C={C} type="number" label={tr('بدل السكن (ر.س)', 'Housing Allowance (SAR)')} value={String(housingAllowance || '')} onChange={(e) => setHousingAllowance(parseFloat(e.target.value) || 0)} placeholder="2500" />
          </div>
          <CVisionSelect C={C} label={tr('سبب انهاء الخدمة', 'Termination Reason')} value={terminationReason}
            onChange={(v) => setTerminationReason(v as TerminationReason)}
            options={TERMINATION_REASONS.map(r => ({ value: r.value, label: r.label }))} />

          {isResignation && (
            <div style={{ background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.orange, fontWeight: 600, marginBottom: 8 }}>
                <AlertTriangle size={16} /> {tr('قواعد خصم الاستقالة', 'Resignation Deduction Rules')}
              </div>
              <div style={{ fontSize: 12, color: C.orange, marginBottom: 8 }}>{tr('حسب المادة 85 من نظام العمل السعودي', 'Per Saudi Labor Law Article 85')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
                <span style={{ color: C.text, fontWeight: 500 }}>{tr('اقل من سنتين', 'Less than 2 years')}</span><span style={{ color: C.red, fontWeight: 600 }}>0%</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{tr('2-5 سنوات', '2-5 years')}</span><span style={{ color: C.orange, fontWeight: 600 }}>1/3</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{tr('5-10 سنوات', '5-10 years')}</span><span style={{ color: C.orange, fontWeight: 600 }}>2/3</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{tr('10+ سنوات', '10+ years')}</span><span style={{ color: C.green, fontWeight: 600 }}>100%</span>
              </div>
            </div>
          )}

          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleCalculate} disabled={calculating}
            icon={calculating ? undefined : Calculator} style={{ width: '100%', padding: '12px 0', fontSize: 15 }}>
            {calculating ? tr('جاري الحساب...', 'Calculating...') : tr('حساب مكافأة نهاية الخدمة', 'Calculate End of Service Award')}
          </CVisionButton>
        </CVisionCardBody>
      </CVisionCard>

      {/* Result */}
      {result && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ background: C.greenDim }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.green, fontWeight: 600, fontSize: 14 }}>
                <CheckCircle2 size={16} /> {tr('نتيجة مكافأة نهاية الخدمة', 'End of Service Award Result')}
              </div>
              <CVisionButton C={C} isDark={isDark} variant="outline" icon={Printer} onClick={() => window.print()}>
                {tr('طباعة', 'Print')}
              </CVisionButton>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <CVisionStatsRow>
              <CVisionMiniStat C={C} label={tr('فترة الخدمة', 'Service Period')} value={`${result.yearsOfService} ${tr('سنة', 'yrs')}, ${result.monthsOfService} ${tr('شهر', 'mos')}`} icon={Clock} color={C.green} colorDim={C.greenDim} />
              <CVisionMiniStat C={C} label={tr('اخر راتب', 'Last Salary')} value={formatCurrency(result.lastSalary)} icon={DollarSign} color={C.blue} colorDim={C.blueDim} />
              <CVisionMiniStat C={C} label={tr('الاجر اليومي', 'Daily Rate')} value={formatCurrency(result.dailyRate)} icon={CalendarDays} color={C.purple} colorDim={C.purpleDim} />
            </CVisionStatsRow>

            {/* Net Award */}
            <div style={{ textAlign: 'center', padding: 24, background: C.greenDim, borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>{tr('صافي المكافأة', 'Net Award')}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: C.green }}>{formatCurrency(result.netAmount)}</div>
              {result.isResignation && result.resignationDeduction > 0 && (
                <CVisionBadge C={C} variant="warning" style={{ marginTop: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><UserMinus size={12} /> {tr('تم تطبيق خصم الاستقالة', 'Resignation deduction applied')}</span>
                </CVisionBadge>
              )}
            </div>

            {/* Breakdown */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>{tr('تفاصيل الحساب', 'Calculation Breakdown')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.text }}><span>{tr('مكافأة اول 5 سنوات', 'First 5 Years Award')}</span><span style={{ fontWeight: 500 }}>{formatCurrency(result.first5YearsAmount)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.text }}><span>{tr('مكافأة ما بعد 5 سنوات', 'After 5 Years Award')}</span><span style={{ fontWeight: 500 }}>{formatCurrency(result.after5YearsAmount)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: C.text, background: C.bgSubtle, padding: '6px 0', borderRadius: 4 }}><span>{tr('اجمالي المكافأة', 'Gross Award')}</span><span>{formatCurrency(result.grossAmount)}</span></div>
                {result.resignationDeduction > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: C.red }}><span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><UserMinus size={14} /> {tr('خصم الاستقالة', 'Resignation Deduction')}</span><span style={{ fontWeight: 500 }}>-{formatCurrency(result.resignationDeduction)}</span></div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: C.green, background: C.greenDim, padding: 8, borderRadius: 6, fontSize: 16 }}><span>{tr('صافي المكافأة', 'Net Award')}</span><span>{formatCurrency(result.netAmount)}</span></div>
              </div>
            </div>

            {result.breakdown?.length > 0 && (
              <div style={{ background: C.bgSubtle, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>{tr('ملاحظات الحساب', 'Calculation Notes')}</div>
                {result.breakdown.map((line, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.textMuted }}>&#8226; {line}</div>
                ))}
              </div>
            )}

            {resultSummary && (
              <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center' }}>{isRTL ? resultSummary.ar : resultSummary.en}</div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Law Reference */}
      <CVisionCard C={C}>
        <button onClick={() => setShowLawReference(!showLawReference)} style={{ width: '100%', textAlign: isRTL ? 'right' : 'left', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
          <CVisionCardHeader C={C} style={{ background: C.greenDim, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={16} color={C.green} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{tr('مرجع نظام العمل السعودي', 'Saudi Labor Law Reference')}</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: C.green }}>{tr('المواد 84-86', 'Articles 84-86')}</span>
            </div>
            {showLawReference ? <ChevronUp size={16} color={C.green} /> : <ChevronDown size={16} color={C.green} />}
          </CVisionCardHeader>
        </button>
        {showLawReference && (
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={14} /> {tr('المادة 84', 'Article 84')}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{tr('عند انتهاء علاقة العمل يلتزم صاحب العمل بدفع مكافأة نهاية الخدمة:', 'Upon end of work relationship, the employer must pay an end-of-service award:')}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><CVisionBadge C={C} variant="muted">1-5 {tr('سنة', 'yr')}</CVisionBadge><span>{tr('نصف شهر راتب عن كل سنة من اول 5 سنوات', 'Half month salary for each year of the first 5 years')}</span></div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}><CVisionBadge C={C} variant="muted">5+ {tr('سنة', 'yr')}</CVisionBadge><span>{tr('شهر راتب كامل عن كل سنة بعد 5 سنوات', 'Full month salary for each year after 5 years')}</span></div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}><UserMinus size={14} /> {tr('المادة 85', 'Article 85')}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{tr('في حالة الاستقالة يتم تخفيض المكافأة:', 'In case of resignation, the award is reduced:')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12, marginTop: 6, color: C.textMuted }}>
                <span>&lt; 2 {tr('سنة', 'years')}</span><span style={{ color: C.red, fontWeight: 500 }}>{tr('لا شيء (0%)', 'None (0%)')}</span>
                <span>2-5 {tr('سنوات', 'years')}</span><span style={{ fontWeight: 500 }}>1/3 {tr('من المكافأة', 'of award')}</span>
                <span>5-10 {tr('سنوات', 'years')}</span><span style={{ fontWeight: 500 }}>2/3 {tr('من المكافأة', 'of award')}</span>
                <span>10+ {tr('سنوات', 'years')}</span><span style={{ color: C.green, fontWeight: 600 }}>{tr('كامل (100%)', 'Full (100%)')}</span>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.green, display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={14} /> {tr('المادة 86', 'Article 86')}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{tr('الراتب المستخدم لحساب المكافأة يشمل الراتب الاساسي الاخير + بدل السكن', 'The salary used includes the last basic salary plus the housing allowance.')}</div>
            </div>
            <div style={{ background: C.greenDim, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 6 }}>{tr('المعادلة', 'Formula')}</div>
              <div style={{ fontSize: 12, color: C.green, fontFamily: 'monospace', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>{tr('الراتب = الاساسي + السكن', 'Salary = Basic + Housing')}</span>
                <span>{tr('اول 5 سنوات = (الراتب / 2) × السنوات', 'First 5y = (Salary / 2) x years')}</span>
                <span>{tr('بعد 5 سنوات = الراتب × السنوات', 'After 5y = Salary x years')}</span>
                <span>{tr('الاجمالي = اول 5 سنوات + بعد 5 سنوات', 'Total = First5y + After5y')}</span>
              </div>
            </div>
          </CVisionCardBody>
        )}
      </CVisionCard>
    </CVisionPageLayout>
  );
}
