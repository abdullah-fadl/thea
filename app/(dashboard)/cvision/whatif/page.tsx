'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  FlaskConical,
  DollarSign,
  Users,
  TrendingDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  Trash2,
  RotateCcw,
  Play,
  Plus,
  Minus,
  Shield,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Target,
  Heart,
  Zap,
  BarChart3,
  Calculator,
  Clock,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface OrgState {
  totalEmployees: number;
  monthlyPayroll: number;
  annualPayroll: number;
  avgSalary: number;
  saudiEmployees: number;
  nonSaudiEmployees: number;
  saudizationRate: number;
  gosiEmployerMonthly: number;
  avgRiskScore: number;
  departments: DeptInfo[];
  employees: EmpInfo[];
}

interface DeptInfo {
  department: string;
  headcount: number;
  totalPayroll: number;
  avgSalary: number;
  saudiCount: number;
  avgRiskScore: number;
}

interface EmpInfo {
  id: string;
  name: string;
  department: string;
  departmentId: string;
  jobTitle: string;
  basicSalary: number;
  isSaudi: boolean;
  riskScore: number;
  hireDate: string | null;
}

interface WhatIfResult {
  currentMonthlyCost: number;
  projectedMonthlyCost: number;
  monthlyCostDifference: number;
  annualCostDifference: number;
  percentageChange: number;
  currentAvgRiskScore: number;
  projectedAvgRiskScore: number;
  riskScoreChange: number;
  employeesImproved: number;
  currentHeadcount: number;
  projectedHeadcount: number;
  currentSaudizationRate: number;
  projectedSaudizationRate: number;
  nitaqatBandChange?: string;
  currentGOSIEmployer: number;
  projectedGOSIEmployer: number;
  gosiDifference: number;
  employeeImpacts: EmployeeImpact[];
  summary: string;
  summaryAr: string;
  pros: string[];
  cons: string[];
  warnings?: string[];
  departmentImpact?: { department: string; currentMonthly: number; projectedMonthly: number; difference: number; percentageChange: number; headcountChange: number }[];
  affectedEmployees?: number;
  totalEmployees?: number;
}

interface EmployeeImpact {
  employeeId: string;
  employeeName: string;
  department: string;
  isSaudi: boolean;
  currentSalary: number;
  projectedSalary: number;
  salaryChange: number;
  currentRiskScore: number;
  projectedRiskScore: number;
  riskChange: number;
}

interface SavedScenario {
  id: string;
  name: string;
  type: string;
  summary?: string;
  monthlyCostDifference?: number;
  riskScoreChange?: number;
  createdAt: string;
}

interface NewHirePosition {
  title: string;
  department: string;
  salary: number;
  isSaudi: boolean;
}

type ScenarioType =
  | 'SALARY_INCREASE' | 'NEW_HIRES' | 'LAYOFFS'
  | 'PROMOTION_WAVE' | 'BURNOUT_RELIEF'
  | 'ALLOWANCE_CHANGE' | 'OVERTIME_CHANGE';

type BurnoutAction = 'REDUCE_OVERTIME' | 'HIRE_SUPPORT' | 'FLEXIBLE_HOURS' | 'REMOTE_WORK' | 'TEAM_BUILDING';

// ═══════════════════════════════════════════════════════════════════════════
// Constants & Helpers
// ═══════════════════════════════════════════════════════════════════════════

const NEW_API = '/api/cvision/whatif';
const OLD_API = '/api/cvision/analytics/what-if';

const NEW_API_TYPES = new Set<ScenarioType>(['SALARY_INCREASE', 'NEW_HIRES', 'LAYOFFS', 'PROMOTION_WAVE', 'BURNOUT_RELIEF']);

function formatSAR(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `SAR ${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `SAR ${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `SAR ${n.toLocaleString()}`;
}

function signedSAR(n: number): string {
  return `${n > 0 ? '+' : ''}${formatSAR(n)}`;
}

function RiskBadge(score: number): { label: string; cls: string } {
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;
  if (score >= 75) return { label: tr('حرج', 'CRITICAL'), cls: 'bg-red-100 text-red-700 border-red-200' };
  if (score >= 50) return { label: tr('مرتفع', 'HIGH'), cls: 'bg-orange-100 text-orange-700 border-orange-200' };
  if (score >= 25) return { label: tr('متوسط', 'MODERATE'), cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: tr('منخفض', 'LOW'), cls: 'bg-green-100 text-green-700 border-green-200' };
}

function changeColor(n: number, inverted = false): string {
  const positive = inverted ? n < 0 : n > 0;
  const negative = inverted ? n > 0 : n < 0;
  if (positive) return 'text-green-600';
  if (negative) return 'text-red-600';
  return 'text-muted-foreground';
}

function getNitaqat(rate: number): { band: string; color: string } {
  if (rate >= 40) return { band: 'PLATINUM', color: 'text-purple-600' };
  if (rate >= 27) return { band: 'GREEN HIGH', color: 'text-green-700' };
  if (rate >= 23) return { band: 'GREEN MID', color: 'text-green-600' };
  if (rate >= 17) return { band: 'GREEN LOW', color: 'text-green-500' };
  if (rate >= 10) return { band: 'YELLOW', color: 'text-yellow-600' };
  return { band: 'RED', color: 'text-red-600' };
}

async function apiFetch(url: string, opts?: RequestInit) {
  if (opts?.method === 'POST' || opts?.body) {
    const body = opts?.body ? JSON.parse(opts.body as string) : undefined;
    const res = await cvisionMutate<any>(url, (opts?.method || 'POST') as 'POST' | 'PUT' | 'PATCH' | 'DELETE', body);
    if (!res.success) throw new Error(res.error || 'Request failed');
    return res;
  }
  const res = await cvisionFetch<any>(url);
  if (!res.success) throw new Error(res.error || 'Request failed');
  return res;
}

function normalizeOldResult(r: any): WhatIfResult {
  return {
    currentMonthlyCost: r.currentState?.monthlyTotal || 0,
    projectedMonthlyCost: r.projectedState?.monthlyTotal || 0,
    monthlyCostDifference: r.impact?.monthlyDifference || 0,
    annualCostDifference: r.impact?.annualDifference || 0,
    percentageChange: r.impact?.percentageChange || 0,
    currentAvgRiskScore: 0,
    projectedAvgRiskScore: 0,
    riskScoreChange: 0,
    employeesImproved: 0,
    currentHeadcount: r.currentState?.headcount || 0,
    projectedHeadcount: r.projectedState?.headcount || 0,
    currentSaudizationRate: 0,
    projectedSaudizationRate: 0,
    currentGOSIEmployer: r.currentState?.gosiEmployerMonthly || 0,
    projectedGOSIEmployer: r.projectedState?.gosiEmployerMonthly || 0,
    gosiDifference: r.impact?.gosiImpactMonthly || 0,
    employeeImpacts: [],
    summary: r.summary || '',
    summaryAr: r.summaryAr || '',
    pros: [],
    cons: [],
    warnings: r.warnings,
    departmentImpact: r.departmentImpact,
    affectedEmployees: r.affectedEmployees,
    totalEmployees: r.totalEmployees,
  };
}

const getScenarioCards = (tr: (ar: string, en: string) => string): { type: ScenarioType; icon: typeof DollarSign; label: string; desc: string; color: string }[] => [
  { type: 'SALARY_INCREASE', icon: DollarSign, label: tr('زيادة الراتب', 'Salary Increase'), desc: 'What if we raise salaries by X%?', color: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/50' },
  { type: 'NEW_HIRES', icon: Users, label: tr('توظيف جديد', 'New Hires'), desc: 'Impact of hiring new employees', color: 'border-purple-200 hover:border-purple-400 hover:bg-purple-50/50' },
  { type: 'LAYOFFS', icon: TrendingDown, label: tr('تسريح', 'Layoffs'), desc: 'Cost and impact of reducing headcount', color: 'border-red-200 hover:border-red-400 hover:bg-red-50/50' },
  { type: 'PROMOTION_WAVE', icon: Target, label: tr('موجة ترقيات', 'Promotion Wave'), desc: 'Promote multiple employees at once', color: 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/50' },
  { type: 'BURNOUT_RELIEF', icon: Heart, label: tr('تخفيف الإرهاق', 'Burnout Relief'), desc: 'What if we address employee burnout?', color: 'border-green-200 hover:border-green-400 hover:bg-green-50/50' },
  { type: 'ALLOWANCE_CHANGE', icon: Calculator, label: tr('تغيير البدلات', 'Allowance Change'), desc: 'Adjust housing, transport, or food allowances', color: 'border-teal-200 hover:border-teal-400 hover:bg-teal-50/50' },
  { type: 'OVERTIME_CHANGE', icon: Clock, label: tr('تغيير الوقت الإضافي', 'Overtime Change'), desc: 'Reduce, cap, or eliminate overtime', color: 'border-orange-200 hover:border-orange-400 hover:bg-orange-50/50' },
];

const getBurnoutOptions = (tr: (ar: string, en: string) => string): { key: BurnoutAction; label: string; desc: string }[] => [
  { key: 'REDUCE_OVERTIME', label: tr('تقليل الوقت الإضافي', 'Reduce Overtime'), desc: 'Cap overtime at 10 hrs/month' },
  { key: 'HIRE_SUPPORT', label: tr('توظيف دعم', 'Hire Support Staff'), desc: '1 support hire per department' },
  { key: 'FLEXIBLE_HOURS', label: tr('ساعات مرنة', 'Flexible Hours'), desc: 'Allow flexible working hours' },
  { key: 'REMOTE_WORK', label: tr('عمل عن بعد', 'Remote Work'), desc: 'Enable remote work options' },
  { key: 'TEAM_BUILDING', label: 'Team Building', desc: 'Quarterly team building events' },
];

const TYPE_LABELS: Record<string, string> = {
  SALARY_INCREASE: 'Salary Increase', NEW_HIRES: 'New Hires', LAYOFFS: 'Layoffs',
  PROMOTION_WAVE: 'Promotion Wave', BURNOUT_RELIEF: 'Burnout Relief',
  ALLOWANCE_CHANGE: 'Allowance', OVERTIME_CHANGE: 'Overtime',
  SALARY_ADJUSTMENT: 'Salary', HEADCOUNT_CHANGE: 'Headcount', CUSTOM: 'Custom',
};

// ═══════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════

export default function WhatIfPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const SCENARIO_CARDS = getScenarioCards(tr);
  const BURNOUT_OPTIONS = getBurnoutOptions(tr);

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('simulator');

  // Org state
  const [orgState, setOrgState] = useState<OrgState | null>(null);

  // Simulator
  const [selectedType, setSelectedType] = useState<ScenarioType | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [showImpactTable, setShowImpactTable] = useState(false);

  // Form: Salary
  const [salaryPct, setSalaryPct] = useState(5);
  const [salaryScope, setSalaryScope] = useState('ALL');
  const [salaryDept, setSalaryDept] = useState('');
  const [salaryIncludeAllowances, setSalaryIncludeAllowances] = useState(false);

  // Scenario name (inline — auto-saves if provided)
  const [scenarioName, setScenarioName] = useState('');

  // Form: New Hires
  const [positions, setPositions] = useState<NewHirePosition[]>([{ title: '', department: '', salary: 5000, isSaudi: true }]);

  // Form: Layoffs
  const [layoffCount, setLayoffCount] = useState(1);
  const [layoffDept, setLayoffDept] = useState('');
  const [layoffCriteria, setLayoffCriteria] = useState('NEWEST');

  // Form: Burnout
  const [burnoutActions, setBurnoutActions] = useState<Set<BurnoutAction>>(new Set());

  // Form: Promotion
  const [promoEmployees, setPromoEmployees] = useState<string[]>([]);
  const [promoRaise, setPromoRaise] = useState(1000);

  // Form: Allowance (old API)
  const [allowanceType, setAllowanceType] = useState('ALL');
  const [allowanceScope, setAllowanceScope] = useState('ALL');
  const [allowanceDept, setAllowanceDept] = useState('');
  const [allowanceAdjType, setAllowanceAdjType] = useState('PERCENTAGE');
  const [allowanceValue, setAllowanceValue] = useState(10);

  // Form: Overtime (old API)
  const [otScope, setOtScope] = useState('ALL');
  const [otDept, setOtDept] = useState('');
  const [otChangeType, setOtChangeType] = useState('REDUCE_BY_PERCENTAGE');
  const [otValue, setOtValue] = useState(50);

  // Save
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  // Saved scenarios
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);

  // Compare
  const [cmpType1, setCmpType1] = useState<ScenarioType>('SALARY_INCREASE');
  const [cmpType2, setCmpType2] = useState<ScenarioType>('NEW_HIRES');
  const [cmpParams1, setCmpParams1] = useState<Record<string, any>>({ percentage: 5, scope: 'ALL' });
  const [cmpParams2, setCmpParams2] = useState<Record<string, any>>({ positions: [{ title: 'New Hire', department: '', salary: 5000, isSaudi: true }] });
  const [comparing, setComparing] = useState(false);
  const [cmpResult, setCmpResult] = useState<{ scenario1: any; scenario2: any; comparison: any } | null>(null);

  const departments = orgState?.departments || [];
  const employees = orgState?.employees || [];
  const nitaqat = orgState ? getNitaqat(orgState.saudizationRate) : { band: '—', color: '' };

  // ── Load data (React Query) ─────────────────────────────────
  const queryClient = useQueryClient();

  const orgStateQuery = useQuery({
    queryKey: cvisionKeys.whatif.list({ action: 'current-state' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/whatif', { params: { action: 'current-state' } }),
    select: (json: any) => json.data as OrgState,
  });

  const scenariosQuery = useQuery({
    queryKey: cvisionKeys.whatif.list({ action: 'saved-scenarios' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/whatif', { params: { action: 'saved-scenarios' } }),
    enabled: activeTab === 'scenarios',
    select: (json: any) => (json.data?.items || json.data || []) as SavedScenario[],
  });

  useEffect(() => { if (orgStateQuery.data) setOrgState(orgStateQuery.data); }, [orgStateQuery.data]);
  useEffect(() => { if (scenariosQuery.data) setSavedScenarios(scenariosQuery.data); }, [scenariosQuery.data]);

  // Keep orgLoading/scenariosLoading as derived
  const orgLoading = orgStateQuery.isLoading;
  const scenariosLoading = scenariosQuery.isLoading;

  const loadState = useCallback(() => { orgStateQuery.refetch(); }, []);
  const loadScenarios = useCallback(() => { scenariosQuery.refetch(); }, []);

  // ── Quick scenarios ───────────────────────────────────────────
  function applyQuick(preset: string) {
    setResult(null);
    setScenarioName('');
    if (preset === 'raise-10') {
      setSelectedType('SALARY_INCREASE'); setSalaryPct(10); setSalaryScope('ALL'); setSalaryIncludeAllowances(false);
      setScenarioName('10% Raise for All');
    } else if (preset === 'hire-5') {
      setSelectedType('NEW_HIRES');
      const dept = departments[0]?.department || '';
      setPositions(Array.from({ length: 5 }, () => ({ title: 'Engineer', department: dept, salary: 8000, isSaudi: true })));
      setScenarioName('Hire 5 Engineers');
    } else if (preset === 'cut-ot') {
      setSelectedType('OVERTIME_CHANGE'); setOtScope('ALL'); setOtChangeType('REDUCE_BY_PERCENTAGE'); setOtValue(50);
      setScenarioName('Cut Overtime 50%');
    }
  }

  // ── Run simulation ────────────────────────────────────────────
  async function runSimulation() {
    if (!selectedType) return;
    setSimulating(true);
    setResult(null);
    setShowImpactTable(false);

    try {
      if (NEW_API_TYPES.has(selectedType)) {
        const body: Record<string, any> = { action: 'simulate', type: selectedType, parameters: {} };

        if (selectedType === 'SALARY_INCREASE') {
          body.parameters = { percentage: salaryPct, scope: salaryScope, department: salaryScope === 'DEPARTMENT' ? salaryDept : undefined, includeAllowances: salaryIncludeAllowances };
        } else if (selectedType === 'NEW_HIRES') {
          const valid = positions.filter(p => p.title && p.salary > 0);
          if (!valid.length) { toast({ title: 'Add at least one valid position', variant: 'destructive' }); setSimulating(false); return; }
          body.parameters = { positions: valid };
        } else if (selectedType === 'LAYOFFS') {
          body.parameters = { criteria: layoffCriteria, count: layoffCount, department: layoffDept || undefined };
        } else if (selectedType === 'PROMOTION_WAVE') {
          if (!promoEmployees.length) { toast({ title: 'Select employees to promote', variant: 'destructive' }); setSimulating(false); return; }
          body.parameters = { promotions: promoEmployees.map(id => ({ employeeId: id, newTitle: 'Promoted', salaryIncrease: promoRaise })) };
        } else if (selectedType === 'BURNOUT_RELIEF') {
          if (!burnoutActions.size) { toast({ title: 'Select at least one relief measure', variant: 'destructive' }); setSimulating(false); return; }
          body.parameters = { actions: Array.from(burnoutActions) };
        }

        const json = await apiFetch(NEW_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        setResult(json.data.result);

        if (scenarioName.trim()) {
          try {
            await apiFetch(NEW_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-scenario', name: scenarioName, type: selectedType, results: json.data.result }) });
            toast({ title: 'Scenario saved', description: `"${scenarioName}" saved automatically.` });
            loadScenarios();
          } catch { /* silent — save is best-effort */ }
        }
      } else {
        // Allowance / Overtime → old API
        let body: Record<string, any> = {};

        if (selectedType === 'ALLOWANCE_CHANGE') {
          if (!allowanceValue) { toast({ title: 'Value is required', variant: 'destructive' }); setSimulating(false); return; }
          body = {
            action: 'simulate-allowance',
            allowanceType,
            scope: allowanceScope,
            department: allowanceScope === 'DEPARTMENT' ? allowanceDept : undefined,
            adjustmentType: allowanceAdjType,
            adjustmentValue: allowanceValue,
          };
        } else if (selectedType === 'OVERTIME_CHANGE') {
          if (otChangeType !== 'ELIMINATE' && !otValue) { toast({ title: 'Value is required', variant: 'destructive' }); setSimulating(false); return; }
          body = {
            action: 'simulate-overtime',
            scope: otScope,
            department: otScope === 'DEPARTMENT' ? otDept : undefined,
            changeType: otChangeType,
            value: otChangeType !== 'ELIMINATE' ? otValue : undefined,
            currentOvertimeCosts: departments.map(d => ({ department: d.department, monthlyCost: Math.round(d.totalPayroll * 0.05) })),
          };
        }

        const res = await fetch(OLD_API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Simulation failed');
        const normalized = normalizeOldResult(json.data.result);
        setResult(normalized);

        if (scenarioName.trim()) {
          try {
            await apiFetch(NEW_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-scenario', name: scenarioName, type: selectedType, results: normalized }) });
            toast({ title: 'Scenario saved', description: `"${scenarioName}" saved automatically.` });
            loadScenarios();
          } catch { /* silent */ }
        }
      }

      toast({ title: 'Simulation complete' });
    } catch (e: any) {
      toast({ title: 'Simulation failed', description: e.message, variant: 'destructive' });
    } finally { setSimulating(false); }
  }

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!saveName.trim() || !result || !selectedType) return;
    setSaving(true);
    try {
      await apiFetch(NEW_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save-scenario', name: saveName, type: selectedType, results: result }) });
      toast({ title: 'Scenario saved' });
      setSaveDialogOpen(false);
      setSaveName('');
      loadScenarios();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  }

  // ── Compare ───────────────────────────────────────────────────
  async function handleCompare() {
    setComparing(true);
    setCmpResult(null);
    try {
      const json = await apiFetch(NEW_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'compare', scenario1: { type: cmpType1, parameters: cmpParams1 }, scenario2: { type: cmpType2, parameters: cmpParams2 } }) });
      setCmpResult(json.data);
    } catch (e: any) {
      toast({ title: 'Compare failed', description: e.message, variant: 'destructive' });
    } finally { setComparing(false); }
  }

  // ── Delete ────────────────────────────────────────────────────
  function handleDelete(id: string) {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
    toast({ title: 'Removed from list' });
  }

  // ── Export report (old API) ───────────────────────────────────
  async function handleExportReport() {
    if (!result) return;
    try {
      const res = await fetch(OLD_API, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate-report', inlineResult: { scenarioId: 'inline', scenarioName: selectedType || 'Simulation', currentState: { monthlyTotal: result.currentMonthlyCost, annualTotal: result.currentMonthlyCost * 12, headcount: result.currentHeadcount, averageSalary: orgState?.avgSalary || 0, gosiEmployerMonthly: result.currentGOSIEmployer }, projectedState: { monthlyTotal: result.projectedMonthlyCost, annualTotal: result.projectedMonthlyCost * 12, headcount: result.projectedHeadcount, averageSalary: 0, gosiEmployerMonthly: result.projectedGOSIEmployer }, impact: { monthlyDifference: result.monthlyCostDifference, annualDifference: result.annualCostDifference, percentageChange: result.percentageChange, headcountChange: result.projectedHeadcount - result.currentHeadcount, averageSalaryChange: 0, gosiImpactMonthly: result.gosiDifference }, departmentImpact: result.departmentImpact || [], affectedEmployees: result.affectedEmployees || 0, totalEmployees: result.totalEmployees || orgState?.totalEmployees || 0, warnings: result.warnings || [], warningsAr: [], summary: result.summary, summaryAr: result.summaryAr || '', generatedAt: new Date().toISOString() } }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Report failed');
      const report = json.data.report;
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<html><head><title>${report.title}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a}h1{font-size:1.5rem;border-bottom:2px solid #e5e7eb;padding-bottom:8px}h2{font-size:1.1rem;color:#374151;margin-top:24px}p{line-height:1.6;color:#4b5563;white-space:pre-line}</style></head><body>`);
        w.document.write(`<h1>${report.title}</h1>`);
        report.sections.forEach((s: any) => { w.document.write(`<h2>${s.heading}</h2><p>${s.content}</p>`); });
        w.document.write('</body></html>');
        w.document.close();
      }
      toast({ title: 'Report opened in new tab' });
    } catch (e: any) {
      toast({ title: 'Report failed', description: e.message, variant: 'destructive' });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FlaskConical style={{ height: 24, width: 24, color: C.gold }} />
            What-If Analysis
          </h1>
          <p style={{ color: C.textMuted, marginTop: 4 }}>Simulate HR decisions and see their projected impact before implementing</p>
        </div>
        <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, color: C.gold, gap: 4 }}>
          <Sparkles style={{ height: 12, width: 12 }} /> AI-Powered
        </CVisionBadge>
      </div>

      {/* ── Current State ────────────────────────────────────────── */}
      {orgLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>{Array.from({ length: 6 }).map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 80 }}  />)}</div>
      ) : orgState ? (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart3 style={{ height: 16, width: 16, color: C.gold }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Current Organization State</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <StateCard icon={Users} label="Headcount" value={String(orgState.totalEmployees)} />
            <StateCard icon={DollarSign} label="Monthly Payroll" value={formatSAR(orgState.monthlyPayroll)} />
            <StateCard icon={Building2} label="GOSI (Employer)" value={`${formatSAR(orgState.gosiEmployerMonthly)}/mo`} />
            <StateCard icon={Shield} label="Saudization" value={`${orgState.saudizationRate}%`} sub={<span className={nitaqat.color}>{nitaqat.band}</span>} />
            <StateCard icon={AlertTriangle} label="Avg Risk" value={`${orgState.avgRiskScore}/100`} sub={<span className={orgState.avgRiskScore >= 50 ? 'text-red-600' : orgState.avgRiskScore >= 25 ? 'text-amber-600' : 'text-green-600'}>{RiskBadge(orgState.avgRiskScore).label}</span>} />
            <StateCard icon={DollarSign} label="Annual Cost" value={formatSAR(orgState.annualPayroll)} />
          </div>
        </div>
      ) : null}

      {/* ── Quick Scenarios ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>Quick:</span>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ fontSize: 12, height: 28 }} onClick={() => applyQuick('raise-10')}><Zap style={{ height: 12, width: 12, marginRight: 4 }} />10% Raise for All</CVisionButton>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ fontSize: 12, height: 28 }} onClick={() => applyQuick('hire-5')}><Zap style={{ height: 12, width: 12, marginRight: 4 }} />Hire 5 Engineers</CVisionButton>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ fontSize: 12, height: 28 }} onClick={() => applyQuick('cut-ot')}><Zap style={{ height: 12, width: 12, marginRight: 4 }} />Cut Overtime 50%</CVisionButton>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'simulator', label: 'Simulator', icon: <FlaskConical style={{ height: 14, width: 14 }} /> },
          { id: 'scenarios', label: 'Scenarios', icon: <Save style={{ height: 14, width: 14 }} /> },
          { id: 'compare', label: 'Compare', icon: <BarChart3 style={{ height: 14, width: 14 }} /> },
        ]}
      >
        {/* ═══ TAB 1: SIMULATOR ═══════════════════════════════════ */}
        <CVisionTabContent tabId="simulator">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
          {/* Scenario picker */}
          {!selectedType && !result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}>Choose a scenario to simulate:</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
                {SCENARIO_CARDS.map(sc => { const Icon = sc.icon; return (
                  <button key={sc.type} onClick={() => { setSelectedType(sc.type); setResult(null); }} className={cn('flex flex-col items-start gap-2 rounded-lg border-2 p-4 text-left transition-all', sc.color)}>
                    <Icon style={{ height: 20, width: 20 }} />
                    <div><p style={{ fontWeight: 600, fontSize: 13 }}>{sc.label}</p><p style={{ fontSize: 12, color: C.textMuted }}>{sc.desc}</p></div>
                  </button>
                ); })}
              </div>
            </div>
          )}

          {/* Scenario form */}
          {selectedType && !result && (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => { const Icon = SCENARIO_CARDS.find(s => s.type === selectedType)!.icon; return <Icon style={{ height: 20, width: 20 }} />; })()}
                  {SCENARIO_CARDS.find(s => s.type === selectedType)?.label}
                </h2>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => setSelectedType(null)}><RotateCcw style={{ height: 14, width: 14, marginRight: 4 }} /> Back</CVisionButton>
              </div>

              {/* ── Salary ── */}
              {selectedType === 'SALARY_INCREASE' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Increase (%)</CVisionLabel><CVisionInput C={C} type="number" min={1} max={100} value={salaryPct} onChange={e => setSalaryPct(Number(e.target.value))} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Apply to</CVisionLabel>
                    <CVisionSelect
                C={C}
                value={salaryScope}
                onChange={setSalaryScope}
                options={[
                  { value: 'ALL', label: 'All Employees' },
                  { value: 'DEPARTMENT', label: 'Department' },
                  { value: 'HIGH_RISK', label: 'High-Risk Only' },
                ]}
              />
                  </div>
                  {salaryScope === 'DEPARTMENT' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Department</CVisionLabel><CVisionSelect C={C} value={salaryDept} onChange={setSalaryDept} placeholder="Select" options={[...departments.map(d => ({ value: d.department, label: `${d.department} (${d.headcount})` }))]} /></div>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Checkbox id="include-allowances" checked={salaryIncludeAllowances} onCheckedChange={(checked) => setSalaryIncludeAllowances(!!checked)} />
                    <CVisionLabel C={C} htmlFor="include-allowances" style={{ fontSize: 13, cursor: 'pointer' }}>Also adjust allowances proportionally</CVisionLabel>
                  </div>
                </div>
              )}

              {/* ── New Hires ── */}
              {selectedType === 'NEW_HIRES' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {positions.map((pos, i) => (
                    <div key={i} style={{ borderRadius: 6, border: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 13, fontWeight: 500 }}>Position {i + 1}</span>{positions.length > 1 && <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 24, width: 24, padding: 0 }} onClick={() => setPositions(prev => prev.filter((_, j) => j !== i))}><Minus style={{ height: 14, width: 14, color: C.textMuted }} /></CVisionButton>}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Title</CVisionLabel><CVisionInput C={C} value={pos.title} onChange={e => { const p = [...positions]; p[i] = { ...p[i], title: e.target.value }; setPositions(p); }} placeholder="e.g. Senior Nurse" /></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Department</CVisionLabel><CVisionSelect C={C} value={pos.department} onChange={v => { const p = [...positions]; p[i] = { ...p[i], department: v }; setPositions(p); }} placeholder="Select" options={[...departments.map(d => ({ value: d.department, label: d.department }))]} /></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Monthly Salary (SAR)</CVisionLabel><CVisionInput C={C} type="number" min={0} value={pos.salary || ''} onChange={e => { const p = [...positions]; p[i] = { ...p[i], salary: Number(e.target.value) }; setPositions(p); }} /></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Nationality</CVisionLabel><div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 4 }}><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}><input type="radio" name={`nat-${i}`} checked={pos.isSaudi} onChange={() => { const p = [...positions]; p[i] = { ...p[i], isSaudi: true }; setPositions(p); }} /> Saudi</label><label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}><input type="radio" name={`nat-${i}`} checked={!pos.isSaudi} onChange={() => { const p = [...positions]; p[i] = { ...p[i], isSaudi: false }; setPositions(p); }} /> Non-Saudi</label></div></div>
                      </div>
                    </div>
                  ))}
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setPositions(prev => [...prev, { title: '', department: departments[0]?.department || '', salary: 5000, isSaudi: true }])}><Plus style={{ height: 14, width: 14, marginRight: 4 }} /> Add Position</CVisionButton>
                </div>
              )}

              {/* ── Layoffs ── */}
              {selectedType === 'LAYOFFS' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Number of layoffs</CVisionLabel><CVisionInput C={C} type="number" min={1} value={layoffCount} onChange={e => setLayoffCount(Number(e.target.value))} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Department</CVisionLabel><CVisionSelect C={C} value={layoffDept} onChange={setLayoffDept} placeholder="All departments" options={[{ value: ' ', label: 'All Departments' }, ...departments.map(d => ({ value: d.department, label: d.department }))]} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Criteria</CVisionLabel><CVisionSelect C={C} value={layoffCriteria} onChange={setLayoffCriteria} options={[{ value: 'NEWEST', label: 'Newest employees (LIFO)' }, { value: 'LOWEST_PERFORMANCE', label: 'Lowest performance' }]} /></div>
                </div>
              )}

              {/* ── Promotion Wave ── */}
              {selectedType === 'PROMOTION_WAVE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Salary increase per employee (SAR)</CVisionLabel><CVisionInput C={C} type="number" min={0} value={promoRaise} onChange={e => setPromoRaise(Number(e.target.value))} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C}>Select employees ({promoEmployees.length} selected)</CVisionLabel>
                    <div style={{ borderRadius: 6, border: `1px solid ${C.border}`, overflowY: 'auto' }}>
                      {employees.map(emp => (
                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, cursor: 'pointer', fontSize: 13 }}>
                          <Checkbox checked={promoEmployees.includes(emp.id)} onCheckedChange={checked => setPromoEmployees(prev => checked ? [...prev, emp.id] : prev.filter(x => x !== emp.id))} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
                          <span style={{ fontSize: 12, color: C.textMuted }}>{emp.department}</span>
                          <span style={{ fontSize: 12, color: C.textMuted }}>{emp.basicSalary > 0 ? formatSAR(emp.basicSalary) : '—'}</span>
                        </label>
                      ))}
                      {employees.length === 0 && <p style={{ padding: 12, fontSize: 13, color: C.textMuted }}>No employees loaded</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Burnout Relief ── */}
              {selectedType === 'BURNOUT_RELIEF' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CVisionLabel C={C}>Select relief measures:</CVisionLabel>
                  {BURNOUT_OPTIONS.map(opt => (
                    <label key={opt.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 6, border: `1px solid ${C.border}`, padding: 12, cursor: 'pointer', transition: 'color 0.2s, background 0.2s' }}>
                      <Checkbox checked={burnoutActions.has(opt.key)} onCheckedChange={checked => setBurnoutActions(prev => { const next = new Set(prev); if (checked) next.add(opt.key); else next.delete(opt.key); return next; })} style={{ marginTop: 2 }} />
                      <div><p style={{ fontSize: 13, fontWeight: 500 }}>{opt.label}</p><p style={{ fontSize: 12, color: C.textMuted }}>{opt.desc}</p></div>
                    </label>
                  ))}
                </div>
              )}

              {/* ── Allowance Change ── */}
              {selectedType === 'ALLOWANCE_CHANGE' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Allowance Type</CVisionLabel><CVisionSelect C={C} value={allowanceType} onChange={setAllowanceType} options={[{ value: 'ALL', label: 'All Allowances' }, { value: 'HOUSING', label: 'Housing' }, { value: 'TRANSPORT', label: 'Transport' }, { value: 'FOOD', label: 'Food' }]} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Scope</CVisionLabel><CVisionSelect C={C} value={allowanceScope} onChange={setAllowanceScope} options={[{ value: 'ALL', label: 'All Employees' }, { value: 'DEPARTMENT', label: 'Department' }]} /></div>
                  {allowanceScope === 'DEPARTMENT' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Department</CVisionLabel><CVisionSelect C={C} value={allowanceDept} onChange={setAllowanceDept} placeholder="Select" options={[...departments.map(d => ({ value: d.department, label: d.department }))]} /></div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Adjustment Type</CVisionLabel><CVisionSelect C={C} value={allowanceAdjType} onChange={setAllowanceAdjType} options={[{ value: 'PERCENTAGE', label: 'Percentage (%)' }, { value: 'FIXED_AMOUNT', label: 'Fixed Amount (SAR)' }, { value: 'SET_VALUE', label: 'Set Value (SAR)' }]} /></div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Value {allowanceAdjType === 'PERCENTAGE' ? '(%)' : '(SAR)'}</CVisionLabel><CVisionInput C={C} type="number" value={allowanceValue || ''} onChange={e => setAllowanceValue(Number(e.target.value))} /></div>
                </div>
              )}

              {/* ── Overtime Change ── */}
              {selectedType === 'OVERTIME_CHANGE' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Scope</CVisionLabel><CVisionSelect C={C} value={otScope} onChange={setOtScope} options={[{ value: 'ALL', label: 'All Departments' }, { value: 'DEPARTMENT', label: 'Specific Department' }]} /></div>
                  {otScope === 'DEPARTMENT' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Department</CVisionLabel><CVisionSelect C={C} value={otDept} onChange={setOtDept} placeholder="Select" options={[...departments.map(d => ({ value: d.department, label: d.department }))]} /></div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>Change Type</CVisionLabel><CVisionSelect C={C} value={otChangeType} onChange={setOtChangeType} options={[{ value: 'REDUCE_BY_PERCENTAGE', label: 'Reduce by %' }, { value: 'SET_MAX_HOURS', label: 'Set Max Hours' }, { value: 'ELIMINATE', label: 'Eliminate' }]} /></div>
                  {otChangeType !== 'ELIMINATE' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C}>{otChangeType === 'REDUCE_BY_PERCENTAGE' ? 'Reduction (%)' : 'Max Hours'}</CVisionLabel><CVisionInput C={C} type="number" value={otValue || ''} onChange={e => setOtValue(Number(e.target.value))} /></div>}
                </div>
              )}

              {/* Scenario name (optional — auto-saves if provided) */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C} style={{ fontSize: 13 }}>Scenario Name <span style={{ color: C.textMuted }}>(optional — auto-saves if provided)</span></CVisionLabel>
                  <CVisionInput C={C} value={scenarioName} onChange={e => setScenarioName(e.target.value)} placeholder="e.g. Q3 salary review" style={{ maxWidth: 448 }} />
                </div>
              </div>

              {/* Run button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                <CVisionButton C={C} isDark={isDark} onClick={runSimulation} disabled={simulating} className="min-w-[160px]">
                  {simulating ? <><Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> Simulating...</> : <><Play style={{ height: 16, width: 16, marginRight: 8 }} /> Run Simulation</>}
                </CVisionButton>
                {scenarioName.trim() && <span style={{ fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}><Save style={{ height: 12, width: 12 }} /> Will auto-save as &quot;{scenarioName}&quot;</span>}
              </div>
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────── */}
          {result && <ResultsPanel result={result} typeName={TYPE_LABELS[selectedType || ''] || 'Simulation'} onSave={() => setSaveDialogOpen(true)} onModify={() => setResult(null)} onNewScenario={() => { setResult(null); setSelectedType(null); }} showImpactTable={showImpactTable} toggleImpactTable={() => setShowImpactTable(v => !v)} orgState={orgState} onExport={handleExportReport} />}
        </div>
        </CVisionTabContent>

        {/* ═══ TAB 2: SCENARIOS ═══════════════════════════════════ */}
        <CVisionTabContent tabId="scenarios">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontWeight: 600 }}>Saved Scenarios</h2>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => loadScenarios()} disabled={scenariosLoading}><RotateCcw className={cn('h-3.5 w-3.5 mr-1', scenariosLoading && 'animate-spin')} /> Refresh</CVisionButton>
          </div>
          {scenariosLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 3 }).map((_, i) => <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 64 }}  />)}</div>
          ) : savedScenarios.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 48, paddingBottom: 48, color: C.textMuted }}><Save style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.4 }} /><p>No saved scenarios yet.</p><p style={{ fontSize: 13 }}>Run a simulation and save it to see it here.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{savedScenarios.map(sc => (
              <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 16, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, transition: 'color 0.2s, background 0.2s' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</span><CVisionBadge C={C} variant="outline" className="text-[10px]">{TYPE_LABELS[sc.type] || sc.type}</CVisionBadge></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4, fontSize: 12, color: C.textMuted }}>
                    <span>{new Date(sc.createdAt).toLocaleDateString()}</span>
                    {sc.monthlyCostDifference != null && <span className={changeColor(sc.monthlyCostDifference)}>Budget: {signedSAR(sc.monthlyCostDifference)}/mo</span>}
                    {sc.riskScoreChange != null && <span className={changeColor(sc.riskScoreChange, true)}>Risk: {sc.riskScoreChange > 0 ? '+' : ''}{sc.riskScoreChange.toFixed(1)} pts</span>}
                  </div>
                </div>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 28, width: 28, padding: 0 }} onClick={() => handleDelete(sc.id)}><Trash2 style={{ height: 14, width: 14, color: C.textMuted }} /></CVisionButton>
              </div>
            ))}</div>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══ TAB 3: COMPARE ════════════════════════════════════ */}
        <CVisionTabContent tabId="compare">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontWeight: 600 }}>Side-by-Side Comparison</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <CVisionLabel C={C} style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>SCENARIO 1</CVisionLabel>
                <CVisionSelect C={C} value={cmpType1} onChange={v => { setCmpType1(v as ScenarioType); updateCmpDefaults(v as ScenarioType, setCmpParams1, departments); }} options={[...SCENARIO_CARDS.filter(c => NEW_API_TYPES.has(c.type)).map(c => ({ value: c.type, label: c.label }))]} />
                <CmpParamForm type={cmpType1} params={cmpParams1} setParams={setCmpParams1} departments={departments} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <CVisionLabel C={C} style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>SCENARIO 2</CVisionLabel>
                <CVisionSelect C={C} value={cmpType2} onChange={v => { setCmpType2(v as ScenarioType); updateCmpDefaults(v as ScenarioType, setCmpParams2, departments); }} options={[...SCENARIO_CARDS.filter(c => NEW_API_TYPES.has(c.type)).map(c => ({ value: c.type, label: c.label }))]} />
                <CmpParamForm type={cmpType2} params={cmpParams2} setParams={setCmpParams2} departments={departments} />
              </div>
            </div>
            <CVisionButton C={C} isDark={isDark} onClick={handleCompare} disabled={comparing} className="min-w-[140px]">{comparing ? <><Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> Comparing...</> : <><BarChart3 style={{ height: 16, width: 16, marginRight: 8 }} /> Compare</>}</CVisionButton>
          </div>

          {cmpResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                <CmpColumn label={TYPE_LABELS[cmpResult.scenario1.type]} result={cmpResult.scenario1.result} isBetter={cmpResult.comparison.better === 'SCENARIO_1'} />
                <CmpColumn label={TYPE_LABELS[cmpResult.scenario2.type]} result={cmpResult.scenario2.result} isBetter={cmpResult.comparison.better === 'SCENARIO_2'} />
              </div>
              <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Sparkles style={{ height: 20, width: 20, color: C.gold, marginTop: 2 }} />
                <div><p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>AI Recommendation</p><p style={{ fontSize: 13, color: C.textMuted }}>{cmpResult.comparison.analysis}</p></div>
              </div>
            </div>
          )}
        </div>
        </CVisionTabContent>
      </CVisionTabs>

      {/* ── Save Dialog ──────────────────────────────────────────── */}
      <CVisionDialog C={C} open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} title="Save Scenario" isDark={isDark}>          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C}>Scenario Name</CVisionLabel><CVisionInput C={C} value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. Q3 salary review" autoFocus /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleSave} disabled={saving || !saveName.trim()}>{saving ? <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <Save style={{ height: 16, width: 16, marginRight: 8 }} />}Save</CVisionButton>
            </div>
          </div>
      </CVisionDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function StateCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: React.ReactNode }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.bgCard, padding: 12, textAlign: 'center' }}>
      <Icon style={{ height: 16, width: 16, marginBottom: 4, color: C.textMuted }} />
      <p style={{ fontSize: 12, color: C.textMuted }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</p>
      {sub && <div style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ResultsPanel({ result, typeName, onSave, onModify, onNewScenario, showImpactTable, toggleImpactTable, orgState, onExport }: {
  result: WhatIfResult; typeName: string; onSave: () => void; onModify: () => void; onNewScenario: () => void; showImpactTable: boolean; toggleImpactTable: () => void; orgState: OrgState | null; onExport: () => void;
}) {
  const { C, isDark } = useCVisionTheme();
  const highRiskCount = result.employeeImpacts.filter(e => e.currentRiskScore >= 50).length;
  const avgSalary = orgState?.avgSalary || 5000;
  const replacementCost = highRiskCount * avgSalary * 6;
  const hasRetention = result.currentAvgRiskScore > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 style={{ height: 20, width: 20, color: C.green }} />Simulation Results</h2>
            <p style={{ fontSize: 13, color: C.textMuted }}>{result.summary}</p>
            {result.affectedEmployees != null && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{result.affectedEmployees} of {result.totalEmployees} employees affected</p>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={onExport}><FileText style={{ height: 14, width: 14, marginRight: 4 }} /> Export</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={onSave}><Save style={{ height: 14, width: 14, marginRight: 4 }} /> Save</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={onModify}><RotateCcw style={{ height: 14, width: 14, marginRight: 4 }} /> Modify</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={onNewScenario}>New</CVisionButton>
          </div>
        </div>

        {/* Impact cards */}
        <div className={cn('grid gap-3', hasRetention ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-3')}>
          <ImpactCard label="Budget" icon={DollarSign} primary={signedSAR(result.monthlyCostDifference) + '/mo'} secondary={signedSAR(result.annualCostDifference) + '/yr'} positive={result.monthlyCostDifference <= 0} />
          {hasRetention && <ImpactCard label="Retention" icon={Heart} primary={`Risk: ${Math.round(result.currentAvgRiskScore)} → ${Math.round(result.projectedAvgRiskScore)}`} secondary={`${result.riskScoreChange > 0 ? '+' : ''}${result.riskScoreChange.toFixed(1)} pts`} positive={result.riskScoreChange < 0} />}
          <ImpactCard label="GOSI" icon={Building2} primary={signedSAR(result.gosiDifference) + '/mo'} secondary={signedSAR(result.gosiDifference * 12) + '/yr'} positive={result.gosiDifference <= 0} />
          {hasRetention && <ImpactCard label="Saudization" icon={Shield} primary={result.currentSaudizationRate === result.projectedSaudizationRate ? 'No change' : `${result.currentSaudizationRate}% → ${result.projectedSaudizationRate}%`} secondary={result.nitaqatBandChange || getNitaqat(result.projectedSaudizationRate).band} positive={result.projectedSaudizationRate >= result.currentSaudizationRate} />}
          <ImpactCard label="Headcount" icon={Users} primary={result.currentHeadcount === result.projectedHeadcount ? 'No change' : `${result.currentHeadcount} → ${result.projectedHeadcount}`} secondary={result.employeesImproved > 0 ? `${result.employeesImproved} improved` : `${result.percentageChange >= 0 ? '+' : ''}${result.percentageChange.toFixed(1)}%`} positive={true} />
        </div>

        {/* Pros & Cons */}
        {(result.pros.length > 0 || result.cons.length > 0) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
            {result.pros.length > 0 && <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.greenDim, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}><p style={{ fontSize: 13, fontWeight: 600, color: C.green, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 style={{ height: 16, width: 16 }} /> Pros</p><ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{result.pros.map((p, i) => <li key={i} style={{ fontSize: 13, color: C.green }}>• {p}</li>)}</ul></div>}
            {result.cons.length > 0 && <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.redDim, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}><p style={{ fontSize: 13, fontWeight: 600, color: C.red, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle style={{ height: 16, width: 16 }} /> Cons</p><ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{result.cons.map((c, i) => <li key={i} style={{ fontSize: 13, color: C.red }}>• {c}</li>)}</ul></div>}
          </div>
        )}

        {/* Warnings (from old API) */}
        {result.warnings && result.warnings.length > 0 && (
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.orangeDim, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><AlertTriangle style={{ height: 16, width: 16, color: C.orange }} /><span style={{ fontSize: 13, fontWeight: 600, color: C.orange }}>Warnings</span></div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{result.warnings.map((w, i) => <li key={i} style={{ fontSize: 13, color: C.orange }}>• {w}</li>)}</ul>
          </div>
        )}

        {/* Department impact (from old API) */}
        {result.departmentImpact && result.departmentImpact.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>Department Impact</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}><th style={{ textAlign: 'left', padding: 8, fontWeight: 500 }}>Department</th><th style={{ textAlign: 'right', padding: 8, fontWeight: 500 }}>Current</th><th style={{ textAlign: 'right', padding: 8, fontWeight: 500 }}>Projected</th><th style={{ textAlign: 'right', padding: 8, fontWeight: 500 }}>Change</th><th style={{ textAlign: 'right', padding: 8, fontWeight: 500 }}>%</th></tr></thead>
                <tbody>{result.departmentImpact.map(d => (
                  <tr key={d.department} className={cn('border-b', d.percentageChange > 10 ? 'bg-red-50/50' : d.percentageChange < 0 ? 'bg-green-50/50' : '')}>
                    <td style={{ padding: 8, fontWeight: 500 }}>{d.department}</td><td style={{ padding: 8, textAlign: 'right' }}>{formatSAR(d.currentMonthly)}</td><td style={{ padding: 8, textAlign: 'right' }}>{formatSAR(d.projectedMonthly)}</td>
                    <td className={cn('p-2 text-right font-medium', changeColor(d.difference))}>{d.difference > 0 ? '+' : ''}{formatSAR(d.difference)}</td>
                    <td className={cn('p-2 text-right', changeColor(d.percentageChange))}>{d.percentageChange >= 0 ? '+' : ''}{d.percentageChange.toFixed(1)}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* ROI */}
        {hasRetention && result.annualCostDifference > 0 && highRiskCount > 0 && (
          <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Zap style={{ height: 16, width: 16, color: C.gold }} /> ROI Analysis</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12, fontSize: 13 }}>
              <div><span style={{ color: C.textMuted, display: 'block', fontSize: 12 }}>Cost of scenario</span><span style={{ fontWeight: 600 }}>{formatSAR(result.annualCostDifference + result.gosiDifference * 12)}/yr</span></div>
              <div><span style={{ color: C.textMuted, display: 'block', fontSize: 12 }}>Cost if {highRiskCount} high-risk leave</span><span style={{ fontWeight: 600, color: C.red }}>{formatSAR(replacementCost)}</span></div>
              <div><span style={{ color: C.textMuted, display: 'block', fontSize: 12 }}>ROI</span><span style={{ fontWeight: 600, color: C.green }}>{replacementCost > 0 && result.annualCostDifference > 0 ? `${(replacementCost / result.annualCostDifference).toFixed(1)}x` : '—'}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Employee Impact Table */}
      {result.employeeImpacts.length > 0 && (
        <div style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
          <button onClick={toggleImpactTable} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, transition: 'color 0.2s, background 0.2s' }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><Users style={{ height: 16, width: 16 }} />Employee Impact ({result.employeeImpacts.length})</span>
            {showImpactTable ? <ChevronUp style={{ height: 16, width: 16 }} /> : <ChevronDown style={{ height: 16, width: 16 }} />}
          </button>
          {showImpactTable && (
            <div style={{ borderTop: `1px solid ${C.border}`, overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}><th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Employee</th><th style={{ textAlign: 'left', padding: 12, fontWeight: 500 }}>Dept</th><th style={{ textAlign: 'right', padding: 12, fontWeight: 500 }}>Current</th><th style={{ textAlign: 'right', padding: 12, fontWeight: 500 }}>New</th><th style={{ textAlign: 'right', padding: 12, fontWeight: 500 }}>Salary Δ</th><th style={{ textAlign: 'right', padding: 12, fontWeight: 500 }}>Risk Before</th><th style={{ textAlign: 'right', padding: 12, fontWeight: 500 }}>Risk After</th><th style={{ textAlign: 'right', padding: 12, fontWeight: 500 }}>Risk Δ</th></tr></thead>
                <tbody>{result.employeeImpacts.filter(e => e.currentSalary > 0 || e.projectedSalary > 0).sort((a, b) => a.riskChange - b.riskChange).slice(0, 50).map(emp => {
                  const rb = RiskBadge(emp.currentRiskScore); const rbNew = RiskBadge(emp.projectedRiskScore);
                  return (
                    <tr key={emp.employeeId} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: 12 }}><span style={{ fontWeight: 500 }}>{emp.employeeName}</span>{emp.isSaudi && <CVisionBadge C={C} variant="outline" style={{ marginLeft: 4, paddingTop: 0, paddingBottom: 0 }}>SA</CVisionBadge>}</td>
                      <td style={{ padding: 12, color: C.textMuted }}>{emp.department}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{emp.currentSalary > 0 ? formatSAR(emp.currentSalary) : '—'}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}>{emp.projectedSalary > 0 ? formatSAR(emp.projectedSalary) : '—'}</td>
                      <td className={cn('p-3 text-right font-medium', changeColor(emp.salaryChange))}>{emp.salaryChange !== 0 ? signedSAR(emp.salaryChange) : '—'}</td>
                      <td style={{ padding: 12, textAlign: 'right' }}><CVisionBadge C={C} variant="outline" className={cn('text-[10px]', rb.cls)}>{emp.currentRiskScore}</CVisionBadge></td>
                      <td style={{ padding: 12, textAlign: 'right' }}><CVisionBadge C={C} variant="outline" className={cn('text-[10px]', rbNew.cls)}>{emp.projectedRiskScore}</CVisionBadge></td>
                      <td className={cn('p-3 text-right font-medium', changeColor(emp.riskChange, true))}>{emp.riskChange > 0 ? '+' : ''}{emp.riskChange}{emp.riskChange < 0 ? ' ↘' : emp.riskChange > 0 ? ' ↗' : ''}</td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ImpactCard({ label, icon: Icon, primary, secondary, positive }: { label: string; icon: typeof DollarSign; primary: string; secondary: string; positive: boolean }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div className={cn('rounded-lg border p-3 text-center transition-colors', positive ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200')}>
      <Icon className={cn('h-4 w-4 mx-auto mb-1', positive ? 'text-green-600' : 'text-red-600')} /><p style={{ fontSize: 12, color: C.textMuted }}>{label}</p>
      <p className={cn('text-sm font-bold mt-0.5', positive ? 'text-green-700' : 'text-red-700')}>{primary}</p><p style={{ fontSize: 12, color: C.textMuted }}>{secondary}</p>
    </div>
  );
}

// ── Compare helpers ──────────────────────────────────────────────

function updateCmpDefaults(type: ScenarioType, setter: (p: Record<string, any>) => void, departments: DeptInfo[]) {
  switch (type) {
    case 'SALARY_INCREASE': setter({ percentage: 5, scope: 'ALL' }); break;
    case 'NEW_HIRES': setter({ positions: [{ title: 'New Hire', department: departments[0]?.department || '', salary: 5000, isSaudi: true }] }); break;
    case 'LAYOFFS': setter({ criteria: 'NEWEST', count: 1 }); break;
    case 'PROMOTION_WAVE': setter({ promotions: [] }); break;
    case 'BURNOUT_RELIEF': setter({ actions: ['REDUCE_OVERTIME'] }); break;
  }
}

function CmpParamForm({ type, params, setParams, departments }: { type: ScenarioType; params: Record<string, any>; setParams: (p: Record<string, any>) => void; departments: DeptInfo[] }) {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const BURNOUT_OPTIONS = getBurnoutOptions(tr);
  if (type === 'SALARY_INCREASE') return (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Percentage (%)</CVisionLabel><CVisionInput C={C} type="number" min={1} value={params.percentage || 5} onChange={e => setParams({ ...params, percentage: Number(e.target.value) })} /><CVisionLabel C={C} style={{ fontSize: 12 }}>Scope</CVisionLabel><CVisionSelect C={C} value={params.scope || 'ALL'} onChange={v => setParams({ ...params, scope: v })} options={[{ value: 'ALL', label: 'All' }, { value: 'HIGH_RISK', label: 'High-Risk' }]} /></div>);
  if (type === 'NEW_HIRES') { const pos = params.positions?.[0] || { title: 'New Hire', salary: 5000, isSaudi: true }; return (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Title</CVisionLabel><CVisionInput C={C} value={pos.title} onChange={e => setParams({ ...params, positions: [{ ...pos, title: e.target.value }] })} style={{ height: 32, fontSize: 12 }} /></div><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Salary</CVisionLabel><CVisionInput C={C} type="number" value={pos.salary} onChange={e => setParams({ ...params, positions: [{ ...pos, salary: Number(e.target.value) }] })} style={{ height: 32, fontSize: 12 }} /></div><div style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center' }}><label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="radio" checked={pos.isSaudi} onChange={() => setParams({ ...params, positions: [{ ...pos, isSaudi: true }] })} /> Saudi</label><label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}><input type="radio" checked={!pos.isSaudi} onChange={() => setParams({ ...params, positions: [{ ...pos, isSaudi: false }] })} /> Non-Saudi</label></div></div>); }
  if (type === 'LAYOFFS') return (<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><CVisionLabel C={C} style={{ fontSize: 12 }}>Count</CVisionLabel><CVisionInput C={C} type="number" min={1} value={params.count || 1} onChange={e => setParams({ ...params, count: Number(e.target.value) })} style={{ height: 32, fontSize: 12 }} /></div>);
  if (type === 'BURNOUT_RELIEF') { const actions = params.actions || []; return (<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{BURNOUT_OPTIONS.map(opt => (<label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}><Checkbox checked={actions.includes(opt.key)} onCheckedChange={checked => { const next = checked ? [...actions, opt.key] : actions.filter((a: string) => a !== opt.key); setParams({ ...params, actions: next }); }} style={{ height: 14, width: 14 }} />{opt.label}</label>))}</div>); }
  return <p style={{ fontSize: 12, color: C.textMuted }}>Configure in simulator tab</p>;
}

function CmpColumn({ label, result, isBetter }: { label: string; result: WhatIfResult; isBetter: boolean }) {
  const { C, isDark } = useCVisionTheme();
  return (
    <div className={cn('rounded-lg border p-4 space-y-3', isBetter && 'ring-2 ring-primary')}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h3 style={{ fontWeight: 600, fontSize: 13 }}>{label}</h3>{isBetter && <CVisionBadge C={C} style={{ background: C.gold, color: '#fff' }}>BETTER VALUE</CVisionBadge>}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
        <CmpRow label="Budget" value={`${signedSAR(result.annualCostDifference)}/yr`} color={changeColor(result.annualCostDifference)} />
        <CmpRow label="Retention" value={`${result.riskScoreChange > 0 ? '+' : ''}${result.riskScoreChange.toFixed(1)} pts`} color={changeColor(result.riskScoreChange, true)} />
        <CmpRow label="GOSI" value={`${signedSAR(result.gosiDifference * 12)}/yr`} color={changeColor(result.gosiDifference)} />
        <CmpRow label="Saudization" value={result.currentSaudizationRate === result.projectedSaudizationRate ? 'No change' : `${result.currentSaudizationRate}% → ${result.projectedSaudizationRate}%`} color="" />
        <CmpRow label="Headcount" value={`${result.currentHeadcount} → ${result.projectedHeadcount}`} color="" />
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8 }}><CmpRow label="Cost / Risk Point" value={result.riskScoreChange !== 0 ? `${formatSAR(Math.abs(result.annualCostDifference / result.riskScoreChange))}` : '—'} color="font-semibold" /></div>
      </div>
    </div>
  );
}

function CmpRow({ label, value, color }: { label: string; value: string; color: string }) {
  const { C, isDark } = useCVisionTheme();
  return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{label}</span><span className={cn('font-medium', color)}>{value}</span></div>);
}
