'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionLabel, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect } from 'react';

import { toast } from 'sonner';
import {
  Upload, FileText, Sparkles, User, Briefcase, Building2,
  CheckCircle, XCircle, RefreshCw, Eye, UserPlus, Trash2,
  Brain, GraduationCap, Clock, Mail, Phone
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

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface JobTitle {
  id: string;
  name: string;
  departmentId?: string;
}

export default function CVInboxTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [files, setFiles] = useState<ParsedCV[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitle[]>([]);
  const [uploading] = useState(false);
  const [parsing, setParsing] = useState(false);

  // Preview dialog
  const [previewFile, setPreviewFile] = useState<ParsedCV | null>(null);

  // Add to recruitment dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedCV, setSelectedCV] = useState<ParsedCV | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    loadDepartments(ac.signal);
    loadJobTitles('', ac.signal);
    return () => ac.abort();
  }, []);

  async function loadDepartments(signal?: AbortSignal) {
    try {
      const res = await fetch('/api/cvision/org/departments?limit=100', { credentials: 'include', signal });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.items || data.data?.items || data.data || []);
      }
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }

  async function loadJobTitles(departmentId: string, signal?: AbortSignal) {
    try {
      const url = departmentId
        ? `/api/cvision/job-titles?departmentId=${departmentId}&limit=100`
        : '/api/cvision/job-titles?limit=100';
      const res = await fetch(url, { credentials: 'include', signal });
      if (res.ok) {
        const data = await res.json();
        setJobTitles(data.data || data.items || []);
      }
    } catch (error) {
      console.error('Failed to load job titles:', error);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const newFiles: ParsedCV[] = [];
    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      newFiles.push({
        id: `cv-${Date.now()}-${i}`,
        fileName: file.name,
        file,
        status: 'uploaded',
      });
    }
    setFiles(prev => [...prev, ...newFiles]);
    toast.success(tr(`تم رفع ${newFiles.length} ملف(ات) وجاهزة للتحليل`, `${newFiles.length} file(s) uploaded and ready for analysis`));
    e.target.value = '';
  }

  async function parseCV(cv: ParsedCV) {
    setFiles(prev => prev.map(f =>
      f.id === cv.id ? { ...f, status: 'parsing' as const } : f
    ));

    try {
      const formData = new FormData();
      formData.append('file', cv.file);

      const res = await fetch('/api/cvision/recruitment/analyze-cv', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.analysis) {
        const analysis = data.analysis;
        const positionMatches = data.positionMatches || [];

        setFiles(prev => prev.map(f =>
          f.id === cv.id ? {
            ...f,
            status: 'parsed' as const,
            rawText: data.extractedText || '',
            parsed: {
              fullName: analysis.fullName,
              email: analysis.email,
              phone: analysis.phone,
              summary: analysis.summary,
              skills: analysis.skills || [],
              experience: (analysis.experience || []).map((e: any) =>
                typeof e === 'string' ? e : `${e.title || ''} at ${e.company || ''} (${e.duration || ''})`.trim()
              ),
              education: (analysis.education || []).map((e: any) =>
                typeof e === 'string' ? e : `${e.degree || ''} - ${e.institution || ''}${e.year ? ` (${e.year})` : ''}`.trim()
              ),
              yearsOfExperience: analysis.yearsOfExperience || 0,
            },
            suggestions: positionMatches.map((pm: any) => ({
              departmentId: pm.departmentId,
              departmentName: pm.departmentName,
              jobTitleId: pm.jobTitleId,
              jobTitleName: pm.jobTitleName,
              matchScore: pm.matchScore,
              reason: pm.matchReason || pm.reason || '',
            })),
            selectedDepartmentId: positionMatches[0]?.departmentId,
            selectedJobTitleId: positionMatches[0]?.jobTitleId,
          } : f
        ));

        toast.success(tr(`تم تحليل السيرة الذاتية: ${analysis.fullName || cv.fileName}`, `CV analyzed: ${analysis.fullName || cv.fileName}`));
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error: any) {
      const fileName = cv.fileName;
      let fullName = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
      fullName = fullName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      const emailMatch = cv.rawText?.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
      const email = emailMatch ? emailMatch[0] : undefined;
      const phoneMatch = cv.rawText?.match(/(\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/);
      const phone = phoneMatch ? phoneMatch[1] : undefined;

      setFiles(prev => prev.map(f =>
        f.id === cv.id ? {
          ...f,
          status: 'parsed' as const,
          parsed: {
            fullName,
            email,
            phone,
            summary: tr('تحليل أساسي - الذكاء الاصطناعي غير متاح', 'Basic parsing - AI unavailable'),
            skills: [],
            experience: [],
            education: [],
            yearsOfExperience: 0,
          },
          suggestions: departments.length > 0 && jobTitles.length > 0 ? [{
            departmentId: departments[0].id,
            departmentName: departments[0].name,
            jobTitleId: jobTitles[0]?.id || '',
            jobTitleName: jobTitles[0]?.name || tr('عام', 'General'),
            matchScore: 40,
            reason: tr('مراجعة يدوية مطلوبة - تحليل الذكاء الاصطناعي غير متاح', 'Manual review required - AI analysis unavailable'),
          }] : [],
        } : f
      ));

      toast.warning(tr('تم تحليل السيرة الذاتية بالاستخراج الأساسي (الذكاء الاصطناعي غير متاح)', 'CV parsed with basic extraction (AI unavailable)'));
    }
  }

  async function parseAllCVs() {
    const unparsed = files.filter(f => f.status === 'uploaded' || f.status === 'error');
    if (unparsed.length === 0) {
      toast.info(tr('لا توجد سير ذاتية للتحليل', 'No CVs to parse'));
      return;
    }
    setParsing(true);
    for (const cv of unparsed) {
      await parseCV(cv);
    }
    setParsing(false);
  }

  function openAddDialog(cv: ParsedCV) {
    setSelectedCV(cv);
    setAddDialogOpen(true);
  }

  async function handleAddToRecruitment() {
    if (!selectedCV) return;
    if (!selectedCV.selectedDepartmentId || !selectedCV.selectedJobTitleId) {
      toast.error(tr('يرجى اختيار القسم والوظيفة', 'Please select department and position'));
      return;
    }

    try {
      setAdding(true);
      const res = await fetch('/api/cvision/recruitment/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: selectedCV.parsed?.fullName || selectedCV.fileName.replace(/\.[^/.]+$/, ''),
          email: selectedCV.parsed?.email || '',
          phone: selectedCV.parsed?.phone || '',
          departmentId: selectedCV.selectedDepartmentId,
          jobTitleId: selectedCV.selectedJobTitleId,
          source: 'CV_INBOX',
          notes: selectedCV.parsed?.summary || '',
          status: 'new',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(tr(`تم إضافة ${selectedCV.parsed?.fullName || 'المرشح'} إلى التوظيف`, `Added ${selectedCV.parsed?.fullName || 'candidate'} to recruitment`));
        setFiles(prev => prev.filter(f => f.id !== selectedCV.id));
        setAddDialogOpen(false);
        setSelectedCV(null);
      } else {
        toast.error(data.error || tr('فشل إضافة المرشح', 'Failed to add candidate'));
      }
    } catch (error) {
      toast.error(tr('فشل إضافة المرشح', 'Failed to add candidate'));
    } finally {
      setAdding(false);
    }
  }

  function removeCV(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  const stats = {
    total: files.length,
    parsed: files.filter(f => f.status === 'parsed').length,
    pending: files.filter(f => f.status === 'uploaded').length,
    errors: files.filter(f => f.status === 'error').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats */}
      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: C.blueDim, borderRadius: 12 }}><FileText style={{ height: 20, width: 20, color: C.blue }} /></div>
                <div><p style={{ fontSize: 13, color: C.textMuted }}>{tr('إجمالي السير الذاتية', 'Total CVs')}</p><p style={{ fontSize: 24, fontWeight: 700 }}>{stats.total}</p></div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: C.greenDim, borderRadius: 12 }}><CheckCircle style={{ height: 20, width: 20, color: C.green }} /></div>
                <div><p style={{ fontSize: 13, color: C.textMuted }}>{tr('تم التحليل', 'Parsed')}</p><p style={{ fontSize: 24, fontWeight: 700, color: C.green }}>{stats.parsed}</p></div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: C.orangeDim, borderRadius: 12 }}><Clock style={{ height: 20, width: 20, color: C.orange }} /></div>
                <div><p style={{ fontSize: 13, color: C.textMuted }}>{tr('قيد الانتظار', 'Pending')}</p><p style={{ fontSize: 24, fontWeight: 700, color: C.orange }}>{stats.pending}</p></div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ padding: 8, background: C.redDim, borderRadius: 12 }}><XCircle style={{ height: 20, width: 20, color: C.red }} /></div>
                <div><p style={{ fontSize: 13, color: C.textMuted }}>{tr('أخطاء', 'Errors')}</p><p style={{ fontSize: 24, fontWeight: 700, color: C.red }}>{stats.errors}</p></div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>
      )}

      {/* Upload Section */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload style={{ height: 20, width: 20 }} />
            {tr('رفع السير الذاتية', 'Upload CVs')}
          </div>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <input
              type="file"
              id="cv-upload-tab"
              multiple
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <FileText style={{ height: 48, width: 48, color: C.textMuted, marginBottom: 16 }} />
            <p style={{ color: C.textMuted, marginBottom: 16 }}>
              {tr('اسحب وأسقط ملفات السيرة الذاتية هنا، أو انقر للتصفح', 'Drag & drop CV files here, or click to browse')}
            </p>
            <label htmlFor="cv-upload-tab">
              <CVisionButton C={C} isDark={isDark} asChild disabled={uploading}>
                <span>
                  {uploading ? (
                    <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Upload style={{ height: 16, width: 16, marginRight: 8 }} />
                  )}
                  {tr('اختر ملفات', 'Select Files')}
                </span>
              </CVisionButton>
            </label>
            <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
              {tr('الصيغ المدعومة: PDF, DOC, DOCX, TXT', 'Supported: PDF, DOC, DOCX, TXT')}
            </p>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* CV List */}
      {files.length > 0 && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{tr('السير الذاتية المرفوعة', 'Uploaded CVs')} ({files.length})</div>
            <CVisionButton C={C} isDark={isDark} onClick={parseAllCVs} disabled={parsing || stats.pending === 0}>
              {parsing ? <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : <Brain style={{ height: 16, width: 16, marginRight: 8 }} />}
              {tr('تحليل الكل بالذكاء الاصطناعي', 'Analyze All with AI')}
            </CVisionButton>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {files.map((cv) => (
                <div
                  key={cv.id}
                  className={`p-4 border rounded-lg ${
                    cv.status === 'parsed' ? 'bg-green-50 border-green-200' :
                    cv.status === 'error' ? 'bg-red-50 border-red-200' :
                    cv.status === 'parsing' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-white'
                  }`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
                      <FileText style={{ height: 32, width: 32, color: C.textMuted, marginTop: 4 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <p style={{ fontWeight: 500 }}>{cv.fileName}</p>
                          <CVisionBadge C={C} variant={
                            cv.status === 'parsed' ? 'default' :
                            cv.status === 'error' ? 'destructive' :
                            cv.status === 'parsing' ? 'secondary' :
                            'outline'
                          }>
                            {cv.status === 'parsing' ? tr('جاري التحليل...', 'Analyzing...') : cv.status === 'parsed' ? tr('تم التحليل', 'parsed') : cv.status === 'error' ? tr('خطأ', 'error') : tr('مرفوع', 'uploaded')}
                          </CVisionBadge>
                        </div>

                        {cv.status === 'parsed' && cv.parsed && (
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <User style={{ height: 16, width: 16 }} />
                                <strong>{cv.parsed.fullName || tr('غير معروف', 'Unknown')}</strong>
                              </span>
                              {cv.parsed.email && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}>
                                  <Mail style={{ height: 12, width: 12 }} /> {cv.parsed.email}
                                </span>
                              )}
                              {cv.parsed.phone && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.textMuted }}>
                                  <Phone style={{ height: 12, width: 12 }} /> {cv.parsed.phone}
                                </span>
                              )}
                            </div>
                            {cv.parsed.skills && cv.parsed.skills.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {cv.parsed.skills.slice(0, 5).map((skill, i) => (
                                  <CVisionBadge C={C} key={i} variant="secondary" style={{ fontSize: 12 }}>{skill}</CVisionBadge>
                                ))}
                                {cv.parsed.skills.length > 5 && (
                                  <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>+{cv.parsed.skills.length - 5} {tr('إضافي', 'more')}</CVisionBadge>
                                )}
                              </div>
                            )}
                            {cv.suggestions && cv.suggestions.length > 0 && (
                              <div style={{ marginTop: 12, padding: 12, background: C.purpleDim, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, color: C.purple, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Sparkles style={{ height: 16, width: 16 }} /> {tr('توصية الذكاء الاصطناعي', 'AI Recommendation')}
                                </p>
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {cv.suggestions.slice(0, 2).map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                                      <span>
                                        <Building2 style={{ height: 12, width: 12, marginRight: 4 }} /> {s.departmentName} →{' '}
                                        <Briefcase style={{ height: 12, width: 12, marginRight: 4 }} /> {s.jobTitleName}
                                      </span>
                                      <CVisionBadge C={C} style={{ background: C.purpleDim }}>{s.matchScore}% {tr('تطابق', 'match')}</CVisionBadge>
                                    </div>
                                  ))}
                                </div>
                                {cv.suggestions[0]?.reason && (
                                  <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>{cv.suggestions[0].reason}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {cv.status === 'error' && (
                          <p style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{cv.error}</p>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {cv.status === 'uploaded' && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => parseCV(cv)}>
                          <Brain style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('تحليل', 'Analyze')}
                        </CVisionButton>
                      )}
                      {cv.status === 'parsed' && (
                        <>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => setPreviewFile(cv)}>
                            <Eye style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('معاينة', 'Preview')}
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => openAddDialog(cv)}>
                            <UserPlus style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('إضافة لخط التوظيف', 'Add to Pipeline')}
                          </CVisionButton>
                        </>
                      )}
                      {cv.status === 'error' && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => parseCV(cv)}>
                          <RefreshCw style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('إعادة المحاولة', 'Retry')}
                        </CVisionButton>
                      )}
                      <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" onClick={() => removeCV(cv.id)}>
                        <Trash2 style={{ height: 16, width: 16, color: C.red }} />
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
          <CVisionCardBody style={{ paddingTop: 48, paddingBottom: 48, textAlign: 'center' }}>
            <FileText style={{ height: 64, width: 64, color: C.textMuted, marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>{tr('لا توجد سير ذاتية مرفوعة', 'No CVs Uploaded')}</h3>
            <p style={{ color: C.textMuted, marginBottom: 16 }}>
              {tr('ارفع ملفات السير الذاتية لتحليلها بالذكاء الاصطناعي وإيجاد أفضل وظيفة مطابقة', 'Upload CV files to analyze them with AI and find the best position match')}
            </p>
            <label htmlFor="cv-upload-tab">
              <CVisionButton C={C} isDark={isDark} asChild>
                <span>
                  <Upload style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('رفع السير الذاتية', 'Upload CVs')}
                </span>
              </CVisionButton>
            </label>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Preview Dialog */}
      <CVisionDialog C={C} open={!!previewFile} onClose={() => setPreviewFile(null)} title="Preview CV" isDark={isDark}>                      {previewFile?.parsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الاسم', 'Name')}</CVisionLabel><p style={{ fontWeight: 500 }}>{previewFile.parsed.fullName}</p></div>
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('البريد الإلكتروني', 'Email')}</CVisionLabel><p>{previewFile.parsed.email || '-'}</p></div>
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الهاتف', 'Phone')}</CVisionLabel><p>{previewFile.parsed.phone || '-'}</p></div>
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الخبرة', 'Experience')}</CVisionLabel><p>{previewFile.parsed.yearsOfExperience || 0} {tr('سنوات', 'years')}</p></div>
              </div>
              {previewFile.parsed.summary && (
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الملخص', 'Summary')}</CVisionLabel><p style={{ fontSize: 13 }}>{previewFile.parsed.summary}</p></div>
              )}
              {previewFile.parsed.skills && previewFile.parsed.skills.length > 0 && (
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('المهارات', 'Skills')}</CVisionLabel><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>{previewFile.parsed.skills.map((skill, i) => <CVisionBadge C={C} key={i} variant="secondary">{skill}</CVisionBadge>)}</div></div>
              )}
              {previewFile.parsed.experience && previewFile.parsed.experience.length > 0 && (
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الخبرة', 'Experience')}</CVisionLabel><ul style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>{previewFile.parsed.experience.map((exp, i) => <li key={i}>{exp}</li>)}</ul></div>
              )}
              {previewFile.parsed.education && previewFile.parsed.education.length > 0 && (
                <div><CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('التعليم', 'Education')}</CVisionLabel><ul style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>{previewFile.parsed.education.map((edu, i) => <li key={i}>{edu}</li>)}</ul></div>
              )}
            </div>
          )}
      </CVisionDialog>

      {/* Add to Recruitment Dialog */}
      <CVisionDialog C={C} open={addDialogOpen} onClose={() => setAddDialogOpen(false)} title={tr('إضافة مرشح', 'Add Candidate')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {tr(`إضافة ${selectedCV?.parsed?.fullName || 'هذا المرشح'} إلى خط التوظيف`, `Add ${selectedCV?.parsed?.fullName || 'this candidate'} to the recruitment pipeline`)}
            </p>          {selectedCV && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, paddingBottom: 16 }}>
              <div style={{ padding: 12, background: C.bgSubtle, borderRadius: 12 }}>
                <p style={{ fontWeight: 500 }}>{selectedCV.parsed?.fullName || selectedCV.fileName}</p>
                {selectedCV.parsed?.email && <p style={{ fontSize: 13, color: C.textMuted }}>{selectedCV.parsed.email}</p>}
              </div>
              {selectedCV.suggestions && selectedCV.suggestions.length > 0 && (
                <div style={{ padding: 12, background: C.purpleDim, border: `1px solid ${C.border}`, borderRadius: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.purple, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles style={{ height: 16, width: 16 }} /> {tr('الوظيفة الموصى بها من الذكاء الاصطناعي', 'AI Recommended Position')}</p>
                  <p style={{ fontSize: 13, marginTop: 4 }}>{selectedCV.suggestions[0].departmentName} → {selectedCV.suggestions[0].jobTitleName}<CVisionBadge C={C} style={{ marginLeft: 8, background: C.purpleDim }}>{selectedCV.suggestions[0].matchScore}%</CVisionBadge></p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('القسم *', 'Department *')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={selectedCV.selectedDepartmentId || 'none'}
                onChange={(v) => {
                    setSelectedCV({ ...selectedCV, selectedDepartmentId: v === 'none' ? undefined : v, selectedJobTitleId: undefined });
                    loadJobTitles(v === 'none' ? '' : v);
                  }}
                placeholder={tr('اختر القسم', 'Select department')}
                options={[{ value: 'none', label: tr('اختر...', 'Select...') }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('الوظيفة *', 'Position *')}</CVisionLabel>
                <CVisionSelect
                C={C}
                value={selectedCV.selectedJobTitleId || 'none'}
                onChange={(v) => setSelectedCV({ ...selectedCV, selectedJobTitleId: v === 'none' ? undefined : v })}
                placeholder={tr('اختر الوظيفة', 'Select position')}
                options={[{ value: 'none', label: tr('اختر...', 'Select...') }, ...jobTitles
                      .filter(j => !selectedCV.selectedDepartmentId || j.departmentId === selectedCV.selectedDepartmentId)
                      .map((j) => ({ value: j.id, label: j.name }))]}
                disabled={!selectedCV.selectedDepartmentId}
              />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 16 }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setAddDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} onClick={handleAddToRecruitment} disabled={adding || !selectedCV.selectedDepartmentId || !selectedCV.selectedJobTitleId}>
                  {adding && <RefreshCw style={{ height: 16, width: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
                  <UserPlus style={{ height: 16, width: 16, marginRight: 8 }} /> {tr('إضافة لخط التوظيف', 'Add to Pipeline')}
                </CVisionButton>
              </div>
            </div>
          )}
      </CVisionDialog>
    </div>
  );
}
