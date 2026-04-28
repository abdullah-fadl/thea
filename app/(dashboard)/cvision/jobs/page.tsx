'use client';

import { useState, useCallback } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionSelect,
  CVisionEmptyState,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import {
  ListChecks, RefreshCw, Play, RotateCcw, XCircle,
  Clock, CheckCircle2, AlertTriangle, Loader2, Ban,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';

type JobStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface Job {
  jobId: string;
  queue: string;
  status: JobStatus;
  progress: number;
  data: any;
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const apiGet = (params: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams(params);
  return fetch(`/api/cvision/jobs?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};

const apiPost = (body: any) =>
  fetch('/api/cvision/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'include', body: JSON.stringify(body),
  }).then(r => r.json());

const STATUS_VARIANT: Record<JobStatus, 'warning' | 'info' | 'success' | 'danger' | 'muted'> = {
  WAITING: 'warning', ACTIVE: 'info', COMPLETED: 'success', FAILED: 'danger', CANCELLED: 'muted',
};

const STATUS_ICON: Record<JobStatus, typeof Clock> = {
  WAITING: Clock, ACTIVE: Loader2, COMPLETED: CheckCircle2, FAILED: AlertTriangle, CANCELLED: Ban,
};

export default function BackgroundJobsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [selectedQueue, setSelectedQueue] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: statsRaw } = useQuery({
    queryKey: cvisionKeys.jobs.list({ action: 'queue-stats' }),
    queryFn: () => apiGet({ action: 'queue-stats' }),
  });
  const stats: Record<string, Record<string, number>> = ((statsRaw as any)?.data as Record<string, Record<string, number>>) || {};

  const jobsParams = (() => {
    const p: Record<string, string> = { action: 'list', limit: '50' };
    if (selectedQueue && selectedQueue !== 'all') p.queue = selectedQueue;
    if (statusFilter && statusFilter !== 'all') p.status = statusFilter;
    return p;
  })();

  const { data: jobsRaw, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.jobs.list(jobsParams),
    queryFn: () => apiGet(jobsParams),
  });
  const jobs: Job[] = ((jobsRaw as any)?.data as Job[]) || [];

  const handleRefresh = () => { queryClient.invalidateQueries({ queryKey: cvisionKeys.jobs.all }); };

  const handleQueueChange = (val: string) => { setSelectedQueue(val); };
  const handleStatusChange = (val: string) => { setStatusFilter(val); };

  const processMutation = useMutation({
    mutationFn: (payload: any) => apiPost(payload),
    onSuccess: (res: any) => {
      if (res.ok) {
        toast.success(tr(`تمت معالجة ${res.processed} مهمة`, `Processed ${res.processed} jobs (${res.succeeded} succeeded, ${res.failed} failed)`));
        handleRefresh();
      } else { toast.error(res.error || tr('فشلت المعالجة', 'Processing failed')); }
    },
    onError: () => toast.error(tr('فشلت المعالجة', 'Processing failed')),
  });

  const handleProcess = async (queue: string) => {
    processMutation.mutate({ action: 'process', queue, limit: 10 });
  };
  const processing = processMutation.isPending;

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => apiPost({ action: 'retry', jobId }),
    onSuccess: (res: any) => {
      if (res.ok) { toast.success(tr('تم إعادة الجدولة', 'Job queued for retry')); handleRefresh(); }
      else toast.error(res.error || tr('فشلت إعادة المحاولة', 'Retry failed'));
    },
    onError: () => toast.error(tr('فشلت إعادة المحاولة', 'Retry failed')),
  });

  const handleRetry = async (jobId: string) => { retryMutation.mutate(jobId); };

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => apiPost({ action: 'cancel', jobId }),
    onSuccess: (res: any) => {
      if (res.ok) { toast.success(tr('تم إلغاء المهمة', 'Job cancelled')); handleRefresh(); }
      else toast.error(res.error || tr('فشل الإلغاء', 'Cancel failed'));
    },
    onError: () => toast.error(tr('فشل الإلغاء', 'Cancel failed')),
  });

  const handleCancel = async (jobId: string) => { cancelMutation.mutate(jobId); };

  const queueNames = Object.keys(stats);
  const totalByStatus: Record<string, number> = {};
  for (const q of Object.values(stats)) {
    for (const [s, c] of Object.entries(q)) { totalByStatus[s] = (totalByStatus[s] || 0) + c; }
  }

  function timeAgo(d: string): string {
    const ms = Date.now() - new Date(d).getTime();
    if (ms < 60000) return `${Math.round(ms / 1000)}${tr('ث', 's')}`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}${tr('د', 'm')}`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}${tr('س', 'h')}`;
    return `${Math.round(ms / 86400000)}${tr('ي', 'd')}`;
  }

  const queueOpts = [
    { value: 'all', label: tr('جميع الطوابير', 'All Queues') },
    { value: 'email', label: 'Email' },
    { value: 'pdf', label: 'PDF' },
    { value: 'webhooks', label: 'Webhooks' },
    ...queueNames.filter(q => !['email', 'pdf', 'webhooks'].includes(q)).map(q => ({ value: q, label: q })),
  ];

  const statusOpts = [
    { value: 'all', label: tr('جميع الحالات', 'All Statuses') },
    { value: 'WAITING', label: tr('قيد الانتظار', 'Waiting') },
    { value: 'ACTIVE', label: tr('نشط', 'Active') },
    { value: 'COMPLETED', label: tr('مكتمل', 'Completed') },
    { value: 'FAILED', label: tr('فشل', 'Failed') },
    { value: 'CANCELLED', label: tr('ملغي', 'Cancelled') },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('المهام الخلفية', 'Background Jobs')}
        titleEn="Background Jobs"
        subtitle={tr('مراقبة وإدارة طوابير المهام الخلفية.', 'Monitor and manage background job queues.')}
        icon={ListChecks}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={handleRefresh}>
            {tr('تحديث', 'Refresh')}
          </CVisionButton>
        }
      />

      {/* Queue Stats Cards */}
      {queueNames.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {queueNames.map(q => {
            const s = stats[q] || {};
            return (
              <CVisionCard key={q} C={C}>
                <CVisionCardHeader C={C}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text, textTransform: 'capitalize' }}>{q}</span>
                    {(s.WAITING || 0) > 0 && (
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" disabled={processing} onClick={() => handleProcess(q)} icon={<Play size={12} />}>
                        {tr('معالجة', 'Process')}
                      </CVisionButton>
                    )}
                  </div>
                </CVisionCardHeader>
                <CVisionCardBody>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                    <span style={{ color: C.gold }}>{s.WAITING || 0} {tr('انتظار', 'waiting')}</span>
                    <span style={{ color: C.blue }}>{s.ACTIVE || 0} {tr('نشط', 'active')}</span>
                    <span style={{ color: C.green }}>{s.COMPLETED || 0} {tr('مكتمل', 'done')}</span>
                    {(s.FAILED || 0) > 0 && <span style={{ color: C.red }}>{s.FAILED} {tr('فشل', 'failed')}</span>}
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('الإجمالي', 'Total')}</span>
            </CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: C.gold }}>{totalByStatus.WAITING || 0} {tr('انتظار', 'waiting')}</span>
                <span style={{ color: C.blue }}>{totalByStatus.ACTIVE || 0} {tr('نشط', 'active')}</span>
                <span style={{ color: C.green }}>{totalByStatus.COMPLETED || 0} {tr('مكتمل', 'done')}</span>
                {(totalByStatus.FAILED || 0) > 0 && <span style={{ color: C.red }}>{totalByStatus.FAILED} {tr('فشل', 'failed')}</span>}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <CVisionSelect C={C} value={selectedQueue} onChange={handleQueueChange} options={queueOpts} style={{ minWidth: 160 }} />
        <CVisionSelect C={C} value={statusFilter} onChange={handleStatusChange} options={statusOpts} style={{ minWidth: 160 }} />
      </div>

      {/* Jobs Table */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => <CVisionSkeletonCard key={i} C={C} height={48} />)}
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <CVisionEmptyState
          C={C}
          icon={ListChecks}
          title={tr('لا توجد مهام', 'No jobs found')}
          description={tr('ستظهر المهام الخلفية هنا عند إنشائها. حاول تعديل الفلاتر.', 'Background jobs will appear here when they are created. Try adjusting your filters.')}
        />
      )}

      {!loading && jobs.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 0 }}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('رقم المهمة', 'Job ID')}</CVisionTh>
                <CVisionTh C={C}>{tr('الطابور', 'Queue')}</CVisionTh>
                <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                <CVisionTh C={C}>{tr('التقدم', 'Progress')}</CVisionTh>
                <CVisionTh C={C}>{tr('المحاولات', 'Attempts')}</CVisionTh>
                <CVisionTh C={C}>{tr('الوقت', 'Created')}</CVisionTh>
                <CVisionTh C={C} align="right">{tr('الإجراءات', 'Actions')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {jobs.map(job => {
                  const StatusIcon = STATUS_ICON[job.status] || Clock;
                  return (
                    <CVisionTr key={job.jobId} C={C}>
                      <CVisionTd style={{ fontFamily: 'monospace', fontSize: 11, color: C.textMuted }}>{job.jobId}</CVisionTd>
                      <CVisionTd>
                        <CVisionBadge C={C} variant="muted" style={{ textTransform: 'capitalize' }}>{job.queue}</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <StatusIcon size={12} color={
                            job.status === 'COMPLETED' ? C.green : job.status === 'FAILED' ? C.red : job.status === 'ACTIVE' ? C.blue : job.status === 'WAITING' ? C.gold : C.textMuted
                          } />
                          <CVisionBadge C={C} variant={STATUS_VARIANT[job.status]}>{job.status}</CVisionBadge>
                        </div>
                      </CVisionTd>
                      <CVisionTd>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 64, height: 6, background: C.barTrack, borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: C.blue, borderRadius: 4, transition: 'all 0.3s', width: `${job.progress}%` }} />
                          </div>
                          <span style={{ fontSize: 11, color: C.textMuted }}>{job.progress}%</span>
                        </div>
                      </CVisionTd>
                      <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>{job.attempts}/{job.maxAttempts}</CVisionTd>
                      <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>{timeAgo(job.createdAt)}</CVisionTd>
                      <CVisionTd align="right">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                          {job.status === 'FAILED' && (
                            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<RotateCcw size={12} />} onClick={() => handleRetry(job.jobId)}>
                              {tr('إعادة', 'Retry')}
                            </CVisionButton>
                          )}
                          {job.status === 'WAITING' && (
                            <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" icon={<XCircle size={12} />} onClick={() => handleCancel(job.jobId)}>
                              {tr('إلغاء', 'Cancel')}
                            </CVisionButton>
                          )}
                          {job.error && (
                            <span style={{ fontSize: 11, color: C.red }} title={job.error}>{tr('خطأ', 'Error')}</span>
                          )}
                        </div>
                      </CVisionTd>
                    </CVisionTr>
                  );
                })}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCardBody>
        </CVisionCard>
      )}
    </CVisionPageLayout>
  );
}
