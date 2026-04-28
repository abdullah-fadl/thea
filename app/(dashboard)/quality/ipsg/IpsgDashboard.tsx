'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useRoutePermission } from '@/lib/hooks/useRoutePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  IPSG_GOALS,
  generatePeriodOptions,
  getScoreColor,
  getScoreLabel,
  type ActionItem,
  type ActionStatus,
  type IpsgFindingItem,
  ACTION_STATUSES,
} from '@/lib/quality/ipsgDefinitions';

const fetcher = (url: string) => fetch(url, { credentials: 'include' }).then((r) => r.json());

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------

function ScoreCircle({
  score,
  size = 'lg',
  label,
}: {
  score: number | null | undefined;
  size?: 'sm' | 'lg';
  label?: string;
}) {
  const color = getScoreColor(score);
  const dim = size === 'lg' ? 'w-28 h-28' : 'w-16 h-16';
  const textSize = size === 'lg' ? 'text-3xl' : 'text-lg';
  const bgMap: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    yellow: 'bg-amber-100 text-amber-700 border-amber-300',
    red: 'bg-red-100 text-red-700 border-red-300',
    gray: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${dim} rounded-full border-4 flex items-center justify-center ${bgMap[color]}`}
      >
        <span className={`${textSize} font-extrabold`}>
          {score != null ? `${score}%` : '—'}
        </span>
      </div>
      {label && (
        <span className="text-xs text-muted-foreground text-center">{label}</span>
      )}
    </div>
  );
}

function TrendArrow({
  trend,
  tr,
}: {
  trend: 'up' | 'down' | 'stable' | null;
  tr: (ar: string, en: string) => string;
}) {
  if (!trend) return <span className="text-muted-foreground text-xs">{tr('لا يوجد', 'N/A')}</span>;
  if (trend === 'up')
    return <span className="text-emerald-600 font-bold text-sm">{'\u2191'}</span>;
  if (trend === 'down')
    return <span className="text-red-600 font-bold text-sm">{'\u2193'}</span>;
  return <span className="text-muted-foreground font-bold text-sm">{'\u2192'}</span>;
}

function StatusBadge({
  status,
  tr,
}: {
  status: string;
  tr: (ar: string, en: string) => string;
}) {
  const map: Record<string, { bg: string; label: [string, string] }> = {
    DRAFT: { bg: 'bg-muted text-foreground', label: ['مسودة', 'Draft'] },
    SUBMITTED: {
      bg: 'bg-blue-100 text-blue-700',
      label: ['مُقدَّم', 'Submitted'],
    },
    APPROVED: {
      bg: 'bg-emerald-100 text-emerald-700',
      label: ['معتمد', 'Approved'],
    },
  };
  const cfg = map[status] || map.DRAFT;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
      {tr(cfg.label[0], cfg.label[1])}
    </span>
  );
}

function ActionStatusBadge({
  status,
  tr,
}: {
  status: string;
  tr: (ar: string, en: string) => string;
}) {
  const map: Record<string, { bg: string; label: [string, string] }> = {
    PENDING: { bg: 'bg-amber-100 text-amber-700', label: ['معلق', 'Pending'] },
    IN_PROGRESS: {
      bg: 'bg-blue-100 text-blue-700',
      label: ['قيد التنفيذ', 'In Progress'],
    },
    COMPLETED: {
      bg: 'bg-emerald-100 text-emerald-700',
      label: ['مكتمل', 'Completed'],
    },
    OVERDUE: {
      bg: 'bg-red-100 text-red-700',
      label: ['متأخر', 'Overdue'],
    },
  };
  const cfg = map[status] || map.PENDING;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
      {tr(cfg.label[0], cfg.label[1])}
    </span>
  );
}

const GOAL_COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-300 bg-blue-50',
  green: 'border-emerald-300 bg-emerald-50',
  red: 'border-red-300 bg-red-50',
  purple: 'border-purple-300 bg-purple-50',
  orange: 'border-orange-300 bg-orange-50',
  amber: 'border-amber-300 bg-amber-50',
};

const GOAL_BADGE_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  amber: 'bg-amber-100 text-amber-800',
};

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function IpsgDashboard() {
  const { isRTL, language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { hasPermission, isLoading: permLoading } = useRoutePermission('/quality/ipsg');

  // State
  const [periodFilter, setPeriodFilter] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [viewAssessment, setViewAssessment] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Data fetch
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (periodFilter) params.set('period', periodFilter);
    return `/api/quality/ipsg?${params.toString()}`;
  }, [periodFilter]);

  const { data, mutate } = useSWR(
    hasPermission ? apiUrl : null,
    fetcher,
    { refreshInterval: 0 }
  );

  const items: any[] = Array.isArray(data?.items) ? data.items : [];
  const summary = data?.summary || {};
  const periodOptions = useMemo(() => generatePeriodOptions(), []);

  // Latest assessment for overview
  const latestAssessment = items[0] || null;

  // -----------------------------------------------------------------------
  // Assessment Form State
  // -----------------------------------------------------------------------
  const [formData, setFormData] = useState<Record<string, any>>(() => resetForm());

  function resetForm() {
    const fd: Record<string, any> = {
      assessmentDate: new Date().toISOString().split('T')[0],
      assessorName: '',
      period: '',
      notes: '',
      status: 'DRAFT',
    };
    for (let i = 1; i <= 6; i++) {
      fd[`ipsg${i}Findings`] = IPSG_GOALS[i - 1].checklistItems.map((ci) => ({
        item: language === 'ar' ? ci.ar : ci.en,
        itemId: ci.id,
        compliant: false,
        notes: '',
      }));
    }
    return fd;
  }

  function computeGoalScore(goalNum: number): number {
    const findings: IpsgFindingItem[] = formData[`ipsg${goalNum}Findings`] || [];
    if (findings.length === 0) return 0;
    const compliantCount = findings.filter((f) => f.compliant).length;
    return Math.round((compliantCount / findings.length) * 100);
  }

  function handleFindingChange(
    goalNum: number,
    itemIdx: number,
    field: 'compliant' | 'notes',
    value: boolean | string
  ) {
    setFormData((prev) => {
      const key = `ipsg${goalNum}Findings`;
      const findings = [...(prev[key] || [])];
      findings[itemIdx] = { ...findings[itemIdx], [field]: value };
      return { ...prev, [key]: findings };
    });
  }

  // -----------------------------------------------------------------------
  // Save / Submit assessment
  // -----------------------------------------------------------------------
  const saveAssessment = useCallback(
    async (submitStatus: 'DRAFT' | 'SUBMITTED') => {
      setSaving(true);
      try {
        const payload: Record<string, any> = {
          assessmentDate: formData.assessmentDate,
          assessorName: formData.assessorName,
          period: formData.period,
          notes: formData.notes,
          status: submitStatus,
        };
        for (let i = 1; i <= 6; i++) {
          payload[`ipsg${i}Score`] = computeGoalScore(i);
          payload[`ipsg${i}Findings`] = formData[`ipsg${i}Findings`];
        }

        const res = await fetch('/api/quality/ipsg', {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setShowForm(false);
          setFormData(resetForm());
          await mutate();
        }
      } finally {
        setSaving(false);
      }
    },
    [formData, mutate]
  );

  // -----------------------------------------------------------------------
  // Action Item inline status update
  // -----------------------------------------------------------------------
  const updateActionItemStatus = useCallback(
    async (assessmentId: string, itemIdx: number, newStatus: string) => {
      const assessment = items.find((a: any) => a.id === assessmentId);
      if (!assessment) return;
      const actions: ActionItem[] = Array.isArray(assessment.actionItems)
        ? [...assessment.actionItems]
        : [];
      if (!actions[itemIdx]) return;
      actions[itemIdx] = { ...actions[itemIdx], status: newStatus as ActionStatus };

      await fetch('/api/quality/ipsg', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assessmentId, actionItems: actions }),
      });
      await mutate();
    },
    [items, mutate]
  );

  // -----------------------------------------------------------------------
  // Render gates
  // -----------------------------------------------------------------------
  if (permLoading || hasPermission === null) return null;
  if (!hasPermission) return null;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">
            {tr(
              'لوحة أهداف السلامة الدولية للمرضى (IPSG)',
              'International Patient Safety Goals (IPSG) Dashboard'
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tr(
              'مراقبة وتقييم الالتزام بأهداف السلامة الستة',
              'Monitor and assess compliance with the 6 safety goals'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodFilter || '__all__'} onValueChange={(v) => setPeriodFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={tr('كل الفترات', 'All Periods')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{tr('كل الفترات', 'All Periods')}</SelectItem>
              {periodOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {tr(p.labelAr, p.labelEn)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ================================================================
          KPI Cards Row
          ================================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Overall */}
        <div className="col-span-2 md:col-span-1 bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {tr('الدرجة الكلية', 'Overall')}
          </span>
          <ScoreCircle
            score={summary.avgOverall ?? latestAssessment?.overallScore ?? null}
            size="lg"
            label={getScoreLabel(
              summary.avgOverall ?? latestAssessment?.overallScore ?? null,
              language
            )}
          />
          <div className="flex items-center gap-1">
            <TrendArrow trend={summary.trend ?? null} tr={tr} />
          </div>
        </div>
        {/* Individual IPSG 1-6 */}
        {IPSG_GOALS.map((goal) => {
          const goalKey = `ipsg${goal.number}`;
          const score =
            summary.goalAverages?.[goalKey] ??
            latestAssessment?.[`${goalKey}Score`] ??
            null;
          const trend = summary.goalTrends?.[goalKey] ?? null;
          return (
            <div
              key={goal.id}
              className={`bg-card border rounded-2xl p-3 flex flex-col items-center justify-between gap-1.5 ${GOAL_COLOR_MAP[goal.color] || 'border-border'}`}
            >
              <Badge className={`text-[10px] ${GOAL_BADGE_MAP[goal.color] || ''}`}>
                IPSG {goal.number}
              </Badge>
              <ScoreCircle score={score} size="sm" />
              <span className="text-[10px] text-center leading-tight text-muted-foreground line-clamp-2">
                {tr(goal.titleAr, goal.titleEn)}
              </span>
              <TrendArrow trend={trend} tr={tr} />
            </div>
          );
        })}
      </div>

      {/* ================================================================
          Tabs
          ================================================================ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">{tr('نظرة عامة', 'Overview')}</TabsTrigger>
          <TabsTrigger value="assessment">
            {tr('التقييم التفصيلي', 'Detailed Assessment')}
          </TabsTrigger>
          <TabsTrigger value="actions">
            {tr('خطة العمل', 'Action Items')}
          </TabsTrigger>
          <TabsTrigger value="trends">
            {tr('تحليل الاتجاهات', 'Trend Analysis')}
          </TabsTrigger>
        </TabsList>

        {/* ==============================================================
            Tab 1: Overview
            ============================================================== */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Compliance Grid — 6 cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {IPSG_GOALS.map((goal) => {
              const goalKey = `ipsg${goal.number}`;
              const score =
                summary.goalAverages?.[goalKey] ??
                latestAssessment?.[`${goalKey}Score`] ??
                null;
              const findings: IpsgFindingItem[] = latestAssessment?.[`${goalKey}Findings`] || [];
              const nonCompliant = findings.filter((f) => !f.compliant);
              const trend = summary.goalTrends?.[goalKey] ?? null;

              return (
                <div
                  key={goal.id}
                  className={`border rounded-2xl overflow-hidden ${GOAL_COLOR_MAP[goal.color] || 'border-border bg-card'}`}
                >
                  <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={`${GOAL_BADGE_MAP[goal.color] || ''}`}>
                        IPSG {goal.number}
                      </Badge>
                      <span className="text-sm font-semibold">
                        {tr(goal.titleAr, goal.titleEn)}
                      </span>
                    </div>
                    <TrendArrow trend={trend} tr={tr} />
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {tr('الدرجة', 'Score')}
                      </span>
                      <span
                        className={`text-lg font-extrabold ${
                          score != null && score >= 80
                            ? 'text-emerald-600'
                            : score != null && score >= 60
                              ? 'text-amber-600'
                              : score != null
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                        }`}
                      >
                        {score != null ? `${score}%` : tr('غير مقيّم', 'N/A')}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          score != null && score >= 80
                            ? 'bg-emerald-500'
                            : score != null && score >= 60
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${score ?? 0}%` }}
                      />
                    </div>
                    {/* Target line indicator */}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="inline-block w-3 h-0.5 bg-emerald-600" />
                      {tr('الهدف: ٨٠٪', 'Target: 80%')}
                    </div>
                    {/* Top non-compliant findings */}
                    {nonCompliant.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-xs font-medium text-red-600">
                          {tr(
                            `${nonCompliant.length} بند غير مطابق`,
                            `${nonCompliant.length} non-compliant item${nonCompliant.length > 1 ? 's' : ''}`
                          )}
                        </span>
                        {nonCompliant.slice(0, 2).map((f, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-muted-foreground bg-white/60 rounded px-2 py-1"
                          >
                            {f.item}
                          </div>
                        ))}
                        {nonCompliant.length > 2 && (
                          <span className="text-[10px] text-muted-foreground">
                            {tr(
                              `+${nonCompliant.length - 2} بنود أخرى`,
                              `+${nonCompliant.length - 2} more`
                            )}
                          </span>
                        )}
                      </div>
                    )}
                    {nonCompliant.length === 0 && score != null && (
                      <div className="text-xs text-emerald-600 font-medium mt-1">
                        {tr('جميع البنود مطابقة', 'All items compliant')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Last assessment info */}
          {latestAssessment && (
            <div className="bg-card border border-border rounded-2xl p-4 text-sm flex flex-wrap items-center gap-4">
              <div>
                <span className="text-muted-foreground">{tr('آخر تقييم:', 'Last Assessment:')}</span>{' '}
                <span className="font-medium">
                  {new Date(latestAssessment.assessmentDate).toLocaleDateString(
                    language === 'ar' ? 'ar-SA' : 'en-US'
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{tr('المقيّم:', 'Assessor:')}</span>{' '}
                <span className="font-medium">
                  {latestAssessment.assessorName || tr('غير محدد', 'Unknown')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{tr('الفترة:', 'Period:')}</span>{' '}
                <span className="font-medium">{latestAssessment.period}</span>
              </div>
              <StatusBadge status={latestAssessment.status} tr={tr} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setViewAssessment(latestAssessment)}
              >
                {tr('عرض التفاصيل', 'View Details')}
              </Button>
            </div>
          )}

          {items.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
              {tr('لا توجد تقييمات بعد. ابدأ بإنشاء تقييم جديد.', 'No assessments yet. Start by creating a new assessment.')}
            </div>
          )}
        </TabsContent>

        {/* ==============================================================
            Tab 2: Detailed Assessment
            ============================================================== */}
        <TabsContent value="assessment" className="space-y-4 mt-4">
          {!showForm ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base">
                  {tr('التقييمات', 'Assessments')}
                </h2>
                <Button onClick={() => { setFormData(resetForm()); setShowForm(true); }}>
                  {tr('تقييم جديد', 'New Assessment')}
                </Button>
              </div>
              {/* Assessment list */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-start font-semibold">
                          {tr('التاريخ', 'Date')}
                        </th>
                        <th className="px-4 py-3 text-start font-semibold">
                          {tr('الفترة', 'Period')}
                        </th>
                        <th className="px-4 py-3 text-start font-semibold">
                          {tr('المقيّم', 'Assessor')}
                        </th>
                        {IPSG_GOALS.map((g) => (
                          <th
                            key={g.id}
                            className="px-3 py-3 text-center font-semibold"
                          >
                            IPSG {g.number}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-center font-semibold">
                          {tr('الكلي', 'Overall')}
                        </th>
                        <th className="px-4 py-3 text-center font-semibold">
                          {tr('الحالة', 'Status')}
                        </th>
                        <th className="px-4 py-3 text-center font-semibold">
                          {tr('إجراء', 'Action')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((a: any) => (
                        <tr
                          key={a.id}
                          className="border-b border-border last:border-0 hover:bg-muted/20"
                        >
                          <td className="px-4 py-3">
                            {new Date(a.assessmentDate).toLocaleDateString(
                              language === 'ar' ? 'ar-SA' : 'en-US'
                            )}
                          </td>
                          <td className="px-4 py-3">{a.period}</td>
                          <td className="px-4 py-3">
                            {a.assessorName || '—'}
                          </td>
                          {[1, 2, 3, 4, 5, 6].map((n) => {
                            const s = a[`ipsg${n}Score`];
                            return (
                              <td key={n} className="px-3 py-3 text-center">
                                <span
                                  className={`inline-block min-w-[40px] px-2 py-0.5 rounded-full text-xs font-bold ${
                                    s != null && s >= 80
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : s != null && s >= 60
                                        ? 'bg-amber-100 text-amber-700'
                                        : s != null
                                          ? 'bg-red-100 text-red-700'
                                          : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  {s != null ? `${s}%` : '—'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block min-w-[50px] px-2 py-1 rounded-full text-sm font-extrabold ${
                                a.overallScore != null && a.overallScore >= 80
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : a.overallScore != null && a.overallScore >= 60
                                    ? 'bg-amber-100 text-amber-700'
                                    : a.overallScore != null
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {a.overallScore != null
                                ? `${Math.round(a.overallScore)}%`
                                : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge status={a.status} tr={tr} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewAssessment(a)}
                            >
                              {tr('عرض', 'View')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {items.length === 0 && (
                        <tr>
                          <td
                            colSpan={11}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            {tr('لا توجد تقييمات', 'No assessments found')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* ---- Assessment Creation Form ---- */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base">
                  {tr('تقييم جديد', 'New Assessment')}
                </h2>
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  {tr('إلغاء', 'Cancel')}
                </Button>
              </div>

              {/* Meta fields */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {tr('تاريخ التقييم', 'Assessment Date')}
                    </label>
                    <Input
                      type="date"
                      value={formData.assessmentDate}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          assessmentDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {tr('اسم المقيّم', 'Assessor Name')}
                    </label>
                    <Input
                      value={formData.assessorName}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          assessorName: e.target.value,
                        }))
                      }
                      placeholder={tr('اسم المقيّم', 'Assessor name')}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {tr('الفترة', 'Period')}
                    </label>
                    <Select
                      value={formData.period}
                      onValueChange={(v) =>
                        setFormData((p) => ({ ...p, period: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={tr('اختر الفترة', 'Select period')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {periodOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {tr(p.labelAr, p.labelEn)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 6 IPSG Sections — collapsible */}
              {IPSG_GOALS.map((goal) => {
                const goalKey = `ipsg${goal.number}Findings`;
                const findings: IpsgFindingItem[] = formData[goalKey] || [];
                const compliantCount = findings.filter((f) => f.compliant).length;
                const total = findings.length;
                const pct = total > 0 ? Math.round((compliantCount / total) * 100) : 0;

                return (
                  <CollapsibleGoalSection
                    key={goal.id}
                    goal={goal}
                    findings={findings}
                    compliantCount={compliantCount}
                    total={total}
                    pct={pct}
                    tr={tr}
                    language={language}
                    onFindingChange={(idx, field, value) =>
                      handleFindingChange(goal.number, idx, field, value)
                    }
                  />
                );
              })}

              {/* Notes */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {tr('ملاحظات عامة', 'General Notes')}
                </label>
                <Textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder={tr(
                    'ملاحظات إضافية حول التقييم...',
                    'Additional notes about the assessment...'
                  )}
                />
              </div>

              {/* Save buttons */}
              <div className="flex items-center gap-3 justify-end">
                <Button
                  variant="outline"
                  disabled={saving || !formData.period}
                  onClick={() => saveAssessment('DRAFT')}
                >
                  {saving
                    ? tr('جاري الحفظ...', 'Saving...')
                    : tr('حفظ كمسودة', 'Save as Draft')}
                </Button>
                <Button
                  disabled={saving || !formData.period}
                  onClick={() => saveAssessment('SUBMITTED')}
                >
                  {saving
                    ? tr('جاري الإرسال...', 'Submitting...')
                    : tr('إرسال التقييم', 'Submit Assessment')}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==============================================================
            Tab 3: Action Items
            ============================================================== */}
        <TabsContent value="actions" className="space-y-4 mt-4">
          <ActionItemsTab
            items={items}
            tr={tr}
            language={language}
            onStatusChange={updateActionItemStatus}
          />
        </TabsContent>

        {/* ==============================================================
            Tab 4: Trend Analysis
            ============================================================== */}
        <TabsContent value="trends" className="space-y-4 mt-4">
          <TrendAnalysisTab
            items={items}
            summary={summary}
            tr={tr}
            language={language}
          />
        </TabsContent>
      </Tabs>

      {/* ================================================================
          View Assessment Dialog
          ================================================================ */}
      <Dialog
        open={!!viewAssessment}
        onOpenChange={(open) => {
          if (!open) setViewAssessment(null);
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tr('تفاصيل التقييم', 'Assessment Details')}
            </DialogTitle>
          </DialogHeader>
          {viewAssessment && (
            <ViewAssessmentContent
              assessment={viewAssessment}
              tr={tr}
              language={language}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================================================
// Collapsible Goal Section (for the form)
// ==========================================================================

function CollapsibleGoalSection({
  goal,
  findings,
  compliantCount,
  total,
  pct,
  tr,
  language,
  onFindingChange,
}: {
  goal: (typeof IPSG_GOALS)[number];
  findings: IpsgFindingItem[];
  compliantCount: number;
  total: number;
  pct: number;
  tr: (ar: string, en: string) => string;
  language: string;
  onFindingChange: (
    idx: number,
    field: 'compliant' | 'notes',
    value: boolean | string
  ) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`border rounded-2xl overflow-hidden ${GOAL_COLOR_MAP[goal.color] || 'border-border bg-card'}`}
    >
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Badge className={`${GOAL_BADGE_MAP[goal.color] || ''}`}>
            IPSG {goal.number}
          </Badge>
          <span className="text-sm font-semibold">
            {tr(goal.titleAr, goal.titleEn)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {compliantCount}/{total} ({pct}%)
          </span>
          <span className="text-lg">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {/* Progress bar */}
          <div className="w-full bg-white/50 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                pct >= 80
                  ? 'bg-emerald-500'
                  : pct >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Checklist */}
          {findings.map((f, idx) => {
            const goalItem = goal.checklistItems[idx];
            return (
              <div
                key={f.itemId || idx}
                className="bg-white/60 rounded-xl px-3 py-2 flex flex-col gap-1"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={f.compliant}
                    onChange={(e) =>
                      onFindingChange(idx, 'compliant', e.target.checked)
                    }
                    className="mt-1 h-4 w-4 rounded border-border accent-emerald-600"
                  />
                  <span className="text-sm flex-1">
                    {goalItem
                      ? language === 'ar'
                        ? goalItem.ar
                        : goalItem.en
                      : f.item}
                  </span>
                </div>
                <Input
                  className="text-xs h-7"
                  placeholder={tr('ملاحظات...', 'Notes...')}
                  value={f.notes}
                  onChange={(e) =>
                    onFindingChange(idx, 'notes', e.target.value)
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Action Items Tab
// ==========================================================================

function ActionItemsTab({
  items,
  tr,
  language,
  onStatusChange,
}: {
  items: any[];
  tr: (ar: string, en: string) => string;
  language: string;
  onStatusChange: (assessmentId: string, itemIdx: number, newStatus: string) => Promise<void>;
}) {
  const [filterGoal, setFilterGoal] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Collect all action items from latest assessment
  const latestWithActions = items.find(
    (a: any) => Array.isArray(a.actionItems) && a.actionItems.length > 0
  );
  const assessmentId = latestWithActions?.id || '';
  const allActions: (ActionItem & { originalIdx: number })[] = (
    latestWithActions?.actionItems || []
  ).map((a: ActionItem, idx: number) => ({ ...a, originalIdx: idx }));

  const filtered = allActions.filter((a) => {
    if (filterGoal && String(a.ipsg) !== filterGoal) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-bold text-base flex-1">
          {tr('بنود خطة العمل', 'Action Items')}
        </h2>
        <Select value={filterGoal || '__all__'} onValueChange={(v) => setFilterGoal(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={tr('كل الأهداف', 'All Goals')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('كل الأهداف', 'All Goals')}</SelectItem>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <SelectItem key={n} value={String(n)}>
                IPSG {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus || '__all__'} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={tr('كل الحالات', 'All Statuses')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tr('كل الحالات', 'All Statuses')}</SelectItem>
            {ACTION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'PENDING'
                  ? tr('معلق', 'Pending')
                  : s === 'IN_PROGRESS'
                    ? tr('قيد التنفيذ', 'In Progress')
                    : s === 'COMPLETED'
                      ? tr('مكتمل', 'Completed')
                      : tr('متأخر', 'Overdue')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-start font-semibold">
                  {tr('الهدف', 'IPSG#')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {tr('الملاحظة', 'Finding')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {tr('الإجراء المطلوب', 'Action Required')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {tr('المسؤول', 'Responsible')}
                </th>
                <th className="px-4 py-3 text-start font-semibold">
                  {tr('تاريخ الاستحقاق', 'Due Date')}
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  {tr('الحالة', 'Status')}
                </th>
                <th className="px-4 py-3 text-center font-semibold">
                  {tr('تحديث', 'Update')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr
                  key={idx}
                  className="border-b border-border last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3">
                    <Badge
                      className={`${GOAL_BADGE_MAP[IPSG_GOALS[a.ipsg - 1]?.color || 'blue'] || ''}`}
                    >
                      IPSG {a.ipsg}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate">
                    {a.finding}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate">
                    {a.action}
                  </td>
                  <td className="px-4 py-3">
                    {a.responsible || tr('غير محدد', 'Unassigned')}
                  </td>
                  <td className="px-4 py-3">
                    {a.dueDate || tr('غير محدد', 'Not set')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ActionStatusBadge status={a.status} tr={tr} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Select
                      value={a.status}
                      onValueChange={(val) =>
                        onStatusChange(assessmentId, a.originalIdx, val)
                      }
                    >
                      <SelectTrigger className="w-[120px] h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s === 'PENDING'
                              ? tr('معلق', 'Pending')
                              : s === 'IN_PROGRESS'
                                ? tr('قيد التنفيذ', 'In Progress')
                                : s === 'COMPLETED'
                                  ? tr('مكتمل', 'Completed')
                                  : tr('متأخر', 'Overdue')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {allActions.length === 0
                      ? tr(
                          'لا توجد بنود عمل. أنشئ تقييمًا للبدء.',
                          'No action items. Create an assessment to get started.'
                        )
                      : tr(
                          'لا توجد نتائج مطابقة للفلاتر.',
                          'No items match the current filters.'
                        )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary stats */}
      {allActions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ACTION_STATUSES.map((s) => {
            const count = allActions.filter((a) => a.status === s).length;
            const labels: Record<string, [string, string]> = {
              PENDING: ['معلق', 'Pending'],
              IN_PROGRESS: ['قيد التنفيذ', 'In Progress'],
              COMPLETED: ['مكتمل', 'Completed'],
              OVERDUE: ['متأخر', 'Overdue'],
            };
            const colors: Record<string, string> = {
              PENDING: 'border-amber-300 bg-amber-50',
              IN_PROGRESS: 'border-blue-300 bg-blue-50',
              COMPLETED: 'border-emerald-300 bg-emerald-50',
              OVERDUE: 'border-red-300 bg-red-50',
            };
            return (
              <div
                key={s}
                className={`border rounded-xl p-3 text-center ${colors[s]}`}
              >
                <div className="text-2xl font-extrabold">{count}</div>
                <div className="text-xs text-muted-foreground">
                  {tr(labels[s][0], labels[s][1])}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Trend Analysis Tab
// ==========================================================================

function TrendAnalysisTab({
  items,
  summary,
  tr,
  language,
}: {
  items: any[];
  summary: any;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  // Reverse items so earliest is first for trend display
  const sorted = [...items].reverse();

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-base">
        {tr('تحليل الاتجاهات', 'Trend Analysis')}
      </h2>

      {/* Period-over-period comparison table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">
            {tr('مقارنة الفترات', 'Period-over-Period Comparison')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-start font-semibold">
                  {tr('الفترة', 'Period')}
                </th>
                {IPSG_GOALS.map((g) => (
                  <th key={g.id} className="px-3 py-3 text-center font-semibold">
                    <div className="flex flex-col items-center">
                      <Badge
                        className={`text-[10px] mb-0.5 ${GOAL_BADGE_MAP[g.color] || ''}`}
                      >
                        IPSG {g.number}
                      </Badge>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold">
                  {tr('الكلي', 'Overall')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a: any, idx: number) => {
                const prev = idx > 0 ? sorted[idx - 1] : null;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-border last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-medium">{a.period}</td>
                    {[1, 2, 3, 4, 5, 6].map((n) => {
                      const score = a[`ipsg${n}Score`];
                      const prevScore = prev?.[`ipsg${n}Score`];
                      const diff =
                        score != null && prevScore != null
                          ? score - prevScore
                          : null;
                      return (
                        <td key={n} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span
                              className={`font-bold ${
                                score != null && score >= 80
                                  ? 'text-emerald-600'
                                  : score != null && score >= 60
                                    ? 'text-amber-600'
                                    : score != null
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                              }`}
                            >
                              {score != null ? `${score}%` : '—'}
                            </span>
                            {diff != null && (
                              <span
                                className={`text-[10px] ${
                                  diff > 0
                                    ? 'text-emerald-600'
                                    : diff < 0
                                      ? 'text-red-600'
                                      : 'text-muted-foreground'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff === 0 ? '0' : diff}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center">
                        <span
                          className={`font-extrabold ${
                            a.overallScore != null && a.overallScore >= 80
                              ? 'text-emerald-600'
                              : a.overallScore != null && a.overallScore >= 60
                                ? 'text-amber-600'
                                : a.overallScore != null
                                  ? 'text-red-600'
                                  : 'text-muted-foreground'
                          }`}
                        >
                          {a.overallScore != null
                            ? `${Math.round(a.overallScore)}%`
                            : '—'}
                        </span>
                        {idx > 0 && a.overallScore != null && prev?.overallScore != null && (
                          <span
                            className={`text-[10px] ${
                              a.overallScore > prev.overallScore
                                ? 'text-emerald-600'
                                : a.overallScore < prev.overallScore
                                  ? 'text-red-600'
                                  : 'text-muted-foreground'
                            }`}
                          >
                            {a.overallScore > prev.overallScore
                              ? `+${Math.round(a.overallScore - prev.overallScore)}`
                              : a.overallScore < prev.overallScore
                                ? Math.round(a.overallScore - prev.overallScore)
                                : '0'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {tr(
                      'لا توجد بيانات كافية لتحليل الاتجاهات.',
                      'Not enough data for trend analysis.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Best / Worst performing */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-card border border-emerald-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-emerald-700 mb-2">
            {tr('أفضل هدف أداءً', 'Best Performing Goal')}
          </h3>
          {summary.bestGoal ? (
            <div className="flex items-center gap-3">
              <Badge
                className={`${
                  GOAL_BADGE_MAP[
                    IPSG_GOALS[
                      parseInt(summary.bestGoal.id.replace('ipsg', '')) - 1
                    ]?.color || 'blue'
                  ] || ''
                }`}
              >
                {summary.bestGoal.id.toUpperCase()}
              </Badge>
              <span className="text-2xl font-extrabold text-emerald-600">
                {summary.bestGoal.score}%
              </span>
              <span className="text-sm text-muted-foreground">
                {tr(
                  IPSG_GOALS[parseInt(summary.bestGoal.id.replace('ipsg', '')) - 1]
                    ?.titleAr || '',
                  IPSG_GOALS[parseInt(summary.bestGoal.id.replace('ipsg', '')) - 1]
                    ?.titleEn || ''
                )}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {tr('لا توجد بيانات', 'No data available')}
            </span>
          )}
        </div>
        <div className="bg-card border border-red-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-red-700 mb-2">
            {tr('أضعف هدف أداءً', 'Worst Performing Goal')}
          </h3>
          {summary.worstGoal ? (
            <div className="flex items-center gap-3">
              <Badge
                className={`${
                  GOAL_BADGE_MAP[
                    IPSG_GOALS[
                      parseInt(summary.worstGoal.id.replace('ipsg', '')) - 1
                    ]?.color || 'blue'
                  ] || ''
                }`}
              >
                {summary.worstGoal.id.toUpperCase()}
              </Badge>
              <span className="text-2xl font-extrabold text-red-600">
                {summary.worstGoal.score}%
              </span>
              <span className="text-sm text-muted-foreground">
                {tr(
                  IPSG_GOALS[parseInt(summary.worstGoal.id.replace('ipsg', '')) - 1]
                    ?.titleAr || '',
                  IPSG_GOALS[parseInt(summary.worstGoal.id.replace('ipsg', '')) - 1]
                    ?.titleEn || ''
                )}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {tr('لا توجد بيانات', 'No data available')}
            </span>
          )}
        </div>
      </div>

      {/* Overall trend indicators */}
      {items.length >= 2 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3">
            {tr('ملخص الاتجاهات', 'Trend Summary')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {IPSG_GOALS.map((goal) => {
              const goalKey = `ipsg${goal.number}`;
              const trend = summary.goalTrends?.[goalKey] ?? null;
              const score = summary.goalAverages?.[goalKey] ?? null;
              return (
                <div
                  key={goal.id}
                  className={`border rounded-xl p-3 text-center ${GOAL_COLOR_MAP[goal.color] || ''}`}
                >
                  <div className="text-xs font-medium mb-1">
                    IPSG {goal.number}
                  </div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="font-bold">
                      {score != null ? `${score}%` : '—'}
                    </span>
                    <TrendArrow trend={trend} tr={tr} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {trend === 'up'
                      ? tr('تحسن', 'Improving')
                      : trend === 'down'
                        ? tr('تراجع', 'Declining')
                        : trend === 'stable'
                          ? tr('مستقر', 'Stable')
                          : tr('غير كافٍ', 'Insufficient')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// View Assessment Dialog Content
// ==========================================================================

function ViewAssessmentContent({
  assessment,
  tr,
  language,
}: {
  assessment: any;
  tr: (ar: string, en: string) => string;
  language: string;
}) {
  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">{tr('التاريخ', 'Date')}</span>
          <div className="font-medium">
            {new Date(assessment.assessmentDate).toLocaleDateString(
              language === 'ar' ? 'ar-SA' : 'en-US'
            )}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">{tr('الفترة', 'Period')}</span>
          <div className="font-medium">{assessment.period}</div>
        </div>
        <div>
          <span className="text-muted-foreground">{tr('المقيّم', 'Assessor')}</span>
          <div className="font-medium">
            {assessment.assessorName || tr('غير محدد', 'Unknown')}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">{tr('الحالة', 'Status')}</span>
          <div>
            <StatusBadge status={assessment.status} tr={tr} />
          </div>
        </div>
      </div>

      {/* Overall score */}
      <div className="flex items-center justify-center py-2">
        <ScoreCircle
          score={
            assessment.overallScore != null
              ? Math.round(assessment.overallScore)
              : null
          }
          size="lg"
          label={tr('الدرجة الكلية', 'Overall Score')}
        />
      </div>

      {/* Each IPSG section */}
      {IPSG_GOALS.map((goal) => {
        const score = assessment[`ipsg${goal.number}Score`];
        const findings: IpsgFindingItem[] =
          assessment[`ipsg${goal.number}Findings`] || [];

        return (
          <div
            key={goal.id}
            className={`border rounded-xl overflow-hidden ${GOAL_COLOR_MAP[goal.color] || 'border-border'}`}
          >
            <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={`${GOAL_BADGE_MAP[goal.color] || ''}`}>
                  IPSG {goal.number}
                </Badge>
                <span className="text-sm font-semibold">
                  {tr(goal.titleAr, goal.titleEn)}
                </span>
              </div>
              <span
                className={`text-sm font-bold ${
                  score != null && score >= 80
                    ? 'text-emerald-600'
                    : score != null && score >= 60
                      ? 'text-amber-600'
                      : score != null
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                }`}
              >
                {score != null ? `${score}%` : '—'}
              </span>
            </div>
            {findings.length > 0 && (
              <div className="p-3 space-y-1">
                {findings.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-sm bg-white/60 rounded-lg px-2 py-1.5"
                  >
                    <span
                      className={`mt-0.5 text-xs ${
                        f.compliant ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {f.compliant ? '\u2713' : '\u2717'}
                    </span>
                    <div className="flex-1">
                      <div>{f.item}</div>
                      {f.notes && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {f.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Action items */}
      {Array.isArray(assessment.actionItems) && assessment.actionItems.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <span className="text-sm font-semibold">
              {tr('خطة العمل', 'Action Items')}
            </span>
          </div>
          <div className="p-3 space-y-1">
            {assessment.actionItems.map((a: ActionItem, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-sm bg-white/60 rounded-lg px-2 py-1.5"
              >
                <Badge
                  className={`text-[10px] ${GOAL_BADGE_MAP[IPSG_GOALS[a.ipsg - 1]?.color || 'blue'] || ''}`}
                >
                  IPSG {a.ipsg}
                </Badge>
                <span className="flex-1 truncate">{a.finding}</span>
                <ActionStatusBadge status={a.status} tr={tr} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {assessment.notes && (
        <div className="border border-border rounded-xl p-3">
          <span className="text-xs font-medium text-muted-foreground">
            {tr('ملاحظات', 'Notes')}
          </span>
          <p className="text-sm mt-1">{assessment.notes}</p>
        </div>
      )}
    </div>
  );
}
