'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea, CVisionLabel, CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Plus, ArrowLeft, CheckCircle, XCircle, Clock } from 'lucide-react';
import {
  CANDIDATE_STATUS_LABELS, CANDIDATE_SOURCE_LABELS,
  CANDIDATE_SOURCES, CANDIDATE_STATUS_TRANSITIONS,
} from '@/lib/cvision/constants';

interface Candidate {
  id: string; fullName: string; email?: string; phone?: string;
  source: string; status: string; screeningScore?: number;
  requisitionId: string; createdAt: string;
}
interface Requisition { status?: string; id: string; requisitionNumber: string; title: string; }

export default function CandidatesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requisitionId = searchParams.get('requisitionId');
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newCandidate, setNewCandidate] = useState({ fullName: '', email: '', phone: '', source: 'portal', notes: '' });

  const { data: requisition = null } = useQuery({
    queryKey: cvisionKeys.recruitment.requisitions.detail(requisitionId || ''),
    queryFn: async () => {
      const data = await cvisionFetch<any>(`/api/cvision/recruitment/requisitions/${requisitionId}`);
      return data.success ? data.requisition : null;
    },
    enabled: !!requisitionId,
  });

  const { data: candidates = [], isLoading: loading } = useQuery({
    queryKey: cvisionKeys.recruitment.candidates.list({ requisitionId, status: statusFilter }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (requisitionId) params.requisitionId = requisitionId;
      if (statusFilter) params.status = statusFilter;
      const data = await cvisionFetch<any>('/api/cvision/recruitment/candidates', { params });
      return data.data?.items || data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!newCandidate.fullName || !requisitionId) throw new Error(tr('الاسم مطلوب', 'Name is required'));
      return cvisionMutate<any>('/api/cvision/recruitment/candidates', 'POST', { ...newCandidate, requisitionId });
    },
    onSuccess: () => {
      toast({ title: tr('تم', 'Success'), description: tr('تمت إضافة المرشح', 'Candidate added') });
      setCreateOpen(false); setNewCandidate({ fullName: '', email: '', phone: '', source: 'portal', notes: '' });
      queryClient.invalidateQueries({ queryKey: cvisionKeys.recruitment.candidates.all });
    },
    onError: (error: any) => { toast({ title: tr('خطأ', 'Error'), description: error.message, variant: 'destructive' }); },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ candidateId, newStatus }: { candidateId: string; newStatus: string }) => {
      return cvisionMutate<any>(`/api/cvision/recruitment/candidates/${candidateId}`, 'PUT', { status: newStatus });
    },
    onSuccess: () => {
      toast({ title: tr('تم', 'Success'), description: tr('تم تحديث الحالة', 'Status updated') });
      queryClient.invalidateQueries({ queryKey: cvisionKeys.recruitment.candidates.all });
    },
    onError: (error: any) => { toast({ title: tr('خطأ', 'Error'), description: error.message, variant: 'destructive' }); },
  });

  function handleCreate() { createMutation.mutate(); }
  function handleStatusChange(candidateId: string, newStatus: string) { statusMutation.mutate({ candidateId, newStatus }); }
  const creating = createMutation.isPending;

  function getStatusVariant(status: string): 'success' | 'danger' | 'info' | 'warning' | 'purple' | 'muted' {
    switch (status) {
      case 'hired': return 'success';
      case 'rejected': return 'danger';
      case 'offer': return 'purple';
      case 'interview': return 'warning';
      case 'shortlisted': return 'info';
      case 'screened': return 'info';
      default: return 'muted';
    }
  }

  function getNextStatuses(currentStatus: string): string[] {
    return CANDIDATE_STATUS_TRANSITIONS[currentStatus] || [];
  }

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={200} />
        <CVisionSkeletonCard C={C} height={400} />
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <CVisionButton C={C} isDark={isDark} variant="ghost" onClick={() => router.push('/cvision/recruitment/requisitions')} icon={<ArrowLeft size={14} />}>
          {tr('رجوع', 'Back')}
        </CVisionButton>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{tr('المرشحون', 'Candidates')}</div>
          {requisition && (
            <div style={{ fontSize: 12, color: C.textMuted }}>{requisition.requisitionNumber} - {requisition.title}</div>
          )}
        </div>
        {requisitionId && requisition?.status === 'open' && (
          <CVisionButton C={C} isDark={isDark} onClick={() => setCreateOpen(true)} icon={<Plus size={14} />}>
            {tr('إضافة مرشح', 'Add Candidate')}
          </CVisionButton>
        )}
      </div>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody>
          <CVisionSelect C={C}
            options={[
              { value: 'all', label: tr('جميع الحالات', 'All statuses') },
              ...Object.entries(CANDIDATE_STATUS_LABELS).map(([value, label]) => ({ value, label: label as string })),
            ]}
            value={statusFilter || 'all'}
            onChange={(val) => setStatusFilter(val === 'all' ? '' : val)}
            style={{ maxWidth: 200 }}
          />
        </CVisionCardBody>
      </CVisionCard>

      {/* Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={16} color={C.gold} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
              {tr(`المرشحون (${candidates.length})`, `Candidates (${candidates.length})`)}
            </span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('الاسم', 'Name')}</CVisionTh>
              <CVisionTh C={C}>{tr('البريد', 'Email')}</CVisionTh>
              <CVisionTh C={C}>{tr('الهاتف', 'Phone')}</CVisionTh>
              <CVisionTh C={C}>{tr('المصدر', 'Source')}</CVisionTh>
              <CVisionTh C={C}>{tr('النتيجة', 'Score')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C}>{tr('التقديم', 'Applied')}</CVisionTh>
              <CVisionTh C={C}>{tr('الإجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {candidates.length === 0 ? (
                <CVisionTr C={C}>
                  <CVisionTd style={{ textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
                    {tr('لا يوجد مرشحون. أضف واحداً للبدء.', 'No candidates found. Add one to get started.')}
                  </CVisionTd>
                </CVisionTr>
              ) : (
                candidates.map((candidate) => (
                  <CVisionTr key={candidate.id} C={C}>
                    <CVisionTd style={{ fontWeight: 500, color: C.text }}>{candidate.fullName}</CVisionTd>
                    <CVisionTd style={{ color: C.textSecondary }}>{candidate.email || '-'}</CVisionTd>
                    <CVisionTd style={{ color: C.textSecondary }}>{candidate.phone || '-'}</CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant="muted">{CANDIDATE_SOURCE_LABELS[candidate.source] || candidate.source}</CVisionBadge>
                    </CVisionTd>
                    <CVisionTd>
                      {candidate.screeningScore !== undefined ? (
                        <span style={{ color: candidate.screeningScore >= 70 ? C.green : C.orange, fontWeight: 600, fontSize: 13 }}>
                          {candidate.screeningScore}%
                        </span>
                      ) : <span style={{ color: C.textMuted }}>-</span>}
                    </CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {candidate.status === 'hired' ? <CheckCircle size={14} color={C.green} /> :
                          candidate.status === 'rejected' ? <XCircle size={14} color={C.red} /> :
                            <Clock size={14} color={C.blue} />}
                        <CVisionBadge C={C} variant={getStatusVariant(candidate.status)}>
                          {CANDIDATE_STATUS_LABELS[candidate.status] || candidate.status}
                        </CVisionBadge>
                      </div>
                    </CVisionTd>
                    <CVisionTd style={{ color: C.textSecondary, fontSize: 12 }}>
                      {new Date(candidate.createdAt).toLocaleDateString()}
                    </CVisionTd>
                    <CVisionTd>
                      {getNextStatuses(candidate.status).length > 0 && (
                        <CVisionSelect C={C}
                          options={getNextStatuses(candidate.status).map(s => ({ value: s, label: (CANDIDATE_STATUS_LABELS[s] || s) as string }))}
                          onChange={(val) => handleStatusChange(candidate.id, val)}
                          placeholder={tr('نقل إلى...', 'Move to...')}
                          style={{ minWidth: 130 }}
                        />
                      )}
                    </CVisionTd>
                  </CVisionTr>
                ))
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* Create Dialog */}
      <CVisionDialog C={C} open={createOpen} onClose={() => setCreateOpen(false)}
        title={tr('إضافة مرشح', 'Add Candidate')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CVisionInput C={C} label={tr('الاسم الكامل *', 'Full Name *')} placeholder="John Doe"
            value={newCandidate.fullName} onChange={(e) => setNewCandidate({ ...newCandidate, fullName: e.target.value })} />
          <CVisionInput C={C} label={tr('البريد الإلكتروني', 'Email')} type="email" placeholder="john@example.com"
            value={newCandidate.email} onChange={(e) => setNewCandidate({ ...newCandidate, email: e.target.value })} />
          <CVisionInput C={C} label={tr('الهاتف', 'Phone')} placeholder="+1 234 567 8900"
            value={newCandidate.phone} onChange={(e) => setNewCandidate({ ...newCandidate, phone: e.target.value })} />
          <CVisionSelect C={C} label={tr('المصدر', 'Source')}
            options={CANDIDATE_SOURCES.map(source => ({ value: source, label: (CANDIDATE_SOURCE_LABELS[source] || source) as string }))}
            value={newCandidate.source} onChange={(val) => setNewCandidate({ ...newCandidate, source: val })} />
          <CVisionTextarea C={C} label={tr('ملاحظات', 'Notes')} placeholder={tr('ملاحظات أولية...', 'Initial notes...')}
            value={newCandidate.notes} onChange={(e) => setNewCandidate({ ...newCandidate, notes: e.target.value })} rows={3} />
          <CVisionButton C={C} isDark={isDark} onClick={handleCreate} disabled={creating} loading={creating} style={{ width: '100%' }}>
            {tr('إضافة مرشح', 'Add Candidate')}
          </CVisionButton>
        </div>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
