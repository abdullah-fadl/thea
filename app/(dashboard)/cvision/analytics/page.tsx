'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput, CVisionSkeletonCard, CVisionSkeleton,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Target, TrendingDown, TrendingUp, DollarSign,
  AlertTriangle, RefreshCw, ChevronRight, Shield,
} from 'lucide-react';

// Types
interface KeyMetric { label: string; labelAr: string; value: string; trend?: 'UP' | 'DOWN' | 'STABLE' }
interface Alert { severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string; messageAr: string }
interface ExecutiveSummaryData {
  summary: { summary: string; summaryAr: string; keyMetrics: KeyMetric[]; alerts: Alert[]; recommendations: { priority: string; action: string; actionAr: string }[] };
  metrics: { absenceRate: number; turnoverRate: number; saudizationRate: number; monthlyPayrollTotal: number; headcount: number };
}
interface AbsenceData { dateRange: { start: string; end: string }; totalEmployees: number; totalAbsenceDays: number; overallAbsenteeismRate: number; byType: Record<string, number>; byMonth: number[]; trends: { period: string; rate: number }[]; topAbsentees: { employeeId: string; employeeName: string; departmentId: string; totalAbsences: number }[] }
interface TurnoverData { dateRange: { start: string; end: string }; totalSeparations: number; resignations: number; terminations: number; turnoverRate: number; voluntaryTurnoverRate: number; involuntaryTurnoverRate: number; averageTenureMonths: number; retentionRate: number; separations: { employeeId: string; employeeName: string; separationType: string; reason?: string }[] }
interface PayrollTrend { period: string; totalGross: number; totalNet: number; employeeCount: number; averageGross: number; averageNet: number; totalAllowances: number; totalDeductions: number; gosiEmployerCost: number; costPerEmployee: number; changeFromPrevious: { grossChange: number; netChange: number; headcountChange: number } }
interface RetentionRiskData { employees: { employeeId: string; employeeName: string; departmentId: string; departmentName?: string; riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; factors: { factor: string; factorAr: string; weight: number; score: number }[]; recommendation: string; recommendationAr: string }[]; totalAssessed: number; criticalRisk: number; highRisk: number; mediumRisk: number; lowRisk: number }
interface WorkforceData { totalHeadcount: number; activeCount: number; probationCount: number; byDepartment: Record<string, number>; byNationality: Record<string, number>; byGender: Record<string, number>; saudizationRate: number; averageAge: number; averageTenureMonths: number; ageBands: Record<string, number>; tenureBands: Record<string, number>; contractExpiringIn90Days: number; probationEndingIn30Days: number }

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];

function formatSAR(amount: number): string {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
function formatNumber(n: number): string { return new Intl.NumberFormat('en-SA').format(n); }
function formatPercent(n: number): string { return `${n.toFixed(1)}%`; }
function getDefaultDateRange() {
  const to = new Date(); const from = new Date(); from.setMonth(from.getMonth() - 6);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

export default function AnalyticsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const defaultRange = getDefaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const dateFilters = { from: dateFrom, to: dateTo };

  const fetchAnalytics = (action: string, extraParams?: Record<string, string>) =>
    cvisionFetch<{ data: any }>('/api/cvision/analytics', { params: { action, from: dateFrom, to: dateTo, ...extraParams } }).then(r => r.data);

  const executiveQuery = useQuery({
    queryKey: cvisionKeys.analytics.list({ ...dateFilters, action: 'executive-summary' }),
    queryFn: () => fetchAnalytics('executive-summary'),
  });
  const workforceQuery = useQuery({
    queryKey: cvisionKeys.analytics.list({ ...dateFilters, action: 'workforce' }),
    queryFn: () => fetchAnalytics('workforce'),
  });
  const absenceQuery = useQuery({
    queryKey: cvisionKeys.analytics.list({ ...dateFilters, action: 'absence' }),
    queryFn: () => fetchAnalytics('absence'),
  });
  const turnoverQuery = useQuery({
    queryKey: cvisionKeys.analytics.list({ ...dateFilters, action: 'turnover' }),
    queryFn: () => fetchAnalytics('turnover'),
  });
  const payrollQuery = useQuery({
    queryKey: cvisionKeys.analytics.list({ ...dateFilters, action: 'payroll-trends' }),
    queryFn: () => fetchAnalytics('payroll-trends'),
  });
  const retentionQuery = useQuery({
    queryKey: cvisionKeys.analytics.list({ ...dateFilters, action: 'retention-risk' }),
    queryFn: () => fetchAnalytics('retention-risk', { limit: '10', minRisk: 'MEDIUM' }),
  });

  const executive = executiveQuery.data as ExecutiveSummaryData | undefined ?? null;
  const workforce = workforceQuery.data as WorkforceData | undefined ?? null;
  const absence = absenceQuery.data as AbsenceData | undefined ?? null;
  const turnover = turnoverQuery.data as TurnoverData | undefined ?? null;
  const payrollTrends = payrollQuery.data as PayrollTrend[] | undefined ?? null;
  const retentionRisk = retentionQuery.data as RetentionRiskData | undefined ?? null;

  const loading = {
    executive: executiveQuery.isLoading,
    absence: absenceQuery.isLoading,
    turnover: turnoverQuery.isLoading,
    payroll: payrollQuery.isLoading,
    retention: retentionQuery.isLoading,
    workforce: workforceQuery.isLoading,
  };
  const errors: Record<string, string> = {};
  if (executiveQuery.error) errors.executive = (executiveQuery.error as Error).message;
  if (absenceQuery.error) errors.absence = (absenceQuery.error as Error).message;
  if (turnoverQuery.error) errors.turnover = (turnoverQuery.error as Error).message;
  if (payrollQuery.error) errors.payroll = (payrollQuery.error as Error).message;
  if (retentionQuery.error) errors.retention = (retentionQuery.error as Error).message;
  if (workforceQuery.error) errors.workforce = (workforceQuery.error as Error).message;

  const loadAll = () => {
    queryClient.invalidateQueries({ queryKey: cvisionKeys.analytics.all });
  };

  const fetchSection = (key: string, _action: string, _setter: any, _extra?: string) => {
    const queryMap: Record<string, any> = {
      executive: executiveQuery, workforce: workforceQuery, absence: absenceQuery,
      turnover: turnoverQuery, payroll: payrollQuery, retention: retentionQuery,
    };
    queryMap[key]?.refetch();
  };

  const metrics = executive?.metrics;
  const alerts = executive?.summary?.alerts || [];
  const topAlerts = alerts.slice(0, 3);

  const SectionError = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }}>
      <AlertTriangle size={32} color={C.textMuted} style={{ marginBottom: 8 }} />
      <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>{message}</p>
      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={onRetry} icon={<RefreshCw size={12} />}>{tr('إعادة المحاولة', 'Retry')}</CVisionButton>
    </div>
  );

  const riskVariant = (level: string): 'danger' | 'warning' | 'success' | 'muted' => {
    if (level === 'CRITICAL') return 'danger';
    if (level === 'HIGH') return 'warning';
    if (level === 'MEDIUM') return 'warning';
    return 'success';
  };

  return (
    <CVisionPageLayout>
      {/* Header + Date Range */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{tr('تحليلات الموارد البشرية', 'HR Analytics')}</h1>
          <p style={{ color: C.textMuted, fontSize: 13 }}>{tr('تحليلات شاملة للقوى العاملة', 'Comprehensive workforce analytics and insights')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>{tr('من', 'From')}</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, background: C.bgCard, color: C.text }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>{tr('إلى', 'To')}</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, background: C.bgCard, color: C.text }} />
          </div>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={loadAll} icon={<RefreshCw size={14} />}>{tr('تحديث', 'Refresh')}</CVisionButton>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {loading.executive ? (
          <>
            <CVisionSkeletonCard C={C} />
            <CVisionSkeletonCard C={C} />
            <CVisionSkeletonCard C={C} />
            <CVisionSkeletonCard C={C} />
          </>
        ) : errors.executive ? (
          <CVisionCard C={C} style={{ gridColumn: '1 / -1' }}>
            <CVisionCardBody><SectionError message={errors.executive} onRetry={() => executiveQuery.refetch()} /></CVisionCardBody>
          </CVisionCard>
        ) : metrics ? (
          <>
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('إجمالي القوى العاملة', 'Total Headcount')}</span><Users size={16} color={C.textMuted} /></div></CVisionCardHeader>
              <CVisionCardBody><div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{formatNumber(metrics.headcount)}</div><div style={{ fontSize: 11, color: C.textMuted }}>{tr('موظفون نشطون', 'Active employees')}</div></CVisionCardBody>
            </CVisionCard>
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('نسبة السعودة', 'Saudization Rate')}</span><Target size={16} color={metrics.saudizationRate >= 30 ? C.green : metrics.saudizationRate >= 20 ? C.orange : C.red} /></div></CVisionCardHeader>
              <CVisionCardBody><div style={{ fontSize: 22, fontWeight: 700, color: metrics.saudizationRate >= 30 ? C.green : metrics.saudizationRate >= 20 ? C.orange : C.red }}>{formatPercent(metrics.saudizationRate)}</div><div style={{ fontSize: 11, color: C.textMuted }}>{metrics.saudizationRate >= 30 ? tr('يلبي هدف نطاقات', 'Meeting Nitaqat target') : tr('أقل من هدف نطاقات', 'Below Nitaqat target')}</div></CVisionCardBody>
            </CVisionCard>
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('معدل الدوران', 'Turnover Rate')}</span>{metrics.turnoverRate > 15 ? <TrendingUp size={16} color={C.red} /> : <TrendingDown size={16} color={C.green} />}</div></CVisionCardHeader>
              <CVisionCardBody><div style={{ fontSize: 22, fontWeight: 700, color: metrics.turnoverRate > 15 ? C.red : C.text }}>{formatPercent(metrics.turnoverRate)}</div><div style={{ fontSize: 11, color: C.textMuted }}>{metrics.turnoverRate > 15 ? tr('فوق الحد الصحي', 'Above healthy threshold') : tr('ضمن النطاق الصحي', 'Within healthy range')}</div></CVisionCardBody>
            </CVisionCard>
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>{tr('الرواتب الشهرية', 'Monthly Payroll')}</span><DollarSign size={16} color={C.textMuted} /></div></CVisionCardHeader>
              <CVisionCardBody><div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{formatSAR(metrics.monthlyPayrollTotal)}</div><div style={{ fontSize: 11, color: C.textMuted }}>{tr('إجمالي التكلفة الشهرية', 'Total monthly cost')}</div></CVisionCardBody>
            </CVisionCard>
          </>
        ) : null}
      </div>

      {/* Absence + Turnover */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {loading.absence ? <CVisionSkeletonCard C={C} /> : errors.absence ? (
          <CVisionCard C={C}><CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('أنماط الغياب', 'Absence Patterns')}</span></CVisionCardHeader><CVisionCardBody><SectionError message={errors.absence} onRetry={() => absenceQuery.refetch()} /></CVisionCardBody></CVisionCard>
        ) : absence ? (
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('أنماط الغياب', 'Absence Patterns')}</span><div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tr('معدل التغيب الكلي', 'Overall absenteeism')}: {formatPercent(absence.overallAbsenteeismRate)} - {absence.totalAbsenceDays} {tr('يوم', 'days')}</div></CVisionCardHeader>
            <CVisionCardBody>
              {absence.trends.length > 0 ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={absence.trends.map(t => ({ month: t.period.slice(5), rate: Number(t.rate.toFixed(1)) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="month" tick={{ fill: C.textMuted, fontSize: 11 }} />
                      <YAxis unit="%" tick={{ fill: C.textMuted, fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="rate" fill={C.blue} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 32 }}>{tr('لا توجد بيانات اتجاه', 'No trend data available')}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {Object.entries(absence.byType).map(([type, count]) => (
                  <CVisionBadge key={type} C={C} variant="muted">{type}: {count}</CVisionBadge>
                ))}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ) : null}

        {loading.turnover ? <CVisionSkeletonCard C={C} /> : errors.turnover ? (
          <CVisionCard C={C}><CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الدوران والاحتفاظ', 'Turnover & Retention')}</span></CVisionCardHeader><CVisionCardBody><SectionError message={errors.turnover} onRetry={() => turnoverQuery.refetch()} /></CVisionCardBody></CVisionCard>
        ) : turnover ? (
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('الدوران والاحتفاظ', 'Turnover & Retention')}</span><div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{turnover.totalSeparations} {tr('انفصال', 'separations')} - {tr('احتفاظ', 'Retention')}: {formatPercent(turnover.retentionRate)}</div></CVisionCardHeader>
            <CVisionCardBody>
              {turnover.totalSeparations > 0 ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: tr('طوعي', 'Voluntary'), value: turnover.resignations }, { name: tr('غير طوعي', 'Involuntary'), value: turnover.terminations }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                        <Cell fill="#3b82f6" /><Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 32 }}>{tr('لا توجد بيانات دوران', 'No turnover data')}</div>
              )}
              {turnover.separations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: C.textMuted }}>{tr('أهم أسباب الاستقالة', 'Top Resignation Reasons')}</div>
                  {(() => {
                    const reasons = turnover.separations.filter(s => s.reason).reduce<Record<string, number>>((acc, s) => { acc[s.reason!] = (acc[s.reason!] || 0) + 1; return acc; }, {});
                    return Object.entries(reasons).sort(([, a], [, b]) => b - a).slice(0, 3).map(([reason, count]) => (
                      <div key={reason} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reason}</span>
                        <CVisionBadge C={C} variant="muted">{count}</CVisionBadge>
                      </div>
                    ));
                  })()}
                </div>
              )}
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>{tr('متوسط مدة الخدمة', 'Average tenure')}: {turnover.averageTenureMonths.toFixed(1)} {tr('شهر', 'months')}</div>
            </CVisionCardBody>
          </CVisionCard>
        ) : null}
      </div>

      {/* Payroll Cost Trend */}
      {loading.payroll ? <CVisionSkeletonCard C={C} /> : errors.payroll ? (
        <CVisionCard C={C}><CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('اتجاه تكلفة الرواتب', 'Payroll Cost Trend')}</span></CVisionCardHeader><CVisionCardBody><SectionError message={errors.payroll} onRetry={() => payrollQuery.refetch()} /></CVisionCardBody></CVisionCard>
      ) : payrollTrends && payrollTrends.length > 0 ? (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('اتجاه تكلفة الرواتب', 'Payroll Cost Trend')}</span><div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{tr('إجمالي وصافي الرواتب عبر الزمن', 'Gross and net payroll over time')}</div></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={payrollTrends.map(t => ({ period: t.period.slice(5), gross: Math.round(t.totalGross), net: Math.round(t.totalNet) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="period" tick={{ fill: C.textMuted, fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} tick={{ fill: C.textMuted, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="gross" stroke={C.blue} strokeWidth={2} dot={{ r: 3 }} name={tr('إجمالي', 'Gross')} />
                  <Line type="monotone" dataKey="net" stroke={C.green} strokeWidth={2} dot={{ r: 3 }} name={tr('صافي', 'Net')} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {payrollTrends.length > 0 && (() => {
              const latest = payrollTrends[payrollTrends.length - 1];
              const items = [
                { label: tr('إجمالي', 'Gross'), value: formatSAR(latest.totalGross), color: C.blue },
                { label: tr('صافي', 'Net'), value: formatSAR(latest.totalNet), color: C.green },
                { label: tr('بدلات', 'Allowances'), value: formatSAR(latest.totalAllowances), color: C.purple },
                { label: tr('تأمينات (صاحب العمل)', 'GOSI (Employer)'), value: formatSAR(latest.gosiEmployerCost), color: C.orange },
              ];
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 16 }}>
                  {items.map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{item.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </CVisionCardBody>
        </CVisionCard>
      ) : null}

      {/* Retention Risk + Workforce */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {loading.retention ? <CVisionSkeletonCard C={C} /> : errors.retention ? (
          <CVisionCard C={C}><CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مخاطر الاحتفاظ', 'Retention Risk')}</span></CVisionCardHeader><CVisionCardBody><SectionError message={errors.retention} onRetry={() => retentionQuery.refetch()} /></CVisionCardBody></CVisionCard>
        ) : retentionRisk ? (
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={16} color={C.textMuted} /><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مخاطر الاحتفاظ', 'Retention Risk')}</span></div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{retentionRisk.totalAssessed} {tr('تم تقييمهم', 'assessed')} - {retentionRisk.criticalRisk} {tr('حرج', 'critical')}, {retentionRisk.highRisk} {tr('عالي', 'high')}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {retentionRisk.criticalRisk > 0 && <CVisionBadge C={C} variant="danger">{retentionRisk.criticalRisk} {tr('حرج', 'Critical')}</CVisionBadge>}
                  {retentionRisk.highRisk > 0 && <CVisionBadge C={C} variant="warning">{retentionRisk.highRisk} {tr('عالي', 'High')}</CVisionBadge>}
                </div>
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              {retentionRisk.employees.length > 0 ? (
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}>
                    <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                    <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'center' }}>{tr('المخاطر', 'Risk')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'right' }}>{tr('الدرجة', 'Score')}</CVisionTh>
                  </CVisionTableHead>
                  <CVisionTableBody>
                    {retentionRisk.employees.map(emp => (
                      <CVisionTr C={C} key={emp.employeeId}>
                        <CVisionTd>
                          <div style={{ fontWeight: 500, fontSize: 12, color: C.text }}>{emp.employeeName}</div>
                          {emp.factors.length > 0 && <div style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{emp.factors[0].factor}</div>}
                        </CVisionTd>
                        <CVisionTd style={{ fontSize: 12, color: C.text }}>{emp.departmentName || emp.departmentId}</CVisionTd>
                        <CVisionTd style={{ textAlign: 'center' }}><CVisionBadge C={C} variant={riskVariant(emp.riskLevel)}>{emp.riskLevel}</CVisionBadge></CVisionTd>
                        <CVisionTd style={{ textAlign: 'right', fontWeight: 500, color: C.text, fontSize: 12 }}>{emp.riskScore}</CVisionTd>
                      </CVisionTr>
                    ))}
                  </CVisionTableBody>
                </CVisionTable>
              ) : (
                <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 24 }}>{tr('لا يوجد موظفون بمخاطر متوسطة+', 'No employees at medium+ risk')}</div>
              )}
            </CVisionCardBody>
          </CVisionCard>
        ) : null}

        {loading.workforce ? <CVisionSkeletonCard C={C} /> : errors.workforce ? (
          <CVisionCard C={C}><CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('نظرة عامة على القوى العاملة', 'Workforce Overview')}</span></CVisionCardHeader><CVisionCardBody><SectionError message={errors.workforce} onRetry={() => workforceQuery.refetch()} /></CVisionCardBody></CVisionCard>
        ) : workforce ? (
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}><span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('نظرة عامة على القوى العاملة', 'Workforce Overview')}</span><div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{workforce.totalHeadcount} {tr('موظف', 'employees')} - {tr('متوسط العمر', 'Avg age')} {workforce.averageAge.toFixed(0)} - {tr('متوسط مدة الخدمة', 'Avg tenure')} {workforce.averageTenureMonths.toFixed(0)}{tr('شهر', 'mo')}</div></CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Gender split */}
              {(() => {
                const male = workforce.byGender['MALE'] || workforce.byGender['male'] || workforce.byGender['Male'] || 0;
                const female = workforce.byGender['FEMALE'] || workforce.byGender['female'] || workforce.byGender['Female'] || 0;
                const total = male + female || 1;
                const malePct = Math.round((male / total) * 100);
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.text }}>{tr('توزيع الجنس', 'Gender Distribution')}</span>
                      <span style={{ color: C.textMuted }}>{malePct}% {tr('ذكور', 'M')} / {100 - malePct}% {tr('إناث', 'F')}</span>
                    </div>
                    <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: C.bgSubtle }}>
                      <div style={{ width: `${malePct}%`, background: C.blue, transition: 'width 0.3s' }} />
                      <div style={{ width: `${100 - malePct}%`, background: '#ec4899', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })()}

              {/* Nationality distribution */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 8 }}>{tr('توزيع الجنسية', 'Nationality Distribution')}</div>
                {Object.entries(workforce.byNationality).sort(([, a], [, b]) => b - a).slice(0, 5).map(([nat, count]) => {
                  const pct = Math.round((count / (workforce.totalHeadcount || 1)) * 100);
                  return (
                    <div key={nat} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: C.text }}>{nat}</span>
                        <span style={{ color: C.textMuted }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: C.barTrack, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: C.gold, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Age distribution */}
              {workforce.ageBands && Object.keys(workforce.ageBands).length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 8 }}>{tr('توزيع العمر', 'Age Distribution')}</div>
                  <div style={{ height: 140 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(workforce.ageBands).map(([range, count]) => ({ range, count }))}>
                        <XAxis dataKey="range" tick={{ fontSize: 10, fill: C.textMuted }} />
                        <Tooltip contentStyle={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="count" fill={C.purple} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{tr('عقود تنتهي', 'Contracts Expiring')}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: C.orange }}>{workforce.contractExpiringIn90Days}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{tr('خلال 90 يوم', 'within 90 days')}</div>
                </div>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{tr('تجربة تنتهي', 'Probation Ending')}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: C.blue }}>{workforce.probationEndingIn30Days}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>{tr('خلال 30 يوم', 'within 30 days')}</div>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ) : null}
      </div>

      {/* Alerts Banner */}
      {!loading.executive && topAlerts.length > 0 && (
        <CVisionCard C={C} style={{ borderLeft: `4px solid ${topAlerts.some(a => a.severity === 'CRITICAL') ? C.red : C.orange}` }}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color={topAlerts.some(a => a.severity === 'CRITICAL') ? C.red : C.orange} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تنبيهات رئيسية', 'Key Alerts')}</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topAlerts.map((alert, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <CVisionBadge C={C} variant={alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'WARNING' ? 'warning' : 'info'}>
                  {alert.severity}
                </CVisionBadge>
                <span style={{ fontSize: 13, color: C.text }}>{isRTL ? alert.messageAr : alert.message}</span>
              </div>
            ))}
            {alerts.length > 3 && (
              <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<ChevronRight size={12} />}>
                {tr(`عرض الكل (${alerts.length})`, `View All (${alerts.length})`)}
              </CVisionButton>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
