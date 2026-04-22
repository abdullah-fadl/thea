'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd , CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, Minus,
  Users, DollarSign, Shield, Calendar,
  AlertTriangle, Lightbulb, Activity,
  PieChart, FileText, ArrowUpRight, ArrowDownRight,
  Clock, Star, Briefcase, HeartPulse,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface KPICard {
  key: string;
  label: string;
  value: number;
  formatted: string;
  unit: string;
  previousValue: number;
  change: number;
  changePercent: number;
  status: 'GOOD' | 'WARNING' | 'CRITICAL' | 'NEUTRAL';
}

interface DepartmentScorecard {
  department: string;
  headcount: number;
  avgSalary: number;
  turnoverRate: number;
  absenceRate: number;
  avgRiskScore: number;
  performanceAvg: number;
  compositeScore: number;
}

interface AbsencePatternData {
  dayOfWeekDistribution: { day: string; dayIndex: number; totalAbsences: number; percentage: number; trend: string }[];
  monthlyDistribution: { month: string; monthIndex: number; totalAbsences: number; avgPerEmployee: number; isHighSeason: boolean }[];
  departmentPatterns: { department: string; totalAbsences: number; avgPerEmployee: number; topReasons: { reason: string; count: number }[]; sunThuRate: number }[];
  employeePatterns: { employeeId: string; employeeName: string; department: string; totalAbsences: number; pattern: string; severity: string; details: string }[];
  summary: { totalAbsences: number; totalEmployees: number; avgAbsencesPerEmployee: number; periodStart: string; periodEnd: string };
  insights: string[];
}

interface ResignationData {
  monthlyRates: { period: string; month: string; resignations: number; turnoverRate: number; avgTenureAtDeparture: number; topReasons: string[] }[];
  predictions: { period: string; month: string; predictedResignations: number; confidence: number; riskFactors: string[] }[];
  peakSeasons: { months: string[]; reason: string }[];
  departmentVulnerability: { department: string; resignationsLast12Months: number; currentHighRiskCount: number; predictedNext3Months: number; vulnerabilityScore: number }[];
  costImpact: { last12MonthsCost: number; projected12MonthsCost: number; costByDepartment: { department: string; cost: number }[]; preventableSavings: number };
  insights: string[];
}

interface WorkforceTrend {
  metric: string;
  unit: string;
  dataPoints: { period: string; value: number; change?: number }[];
  trend: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const KPI_ICONS: Record<string, typeof Users> = {
  headcount: Users,
  payroll: DollarSign,
  turnover: TrendingDown,
  saudization: Shield,
  absence: Calendar,
  avgSalary: DollarSign,
  performance: Star,
  riskCount: AlertTriangle,
  openPositions: Briefcase,
};

function StatusBadge({ status }: { status: string }) {
  const { C, isDark } = useCVisionTheme();
  const styles: Record<string, string> = {
    GOOD: 'bg-green-100 text-green-800',
    WARNING: 'bg-yellow-100 text-yellow-800',
    CRITICAL: 'bg-red-100 text-red-800',
    NEUTRAL: 'bg-gray-100 text-gray-600',
  };
  return <CVisionBadge C={C} className={styles[status] || styles.NEUTRAL} variant="secondary">{status}</CVisionBadge>;
}

function ChangeIndicator({ change, invertGood }: { change: number; invertGood?: boolean }) {
  const { C, isDark } = useCVisionTheme();
  if (change === 0) return <span style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center' }}><Minus style={{ height: 12, width: 12 }} /> 0%</span>;
  const isPositive = invertGood ? change < 0 : change > 0;
  const color = isPositive ? 'text-green-600' : 'text-red-600';
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${color}`}>
      <Icon style={{ height: 12, width: 12 }} />{Math.abs(change).toFixed(1)}%
    </span>
  );
}

function SeverityDot({ severity }: { severity: string }) {
  const c: Record<string, string> = { CRITICAL: 'bg-red-500', CONCERN: 'bg-orange-500', WATCH: 'bg-yellow-500', NORMAL: 'bg-green-500' };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${c[severity] || c.NORMAL}`} />;
}

function ScoreBadge({ score }: { score: number }) {
  const { C, isDark } = useCVisionTheme();
  const color = score >= 80 ? 'bg-green-100 text-green-800' : score >= 60 ? 'bg-blue-100 text-blue-800' : score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <CVisionBadge C={C} className={color} variant="secondary">{score}/100</CVisionBadge>;
}

function HeatCell({ value, thresholds }: { value: number; thresholds: [number, number, number] }) {
  const bg = value >= thresholds[2] ? 'bg-red-200' : value >= thresholds[1] ? 'bg-orange-200' : value >= thresholds[0] ? 'bg-yellow-200' : 'bg-green-100';
  return <td className={`px-2 py-1 text-center text-xs font-medium ${bg} border`}>{value.toFixed(1)}</td>;
}

function VulnBar({ score }: { score: number }) {
  const { C, isDark } = useCVisionTheme();
  const color = score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-orange-400' : 'bg-green-400';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ height: 8, flex: 1, borderRadius: '50%', background: C.bgSubtle, overflow: 'hidden' }}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 500, width: 28, textAlign: 'right' }}>{score}</span>
    </div>
  );
}

function ChartSkeleton() {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 192 }}  />
      <CVisionSkeletonCard C={C} height={200} style={{ width: '100%', borderRadius: 12 }}  />
    </div>
  );
}

// ─── API Fetch ──────────────────────────────────────────────────────────────

async function fetchBI(action: string, params?: Record<string, string>) {
  return cvisionFetch<any>('/api/cvision/bi', { params: { action, ...params } });
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function BIDashboardPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [tab, setTab] = useState('executive');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 style={{ height: 24, width: 24 }} />
          Business Intelligence
        </h1>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
          Advanced analytics, trends, and predictions
        </p>
      </div>

      <CVisionTabs
        C={C}
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { id: 'executive', label: tr('الملخص التنفيذي', 'Executive Summary'), icon: <Activity style={{ height: 16, width: 16 }} /> },
          { id: 'absence', label: tr('أنماط الغياب', 'Absence Patterns'), icon: <Calendar style={{ height: 16, width: 16 }} /> },
          { id: 'resignation', label: 'Resignation Analysis', icon: <HeartPulse style={{ height: 16, width: 16 }} /> },
          { id: 'explorer', label: 'Data Explorer', icon: <PieChart style={{ height: 16, width: 16 }} /> },
        ]}
      >
        <CVisionTabContent tabId="executive"><ExecutiveTab /></CVisionTabContent>
        <CVisionTabContent tabId="absence"><AbsenceTab /></CVisionTabContent>
        <CVisionTabContent tabId="resignation"><ResignationTab /></CVisionTabContent>
        <CVisionTabContent tabId="explorer"><DataExplorerTab /></CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: Executive Summary
// ═══════════════════════════════════════════════════════════════════════════

function ExecutiveTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [kpis, setKpis] = useState<KPICard[]>([]);
  const [scorecard, setScorecard] = useState<DepartmentScorecard[]>([]);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [trends, setTrends] = useState<WorkforceTrend[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['headcount', 'avgSalary']);

  const summaryQuery = useQuery({
    queryKey: [...cvisionKeys.analytics.list({ biAction: 'executive-summary' })],
    queryFn: () => fetchBI('executive-summary'),
  });

  const trendsQuery = useQuery({
    queryKey: [...cvisionKeys.analytics.list({ biAction: 'trends', metrics: selectedMetrics.join(',') })],
    queryFn: () => fetchBI('trends', { metrics: selectedMetrics.join(','), periods: '12' }),
  });

  const loading = summaryQuery.isLoading || trendsQuery.isLoading;

  useEffect(() => {
    if (summaryQuery.data) {
      setKpis(summaryQuery.data.summary?.kpis || []);
      setScorecard(summaryQuery.data.summary?.departmentScorecard || []);
      setConcerns(summaryQuery.data.summary?.topConcerns || []);
      setRecommendations(summaryQuery.data.summary?.recommendations || []);
    }
  }, [summaryQuery.data]);

  useEffect(() => {
    if (trendsQuery.data) setTrends(trendsQuery.data.trends || []);
  }, [trendsQuery.data]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {Array.from({ length: 9 }).map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96, borderRadius: 12 }}  />)}
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {kpis.map(k => {
          const Icon = KPI_ICONS[k.key] || Activity;
          return (
            <CVisionCard C={C} key={k.key}>
              <CVisionCardBody style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Icon style={{ height: 16, width: 16, color: C.textMuted }} />
                  <ChangeIndicator
                    change={k.changePercent}
                    invertGood={k.key === 'turnover' || k.key === 'riskCount' || k.key === 'absence'}
                  />
                </div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{k.formatted}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{k.label}</div>
              </CVisionCardBody>
            </CVisionCard>
          );
        })}
      </div>

      {/* Trends Chart */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>12-Month Trends</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['headcount', 'avgSalary', 'turnover', 'saudization'].map(m => (
                <CVisionButton C={C} isDark={isDark}
                  key={m}
                  size="sm"
                  variant={selectedMetrics.includes(m) ? 'default' : 'outline'}
                  style={{ fontSize: 12, height: 28 }}
                  onClick={() => {
                    setSelectedMetrics(prev =>
                      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                    );
                  }}
                >
                  {m === 'headcount' ? 'Headcount' : m === 'avgSalary' ? 'Avg Salary' : m === 'turnover' ? 'Turnover' : 'Saudization'}
                </CVisionButton>
              ))}
            </div>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {trends.length > 0 && trends[0].dataPoints.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends[0].dataPoints.map((dp, i) => {
                  const point: Record<string, any> = { period: dp.period };
                  trends.forEach((t, ti) => { point[t.metric] = t.dataPoints[i]?.value || 0; });
                  return point;
                })}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {trends.map((t, i) => (
                    <Line
                      key={t.metric}
                      type="monotone"
                      dataKey={t.metric}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name={`${t.metric} (${t.unit})`}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>
              Trends will build over time as monthly snapshots are generated.
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Department Scorecard */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('بطاقة أداء الأقسام', 'Department Scorecard')}</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ overflowX: 'auto' }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('العدد', 'Head')}</CVisionTh>
                  <CVisionTh C={C} align="right">{tr('متوسط الراتب', 'Avg Salary')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('الدوران', 'Turnover')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('الغياب', 'Absence')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('المخاطر', 'Risk')}</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('الدرجة', 'Score')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {scorecard.map(d => (
                  <CVisionTr C={C} key={d.department}>
                    <CVisionTd style={{ fontWeight: 500 }}>{d.department}</CVisionTd>
                    <CVisionTd align="center">{d.headcount}</CVisionTd>
                    <CVisionTd align="right" style={{ fontSize: 12 }}>SAR {d.avgSalary.toLocaleString()}</CVisionTd>
                    <CVisionTd align="center">{d.turnoverRate}%</CVisionTd>
                    <CVisionTd align="center">{d.absenceRate} d/m</CVisionTd>
                    <CVisionTd align="center">
                      <CVisionBadge C={C} variant="secondary" className={d.avgRiskScore >= 60 ? 'bg-red-100 text-red-700' : d.avgRiskScore >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}>
                        {d.avgRiskScore}
                      </CVisionBadge>
                    </CVisionTd>
                    <CVisionTd align="center"><ScoreBadge score={d.compositeScore} /></CVisionTd>
                  </CVisionTr>
                ))}
                {scorecard.length === 0 && (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={7} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد بيانات أقسام متاحة.', 'No department data available.')}</CVisionTd></CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Concerns & {tr('التوصيات', 'Recommendations')} */}
      <div style={{ display: 'grid', gap: 16 }}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle style={{ height: 16, width: 16, color: C.orange }} />{tr('أهم المخاوف', 'Top Concerns')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {concerns.map((c, i) => (
                <li key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: C.orange, fontWeight: 700 }}>{i + 1}.</span>
                  {c}
                </li>
              ))}
            </ul>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><Lightbulb style={{ height: 16, width: 16, color: C.blue }} />{tr('التوصيات', 'Recommendations')}</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendations.map((r, i) => (
                <li key={i} style={{ fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: C.blue, fontWeight: 700 }}>{i + 1}.</span>
                  {r}
                </li>
              ))}
            </ul>
          </CVisionCardBody>
        </CVisionCard>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: Absence Patterns
// ═══════════════════════════════════════════════════════════════════════════

function AbsenceTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [deptFilter, setDeptFilter] = useState<string>('');

  const absenceQuery = useQuery({
    queryKey: [...cvisionKeys.analytics.list({ biAction: 'absence-patterns', department: deptFilter })],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (deptFilter) params.department = deptFilter;
      return fetchBI('absence-patterns', params);
    },
  });

  const loading = absenceQuery.isLoading;
  const data = absenceQuery.data?.patterns || null;

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}><ChartSkeleton /><ChartSkeleton /></div>;
  if (!data) return <CVisionCard C={C} style={{ marginTop: 16 }}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>{tr('لا توجد بيانات غياب متاحة.', 'No absence data available.')}</CVisionCardBody></CVisionCard>;

  const allDepts = [...new Set(data.departmentPatterns.map(d => d.department))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        <CVisionCard C={C}><CVisionCardBody style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{data.summary.totalAbsences}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي أيام الغياب', 'Total Absence Days')}</div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{data.summary.totalEmployees}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('الموظفون المتابعون', 'Employees Tracked')}</div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ padding: 16, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{data.summary.avgAbsencesPerEmployee}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('المتوسط لكل موظف', 'Avg per Employee')}</div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
            <CVisionSelect
                C={C}
                value={deptFilter}
                placeholder="All Departments"
                options={[
                  { value: 'all', label: tr('كل الأقسام', 'All Departments') },
                  ...allDepts.map((d: string) => ({ value: d, label: d })),
                ]}
                style={{ height: 32, fontSize: 12 }}
              />
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('تصفية', 'Filter')}</div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Day of Week Chart */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('الغياب حسب يوم الأسبوع', 'Absences by Day of Week')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dayOfWeekDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="totalAbsences" name="Absences" radius={[4, 4, 0, 0]}>
                  {data.dayOfWeekDistribution.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.trend === 'HIGH' ? '#ef4444' : entry.trend === 'LOW' ? '#22c55e' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {data.dayOfWeekDistribution.some(d => d.trend === 'HIGH') && (
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
              <span style={{ height: 8, width: 8, borderRadius: '50%', background: C.redDim, marginRight: 4 }} />
              Red bars indicate above-average absence days (adjacent to weekend).
            </p>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Monthly Seasonality */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('الموسمية الشهرية', 'Monthly Seasonality')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyDistribution}>
                <defs>
                  <linearGradient id="absFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="totalAbsences" stroke="#3b82f6" fill="url(#absFill)" name="Absences" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {data.monthlyDistribution.filter(m => m.isHighSeason).length > 0 && (
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
              Peak months: {data.monthlyDistribution.filter(m => m.isHighSeason).map(m => m.month).join(', ')}
            </p>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Department Heatmap */}
      {data.departmentPatterns.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('خريطة حرارة غياب الأقسام', 'Department Absence Heatmap')}</div></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                    <CVisionTh C={C} align="center">{tr('الإجمالي', 'Total')}</CVisionTh>
                    <CVisionTh C={C} align="center">{tr('متوسط/موظف', 'Avg/Emp')}</CVisionTh>
                    <CVisionTh C={C} align="center">{tr('أحد/خميس %', 'Sun/Thu %')}</CVisionTh>
                    <CVisionTh C={C}>Top Reason</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {data.departmentPatterns.map(d => (
                    <CVisionTr C={C} key={d.department}>
                      <CVisionTd style={{ fontWeight: 500 }}>{d.department}</CVisionTd>
                      <CVisionTd align="center">{d.totalAbsences}</CVisionTd>
                      <HeatCell value={d.avgPerEmployee} thresholds={[2, 3, 5]} />
                      <CVisionTd align="center">
                        <CVisionBadge C={C} variant="secondary" className={d.sunThuRate > 40 ? 'bg-red-100 text-red-700' : ''}>{d.sunThuRate}%</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>{d.topReasons[0]?.reason || '—'}</CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8, color: C.textMuted }}>
              <span><span style={{ height: 8, width: 16, background: C.greenDim, marginRight: 4, borderRadius: 6 }} />Normal (&lt;2)</span>
              <span><span style={{ height: 8, width: 16, background: C.orangeDim, marginRight: 4, borderRadius: 6 }} />Elevated (2-3)</span>
              <span><span style={{ height: 8, width: 16, background: C.orangeDim, marginRight: 4, borderRadius: 6 }} />High (3-5)</span>
              <span><span style={{ height: 8, width: 16, background: C.redDim, marginRight: 4, borderRadius: 6 }} />Critical (5+)</span>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Employee Watchlist */}
      {data.employeePatterns.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle style={{ height: 16, width: 16, color: C.orange }} />Employee Watchlist</div></CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                    <CVisionTh C={C}>Dept</CVisionTh>
                    <CVisionTh C={C}>{tr('النمط', 'Pattern')}</CVisionTh>
                    <CVisionTh C={C} align="center">Days</CVisionTh>
                    <CVisionTh C={C} align="center">{tr('الشدة', 'Severity')}</CVisionTh>
                </CVisionTableHead>
                <CVisionTableBody>
                  {data.employeePatterns.map(e => (
                    <CVisionTr C={C} key={e.employeeId}>
                      <CVisionTd style={{ fontWeight: 500 }}>{e.employeeName}</CVisionTd>
                      <CVisionTd style={{ fontSize: 12 }}>{e.department}</CVisionTd>
                      <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>{e.pattern}</CVisionTd>
                      <CVisionTd align="center">{e.totalAbsences}</CVisionTd>
                      <CVisionTd align="center"><SeverityDot severity={e.severity} /> <span style={{ fontSize: 12, marginLeft: 4 }}>{e.severity}</span></CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Insights */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><Lightbulb style={{ height: 16, width: 16, color: C.blue }} />Insights</div></CVisionCardHeader>
        <CVisionCardBody>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.insights.map((ins, i) => <li key={i} style={{ fontSize: 13, color: C.textMuted }}>{ins}</li>)}
          </ul>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: Resignation Analysis
// ═══════════════════════════════════════════════════════════════════════════

function ResignationTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const resignationQuery = useQuery({
    queryKey: [...cvisionKeys.analytics.list({ biAction: 'resignation-seasonality' })],
    queryFn: () => fetchBI('resignation-seasonality'),
  });

  const loading = resignationQuery.isLoading;
  const data = resignationQuery.data?.seasonality || null;

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}><ChartSkeleton /><ChartSkeleton /></div>;
  if (!data) return <CVisionCard C={C} style={{ marginTop: 16 }}><CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center', color: C.textMuted }}>{tr('لا توجد بيانات استقالة متاحة.', 'No resignation data available.')}</CVisionCardBody></CVisionCard>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
      {/* Seasonality Chart */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Resignation Seasonality (12 Months)</div></CVisionCardHeader>
        <CVisionCardBody>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyRates}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="resignations" name="Resignations" fill="#ef4444" radius={[4, 4, 0, 0]}>
                  {data.monthlyRates.map((_, i) => (
                    <Cell key={i} fill={data.monthlyRates[i].resignations > 0 ? '#ef4444' : '#e5e7eb'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {data.peakSeasons.length > 0 && data.peakSeasons[0].months.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.peakSeasons.map((ps, i) => (
                <p key={i} style={{ fontSize: 12, color: C.textMuted }}>
                  <CVisionBadge C={C} variant="secondary" style={{ background: C.redDim, color: C.red, marginRight: 4 }}>{ps.months.join('/')}</CVisionBadge>
                  {ps.reason}
                </p>
              ))}
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Predictions */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp style={{ height: 16, width: 16 }} />Resignation Predictions (Next 3 Months)</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.predictions.map(p => (
              <div key={p.period} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{p.month} {p.period.split('-')[0]}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionBadge C={C} variant="secondary">{p.predictedResignations} predicted</CVisionBadge>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{p.confidence}% confidence</span>
                  </div>
                </div>
                <ul style={{ fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  {p.riskFactors.map((rf, i) => <li key={i}>• {rf}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Department Vulnerability */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('ضعف الأقسام', 'Department Vulnerability')}</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ overflowX: 'auto' }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                  <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                  <CVisionTh C={C} align="center">Left (12mo)</CVisionTh>
                  <CVisionTh C={C} align="center">{tr('مخاطر عالية', 'High Risk')}</CVisionTh>
                  <CVisionTh C={C} align="center">Predicted (3mo)</CVisionTh>
                  <CVisionTh C={C} style={{ width: 160 }}>{tr('الضعف', 'Vulnerability')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {data.departmentVulnerability.map(d => (
                  <CVisionTr C={C} key={d.department}>
                    <CVisionTd style={{ fontWeight: 500 }}>{d.department}</CVisionTd>
                    <CVisionTd align="center">{d.resignationsLast12Months}</CVisionTd>
                    <CVisionTd align="center">
                      {d.currentHighRiskCount > 0 ? (
                        <CVisionBadge C={C} style={{ background: C.redDim, color: C.red }} variant="secondary">{d.currentHighRiskCount}</CVisionBadge>
                      ) : '0'}
                    </CVisionTd>
                    <CVisionTd align="center">{d.predictedNext3Months}</CVisionTd>
                    <CVisionTd><VulnBar score={d.vulnerabilityScore} /></CVisionTd>
                  </CVisionTr>
                ))}
                {data.departmentVulnerability.length === 0 && (
                  <CVisionTr C={C}><CVisionTd align="center" colSpan={5} style={{ color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>No vulnerability data.</CVisionTd></CVisionTr>
                )}
              </CVisionTableBody>
            </CVisionTable>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Cost Impact */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><DollarSign style={{ height: 16, width: 16 }} />Turnover Cost Analysis</div></CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>SAR {(data.costImpact.last12MonthsCost / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تكلفة آخر 12 شهراً', 'Last 12 Months Cost')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>SAR {(data.costImpact.projected12MonthsCost / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('توقعات 12 شهراً', 'Projected 12 Months')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>SAR {(data.costImpact.preventableSavings / 1000).toFixed(0)}K</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('التوفير القابل للتحقيق', 'Preventable Savings')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{data.costImpact.costByDepartment.length}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Departments Affected</div>
            </div>
          </div>
          {data.costImpact.costByDepartment.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Cost by Department:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.costImpact.costByDepartment.map(d => (
                  <div key={d.department} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, width: 96 }}>{d.department}</span>
                    <div style={{ height: 16, flex: 1, borderRadius: '50%', background: C.bgSubtle, overflow: 'hidden' }}>
                      <div
                        style={{ borderRadius: '50%', background: C.redDim, width: `${Math.min(100, (d.cost / Math.max(1, data.costImpact.last12MonthsCost)) * 100)}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, width: 80, textAlign: 'right' }}>SAR {d.cost.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Insights */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}><Lightbulb style={{ height: 16, width: 16, color: C.blue }} />Insights</div></CVisionCardHeader>
        <CVisionCardBody>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.insights.map((ins, i) => <li key={i} style={{ fontSize: 13, color: C.textMuted }}>{ins}</li>)}
          </ul>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: Data Explorer
// ═══════════════════════════════════════════════════════════════════════════

const AVAILABLE_METRICS = [
  { value: 'headcount', label: 'Headcount' },
  { value: 'payroll', label: 'Total Payroll' },
  { value: 'avgSalary', label: 'Avg Salary' },
  { value: 'turnover', label: 'Turnover Rate' },
  { value: 'saudization', label: 'Saudization' },
  { value: 'attendance', label: 'Attendance Rate' },
  { value: 'performance', label: 'Avg Performance' },
  { value: 'flightRisk', label: 'Avg Flight Risk' },
  { value: 'newHires', label: 'New Hires' },
  { value: 'departures', label: 'Departures' },
  { value: 'openPositions', label: 'Open Positions' },
];

function DataExplorerTab() {
  const { C, isDark } = useCVisionTheme();
  const [metric1, setMetric1] = useState('headcount');
  const [metric2, setMetric2] = useState('avgSalary');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [periods, setPeriods] = useState('12');
  const [trends, setTrends] = useState<WorkforceTrend[]>([]);
  const explorerQuery = useQuery({
    queryKey: [...cvisionKeys.analytics.list({ biAction: 'explorer-trends', metric1, metric2, periods })],
    queryFn: () => {
      const metrics = [metric1, metric2].filter(Boolean).join(',');
      return fetchBI('trends', { metrics, periods });
    },
  });

  const loading = explorerQuery.isLoading;
  useEffect(() => { if (explorerQuery.data) setTrends(explorerQuery.data.trends || []); }, [explorerQuery.data]);

  const chartData = useMemo(() => {
    if (trends.length === 0) return [];
    const maxLen = Math.max(...trends.map(t => t.dataPoints.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, any> = { period: trends[0]?.dataPoints[i]?.period || '' };
      trends.forEach(t => { point[t.metric] = t.dataPoints[i]?.value || 0; });
      return point;
    });
  }, [trends]);

  const renderChart = () => {
    if (chartData.length === 0) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textMuted, fontSize: 13 }}>Generate warehouse snapshots to enable historical data exploration.</div>;
    }

    const common = (
      <>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </>
    );

    if (chartType === 'bar') {
      return (
        <BarChart data={chartData}>
          {common}
          {trends.map((t, i) => (
            <Bar key={t.metric} dataKey={t.metric} name={`${AVAILABLE_METRICS.find(m => m.value === t.metric)?.label || t.metric} (${t.unit})`} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      );
    }

    if (chartType === 'area') {
      return (
        <AreaChart data={chartData}>
          <defs>
            {trends.map((t, i) => (
              <linearGradient key={t.metric} id={`grad-${t.metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {common}
          {trends.map((t, i) => (
            <Area key={t.metric} type="monotone" dataKey={t.metric} name={`${AVAILABLE_METRICS.find(m => m.value === t.metric)?.label || t.metric} (${t.unit})`} stroke={CHART_COLORS[i]} fill={`url(#grad-${t.metric})`} />
          ))}
        </AreaChart>
      );
    }

    return (
      <LineChart data={chartData}>
        {common}
        {trends.map((t, i) => (
          <Line key={t.metric} type="monotone" dataKey={t.metric} name={`${AVAILABLE_METRICS.find(m => m.value === t.metric)?.label || t.metric} (${t.unit})`} stroke={CHART_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} />
        ))}
      </LineChart>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
      {/* Controls */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Metric 1</label>
              <CVisionSelect
                C={C}
                value={metric1}
                onChange={setMetric1}
                options={AVAILABLE_METRICS.map(m => ({ value: m.value, label: m.label }))}
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Metric 2</label>
              <CVisionSelect
                C={C}
                value={metric2}
                onChange={setMetric2}
                options={AVAILABLE_METRICS.map(m => ({ value: m.value, label: m.label }))}
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Period</label>
              <CVisionSelect
                C={C}
                value={periods}
                onChange={setPeriods}
                options={[
                  { value: '3', label: 'Last 3 Months' },
                  { value: '6', label: 'Last 6 Months' },
                  { value: '12', label: 'Last 12 Months' },
                  { value: '24', label: 'Last 24 Months' },
                ]}
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block' }}>Chart Type</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['line', 'bar', 'area'] as const).map(t => (
                  <CVisionButton C={C} isDark={isDark} key={t} size="sm" variant={chartType === t ? 'default' : 'outline'} style={{ fontSize: 12, height: 32, flex: 1 }} onClick={() => setChartType(t)}>
                    {t === 'line' ? 'Line' : t === 'bar' ? 'Bar' : 'Area'}
                  </CVisionButton>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <CVisionButton C={C} isDark={isDark} size="sm" style={{ width: '100%', height: 32 }} onClick={() => explorerQuery.refetch()} disabled={loading}>
                {loading ? 'Loading...' : 'Generate'}
              </CVisionButton>
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Chart */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
            {AVAILABLE_METRICS.find(m => m.value === metric1)?.label}
            {metric2 ? ` & ${AVAILABLE_METRICS.find(m => m.value === metric2)?.label}` : ''}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          {loading ? <ChartSkeleton /> : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Data Table */}
      {chartData.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Raw Data</div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ overflowX: 'auto', overflowY: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead C={C}>
                    <CVisionTh C={C}>Period</CVisionTh>
                    {trends.map(t => (
                      <CVisionTh C={C} align="right" key={t.metric}>
                        {AVAILABLE_METRICS.find(m => m.value === t.metric)?.label || t.metric} ({t.unit})
                      </CVisionTh>
                    ))}
                </CVisionTableHead>
                <CVisionTableBody>
                  {chartData.map((row, i) => (
                    <CVisionTr C={C} key={i}>
                      <CVisionTd style={{ fontWeight: 500 }}>{row.period}</CVisionTd>
                      {trends.map(t => (
                        <CVisionTd align="right" key={t.metric}>
                          {typeof row[t.metric] === 'number' ? row[t.metric].toLocaleString() : '—'}
                        </CVisionTd>
                      ))}
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </div>
  );
}
