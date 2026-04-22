'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionLabel, CVisionPageHeader, CVisionPageLayout,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Upload, FileText, Play, Lightbulb, CheckCircle2, XCircle,
  Clock, CheckSquare, Loader2,
} from 'lucide-react';
import { DebugBanner } from '@/components/cvision/DebugBanner';

interface CvInboxBatch {
  id: string; createdByUserId: string; itemCount: number; parsedCount: number;
  suggestedCount: number; assignedCount: number; createdAt: string;
}
interface CvInboxItem {
  id: string; fileName: string; parseError?: string | null;
  status: 'UPLOADED' | 'PARSED' | 'SUGGESTED' | 'ASSIGNED' | 'REJECTED';
  extractedRawText?: string | null;
  suggestedRequisitionIdsJson?: string[] | null;
  suggestedScoresJson?: Record<string, number> | null;
  assignedRequisitionId?: string | null;
  assignedCandidateId?: string | null;
}
interface Requisition { id: string; requisitionNumber: string; title: string; departmentId: string; }

export default function CvInboxBatchPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const batchId = params.id as string;

  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);

  const { data: batchData, isLoading: loading, refetch: refetchBatch } = useQuery({
    queryKey: cvisionKeys.recruitment.batches.detail(batchId),
    queryFn: () => cvisionFetch<any>(`/api/cvision/recruitment/cv-inbox/batches/${batchId}`),
    enabled: !!batchId,
  });
  const batch = batchData?.success ? batchData.batch : null;
  const items = batchData?.items || [];

  const { data: requisitions = [] } = useQuery({
    queryKey: cvisionKeys.recruitment.requisitions.list({ status: 'OPEN', limit: 100 }),
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/recruitment/requisitions', { params: { status: 'OPEN', limit: 100 } });
      return data.success ? (data.data?.items || data.data || []) : [];
    },
  });

  async function handleUpload() {
    if (!files || files.length === 0) { toast({ title: tr('خطأ', 'Error'), description: tr('يرجى اختيار ملفات', 'Please select files'), variant: 'destructive' }); return; }
    try {
      setUploading(true);
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      const res = await fetch(`/api/cvision/recruitment/cv-inbox/batches/${batchId}/upload`, { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (data.success) { toast({ title: tr('تم', 'Success'), description: tr(`تم رفع ${data.createdCount} ملف(ات) بنجاح`, `${data.createdCount} file(s) uploaded successfully`) }); setFiles(null); refetchBatch(); }
      else { toast({ title: tr('خطأ', 'Error'), description: data.error || tr('فشل رفع الملفات', 'Failed to upload files'), variant: 'destructive' }); }
    } catch { toast({ title: tr('خطأ', 'Error'), description: tr('فشل رفع الملفات', 'Failed to upload files'), variant: 'destructive' }); }
    finally { setUploading(false); }
  }

  const parseMutation = useMutation({
    mutationFn: () => cvisionMutate<any>(`/api/cvision/recruitment/cv-inbox/batches/${batchId}/parse`, 'POST'),
    onSuccess: (data) => { toast({ title: tr('تم', 'Success'), description: tr(`تم تحليل ${data.parsed} بنجاح`, `${data.parsed} parsed successfully${data.failed > 0 ? `, ${data.failed} failed` : ''}`) }); refetchBatch(); },
    onError: () => { toast({ title: tr('خطأ', 'Error'), description: tr('فشل التحليل', 'Failed to parse'), variant: 'destructive' }); },
  });

  const suggestMutation = useMutation({
    mutationFn: () => cvisionMutate<any>(`/api/cvision/recruitment/cv-inbox/batches/${batchId}/suggest`, 'POST'),
    onSuccess: (data) => { toast({ title: tr('تم', 'Success'), description: tr(`تم إنشاء اقتراحات لـ ${data.suggestedCount} عنصر`, `Suggestions generated for ${data.suggestedCount} items`) }); refetchBatch(); },
    onError: () => { toast({ title: tr('خطأ', 'Error'), description: tr('فشل إنشاء الاقتراحات', 'Failed to generate suggestions'), variant: 'destructive' }); },
  });

  const assignItemMutation = useMutation({
    mutationFn: ({ itemId, requisitionId }: { itemId: string; requisitionId: string }) =>
      cvisionMutate<any>(`/api/cvision/recruitment/cv-inbox/items/${itemId}/assign`, 'POST', { requisitionId }),
    onSuccess: () => { toast({ title: tr('تم', 'Success'), description: tr('تم تعيين السيرة بنجاح', 'CV assigned successfully') }); refetchBatch(); },
    onError: () => { toast({ title: tr('خطأ', 'Error'), description: tr('فشل تعيين السيرة', 'Failed to assign CV'), variant: 'destructive' }); },
  });

  const assignAllMutation = useMutation({
    mutationFn: () => cvisionMutate<any>(`/api/cvision/recruitment/cv-inbox/batches/${batchId}/assign-all`, 'POST'),
    onSuccess: (data) => { toast({ title: tr('تم', 'Success'), description: tr(`تم تعيين ${data.assignedCount} سيرة ذاتية`, `${data.assignedCount} CV(s) assigned successfully`) }); refetchBatch(); },
    onError: () => { toast({ title: tr('خطأ', 'Error'), description: tr('فشل تعيين الكل', 'Failed to assign all'), variant: 'destructive' }); },
  });

  function handleParse() { parseMutation.mutate(); }
  function handleSuggest() { suggestMutation.mutate(); }
  function handleAssignItem(itemId: string, requisitionId: string) { assignItemMutation.mutate({ itemId, requisitionId }); }
  function handleAssignAll() { assignAllMutation.mutate(); }
  const parsing = parseMutation.isPending;
  const suggesting = suggestMutation.isPending;
  const assigning = assignAllMutation.isPending;

  function getRequisitionTitle(requisitionId: string): string {
    const req = requisitions.find(r => r.id === requisitionId);
    return req ? `${req.requisitionNumber}: ${req.title}` : requisitionId;
  }

  function getStatusVariant(item: CvInboxItem): 'success' | 'danger' | 'warning' | 'info' | 'muted' {
    if (item.status === 'ASSIGNED') return 'success';
    if (item.status === 'SUGGESTED') return 'info';
    if (item.parseError) return 'danger';
    return 'muted';
  }

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={200} />
        <CVisionSkeletonCard C={C} height={300} />
      </CVisionPageLayout>
    );
  }

  if (!batch) {
    return (
      <CVisionPageLayout>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: '48px 20px', textAlign: 'center' }}>
            <span style={{ color: C.textMuted, fontSize: 13 }}>{tr('الدفعة غير موجودة', 'Batch not found')}</span>
          </CVisionCardBody>
        </CVisionCard>
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <DebugBanner />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => router.back()} icon={<ArrowLeft size={14} />}>
            {tr('رجوع', 'Back')}
          </CVisionButton>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{tr('دفعة صندوق السير الذاتية', 'CV Inbox Batch')}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{tr('تم الإنشاء', 'Created')} {new Date(batch.createdAt).toLocaleString()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <CVisionBadge C={C}>{batch.itemCount} {tr('إجمالي', 'total')}</CVisionBadge>
          <CVisionBadge C={C} variant={batch.parsedCount > 0 ? 'success' : 'muted'}>{batch.parsedCount} {tr('محلل', 'parsed')}</CVisionBadge>
          <CVisionBadge C={C} variant={batch.suggestedCount > 0 ? 'info' : 'muted'}>{batch.suggestedCount} {tr('مقترح', 'suggested')}</CVisionBadge>
          <CVisionBadge C={C} variant={batch.assignedCount > 0 ? 'success' : 'muted'}>{batch.assignedCount} {tr('معين', 'assigned')}</CVisionBadge>
        </div>
      </div>

      {/* Upload Section */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={16} color={C.gold} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('رفع ملفات السيرة الذاتية', 'Upload CV Files')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <CVisionLabel C={C}>{tr('اختر ملفات (PDF, DOC, DOCX) - يمكن رفع عدة ملفات', 'Select CV Files (PDF, DOC, DOCX) - Multiple files allowed')}</CVisionLabel>
              <input type="file" multiple accept=".pdf,.doc,.docx" onChange={(e) => setFiles(e.target.files)}
                style={{ marginTop: 6, fontSize: 13, color: C.text }} />
              {files && (
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  {tr(`تم اختيار: ${files.length} ملف(ات)`, `Selected: ${files.length} file(s)`)}
                </div>
              )}
            </div>
            <CVisionButton C={C} isDark={isDark} onClick={handleUpload} disabled={!files || files.length === 0 || uploading}
              loading={uploading} icon={<Upload size={14} />}>
              {uploading ? tr('جاري الرفع...', 'Uploading...') : tr('رفع الملفات', 'Upload Files')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Actions */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('إجراءات الدفعة', 'Batch Actions')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleParse}
              disabled={parsing || items.filter(i => i.status === 'UPLOADED' || (i.status === 'PARSED' && i.parseError)).length === 0}
              loading={parsing} icon={<Play size={14} />}>
              {tr('تحليل الكل', 'Parse All')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={handleSuggest}
              disabled={suggesting || items.filter(i => i.status === 'PARSED' && !i.parseError).length === 0}
              loading={suggesting} icon={<Lightbulb size={14} />}>
              {tr('اقتراح الكل', 'Suggest All')}
            </CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleAssignAll}
              disabled={assigning || items.filter(i => (i.status === 'SUGGESTED' || i.status === 'PARSED') && i.assignedRequisitionId && !i.assignedCandidateId).length === 0}
              loading={assigning} icon={<CheckSquare size={14} />}>
              {tr('تعيين الكل', 'Assign All')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Summary */}
      {items.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('الملخص', 'Summary')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 16, textAlign: 'center' }}>
              {[
                { label: tr('الإجمالي', 'Total'), value: items.length, color: C.text },
                { label: tr('محلل', 'Parsed'), value: items.filter(i => i.status === 'PARSED' && !i.parseError).length, color: C.green },
                { label: tr('مقترح', 'Suggested'), value: items.filter(i => i.status === 'SUGGESTED').length, color: C.orange },
                { label: tr('معين', 'Assigned'), value: items.filter(i => i.status === 'ASSIGNED').length, color: C.blue },
                { label: tr('فشل', 'Failed'), value: items.filter(i => i.parseError).length, color: C.red },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Items Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr(`عناصر السير (${items.length})`, `CV Items (${items.length})`)}</span>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, fontSize: 13 }}>
              {tr('لم يتم رفع سير ذاتية بعد. ارفع ملفات أعلاه للبدء.', 'No CVs uploaded yet. Upload files above to get started.')}
            </div>
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('اسم الملف', 'File Name')}</CVisionTh>
                <CVisionTh C={C}>{tr('حالة التحليل', 'Parse Status')}</CVisionTh>
                <CVisionTh C={C}>{tr('أفضل اقتراح', 'Top Suggestion')}</CVisionTh>
                <CVisionTh C={C}>{tr('الطلب المعين', 'Assigned Requisition')}</CVisionTh>
                <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                <CVisionTh C={C}>{tr('الإجراء', 'Action')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {items.map((item) => (
                  <CVisionTr key={item.id} C={C}>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, color: C.text, fontSize: 13 }}>
                        <FileText size={14} color={C.textMuted} /> {item.fileName}
                      </div>
                    </CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.status === 'PARSED' && !item.parseError ? <CheckCircle2 size={14} color={C.green} /> :
                          item.parseError ? <XCircle size={14} color={C.red} /> : <Clock size={14} color={C.textMuted} />}
                        <span style={{ fontSize: 12, color: C.textSecondary }}>
                          {item.parseError ? 'PARSE_FAILED' : item.status === 'PARSED' ? 'PARSED' : item.status}
                        </span>
                      </div>
                      {item.parseError && (
                        <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>{item.parseError.length > 50 ? item.parseError.substring(0, 50) + '...' : item.parseError}</div>
                      )}
                      {item.status === 'PARSED' && !item.parseError && item.extractedRawText && (
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.extractedRawText.length} {tr('حرف مستخرج', 'chars extracted')}</div>
                      )}
                    </CVisionTd>
                    <CVisionTd>
                      {item.suggestedRequisitionIdsJson && item.suggestedRequisitionIdsJson.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {item.suggestedRequisitionIdsJson.slice(0, 3).map((reqId, idx) => (
                            <CVisionBadge key={reqId} C={C} variant="muted">
                              {idx + 1}. {getRequisitionTitle(reqId)}
                              {item.suggestedScoresJson?.[reqId] && ` (${item.suggestedScoresJson[reqId].toFixed(1)}%)`}
                            </CVisionBadge>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: C.textMuted, fontSize: 12 }}>-</span>
                      )}
                    </CVisionTd>
                    <CVisionTd>
                      {item.assignedRequisitionId ? (
                        <CVisionBadge C={C}>{getRequisitionTitle(item.assignedRequisitionId)}</CVisionBadge>
                      ) : item.suggestedRequisitionIdsJson && item.suggestedRequisitionIdsJson.length > 0 ? (
                        <CVisionSelect C={C}
                          options={[
                            ...item.suggestedRequisitionIdsJson.map(reqId => ({ value: reqId, label: getRequisitionTitle(reqId) })),
                            ...requisitions.filter(req => !item.suggestedRequisitionIdsJson?.includes(req.id)).map(req => ({ value: req.id, label: `${req.requisitionNumber}: ${req.title}` })),
                          ]}
                          value={item.suggestedRequisitionIdsJson[0]}
                          onChange={(value) => {
                            refetchBatch();
                            handleAssignItem(item.id, value);
                          }}
                          placeholder={tr('اختر الطلب', 'Select requisition')}
                          style={{ minWidth: 200 }}
                        />
                      ) : (
                        <span style={{ color: C.textMuted, fontSize: 12 }}>{tr('غير معين', 'Unassigned')}</span>
                      )}
                    </CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant={getStatusVariant(item)}>
                        {item.parseError ? 'PARSE_FAILED' : item.status}
                      </CVisionBadge>
                    </CVisionTd>
                    <CVisionTd>
                      {item.assignedCandidateId ? (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm"
                          onClick={() => router.push(`/cvision/recruitment/candidates/${item.assignedCandidateId}`)}>
                          {tr('عرض المرشح', 'View Candidate')}
                        </CVisionButton>
                      ) : item.assignedRequisitionId && item.status !== 'ASSIGNED' && !item.parseError ? (
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm"
                          onClick={() => handleAssignItem(item.id, item.assignedRequisitionId!)}>
                          {tr('تعيين', 'Assign')}
                        </CVisionButton>
                      ) : item.parseError ? (
                        <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={handleParse}>
                          {tr('إعادة التحليل', 'Re-Parse')}
                        </CVisionButton>
                      ) : null}
                    </CVisionTd>
                  </CVisionTr>
                ))}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
