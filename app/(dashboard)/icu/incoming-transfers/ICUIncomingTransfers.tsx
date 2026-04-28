'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useLang } from '@/hooks/use-lang';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Inbox,
  Loader2,
  BedDouble,
} from 'lucide-react';
import { ESCALATION_REASONS } from '@/lib/clinical/escalationCriteria';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AcuityData {
  sofaTotal?: number;
  mewsScore?: number;
  gcsScore?: number;
}

interface SbarData {
  situation?: string;
  background?: string;
  assessment?: string;
  recommendation?: string;
}

interface EscalationCriteria {
  reasons?: string[];
}

interface TransferItem {
  id: string;
  patientName?: string;
  patientNameAr?: string;
  urgency?: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
  targetUnit?: string;
  fromWard?: string;
  fromBed?: string;
  toUnit?: string;
  reason?: string;
  status: string;
  acuityData?: AcuityData;
  escalationCriteria?: EscalationCriteria;
  sbarData?: SbarData;
  requestedAt?: string;
  approvedAt?: string;
  completedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  requestedBy?: string;
  approvedBy?: string;
}

interface TransferCounts {
  pending?: number;
  approved?: number;
  completed?: number;
  rejected?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then((r) => r.json());

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ICUIncomingTransfers() {
  const { language } = useLang();
  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedSbar, setExpandedSbar] = useState<Record<string, boolean>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, error, isLoading, mutate } = useSWR(
    '/api/icu/incoming-transfers?status=ALL',
    fetcher,
    { refreshInterval: 15000 },
  );

  const transfers: TransferItem[] = useMemo(
    () => data?.transfers ?? data?.items ?? [],
    [data],
  );
  const counts: TransferCounts = useMemo(() => data?.counts ?? {}, [data]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filteredTransfers = useMemo(() => {
    if (statusFilter === 'ALL') return transfers;
    return transfers.filter((t) => t.status === statusFilter);
  }, [transfers, statusFilter]);

  // ── SBAR toggle ────────────────────────────────────────────────────────────
  const toggleSbar = useCallback((id: string) => {
    setExpandedSbar((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleAction = useCallback(
    async (id: string, action: string, extraBody?: Record<string, unknown>) => {
      setActionLoading(id);
      try {
        const res = await fetch(`/api/admission/ward-transfer/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action, ...extraBody }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Request failed');
        }
        toast({
          title: tr('تمت العملية بنجاح', 'Action completed successfully'),
          description: tr(
            `تم تنفيذ الإجراء: ${actionLabelAr(action)}`,
            `Action executed: ${actionLabelEn(action)}`,
          ),
        });
        mutate();
        if (action === 'reject') {
          setRejectingId(null);
          setRejectionReason('');
        }
      } catch (err: any) {
        toast({
          title: tr('خطأ', 'Error'),
          description: err?.message || tr('فشل تنفيذ الإجراء', 'Failed to execute action'),
          variant: 'destructive',
        });
      } finally {
        setActionLoading(null);
      }
    },
    [mutate, toast, tr],
  );

  const handleAccept = useCallback(
    (id: string) => handleAction(id, 'approve'),
    [handleAction],
  );

  const handleComplete = useCallback(
    (id: string) => handleAction(id, 'complete'),
    [handleAction],
  );

  const handleRejectConfirm = useCallback(
    (id: string) => {
      if (!rejectionReason.trim()) {
        toast({
          title: tr('مطلوب', 'Required'),
          description: tr('يرجى إدخال سبب الرفض', 'Please enter a rejection reason'),
          variant: 'destructive',
        });
        return;
      }
      handleAction(id, 'reject', { rejectionReason: rejectionReason.trim() });
    },
    [handleAction, rejectionReason, toast, tr],
  );

  // ── Helpers ────────────────────────────────────────────────────────────────

  function actionLabelAr(action: string): string {
    switch (action) {
      case 'approve': return 'قبول';
      case 'reject': return 'رفض';
      case 'complete': return 'إتمام';
      default: return action;
    }
  }

  function actionLabelEn(action: string): string {
    switch (action) {
      case 'approve': return 'Approve';
      case 'reject': return 'Reject';
      case 'complete': return 'Complete';
      default: return action;
    }
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return '\u2014';
    return new Date(dateStr).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatTime(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateTime(dateStr?: string): string {
    if (!dateStr) return '\u2014';
    return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
  }

  // ── Urgency badge ─────────────────────────────────────────────────────────
  function urgencyBadge(urgency?: string) {
    switch (urgency) {
      case 'EMERGENCY':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            {tr('طوارئ', 'Emergency')}
          </Badge>
        );
      case 'URGENT':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            {tr('عاجل', 'Urgent')}
          </Badge>
        );
      case 'ROUTINE':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            {tr('عادي', 'Routine')}
          </Badge>
        );
      default:
        return null;
    }
  }

  // ── Status badge ──────────────────────────────────────────────────────────
  function statusBadge(status: string) {
    switch (status) {
      case 'REQUESTED':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="w-3 h-3 mr-1 inline" />
            {tr('بانتظار الموافقة', 'Pending')}
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <CheckCircle className="w-3 h-3 mr-1 inline" />
            {tr('تمت الموافقة', 'Approved')}
          </Badge>
        );
      case 'BED_ASSIGNED':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">
            <BedDouble className="w-3 h-3 mr-1 inline" />
            {tr('تم تعيين السرير', 'Bed Assigned')}
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1 inline" />
            {tr('مكتمل', 'Completed')}
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="w-3 h-3 mr-1 inline" />
            {tr('مرفوض', 'Rejected')}
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge className="bg-muted text-muted-foreground border-border">
            {tr('ملغى', 'Cancelled')}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  // ── Acuity score color ─────────────────────────────────────────────────────
  function sofaColor(score?: number): string {
    if (score === undefined || score === null) return 'bg-muted text-foreground';
    if (score >= 10) return 'bg-red-100 text-red-800';
    if (score >= 6) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  }

  function mewsColor(score?: number): string {
    if (score === undefined || score === null) return 'bg-muted text-foreground';
    if (score >= 7) return 'bg-red-100 text-red-800';
    if (score >= 5) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  }

  function gcsColor(score?: number): string {
    if (score === undefined || score === null) return 'bg-muted text-foreground';
    if (score <= 8) return 'bg-red-100 text-red-800';
    if (score <= 12) return 'bg-orange-100 text-orange-800';
    return 'bg-green-100 text-green-800';
  }

  // ── Escalation reason label ────────────────────────────────────────────────
  function reasonLabel(reasonKey: string): string {
    const found = ESCALATION_REASONS.find((r) => r.key === reasonKey);
    if (!found) return reasonKey;
    return language === 'ar' ? found.labelAr : found.labelEn;
  }

  // ── Patient display name ──────────────────────────────────────────────────
  function patientDisplayName(item: TransferItem): string {
    if (language === 'ar' && item.patientNameAr) return item.patientNameAr;
    return item.patientName || tr('مريض غير معروف', 'Unknown Patient');
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════════

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">
            {tr('جاري التحميل...', 'Loading...')}
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500" />
          <p className="text-sm font-medium text-red-600">
            {tr('حدث خطأ في تحميل البيانات', 'Failed to load data')}
          </p>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            {tr('إعادة المحاولة', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold tracking-tight">
          {tr('التحويلات الواردة لـ ICU', 'ICU Incoming Transfers')}
        </h1>
      </div>

      {/* ── Count badges bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2">
          <Clock className="w-4 h-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            {tr('بانتظار الموافقة', 'Pending')}
          </span>
          <Badge className="bg-yellow-200 text-yellow-900">{counts.pending ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <CheckCircle className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {tr('تمت الموافقة', 'Approved')}
          </span>
          <Badge className="bg-blue-200 text-blue-900">{counts.approved ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800">
            {tr('مكتمل', 'Completed')}
          </span>
          <Badge className="bg-green-200 text-green-900">{counts.completed ?? 0}</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <XCircle className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            {tr('مرفوض', 'Rejected')}
          </span>
          <Badge className="bg-red-200 text-red-900">{counts.rejected ?? 0}</Badge>
        </div>
      </div>

      {/* ── Status filter ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          {tr('تصفية حسب الحالة', 'Filter by status')}
        </label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{tr('الكل', 'All')}</SelectItem>
            <SelectItem value="REQUESTED">{tr('بانتظار الموافقة', 'Pending')}</SelectItem>
            <SelectItem value="APPROVED">{tr('تمت الموافقة', 'Approved')}</SelectItem>
            <SelectItem value="COMPLETED">{tr('مكتمل', 'Completed')}</SelectItem>
            <SelectItem value="REJECTED">{tr('مرفوض', 'Rejected')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {filteredTransfers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Inbox className="w-12 h-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {tr('لا توجد تحويلات واردة', 'No incoming transfers')}
          </p>
        </div>
      )}

      {/* ── Transfer cards list ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {filteredTransfers.map((item) => (
          <Card key={item.id} className="shadow-sm">
            <CardHeader className="pb-3">
              {/* Header row: patient name + urgency + target unit */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">
                    {patientDisplayName(item)}
                  </CardTitle>
                  {urgencyBadge(item.urgency)}
                </div>
                <div className="flex items-center gap-2">
                  {item.targetUnit && (
                    <Badge variant="outline" className="font-semibold">
                      {item.targetUnit}
                    </Badge>
                  )}
                  {statusBadge(item.status)}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* ── Location ───────────────────────────────────────────────── */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium">
                  {tr('من', 'From')}:{' '}
                  <span className="text-foreground">
                    {item.fromWard || '\u2014'}
                    {item.fromBed ? `, ${tr('سرير', 'Bed')} ${item.fromBed}` : ''}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">
                  {tr('إلى', 'To')}:{' '}
                  <span className="text-foreground">{item.toUnit || item.targetUnit || 'ICU'}</span>
                </span>
              </div>

              {/* ── Reason ─────────────────────────────────────────────────── */}
              {item.reason && (
                <div className="text-sm">
                  <span className="font-medium text-muted-foreground">
                    {tr('سبب التحويل', 'Transfer Reason')}:{' '}
                  </span>
                  <span className="text-foreground">{item.reason}</span>
                </div>
              )}

              {/* ── Acuity scores ──────────────────────────────────────────── */}
              {item.acuityData && (
                <div className="flex flex-wrap gap-2">
                  {item.acuityData.sofaTotal !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${sofaColor(item.acuityData.sofaTotal)}`}
                    >
                      SOFA: {item.acuityData.sofaTotal}
                    </span>
                  )}
                  {item.acuityData.mewsScore !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${mewsColor(item.acuityData.mewsScore)}`}
                    >
                      MEWS: {item.acuityData.mewsScore}
                    </span>
                  )}
                  {item.acuityData.gcsScore !== undefined && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${gcsColor(item.acuityData.gcsScore)}`}
                    >
                      GCS: {item.acuityData.gcsScore}
                    </span>
                  )}
                </div>
              )}

              {/* ── Escalation criteria ────────────────────────────────────── */}
              {item.escalationCriteria?.reasons && item.escalationCriteria.reasons.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    {tr('معايير التصعيد', 'Escalation Criteria')}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.escalationCriteria.reasons.map((reasonKey) => (
                      <Badge
                        key={reasonKey}
                        variant="secondary"
                        className="text-xs"
                      >
                        {reasonLabel(reasonKey)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* ── SBAR Summary ───────────────────────────────────────────── */}
              {item.sbarData && (item.sbarData.situation || item.sbarData.recommendation) && (
                <div className="border rounded-md">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
                    onClick={() => toggleSbar(item.id)}
                  >
                    <span>{tr('ملخص SBAR', 'SBAR Summary')}</span>
                    {expandedSbar[item.id] ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                  {expandedSbar[item.id] && (
                    <div className="px-3 pb-3 space-y-2 text-sm border-t">
                      {item.sbarData.situation && (
                        <div className="pt-2">
                          <span className="font-medium text-muted-foreground">
                            {tr('الموقف', 'Situation')}:{' '}
                          </span>
                          <span>{item.sbarData.situation}</span>
                        </div>
                      )}
                      {item.sbarData.background && (
                        <div>
                          <span className="font-medium text-muted-foreground">
                            {tr('الخلفية', 'Background')}:{' '}
                          </span>
                          <span>{item.sbarData.background}</span>
                        </div>
                      )}
                      {item.sbarData.assessment && (
                        <div>
                          <span className="font-medium text-muted-foreground">
                            {tr('التقييم', 'Assessment')}:{' '}
                          </span>
                          <span>{item.sbarData.assessment}</span>
                        </div>
                      )}
                      {item.sbarData.recommendation && (
                        <div>
                          <span className="font-medium text-muted-foreground">
                            {tr('التوصية', 'Recommendation')}:{' '}
                          </span>
                          <span>{item.sbarData.recommendation}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Timeline ───────────────────────────────────────────────── */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                {item.requestedAt && (
                  <span>
                    <Clock className="w-3 h-3 inline mr-1" />
                    {tr('طلب', 'Requested')}: {formatDateTime(item.requestedAt)}
                  </span>
                )}
                {item.approvedAt && (
                  <span>
                    <CheckCircle className="w-3 h-3 inline mr-1 text-blue-500" />
                    {tr('موافقة', 'Approved')}: {formatDateTime(item.approvedAt)}
                  </span>
                )}
                {item.completedAt && (
                  <span>
                    <CheckCircle className="w-3 h-3 inline mr-1 text-green-500" />
                    {tr('اكتمال', 'Completed')}: {formatDateTime(item.completedAt)}
                  </span>
                )}
                {item.rejectedAt && (
                  <span>
                    <XCircle className="w-3 h-3 inline mr-1 text-red-500" />
                    {tr('رفض', 'Rejected')}: {formatDateTime(item.rejectedAt)}
                  </span>
                )}
              </div>

              {/* ── Rejection reason (for rejected items) ──────────────────── */}
              {item.status === 'REJECTED' && item.rejectionReason && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm">
                  <span className="font-medium text-red-700">
                    {tr('سبب الرفض', 'Rejection Reason')}:{' '}
                  </span>
                  <span className="text-red-600">{item.rejectionReason}</span>
                </div>
              )}

              {/* ── Actions ────────────────────────────────────────────────── */}
              {item.status === 'REQUESTED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => handleAccept(item.id)}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    {tr('قبول', 'Accept')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setRejectingId(item.id);
                      setRejectionReason('');
                    }}
                    disabled={actionLoading === item.id}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    {tr('رفض', 'Reject')}
                  </Button>
                </div>
              )}

              {item.status === 'APPROVED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(item.id, 'assign_bed')}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <BedDouble className="w-4 h-4 mr-1" />
                    )}
                    {tr('تعيين سرير', 'Assign Bed')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleComplete(item.id)}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    {tr('إتمام التحويل', 'Complete')}
                  </Button>
                </div>
              )}

              {item.status === 'BED_ASSIGNED' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    onClick={() => handleComplete(item.id)}
                    disabled={actionLoading === item.id}
                  >
                    {actionLoading === item.id ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    {tr('إتمام التحويل', 'Complete Transfer')}
                  </Button>
                </div>
              )}

              {/* ── Reject inline form ─────────────────────────────────────── */}
              {rejectingId === item.id && (
                <div className="space-y-2 rounded-md border border-red-200 bg-red-50/50 p-3">
                  <label className="text-sm font-medium text-red-700">
                    {tr('سبب الرفض', 'Rejection Reason')}
                  </label>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-red-300 bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-y"
                    placeholder={tr(
                      'أدخل سبب رفض التحويل...',
                      'Enter the reason for rejecting this transfer...',
                    )}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectConfirm(item.id)}
                      disabled={actionLoading === item.id}
                    >
                      {actionLoading === item.id ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4 mr-1" />
                      )}
                      {tr('تأكيد الرفض', 'Confirm Reject')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectionReason('');
                      }}
                    >
                      {tr('إلغاء', 'Cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
