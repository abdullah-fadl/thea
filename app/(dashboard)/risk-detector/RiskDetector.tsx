'use client';

// =============================================================================
// RiskDetector — Identify risk signals in operational practices vs policies
// =============================================================================

import { useState, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { useLang } from '@/hooks/use-lang';
import {
  ShieldAlert,
  Plus,
  Play,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileWarning,
  Trash2,
  Eye,
  History,
  Settings2,
  BarChart3,
  BookOpen,
  X,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json());

// ── Status config ────────────────────────────────────────────────────────────
const COVERAGE_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bg: string; icon: any }> = {
  Covered:  { labelEn: 'Covered',   labelAr: 'مغطى',    color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-100 dark:bg-green-900/30',  icon: CheckCircle2 },
  Partial:  { labelEn: 'Partial',   labelAr: 'جزئي',    color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-100 dark:bg-amber-900/30',  icon: AlertTriangle },
  NoPolicy: { labelEn: 'No Policy', labelAr: 'بلا سياسة', color: 'text-red-700 dark:text-red-300',    bg: 'bg-red-100 dark:bg-red-900/30',      icon: XCircle },
  Conflict: { labelEn: 'Conflict',  labelAr: 'تعارض',   color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30', icon: FileWarning },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  Low:      { color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-100 dark:bg-green-900/30' },
  Med:      { color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-100 dark:bg-amber-900/30' },
  High:     { color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  Critical: { color: 'text-red-700 dark:text-red-300',      bg: 'bg-red-100 dark:bg-red-900/30' },
};

const FREQUENCY_OPTIONS = ['Rare', 'Occasional', 'Frequent', 'Daily'] as const;
const SETTING_OPTIONS = ['IPD', 'OPD', 'Corporate', 'Shared'] as const;

function fmtDate(iso: string | null) {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RiskDetector() {
  const { language } = useLang();
  const isAr = language === 'ar';
  const tr = (ar: string, en: string) => (isAr ? ar : en);

  // ── State ──
  const [tab, setTab] = useState<'practices' | 'run' | 'history'>('practices');
  const [search, setSearch] = useState('');
  const [settingFilter, setSettingFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // New practice form
  const [form, setForm] = useState({ title: '', description: '', frequency: 'Occasional' as string, setting: 'IPD' as string, departmentId: '', ownerRole: '' });

  // Run state
  const [runSetting, setRunSetting] = useState('IPD');
  const [runDeptId, setRunDeptId] = useState('');
  const [selectedPractices, setSelectedPractices] = useState<Set<string>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);

  // ── Data ──
  const practiceParams = new URLSearchParams();
  if (settingFilter) practiceParams.set('setting', settingFilter);
  const { data: practicesData, mutate: mutatePractices } = useSWR(
    `/api/risk-detector/practices?${practiceParams}`,
    fetcher
  );
  const practices: any[] = practicesData?.practices || [];

  const { data: deptData } = useSWR('/api/departments/active', fetcher);
  const departments: any[] = deptData?.departments || deptData?.items || [];

  const { data: runsData, mutate: mutateRuns } = useSWR(
    tab === 'history' ? '/api/risk-detector/runs' : null,
    fetcher
  );
  const runs: any[] = runsData?.runs || [];

  // ── Filtered practices ──
  const q = search.trim().toLowerCase();
  const filtered = q
    ? practices.filter((p: any) => p.title.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    : practices;

  // ── Create practice ──
  const createPractice = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    try {
      await fetch('/api/risk-detector/practices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      mutatePractices();
      setForm({ title: '', description: '', frequency: 'Occasional', setting: 'IPD', departmentId: '', ownerRole: '' });
      setShowAdd(false);
    } catch { /* ignore */ }
  };

  // ── Archive practice ──
  const archivePractice = async (id: string) => {
    try {
      await fetch(`/api/risk-detector/practices/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      mutatePractices();
    } catch { /* ignore */ }
  };

  // ── Run analysis ──
  const runAnalysis = async () => {
    if (selectedPractices.size === 0 || !runDeptId) return;
    setIsRunning(true);
    setRunResult(null);

    try {
      const res = await fetch('/api/risk-detector/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          departmentId: runDeptId,
          setting: runSetting,
          practiceIds: Array.from(selectedPractices),
        }),
      });
      const data = await res.json();
      setRunResult(data);
      mutateRuns();
    } catch (err) {
      setRunResult({ error: 'Failed to run analysis' });
    }
    setIsRunning(false);
  };

  // ── Toggle practice selection ──
  const togglePractice = (id: string) => {
    setSelectedPractices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // ── Render ──
  return (
    <div className="space-y-6 p-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-red-500" />
          {tr('كاشف المخاطر', 'Risk Detector')}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tr('تحليل الممارسات التشغيلية مقابل السياسات وكشف الفجوات والمخاطر', 'Analyze operational practices against policies to identify gaps and risks')}
        </p>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {([
          { key: 'practices' as const, labelEn: 'Practices', labelAr: 'الممارسات', icon: Settings2 },
          { key: 'run' as const, labelEn: 'Run Analysis', labelAr: 'تشغيل التحليل', icon: Play },
          { key: 'history' as const, labelEn: 'History', labelAr: 'السجل', icon: History },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition ${
              tab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {isAr ? t.labelAr : t.labelEn}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Practices                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'practices' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card focus:ring-2 focus:ring-red-500 outline-none"
                placeholder={tr('بحث في الممارسات...', 'Search practices...')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
              value={settingFilter}
              onChange={e => setSettingFilter(e.target.value)}
            >
              <option value="">{tr('كل الإعدادات', 'All Settings')}</option>
              {SETTING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition"
            >
              <Plus className="h-4 w-4" /> {tr('إضافة ممارسة', 'Add Practice')}
            </button>
          </div>

          {/* Add Form */}
          {showAdd && (
            <div className="bg-card rounded-xl border-2 border-red-200 dark:border-red-800 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">{tr('ممارسة جديدة', 'New Practice')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
                  placeholder={tr('العنوان', 'Title')}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
                <select
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
                  value={form.setting}
                  onChange={e => setForm(f => ({ ...f, setting: e.target.value }))}
                >
                  {SETTING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
                  value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                >
                  {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
                  value={form.departmentId}
                  onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))}
                >
                  <option value="">{tr('القسم', 'Department')}</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name || d.code}</option>)}
                </select>
              </div>
              <textarea
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none resize-none h-20"
                placeholder={tr('وصف الممارسة...', 'Practice description...')}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
              <div className="flex gap-2">
                <button
                  onClick={createPractice}
                  disabled={!form.title.trim() || !form.description.trim() || !form.departmentId}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 transition"
                >
                  {tr('حفظ', 'Save')}
                </button>
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted/50 transition">
                  {tr('إلغاء', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {/* Practices List */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {tr('لا توجد ممارسات', 'No practices found')}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((p: any) => (
                <div key={p.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground text-sm">{p.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">{p.setting}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">{p.frequency}</span>
                        {p.ownerRole && <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{p.ownerRole}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => archivePractice(p.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      title={tr('أرشفة', 'Archive')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: Run Analysis                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'run' && (
        <div className="space-y-4">
          {/* Config */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-red-500" />
              {tr('إعدادات التحليل', 'Analysis Configuration')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr('القسم', 'Department')}</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
                  value={runDeptId}
                  onChange={e => setRunDeptId(e.target.value)}
                >
                  <option value="">{tr('اختر القسم', 'Select department')}</option>
                  {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name || d.code}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">{tr('الإعداد', 'Setting')}</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-card outline-none"
                  value={runSetting}
                  onChange={e => setRunSetting(e.target.value)}
                >
                  {SETTING_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Select Practices */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {tr('اختر الممارسات', 'Select Practices')} ({selectedPractices.size} {tr('محدد', 'selected')})
              </h3>
              <button
                onClick={() => {
                  if (selectedPractices.size === practices.length) {
                    setSelectedPractices(new Set());
                  } else {
                    setSelectedPractices(new Set(practices.map((p: any) => p.id)));
                  }
                }}
                className="text-xs text-indigo-600 hover:underline"
              >
                {selectedPractices.size === practices.length ? tr('إلغاء الكل', 'Deselect All') : tr('تحديد الكل', 'Select All')}
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {practices.map((p: any) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                    selectedPractices.has(p.id)
                      ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPractices.has(p.id)}
                    onChange={() => togglePractice(p.id)}
                    className="h-4 w-4 rounded border-border text-red-600 focus:ring-red-500"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{p.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">{p.setting} · {p.frequency}</span>
                  </div>
                </label>
              ))}
              {practices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tr('أضف ممارسات أولاً من التبويب السابق', 'Add practices first from the Practices tab')}
                </p>
              )}
            </div>
          </div>

          {/* Run Button */}
          <button
            onClick={runAnalysis}
            disabled={isRunning || selectedPractices.size === 0 || !runDeptId}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {isRunning ? tr('جاري التحليل...', 'Analyzing...') : tr('تشغيل تحليل المخاطر', 'Run Risk Analysis')}
          </button>

          {/* Results */}
          {runResult && !runResult.error && !runResult.serviceUnavailable && (
            <RunResultsView result={runResult} practices={practices} tr={tr} isAr={isAr} />
          )}
          {runResult?.serviceUnavailable && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              {tr('خدمة محرك السياسات غير متوفرة حالياً. تحليل الفجوات بالذكاء الاصطناعي معطل.', 'Policy Engine service is not available. AI gap analysis is disabled.')}
            </div>
          )}
          {runResult?.error && !runResult.serviceUnavailable && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-800 dark:text-red-200">
              <XCircle className="h-4 w-4 inline mr-2" />
              {runResult.error}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: History                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'history' && (
        <div className="space-y-3">
          {runs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {tr('لا توجد عمليات تحليل سابقة', 'No previous analysis runs')}
            </div>
          ) : (
            runs.map((run: any) => {
              const isExp = expanded[run.id];
              const results = run.resultsJson?.practices || [];
              const meta = run.resultsJson?.metadata || {};

              return (
                <div key={run.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => toggleExpand(run.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {run.setting} — {fmtDate(run.createdAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">{run.inputPracticeIds?.length || 0} {tr('ممارسة', 'practices')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {results.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {results.filter((r: any) => r.status === 'NoPolicy' || r.status === 'Conflict').length} {tr('مخاطر', 'risks')}
                        </span>
                      )}
                      {isExp ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {isExp && (
                    <div className="px-4 pb-4 border-t border-border">
                      <RunResultsView
                        result={{ results: run.resultsJson }}
                        practices={practices}
                        tr={tr}
                        isAr={isAr}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: Run Results View ──────────────────────────────────────────
function RunResultsView({ result, practices, tr, isAr }: { result: any; practices: any[]; tr: (ar: string, en: string) => string; isAr: boolean }) {
  const items: any[] = result?.results?.practices || [];
  const meta = result?.results?.metadata || {};
  const practiceMap = new Map(practices.map((p: any) => [p.id, p]));

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        {tr('لا توجد نتائج', 'No results')}
      </div>
    );
  }

  // Summary counts
  const covered = items.filter(i => i.status === 'Covered').length;
  const partial = items.filter(i => i.status === 'Partial').length;
  const noPolicy = items.filter(i => i.status === 'NoPolicy').length;
  const conflict = items.filter(i => i.status === 'Conflict').length;

  return (
    <div className="space-y-4 mt-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: tr('مغطى', 'Covered'), value: covered, color: 'text-green-600' },
          { label: tr('جزئي', 'Partial'), value: partial, color: 'text-amber-600' },
          { label: tr('بلا سياسة', 'No Policy'), value: noPolicy, color: 'text-red-600' },
          { label: tr('تعارض', 'Conflict'), value: conflict, color: 'text-purple-600' },
        ].map((s, i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {meta.policiesAnalyzed && (
        <p className="text-xs text-muted-foreground">
          {meta.totalPractices} {tr('ممارسة تم تحليلها مقابل', 'practices analyzed against')} {meta.policiesAnalyzed} {tr('سياسة', 'policies')}
          {meta.model && ` · ${meta.model}`}
        </p>
      )}

      {/* Practice results */}
      <div className="space-y-2">
        {items.map((item: any, idx: number) => {
          const cov = COVERAGE_CONFIG[item.status] || COVERAGE_CONFIG.NoPolicy;
          const sev = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.Low;
          const CovIcon = cov.icon;
          const practice = practiceMap.get(item.practiceId);

          return (
            <div key={idx} className="rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-card">
                <CovIcon className={`h-5 w-5 ${cov.color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {practice?.title || item.practiceId}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cov.bg} ${cov.color}`}>
                  {isAr ? cov.labelAr : cov.labelEn}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${sev.bg} ${sev.color}`}>
                  {item.severity}
                </span>
                {item.riskScore > 0 && (
                  <span className="text-xs font-mono text-muted-foreground">
                    {tr('نقاط', 'Score')}: {Math.round(item.riskScore)}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="px-4 pb-3 bg-muted/50/50 space-y-2">
                {/* Recommendations */}
                {item.recommendations?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr('التوصيات', 'Recommendations')}</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {item.recommendations.map((r: string, ri: number) => (
                        <li key={ri} className="text-xs text-foreground">{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Related Policies */}
                {item.relatedPolicies?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr('السياسات ذات الصلة', 'Related Policies')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {item.relatedPolicies.map((pol: any, pi: number) => (
                        <span key={pi} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                          <BookOpen className="h-3 w-3" />
                          {pol.title || pol.policyId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reason */}
                {item.reason?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{tr('الأسباب', 'Reasons')}</p>
                    {item.reason.map((r: string, ri: number) => (
                      <p key={ri} className="text-xs text-muted-foreground">{r}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
