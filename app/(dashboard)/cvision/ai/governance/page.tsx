'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect , CVisionTable, CVisionTableHead, CVisionTh, CVisionTableBody, CVisionTr, CVisionTd , CVisionTabs, CVisionTabContent } from '@/components/cvision/ui';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ThumbsUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Eye,
  Pencil,
  Settings,
  Activity,
  Save,
  RotateCcw,
  Loader2,
  ListChecks,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import AdvancedReviewQueueTab from './_components/AdvancedReviewQueueTab';
import ThresholdsConfigTab from './_components/ThresholdsConfigTab';
import ModelAccuracyTab from './_components/ModelAccuracyTab';
import { Checkbox } from '@/components/ui/checkbox';

// ─── Types ─────────────────────────────────────────────────────────────────

type AIDecisionType =
  | 'CV_PARSING'
  | 'JOB_MATCHING'
  | 'SKILL_ASSESSMENT'
  | 'SALARY_RECOMMENDATION'
  | 'INTERVIEW_SCORING'
  | 'PERFORMANCE_PREDICTION'
  | 'TRAINING_RECOMMENDATION';

type DecisionStatus = 'AUTO_APPROVED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'OVERRIDDEN';

interface SummaryData {
  total: number;
  autoApproved: number;
  pendingReview: number;
  humanApproved: number;
  humanRejected: number;
  overridden: number;
  oldestPending: string | null;
}

interface ReviewQueueItem {
  decisionLogId: string;
  decisionType: AIDecisionType;
  confidence: number;
  priority: 1 | 2 | 3 | 4 | 5;
  subjectId: string;
  subjectType: 'CANDIDATE' | 'EMPLOYEE' | 'JOB' | 'DEPARTMENT';
  summary: string;
  summaryAr: string;
  context: string;
  contextAr: string;
  createdAt: string;
  assignedTo?: string;
}

interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  urgentCount: number;
}

interface GovernanceStatEntry {
  decisionType: AIDecisionType;
  totalDecisions: number;
  autoApproved: number;
  pendingReview: number;
  manuallyApproved: number;
  rejected: number;
  overridden: number;
  averageConfidence: number;
  autoApproveRate: number;
  humanApprovalRate: number;
}

interface GovernanceThreshold {
  autoApproveThreshold: number;
  autoRejectThreshold: number;
  autoApproveEnabled: boolean;
  requiresManagerReview: boolean;
}

interface GovernanceConfig {
  thresholds: Record<AIDecisionType, GovernanceThreshold>;
  globalAutoApproveEnabled: boolean;
  maxPendingReviews: number;
  retentionDays: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const DECISION_TYPE_LABELS: Record<AIDecisionType, string> = {
  CV_PARSING: 'CV Parsing',
  JOB_MATCHING: 'Job Matching',
  SKILL_ASSESSMENT: 'Skill Assessment',
  SALARY_RECOMMENDATION: 'Salary Recommendation',
  INTERVIEW_SCORING: 'Interview Scoring',
  PERFORMANCE_PREDICTION: 'Performance Prediction',
  TRAINING_RECOMMENDATION: 'Training Recommendation',
};

const DECISION_TYPE_COLORS: Record<AIDecisionType, string> = {
  CV_PARSING: 'bg-blue-100 text-blue-800',
  JOB_MATCHING: 'bg-purple-100 text-purple-800',
  SKILL_ASSESSMENT: 'bg-cyan-100 text-cyan-800',
  SALARY_RECOMMENDATION: 'bg-amber-100 text-amber-800',
  INTERVIEW_SCORING: 'bg-indigo-100 text-indigo-800',
  PERFORMANCE_PREDICTION: 'bg-pink-100 text-pink-800',
  TRAINING_RECOMMENDATION: 'bg-teal-100 text-teal-800',
};

const STATUS_STYLES: Record<DecisionStatus, { label: string; color: string }> = {
  AUTO_APPROVED: { label: 'Auto Approved', color: 'bg-green-100 text-green-800' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Approved', color: 'bg-blue-100 text-blue-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  OVERRIDDEN: { label: 'Overridden', color: 'bg-orange-100 text-orange-800' },
};

const ALL_DECISION_TYPES: AIDecisionType[] = [
  'CV_PARSING',
  'JOB_MATCHING',
  'SKILL_ASSESSMENT',
  'SALARY_RECOMMENDATION',
  'INTERVIEW_SCORING',
  'PERFORMANCE_PREDICTION',
  'TRAINING_RECOMMENDATION',
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 80) return 'text-green-600';
  if (c >= 50) return 'text-blue-600';
  if (c >= 30) return 'text-yellow-600';
  return 'text-red-600';
}

function confidenceBg(c: number): string {
  if (c >= 80) return 'bg-green-100 text-green-800';
  if (c >= 50) return 'bg-blue-100 text-blue-800';
  if (c >= 30) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

function priorityLabel(p: number): string {
  if (p <= 1) return 'URGENT';
  if (p <= 2) return 'HIGH';
  if (p <= 3) return 'NORMAL';
  return 'LOW';
}

function priorityBorder(p: number): string {
  if (p <= 1) return 'border-l-red-500';
  if (p <= 2) return 'border-l-orange-500';
  if (p <= 3) return 'border-l-yellow-500';
  return 'border-l-green-500';
}

function priorityBadge(p: number): string {
  if (p <= 1) return 'bg-red-100 text-red-800';
  if (p <= 2) return 'bg-orange-100 text-orange-800';
  if (p <= 3) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

// ─── Confidence Gauge ──────────────────────────────────────────────────────

function ConfidenceGauge({ confidence }: { confidence: number }) {
  const angle = (confidence / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  // Semi-circle gauge: center at (50,50), radius 40, arcs from 180 to 0 degrees
  const endX = 50 - 40 * Math.cos(rad);
  const endY = 50 - 40 * Math.sin(rad);
  const largeArc = angle > 90 ? 1 : 0;

  let strokeColor = '#ef4444'; // red
  if (confidence >= 80) strokeColor = '#22c55e'; // green
  else if (confidence >= 50) strokeColor = '#3b82f6'; // blue
  else if (confidence >= 30) strokeColor = '#eab308'; // yellow

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="80" height="48" viewBox="0 50 100 50" className="overflow-visible">
        {/* Background arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        {confidence > 0 && (
          <path
            d={`M 10 50 A 40 40 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className={cn('text-sm font-bold -mt-1', confidenceColor(confidence))}>
        {confidence}%
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function AIGovernancePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { toast } = useToast();

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState('review');

  // ── Summary ──
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ── Review Queue ──
  const [queueData, setQueueData] = useState<ReviewQueueResponse | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queuePage, setQueuePage] = useState(1);
  const [queuePriority, setQueuePriority] = useState('ALL');
  const [queueType, setQueueType] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  // ── History ──
  const [historyItems, setHistoryItems] = useState<ReviewQueueItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('ALL');
  const [historyType, setHistoryType] = useState('ALL');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // ── Stats ──
  const [stats, setStats] = useState<GovernanceStatEntry[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  // ── Config ──
  const [config, setConfig] = useState<GovernanceConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configDraft, setConfigDraft] = useState<GovernanceConfig | null>(null);
  const [showThresholdOverrides, setShowThresholdOverrides] = useState(false);

  // ── Ref for scrolling to review queue ──
  const reviewQueueRef = useRef<HTMLDivElement>(null);

  // ─── API helper ──────────────────────────────────────────────────────────

  const apiFetch = useCallback(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST' || options?.method === 'PATCH' || options?.method === 'PUT') {
      const body = options?.body ? JSON.parse(options.body as string) : undefined;
      const json = await cvisionMutate<any>(url, (options.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE'), body);
      if (!json.success) throw new Error(json.error || 'Request failed');
      return json.data;
    }
    // For GET, extract params from the URL
    const [baseUrl, qs] = url.split('?');
    const params: Record<string, string> = {};
    if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
    const json = await cvisionFetch<any>(baseUrl, { params });
    if (!json.success) throw new Error(json.error || 'Request failed');
    return json.data;
  }, []);

  // ─── Load summary ───────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await apiFetch('/api/cvision/ai/governance?action=summary');
      setSummary(data);
    } catch {
      // Silent — summary is non-blocking
    } finally {
      setSummaryLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // ─── Load review queue ──────────────────────────────────────────────────

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'review-queue',
        status: 'PENDING_REVIEW',
        page: String(queuePage),
        limit: '20',
      });
      if (queuePriority === 'URGENT') params.set('priority', 'URGENT');
      if (queuePriority === 'NORMAL') params.set('priority', 'NORMAL');
      if (queuePriority === 'LOW') params.set('priority', 'LOW');
      const data = await apiFetch(`/api/cvision/ai/governance?${params}`);
      setQueueData(data);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setQueueLoading(false);
    }
  }, [apiFetch, queuePage, queuePriority, toast]);

  useEffect(() => {
    if (activeTab === 'review') loadQueue();
  }, [activeTab, loadQueue]);

  // ─── Load history ───────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'review-queue',
        page: String(historyPage),
        limit: '20',
      });
      if (historyStatus !== 'ALL') params.set('status', historyStatus);
      else params.set('status', 'APPROVED'); // Default to showing approved history

      const data = await apiFetch(`/api/cvision/ai/governance?${params}`);
      setHistoryItems(data.items || []);
      setHistoryTotal(data.total || 0);
      setHistoryTotalPages(data.totalPages || 1);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  }, [apiFetch, historyPage, historyStatus, toast]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  // ─── Load stats ─────────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams({ action: 'stats' });
      if (historyFrom) params.set('from', historyFrom);
      if (historyTo) params.set('to', historyTo);
      const data = await apiFetch(`/api/cvision/ai/governance?${params}`);
      const statEntries: GovernanceStatEntry[] = data.stats || [];
      setStats(statEntries);

      // Build chart data from stats
      const cd = statEntries.map((s) => ({
        name: DECISION_TYPE_LABELS[s.decisionType]?.replace(' ', '\n') || s.decisionType,
        shortName: DECISION_TYPE_LABELS[s.decisionType]?.split(' ')[0] || s.decisionType,
        autoApproved: s.autoApproved,
        humanApproved: s.manuallyApproved,
        rejected: s.rejected,
        overridden: s.overridden,
        pending: s.pendingReview,
      }));
      setChartData(cd);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setStatsLoading(false);
    }
  }, [apiFetch, historyFrom, historyTo, toast]);

  // ─── Load config ────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const data = await apiFetch('/api/cvision/ai/governance?action=config');
      setConfig(data);
      setConfigDraft(JSON.parse(JSON.stringify(data)));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setConfigLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    if (activeTab === 'performance') {
      loadStats();
      loadConfig();
    }
  }, [activeTab, loadStats, loadConfig]);

  // ─── Review single decision ─────────────────────────────────────────────

  const reviewDecision = useCallback(
    async (decisionId: string, reviewAction: 'approve' | 'reject' | 'override') => {
      setReviewingId(decisionId);
      try {
        const reviewBody: Record<string, unknown> = {
          action: 'review',
          decisionId,
          reviewAction,
          reviewNotes: reviewNotes[decisionId] || undefined,
        };
        await apiFetch('/api/cvision/ai/governance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviewBody),
        });
        const actionLabel =
          reviewAction === 'approve' ? 'approved' : reviewAction === 'reject' ? 'rejected' : 'overridden';
        toast({ title: 'Success', description: `Decision ${actionLabel}.` });
        // Refresh data
        loadQueue();
        loadSummary();
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setReviewingId(null);
      }
    },
    [apiFetch, reviewNotes, toast, loadQueue, loadSummary]
  );

  // ─── Bulk review ────────────────────────────────────────────────────────

  const bulkReview = useCallback(
    async (reviewAction: 'approve' | 'reject') => {
      if (selectedIds.size === 0) return;
      setReviewingId('bulk');
      try {
        const bulkBody: Record<string, unknown> = {
          action: 'bulk-review',
          decisionIds: [...selectedIds],
          reviewAction,
        };
        const data = await apiFetch('/api/cvision/ai/governance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bulkBody),
        });
        toast({
          title: 'Bulk Review Complete',
          description: `${data.updatedCount} decisions ${reviewAction === 'approve' ? 'approved' : 'rejected'}.`,
        });
        loadQueue();
        loadSummary();
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setReviewingId(null);
      }
    },
    [apiFetch, selectedIds, toast, loadQueue, loadSummary]
  );

  // ─── Save config ────────────────────────────────────────────────────────

  const saveConfig = useCallback(async () => {
    if (!configDraft) return;
    setConfigSaving(true);
    try {
      await apiFetch('/api/cvision/ai/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-config',
          thresholds: configDraft.thresholds,
          globalAutoApproveEnabled: configDraft.globalAutoApproveEnabled,
          maxPendingReviews: configDraft.maxPendingReviews,
          retentionDays: configDraft.retentionDays,
        }),
      });
      toast({ title: 'Success', description: 'Governance configuration saved.' });
      setConfig(JSON.parse(JSON.stringify(configDraft)));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setConfigSaving(false);
    }
  }, [apiFetch, configDraft, toast]);

  // ─── Toggle select ──────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!queueData) return;
    if (selectedIds.size === queueData.items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queueData.items.map((i) => i.decisionLogId)));
    }
  };

  // ─── Filter queue items by type ─────────────────────────────────────────

  const filteredQueueItems = queueData?.items?.filter((item) => {
    if (queueType !== 'ALL' && item.decisionType !== queueType) return false;
    return true;
  }) || [];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck style={{ height: 24, width: 24 }} />
            AI Governance
          </h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            {tr('مراقبة ومراجعة وإدارة القرارات المدعومة بالذكاء الاصطناعي', 'Monitor, review, and manage AI-powered decisions')}
          </p>
        </div>
        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => { loadSummary(); if (activeTab === 'review') loadQueue(); }}>
          <RefreshCw className={cn('h-4 w-4 mr-2', summaryLoading && 'animate-spin')} />
          Refresh
        </CVisionButton>
      </div>

      {/* ── Urgent Banner ── */}
      {summary && summary.pendingReview > 0 && (
        <div
          className={cn(
            'flex items-center justify-between p-4 rounded-lg border',
            (queueData?.urgentCount || 0) > 0
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          )}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle style={{ height: 20, width: 20 }} />
            <div>
              <p style={{ fontWeight: 500 }}>
                {summary.pendingReview} decision{summary.pendingReview !== 1 ? 's' : ''} {tr('بحاجة للمراجعة', 'need review')}
              </p>
              {(queueData?.urgentCount || 0) > 0 && (
                <p style={{ fontSize: 13, opacity: 0.8 }}>
                  {queueData!.urgentCount} {tr('عاجل (ثقة منخفضة)', 'urgent (low confidence)')}
                </p>
              )}
            </div>
          </div>
          <CVisionButton C={C} isDark={isDark}
            variant="outline"
            size="sm"
            className="border-current text-current hover:bg-red-100"
            onClick={() => {
              setActiveTab('review');
              setTimeout(() => reviewQueueRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }}
          >
            Review Now
            <ArrowRight style={{ height: 16, width: 16, marginLeft: 4 }} />
          </CVisionButton>
        </div>
      )}

      {/* ── KPI Cards ── */}
      {summaryLoading && !summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 96, borderRadius: 16 }}  />
          ))}
        </div>
      ) : summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700 }}>{summary.total}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('إجمالي القرارات', 'Total Decisions')}</p>
                </div>
                <Activity style={{ height: 20, width: 20, color: C.textMuted }} />
              </div>
              <p style={{ color: C.textMuted, marginTop: 4 }}>{tr('كل الوقت', 'all time')}</p>
            </CVisionCardBody>
          </CVisionCard>

          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{summary.autoApproved}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('موافقة تلقائية', 'Auto Approved')}</p>
                </div>
                <CheckCircle style={{ height: 20, width: 20, color: C.green }} />
              </div>
              <p style={{ color: C.textMuted, marginTop: 4 }}>{pct(summary.autoApproved, summary.total)} of total</p>
            </CVisionCardBody>
          </CVisionCard>

          <CVisionCard C={C} className={summary.pendingReview > 0 ? 'ring-2 ring-amber-300' : ''}>
            <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p className={cn('text-2xl font-bold', summary.pendingReview > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
                    {summary.pendingReview}
                  </p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('قيد المراجعة', 'Pending Review')}</p>
                </div>
                <Clock className={cn('h-5 w-5 text-amber-500', summary.pendingReview > 0 && 'animate-pulse')} />
              </div>
              {summary.oldestPending && (
                <p style={{ color: C.textMuted, marginTop: 4 }}>
                  Oldest: {relativeTime(summary.oldestPending)}
                </p>
              )}
            </CVisionCardBody>
          </CVisionCard>

          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, color: C.blue }}>{summary.humanApproved}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('موافقة بشرية', 'Human Approved')}</p>
                </div>
                <ThumbsUp style={{ height: 20, width: 20, color: C.blue }} />
              </div>
              <p style={{ color: C.textMuted, marginTop: 4 }}>{pct(summary.humanApproved, summary.total)} of total</p>
            </CVisionCardBody>
          </CVisionCard>

          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{summary.humanRejected}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('رفض بشري', 'Human Rejected')}</p>
                </div>
                <XCircle style={{ height: 20, width: 20, color: C.red }} />
              </div>
              <p style={{ color: C.textMuted, marginTop: 4 }}>{pct(summary.humanRejected, summary.total)} of total</p>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      ) : null}

      {/* ── Tabs ── */}
      <CVisionTabs
        C={C}
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'review', label: tr('قائمة المراجعة', 'Review Queue'), icon: <Eye style={{ height: 16, width: 16 }} />, badge: summary?.pendingReview || 0 },
          { id: 'history', label: tr('سجل القرارات', 'Decision History'), icon: <Clock style={{ height: 16, width: 16 }} /> },
          { id: 'performance', label: tr('الأداء والإعدادات', 'Performance & Config'), icon: <Settings style={{ height: 16, width: 16 }} /> },
          { id: 'adv-review', label: tr('قائمة المراجعة+', 'Review Queue+'), icon: <ListChecks style={{ height: 16, width: 16 }} /> },
          { id: 'thresholds', label: tr('الحدود', 'Thresholds'), icon: <SlidersHorizontal style={{ height: 16, width: 16 }} /> },
          { id: 'accuracy', label: tr('دقة النموذج', 'Model Accuracy'), icon: <BarChart3 style={{ height: 16, width: 16 }} /> },
        ]}
      >
        {/* ═══════════════════ Tab 1: Review Queue ═══════════════════ */}
        <CVisionTabContent tabId="review">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} ref={reviewQueueRef}>
          {/* Filters */}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الأولوية:', 'Priority:')}</CVisionLabel>
                  {['ALL', 'URGENT', 'NORMAL', 'LOW'].map((p) => (
                    <CVisionButton C={C} isDark={isDark}
                      key={p}
                      variant={queuePriority === p ? 'default' : 'outline'}
                      size="sm"
                      style={{ height: 28, fontSize: 12 }}
                      onClick={() => { setQueuePriority(p); setQueuePage(1); }}
                    >
                      {p === 'ALL' ? tr('الكل', 'All') : p === 'URGENT' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ height: 6, width: 6, borderRadius: '50%', background: C.redDim }} />{tr('عاجل', 'Urgent')}</span>
                      ) : p === 'NORMAL' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ height: 6, width: 6, borderRadius: '50%', background: C.orangeDim }} />{tr('عادي', 'Normal')}</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ height: 6, width: 6, borderRadius: '50%', background: C.greenDim }} />{tr('منخفض', 'Low')}</span>
                      )}
                    </CVisionButton>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('النوع:', 'Type:')}</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={queueType}
                options={[
                  { value: 'ALL', label: tr('كل الأنواع', 'All Types') },
                  ...ALL_DECISION_TYPES.map((t) => (
                        ({ value: t, label: DECISION_TYPE_LABELS[t] })
                      )),
                ]}
                style={{ height: 28, fontSize: 12 }}
              />
                </div>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 28 }} onClick={loadQueue}>
                  <RefreshCw className={cn('h-3.5 w-3.5', queueLoading && 'animate-spin')} />
                </CVisionButton>
              </div>
            </CVisionCardBody>
          </CVisionCard>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: C.bgSubtle, borderRadius: 12 }}>
              <Checkbox
                checked={queueData ? selectedIds.size === queueData.items.length : false}
                onCheckedChange={toggleSelectAll}
              />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{selectedIds.size} {tr("محدد", "selected")}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionButton C={C} isDark={isDark}
                  size="sm"
                  variant="outline"
                  style={{ color: C.green }}
                  disabled={reviewingId === 'bulk'}
                  onClick={() => bulkReview('approve')}
                >
                  <CheckCircle style={{ height: 14, width: 14, marginRight: 4 }} />
                  Approve Selected
                </CVisionButton>
                <CVisionButton C={C} isDark={isDark}
                  size="sm"
                  variant="outline"
                  style={{ color: C.red }}
                  disabled={reviewingId === 'bulk'}
                  onClick={() => bulkReview('reject')}
                >
                  <XCircle style={{ height: 14, width: 14, marginRight: 4 }} />
                  Reject Selected
                </CVisionButton>
              </div>
            </div>
          )}

          {/* Queue Items */}
          {queueLoading && !queueData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 144, borderRadius: 16 }}  />
              ))}
            </div>
          ) : filteredQueueItems.length === 0 ? (
            <CVisionCard C={C}>
              <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
                <CheckCircle style={{ height: 48, width: 48, color: C.green, marginBottom: 12 }} />
                <p style={{ fontSize: 16, fontWeight: 500, color: C.green }}>{tr('كل شيء محدث!', 'All caught up!')}</p>
                <p style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{tr('لا توجد مراجعات معلقة.', 'No pending reviews.')}</p>
              </CVisionCardBody>
            </CVisionCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredQueueItems.map((item) => {
                const isSelected = selectedIds.has(item.decisionLogId);
                const isReviewing = reviewingId === item.decisionLogId;
                const isExpanded = expandedReviewId === item.decisionLogId;

                return (
                  <CVisionCard C={C}
                    key={item.decisionLogId}
                    className={cn(
                      'border-l-4 transition-all',
                      priorityBorder(item.priority),
                      isSelected && 'ring-2 ring-primary/30',
                      isReviewing && 'opacity-60'
                    )}
                  >
                    <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(item.decisionLogId)}
                          style={{ marginTop: 4 }}
                        />

                        {/* Main Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Row 1: Type + Entity */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <CVisionBadge C={C} className={DECISION_TYPE_COLORS[item.decisionType]} variant="secondary">
                              {DECISION_TYPE_LABELS[item.decisionType]}
                            </CVisionBadge>
                            <CVisionBadge C={C} className={priorityBadge(item.priority)} variant="secondary">
                              {item.priority <= 1 && (
                                <span style={{ height: 6, width: 6, borderRadius: '50%', background: C.redDim, marginRight: 4 }} />
                              )}
                              {priorityLabel(item.priority)}
                            </CVisionBadge>
                            <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>
                              {item.subjectType}
                            </CVisionBadge>
                          </div>

                          {/* Row 2: Summary */}
                          <p style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>{item.summary}</p>

                          {/* Row 3: Context */}
                          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {item.context}
                          </p>

                          {/* Row 4: Metadata */}
                          <p style={{ color: C.textMuted, marginTop: 8 }}>
                            {relativeTime(item.createdAt)}
                            {' \u00B7 '}
                            ID: {item.decisionLogId}
                          </p>

                          {/* Expanded: Review Notes */}
                          {isExpanded && (
                            <div style={{ marginTop: 12 }}>
                              <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('ملاحظات المراجعة (اختياري)', 'Review Notes (optional)')}</CVisionLabel>
                              <CVisionInput C={C}
                                style={{ marginTop: 4 }}
                                placeholder={tr("أضف ملاحظات المراجعة...", "Add review notes...")}
                                value={reviewNotes[item.decisionLogId] || ''}
                                onChange={(e) =>
                                  setReviewNotes((prev) => ({
                                    ...prev,
                                    [item.decisionLogId]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                            <CVisionButton C={C} isDark={isDark}
                              size="sm"
                              variant="outline"
                              style={{ color: C.green, height: 28, fontSize: 12 }}
                              disabled={isReviewing}
                              onClick={() => reviewDecision(item.decisionLogId, 'approve')}
                            >
                              {isReviewing ? <Loader2 style={{ height: 12, width: 12, animation: 'spin 1s linear infinite', marginRight: 4 }} /> : <CheckCircle style={{ height: 12, width: 12, marginRight: 4 }} />}
                              {tr("موافقة", "Approve")}
                            </CVisionButton>
                            <CVisionButton C={C} isDark={isDark}
                              size="sm"
                              variant="outline"
                              style={{ color: C.red, height: 28, fontSize: 12 }}
                              disabled={isReviewing}
                              onClick={() => reviewDecision(item.decisionLogId, 'reject')}
                            >
                              <XCircle style={{ height: 12, width: 12, marginRight: 4 }} />
                              {tr('رفض', 'Reject')}
                            </CVisionButton>
                            <CVisionButton C={C} isDark={isDark}
                              size="sm"
                              variant="outline"
                              style={{ color: C.blue, height: 28, fontSize: 12 }}
                              disabled={isReviewing}
                              onClick={() => reviewDecision(item.decisionLogId, 'override')}
                            >
                              <Pencil style={{ height: 12, width: 12, marginRight: 4 }} />
                              {tr('تجاوز', 'Override')}
                            </CVisionButton>
                            <CVisionButton C={C} isDark={isDark}
                              size="sm"
                              variant="ghost"
                              style={{ height: 28, fontSize: 12 }}
                              onClick={() =>
                                setExpandedReviewId(isExpanded ? null : item.decisionLogId)
                              }
                            >
                              {isExpanded ? (
                                <ChevronUp style={{ height: 14, width: 14 }} />
                              ) : (
                                <ChevronDown style={{ height: 14, width: 14 }} />
                              )}
                              {tr('ملاحظات', 'Notes')}
                            </CVisionButton>
                          </div>
                        </div>

                        {/* Confidence Gauge */}
                        <div className="shrink-0">
                          <ConfidenceGauge confidence={item.confidence} />
                        </div>
                      </div>
                    </CVisionCardBody>
                  </CVisionCard>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {queueData && queueData.totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 8 }}>
              <CVisionButton C={C} isDark={isDark}
                variant="outline"
                size="sm"
                disabled={queuePage <= 1}
                onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
              >
                Previous
              </CVisionButton>
              <span style={{ fontSize: 13, color: C.textMuted }}>
                Page {queueData.page} of {queueData.totalPages}
              </span>
              <CVisionButton C={C} isDark={isDark}
                variant="outline"
                size="sm"
                disabled={queuePage >= queueData.totalPages}
                onClick={() => setQueuePage((p) => p + 1)}
              >
                Next
              </CVisionButton>
            </div>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══════════════════ Tab 2: Decision History ═══════════════════ */}
        <CVisionTabContent tabId="history">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters */}
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr("الحالة", "Status")}</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={historyStatus}
                options={[
                  { value: 'ALL', label: tr('كل الحالات', 'All Statuses') },
                  { value: 'AUTO_APPROVED', label: tr('موافقة تلقائية', 'Auto Approved') },
                  { value: 'APPROVED', label: tr('موافقة بشرية', 'Human Approved') },
                  { value: 'REJECTED', label: tr('مرفوض', 'Rejected') },
                  { value: 'OVERRIDDEN', label: tr('تم التجاوز', 'Overridden') },
                  { value: 'PENDING_REVIEW', label: tr('قيد الانتظار', 'Pending') },
                ]}
                style={{ height: 32, fontSize: 12 }}
              />
                </div>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr('النوع', 'Type')}</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={historyType}
                options={[
                  { value: 'ALL', label: tr('كل الأنواع', 'All Types') },
                  ...ALL_DECISION_TYPES.map((t) => (
                        ({ value: t, label: DECISION_TYPE_LABELS[t] })
                      )),
                ]}
                style={{ height: 32, fontSize: 12 }}
              />
                </div>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr('من', 'From')}</CVisionLabel>
                  <CVisionInput C={C} type="date" style={{ height: 32, fontSize: 12 }} value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} />
                </div>
                <div>
                  <CVisionLabel C={C} style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>{tr('إلى', 'To')}</CVisionLabel>
                  <CVisionInput C={C} type="date" style={{ height: 32, fontSize: 12 }} value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} />
                </div>
                <CVisionButton C={C} isDark={isDark} size="sm" style={{ height: 32 }} onClick={() => { loadHistory(); loadStats(); }}>
                  Apply Filters
                </CVisionButton>
              </div>
            </CVisionCardBody>
          </CVisionCard>

          {/* Stats Chart */}
          {statsLoading ? (
            <CVisionSkeletonCard C={C} height={200} style={{ height: 256, borderRadius: 16 }}  />
          ) : chartData.length > 0 ? (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('توزيع القرارات حسب النوع', 'Decision Distribution by Type')}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تفصيل القرارات حسب النوع والحالة', 'Breakdown of decisions by type and status')}</div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <ChartContainer
                  config={{
                    autoApproved: { label: 'Auto Approved', color: '#22c55e' },
                    humanApproved: { label: 'Human Approved', color: '#3b82f6' },
                    rejected: { label: 'Rejected', color: '#ef4444' },
                    overridden: { label: 'Overridden', color: '#f97316' },
                    pending: { label: 'Pending', color: '#eab308' },
                  }}
                  className="h-[280px]"
                >
                  <BarChart data={chartData} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="autoApproved" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} name="Auto Approved" />
                    <Bar dataKey="humanApproved" stackId="a" fill="#3b82f6" name="Human Approved" />
                    <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
                    <Bar dataKey="overridden" stackId="a" fill="#f97316" name="Overridden" />
                    <Bar dataKey="pending" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} name="Pending" />
                  </BarChart>
                </ChartContainer>
              </CVisionCardBody>
            </CVisionCard>
          ) : null}

          {/* History Table */}
          {historyLoading ? (
            <CVisionSkeletonCard C={C} height={200} style={{ height: 192, borderRadius: 16 }}  />
          ) : (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                  {tr("السجل", "History")}
                  <CVisionBadge C={C} variant="secondary" style={{ marginLeft: 8 }}>{historyTotal} total</CVisionBadge>
                </div>
              </CVisionCardHeader>
              <CVisionCardBody>
                {historyItems.length === 0 ? (
                  <p style={{ textAlign: 'center', color: C.textMuted, paddingTop: 32, paddingBottom: 32 }}>{tr('لم يتم العثور على قرارات للتصفيات المحددة.', 'No decisions found for the selected filters.')}</p>
                ) : (
                  <>
                    <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <CVisionTable C={C}>
                        <CVisionTableHead C={C}>
                            <CVisionTh C={C}>{tr('التاريخ', 'Date')}</CVisionTh>
                            <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                            <CVisionTh C={C}>{tr('الموضوع', 'Subject')}</CVisionTh>
                            <CVisionTh C={C} align="center">{tr('الثقة', 'Confidence')}</CVisionTh>
                            <CVisionTh C={C}>{tr('التفاصيل', 'Details')}</CVisionTh>
                        </CVisionTableHead>
                        <CVisionTableBody>
                          {historyItems
                            .filter((item) => historyType === 'ALL' || item.decisionType === historyType)
                            .map((item) => (
                              <CVisionTr C={C} key={item.decisionLogId}
                                style={{ cursor: 'pointer' }}
                                onClick={() =>
                                  setExpandedHistoryId(
                                    expandedHistoryId === item.decisionLogId ? null : item.decisionLogId
                                  )
                                }
                              >
                                <CVisionTd style={{ fontSize: 12 }}>{relativeTime(item.createdAt)}</CVisionTd>
                                <CVisionTd>
                                  <CVisionBadge C={C} className={DECISION_TYPE_COLORS[item.decisionType]} variant="secondary">
                                    {DECISION_TYPE_LABELS[item.decisionType]}
                                  </CVisionBadge>
                                </CVisionTd>
                                <CVisionTd style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.summary}
                                </CVisionTd>
                                <CVisionTd align="center">
                                  <CVisionBadge C={C} className={confidenceBg(item.confidence)} variant="secondary">
                                    {item.confidence}%
                                  </CVisionBadge>
                                </CVisionTd>
                                <CVisionTd>
                                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 24, fontSize: 12 }}>
                                    {expandedHistoryId === item.decisionLogId ? (
                                      <ChevronUp style={{ height: 12, width: 12 }} />
                                    ) : (
                                      <ChevronDown style={{ height: 12, width: 12 }} />
                                    )}
                                  </CVisionButton>
                                </CVisionTd>
                              </CVisionTr>
                            ))}
                        </CVisionTableBody>
                      </CVisionTable>
                    </div>

                    {/* Pagination */}
                    {historyTotalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 16 }}>
                        <CVisionButton C={C} isDark={isDark}
                          variant="outline"
                          size="sm"
                          disabled={historyPage <= 1}
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </CVisionButton>
                        <span style={{ fontSize: 13, color: C.textMuted }}>
                          Page {historyPage} of {historyTotalPages}
                        </span>
                        <CVisionButton C={C} isDark={isDark}
                          variant="outline"
                          size="sm"
                          disabled={historyPage >= historyTotalPages}
                          onClick={() => setHistoryPage((p) => p + 1)}
                        >
                          Next
                        </CVisionButton>
                      </div>
                    )}
                  </>
                )}
              </CVisionCardBody>
            </CVisionCard>
          )}
        </div>
        </CVisionTabContent>

        {/* ═══════════════════ Tab 3: Performance & Config ═══════════════════ */}
        <CVisionTabContent tabId="performance">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Performance Stats */}
          {statsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                {[1, 2, 3].map((i) => (
                  <CVisionSkeletonCard C={C} height={200} key={i} style={{ height: 112, borderRadius: 16 }}  />
                ))}
              </div>
              <CVisionSkeletonCard C={C} height={200} style={{ height: 256, borderRadius: 16 }}  />
            </div>
          ) : stats.length > 0 ? (
            <>
              {/* Summary Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 24 }}>
                    <p style={{ fontSize: 13, color: C.textMuted }}>{tr('متوسط الثقة', 'Avg Confidence')}</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      confidenceColor(
                        Math.round(stats.reduce((s, e) => s + e.averageConfidence * e.totalDecisions, 0) /
                          Math.max(1, stats.reduce((s, e) => s + e.totalDecisions, 0)))
                      )
                    )}>
                      {Math.round(
                        stats.reduce((s, e) => s + e.averageConfidence * e.totalDecisions, 0) /
                          Math.max(1, stats.reduce((s, e) => s + e.totalDecisions, 0))
                      )}%
                    </p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('المتوسط المرجح عبر جميع الأنواع', 'weighted average across all types')}</p>
                  </CVisionCardBody>
                </CVisionCard>

                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 24 }}>
                    <p style={{ fontSize: 13, color: C.textMuted }}>{tr('معدل المراجعة', 'Review Rate')}</p>
                    <p style={{ fontSize: 30, fontWeight: 700, marginTop: 4 }}>
                      {(() => {
                        const total = stats.reduce((s, e) => s + e.totalDecisions, 0);
                        const pending = stats.reduce((s, e) => s + e.pendingReview + e.manuallyApproved + e.rejected + e.overridden, 0);
                        return total > 0 ? `${Math.round((pending / total) * 100)}%` : '0%';
                      })()}
                    </p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('القرارات التي تتطلب مراجعة بشرية', 'decisions requiring human review')}</p>
                  </CVisionCardBody>
                </CVisionCard>

                <CVisionCard C={C}>
                  <CVisionCardBody style={{ paddingTop: 24 }}>
                    <p style={{ fontSize: 13, color: C.textMuted }}>{tr('معدل الموافقة البشرية', 'Human Approval Rate')}</p>
                    <p style={{ fontSize: 30, fontWeight: 700, marginTop: 4, color: C.green }}>
                      {(() => {
                        const reviewed = stats.reduce((s, e) => s + e.manuallyApproved + e.rejected + e.overridden, 0);
                        const approved = stats.reduce((s, e) => s + e.manuallyApproved + e.overridden, 0);
                        return reviewed > 0 ? `${Math.round((approved / reviewed) * 100)}%` : 'N/A';
                      })()}
                    </p>
                    <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('من القرارات المراجعة تمت الموافقة عليها', 'of reviewed decisions approved')}</p>
                  </CVisionCardBody>
                </CVisionCard>
              </div>

              {/* Decision Type Breakdown */}
              <CVisionCard C={C}>
                <CVisionCardHeader C={C}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تفصيل نوع القرار', 'Decision Type Breakdown')}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{tr('مقاييس الأداء لكل نوع قرار', 'Performance metrics per decision type')}</div>
                </CVisionCardHeader>
                <CVisionCardBody>
                  <div style={{ borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <CVisionTable C={C}>
                      <CVisionTableHead C={C}>
                          <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                          <CVisionTh C={C} align="center">{tr('الإجمالي', 'Total')}</CVisionTh>
                          <CVisionTh C={C} align="center">{tr('متوسط الثقة', 'Avg Confidence')}</CVisionTh>
                          <CVisionTh C={C} align="center">{tr('معدل الموافقة التلقائية', 'Auto-Approve Rate')}</CVisionTh>
                          <CVisionTh C={C} align="center">{tr('معدل المراجعة', 'Review Rate')}</CVisionTh>
                          <CVisionTh C={C} align="center">{tr('الموافقة البشرية', 'Human Approval')}</CVisionTh>
                      </CVisionTableHead>
                      <CVisionTableBody>
                        {stats.map((s) => {
                          const reviewRate = s.totalDecisions > 0
                            ? Math.round(((s.totalDecisions - s.autoApproved) / s.totalDecisions) * 100)
                            : 0;
                          return (
                            <CVisionTr C={C} key={s.decisionType}>
                              <CVisionTd>
                                <CVisionBadge C={C} className={DECISION_TYPE_COLORS[s.decisionType]} variant="secondary">
                                  {DECISION_TYPE_LABELS[s.decisionType]}
                                </CVisionBadge>
                              </CVisionTd>
                              <CVisionTd align="center" style={{ fontWeight: 500 }}>{s.totalDecisions}</CVisionTd>
                              <CVisionTd align="center">
                                <CVisionBadge C={C} className={confidenceBg(s.averageConfidence)} variant="secondary">
                                  {s.averageConfidence}%
                                </CVisionBadge>
                              </CVisionTd>
                              <CVisionTd align="center">{s.autoApproveRate}%</CVisionTd>
                              <CVisionTd className={cn('text-center', reviewRate> 30 && 'text-amber-600 font-medium')}>
                                {reviewRate}%
                              </CVisionTd>
                              <CVisionTd align="center">{s.humanApprovalRate}%</CVisionTd>
                            </CVisionTr>
                          );
                        })}
                      </CVisionTableBody>
                    </CVisionTable>
                  </div>
                </CVisionCardBody>
              </CVisionCard>

              {/* Stacked Bar Chart */}
              {chartData.length > 0 && (
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('توزيع الحالة حسب النوع', 'Status Distribution by Type')}</div>
                  </CVisionCardHeader>
                  <CVisionCardBody>
                    <ChartContainer
                      config={{
                        autoApproved: { label: 'Auto Approved', color: '#22c55e' },
                        humanApproved: { label: 'Human Approved', color: '#3b82f6' },
                        rejected: { label: 'Rejected', color: '#ef4444' },
                        overridden: { label: 'Overridden', color: '#f97316' },
                        pending: { label: 'Pending', color: '#eab308' },
                      }}
                      className="h-[260px]"
                    >
                      <BarChart data={chartData} barGap={0}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="autoApproved" stackId="a" fill="#22c55e" name="Auto Approved" />
                        <Bar dataKey="humanApproved" stackId="a" fill="#3b82f6" name="Human Approved" />
                        <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
                        <Bar dataKey="overridden" stackId="a" fill="#f97316" name="Overridden" />
                        <Bar dataKey="pending" stackId="a" fill="#eab308" radius={[4, 4, 0, 0]} name="Pending" />
                      </BarChart>
                    </ChartContainer>
                  </CVisionCardBody>
                </CVisionCard>
              )}
            </>
          ) : (
            <CVisionCard C={C}>
              <CVisionCardBody style={{ paddingTop: 32, paddingBottom: 32, textAlign: 'center', color: C.textMuted }}>
                <Activity style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.5 }} />
                <p>{tr('لا توجد إحصائيات متاحة للفترة المحددة.', 'No stats available for the selected period.')}</p>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {/* ── Configuration Panel ── */}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings style={{ height: 20, width: 20 }} />
                {tr('إعدادات الحوكمة', 'Governance Settings')}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                {tr('التغييرات تؤثر على كيفية الموافقة التلقائية على قرارات الذكاء الاصطناعي أو وضع علامة للمراجعة', 'Changes affect how AI decisions are auto-approved or flagged for review')}
              </div>
            </CVisionCardHeader>
            <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {configLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 40, borderRadius: 6 }}  />
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 40, borderRadius: 6 }}  />
                  <CVisionSkeletonCard C={C} height={200} style={{ height: 40, borderRadius: 6 }}  />
                </div>
              ) : configDraft ? (
                <>
                  {/* Global auto-approve toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: C.bgSubtle, borderRadius: 12 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('الموافقة التلقائية الشاملة', 'Global Auto-Approve')}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>
                        {tr('عند التفعيل، يتم قبول القرارات عالية الثقة تلقائيًا', 'When enabled, high-confidence decisions are approved automatically')}
                      </p>
                    </div>
                    <CVisionButton C={C} isDark={isDark}
                      variant={configDraft.globalAutoApproveEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setConfigDraft((prev) =>
                          prev
                            ? { ...prev, globalAutoApproveEnabled: !prev.globalAutoApproveEnabled }
                            : prev
                        )
                      }
                    >
                      {configDraft.globalAutoApproveEnabled ? tr('مفعل', 'Enabled') : tr('معطل', 'Disabled')}
                    </CVisionButton>
                  </div>

                  {/* Max pending reviews */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
                    <div>
                      <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('الحد الأقصى للمراجعات المعلقة', 'Max Pending Reviews')}</CVisionLabel>
                      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                        {tr('إيقاف قرارات الذكاء الاصطناعي الجديدة عندما تتجاوز المراجعات المعلقة هذا الحد', 'Halt new AI decisions when pending reviews exceed this limit')}
                      </p>
                      <CVisionInput C={C}
                        type="number"
                        value={configDraft.maxPendingReviews}
                        min={1}
                        max={1000}
                        onChange={(e) =>
                          setConfigDraft((prev) =>
                            prev
                              ? { ...prev, maxPendingReviews: parseInt(e.target.value) || 100 }
                              : prev
                          )
                        }
                      />
                    </div>
                    <div>
                      <CVisionLabel C={C} style={{ fontSize: 13 }}>{tr('أيام الاحتفاظ', 'Retention Days')}</CVisionLabel>
                      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>
                        {tr('عدد الأيام للاحتفاظ بسجلات القرارات', 'Number of days to keep decision logs')}
                      </p>
                      <CVisionInput C={C}
                        type="number"
                        value={configDraft.retentionDays}
                        min={30}
                        max={3650}
                        onChange={(e) =>
                          setConfigDraft((prev) =>
                            prev
                              ? { ...prev, retentionDays: parseInt(e.target.value) || 365 }
                              : prev
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* Per-type thresholds */}
                  <div>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, transition: 'color 0.2s, background 0.2s' }}
                      onClick={() => setShowThresholdOverrides(!showThresholdOverrides)}
                    >
                      {showThresholdOverrides ? (
                        <ChevronUp style={{ height: 16, width: 16 }} />
                      ) : (
                        <ChevronDown style={{ height: 16, width: 16 }} />
                      )}
                      {tr('تجاوزات الحد لكل نوع', 'Per-Type Threshold Overrides')}
                    </button>

                    {showThresholdOverrides && configDraft.thresholds && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {ALL_DECISION_TYPES.map((type) => {
                          const threshold = configDraft.thresholds[type];
                          if (!threshold) return null;
                          return (
                            <div key={type} style={{ padding: 12, border: `1px solid ${C.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <CVisionBadge C={C} className={DECISION_TYPE_COLORS[type]} variant="secondary">
                                  {DECISION_TYPE_LABELS[type]}
                                </CVisionBadge>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('الموافقة التلقائية', 'Auto-Approve')}</CVisionLabel>
                                  <CVisionButton C={C} isDark={isDark}
                                    variant={threshold.autoApproveEnabled ? 'default' : 'outline'}
                                    size="sm"
                                    style={{ height: 24, fontSize: 12 }}
                                    onClick={() => {
                                      setConfigDraft((prev) => {
                                        if (!prev) return prev;
                                        const updated = JSON.parse(JSON.stringify(prev));
                                        updated.thresholds[type].autoApproveEnabled = !threshold.autoApproveEnabled;
                                        return updated;
                                      });
                                    }}
                                  >
                                    {threshold.autoApproveEnabled ? 'On' : 'Off'}
                                  </CVisionButton>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                <div>
                                  <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('حد الموافقة التلقائية', 'Auto-Approve Threshold')}</CVisionLabel>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={threshold.autoApproveThreshold}
                                      style={{ flex: 1, height: 8 }}
                                      onChange={(e) => {
                                        setConfigDraft((prev) => {
                                          if (!prev) return prev;
                                          const updated = JSON.parse(JSON.stringify(prev));
                                          updated.thresholds[type].autoApproveThreshold = parseInt(e.target.value);
                                          return updated;
                                        });
                                      }}
                                    />
                                    <span style={{ fontSize: 13, fontWeight: 500, width: 40, textAlign: 'right' }}>
                                      {threshold.autoApproveThreshold}%
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('حد الرفض التلقائي', 'Auto-Reject Threshold')}</CVisionLabel>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      value={threshold.autoRejectThreshold}
                                      style={{ flex: 1, height: 8 }}
                                      onChange={(e) => {
                                        setConfigDraft((prev) => {
                                          if (!prev) return prev;
                                          const updated = JSON.parse(JSON.stringify(prev));
                                          updated.thresholds[type].autoRejectThreshold = parseInt(e.target.value);
                                          return updated;
                                        });
                                      }}
                                    />
                                    <span style={{ fontSize: 13, fontWeight: 500, width: 40, textAlign: 'right' }}>
                                      {threshold.autoRejectThreshold}%
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Checkbox
                                  checked={threshold.requiresManagerReview}
                                  onCheckedChange={(checked) => {
                                    setConfigDraft((prev) => {
                                      if (!prev) return prev;
                                      const updated = JSON.parse(JSON.stringify(prev));
                                      updated.thresholds[type].requiresManagerReview = !!checked;
                                      return updated;
                                    });
                                  }}
                                />
                                <CVisionLabel C={C} style={{ fontSize: 12 }}>{tr('يتطلب مراجعة على مستوى المدير', 'Requires manager-level review')}</CVisionLabel>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Save / Reset */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                    <CVisionButton C={C} isDark={isDark} onClick={saveConfig} disabled={configSaving}>
                      {configSaving ? (
                        <Loader2 style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Save style={{ height: 16, width: 16, marginRight: 8 }} />
                      )}
                      {tr('حفظ الإعدادات', 'Save Config')}uration
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark}
                      variant="outline"
                      onClick={() => {
                        if (config) {
                          setConfigDraft(JSON.parse(JSON.stringify(config)));
                          toast({ title: 'Reset', description: 'Configuration reset to last saved state.' });
                        }
                      }}
                    >
                      <RotateCcw style={{ height: 16, width: 16, marginRight: 8 }} />
                      Reset to Defaults
                    </CVisionButton>
                  </div>
                </>
              ) : (
                <p style={{ textAlign: 'center', color: C.textMuted, paddingTop: 16, paddingBottom: 16 }}>
                  Failed to load configuration.
                </p>
              )}
            </CVisionCardBody>
          </CVisionCard>
        </div>
        </CVisionTabContent>

        {/* ═══════════════════ Tab 4: Advanced Review Queue ═══════════════════ */}
        <CVisionTabContent tabId="adv-review">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AdvancedReviewQueueTab />
        </div>
        </CVisionTabContent>

        {/* ═══════════════════ Tab 5: Thresholds ═══════════════════ */}
        <CVisionTabContent tabId="thresholds">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ThresholdsConfigTab />
        </div>
        </CVisionTabContent>

        {/* ═══════════════════ Tab 6: Model Accuracy ═══════════════════ */}
        <CVisionTabContent tabId="accuracy">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ModelAccuracyTab />
        </div>
        </CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
