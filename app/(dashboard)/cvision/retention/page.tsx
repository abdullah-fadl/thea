'use client';

import { useCVisionTheme, type CVisionPalette } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTextarea, CVisionSelect, CVisionTabs, CVisionTabContent, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { useToast } from '@/hooks/use-toast';
import {
  Brain, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Users, DollarSign, ChevronDown, ChevronUp,
  Eye, Shield, Zap, Clock, Palmtree, BarChart3, GraduationCap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskFactor {
  id: string;
  name: string;
  category: string;
  weight: number;
  score: number;
  weightedScore: number;
  details: string;
  dataPoints: Record<string, any>;
  severity: string;
}

interface Recommendation {
  id: string;
  priority: string;
  action: string;
  category: string;
  estimatedImpact: string;
  estimatedCost?: number;
}

interface RiskProfile {
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;
  jobTitle: string;
  hireDate: string | null;
  tenure: number;
  flightRiskScore: number;
  riskLevel: string;
  riskTrend: string;
  factors: RiskFactor[];
  recommendations: Recommendation[];
  calculatedAt: string;
}

interface DashboardData {
  totalEmployees: number;
  avgRiskScore: number;
  distribution: { low: number; moderate: number; high: number; critical: number };
  topRiskDepartments: { department: string; departmentId: string; avgScore: number }[];
  topRiskFactors: { factor: string; avgScore: number }[];
  estimatedTurnoverRisk: number;
  costOfTurnover: number;
  trend: { delta: number; direction: string } | null;
  activeAlerts: { new: number; acknowledged: number };
}

interface DeptStats {
  department: string;
  departmentId: string;
  employeeCount: number;
  avgRiskScore: number;
  highRiskCount: number;
  criticalRiskCount: number;
  topRiskFactors: { factor: string; avgScore: number }[];
  trend: string;
}

interface RetentionAlert {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentId: string;
  managerId?: string;
  managerName?: string;
  riskScore: number;
  riskLevel: string;
  topFactors: { name: string; score: number }[];
  recommendations: string[];
  status: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  actionTaken?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrgRiskFactor {
  name: string;
  category: string;
  avgScore: number;
  avgWeightedScore: number;
  highSeverityCount: number;
  employeesAffected: number;
}

interface CostData {
  totalEmployees: number;
  totalExpectedLeavers: number;
  totalEstimatedCost: number;
  avgReplacementCost: number;
  costBreakdown: { recruitment: number; lostProductivity: number; trainingNewHire: number };
  byRiskLevel: { level: string; employees: number; expectedLeavers: number; estimatedCost: number }[];
  byDepartment: { department: string; employees: number; expectedLeavers: number; estimatedCost: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API = '/api/cvision/retention';

function apiFetch(url: string) {
  return cvisionFetch(url);
}

function apiPost(body: Record<string, any>) {
  return cvisionMutate(API, 'POST', body);
}

function riskColor(level: string) {
  switch (level) {
    case 'CRITICAL': return 'text-red-600 dark:text-red-400';
    case 'HIGH': return 'text-orange-600 dark:text-orange-400';
    case 'MODERATE': return 'text-amber-600 dark:text-amber-400';
    default: return 'text-green-600 dark:text-green-400';
  }
}

function riskBg(level: string) {
  switch (level) {
    case 'CRITICAL': return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800';
    case 'HIGH': return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-800';
    case 'MODERATE': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800';
    default: return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800';
  }
}

function riskBorder(level: string) {
  switch (level) {
    case 'CRITICAL': return 'border-l-red-600';
    case 'HIGH': return 'border-l-orange-500';
    case 'MODERATE': return 'border-l-amber-400';
    default: return 'border-l-green-500';
  }
}

function riskBadge(level: string) {
  const map: Record<string, string> = {
    CRITICAL: 'bg-red-600 text-white',
    HIGH: 'bg-orange-500 text-white',
    MODERATE: 'bg-amber-400 text-gray-900',
    LOW: 'bg-green-500 text-white',
  };
  return map[level] || map.LOW;
}

function barColor(score: number) {
  if (score >= 75) return 'bg-red-500';
  if (score >= 50) return 'bg-orange-500';
  if (score >= 25) return 'bg-amber-400';
  return 'bg-green-500';
}

function progressColor(score: number): string {
  if (score >= 75) return 'red';
  if (score >= 50) return 'orange';
  if (score >= 25) return 'amber';
  return 'green';
}

function factorIcon(id: string) {
  const icons: Record<string, typeof DollarSign> = {
    salary_stagnation: DollarSign,
    performance_decline: TrendingDown,
    leave_patterns: Palmtree,
    tenure_risk: Clock,
    career_growth: TrendingUp,
    disciplinary: AlertTriangle,
    workload_burnout: Zap,
  };
  const Icon = icons[id] || BarChart3;
  return <Icon className="h-4 w-4" />;
}

function trendIcon(trend: string, C: CVisionPalette) {
  if (trend === 'INCREASING' || trend === 'WORSENING') return <TrendingUp style={{ height: 16, width: 16, color: C.red }} />;
  if (trend === 'DECREASING' || trend === 'IMPROVING') return <TrendingDown style={{ height: 16, width: 16, color: C.green }} />;
  return <Minus style={{ height: 16, width: 16, color: C.textMuted }} />;
}

function formatSAR(n: number) {
  return `SAR ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
}

function tenureLabel(months: number) {
  if (months < 1) return '< 1 month';
  if (months < 12) return `${months} months`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}y ${m}m` : `${y}y`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RetentionPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [calculating, setCalculating] = useState(false);

  // Detail modal
  const [detailProfile, setDetailProfile] = useState<{ profile: RiskProfile; history: Record<string, unknown>[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());

  // Employees filters
  const [empPage, setEmpPage] = useState(1);
  const [empFilter, setEmpFilter] = useState({ riskLevel: '', department: '', search: '' });
  const [empSort, setEmpSort] = useState('flightRiskScore');

  // Alerts filters
  const [alertFilter, setAlertFilter] = useState('');
  const [alertDept, setAlertDept] = useState('');

  // Action modal
  const [actionAlert, setActionAlert] = useState<RetentionAlert | null>(null);
  const [actionText, setActionText] = useState('');
  const [actionSaving, setActionSaving] = useState(false);

  // ----- Data Loading (React Query) -----

  const { data: dashRes, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.retention.list({ action: 'dashboard' }),
    queryFn: () => apiFetch(`${API}?action=dashboard`),
  });
  const dashboard: DashboardData | null = (dashRes as { data?: DashboardData } | undefined)?.data || null;

  const { data: deptRes } = useQuery({
    queryKey: cvisionKeys.retention.list({ action: 'department-stats' }),
    queryFn: () => apiFetch(`${API}?action=department-stats`),
  });
  const deptResData = (deptRes as any)?.data as any;
  const deptStats: DeptStats[] = (Array.isArray(deptResData) ? deptResData : (deptResData as any)?.items || []) as DeptStats[];

  const { data: factorRes } = useQuery({
    queryKey: cvisionKeys.retention.list({ action: 'risk-factors' }),
    queryFn: () => apiFetch(`${API}?action=risk-factors`),
  });
  const factorResData = (factorRes as any)?.data as any;
  const orgFactors: OrgRiskFactor[] = (Array.isArray(factorResData) ? factorResData : (factorResData as any)?.items || []) as OrgRiskFactor[];

  const empParams: Record<string, string> = { action: 'employees', page: String(empPage), limit: '50', sort: empSort };
  if (empFilter.riskLevel) empParams.riskLevel = empFilter.riskLevel;
  if (empFilter.department) empParams.department = empFilter.department;

  const { data: empRes, isLoading: empLoading } = useQuery({
    queryKey: cvisionKeys.retention.list({ ...empParams, search: empFilter.search }),
    queryFn: () => apiFetch(`${API}?${new URLSearchParams(empParams)}`),
    enabled: activeTab === 'employees' || activeTab === 'dashboard',
  });
  const employees: RiskProfile[] = (() => {
    const empResData = (empRes as any)?.data as any;
    let data = (Array.isArray(empResData) ? empResData : (empResData as any)?.items || []) as RiskProfile[];
    if (empFilter.search) {
      const q = empFilter.search.toLowerCase();
      data = data.filter((e: RiskProfile) => e.employeeName.toLowerCase().includes(q));
    }
    return data;
  })();
  const empTotal = ((empRes as any)?.pagination as any)?.total as number || employees.length;

  const alertParams: Record<string, string> = { action: 'alerts' };
  if (alertFilter) alertParams.status = alertFilter;
  if (alertDept) alertParams.department = alertDept;

  const { data: alertRes, isLoading: alertLoading } = useQuery({
    queryKey: cvisionKeys.retention.list(alertParams),
    queryFn: () => apiFetch(`${API}?${new URLSearchParams(alertParams)}`),
    enabled: activeTab === 'alerts',
  });
  const alertResData = (alertRes as any)?.data as any;
  const alerts: RetentionAlert[] = (Array.isArray(alertResData) ? alertResData : (alertResData as any)?.items || []) as RetentionAlert[];

  const { data: costRes, isLoading: costLoading } = useQuery({
    queryKey: cvisionKeys.retention.list({ action: 'cost-analysis' }),
    queryFn: () => apiFetch(`${API}?action=cost-analysis`),
    enabled: activeTab === 'cost',
  });
  const costData: CostData | null = (costRes as { data?: CostData } | undefined)?.data || null;

  const loadDashboard = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.retention.all });
  const loadEmployees = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.retention.list({ action: 'employees' }) });
  const loadAlerts = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.retention.list({ action: 'alerts' }) });
  const loadCost = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.retention.list({ action: 'cost-analysis' }) });

  // Departments list for filters
  const departments = useMemo(() => {
    const set = new Set<string>();
    deptStats.forEach(d => set.add(d.department));
    return Array.from(set).sort();
  }, [deptStats]);

  // High-risk employees for dashboard spotlight
  const spotlightEmployees = useMemo(() => {
    return employees
      .filter(e => e.riskLevel === 'CRITICAL' || e.riskLevel === 'HIGH')
      .sort((a, b) => b.flightRiskScore - a.flightRiskScore)
      .slice(0, 3);
  }, [employees]);

  // ----- Actions -----

  async function handleRecalculate() {
    setCalculating(true);
    toast({ title: 'Recalculating', description: `Analyzing risk for all employees...` });
    try {
      const res = await apiPost({ action: 'calculate' });
      toast({ title: 'Complete', description: `Calculated risk for ${res.data?.calculated || 0} employees. ${res.data?.newAlerts || 0} new alerts.` });
      await loadDashboard();
      if (activeTab === 'employees') await loadEmployees();
      if (activeTab === 'alerts') await loadAlerts();
      if (activeTab === 'cost') await loadCost();
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error)?.message || String(e), variant: 'destructive' });
    } finally {
      setCalculating(false);
    }
  }

  async function openDetail(employeeId: string) {
    setDetailLoading(true);
    setDetailProfile(null);
    setExpandedFactors(new Set());
    try {
      const res = await apiFetch(`${API}?action=employee-detail&employeeId=${employeeId}`);
      setDetailProfile(res.data);
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error)?.message || String(e), variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleAlertAction(alertId: string, action: string, extra?: Record<string, unknown>) {
    try {
      await apiPost({ action, alertId, ...extra });
      toast({ title: 'Updated', description: `Alert ${action.replace('-', ' ')}` });
      loadAlerts();
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error)?.message || String(e), variant: 'destructive' });
    }
  }

  async function handleSaveAction() {
    if (!actionAlert || !actionText.trim()) return;
    setActionSaving(true);
    try {
      await apiPost({ action: 'action-taken', alertId: actionAlert.id, actionTaken: actionText.trim() });
      toast({ title: 'Saved', description: 'Action recorded successfully' });
      setActionAlert(null);
      setActionText('');
      loadAlerts();
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error)?.message || String(e), variant: 'destructive' });
    } finally {
      setActionSaving(false);
    }
  }

  function toggleFactor(id: string) {
    setExpandedFactors(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ----- Loading skeleton -----

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 256 }}  />
            <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 384, marginTop: 8 }}  />
          </div>
          <CVisionSkeletonCard C={C} height={200} style={{ height: 36, width: 144 }}  />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96, borderRadius: 12 }}  />
          ))}
        </div>
        <CVisionSkeletonCard C={C} height={200} style={{ height: 40, width: '100%' }}  />
        <CVisionSkeletonCard C={C} height={200} style={{ width: '100%' }}  />
      </div>
    );
  }

  const dist = dashboard?.distribution || { low: 0, moderate: 0, high: 0, critical: 0 };
  const totalDist = dist.low + dist.moderate + dist.high + dist.critical;

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain style={{ height: 24, width: 24 }} />
            Retention AI
            <CVisionBadge C={C} style={{ fontSize: 12, marginLeft: 4 }}>
              <Zap style={{ height: 12, width: 12, marginRight: 2 }} />
              AI-Powered
            </CVisionBadge>
          </h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            AI-powered employee flight risk prediction and early warning system
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {dashboard?.trend && (
            <span style={{ fontSize: 12, color: C.textMuted }}>
              Last: {dashboard ? formatDate(new Date().toISOString()) : '—'}
            </span>
          )}
          <CVisionButton C={C} isDark={isDark} size="sm" onClick={handleRecalculate} disabled={calculating} style={{ gap: 6 }}>
            {calculating ? <Loader2 style={{ height: 14, width: 14, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ height: 14, width: 14 }} />}
            Recalculate All
          </CVisionButton>
        </div>
      </div>

      {/* Tabs */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'dashboard', label: tr('لوحة التحكم', 'Dashboard') },
          { id: 'employees', label: tr('مخاطر الموظفين', 'Employee Risk') },
          { id: 'alerts', label: tr('التنبيهات', 'Alerts'), badge: dashboard?.activeAlerts?.new || 0 },
          { id: 'cost', label: tr('تحليل التكلفة', 'Cost Analysis') },
        ]}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* ============================================================= */}
        {/* TAB 1: Dashboard                                              */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="dashboard">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Risk Distribution Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {[
              { label: tr('منخفض', 'Low'), scoreRange: '< 25', level: 'LOW', count: dist.low, color: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800' },
              { label: tr('متوسط', 'Moderate'), scoreRange: '26-50', level: 'MODERATE', count: dist.moderate, color: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
              { label: tr('مرتفع', 'High'), scoreRange: '51-75', level: 'HIGH', count: dist.high, color: 'bg-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800' },
              { label: tr('حرج', 'Critical'), scoreRange: '76+', level: 'CRITICAL', count: dist.critical, color: 'bg-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
            ].map(c => (
              <button
                key={c.level}
                onClick={() => { setEmpFilter(f => ({ ...f, riskLevel: c.level })); setActiveTab('employees'); }}
                className={`rounded-lg border p-4 text-left transition-shadow hover:shadow-md ${c.bg} ${c.border}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span className={`h-3 w-3 rounded-full ${c.color}`} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
                </div>
                <div style={{ fontSize: 30, fontWeight: 700 }}>{c.count}</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Score {c.scoreRange}</div>
              </button>
            ))}
          </div>

          {/* Organization Health Meter */}
          {dashboard && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield style={{ height: 20, width: 20, color: C.gold }} />
                <h2 style={{ fontWeight: 600, fontSize: 16 }}>Organization Retention Health</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: C.textMuted }}>Average Risk Score</span>
                  <span className={`font-bold text-lg ${riskColor(dashboard.avgRiskScore >= 75 ? 'CRITICAL' : dashboard.avgRiskScore >= 50 ? 'HIGH' : dashboard.avgRiskScore >= 25 ? 'MODERATE' : 'LOW')}`}>
                    {Math.round(dashboard.avgRiskScore)} / 100
                  </span>
                </div>
                <div style={{ height: 12, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                  <div
                    className={`h-full rounded-full transition-all ${barColor(dashboard.avgRiskScore)}`}
                    style={{ width: `${Math.min(dashboard.avgRiskScore, 100)}%` }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16, paddingTop: 8 }}>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: C.textMuted, display: 'block' }}>Est. 12-month turnover</span>
                  <span style={{ fontWeight: 600 }}>~{Math.round(dashboard.estimatedTurnoverRisk)} employees ({totalDist > 0 ? Math.round(dashboard.estimatedTurnoverRisk / totalDist * 100) : 0}%)</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: C.textMuted, display: 'block' }}>Est. cost of turnover</span>
                  <span style={{ fontWeight: 600 }}>{formatSAR(dashboard.costOfTurnover)}</span>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: C.textMuted, display: 'block' }}>Trend</span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {dashboard.trend ? (
                      <>
                        {trendIcon(dashboard.trend.direction, C)}
                        {dashboard.trend.delta > 0 ? '+' : ''}{dashboard.trend.delta} from last
                      </>
                    ) : 'First calculation'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Top Risk Factors */}
          {orgFactors.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle style={{ height: 16, width: 16 }} />
                Top Risk Factors Across Organization
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orgFactors.slice(0, 5).map((f, i) => (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, color: C.textMuted, width: 16 }}>{i + 1}.</span>
                    <span style={{ fontSize: 16, width: 24 }}>{factorIcon(f.name.toLowerCase().replace(/[^a-z]/g, '_'))}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                        <span className={`font-semibold ${riskColor(f.avgScore >= 75 ? 'CRITICAL' : f.avgScore >= 50 ? 'HIGH' : f.avgScore >= 25 ? 'MODERATE' : 'LOW')}`}>
                          {Math.round(f.avgScore)}/100
                        </span>
                      </div>
                      <div style={{ height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                        <div className={`h-full rounded-full ${barColor(f.avgScore)}`} style={{ width: `${f.avgScore}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Department Risk Heatmap */}
          {deptStats.length > 0 && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users style={{ height: 16, width: 16 }} />
                Department Risk Heatmap
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
                      <th style={{ paddingBottom: 8, fontWeight: 500 }}>Department</th>
                      <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'center' }}>Employees</th>
                      <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'center' }}>Avg Risk</th>
                      <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'center' }}>High/Critical</th>
                      <th style={{ paddingBottom: 8, fontWeight: 500 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptStats
                      .sort((a, b) => b.avgRiskScore - a.avgRiskScore)
                      .map(d => {
                        const level = d.avgRiskScore >= 75 ? 'CRITICAL' : d.avgRiskScore >= 50 ? 'HIGH' : d.avgRiskScore >= 25 ? 'MODERATE' : 'LOW';
                        const statusLabel = level === 'CRITICAL' || level === 'HIGH' ? 'At Risk' : level === 'MODERATE' ? 'Watch' : 'Healthy';
                        return (
                          <tr key={d.departmentId} className={`border-b last:border-0 ${riskBg(level)}`}>
                            <td style={{ paddingTop: 10, paddingBottom: 10, fontWeight: 500 }}>{d.department}</td>
                            <td style={{ paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}>{d.employeeCount}</td>
                            <td style={{ paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}>
                              <span className={`font-semibold ${riskColor(level)}`}>{Math.round(d.avgRiskScore)}</span>
                            </td>
                            <td style={{ paddingTop: 10, paddingBottom: 10, textAlign: 'center' }}>
                              {d.highRiskCount + d.criticalRiskCount > 0 ? (
                                <span style={{ color: C.red, fontWeight: 600 }}>{d.highRiskCount + d.criticalRiskCount}</span>
                              ) : '0'}
                            </td>
                            <td style={{ paddingTop: 10, paddingBottom: 10 }}>
                              <CVisionBadge C={C} className={`${riskBadge(level)} text-xs`}>{statusLabel}</CVisionBadge>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Critical Spotlight */}
          <SpotlightSection employees={spotlightEmployees} onViewDetail={openDetail} onTabSwitch={() => setActiveTab('employees')} />
        </div>
        </CVisionTabContent>

        {/* ============================================================= */}
        {/* TAB 2: Employee Risk                                          */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="employees">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ width: 192 }}>
              <CVisionSelect
                C={C}
                value={empFilter.riskLevel}
                placeholder="Risk Level"
                options={[
                  { value: 'ALL', label: tr('كل المستويات', 'All Levels') },
                  { value: 'CRITICAL', label: tr('حرج', 'Critical') },
                  { value: 'HIGH', label: tr('مرتفع', 'High') },
                  { value: 'MODERATE', label: tr('متوسط', 'Moderate') },
                  { value: 'LOW', label: tr('منخفض', 'Low') },
                ]}
                style={{ height: 36 }}
              />
            </div>
            <div style={{ width: 192 }}>
              <CVisionSelect
                C={C}
                value={empFilter.department || 'ALL'}
                placeholder="Department"
                options={[
                  { value: 'ALL', label: tr('كل الأقسام', 'All Departments') },
                  ...departments.map(d => ({ value: d, label: d })),
                ]}
                style={{ height: 36 }}
              />
            </div>
            <CVisionInput C={C}
              placeholder="Search by name..."
              value={empFilter.search}
              onChange={e => setEmpFilter(f => ({ ...f, search: e.target.value }))}
              style={{ width: 192, height: 36 }}
            />
            <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={handleRecalculate} disabled={calculating} style={{ gap: 6, height: 36 }}>
              {calculating ? <Loader2 style={{ height: 14, width: 14, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ height: 14, width: 14 }} />}
              Recalculate
            </CVisionButton>
          </div>

          {empLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 192, borderRadius: 12 }}  />)}
            </div>
          ) : employees.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
              <Brain style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.3 }} />
              <p>No employees match the selected filters.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {employees.map(emp => (
                <EmployeeRiskCard key={emp.employeeId} profile={emp} onViewDetail={() => openDetail(emp.employeeId)} />
              ))}

              {/* Pagination */}
              {empTotal > 50 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 16 }}>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" disabled={empPage <= 1} onClick={() => setEmpPage(p => p - 1)}>Previous</CVisionButton>
                  <span style={{ fontSize: 13, color: C.textMuted }}>Page {empPage} of {Math.ceil(empTotal / 50)}</span>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" disabled={empPage >= Math.ceil(empTotal / 50)} onClick={() => setEmpPage(p => p + 1)}>Next</CVisionButton>
                </div>
              )}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ============================================================= */}
        {/* TAB 3: Alerts                                                 */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="alerts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {[
              { label: tr('جديد', 'New'), count: alerts.filter(a => a.status === 'NEW').length, color: 'text-red-600' },
              { label: tr('مقروء', 'Acknowledged'), count: alerts.filter(a => a.status === 'ACKNOWLEDGED').length, color: 'text-amber-600' },
              { label: 'Action Taken', count: alerts.filter(a => a.status === 'ACTION_TAKEN').length, color: 'text-blue-600' },
              { label: 'Total Active', count: alerts.length, color: 'text-foreground' },
            ].map(s => (
              <div key={s.label} style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, textAlign: 'center' }}>
                <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <CVisionSelect
                C={C}
                value={alertFilter || 'ACTIVE'}
                placeholder="Status"
                options={[
                  { value: 'ACTIVE', label: 'New + Acknowledged' },
                  { value: 'NEW', label: 'New Only' },
                  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
                  { value: 'ACTION_TAKEN', label: 'Action Taken' },
                  { value: 'RESOLVED', label: 'Resolved' },
                  { value: 'DISMISSED', label: 'Dismissed' },
                ]}
                style={{ width: 176, height: 36 }}
              />
            <CVisionSelect
                C={C}
                value={alertDept || 'ALL'}
                placeholder="Department"
                options={[
                  { value: 'ALL', label: tr('كل الأقسام', 'All Departments') },
                  ...departments.map(d => ({ value: d, label: d })),
                ]}
                style={{ width: 176, height: 36 }}
              />
          </div>

          {alertLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{Array.from({ length: 3 }).map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 160, borderRadius: 12 }}  />)}</div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 64, paddingBottom: 64, color: C.textMuted }}>
              <Shield style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.3 }} />
              <p>No alerts match the selected filters.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {alerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={() => handleAlertAction(alert.id, 'acknowledge-alert')}
                  onTakeAction={() => { setActionAlert(alert); setActionText(alert.recommendations?.join('\n') || ''); }}
                  onResolve={() => handleAlertAction(alert.id, 'resolve-alert')}
                  onDismiss={() => handleAlertAction(alert.id, 'dismiss-alert')}
                />
              ))}
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ============================================================= */}
        {/* TAB 4: Cost Analysis                                          */}
        {/* ============================================================= */}
        <CVisionTabContent tabId="cost">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {costLoading || !costData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 192, borderRadius: 12 }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 256, borderRadius: 12 }}  />
            </div>
          ) : (
            <CostTab data={costData} />
          )}
        </div>
        </CVisionTabContent>
      </CVisionTabs>

      {/* Detail Modal */}
      <CVisionDialog C={C} open={!!detailProfile || detailLoading} onClose={() => setDetailProfile(null)} title="Employee Profile" isDark={isDark}>
          {detailLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 32, paddingBottom: 32 }}>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 256 }}  />
              <CVisionSkeletonCard C={C} height={200} style={{ height: 16, width: 192 }}  />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>{Array.from({ length: 7 }).map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 56 }}  />)}</div>
            </div>
          ) : detailProfile ? (
            <DetailView
              profile={detailProfile.profile}
              history={detailProfile.history}
              expandedFactors={expandedFactors}
              onToggleFactor={toggleFactor}
            />
          ) : null}
      </CVisionDialog>

      {/* Action Modal */}
      <CVisionDialog C={C} open={!!actionAlert} onClose={() => setActionAlert(null)} title="Action Alert" isDark={isDark}>                      {actionAlert && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: C.textMuted }}>
                For: <span style={{ fontWeight: 500 }}>{actionAlert.employeeName}</span> — Risk: {actionAlert.riskScore}/100
              </div>
              <CVisionTextarea C={C}
                value={actionText}
                onChange={e => setActionText(e.target.value)}
                placeholder="Describe the action taken..."
                rows={5}
              />
            </div>
          )}
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setActionAlert(null)}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSaveAction} disabled={actionSaving || !actionText.trim()}>
              {actionSaving ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 4 }} /> : null}
              Save Action
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SpotlightSection({ employees, onViewDetail, onTabSwitch }: {
  employees: RiskProfile[];
  onViewDetail: (id: string) => void;
  onTabSwitch: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  if (employees.length === 0) return null;

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.redDim, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: C.red }}>
        <AlertTriangle style={{ height: 20, width: 20 }} />
        Immediate Attention Required
      </h2>

      <div style={{ display: 'grid', gap: 16 }}>
        {employees.map(emp => (
          <div key={emp.employeeId} className={`rounded-lg border p-4 space-y-3 ${riskBg(emp.riskLevel)}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <CVisionBadge C={C} className={`${riskBadge(emp.riskLevel)} font-bold`}>{emp.riskLevel} {emp.flightRiskScore}/100</CVisionBadge>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{emp.employeeName}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{emp.department} · {emp.jobTitle} · {tenureLabel(emp.tenure)}</div>
            </div>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {emp.factors
                .sort((a, b) => b.weightedScore - a.weightedScore)
                .slice(0, 3)
                .map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{factorIcon(f.id)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}: {f.score}/100</span>
                  </div>
                ))}
            </div>
            {emp.recommendations[0] && (
              <div style={{ fontSize: 12, borderRadius: 6, padding: 8 }}>
                <span style={{ fontWeight: 500 }}>AI: </span>
                {emp.recommendations[0].action}
                {emp.recommendations[0].estimatedImpact && (
                  <span style={{ color: C.green, marginLeft: 4 }}>({emp.recommendations[0].estimatedImpact})</span>
                )}
              </div>
            )}
            <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ width: '100%', height: 28, fontSize: 12 }} onClick={() => onViewDetail(emp.employeeId)}>
              <Eye style={{ height: 12, width: 12, marginRight: 4 }} /> View Full Profile
            </CVisionButton>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmployeeRiskCard({ profile, onViewDetail }: { profile: RiskProfile; onViewDetail: () => void }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div className={`rounded-lg border border-l-4 ${riskBorder(profile.riskLevel)} p-4 space-y-3`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold border-2 ${riskBg(profile.riskLevel)}`}>
            <span className={riskColor(profile.riskLevel)}>{profile.flightRiskScore}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              {profile.employeeName}
              <CVisionBadge C={C} className={`${riskBadge(profile.riskLevel)} text-[10px]`}>{profile.riskLevel}</CVisionBadge>
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              {profile.department} · {profile.jobTitle} · {tenureLabel(profile.tenure)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          {trendIcon(profile.riskTrend, C)}
          <span style={{ color: C.textMuted }}>
            {profile.riskTrend === 'INCREASING' ? 'Rising' : profile.riskTrend === 'DECREASING' ? 'Improving' : 'Stable'}
          </span>
        </div>
      </div>

      {/* Factor bars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)' }}>
        {profile.factors
          .sort((a, b) => b.score - a.score)
          .map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ width: 20, textAlign: 'center' }}>{factorIcon(f.id)}</span>
              <span style={{ width: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.textMuted }}>{f.name.replace(/ \/ /g, '/')}</span>
              <div style={{ flex: 1, height: 8, background: C.bgSubtle, borderRadius: '50%', overflow: 'hidden' }}>
                <div className={`h-full rounded-full ${barColor(f.score)}`} style={{ width: `${f.score}%` }} />
              </div>
              <span className={`w-6 text-right font-medium ${riskColor(f.score >= 75 ? 'CRITICAL' : f.score >= 50 ? 'HIGH' : f.score >= 25 ? 'MODERATE' : 'LOW')}`}>
                {f.score}
              </span>
            </div>
          ))}
      </div>

      {/* Top recommendation */}
      {profile.recommendations[0] && (
        <div style={{ fontSize: 12, borderRadius: 6, padding: 8, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <Brain style={{ height: 14, width: 14, marginTop: 2 }} />
          <span>{profile.recommendations[0].action}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12, gap: 4 }} onClick={onViewDetail}>
          <Eye style={{ height: 12, width: 12 }} /> View Details
        </CVisionButton>
      </div>
    </div>
  );
}

function DetailView({ profile, history, expandedFactors, onToggleFactor }: {
  profile: RiskProfile;
  history: Record<string, unknown>[];
  expandedFactors: Set<string>;
  onToggleFactor: (id: string) => void;
}) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>        
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Left: Factors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Risk Factors (7)</h3>
          {profile.factors
            .sort((a, b) => b.weightedScore - a.weightedScore)
            .map(f => {
              const isExpanded = expandedFactors.has(f.id);
              return (
                <div key={f.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <button
                    onClick={() => onToggleFactor(f.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: 12, textAlign: 'left', transition: 'color 0.2s, background 0.2s' }}
                  >
                    <span style={{ fontSize: 14 }}>{factorIcon(f.id)}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span className={`text-sm font-bold ${riskColor(f.score >= 75 ? 'CRITICAL' : f.score >= 50 ? 'HIGH' : f.score >= 25 ? 'MODERATE' : 'LOW')}`}>
                      {f.score}/100
                    </span>
                    <CVisionBadge C={C} variant="outline" style={{ marginLeft: 4 }}>{f.severity}</CVisionBadge>
                    {isExpanded ? <ChevronUp style={{ height: 14, width: 14 }} /> : <ChevronDown style={{ height: 14, width: 14 }} />}
                  </button>
                  {isExpanded && (
                    <div style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 12, fontSize: 12, color: C.textMuted, display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
                      <div>Weight: <span style={{ fontWeight: 500 }}>{f.weight}%</span> · Weighted: <span style={{ fontWeight: 500 }}>{f.weightedScore.toFixed(1)}</span></div>
                      <div>{f.details}</div>
                      {Object.entries(f.dataPoints).length > 0 && (
                        <div style={{ marginTop: 8, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {Object.entries(f.dataPoints).map(([k, v]) => (
                            <div key={k}><span style={{ fontWeight: 500 }}>{k}:</span> {typeof v === 'number' ? v.toLocaleString() : String(v)}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Right: Recommendations + History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* History */}
          {history.length > 0 && (
            <div>
              <h3 style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Score History</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 96, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                {history.slice().reverse().map((h, i) => {
                  const pct = Number(h.flightRiskScore) || 0;
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: 4 }}>
                      <span className={`text-xs font-bold ${riskColor(pct >= 75 ? 'CRITICAL' : pct >= 50 ? 'HIGH' : pct >= 25 ? 'MODERATE' : 'LOW')}`}>{pct}</span>
                      <div style={{ width: '100%', background: C.bgSubtle, overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                        <div className={`w-full rounded-t ${barColor(pct)}`} style={{ height: `${Math.max(pct, 5)}%` }} />
                      </div>
                      <span style={{ color: C.textMuted }}>{h.calculatedAt ? new Date(h.calculatedAt as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <h3 style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Brain style={{ height: 16, width: 16 }} />
              AI Recommendations
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {profile.recommendations.map(r => {
                const priorityColor = r.priority === 'URGENT' ? 'border-red-400 bg-red-50 dark:bg-red-950/20'
                  : r.priority === 'HIGH' ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20'
                  : r.priority === 'MEDIUM' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/20'
                  : 'border-green-400 bg-green-50 dark:bg-green-950/20';
                return (
                  <div key={r.id} className={`text-xs rounded-lg border p-2.5 ${priorityColor}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <CVisionBadge C={C} variant="outline" className="text-[10px]">{r.priority}</CVisionBadge>
                      <span style={{ color: C.textMuted }}>{r.category}</span>
                    </div>
                    <div style={{ fontWeight: 500 }}>{r.action}</div>
                    {r.estimatedImpact && <div style={{ color: C.green, marginTop: 2 }}>{r.estimatedImpact}</div>}
                    {r.estimatedCost != null && r.estimatedCost > 0 && <div style={{ color: C.textMuted, marginTop: 2 }}>Cost: {formatSAR(r.estimatedCost)}/mo</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert, onAcknowledge, onTakeAction, onResolve, onDismiss }: {
  alert: RetentionAlert;
  onAcknowledge: () => void;
  onTakeAction: () => void;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const statusColor: Record<string, string> = {
    NEW: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    ACKNOWLEDGED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ACTION_TAKEN: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    DISMISSED: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  };

  return (
    <div className={`rounded-lg border border-l-4 ${riskBorder(alert.riskLevel)} p-4 space-y-3`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionBadge C={C} className={statusColor[alert.status] || ''}>{alert.status.replace('_', ' ')}</CVisionBadge>
          <span className={`font-bold ${riskColor(alert.riskLevel)}`}>Risk: {alert.riskScore}/100</span>
        </div>
        <span style={{ fontSize: 12, color: C.textMuted }}>{formatDate(alert.createdAt)}</span>
      </div>

      <div>
        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle style={{ height: 16, width: 16, color: C.red }} />
          High Flight Risk: {alert.employeeName}
        </div>
        <div style={{ fontSize: 13, color: C.textMuted }}>{alert.department}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          Manager: {alert.managerName || 'Not assigned'}
        </div>
      </div>

      {alert.topFactors.length > 0 && (
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontWeight: 500, color: C.textMuted }}>Top Risk Factors:</div>
          {alert.topFactors.map((f, i) => (
            <div key={i}>{i + 1}. {f.name} ({Math.round(f.score)}/100)</div>
          ))}
        </div>
      )}

      {alert.recommendations.length > 0 && (
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontWeight: 500, color: C.textMuted }}>Recommended:</div>
          {alert.recommendations.slice(0, 3).map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
              <span style={{ color: C.textMuted }}>•</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      )}

      {alert.actionTaken && (
        <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
          <div style={{ fontSize: 13, color: C.textSecondary }}>
            <span style={{ fontWeight: 500 }}>Action taken: </span>{alert.actionTaken}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {alert.status === 'NEW' && (
          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} onClick={onAcknowledge}>Acknowledge</CVisionButton>
        )}
        {(alert.status === 'NEW' || alert.status === 'ACKNOWLEDGED') && (
          <CVisionButton C={C} isDark={isDark} size="sm" style={{ height: 28, fontSize: 12 }} onClick={onTakeAction}>Take Action</CVisionButton>
        )}
        {alert.status === 'ACTION_TAKEN' && (
          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12, color: C.green }} onClick={onResolve}>Resolve</CVisionButton>
        )}
        {(alert.status === 'NEW' || alert.status === 'ACKNOWLEDGED') && (
          <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, fontSize: 12, color: C.textMuted }} onClick={onDismiss}>Dismiss</CVisionButton>
        )}
      </div>
    </div>
  );
}

function CostTab({ data }: { data: CostData }) {
  const { C, isDark } = useCVisionTheme();
  const retentionCost = Math.round(data.totalEstimatedCost * 0.1);
  const roi = retentionCost > 0 ? Math.round(data.totalEstimatedCost / retentionCost * 10) / 10 : 0;
  const maxCost = Math.max(data.totalEstimatedCost, retentionCost, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Main cost card */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <DollarSign style={{ height: 20, width: 20 }} />
          Estimated Cost of Employee Turnover
        </h2>

        <div style={{ fontSize: 13, color: C.textMuted }}>
          If high-risk employees leave within 12 months:
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ borderRadius: 12, background: C.redDim, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Recruitment (~3 months salary)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.red }}>{formatSAR(data.costBreakdown.recruitment)}</div>
            <div style={{ color: C.textMuted }}>per replacement</div>
          </div>
          <div style={{ borderRadius: 12, background: C.orangeDim, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Lost Productivity (~2 months)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{formatSAR(data.costBreakdown.lostProductivity)}</div>
            <div style={{ color: C.textMuted }}>per replacement</div>
          </div>
          <div style={{ borderRadius: 12, background: C.orangeDim, border: `1px solid ${C.border}`, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Training New Hire (~1 month)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.orange }}>{formatSAR(data.costBreakdown.trainingNewHire)}</div>
            <div style={{ color: C.textMuted }}>per replacement</div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: C.textMuted }}>Total Estimated Turnover Cost</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: C.red }}>{formatSAR(data.totalEstimatedCost)}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              ~{data.totalExpectedLeavers} expected departures · Avg replacement: {formatSAR(data.avgReplacementCost)}
            </div>
          </div>
        </div>
      </div>

      {/* Retention vs Turnover comparison */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontWeight: 600 }}>Retention vs. Replacement Cost</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: C.red, fontWeight: 500 }}>Cost to Replace</span>
              <span style={{ fontWeight: 700 }}>{formatSAR(data.totalEstimatedCost)}</span>
            </div>
            <div style={{ height: 24, background: C.bgSubtle, borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{ background: C.redDim, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontWeight: 500, width: `${(data.totalEstimatedCost / maxCost) * 100}%`, minWidth: 60 }}
              >
                Turnover
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: C.green, fontWeight: 500 }}>Cost to Retain (est.)</span>
              <span style={{ fontWeight: 700 }}>{formatSAR(retentionCost)}/yr</span>
            </div>
            <div style={{ height: 24, background: C.bgSubtle, borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{ background: C.greenDim, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, fontWeight: 500, width: `${Math.max((retentionCost / maxCost) * 100, 5)}%`, minWidth: 60 }}
              >
                Retain
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgSubtle }}>
          <div style={{ fontSize: 13, color: C.textSecondary }}>
            Investing in retention saves <strong>{roi}x</strong> the cost of replacement. Estimated annual retention investment: <strong>{formatSAR(retentionCost)}</strong>.
          </div>
        </div>
      </div>

      {/* By Risk Level */}
      {data.byRiskLevel.length > 0 && (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontWeight: 600 }}>Cost by Risk Level</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
                  <th style={{ paddingBottom: 8, fontWeight: 500 }}>Level</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'center' }}>Employees</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'center' }}>Expected Leavers</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Estimated Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.byRiskLevel.map(r => (
                  <tr key={r.level} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ paddingTop: 8, paddingBottom: 8 }}><CVisionBadge C={C} className={`${riskBadge(r.level)} text-xs`}>{r.level}</CVisionBadge></td>
                    <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>{r.employees}</td>
                    <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>{r.expectedLeavers}</td>
                    <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'right', fontWeight: 500 }}>{formatSAR(r.estimatedCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Department */}
      {data.byDepartment.length > 0 && (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 style={{ fontWeight: 600 }}>Cost by Department</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, textAlign: 'left' }}>
                  <th style={{ paddingBottom: 8, fontWeight: 500 }}>Department</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'center' }}>At Risk</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Est. Turnover Cost</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>Est. Retention Cost</th>
                  <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: 'right' }}>ROI</th>
                </tr>
              </thead>
              <tbody>
                {data.byDepartment.map(d => {
                  const dRetain = Math.round(d.estimatedCost * 0.1);
                  const dRoi = dRetain > 0 ? Math.round(d.estimatedCost / dRetain * 10) / 10 : 0;
                  return (
                    <tr key={d.department} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ paddingTop: 8, paddingBottom: 8, fontWeight: 500 }}>{d.department}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>{d.employees}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'right', color: C.red }}>{formatSAR(d.estimatedCost)}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'right', color: C.green }}>{dRetain > 0 ? `${formatSAR(dRetain)}/yr` : '—'}</td>
                      <td style={{ paddingTop: 8, paddingBottom: 8, textAlign: 'right', fontWeight: 500 }}>{dRoi > 0 ? `${dRoi}x` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
