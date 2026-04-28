'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  LineChart,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  BarChart3,
  Activity,
  ArrowRight,
  RefreshCw,
  Loader2,
  Clock,
  Building2,
  Briefcase,
  PieChart,
  Wallet,
  ShieldCheck,
  GraduationCap,
  Heart,
  Target,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// =============================================================================
// Currency Formatting Helper
// =============================================================================

function fmtSAR(n: number) {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNumber(n: number) {
  return new Intl.NumberFormat('en-SA').format(n);
}

function fmtPercent(n: number) {
  return `${n.toFixed(1)}%`;
}

// =============================================================================
// Types
// =============================================================================

interface DashboardData {
  salary: {
    currentMonthly: number;
    projectedAnnual: number;
    changePercent: number;
  };
  headcount: {
    current: number;
    projected: number;
    changePercent: number;
  };
  absence: {
    currentRate: number;
    predictedRate: number;
    totalActive: number;
  };
  cost: {
    monthlyCost: number;
    annualProjected: number;
    changePercent: number;
  };
}

interface SalaryForecastData {
  currentMonthlyCost: number;
  projectedAnnualCost: number;
  headcount: number;
  monthlyForecast: Array<{
    month: string;
    projected: number;
    current: number;
  }>;
}

interface HeadcountForecastData {
  currentHeadcount: number;
  projectedYear: number;
  monthlyForecast: Array<{
    month: string;
    projected: number;
    attrition: number;
    newHires: number;
  }>;
}

interface AbsenceForecastData {
  totalActive: number;
  monthlyForecast: Array<{
    month: string;
    predictedAbsent: number;
    rate: number;
  }>;
}

interface HiringTimelineData {
  level: string;
  estimatedDays: number;
  confidence: number;
  breakdown: {
    sourcing: number;
    screening: number;
    interviews: number;
    offer: number;
  };
}

interface CostForecastData {
  monthlyCost: number;
  annualProjected: number;
  breakdown: {
    salaries: number;
    benefits: number;
    insurance: number;
    training: number;
  };
  monthlyForecast: Array<{
    month: string;
    salaries: number;
    benefits: number;
    insurance: number;
    training: number;
    total: number;
  }>;
}

// =============================================================================
// Fetch Helper
// =============================================================================

async function fetchPredictive<T>(action: string, params?: Record<string, string>): Promise<T> {
  const allParams: Record<string, string> = { action, ...params };
  const res = await cvisionFetch<{ data?: T } & Record<string, any>>('/api/cvision/predictive', { params: allParams });
  return (res.data ?? res) as T;
}

async function postForecast(model: string, params?: Record<string, unknown>) {
  return cvisionMutate('/api/cvision/predictive', 'POST', { action: 'run-forecast', model, params });
}

// =============================================================================
// Constants
// =============================================================================

const LEVELS = ['JUNIOR', 'MID', 'SENIOR', 'MANAGER', 'DIRECTOR'] as const;

const DEPARTMENTS = [
  'Engineering',
  'Human Resources',
  'Finance',
  'Operations',
  'Marketing',
  'Sales',
  'Legal',
  'IT',
  'Administration',
  'Medical',
] as const;

const LEVEL_LABELS: Record<string, string> = {
  JUNIOR: 'Junior',
  MID: 'Mid-Level',
  SENIOR: 'Senior',
  MANAGER: 'Manager',
  DIRECTOR: 'Director',
};

// =============================================================================
// Sub-components: Loading Skeletons
// =============================================================================

function DashboardSkeleton() {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <CVisionCard C={C} key={i} style={{ position: 'relative', overflow: 'hidden' }}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 8 }}>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 96 }}  />
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 128, marginBottom: 8 }}  />
            <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 80 }}  />
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  const { C, isDark } = useCVisionTheme();
  return (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 192 }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 256 }}  />
      </CVisionCardHeader>
      <CVisionCardBody>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 256 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4 }}>
              <CVisionSkeletonCard C={C} height={200}
                style={{ width: '100%', height: `${Math.random() * 60 + 40}%` }}
               />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 12, width: '100%' }}  />
            </div>
          ))}
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <CVisionCard C={C}>
      <CVisionCardHeader C={C}>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 20, width: 192 }}  />
      </CVisionCardHeader>
      <CVisionCardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: '100%' }}  />
          {Array.from({ length: rows }).map((_, i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 32, width: '100%' }}  />
          ))}
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

function HeroCardsSkeleton() {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
      {Array.from({ length: 2 }).map((_, i) => (
        <CVisionCard C={C} key={i}>
          <CVisionCardHeader C={C}>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 128 }}  />
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: 192 }}  />
          </CVisionCardBody>
        </CVisionCard>
      ))}
    </div>
  );
}

// =============================================================================
// Sub-components: Summary Card
// =============================================================================

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend?: number;
  gradient: string;
}

function SummaryCard({ title, value, subtitle, icon, trend, gradient }: SummaryCardProps) {
  const { C, isDark } = useCVisionTheme();
  return (
    <CVisionCard C={C} className={cn('relative overflow-hidden border-0', gradient)}>
      <div style={{ position: 'absolute', width: 128, height: 128, opacity: 0.1 }}>
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <CVisionCardHeader C={C} style={{ paddingBottom: 8, textAlign: 'left' }}>
        <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'left', fontWeight: 500 }}>
          {title}
        </div>
      </CVisionCardHeader>
      <CVisionCardBody style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 30, fontWeight: 700, marginBottom: 4 }}>{value}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{subtitle}</span>
          {trend !== undefined && trend !== null && (
            <CVisionBadge C={C}
              variant="secondary"
              className={cn(
                'text-xs font-semibold',
                trend >= 0
                  ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400/30'
                  : 'bg-red-500/20 text-red-100 border-red-400/30'
              )}
            >
              {trend >= 0 ? (
                <TrendingUp style={{ height: 12, width: 12, marginRight: 4 }} />
              ) : (
                <TrendingDown style={{ height: 12, width: 12, marginRight: 4 }} />
              )}
              {trend >= 0 ? '+' : ''}
              {fmtPercent(trend)}
            </CVisionBadge>
          )}
        </div>
      </CVisionCardBody>
    </CVisionCard>
  );
}

// =============================================================================
// Sub-components: Bar Chart (Pure CSS)
// =============================================================================

interface BarChartItem {
  label: string;
  values: Array<{ value: number; color: string; label: string }>;
}

function CSSBarChart({
  items,
  maxValue,
  height = 280,
  showLegend = true,
  legendItems,
}: {
  items: BarChartItem[];
  maxValue: number;
  height?: number;
  showLegend?: boolean;
  legendItems?: Array<{ color: string; label: string }>;
}) {
  const { C, isDark } = useCVisionTheme();
  const safeMax = maxValue || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showLegend && legendItems && legendItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end' }}>
          {legendItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
              <div
                style={{ width: 12, height: 12, backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
              {item.values.map((v, vi) => {
                const pct = Math.max((v.value / safeMax) * 100, 2);
                return (
                  <div
                    key={vi}
                    style={{ position: 'relative', flex: 1, transition: 'all 0.2s', height: `${pct}%`, backgroundColor: v.color, minHeight: '4px' }}
                    title={`${v.label}: ${fmtSAR(v.value)}`}
                  >
                    <div style={{ position: 'absolute', display: 'none', border: `1px solid ${C.border}`, borderRadius: 8, paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, fontSize: 12, whiteSpace: 'nowrap', zIndex: 10 }}>
                      {v.label}: {fmtSAR(v.value)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ color: C.textMuted, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components: Horizontal Stacked Bar
// =============================================================================

function HorizontalStackedBar({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const { C, isDark } = useCVisionTheme();
  const safeTotal = total || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', height: 40, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        {segments.map((seg, i) => {
          const pct = (seg.value / safeTotal) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={i}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, transition: 'all 0.2s', width: `${pct}%`, backgroundColor: seg.color, minWidth: pct > 0 ? '32px' : '0px' }}
              title={`${seg.label}: ${seg.value} days (${pct.toFixed(0)}%)`}
            >
              {pct > 10 && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 4, paddingRight: 4 }}>{seg.value}d</span>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <div
              style={{ width: 12, height: 12, flexShrink: 0, backgroundColor: seg.color }}
            />
            <span style={{ color: C.textMuted }}>{seg.label}:</span>
            <span style={{ fontWeight: 600 }}>{seg.value} days</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Sub-components: Line Chart (Pure CSS)
// =============================================================================

function CSSLineChart({
  data,
  lines,
  height = 280,
}: {
  data: Array<Record<string, unknown>>;
  lines: Array<{ key: string; color: string; label: string }>;
  height?: number;
}) {
  const { C, isDark } = useCVisionTheme();
  if (!data || data.length === 0) return null;

  const allValues = data.flatMap((d) =>
    lines.map((l) => (typeof d[l.key] === 'number' ? (d[l.key] as number) : 0))
  );
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted }}>
            <div
              style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: line.color }}
            />
            <span>{line.label}</span>
          </div>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((pct) => (
          <div
            key={pct}
            style={{ position: 'absolute', width: '100%', borderTop: `1px solid ${C.border}`, bottom: `${pct}%` }}
          >
            <span style={{ position: 'absolute', color: C.textMuted }}>
              {fmtNumber(Math.round(minVal + (range * pct) / 100))}
            </span>
          </div>
        ))}

        {/* Data points */}
        <div style={{ position: 'absolute', display: 'flex', alignItems: 'flex-end' }}>
          {data.map((d, idx) => (
            <div
              key={idx}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}
            >
              {lines.map((line, li) => {
                const val = typeof d[line.key] === 'number' ? (d[line.key] as number) : 0;
                const pct = ((val - minVal) / range) * 100;
                return (
                  <div
                    key={li}
                    style={{ position: 'absolute', width: 12, height: 12, borderRadius: '50%', transition: 'all 0.2s', zIndex: 10, backgroundColor: line.color, bottom: `${pct}%`, transform: 'translateY(50%)' }}
                    title={`${line.label}: ${fmtNumber(val)}`}
                  />
                );
              })}
              <div style={{ position: 'absolute', color: C.textMuted, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                {d.month as string}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Tab: Dashboard Overview
// =============================================================================

function DashboardTab() {
  const { C, isDark } = useCVisionTheme();

  const { data: rawData, isLoading: loading, isFetching: refreshing, refetch } = useQuery({
    queryKey: cvisionKeys.predictive.list({ action: 'dashboard' }),
    queryFn: () => fetchPredictive<any>('dashboard'),
    select: (raw: any) => {
      const sal = raw?.salary || {};
      const hc = raw?.headcount || {};
      const abs = raw?.absence || {};
      const cst = raw?.cost || {};
      return {
        salary: {
          currentMonthly: sal.currentMonthly ?? sal.currentMonthlyCost ?? 0,
          projectedAnnual: sal.projectedAnnual ?? sal.projectedAnnualCost ?? 0,
          changePercent: sal.changePercent ?? 0,
        },
        headcount: {
          current: hc.current ?? hc.currentHeadcount ?? 0,
          projected: hc.projected ?? hc.projectedYear ?? 0,
          changePercent: hc.changePercent ?? 0,
        },
        absence: {
          currentRate: abs.currentRate ?? 5,
          predictedRate: abs.predictedRate ?? 5,
          totalActive: abs.totalActive ?? 0,
        },
        cost: {
          monthlyCost: cst.monthlyCost ?? 0,
          annualProjected: cst.annualProjected ?? 0,
          changePercent: cst.changePercent ?? 0,
        },
      } as DashboardData;
    },
  });
  const data = rawData ?? null;

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (loading) return <DashboardSkeleton />;

  if (!data) {
    return (
      <CVisionCard C={C} style={{ padding: 48, textAlign: 'center' }}>
        <AlertCircle style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
        <p style={{ color: C.textMuted, marginBottom: 16 }}>Failed to load predictive dashboard data.</p>
        <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleRefresh}>
          <RefreshCw style={{ height: 16, width: 16, marginRight: 8 }} />
          Retry
        </CVisionButton>
      </CVisionCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Predictive Overview</h3>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            AI-powered forecasting across key workforce metrics
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark}
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
          ) : (
            <RefreshCw style={{ height: 16, width: 16, marginRight: 8 }} />
          )}
          Refresh
        </CVisionButton>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <SummaryCard
          title="Salary Forecast"
          value={fmtSAR(data.salary.projectedAnnual)}
          subtitle={`Monthly: ${fmtSAR(data.salary.currentMonthly)}`}
          icon={<DollarSign style={{ height: 24, width: 24 }} />}
          trend={data.salary.changePercent}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-700"
        />
        <SummaryCard
          title="Headcount Forecast"
          value={fmtNumber(data.headcount.projected)}
          subtitle={`Current: ${fmtNumber(data.headcount.current)}`}
          icon={<Users style={{ height: 24, width: 24 }} />}
          trend={data.headcount.changePercent}
          gradient="bg-gradient-to-br from-violet-600 to-purple-700"
        />
        <SummaryCard
          title="Absence Prediction"
          value={fmtPercent(data.absence.predictedRate)}
          subtitle={`Active employees: ${fmtNumber(data.absence.totalActive)}`}
          icon={<Activity style={{ height: 24, width: 24 }} />}
          trend={data.absence.predictedRate - data.absence.currentRate}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
        <SummaryCard
          title="Total Cost"
          value={fmtSAR(data.cost.annualProjected)}
          subtitle={`Monthly: ${fmtSAR(data.cost.monthlyCost)}`}
          icon={<Wallet style={{ height: 24, width: 24 }} />}
          trend={data.cost.changePercent}
          gradient="bg-gradient-to-br from-emerald-600 to-teal-700"
        />
      </div>

      {/* Quick Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <CVisionCard C={C} style={{ cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
          <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <BarChart3 style={{ height: 16, width: 16, color: C.blue }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Salary Analysis</span>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  12-month salary cost projections
                </p>
              </div>
              <ArrowRight style={{ height: 16, width: 16, color: C.textMuted, transition: 'color 0.2s, background 0.2s' }} />
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C} style={{ cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
          <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Users style={{ height: 16, width: 16 }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Headcount Plan</span>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  Workforce growth and attrition forecast
                </p>
              </div>
              <ArrowRight style={{ height: 16, width: 16, color: C.textMuted, transition: 'color 0.2s, background 0.2s' }} />
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C} style={{ cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
          <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Calendar style={{ height: 16, width: 16, color: C.orange }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Hiring Timeline</span>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  Estimated time-to-hire by role
                </p>
              </div>
              <ArrowRight style={{ height: 16, width: 16, color: C.textMuted, transition: 'color 0.2s, background 0.2s' }} />
            </div>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C} style={{ cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
          <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <PieChart style={{ height: 16, width: 16 }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Cost Breakdown</span>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  Detailed cost category analysis
                </p>
              </div>
              <ArrowRight style={{ height: 16, width: 16, color: C.textMuted, transition: 'color 0.2s, background 0.2s' }} />
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* AI Insights */}
      <CVisionCard C={C} className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 12, background: C.blueDim }}>
              <Target style={{ height: 20, width: 20, color: C.blue }} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>AI Forecast Insight</h4>
              <p style={{ fontSize: 13, color: C.textMuted }}>
                Based on current trends, your projected annual workforce cost is trending{' '}
                {data.cost.changePercent >= 0 ? 'upward' : 'downward'} by{' '}
                {fmtPercent(Math.abs(data.cost.changePercent))}. Headcount is expected to{' '}
                {data.headcount.changePercent >= 0 ? 'grow' : 'decrease'} by{' '}
                {fmtPercent(Math.abs(data.headcount.changePercent))} over the next 12 months.
                Consider reviewing department budgets to align with projected growth.
              </p>
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// =============================================================================
// Tab: Salary Forecast
// =============================================================================

function SalaryForecastTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const queryClient = useQueryClient();

  const { data: data = null, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.predictive.list({ action: 'salary-forecast' }),
    queryFn: () => fetchPredictive<SalaryForecastData>('salary-forecast'),
  });

  const forecastMutation = useMutation({
    mutationFn: () => postForecast('salaryBudgetForecast', {}),
    onSuccess: () => {
      toast.success('Salary forecast model updated successfully');
      queryClient.invalidateQueries({ queryKey: cvisionKeys.predictive.list({ action: 'salary-forecast' }) });
    },
    onError: (err: any) => toast.error(err?.message || 'Forecast failed'),
  });
  const running = forecastMutation.isPending;
  const handleRunForecast = useCallback(() => forecastMutation.mutate(), [forecastMutation]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <HeroCardsSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <CVisionCard C={C} style={{ padding: 48, textAlign: 'center' }}>
        <AlertCircle style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
        <p style={{ color: C.textMuted }}>No salary forecast data available.</p>
      </CVisionCard>
    );
  }

  const maxVal = Math.max(
    ...data.monthlyForecast.flatMap((f) => [f.projected, f.current]),
    1
  );

  const chartItems: BarChartItem[] = data.monthlyForecast.map((f) => ({
    label: f.month,
    values: [
      { value: f.current, color: '#6366f1', label: tr('حالي', 'Current') },
      { value: f.projected, color: '#3b82f6', label: tr('متوقع', 'Projected') },
    ],
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Salary Budget Forecast</h3>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Projected salary costs for the next 12 months
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark}
          variant="outline"
          size="sm"
          onClick={handleRunForecast}
          disabled={running}
        >
          {running ? (
            <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
          ) : (
            <RefreshCw style={{ height: 16, width: 16, marginRight: 8 }} />
          )}
          Re-run Forecast
        </CVisionButton>
      </div>

      {/* Hero Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <CVisionCard C={C} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CVisionCardHeader C={C} style={{ paddingBottom: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: C.blue, textAlign: 'left', fontWeight: 500 }}>
              Current Monthly Cost
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: C.blue }}>
              {fmtSAR(data.currentMonthlyCost)}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              Across {fmtNumber(data.headcount)} employees
            </p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C} className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 border-indigo-200 dark:border-indigo-800">
          <CVisionCardHeader C={C} style={{ paddingBottom: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left', fontWeight: 500 }}>
              Projected Annual Cost
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>
              {fmtSAR(data.projectedAnnualCost)}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              12-month forward projection
            </p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C} className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
          <CVisionCardHeader C={C} style={{ paddingBottom: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left', fontWeight: 500 }}>
              Avg. Cost per Employee
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>
              {data.headcount > 0
                ? fmtSAR(data.currentMonthlyCost / data.headcount)
                : fmtSAR(0)}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              Monthly per-employee cost
            </p>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Bar Chart */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Monthly Salary Comparison</div>
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left' }}>
            Current vs projected salary costs over 12 months
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CSSBarChart
            items={chartItems}
            maxValue={maxVal}
            height={280}
            legendItems={[
              { color: '#6366f1', label: tr('حالي', 'Current') },
              { color: '#3b82f6', label: tr('متوقع', 'Projected') },
            ]}
          />
        </CVisionCardBody>
      </CVisionCard>

      {/* Monthly Detail Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Monthly Breakdown</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Month</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Current</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Projected</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyForecast.map((row, i) => {
                  const variance = row.projected - row.current;
                  return (
                    <tr
                      key={i}
                      style={{ borderBottom: `1px solid ${C.border}`, transition: 'color 0.2s, background 0.2s' }}
                    >
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, fontWeight: 500 }}>{row.month}</td>
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{fmtSAR(row.current)}</td>
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right', fontWeight: 500, color: C.blue }}>
                        {fmtSAR(row.projected)}
                      </td>
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                        <span
                          className={cn(
                            'text-sm font-medium',
                            variance >= 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {variance >= 0 ? '+' : ''}
                          {fmtSAR(variance)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// =============================================================================
// Tab: Headcount Forecast
// =============================================================================

function HeadcountTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const queryClient = useQueryClient();

  const { data: data = null, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.predictive.list({ action: 'headcount-forecast' }),
    queryFn: () => fetchPredictive<HeadcountForecastData>('headcount-forecast'),
  });

  const forecastMutation = useMutation({
    mutationFn: () => postForecast('headcountForecast', {}),
    onSuccess: () => {
      toast.success('Headcount forecast model updated successfully');
      queryClient.invalidateQueries({ queryKey: cvisionKeys.predictive.list({ action: 'headcount-forecast' }) });
    },
    onError: (err: any) => toast.error(err?.message || 'Forecast failed'),
  });
  const running = forecastMutation.isPending;
  const handleRunForecast = useCallback(() => forecastMutation.mutate(), [forecastMutation]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <HeroCardsSkeleton />
        <ChartSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <CVisionCard C={C} style={{ padding: 48, textAlign: 'center' }}>
        <AlertCircle style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
        <p style={{ color: C.textMuted }}>No headcount forecast data available.</p>
      </CVisionCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Headcount Forecast</h3>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Projected workforce size with attrition and hiring breakdown
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark}
          variant="outline"
          size="sm"
          onClick={handleRunForecast}
          disabled={running}
        >
          {running ? (
            <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
          ) : (
            <RefreshCw style={{ height: 16, width: 16, marginRight: 8 }} />
          )}
          Re-run Forecast
        </CVisionButton>
      </div>

      {/* Hero Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        <CVisionCard C={C} className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
          <CVisionCardHeader C={C} style={{ paddingBottom: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left', fontWeight: 500 }}>
              Current Headcount
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700 }}>
              {fmtNumber(data.currentHeadcount)}
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Active employees</p>
          </CVisionCardBody>
        </CVisionCard>
        <CVisionCard C={C} className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/20 dark:to-fuchsia-950/20 border-purple-200 dark:border-purple-800">
          <CVisionCardHeader C={C} style={{ paddingBottom: 8, textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: C.purple, textAlign: 'left', fontWeight: 500 }}>
              Projected Year-End
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 700, color: C.purple }}>
              {fmtNumber(data.projectedYear)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <CVisionBadge C={C}
                variant="secondary"
                className={cn(
                  'text-xs',
                  data.projectedYear >= data.currentHeadcount
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}
              >
                {data.projectedYear >= data.currentHeadcount ? '+' : ''}
                {fmtNumber(data.projectedYear - data.currentHeadcount)} net change
              </CVisionBadge>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      </div>

      {/* Line Chart */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Headcount Trend</div>
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left' }}>
            Projected headcount with attrition and new hires over 12 months
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CSSLineChart
            data={data.monthlyForecast}
            lines={[
              { key: 'projected', color: '#7c3aed', label: tr('عدد الموظفين المتوقع', 'Projected Headcount') },
              { key: 'newHires', color: '#10b981', label: tr('توظيف جديد', 'New Hires') },
              { key: 'attrition', color: '#ef4444', label: tr('الاستنزاف', 'Attrition') },
            ]}
            height={280}
          />
        </CVisionCardBody>
      </CVisionCard>

      {/* Monthly Detail */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Monthly Headcount Detail</div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Month</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Projected</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>New Hires</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Attrition</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Net Change</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyForecast.map((row, i) => {
                  const netChange = row.newHires - row.attrition;
                  return (
                    <tr
                      key={i}
                      style={{ borderBottom: `1px solid ${C.border}`, transition: 'color 0.2s, background 0.2s' }}
                    >
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, fontWeight: 500 }}>{row.month}</td>
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right', fontWeight: 500 }}>
                        {fmtNumber(row.projected)}
                      </td>
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                        +{fmtNumber(row.newHires)}
                      </td>
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right', color: C.red }}>
                        -{fmtNumber(row.attrition)}
                      </td>
                      <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                        <CVisionBadge C={C}
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            netChange >= 0
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          )}
                        >
                          {netChange >= 0 ? '+' : ''}
                          {fmtNumber(netChange)}
                        </CVisionBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// =============================================================================
// Tab: Hiring Timeline
// =============================================================================

function HiringTimelineTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const [level, setLevel] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [hasQueried, setHasQueried] = useState(false);

  const estimateMutation = useMutation({
    mutationFn: (params: { level: string; department?: string }) => {
      const p: Record<string, string> = { level: params.level };
      if (params.department) p.department = params.department;
      return fetchPredictive<HiringTimelineData>('hiring-timeline', p);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to estimate hiring timeline'),
  });

  const data = estimateMutation.data ?? null;
  const loading = estimateMutation.isPending;

  const handleEstimate = useCallback(() => {
    if (!level) {
      toast.error('Please select a job level to estimate hiring timeline');
      return;
    }
    setHasQueried(true);
    estimateMutation.mutate({ level, department: department || undefined });
  }, [level, department, estimateMutation]);

  const totalDays = data
    ? data.breakdown.sourcing +
      data.breakdown.screening +
      data.breakdown.interviews +
      data.breakdown.offer
    : 0;

  const breakdownSegments = data
    ? [
        { label: tr('الاستقطاب', 'Sourcing'), value: data.breakdown.sourcing, color: '#3b82f6' },
        { label: tr('الفرز', 'Screening'), value: data.breakdown.screening, color: '#6366f1' },
        { label: tr('المقابلات', 'Interviews'), value: data.breakdown.interviews, color: '#8b5cf6' },
        { label: tr('عرض', 'Offer'), value: data.breakdown.offer, color: '#a855f7' },
      ]
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Hiring Timeline Estimator</h3>
        <p style={{ fontSize: 13, color: C.textMuted }}>
          Predict time-to-hire based on role level and department
        </p>
      </div>

      {/* Form */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Estimation Parameters</div>
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left' }}>
            Select level and optionally a department to get a hiring timeline estimate
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="hiring-level">Job Level</CVisionLabel>
              <CVisionSelect
                C={C}
                value={level || undefined}
                onChange={setLevel}
                placeholder="Select level"
                options={[...LEVELS.map((l) => (
                    ({ value: l, label: LEVEL_LABELS[l] || l })
                  ))]}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} htmlFor="hiring-dept">Department (Optional)</CVisionLabel>
              <CVisionSelect
                C={C}
                value={department || undefined}
                onChange={setDepartment}
                placeholder="All departments"
                options={[...DEPARTMENTS.map((d) => (
                    ({ value: d, label: d })
                  ))]}
              />
            </div>
            <CVisionButton C={C} isDark={isDark}
              onClick={handleEstimate}
              disabled={loading || !level}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {loading ? (
                <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
              ) : (
                <Clock style={{ height: 16, width: 16, marginRight: 8 }} />
              )}
              Estimate Timeline
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Results */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <CVisionCard C={C} key={i}>
                <CVisionCardBody style={{ paddingTop: 24 }}>
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 96, marginBottom: 8 }}  />
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 64 }}  />
                </CVisionCardBody>
              </CVisionCard>
            ))}
          </div>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 24 }}>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: '100%', marginBottom: 16 }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: '100%' }}  />
            </CVisionCardBody>
          </CVisionCard>
        </div>
      )}

      {!loading && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            <CVisionCard C={C} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
              <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted, marginBottom: 4 }}>
                  <Briefcase style={{ height: 16, width: 16, color: C.blue }} />
                  Role Level
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>
                  {LEVEL_LABELS[data.level] || data.level}
                </div>
              </CVisionCardBody>
            </CVisionCard>
            <CVisionCard C={C} className="bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20 border-indigo-200 dark:border-indigo-800">
              <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted, marginBottom: 4 }}>
                  <Calendar style={{ height: 16, width: 16 }} />
                  Estimated Time-to-Hire
                </div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {data.estimatedDays} days
                </div>
              </CVisionCardBody>
            </CVisionCard>
            <CVisionCard C={C} className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
              <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textMuted, marginBottom: 4 }}>
                  <Target style={{ height: 16, width: 16 }} />
                  Confidence Score
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>
                    {fmtPercent(data.confidence)}
                  </div>
                  <CVisionBadge C={C}
                    variant="secondary"
                    className={cn(
                      'text-xs',
                      data.confidence >= 80
                        ? 'bg-emerald-100 text-emerald-700'
                        : data.confidence >= 60
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                    )}
                  >
                    {data.confidence >= 80
                      ? 'High'
                      : data.confidence >= 60
                        ? 'Medium'
                        : 'Low'}
                  </CVisionBadge>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          </div>

          {/* Stacked Bar Breakdown */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Hiring Phase Breakdown</div>
              <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left' }}>
                Duration of each phase in the hiring process ({totalDays} total days)
              </div>
            </CVisionCardHeader>
            <CVisionCardBody>
              <HorizontalStackedBar segments={breakdownSegments} total={totalDays} />
            </CVisionCardBody>
          </CVisionCard>

          {/* Phase Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            {breakdownSegments.map((seg, i) => {
              const icons = [
                <Building2 key="s" style={{ height: 20, width: 20 }} />,
                <Users key="sc" style={{ height: 20, width: 20 }} />,
                <LineChart key="i" style={{ height: 20, width: 20 }} />,
                <ShieldCheck key="o" style={{ height: 20, width: 20 }} />,
              ];
              const descriptions = [
                'Candidate sourcing and job posting',
                'Resume screening and initial filtering',
                'Interview rounds and assessments',
                'Offer negotiation and acceptance',
              ];
              return (
                <CVisionCard C={C} key={i} className="border-l-4" style={{ borderLeftColor: seg.color }}>
                  <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
                    <div
                      style={{ marginBottom: 8, padding: 8, borderRadius: 12, backgroundColor: `${seg.color}15` }}
                    >
                      <div style={{ color: seg.color }}>{icons[i]}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>{seg.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{seg.value} days</div>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{descriptions[i]}</p>
                  </CVisionCardBody>
                </CVisionCard>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !data && hasQueried && (
        <CVisionCard C={C} style={{ padding: 48, textAlign: 'center' }}>
          <AlertCircle style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
          <p style={{ color: C.textMuted }}>
            No hiring timeline data returned. Try a different level or department.
          </p>
        </CVisionCard>
      )}

      {!loading && !data && !hasQueried && (
        <CVisionCard C={C} style={{ padding: 48, textAlign: 'center' }}>
          <Clock style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
          <p style={{ color: C.textMuted, fontWeight: 500, marginBottom: 4 }}>No estimate yet</p>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Select a job level and click Estimate Timeline to get a prediction
          </p>
        </CVisionCard>
      )}
    </div>
  );
}

// =============================================================================
// Tab: Cost Breakdown
// =============================================================================

function CostBreakdownTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  const queryClient = useQueryClient();

  const { data: data = null, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.predictive.list({ action: 'cost-forecast' }),
    queryFn: () => fetchPredictive<CostForecastData>('cost-forecast'),
  });

  const forecastMutation = useMutation({
    mutationFn: () => postForecast('costForecast', {}),
    onSuccess: () => {
      toast.success('Cost forecast model updated successfully');
      queryClient.invalidateQueries({ queryKey: cvisionKeys.predictive.list({ action: 'cost-forecast' }) });
    },
    onError: (err: any) => toast.error(err?.message || 'Forecast failed'),
  });
  const running = forecastMutation.isPending;
  const handleRunForecast = useCallback(() => forecastMutation.mutate(), [forecastMutation]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <HeroCardsSkeleton />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <CVisionCard C={C} key={i}>
              <CVisionCardBody style={{ paddingTop: 24 }}>
                <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 96, marginBottom: 8 }}  />
                <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 128 }}  />
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
        <TableSkeleton rows={12} />
      </div>
    );
  }

  if (!data) {
    return (
      <CVisionCard C={C} style={{ padding: 48, textAlign: 'center' }}>
        <AlertCircle style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
        <p style={{ color: C.textMuted }}>No cost forecast data available.</p>
      </CVisionCard>
    );
  }

  const breakdownTotal =
    data.breakdown.salaries +
    data.breakdown.benefits +
    data.breakdown.insurance +
    data.breakdown.training;

  const breakdownItems = [
    {
      label: tr('الرواتب', 'Salaries'),
      value: data.breakdown.salaries,
      color: '#3b82f6',
      icon: <DollarSign style={{ height: 20, width: 20 }} />,
      pct: breakdownTotal > 0 ? (data.breakdown.salaries / breakdownTotal) * 100 : 0,
    },
    {
      label: tr('المزايا', 'Benefits'),
      value: data.breakdown.benefits,
      color: '#6366f1',
      icon: <Heart style={{ height: 20, width: 20 }} />,
      pct: breakdownTotal > 0 ? (data.breakdown.benefits / breakdownTotal) * 100 : 0,
    },
    {
      label: tr('التأمين', 'Insurance'),
      value: data.breakdown.insurance,
      color: '#8b5cf6',
      icon: <ShieldCheck style={{ height: 20, width: 20 }} />,
      pct: breakdownTotal > 0 ? (data.breakdown.insurance / breakdownTotal) * 100 : 0,
    },
    {
      label: tr('التدريب', 'Training'),
      value: data.breakdown.training,
      color: '#a855f7',
      icon: <GraduationCap style={{ height: 20, width: 20 }} />,
      pct: breakdownTotal > 0 ? (data.breakdown.training / breakdownTotal) * 100 : 0,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>Cost Breakdown</h3>
          <p style={{ fontSize: 13, color: C.textMuted }}>
            Comprehensive workforce cost analysis and projections
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark}
          variant="outline"
          size="sm"
          onClick={handleRunForecast}
          disabled={running}
        >
          {running ? (
            <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
          ) : (
            <RefreshCw style={{ height: 16, width: 16, marginRight: 8 }} />
          )}
          Re-run Forecast
        </CVisionButton>
      </div>

      {/* Annual Total Hero */}
      <CVisionCard C={C} className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 border-0 text-white">
        <CVisionCardBody style={{ paddingTop: 24, paddingBottom: 24, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                Annual Projected Cost
              </p>
              <div style={{ fontWeight: 700 }}>{fmtSAR(data.annualProjected)}</div>
              <p style={{ fontSize: 13, marginTop: 4 }}>
                Monthly average: {fmtSAR(data.monthlyCost)}
              </p>
            </div>
            <div style={{ padding: 16 }}>
              <Wallet style={{ height: 40, width: 40 }} />
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
        {breakdownItems.map((item, i) => (
          <CVisionCard C={C}
            key={i}
            className="border-t-4 hover:shadow-md transition-shadow"
            style={{ borderTopColor: item.color }}
          >
            <CVisionCardBody style={{ paddingTop: 24, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div
                  style={{ padding: 8, borderRadius: 12, backgroundColor: `${item.color}15` }}
                >
                  <div style={{ color: item.color }}>{item.icon}</div>
                </div>
                <CVisionBadge C={C} variant="secondary" style={{ fontSize: 12 }}>
                  {fmtPercent(item.pct)}
                </CVisionBadge>
              </div>
              <p style={{ fontSize: 13, color: C.textMuted }}>{item.label}</p>
              <p style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{fmtSAR(item.value)}</p>
              {/* Mini bar */}
              <div style={{ marginTop: 12, height: 6, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                <div
                  style={{ borderRadius: '50%', transition: 'all 0.2s', width: `${item.pct}%`, backgroundColor: item.color }}
                />
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>

      {/* Cost Distribution Visual */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Cost Distribution</div>
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left' }}>
            Proportional breakdown of total workforce costs
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <HorizontalStackedBar
            segments={breakdownItems.map((b) => ({
              label: b.label,
              value: b.value,
              color: b.color,
            }))}
            total={breakdownTotal}
          />
        </CVisionCardBody>
      </CVisionCard>

      {/* Monthly Forecast Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>12-Month Cost Forecast</div>
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left' }}>
            Monthly cost breakdown by category
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Month</th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <div style={{ width: 8, height: 8, background: C.blueDim }} />
                      Salaries
                    </div>
                  </th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <div style={{ width: 8, height: 8 }} />
                      Benefits
                    </div>
                  </th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <div style={{ width: 8, height: 8 }} />
                      Insurance
                    </div>
                  </th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                      <div style={{ width: 8, height: 8, background: C.purpleDim }} />
                      Training
                    </div>
                  </th>
                  <th style={{ textAlign: 'right', paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, fontWeight: 500, color: C.textMuted }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.monthlyForecast.map((row, i) => (
                  <tr
                    key={i}
                    className={cn(
                      'border-b last:border-b-0 hover:bg-muted/50 transition-colors',
                      i % 2 === 0 ? 'bg-muted/20' : ''
                    )}
                  >
                    <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, fontWeight: 500 }}>{row.month}</td>
                    <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{fmtSAR(row.salaries)}</td>
                    <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{fmtSAR(row.benefits)}</td>
                    <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{fmtSAR(row.insurance)}</td>
                    <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>{fmtSAR(row.training)}</td>
                    <td style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 8, paddingRight: 8, textAlign: 'right', fontWeight: 700, color: C.blue }}>
                      {fmtSAR(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8 }}>Annual Total</td>
                  <td style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                    {fmtSAR(
                      data.monthlyForecast.reduce((sum, r) => sum + r.salaries, 0)
                    )}
                  </td>
                  <td style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                    {fmtSAR(
                      data.monthlyForecast.reduce((sum, r) => sum + r.benefits, 0)
                    )}
                  </td>
                  <td style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                    {fmtSAR(
                      data.monthlyForecast.reduce((sum, r) => sum + r.insurance, 0)
                    )}
                  </td>
                  <td style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, textAlign: 'right' }}>
                    {fmtSAR(
                      data.monthlyForecast.reduce((sum, r) => sum + r.training, 0)
                    )}
                  </td>
                  <td style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: 8, paddingRight: 8, textAlign: 'right', color: C.blue }}>
                    {fmtSAR(
                      data.monthlyForecast.reduce((sum, r) => sum + r.total, 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Monthly Cost Bars */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C} style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textAlign: 'left' }}>Monthly Total Cost Trend</div>
          <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'left' }}>
            Visual representation of total monthly costs
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CSSBarChart
            items={data.monthlyForecast.map((f) => ({
              label: f.month,
              values: [
                { value: f.salaries, color: '#3b82f6', label: tr('الرواتب', 'Salaries') },
                { value: f.benefits, color: '#6366f1', label: tr('المزايا', 'Benefits') },
                { value: f.insurance, color: '#8b5cf6', label: tr('التأمين', 'Insurance') },
                { value: f.training, color: '#a855f7', label: tr('التدريب', 'Training') },
              ],
            }))}
            maxValue={Math.max(
              ...data.monthlyForecast.map((f) => f.total),
              1
            )}
            height={260}
            legendItems={[
              { color: '#3b82f6', label: tr('الرواتب', 'Salaries') },
              { color: '#6366f1', label: tr('المزايا', 'Benefits') },
              { color: '#8b5cf6', label: tr('التأمين', 'Insurance') },
              { color: '#a855f7', label: tr('التدريب', 'Training') },
            ]}
          />
        </CVisionCardBody>
      </CVisionCard>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export default function PredictiveAnalyticsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: 8, borderRadius: 16 }}>
            <LineChart style={{ height: 24, width: 24 }} />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Predictive Analytics</h1>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              AI-driven workforce forecasting and planning insights
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'salary', label: 'Salary Forecast' },
          { id: 'headcount', label: 'Headcount' },
          { id: 'hiring', label: 'Hiring Timeline' },
          { id: 'cost', label: 'Cost Breakdown' },
        ]}
      >
        <CVisionTabContent tabId="dashboard">
          <div style={{ marginTop: 24 }}><DashboardTab /></div>
        </CVisionTabContent>
        <CVisionTabContent tabId="salary">
          <div style={{ marginTop: 24 }}><SalaryForecastTab /></div>
        </CVisionTabContent>
        <CVisionTabContent tabId="headcount">
          <div style={{ marginTop: 24 }}><HeadcountTab /></div>
        </CVisionTabContent>
        <CVisionTabContent tabId="hiring">
          <div style={{ marginTop: 24 }}><HiringTimelineTab /></div>
        </CVisionTabContent>
        <CVisionTabContent tabId="cost">
          <div style={{ marginTop: 24 }}><CostBreakdownTab /></div>
        </CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
