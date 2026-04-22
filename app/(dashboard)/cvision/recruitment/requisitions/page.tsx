'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useDevMode } from '@/lib/dev-mode';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea, CVisionLabel, CVisionPageLayout, CVisionSelect, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, Plus, Users, Eye, CheckCircle, Clock, XCircle } from 'lucide-react';
import {
  REQUISITION_STATUS_LABELS, REQUISITION_REASON_LABELS, REQUISITION_REASONS,
} from '@/lib/cvision/constants';

interface Requisition {
  id: string; requisitionNumber: string; title: string; departmentId: string;
  jobTitleId?: string | null; positionId?: string | null; headcount: number;
  headcountRequested?: number; reason: string; status: string; applicantCount?: number;
  slots?: { total: number; vacant: number; filled: number; frozen: number; };
  createdAt: string;
}

export default function RequisitionsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const router = useRouter();
  const isDev = useDevMode();
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);

  const [newReq, setNewReq] = useState({
    title: '', departmentId: '', jobTitleId: '', positionId: '',
    headcount: 1, headcountRequested: 1, reason: 'new_role', description: '',
  });

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: rawRequisitions = [], isLoading: loading, refetch: refetchRequisitions } = useQuery({
    queryKey: cvisionKeys.recruitment.requisitions.list({ status: statusFilter }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await cvisionFetch<any>('/api/cvision/recruitment/requisitions', { params });
      if (!data.success) throw new Error(data.error || 'Failed to load requisitions');
      const reqs = data.data?.items || data.data || [];
      const reqsWithSlots = await Promise.all(reqs.map(async (req: Requisition) => {
        if (req.status === 'open' || req.status === 'closed') {
          try {
            const slotsData = await cvisionFetch<any>(`/api/cvision/recruitment/requisitions/${req.id}/slots`);
            if (slotsData.success && slotsData.summary) return { ...req, slots: slotsData.summary };
          } catch { /* ignore */ }
        }
        return req;
      }));
      return reqsWithSlots as Requisition[];
    },
  });
  const requisitions = rawRequisitions;

  const { data: departments = [] } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 100 }),
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/org/departments', { params: { limit: 100 } });
      return data.items || data.data?.items || data.data || [];
    },
  });

  const { data: seedCandidateId = null } = useQuery({
    queryKey: cvisionKeys.recruitment.candidates.list({ seed: true }),
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/recruitment/candidates', { params: { limit: 100 } });
      if (data.success && data.data && data.data.length > 0) {
        const seedCandidate = data.data.find((c: any) => c.email === 'ahmed.ali@example.com' || c.fullName === 'Ahmed Ali') || data.data[0];
        return seedCandidate?.id || null;
      }
      return null;
    },
  });

  const { data: jobTitles = [] } = useQuery({
    queryKey: cvisionKeys.jobTitles.list({ departmentId: newReq.departmentId }),
    queryFn: async () => {
      if (!newReq.departmentId) return [];
      let data = await cvisionFetch<any>('/api/cvision/job-titles', { params: { departmentId: newReq.departmentId, limit: 100 } });
      let titles = data.data || data.items || [];
      if (titles.length === 0) {
        data = await cvisionFetch<any>('/api/cvision/job-titles', { params: { limit: 100 } });
        titles = (data.data || data.items || []).filter((jt: any) => !jt.departmentId || jt.departmentId === newReq.departmentId);
      }
      return titles as { id: string; name: string; departmentId?: string | null }[];
    },
    enabled: !!newReq.departmentId,
  });

  const { data: positions = [], isLoading: loadingPositions } = useQuery({
    queryKey: cvisionKeys.org.budgetedPositions.list({ departmentId: newReq.departmentId, jobTitleId: newReq.jobTitleId }),
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/org/budgeted-positions', { params: { departmentId: newReq.departmentId, jobTitleId: newReq.jobTitleId, includeInactive: '0' } });
      if (data.success) return data.data || data.items || [];
      return [];
    },
    enabled: !!newReq.departmentId && !!newReq.jobTitleId,
  });

  // ── Mutations ────────────────────────────────────────────────────────
  const openRequisitionMutation = useMutation({
    mutationFn: async (requisitionId: string) => {
      const getData = await cvisionFetch<any>(`/api/cvision/recruitment/requisitions/${requisitionId}`);
      if (!getData.success || !getData.requisition) throw new Error(tr('فشل تحميل تفاصيل الطلب', 'Failed to load requisition details'));
      const requisition = getData.requisition;
      if (!requisition.positionId) throw new Error(tr('يرجى اختيار وظيفة قبل الفتح', 'Please select a position before opening.'));
      return cvisionMutate<any>(`/api/cvision/recruitment/requisitions/${requisitionId}`, 'PUT', { action: 'open', positionId: requisition.positionId });
    },
    onSuccess: () => {
      toast({ title: tr('تم', 'Success'), description: tr('تم فتح الطلب', 'Requisition opened') });
      queryClient.invalidateQueries({ queryKey: cvisionKeys.recruitment.requisitions.all });
    },
    onError: (error: any) => { toast({ title: tr('خطأ', 'Error'), description: error.message, variant: 'destructive' }); },
  });

  const createRequisitionMutation = useMutation({
    mutationFn: async () => {
      if (!newReq.title || !newReq.departmentId) throw new Error(tr('العنوان والقسم مطلوبان', 'Title and department are required'));
      if (!newReq.jobTitleId || !newReq.positionId) throw new Error(tr('المسمى والوظيفة مطلوبان', 'Job Title and Position are required.'));
      return cvisionMutate<any>('/api/cvision/recruitment/requisitions', 'POST', { ...newReq, headcountRequested: newReq.headcountRequested || 1 });
    },
    onSuccess: () => {
      toast({ title: tr('تم', 'Success'), description: tr('تم إنشاء الطلب', 'Requisition created') });
      setCreateOpen(false);
      setNewReq({ title: '', departmentId: '', jobTitleId: '', positionId: '', headcount: 1, headcountRequested: 1, reason: 'new_role', description: '' });
      queryClient.invalidateQueries({ queryKey: cvisionKeys.recruitment.requisitions.all });
    },
    onError: (error: any) => { toast({ title: tr('خطأ', 'Error'), description: error.message, variant: 'destructive' }); },
  });

  function openRequisitionAction(requisitionId: string) { openRequisitionMutation.mutate(requisitionId); }
  function handleCreate() { createRequisitionMutation.mutate(); }
  const creating = createRequisitionMutation.isPending;

  function getStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'muted' {
    switch (status) {
      case 'approved': case 'open': return 'success';
      case 'rejected': case 'closed': return 'danger';
      case 'pending_approval': return 'warning';
      default: return 'muted';
    }
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'approved': case 'open': return <CheckCircle size={14} color={C.green} />;
      case 'rejected': case 'closed': return <XCircle size={14} color={C.red} />;
      default: return <Clock size={14} color={C.blue} />;
    }
  }

  if (loading) {
    return (<CVisionPageLayout><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={200} /><CVisionSkeletonCard C={C} height={400} /></CVisionPageLayout>);
  }

  return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{tr('طلبات التوظيف', 'Job Requisitions')}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>{tr('إدارة طلبات التوظيف', 'Manage hiring requisitions')}</div>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={() => setCreateOpen(true)} icon={<Plus size={14} />}>
          {tr('طلب جديد', 'New Requisition')}
        </CVisionButton>
      </div>

      {/* Create Dialog */}
      <CVisionDialog C={C} open={createOpen} onClose={() => setCreateOpen(false)} title={tr('إنشاء طلب توظيف', 'Create Job Requisition')} isRTL={isRTL} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CVisionInput C={C} label={tr('العنوان *', 'Title *')} placeholder="e.g., Senior Software Engineer" value={newReq.title} onChange={(e) => setNewReq({ ...newReq, title: e.target.value })} />
          <CVisionSelect C={C} label={tr('القسم *', 'Department *')} options={departments.map(d => ({ value: d.id, label: d.name }))} value={newReq.departmentId} onChange={(val) => setNewReq({ ...newReq, departmentId: val, jobTitleId: '', positionId: '' })} placeholder={tr('اختر القسم', 'Select department')} />
          <CVisionSelect C={C} label={tr('المسمى الوظيفي *', 'Job Title *')} options={jobTitles.filter(jt => !jt.departmentId || jt.departmentId === newReq.departmentId).map(jt => ({ value: jt.id, label: jt.name }))} value={newReq.jobTitleId} onChange={(val) => setNewReq({ ...newReq, jobTitleId: val, positionId: '' })} disabled={!newReq.departmentId} placeholder={!newReq.departmentId ? tr('اختر القسم أولاً', 'Select department first') : tr('اختر المسمى', 'Select job title')} />
          {newReq.departmentId && newReq.jobTitleId && (
            <CVisionSelect C={C} label={tr('الوظيفة', 'Position')} options={positions.map(pos => ({ value: pos.id, label: `${pos.positionCode} ${pos.title ? `- ${pos.title}` : ''} (${pos.availableSlots} ${tr('متاح', 'available')})` }))} value={newReq.positionId} onChange={(val) => setNewReq({ ...newReq, positionId: val })} disabled={loadingPositions} placeholder={loadingPositions ? tr('جاري التحميل...', 'Loading...') : tr('اختر الوظيفة', 'Select position')} />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <CVisionInput C={C} label={tr('العدد المطلوب *', 'Headcount *')} type="number" value={String(newReq.headcountRequested)} onChange={(e) => { const val = parseInt(e.target.value) || 1; setNewReq({ ...newReq, headcount: val, headcountRequested: val }); }} />
            <CVisionSelect C={C} label={tr('السبب', 'Reason')} options={REQUISITION_REASONS.map(r => ({ value: r, label: (REQUISITION_REASON_LABELS[r] || r) as string }))} value={newReq.reason} onChange={(val) => setNewReq({ ...newReq, reason: val })} />
          </div>
          <CVisionTextarea C={C} label={tr('الوصف', 'Description')} placeholder={tr('وصف الوظيفة...', 'Job description...')} value={newReq.description} onChange={(e) => setNewReq({ ...newReq, description: e.target.value })} rows={3} />
          <CVisionButton C={C} isDark={isDark} onClick={handleCreate} disabled={creating} loading={creating} style={{ width: '100%' }}>
            {tr('إنشاء الطلب', 'Create Requisition')}
          </CVisionButton>
        </div>
      </CVisionDialog>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody>
          <CVisionSelect C={C} options={[{ value: 'all', label: tr('جميع الحالات', 'All statuses') }, ...Object.entries(REQUISITION_STATUS_LABELS).map(([value, label]) => ({ value, label: label as string }))]} value={statusFilter || 'all'} onChange={(val) => setStatusFilter(val === 'all' ? '' : val)} style={{ maxWidth: 200 }} />
        </CVisionCardBody>
      </CVisionCard>

      {/* Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Briefcase size={16} color={C.gold} />
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr(`طلبات التوظيف (${requisitions.length})`, `Requisitions (${requisitions.length})`)}</span>
            </div>
            {isDev && seedCandidateId && (
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => router.push(`/cvision/recruitment/candidates/${seedCandidateId}`)} icon={<Eye size={12} />}>
                {tr('فتح المرشح التجريبي', 'Open Seed Candidate')}
              </CVisionButton>
            )}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('رقم الطلب', 'Requisition #')}</CVisionTh>
              <CVisionTh C={C}>{tr('العنوان', 'Title')}</CVisionTh>
              <CVisionTh C={C}>{tr('السبب', 'Reason')}</CVisionTh>
              <CVisionTh C={C}>{tr('العدد', 'Headcount')}</CVisionTh>
              <CVisionTh C={C}>{tr('الشواغر', 'Slots')}</CVisionTh>
              <CVisionTh C={C}>{tr('المرشحون', 'Candidates')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C}>{tr('التاريخ', 'Created')}</CVisionTh>
              <CVisionTh C={C}>{tr('الإجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {requisitions.length === 0 ? (
                <CVisionTr C={C}><CVisionTd style={{ textAlign: 'center', color: C.textMuted, fontSize: 13 }}>{tr('لا توجد طلبات', 'No requisitions found.')}</CVisionTd></CVisionTr>
              ) : (
                requisitions.map((req) => (
                  <CVisionTr key={req.id} C={C}>
                    <CVisionTd style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{req.requisitionNumber}</CVisionTd>
                    <CVisionTd style={{ fontWeight: 500, color: C.text }}>{req.title}</CVisionTd>
                    <CVisionTd>{req.reason ? <CVisionBadge C={C} variant="muted">{REQUISITION_REASON_LABELS[req.reason] || req.reason}</CVisionBadge> : <span style={{ color: C.textMuted }}>-</span>}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{req.headcountRequested || req.headcount || '-'}</CVisionTd>
                    <CVisionTd>
                      {req.slots ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontWeight: 500, color: C.text }}>{req.slots.filled}</span>
                          <span style={{ color: C.textMuted }}>/</span>
                          <span style={{ color: C.text }}>{req.slots.total}</span>
                          {req.slots.vacant > 0 && <CVisionBadge C={C} variant="warning">{req.slots.vacant} {tr('متاح', 'vacant')}</CVisionBadge>}
                        </div>
                      ) : <span style={{ color: C.textMuted }}>-</span>}
                    </CVisionTd>
                    <CVisionTd><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} color={C.textMuted} /><span style={{ color: C.text }}>{req.applicantCount || 0}</span></div></CVisionTd>
                    <CVisionTd><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{getStatusIcon(req.status)}<CVisionBadge C={C} variant={getStatusVariant(req.status)}>{REQUISITION_STATUS_LABELS[req.status] || req.status}</CVisionBadge></div></CVisionTd>
                    <CVisionTd style={{ color: C.textSecondary, fontSize: 12 }}>{new Date(req.createdAt).toLocaleDateString()}</CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {req.status === 'draft' && (
                          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => { if (!req.positionId) { toast({ title: tr('مطلوب', 'Required'), description: tr('اختر وظيفة', 'Select position'), variant: 'destructive' }); return; } openRequisitionAction(req.id); }} disabled={!req.positionId} icon={<CheckCircle size={12} />}>
                            {tr('فتح', 'Open')}
                          </CVisionButton>
                        )}
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => router.push(`/cvision/recruitment/requisitions/${req.id}`)} icon={<Eye size={12} />}>{tr('التفاصيل', 'Details')}</CVisionButton>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => router.push(`/cvision/recruitment/requisitions/${req.id}/candidates`)} icon={<Users size={12} />}>{tr('المرشحون', 'Candidates')} ({req.applicantCount || 0})</CVisionButton>
                      </div>
                    </CVisionTd>
                  </CVisionTr>
                ))
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
