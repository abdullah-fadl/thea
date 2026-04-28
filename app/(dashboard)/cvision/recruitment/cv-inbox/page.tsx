'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionPageHeader, CVisionPageLayout, CVisionEmptyState,
  CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog,
  CVisionDialogFooter, CVisionLabel, CVisionStatsRow, CVisionMiniStat } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  Upload, FileText, Sparkles, User, Briefcase, Building2,
  CheckCircle, XCircle, RefreshCw, Eye, UserPlus, Trash2,
  Brain, ArrowRight, Clock, Mail, Phone,
} from 'lucide-react';

interface ParsedCV {
  id: string;
  fileName: string;
  file: File;
  rawText?: string;
  status: 'uploaded' | 'parsing' | 'parsed' | 'error';
  error?: string;
  parsed?: {
    fullName?: string;
    email?: string;
    phone?: string;
    summary?: string;
    skills?: string[];
    experience?: string[];
    education?: string[];
    yearsOfExperience?: number;
  };
  suggestions?: {
    departmentId: string;
    departmentName: string;
    jobTitleId: string;
    jobTitleName: string;
    matchScore: number;
    reason: string;
  }[];
  selectedDepartmentId?: string;
  selectedJobTitleId?: string;
}

interface Department { id: string; name: string; code?: string; }
interface JobTitle { id: string; name: string; departmentId?: string; }

export default function CVInboxPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const router = useRouter();

  const [files, setFiles] = useState<ParsedCV[]>([]);
  const [jobTitlesDeptFilter, setJobTitlesDeptFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [previewFile, setPreviewFile] = useState<ParsedCV | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedCV, setSelectedCV] = useState<ParsedCV | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 100 }),
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/org/departments', { params: { limit: 100 } });
      return (data.items || data.data?.items || data.data || []) as Department[];
    },
  });

  const { data: jobTitles = [] } = useQuery({
    queryKey: cvisionKeys.jobTitles.list({ departmentId: jobTitlesDeptFilter, limit: 100 }),
    queryFn: async () => {
      const params: Record<string, string> = { limit: '100' };
      if (jobTitlesDeptFilter) params.departmentId = jobTitlesDeptFilter;
      const data = await cvisionFetch<any>('/api/cvision/job-titles', { params });
      return (data.data || data.items || []) as JobTitle[];
    },
  });

  function loadJobTitles(departmentId: string) {
    setJobTitlesDeptFilter(departmentId);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;
    const newFiles: ParsedCV[] = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      newFiles.push({ id: `cv-${Date.now()}-${i}`, fileName: file.name, file, status: 'uploaded' });
    }
    setFiles(prev => [...prev, ...newFiles]);
    toast.success(tr(`تم رفع ${newFiles.length} ملف(ات) وجاهزة للتحليل`, `${newFiles.length} file(s) uploaded and ready for analysis`));
    e.target.value = '';
  }

  async function parseCV(cv: ParsedCV) {
    setFiles(prev => prev.map(f => f.id === cv.id ? { ...f, status: 'parsing' as const } : f));
    try {
      const formData = new FormData();
      formData.append('file', cv.file);
      const res = await fetch('/api/cvision/recruitment/analyze-cv', { method: 'POST', credentials: 'include', body: formData });
      const data = await res.json();
      if (data.success && data.analysis) {
        const analysis = data.analysis;
        const positionMatches = data.positionMatches || [];
        setFiles(prev => prev.map(f => f.id === cv.id ? {
          ...f, status: 'parsed' as const, rawText: data.extractedText || '',
          parsed: {
            fullName: analysis.fullName, email: analysis.email, phone: analysis.phone,
            summary: analysis.summary, skills: analysis.skills || [],
            experience: (analysis.experience || []).map((e: any) => typeof e === 'string' ? e : `${e.title || ''} at ${e.company || ''} (${e.duration || ''})`.trim()),
            education: (analysis.education || []).map((e: any) => typeof e === 'string' ? e : `${e.degree || ''} - ${e.institution || ''}${e.year ? ` (${e.year})` : ''}`.trim()),
            yearsOfExperience: analysis.yearsOfExperience || 0,
          },
          suggestions: positionMatches.map((pm: any) => ({
            departmentId: pm.departmentId, departmentName: pm.departmentName,
            jobTitleId: pm.jobTitleId, jobTitleName: pm.jobTitleName,
            matchScore: pm.matchScore, reason: pm.matchReason || pm.reason || '',
          })),
          selectedDepartmentId: positionMatches[0]?.departmentId,
          selectedJobTitleId: positionMatches[0]?.jobTitleId,
        } : f));
        toast.success(tr(`تم تحليل السيرة: ${analysis.fullName || cv.fileName}`, `CV analyzed: ${analysis.fullName || cv.fileName}`));
      } else { throw new Error(data.error || 'Analysis failed'); }
    } catch (error: any) {
      const fileName = cv.fileName;
      let fullName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      fullName = fullName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const emailMatch = cv.rawText?.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      const phoneMatch = cv.rawText?.match(/(\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/);
      setFiles(prev => prev.map(f => f.id === cv.id ? {
        ...f, status: 'parsed' as const,
        parsed: { fullName, email: emailMatch?.[0], phone: phoneMatch?.[1], summary: 'Basic parsing - AI unavailable', skills: [], experience: [], education: [], yearsOfExperience: 0 },
        suggestions: departments.length > 0 && jobTitles.length > 0 ? [{ departmentId: departments[0].id, departmentName: departments[0].name, jobTitleId: jobTitles[0]?.id || '', jobTitleName: jobTitles[0]?.name || 'General', matchScore: 40, reason: 'Manual review required - AI analysis unavailable' }] : [],
      } : f));
      toast.warning(tr('تم تحليل السيرة بشكل أساسي (الذكاء الاصطناعي غير متوفر)', 'CV parsed with basic extraction (AI unavailable)'));
    }
  }

  async function parseAllCVs() {
    const unparsed = files.filter(f => f.status === 'uploaded' || f.status === 'error');
    if (unparsed.length === 0) { toast.info(tr('لا توجد سير ذاتية للتحليل', 'No CVs to parse')); return; }
    setParsing(true);
    for (const cv of unparsed) { await parseCV(cv); }
    setParsing(false);
  }

  function openAddDialog(cv: ParsedCV) { setSelectedCV(cv); setAddDialogOpen(true); }

  async function handleAddToRecruitment() {
    if (!selectedCV) return;
    if (!selectedCV.selectedDepartmentId || !selectedCV.selectedJobTitleId) { toast.error(tr('يرجى اختيار القسم والمنصب', 'Please select department and position')); return; }
    try {
      setAdding(true);
      const res = await fetch('/api/cvision/recruitment/candidates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ fullName: selectedCV.parsed?.fullName || selectedCV.fileName.replace(/\.[^/.]+$/, ''), email: selectedCV.parsed?.email || '', phone: selectedCV.parsed?.phone || '', departmentId: selectedCV.selectedDepartmentId, jobTitleId: selectedCV.selectedJobTitleId, source: 'CV_INBOX', notes: selectedCV.parsed?.summary || '', status: 'new' }),
      });
      const data = await res.json();
      if (data.success) { toast.success(tr(`تمت إضافة ${selectedCV.parsed?.fullName || 'المرشح'} للتوظيف`, `Added ${selectedCV.parsed?.fullName || 'candidate'} to recruitment`)); setFiles(prev => prev.filter(f => f.id !== selectedCV.id)); setAddDialogOpen(false); setSelectedCV(null); }
      else { toast.error(data.error || tr('فشل إضافة المرشح', 'Failed to add candidate')); }
    } catch { toast.error(tr('فشل إضافة المرشح', 'Failed to add candidate')); }
    finally { setAdding(false); }
  }

  function removeCV(id: string) { setFiles(prev => prev.filter(f => f.id !== id)); }

  const stats = {
    total: files.length,
    parsed: files.filter(f => f.status === 'parsed').length,
    pending: files.filter(f => f.status === 'uploaded').length,
    errors: files.filter(f => f.status === 'error').length,
  };

  function getStatusBadgeVariant(status: string): 'success' | 'danger' | 'warning' | 'muted' {
    if (status === 'parsed') return 'success';
    if (status === 'error') return 'danger';
    if (status === 'parsing') return 'warning';
    return 'muted';
  }

  return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionPageHeader
        C={C}
        title={tr('صندوق السير الذاتية', 'CV Inbox')}
        titleEn={isRTL ? 'CV Inbox' : undefined}
        subtitle={tr('ارفع السير الذاتية ودع الذكاء الاصطناعي يحللها للعثور على أفضل مطابقة', 'Upload CVs and let AI analyze them to find the best position match')}
        isRTL={isRTL}
        icon={FileText}
        actions={
          <CVisionButton C={C} isDark={isDark} onClick={() => router.push('/cvision/recruitment')} icon={<ArrowRight size={14} />}>
            {tr('الذهاب للتوظيف', 'Go to Recruitment')}
          </CVisionButton>
        }
      />

      {files.length > 0 && (
        <CVisionStatsRow>
          <CVisionMiniStat C={C} label={tr('إجمالي السير', 'Total CVs')} value={stats.total} icon={FileText} color={C.blue} colorDim={C.blueDim} />
          <CVisionMiniStat C={C} label={tr('محللة', 'Parsed')} value={stats.parsed} icon={CheckCircle} color={C.green} colorDim={C.greenDim} />
          <CVisionMiniStat C={C} label={tr('قيد الانتظار', 'Pending')} value={stats.pending} icon={Clock} color={C.orange} colorDim={C.orangeDim} />
          <CVisionMiniStat C={C} label={tr('أخطاء', 'Errors')} value={stats.errors} icon={XCircle} color={C.red} colorDim={C.redDim} />
        </CVisionStatsRow>
      )}

      {/* Upload Section */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={16} color={C.gold} />
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('رفع السير الذاتية', 'Upload CVs')}</span>
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <input type="file" id="cv-upload" multiple accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} style={{ display: 'none' }} />
            <FileText size={48} color={C.textMuted} style={{ margin: '0 auto 16px' }} />
            <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {tr('اسحب وأفلت الملفات هنا أو انقر للتصفح', 'Drag & drop CV files here, or click to browse')}
            </div>
            <label htmlFor="cv-upload">
              <CVisionButton C={C} isDark={isDark} disabled={uploading} icon={uploading ? <RefreshCw size={14} /> : <Upload size={14} />} onClick={() => {}}>
                {tr('اختيار الملفات', 'Select Files')}
              </CVisionButton>
            </label>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
              {tr('المدعوم: PDF, DOC, DOCX, TXT', 'Supported: PDF, DOC, DOCX, TXT')}
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* CV List */}
      {files.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                {tr(`السير المرفوعة (${files.length})`, `Uploaded CVs (${files.length})`)}
              </span>
              <CVisionButton C={C} isDark={isDark} onClick={parseAllCVs} disabled={parsing || stats.pending === 0}
                loading={parsing} icon={<Brain size={14} />}>
                {tr('تحليل الكل بالذكاء الاصطناعي', 'Analyze All with AI')}
              </CVisionButton>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {files.map((cv) => (
                <div key={cv.id} style={{
                  padding: 16, borderRadius: 12,
                  border: `1px solid ${cv.status === 'parsed' ? C.green + '40' : cv.status === 'error' ? C.red + '40' : cv.status === 'parsing' ? C.orange + '40' : C.border}`,
                  background: cv.status === 'parsed' ? C.greenDim : cv.status === 'error' ? C.redDim : cv.status === 'parsing' ? C.orangeDim : C.bgCard,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                      <FileText size={28} color={C.textMuted} style={{ marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 500, color: C.text, fontSize: 13 }}>{cv.fileName}</span>
                          <CVisionBadge C={C} variant={getStatusBadgeVariant(cv.status)}>
                            {cv.status === 'parsing' ? tr('جاري التحليل...', 'Analyzing...') : tr(
                              cv.status === 'uploaded' ? 'مرفوع' : cv.status === 'parsed' ? 'محلل' : 'خطأ',
                              cv.status
                            )}
                          </CVisionBadge>
                        </div>

                        {cv.status === 'parsed' && cv.parsed && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.text }}>
                                <User size={14} /> <strong>{cv.parsed.fullName || tr('غير معروف', 'Unknown')}</strong>
                              </span>
                              {cv.parsed.email && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textSecondary, fontSize: 12 }}>
                                  <Mail size={12} /> {cv.parsed.email}
                                </span>
                              )}
                              {cv.parsed.phone && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textSecondary, fontSize: 12 }}>
                                  <Phone size={12} /> {cv.parsed.phone}
                                </span>
                              )}
                            </div>

                            {cv.parsed.skills && cv.parsed.skills.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                {cv.parsed.skills.slice(0, 5).map((skill, i) => (
                                  <CVisionBadge key={i} C={C} variant="info">{skill}</CVisionBadge>
                                ))}
                                {cv.parsed.skills.length > 5 && (
                                  <CVisionBadge C={C} variant="muted">+{cv.parsed.skills.length - 5} {tr('أكثر', 'more')}</CVisionBadge>
                                )}
                              </div>
                            )}

                            {cv.suggestions && cv.suggestions.length > 0 && (
                              <div style={{ marginTop: 12, padding: 12, background: C.purpleDim, border: `1px solid ${C.purple}30`, borderRadius: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Sparkles size={14} /> {tr('توصية الذكاء الاصطناعي', 'AI Recommendation')}
                                </div>
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {cv.suggestions.slice(0, 2).map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                                      <span style={{ color: C.text }}>
                                        <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        {s.departmentName} → <Briefcase size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        {s.jobTitleName}
                                      </span>
                                      <CVisionBadge C={C} variant="purple">{s.matchScore}% {tr('مطابقة', 'match')}</CVisionBadge>
                                    </div>
                                  ))}
                                </div>
                                {cv.suggestions[0]?.reason && (
                                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{cv.suggestions[0].reason}</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {cv.status === 'error' && (
                          <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{cv.error}</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {cv.status === 'uploaded' && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => parseCV(cv)} icon={<Brain size={12} />}>
                          {tr('تحليل', 'Analyze')}
                        </CVisionButton>
                      )}
                      {cv.status === 'parsed' && (
                        <>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => setPreviewFile(cv)} icon={<Eye size={12} />}>
                            {tr('معاينة', 'Preview')}
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => openAddDialog(cv)} icon={<UserPlus size={12} />}>
                            {tr('إضافة للتوظيف', 'Add to Recruitment')}
                          </CVisionButton>
                        </>
                      )}
                      {cv.status === 'error' && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => parseCV(cv)} icon={<RefreshCw size={12} />}>
                          {tr('إعادة المحاولة', 'Retry')}
                        </CVisionButton>
                      )}
                      <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" onClick={() => removeCV(cv.id)}>
                        <Trash2 size={14} color={C.red} />
                      </CVisionButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Empty State */}
      {files.length === 0 && (
        <CVisionCard C={C}>
          <CVisionCardBody>
            <CVisionEmptyState
              C={C}
              icon={FileText}
              title={tr('لا توجد سير ذاتية مرفوعة', 'No CVs Uploaded')}
              description={tr('ارفع ملفات السير الذاتية لتحليلها بالذكاء الاصطناعي والعثور على أفضل مطابقة', 'Upload CV files to analyze them with AI and find the best position match')}
              action={
                <label htmlFor="cv-upload">
                  <CVisionButton C={C} isDark={isDark} icon={<Upload size={14} />} onClick={() => {}}>
                    {tr('رفع السير الذاتية', 'Upload CVs')}
                  </CVisionButton>
                </label>
              }
            />
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Preview Dialog */}
      <CVisionDialog C={C} open={!!previewFile} onClose={() => setPreviewFile(null)}
        title={tr('معاينة السيرة الذاتية', 'CV Preview') + ` - ${previewFile?.parsed?.fullName || ''}`} isRTL={isRTL} width={700}>
        {previewFile?.parsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <CVisionLabel C={C}>{tr('الاسم', 'Name')}</CVisionLabel>
                <div style={{ fontWeight: 500, color: C.text, fontSize: 13, marginTop: 4 }}>{previewFile.parsed.fullName}</div>
              </div>
              <div>
                <CVisionLabel C={C}>{tr('البريد', 'Email')}</CVisionLabel>
                <div style={{ color: C.text, fontSize: 13, marginTop: 4 }}>{previewFile.parsed.email || '-'}</div>
              </div>
              <div>
                <CVisionLabel C={C}>{tr('الهاتف', 'Phone')}</CVisionLabel>
                <div style={{ color: C.text, fontSize: 13, marginTop: 4 }}>{previewFile.parsed.phone || '-'}</div>
              </div>
              <div>
                <CVisionLabel C={C}>{tr('الخبرة', 'Experience')}</CVisionLabel>
                <div style={{ color: C.text, fontSize: 13, marginTop: 4 }}>{previewFile.parsed.yearsOfExperience || 0} {tr('سنوات', 'years')}</div>
              </div>
            </div>

            {previewFile.parsed.summary && (
              <div>
                <CVisionLabel C={C}>{tr('الملخص', 'Summary')}</CVisionLabel>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>{previewFile.parsed.summary}</div>
              </div>
            )}

            {previewFile.parsed.skills && previewFile.parsed.skills.length > 0 && (
              <div>
                <CVisionLabel C={C}>{tr('المهارات', 'Skills')}</CVisionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {previewFile.parsed.skills.map((skill, i) => (
                    <CVisionBadge key={i} C={C} variant="info">{skill}</CVisionBadge>
                  ))}
                </div>
              </div>
            )}

            {previewFile.parsed.experience && previewFile.parsed.experience.length > 0 && (
              <div>
                <CVisionLabel C={C}>{tr('الخبرات', 'Experience')}</CVisionLabel>
                <ul style={{ listStyle: 'disc', paddingLeft: 20, marginTop: 6 }}>
                  {previewFile.parsed.experience.map((exp, i) => (
                    <li key={i} style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>{exp}</li>
                  ))}
                </ul>
              </div>
            )}

            {previewFile.parsed.education && previewFile.parsed.education.length > 0 && (
              <div>
                <CVisionLabel C={C}>{tr('التعليم', 'Education')}</CVisionLabel>
                <ul style={{ listStyle: 'disc', paddingLeft: 20, marginTop: 6 }}>
                  {previewFile.parsed.education.map((edu, i) => (
                    <li key={i} style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>{edu}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CVisionDialog>

      {/* Add to Recruitment Dialog */}
      <CVisionDialog C={C} open={addDialogOpen} onClose={() => setAddDialogOpen(false)}
        title={tr('إضافة للتوظيف', 'Add to Recruitment')} isRTL={isRTL}>
        {selectedCV && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 10 }}>
              <div style={{ fontWeight: 500, color: C.text, fontSize: 13 }}>{selectedCV.parsed?.fullName || selectedCV.fileName}</div>
              {selectedCV.parsed?.email && (
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{selectedCV.parsed.email}</div>
              )}
            </div>

            {selectedCV.suggestions && selectedCV.suggestions.length > 0 && (
              <div style={{ padding: 12, background: C.purpleDim, border: `1px solid ${C.purple}30`, borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} /> {tr('المنصب الموصى به بالذكاء الاصطناعي', 'AI Recommended Position')}
                </div>
                <div style={{ fontSize: 13, color: C.text, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {selectedCV.suggestions[0].departmentName} → {selectedCV.suggestions[0].jobTitleName}
                  <CVisionBadge C={C} variant="purple">{selectedCV.suggestions[0].matchScore}%</CVisionBadge>
                </div>
              </div>
            )}

            <CVisionSelect C={C} label={tr('القسم *', 'Department *')}
              options={departments.map(d => ({ value: d.id, label: d.name }))}
              value={selectedCV.selectedDepartmentId || ''}
              onChange={(v) => {
                setSelectedCV({ ...selectedCV, selectedDepartmentId: v, selectedJobTitleId: undefined });
                loadJobTitles(v);
              }}
              placeholder={tr('اختر القسم', 'Select department')}
            />

            <CVisionSelect C={C} label={tr('المنصب *', 'Position *')}
              options={jobTitles.filter(j => !selectedCV.selectedDepartmentId || j.departmentId === selectedCV.selectedDepartmentId).map(j => ({ value: j.id, label: j.name }))}
              value={selectedCV.selectedJobTitleId || ''}
              onChange={(v) => setSelectedCV({ ...selectedCV, selectedJobTitleId: v })}
              placeholder={tr('اختر المنصب', 'Select position')}
              disabled={!selectedCV.selectedDepartmentId}
            />

            <CVisionDialogFooter C={C}>
              <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setAddDialogOpen(false)}>
                {tr('إلغاء', 'Cancel')}
              </CVisionButton>
              <CVisionButton C={C} isDark={isDark} onClick={handleAddToRecruitment}
                disabled={adding || !selectedCV.selectedDepartmentId || !selectedCV.selectedJobTitleId}
                loading={adding} icon={<UserPlus size={14} />}>
                {tr('إضافة للتوظيف', 'Add to Recruitment')}
              </CVisionButton>
            </CVisionDialogFooter>
          </div>
        )}
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
