'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/hooks/use-lang';
import { cn } from '@/lib/utils';
import {
  Brain, TrendingUp, DollarSign, Wrench, ShieldCheck, AlertTriangle,
  BarChart3, Calendar, ChevronDown, Activity, Building2, Layers,
  ArrowUpRight, ArrowDownRight, Cpu, CircleDot, Target, Award,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ── Types ───────────────────────────────────────────────────────────────

interface AnnualPlan {
  fiscalYear: number;
  capitalBudget: number;
  operationalBudget: number;
  maintenanceBudget: number;
  totalAllocated: number;
  totalConsumed: number;
  aiSavings: number;
}

interface DeviceReplacement {
  id: string;
  assetName: string;
  assetNameAr?: string;
  department: string;
  departmentAr?: string;
  currentAgeYears: number;
  expectedLifeYears: number;
  aiRiskScore: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedCost: number;
  compatibilityIssues: boolean;
}

interface PhasedInvestment {
  phaseNumber: number;
  year: number;
  amount: number;
  itemsCount: number;
  priorityScore: number;
  label: string;
  labelAr?: string;
}

interface Proposal {
  id: string;
  department: string;
  departmentAr?: string;
  category: string;
  categoryAr?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  requestedAmount: number;
  approvedAmount: number;
  roiPercent: number;
  clinicalImpactScore: number;
  aiRecommendation: string;
  aiRecommendationAr?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEFERRED';
}

interface Benchmark {
  metricKey: string;
  metricName: string;
  metricNameAr?: string;
  hospitalValue: number;
  networkAverage: number;
  networkBest: number;
  unit: string;
  percentileRank: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatSAR(amount: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(amount);
}

const URGENCY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-[#8B4513]/10 text-[#8B4513]',
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-[#D4A017]/10 text-[#D4A017]',
  LOW: 'bg-[#6B8E23]/10 text-[#6B8E23]',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-[#D4A017]/10 text-[#D4A017]',
  APPROVED: 'bg-[#6B8E23]/10 text-[#6B8E23]',
  REJECTED: 'bg-[#8B4513]/10 text-[#8B4513]',
  DEFERRED: 'bg-gray-100 text-gray-600',
};

const PRIORITY_COLORS = URGENCY_COLORS;

const PHASE_COLORS = ['#D4A017', '#6B8E23', '#556B2F', '#8B4513'];

// ── Page Component ──────────────────────────────────────────────────────

export default function BudgetGovernancePage() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);

  const [fiscalYear, setFiscalYear] = useState(2026);
  const [plan, setPlan] = useState<AnnualPlan | null>(null);
  const [devices, setDevices] = useState<DeviceReplacement[]>([]);
  const [phases, setPhases] = useState<PhasedInvestment[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<'priority' | 'requestedAmount'>('priority');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `?fiscalYear=${fiscalYear}`;
      const [planRes, proposalsRes, devicesRes, phasesRes, benchRes] = await Promise.all([
        fetch(`/api/imdad/budget-governance/annual-plans${qs}`),
        fetch(`/api/imdad/budget-governance/proposals${qs}`),
        fetch(`/api/imdad/budget-governance/device-intelligence${qs}`),
        fetch(`/api/imdad/budget-governance/phased-investments${qs}`),
        fetch(`/api/imdad/budget-governance/benchmarks${qs}`),
      ]);
      if (planRes.ok) { const d = await planRes.json(); setPlan(d.plan ?? d); }
      if (proposalsRes.ok) { const d = await proposalsRes.json(); setProposals(d.items ?? d ?? []); }
      if (devicesRes.ok) { const d = await devicesRes.json(); setDevices(d.items ?? d ?? []); }
      if (phasesRes.ok) { const d = await phasesRes.json(); setPhases(d.items ?? d ?? []); }
      if (benchRes.ok) { const d = await benchRes.json(); setBenchmarks(d.items ?? d ?? []); }
    } catch { /* silently handle */ }
    setLoading(false);
  }, [fiscalYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const budgetHealth = plan ? Math.round(((plan.totalAllocated - plan.totalConsumed) / plan.totalAllocated) * 100) : 0;
  const healthColor = budgetHealth >= 40 ? 'text-[#6B8E23]' : budgetHealth >= 20 ? 'text-[#D4A017]' : 'text-[#8B4513]';

  const totalReplCost = devices.reduce((s, d) => s + d.estimatedCost, 0);
  const avgRisk = devices.length ? Math.round(devices.reduce((s, d) => s + d.aiRiskScore, 0) / devices.length) : 0;
  const atRiskCount = devices.filter(d => d.aiRiskScore >= 60).length;

  const totalInvestment = phases.reduce((s, p) => s + p.amount, 0);

  const sortedProposals = [...proposals].sort((a, b) => {
    if (sortField === 'priority') {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
    }
    return b.requestedAmount - a.requestedAmount;
  });

  const priorityLabel = (p: string) => {
    const m: Record<string, [string, string]> = {
      CRITICAL: ['حرج', 'Critical'], HIGH: ['عالي', 'High'],
      MEDIUM: ['متوسط', 'Medium'], LOW: ['منخفض', 'Low'],
    };
    return tr(m[p]?.[0] ?? p, m[p]?.[1] ?? p);
  };

  const statusLabel = (s: string) => {
    const m: Record<string, [string, string]> = {
      PENDING: ['قيد الانتظار', 'Pending'], APPROVED: ['معتمد', 'Approved'],
      REJECTED: ['مرفوض', 'Rejected'], DEFERRED: ['مؤجل', 'Deferred'],
    };
    return tr(m[s]?.[0] ?? s, m[s]?.[1] ?? s);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-4 border-[#D4A017] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6 p-6', language === 'ar' && 'text-right')} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#D4A017]/10">
            <Brain className="h-5 w-5 text-[#D4A017]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tr('الحوكمة المالية الذكية', 'Intelligent Budget Governance')}
            </h1>
            <p className="text-sm text-gray-500">
              {tr('الدماغ المالي المستقل', 'Autonomous Financial Brain')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Fiscal Year Selector */}
          <div className="relative">
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:border-[#D4A017] focus:outline-none focus:ring-1 focus:ring-[#D4A017]"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{tr(`السنة المالية ${y}`, `FY ${y}`)}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
          {/* Budget Health */}
          <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold', healthColor)}>
            <ShieldCheck className="h-4 w-4" />
            {tr('صحة الميزانية', 'Budget Health')}: {budgetHealth}%
          </div>
        </div>
      </div>

      {/* ── BUDGET OVERVIEW CARDS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          icon={<DollarSign className="h-5 w-5 text-[#D4A017]" />}
          title={tr('ميزانية رأس المال', 'Capital Budget')}
          value={formatSAR(plan?.capitalBudget ?? 0)}
          bgClass="bg-[#D4A017]/5 border-[#D4A017]/20"
        />
        <OverviewCard
          icon={<Activity className="h-5 w-5 text-[#6B8E23]" />}
          title={tr('الميزانية التشغيلية', 'Operational Budget')}
          value={formatSAR(plan?.operationalBudget ?? 0)}
          bgClass="bg-[#6B8E23]/5 border-[#6B8E23]/20"
        />
        <OverviewCard
          icon={<Wrench className="h-5 w-5 text-[#556B2F]" />}
          title={tr('ميزانية الصيانة', 'Maintenance Budget')}
          value={formatSAR(plan?.maintenanceBudget ?? 0)}
          bgClass="bg-[#556B2F]/5 border-[#556B2F]/20"
        />
        <OverviewCard
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          title={tr('وفورات الذكاء الاصطناعي', 'AI Optimization Savings')}
          value={formatSAR(plan?.aiSavings ?? 0)}
          bgClass="bg-green-50 border-green-200"
          highlight
        />
      </div>

      {/* ── DEVICE REPLACEMENT INTELLIGENCE ────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#D4A017]" />
            <h2 className="text-lg font-semibold text-gray-900">
              {tr('ذكاء دورة حياة الأجهزة', 'Device Lifecycle Intelligence')}
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>{tr('أجهزة معرّضة', 'At Risk')}: <strong className="text-[#8B4513]">{atRiskCount}</strong></span>
            <span>{tr('تكلفة الاستبدال', 'Replacement Cost')}: <strong>{formatSAR(totalReplCost)}</strong></span>
            <span>{tr('متوسط المخاطر', 'Avg Risk')}: <strong>{avgRisk}</strong></span>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <ShieldCheck className="mb-2 h-10 w-10" />
            <p className="text-sm">{tr('لا توجد أجهزة تحتاج استبدال حالياً', 'No devices currently require replacement')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                  <th className="px-3 py-2 text-start">{tr('الجهاز', 'Asset')}</th>
                  <th className="px-3 py-2 text-start">{tr('القسم', 'Department')}</th>
                  <th className="px-3 py-2 text-center">{tr('العمر / المتوقع', 'Age / Expected')}</th>
                  <th className="px-3 py-2 text-center">{tr('درجة المخاطر', 'Risk Score')}</th>
                  <th className="px-3 py-2 text-center">{tr('الاستعجال', 'Urgency')}</th>
                  <th className="px-3 py-2 text-end">{tr('التكلفة', 'Est. Cost')}</th>
                  <th className="px-3 py-2 text-center">{tr('التوافق', 'Compat.')}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {tr(d.assetNameAr ?? d.assetName, d.assetName)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {tr(d.departmentAr ?? d.department, d.department)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-600">
                      {d.currentAgeYears} / {d.expectedLifeYears} {tr('سنة', 'yr')}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-gray-200">
                          <div
                            className={cn('h-2 rounded-full', d.aiRiskScore >= 80 ? 'bg-[#8B4513]' : d.aiRiskScore >= 50 ? 'bg-[#D4A017]' : 'bg-[#6B8E23]')}
                            style={{ width: `${d.aiRiskScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold">{d.aiRiskScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', URGENCY_COLORS[d.urgency])}>
                        {priorityLabel(d.urgency)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-end font-medium text-gray-900">{formatSAR(d.estimatedCost)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {d.compatibilityIssues ? (
                        <AlertTriangle className="mx-auto h-4 w-4 text-[#8B4513]" />
                      ) : (
                        <ShieldCheck className="mx-auto h-4 w-4 text-[#6B8E23]" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── PHASED INVESTMENT STRATEGY ─────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#556B2F]" />
            <h2 className="text-lg font-semibold text-gray-900">
              {tr('خارطة الاستثمار متعددة السنوات', 'Multi-Year Investment Roadmap')}
            </h2>
          </div>
          <span className="text-sm font-semibold text-gray-600">
            {tr('إجمالي الاستثمار', 'Total Investment')}: {formatSAR(totalInvestment)}
          </span>
        </div>

        {phases.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            {tr('لا توجد خطط استثمارية حالياً', 'No investment plans available')}
          </p>
        ) : (
          <>
            {/* Phase Cards */}
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {phases.map((p, i) => (
                <div
                  key={p.phaseNumber}
                  className="rounded-lg border border-gray-100 p-4"
                  style={{ borderLeftColor: PHASE_COLORS[i % PHASE_COLORS.length], borderLeftWidth: 4 }}
                >
                  <div className="mb-1 text-xs font-medium text-gray-500">
                    {tr(`المرحلة ${p.phaseNumber}`, `Phase ${p.phaseNumber}`)} — {p.year}
                  </div>
                  <div className="text-lg font-bold text-gray-900">{formatSAR(p.amount)}</div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                    <span>{p.itemsCount} {tr('عنصر', 'items')}</span>
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" /> {tr('أولوية', 'Priority')}: {p.priorityScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Phase Bar Chart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={phases.map((p, i) => ({
                  name: tr(`المرحلة ${p.phaseNumber}`, `Phase ${p.phaseNumber}`),
                  amount: p.amount,
                  fill: PHASE_COLORS[i % PHASE_COLORS.length],
                }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => formatSAR(v)} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {phases.map((_, i) => (
                      <Cell key={i} fill={PHASE_COLORS[i % PHASE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      {/* ── DEPARTMENT PROPOSALS ────────────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#6B8E23]" />
            <h2 className="text-lg font-semibold text-gray-900">
              {tr('مقترحات ميزانية الأقسام', 'Department Budget Proposals')}
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSortField('priority')}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', sortField === 'priority' ? 'bg-[#D4A017]/10 text-[#D4A017]' : 'text-gray-500 hover:bg-gray-50')}
            >
              {tr('حسب الأولوية', 'By Priority')}
            </button>
            <button
              onClick={() => setSortField('requestedAmount')}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', sortField === 'requestedAmount' ? 'bg-[#D4A017]/10 text-[#D4A017]' : 'text-gray-500 hover:bg-gray-50')}
            >
              {tr('حسب المبلغ', 'By Amount')}
            </button>
          </div>
        </div>

        {proposals.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            {tr('لا توجد مقترحات حالياً', 'No proposals available')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-500">
                  <th className="px-3 py-2 text-start">{tr('القسم', 'Department')}</th>
                  <th className="px-3 py-2 text-start">{tr('الفئة', 'Category')}</th>
                  <th className="px-3 py-2 text-center">{tr('الأولوية', 'Priority')}</th>
                  <th className="px-3 py-2 text-end">{tr('المطلوب', 'Requested')}</th>
                  <th className="px-3 py-2 text-end">{tr('المعتمد', 'Approved')}</th>
                  <th className="px-3 py-2 text-center">{tr('العائد %', 'ROI %')}</th>
                  <th className="px-3 py-2 text-center">{tr('الأثر السريري', 'Clinical Impact')}</th>
                  <th className="px-3 py-2 text-start">{tr('توصية الذكاء الاصطناعي', 'AI Recommendation')}</th>
                  <th className="px-3 py-2 text-center">{tr('الحالة', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedProposals.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-2.5 font-medium text-gray-900">
                      {tr(p.departmentAr ?? p.department, p.department)}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {tr(p.categoryAr ?? p.category, p.category)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', PRIORITY_COLORS[p.priority])}>
                        {priorityLabel(p.priority)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-end font-medium">{formatSAR(p.requestedAmount)}</td>
                    <td className="px-3 py-2.5 text-end font-medium text-[#6B8E23]">{formatSAR(p.approvedAmount)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('font-semibold', p.roiPercent >= 20 ? 'text-[#6B8E23]' : 'text-gray-600')}>
                        {p.roiPercent}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <CircleDot className={cn('h-3 w-3', p.clinicalImpactScore >= 80 ? 'text-[#6B8E23]' : p.clinicalImpactScore >= 50 ? 'text-[#D4A017]' : 'text-gray-400')} />
                        <span className="text-xs font-semibold">{p.clinicalImpactScore}</span>
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-gray-500">
                      {tr(p.aiRecommendationAr ?? p.aiRecommendation, p.aiRecommendation)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[p.status])}>
                        {statusLabel(p.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── CROSS-HOSPITAL BENCHMARKS ──────────────────────────────── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#D4A017]" />
          <h2 className="text-lg font-semibold text-gray-900">
            {tr('مقارنة الشبكة', 'Network Benchmarking')}
          </h2>
        </div>

        {benchmarks.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            {tr('لا توجد بيانات مقارنة', 'No benchmark data available')}
          </p>
        ) : (
          <div className="space-y-5">
            {benchmarks.map((b) => {
              const maxVal = Math.max(b.hospitalValue, b.networkAverage, b.networkBest) * 1.15;
              return (
                <div key={b.metricKey} className="rounded-lg border border-gray-50 bg-gray-50/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">
                      {tr(b.metricNameAr ?? b.metricName, b.metricName)}
                    </span>
                    <div className="flex items-center gap-1 rounded-full bg-[#D4A017]/10 px-2 py-0.5">
                      <Award className="h-3 w-3 text-[#D4A017]" />
                      <span className="text-xs font-semibold text-[#D4A017]">
                        P{b.percentileRank}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <BenchmarkBar
                      label={tr('المستشفى', 'Hospital')}
                      value={b.hospitalValue}
                      max={maxVal}
                      unit={b.unit}
                      color="bg-[#D4A017]"
                    />
                    <BenchmarkBar
                      label={tr('متوسط الشبكة', 'Network Avg')}
                      value={b.networkAverage}
                      max={maxVal}
                      unit={b.unit}
                      color="bg-[#6B8E23]"
                    />
                    <BenchmarkBar
                      label={tr('أفضل بالشبكة', 'Network Best')}
                      value={b.networkBest}
                      max={maxVal}
                      unit={b.unit}
                      color="bg-[#556B2F]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function OverviewCard({ icon, title, value, bgClass, highlight }: {
  icon: React.ReactNode; title: string; value: string; bgClass: string; highlight?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border p-4', bgClass, highlight && 'ring-1 ring-green-300')}>
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-gray-500">{title}</span>
      </div>
      <div className={cn('text-xl font-bold', highlight ? 'text-green-700' : 'text-gray-900')}>
        {value}
      </div>
    </div>
  );
}

function BenchmarkBar({ label, value, max, unit, color }: {
  label: string; value: number; max: number; unit: string; color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="relative h-4 flex-1 rounded-full bg-gray-200">
        <div className={cn('h-4 rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-20 shrink-0 text-end text-xs font-semibold text-gray-700">
        {value.toLocaleString()} {unit}
      </span>
    </div>
  );
}
