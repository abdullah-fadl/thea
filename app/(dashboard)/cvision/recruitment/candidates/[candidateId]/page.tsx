'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionLabel, CVisionPageLayout, CVisionSelect,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Upload, FileText, CheckCircle2, XCircle, Clock, Play, UserPlus,
} from 'lucide-react';
import { DebugBanner } from '@/components/cvision/DebugBanner';

interface Candidate {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  source: string;
  createdAt: string;
  employeeId?: string | null;
  requisitionId?: string | null;
}

interface PositionSlot {
  slotId: string;
  status: string;
  employeeId?: string | null;
  employee?: { id: string; employeeNo: string; fullName: string; } | null;
  candidateId?: string | null;
  createdAt: string;
  filledAt?: string | null;
  frozenAt?: string | null;
  notes?: string | null;
}

interface Grade {
  id: string;
  code: string;
  name: string;
  jobTitleId?: string | null;
}

interface CandidateDocument {
  id: string;
  fileName: string;
  kind: string;
  createdAt: string;
  storageKey: string;
}

interface CvParseJob {
  id: string;
  status: 'QUEUED' | 'DONE' | 'FAILED';
  extractedRawText?: string | null;
  metaJson?: Record<string, any> | null;
  extractedJson?: Record<string, any> | null;
  extractedText?: string | null;
  errors?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface CandidateDetailResponse {
  success: boolean;
  candidate: Candidate;
  documents: CandidateDocument[];
  parseJobs: CvParseJob[];
  latestParseJob: CvParseJob | null;
}

export default function CandidateDetailPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const candidateId = params.candidateId as string;
  const [file, setFile] = useState<File | null>(null);
  const [hireDialogOpen, setHireDialogOpen] = useState(false);
  const [hireForm, setHireForm] = useState({
    slotId: '',
    gradeId: '',
    startDate: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: candidateData, isLoading: loading, refetch: refetchCandidate } = useQuery({
    queryKey: cvisionKeys.recruitment.candidates.detail(candidateId),
    queryFn: () => cvisionFetch<CandidateDetailResponse>(`/api/cvision/recruitment/candidates/${candidateId}`),
    enabled: !!candidateId,
  });
  const candidate = candidateData?.success ? candidateData.candidate : null;
  const documents = candidateData?.documents || [];
  const latestParseJob = candidateData?.latestParseJob || null;

  const { data: userRole = null } = useQuery({
    queryKey: ['auth', 'me', 'role'],
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/auth/me');
      return data.user?.role || null;
    },
  });

  const { data: slots = [], isLoading: loadingSlots } = useQuery({
    queryKey: [...cvisionKeys.recruitment.requisitions.detail(candidate?.requisitionId || ''), 'slots'],
    queryFn: async () => {
      const data = await cvisionFetch<any>(`/api/cvision/recruitment/requisitions/${candidate!.requisitionId}/slots`);
      if (data.success) return (data.slots || []).filter((s: PositionSlot) => s.status === 'VACANT');
      return [];
    },
    enabled: hireDialogOpen && !!candidate?.requisitionId,
  });

  const { data: grades = [] } = useQuery({
    queryKey: cvisionKeys.grades.list({ slotId: hireForm.slotId, requisitionId: candidate?.requisitionId }),
    queryFn: async () => {
      if (!candidate?.requisitionId) return [];
      const reqData = await cvisionFetch<any>(`/api/cvision/recruitment/requisitions/${candidate.requisitionId}`);
      const requisition = reqData.requisition;
      if (requisition?.jobTitleId) {
        const data = await cvisionFetch<any>('/api/cvision/grades', { params: { jobTitleId: requisition.jobTitleId } });
        return data.items || data.data?.items || data.data || [];
      }
      return [];
    },
    enabled: !!hireForm.slotId && !!candidate?.requisitionId,
  });

  // ── Mutations ────────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(tr('يرجى اختيار ملف', 'Please select a file'));
      const formData = new FormData();
      formData.append('file', file);
      const extractRes = await fetch('/api/cvision/recruitment/extract-cv-text', { method: 'POST', credentials: 'include', body: formData });
      let extractedText = '';
      if (extractRes.ok) {
        const extractData = await extractRes.json();
        if (extractData.success && extractData.extractedText) extractedText = extractData.extractedText;
      } else {
        const errorData = await extractRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract text from CV file');
      }
      return cvisionMutate<any>(`/api/cvision/recruitment/candidates/${candidateId}/cv`, 'POST', { fileName: file.name, storageKey: null, mimeType: file.type, fileSize: file.size, extractedText: extractedText.substring(0, 100000) });
    },
    onSuccess: () => {
      toast({ title: tr('تم', 'Success'), description: tr('تم رفع السيرة الذاتية بنجاح', 'CV uploaded successfully') });
      setFile(null);
      refetchCandidate();
    },
    onError: (error: any) => { toast({ title: tr('خطأ', 'Error'), description: error.message || tr('فشل رفع السيرة الذاتية', 'Failed to upload CV'), variant: 'destructive' }); },
  });

  const parseMutation = useMutation({
    mutationFn: async () => {
      if (!latestParseJob) throw new Error(tr('لا يوجد مهمة تحليل', 'No parse job found'));
      return cvisionMutate<any>(`/api/cvision/internal/cv-parse/${latestParseJob.id}/run`, 'POST');
    },
    onSuccess: () => {
      toast({ title: tr('تم', 'Success'), description: tr('تم تحليل السيرة الذاتية', 'Parse job completed') });
      refetchCandidate();
    },
    onError: (error: any) => { toast({ title: tr('خطأ', 'Error'), description: error.message || tr('فشل التحليل', 'Failed to run parse job'), variant: 'destructive' }); },
  });

  const hireMutation = useMutation({
    mutationFn: async () => {
      if (!hireForm.slotId) throw new Error(tr('شاغر الوظيفة مطلوب', 'Position slot is required'));
      return cvisionMutate<any>(`/api/cvision/recruitment/candidates/${candidateId}/hire`, 'POST', { slotId: hireForm.slotId, gradeId: hireForm.gradeId || null, startDate: hireForm.startDate ? new Date(hireForm.startDate).toISOString() : undefined });
    },
    onSuccess: (data) => {
      toast({ title: tr('تم', 'Success'), description: tr('تم توظيف المرشح بنجاح', 'Candidate hired successfully') });
      setHireDialogOpen(false);
      setHireForm({ slotId: '', gradeId: '', startDate: new Date().toISOString().split('T')[0] });
      if (data.employee?.id) { router.push(`/cvision/employees/${data.employee.id}`); }
      else { refetchCandidate(); }
    },
    onError: (error: any) => { toast({ title: tr('خطأ', 'Error'), description: error.message || tr('فشل توظيف المرشح', 'Failed to hire candidate'), variant: 'destructive' }); },
  });

  function handleFileUpload() { uploadMutation.mutate(); }
  function handleRunParse() { parseMutation.mutate(); }
  function handleHire() { hireMutation.mutate(); }
  const uploading = uploadMutation.isPending;
  const parsing = parseMutation.isPending;
  const hiring = hireMutation.isPending;

  function getStatusIcon(status: string) {
    switch (status) {
      case 'DONE': return <CheckCircle2 size={16} color={C.green} />;
      case 'FAILED': return <XCircle size={16} color={C.red} />;
      case 'QUEUED': return <Clock size={16} color={C.orange} />;
      default: return null;
    }
  }

  const canHire = userRole === 'hr_admin' || userRole === 'hr_manager' || userRole === 'owner' || userRole === 'cvision_admin';
  const isHired = candidate?.status === 'hired' || candidate?.employeeId;
  const hasVacantSlots = slots.length > 0;
  const canHireNow = canHire && !isHired && candidate?.requisitionId && hasVacantSlots;
  const latestCvDoc = documents.find((d) => d.kind === 'CV');

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={200} />
        <CVisionSkeletonCard C={C} height={400} />
      </CVisionPageLayout>
    );
  }

  if (!candidate) {
    return (
      <CVisionPageLayout>
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ color: C.textMuted }}>{tr('المرشح غير موجود', 'Candidate not found')}</p>
          </CVisionCardBody>
        </CVisionCard>
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <DebugBanner />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CVisionButton C={C} isDark={isDark} variant="ghost" onClick={() => router.back()} icon={<ArrowLeft size={14} />}>
            {tr('رجوع', 'Back')}
          </CVisionButton>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: C.text }}>{candidate.fullName}</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              {candidate.email} {candidate.phone ? `- ${candidate.phone}` : tr('- لا يوجد هاتف', '- No phone')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionBadge C={C} variant="info">{candidate.status}</CVisionBadge>
          {canHireNow && (
            <CVisionButton C={C} isDark={isDark} onClick={() => setHireDialogOpen(true)} icon={<UserPlus size={14} />}>
              {tr('توظيف المرشح', 'Hire Candidate')}
            </CVisionButton>
          )}
          {canHire && !isHired && !candidate.requisitionId && (
            <CVisionBadge C={C} variant="muted">{tr('لا يوجد طلب توظيف مرتبط', 'No requisition linked')}</CVisionBadge>
          )}
          {canHire && !isHired && candidate.requisitionId && !hasVacantSlots && (
            <CVisionBadge C={C} variant="warning">{tr('لا توجد شواغر متاحة', 'No vacant slots available')}</CVisionBadge>
          )}
          {isHired && candidate.employeeId && (
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => router.push(`/cvision/employees/${candidate.employeeId}`)}>
              {tr('عرض ملف الموظف', 'View Employee Profile')}
            </CVisionButton>
          )}
        </div>
      </div>

      {/* Hire Dialog */}
      <CVisionDialog C={C} open={hireDialogOpen} onClose={() => setHireDialogOpen(false)}
        title={tr('توظيف المرشح', 'Hire Candidate')} isRTL={isRTL} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
            {tr(`تحويل ${candidate?.fullName} إلى موظف وتعيين وظيفة.`, `Convert ${candidate?.fullName} to an employee and assign a position.`)}
          </div>
          {!candidate?.requisitionId ? (
            <div style={{ padding: 16, background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: 8 }}>
              <p style={{ fontSize: 13, color: C.text }}>
                {tr('هذا المرشح غير مرتبط بطلب توظيف. يرجى ربطه بطلب توظيف مفتوح أولاً.', 'This candidate is not linked to a requisition. Please link them to an OPEN requisition first.')}
              </p>
            </div>
          ) : (
            <>
              <CVisionSelect C={C} label={tr('شاغر الوظيفة *', 'Position Slot *')}
                options={slots.length === 0 ? [{ value: '', label: loadingSlots ? tr('جاري التحميل...', 'Loading...') : tr('لا توجد شواغر متاحة', 'No vacant slots available') }] : slots.map(slot => ({ value: slot.slotId, label: `${tr('شاغر', 'Slot')} ${slot.slotId.substring(0, 8)}... (${tr('متاح', 'Vacant')})` }))}
                value={hireForm.slotId}
                onChange={(val) => setHireForm({ ...hireForm, slotId: val })}
                disabled={loadingSlots}
                placeholder={loadingSlots ? tr('جاري تحميل الشواغر...', 'Loading slots...') : tr('اختر شاغراً', 'Select vacant slot')}
              />
              {slots.length === 0 && !loadingSlots && (
                <p style={{ fontSize: 12, color: C.textMuted }}>
                  {tr('لا توجد شواغر متاحة. افتح طلب التوظيف أو انتظر توفر شواغر.', 'No vacant slots available. Open the requisition or wait for slots to become available.')}
                </p>
              )}

              {hireForm.slotId && grades.length > 0 && (
                <CVisionSelect C={C} label={tr('الدرجة (اختياري)', 'Grade (optional)')}
                  options={[{ value: '__none__', label: tr('بدون', 'None') }, ...grades.map(g => ({ value: g.id, label: `${g.code} - ${g.name}` }))]}
                  value={hireForm.gradeId}
                  onChange={(val) => setHireForm({ ...hireForm, gradeId: val })}
                  placeholder={tr('اختر الدرجة (اختياري)', 'Select grade (optional)')}
                />
              )}

              <CVisionInput C={C} label={tr('تاريخ البدء (اختياري)', 'Start Date (optional)')} type="date"
                value={hireForm.startDate} onChange={(e) => setHireForm({ ...hireForm, startDate: e.target.value })} />
            </>
          )}
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="ghost" onClick={() => setHireDialogOpen(false)}>
            {tr('إلغاء', 'Cancel')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleHire} disabled={hiring || !hireForm.slotId || slots.length === 0} loading={hiring}>
            {tr('توظيف', 'Hire')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>

      {/* Upload CV Section */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={16} color={C.blue} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('رفع السيرة الذاتية', 'Upload CV')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CVisionLabel C={C}>{tr('اختر ملف السيرة الذاتية (PDF, DOC, DOCX)', 'Select CV File (PDF, DOC, DOCX)')}</CVisionLabel>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ fontSize: 13, color: C.text, padding: 8, border: `1px solid ${C.border}`, borderRadius: 6, background: C.bg, cursor: 'pointer' }}
            />
            {file && (
              <p style={{ fontSize: 13, color: C.textMuted }}>
                {tr('تم الاختيار:', 'Selected:')} {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
            <CVisionButton C={C} isDark={isDark} onClick={handleFileUpload} disabled={!file || uploading} loading={uploading}
              icon={<Upload size={14} />} style={{ width: '100%' }}>
              {uploading ? tr('جاري الرفع...', 'Uploading...') : tr('رفع السيرة الذاتية', 'Upload CV')}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* CV Document Section */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('مستندات السيرة الذاتية', 'CV Documents')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          {latestCvDoc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Document info */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileText size={20} color={C.textMuted} />
                  <div>
                    <div style={{ fontWeight: 500, color: C.text }}>{latestCvDoc.fileName}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      {tr('تم الرفع', 'Uploaded')} {new Date(latestCvDoc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Parse Job Status */}
              {latestParseJob ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {getStatusIcon(latestParseJob.status)}
                      <div>
                        <div style={{ fontWeight: 500, color: C.text }}>{tr('حالة التحليل:', 'Parse Status:')} {latestParseJob.status}</div>
                        {latestParseJob.startedAt && (
                          <div style={{ fontSize: 12, color: C.textMuted }}>
                            {tr('بدأ:', 'Started:')} {new Date(latestParseJob.startedAt).toLocaleString()}
                          </div>
                        )}
                        {latestParseJob.completedAt && (
                          <div style={{ fontSize: 12, color: C.textMuted }}>
                            {tr('اكتمل:', 'Completed:')} {new Date(latestParseJob.completedAt).toLocaleString()}
                          </div>
                        )}
                        {latestParseJob.errors && (
                          <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>
                            {tr('خطأ:', 'Error:')} {latestParseJob.errors}
                          </div>
                        )}
                      </div>
                    </div>
                    {latestParseJob.status === 'QUEUED' && (
                      <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={handleRunParse} disabled={parsing} loading={parsing}
                        icon={<Play size={14} />}>
                        {tr('تشغيل التحليل', 'Run Parse (dev)')}
                      </CVisionButton>
                    )}
                  </div>

                  {/* Raw Text Preview */}
                  {latestParseJob.status === 'DONE' && latestParseJob.extractedRawText && (
                    <div style={{ padding: 16, border: `1px solid ${C.border}`, borderRadius: 8, background: C.bgSubtle }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('معاينة النص الخام (المرحلة 1)', 'Raw Text Preview (Phase 1)')}</span>
                        <CVisionBadge C={C} variant="muted">
                          {latestParseJob.metaJson?.textLength || latestParseJob.extractedRawText.length} {tr('حرف', 'chars')}
                          {latestParseJob.metaJson?.pages && ` - ${latestParseJob.metaJson.pages} ${tr('صفحات', 'pages')}`}
                        </CVisionBadge>
                      </div>
                      <div style={{ fontSize: 12, color: C.blue, background: C.blueDim, padding: 8, borderRadius: 6, border: `1px solid ${C.blue}`, marginBottom: 12 }}>
                        <strong>{tr('ملاحظة:', 'Note:')}</strong> {tr('سيتم تفعيل الاستخراج الدلالي في المرحلة 3 (مرحلة الذكاء الاصطناعي). حالياً يتم عرض النص الخام فقط.', 'Semantic extraction will be enabled in Phase 3 (AI stage). Currently showing raw extracted text only.')}
                      </div>
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, background: C.bgCard, maxHeight: 384, overflow: 'auto' }}>
                        <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: C.text, margin: 0 }}>
                          {latestParseJob.extractedRawText.substring(0, 500)}
                          {latestParseJob.extractedRawText.length > 500 && (
                            <span style={{ color: C.textMuted }}>
                              {'\n\n... (' + (latestParseJob.extractedRawText.length - 500) + ` ${tr('حرف إضافي', 'more characters')})`}
                            </span>
                          )}
                        </pre>
                      </div>
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer', fontSize: 12, color: C.textMuted }}>
                          {tr(`عرض النص الكامل (${latestParseJob.extractedRawText.length} حرف)`, `Show full text (${latestParseJob.extractedRawText.length} characters)`)}
                        </summary>
                        <div style={{ marginTop: 8, padding: 12, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, maxHeight: 384, overflow: 'auto' }}>
                          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: C.text, margin: 0 }}>
                            {latestParseJob.extractedRawText}
                          </pre>
                        </div>
                      </details>
                      {latestParseJob.metaJson && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: 'pointer', fontSize: 12, color: C.textMuted }}>
                            {tr('عرض البيانات الوصفية', 'View Metadata')}
                          </summary>
                          <pre style={{ marginTop: 8, fontSize: 12, overflow: 'auto', background: C.bgCard, padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, color: C.text }}>
                            {JSON.stringify(latestParseJob.metaJson, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Error Display */}
                  {latestParseJob.status === 'FAILED' && latestParseJob.errors && (
                    <div style={{ padding: 16, border: `1px solid ${C.red}`, borderRadius: 8, background: C.redDim }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.red, marginBottom: 4 }}>{tr('فشل التحليل', 'Parse Failed')}</div>
                      <div style={{ fontSize: 12, color: C.red }}>{latestParseJob.errors}</div>
                      {latestParseJob.extractedRawText && latestParseJob.extractedRawText.length > 0 && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: 'pointer', fontSize: 12, color: C.red }}>
                            {tr(`عرض النص الجزئي (${latestParseJob.extractedRawText.length} حرف)`, `View partial text (${latestParseJob.extractedRawText.length} chars)`)}
                          </summary>
                          <pre style={{ marginTop: 8, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 192, overflow: 'auto', background: C.bgCard, padding: 8, borderRadius: 6, border: `1px solid ${C.border}`, color: C.text }}>
                            {latestParseJob.extractedRawText}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.textMuted, padding: 16, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {tr('لا يوجد مهمة تحليل لهذه السيرة الذاتية', 'No parse job found for this CV')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: C.textMuted }}>
              {tr('لم يتم رفع سيرة ذاتية بعد', 'No CV uploaded yet')}
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
