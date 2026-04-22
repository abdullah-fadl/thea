'use client';

import { useState } from 'react';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow,
  CVisionSkeletonCard, CVisionSelect, CVisionTabs, CVisionTabContent, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { toast } from 'sonner';
import { GraduationCap, Users, Clock, DollarSign, PlusCircle, BookOpen, BarChart3 } from 'lucide-react';

const catVariant = (c: string) => c === 'TECHNICAL' ? 'info' as const : c === 'SOFT_SKILLS' ? 'purple' as const : c === 'COMPLIANCE' ? 'danger' as const : c === 'LEADERSHIP' ? 'warning' as const : c === 'SAFETY' ? 'warning' as const : c === 'ONBOARDING' ? 'success' as const : 'muted' as const;
const statusVariant = (s: string) => s === 'COMPLETED' ? 'success' as const : s === 'IN_PROGRESS' ? 'warning' as const : s === 'SCHEDULED' ? 'info' as const : s === 'CANCELLED' ? 'danger' as const : 'muted' as const;

export default function TrainingPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState({ title: '', titleAr: '', category: 'TECHNICAL', type: 'CLASSROOM', provider: 'INTERNAL', duration: 8, maxEnrollment: 30, cost: 0, startDate: '', endDate: '', location: '', instructorName: '' });
  const [activeTab, setActiveTab] = useState('catalog');

  const { data: coursesRaw, isLoading: loadingCourses } = useQuery({
    queryKey: cvisionKeys.training.list({ action: 'catalog' }),
    queryFn: () => cvisionFetch('/api/cvision/training', { params: { action: 'catalog' } }),
  });
  const courses = (coursesRaw as any)?.data || [];

  const { data: myTrainingRaw } = useQuery({
    queryKey: cvisionKeys.training.list({ action: 'my-training' }),
    queryFn: () => cvisionFetch('/api/cvision/training', { params: { action: 'my-training' } }),
  });
  const myTraining = (myTrainingRaw as any)?.data || [];

  const { data: reportRaw } = useQuery({
    queryKey: cvisionKeys.training.list({ action: 'report' }),
    queryFn: () => cvisionFetch('/api/cvision/training', { params: { action: 'report' } }),
  });
  const report = (reportRaw as any)?.data || null;

  const loading = loadingCourses;

  const createCourseMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate('/api/cvision/training', 'POST', payload),
    onSuccess: () => {
      toast.success(tr('تم إنشاء الدورة', 'Course created'));
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: cvisionKeys.training.all });
    },
    onError: (err: any) => toast.error(err.message || 'Error'),
  });

  const handleCreate = async () => {
    if (!form.title) { toast.error(tr('العنوان مطلوب', 'Title required')); return; }
    createCourseMutation.mutate({ action: 'create-course', ...form });
  };

  const enrollMutation = useMutation({
    mutationFn: (courseId: string) => cvisionMutate('/api/cvision/training', 'POST', { action: 'enroll', courseId }),
    onSuccess: (d: any) => {
      if (d.enrolled === 0) { toast.info(tr('مسجل بالفعل في هذه الدورة', 'Already enrolled in this course')); return; }
      toast.success(tr('تم التسجيل بنجاح', 'Enrolled successfully'));
      queryClient.invalidateQueries({ queryKey: cvisionKeys.training.all });
    },
    onError: (err: any) => toast.error(err.message || 'Error'),
  });

  const handleEnroll = async (courseId: string) => {
    enrollMutation.mutate(courseId);
  };

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  const tabs = [
    { id: 'catalog', label: 'Catalog', labelAr: 'الكتالوج', icon: <BookOpen size={14} /> },
    { id: 'my', label: 'My Training', labelAr: 'تدريبي', icon: <GraduationCap size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('التدريب والتطوير', 'Training & Development')} titleEn="Training & Development" icon={GraduationCap} isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('دورة جديدة', 'New Course')}
          </CVisionButton>
        }
      />

      {report && (
        <CVisionStatsRow>
          <CVisionMiniStat C={C} label={tr('الدورات', 'Courses')} value={report.totalCourses} icon={GraduationCap} color={C.blue} colorDim={C.blueDim} />
          <CVisionMiniStat C={C} label={tr('المسجلين', 'Enrollments')} value={report.totalEnrollments} icon={Users} color={C.green} colorDim={C.greenDim} />
          <CVisionMiniStat C={C} label={tr('ساعات التدريب', 'Training Hours')} value={`${report.totalHours || 0}h`} icon={Clock} color={C.gold} colorDim={C.goldDim} />
          <CVisionMiniStat C={C} label={tr('نسبة الإكمال', 'Completion Rate')} value={`${report.completionRate}%`} icon={BarChart3} color={C.purple} colorDim={C.purpleDim} />
        </CVisionStatsRow>
      )}

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="catalog" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showCreate && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء دورة', 'Create Course')}</span>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <CVisionInput C={C} placeholder={tr('العنوان (EN)', 'Title (EN)')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <CVisionInput C={C} placeholder={tr('العنوان (AR)', 'العنوان (AR)')} value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} style={{ direction: 'rtl' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <CVisionSelect C={C} label={tr('الفئة', 'Category')} value={form.category} onChange={v => setForm({ ...form, category: v })} options={['TECHNICAL', 'SOFT_SKILLS', 'COMPLIANCE', 'LEADERSHIP', 'SAFETY', 'ONBOARDING', 'CUSTOM'].map(c => ({ value: c, label: c }))} />
                    <CVisionSelect C={C} label={tr('النوع', 'Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={['CLASSROOM', 'ONLINE', 'BLENDED', 'SELF_PACED'].map(t => ({ value: t, label: t }))} />
                    <CVisionSelect C={C} label={tr('المزود', 'Provider')} value={form.provider} onChange={v => setForm({ ...form, provider: v })} options={['INTERNAL', 'EXTERNAL'].map(p => ({ value: p, label: p }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    <CVisionInput C={C} label={tr('المدة (ساعات)', 'Duration (hrs)')} type="number" value={form.duration} onChange={e => setForm({ ...form, duration: parseInt(e.target.value) })} />
                    <CVisionInput C={C} label={tr('الحد الأقصى', 'Max Seats')} type="number" value={form.maxEnrollment} onChange={e => setForm({ ...form, maxEnrollment: parseInt(e.target.value) })} />
                    <CVisionInput C={C} label={tr('البداية', 'Start')} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                    <CVisionInput C={C} label={tr('النهاية', 'End')} type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <CVisionInput C={C} placeholder={tr('الموقع', 'Location')} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    <CVisionInput C={C} placeholder={tr('المدرب', 'Instructor')} value={form.instructorName} onChange={e => setForm({ ...form, instructorName: e.target.value })} />
                    <CVisionInput C={C} label={tr('التكلفة (ريال)', 'Cost (SAR)')} type="number" value={form.cost} onChange={e => setForm({ ...form, cost: parseInt(e.target.value) })} />
                  </div>
                  <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleCreate}>{tr('إنشاء الدورة', 'Create Course')}</CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {detail && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{detail.title}</span>
                  {detail.titleAr && <div style={{ fontSize: 12, color: C.textMuted, direction: 'rtl' }}>{detail.titleAr}</div>}
                </div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
                  <div>{tr('الفئة:', 'Category:')} <CVisionBadge C={C} variant={catVariant(detail.category)}>{detail.category}</CVisionBadge></div>
                  {detail.type && <div>{tr('النوع:', 'Type:')} {detail.type.replace(/_/g, ' ')}</div>}
                  {(detail.duration ?? 0) > 0 && <div>{tr('المدة:', 'Duration:')} {detail.duration}h</div>}
                  <div>{tr('المسجلون:', 'Enrolled:')} {detail.enrolledCount || 0}{detail.maxEnrollment ? `/${detail.maxEnrollment}` : ''}</div>
                  {detail.startDate && <div>{tr('البداية:', 'Start:')} {detail.startDate}</div>}
                  {detail.location && <div>{tr('الموقع:', 'Location:')} {detail.location}</div>}
                  {detail.instructorName && <div>{tr('المدرب:', 'Instructor:')} {detail.instructorName}</div>}
                  {detail.cost > 0 && <div>{tr('التكلفة:', 'Cost:')} {detail.cost} SAR</div>}
                </div>
                {detail.enrollments && (
                  <div style={{ marginTop: 8 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 500, color: C.text, marginBottom: 4 }}>{tr('المسجلون', 'Enrolled')} ({detail.enrollments.length})</h4>
                    {detail.enrollments.map((e: any) => (
                      <div key={e.employeeId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '2px 0' }}>
                        <span style={{ color: C.text }}>{e.employeeName}</span>
                        <CVisionBadge C={C} variant="muted">{e.status}</CVisionBadge>
                        {e.score != null && <span style={{ color: C.textMuted }}>{tr('الدرجة:', 'Score:')} {e.score}</span>}
                      </div>
                    ))}
                  </div>
                )}
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ marginTop: 8 }} onClick={() => setDetail(null)}>{tr('إغلاق', 'Close')}</CVisionButton>
              </CVisionCardBody>
            </CVisionCard>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {courses.map(c => {
              const alreadyEnrolled = myTraining.some((e: any) => e.courseId === c.courseId && e.status === 'ENROLLED');
              return (
                <CVisionCard key={c.courseId} C={C} onClick={async () => {
                  const r = await fetch(`/api/cvision/training?action=get&id=${c.courseId}`, { credentials: 'include' }); const d = await r.json();
                  if (d.ok) setDetail(d.data);
                }} style={{ cursor: 'pointer' }}>
                  <CVisionCardBody style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <CVisionBadge C={C} variant={catVariant(c.category)}>{c.category}</CVisionBadge>
                      <CVisionBadge C={C} variant={statusVariant(c.status)}>{c.status}</CVisionBadge>
                    </div>
                    <h3 style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{c.title}</h3>
                    {c.titleAr && <p style={{ fontSize: 11, color: C.textMuted, direction: 'rtl' }}>{c.titleAr}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 11, color: C.textMuted }}>
                      {(c.duration ?? 0) > 0 && <span><Clock size={11} style={{ display: 'inline', marginRight: 2 }} />{c.duration}h</span>}
                      <span><Users size={11} style={{ display: 'inline', marginRight: 2 }} />{c.enrolledCount || 0}{c.maxEnrollment ? `/${c.maxEnrollment}` : ''} {tr('مسجل', 'enrolled')}</span>
                      {c.type && <CVisionBadge C={C} variant="muted">{c.type.replace(/_/g, ' ')}</CVisionBadge>}
                    </div>
                    {alreadyEnrolled
                      ? <CVisionBadge C={C} variant="success" style={{ marginTop: 8 }}>{tr('مسجل', 'Enrolled')}</CVisionBadge>
                      : <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" style={{ marginTop: 8 }} onClick={e => { e.stopPropagation(); handleEnroll(c.courseId); }}>{tr('تسجيل', 'Enroll')}</CVisionButton>
                    }
                  </CVisionCardBody>
                </CVisionCard>
              );
            })}
          </div>
        </div>
      </CVisionTabContent>

      <CVisionTabContent id="my" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myTraining.length === 0 && <p style={{ color: C.textMuted, textAlign: 'center', padding: '32px 0' }}>{tr('لا توجد تسجيلات تدريبية', 'No training enrollments.')}</p>}
          {myTraining.map((e: any) => (
            <CVisionCard key={`${e.courseId}-${e.employeeId}`} C={C}>
              <CVisionCardBody style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CVisionBadge C={C} variant={statusVariant(e.course?.status)}>{e.course?.status}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{e.course?.title || e.courseId}</span>
                  <CVisionBadge C={C} variant="muted">{e.status}</CVisionBadge>
                  {e.score != null && <span style={{ fontSize: 11, color: C.textMuted }}>{tr('الدرجة:', 'Score:')} {e.score}</span>}
                  {e.certificateIssued && <CVisionBadge C={C} variant="success">{tr('شهادة', 'Certificate')}</CVisionBadge>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{new Date(e.enrolledAt).toLocaleDateString()}</span>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      </CVisionTabContent>
    </CVisionPageLayout>
  );
}
