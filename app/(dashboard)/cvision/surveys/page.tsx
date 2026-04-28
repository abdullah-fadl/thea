'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionSelect, CVisionTabs, CVisionTabContent, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { ClipboardList, BarChart3, PlusCircle, Send, Star } from 'lucide-react';

const statusVariant = (s: string) => s === 'ACTIVE' ? 'success' as const : s === 'CLOSED' ? 'danger' as const : 'muted' as const;
const typeVariant = (t: string) => t === 'ENGAGEMENT' ? 'info' as const : t === 'PULSE' ? 'purple' as const : t === 'eNPS' ? 'warning' as const : t === 'EXIT' ? 'danger' as const : 'muted' as const;

export default function SurveysPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [results, setResults] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [answering, setAnswering] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [form, setForm] = useState({ title: '', titleAr: '', type: 'ENGAGEMENT', anonymous: false, questions: [{ text: '', type: 'RATING_1_5', options: [] as string[] }] });
  const [activeTab, setActiveTab] = useState('surveys');

  const { data: surveysData, isLoading: surveysLoading } = useQuery({
    queryKey: cvisionKeys.surveys.list({ action: 'list' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/surveys', { params: { action: 'list' } }),
  });
  const surveys = surveysData?.ok ? surveysData.data || [] : [];

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: cvisionKeys.surveys.list({ action: 'my-pending' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/surveys', { params: { action: 'my-pending' } }),
  });
  const pending = pendingData?.ok ? pendingData.data || [] : [];

  const loading = surveysLoading || pendingLoading;

  const invalidateSurveys = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.surveys.all });

  const createMutation = useMutation({
    mutationFn: (data: any) => cvisionMutate<any>('/api/cvision/surveys', 'POST', { action: 'create', ...data }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم إنشاء الاستبيان', 'Survey created')), setShowCreate(false), invalidateSurveys()) : toast.error(d.error); },
  });

  const publishMutation = useMutation({
    mutationFn: (surveyId: string) => cvisionMutate<any>('/api/cvision/surveys', 'POST', { action: 'publish', surveyId }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم النشر', 'Published')), invalidateSurveys()) : toast.error(d.error); },
  });

  const submitResponseMutation = useMutation({
    mutationFn: ({ surveyId, ansArr }: { surveyId: string; ansArr: any[] }) => cvisionMutate<any>('/api/cvision/surveys', 'POST', { action: 'submit-response', surveyId, answers: ansArr }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم إرسال الإجابة', 'Response submitted')), setAnswering(null), setAnswers({}), invalidateSurveys()) : toast.error(d.error); },
  });

  const handleCreate = () => {
    if (!form.title) { toast.error(tr('العنوان مطلوب', 'Title required')); return; }
    createMutation.mutate(form);
  };

  const handlePublish = (surveyId: string) => publishMutation.mutate(surveyId);

  const handleSubmitResponse = () => {
    if (!answering) return;
    const ansArr = Object.entries(answers).map(([questionId, value]) => ({ questionId, value }));
    submitResponseMutation.mutate({ surveyId: answering.surveyId, ansArr });
  };

  const viewResults = async (surveyId: string) => {
    const d = await cvisionFetch<any>('/api/cvision/surveys', { params: { action: 'results', id: surveyId } });
    if (d.ok) setResults(d.data);
  };

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  const tabs = [
    { id: 'surveys', label: 'Surveys', labelAr: 'الاستبيانات', icon: <ClipboardList size={14} /> },
    { id: 'pending', label: `My Pending (${pending.length})`, labelAr: `المعلقة (${pending.length})`, icon: <Send size={14} /> },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('الاستبيانات والتغذية الراجعة', 'Surveys & Feedback')} titleEn="Surveys & Feedback" icon={ClipboardList} isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('استبيان جديد', 'New Survey')}
          </CVisionButton>
        }
      />

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} isRTL={isRTL} />

      <CVisionTabContent id="surveys" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showCreate && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء استبيان', 'Create Survey')}</span>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <CVisionInput C={C} placeholder={tr('العنوان', 'Title')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                    <CVisionInput C={C} placeholder={tr('العنوان بالعربي', 'العنوان')} value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} style={{ direction: 'rtl' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <CVisionSelect C={C} label={tr('النوع', 'Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={['ENGAGEMENT', 'PULSE', 'eNPS', 'EXIT', 'ONBOARDING', 'TRAINING_FEEDBACK', 'CUSTOM'].map(t => ({ value: t, label: t }))} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.textSecondary, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.anonymous} onChange={e => setForm({ ...form, anonymous: e.target.checked })} style={{ accentColor: C.gold }} />
                      {tr('مجهول', 'Anonymous')}
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.questions.map((q, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <CVisionInput C={C} placeholder={`${tr('السؤال', 'Question')} ${i + 1}`} value={q.text} onChange={e => { const qs = [...form.questions]; qs[i] = { ...qs[i], text: e.target.value }; setForm({ ...form, questions: qs }); }} />
                        </div>
                        <div style={{ width: 140 }}>
                          <CVisionSelect C={C} value={q.type} onChange={v => { const qs = [...form.questions]; qs[i] = { ...qs[i], type: v }; setForm({ ...form, questions: qs }); }} options={['RATING_1_5', 'RATING_1_10', 'NPS', 'TEXT', 'SINGLE_CHOICE', 'BOOLEAN'].map(t => ({ value: t, label: t }))} />
                        </div>
                      </div>
                    ))}
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setForm({ ...form, questions: [...form.questions, { text: '', type: 'RATING_1_5', options: [] }] })}>+ {tr('سؤال', 'Question')}</CVisionButton>
                  </div>
                  <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleCreate}>{tr('إنشاء الاستبيان', 'Create Survey')}</CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {results && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('النتائج:', 'Results:')} {results.survey?.title}</span>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13, color: C.textSecondary }}>
                  <span>{tr('الردود:', 'Responses:')} <strong style={{ color: C.text }}>{results.responseCount}</strong></span>
                  <span>{tr('النسبة:', 'Rate:')} <strong style={{ color: C.text }}>{results.responseRate}%</strong></span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(results.analysis || []).map((q: any) => (
                    <div key={q.questionId} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: C.text, marginBottom: 4 }}>{q.text}</div>
                      {q.average != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{q.average}</div>
                          {q.enps != null && <CVisionBadge C={C} variant={q.enps >= 0 ? 'success' : 'danger'}>eNPS: {q.enps}</CVisionBadge>}
                        </div>
                      )}
                      {q.distribution && typeof q.distribution === 'object' && !Array.isArray(q.distribution) && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {Object.entries(q.distribution).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 11, background: C.bgCard, padding: '2px 8px', borderRadius: 4, color: C.textMuted }}>{k}: {String(v)}</span>
                          ))}
                        </div>
                      )}
                      {q.textResponses && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                          {q.textResponses.slice(0, 5).map((t: string, i: number) => (
                            <p key={i} style={{ fontSize: 11, color: C.textMuted, fontStyle: 'italic' }}>&ldquo;{t}&rdquo;</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ marginTop: 8 }} onClick={() => setResults(null)}>{tr('إغلاق', 'Close')}</CVisionButton>
              </CVisionCardBody>
            </CVisionCard>
          )}

          {surveys.map(s => (
            <CVisionCard key={s.surveyId} C={C}>
              <CVisionCardBody style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CVisionBadge C={C} variant={typeVariant(s.type)}>{s.type}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{s.title}</span>
                  <CVisionBadge C={C} variant={statusVariant(s.status)}>{s.status}</CVisionBadge>
                  {s.anonymous && <CVisionBadge C={C} variant="muted">{tr('مجهول', 'Anonymous')}</CVisionBadge>}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{s.responseCount || 0} {tr('ردود', 'responses')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {s.status === 'DRAFT' && <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" onClick={() => handlePublish(s.surveyId)}>{tr('نشر', 'Publish')}</CVisionButton>}
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => viewResults(s.surveyId)}>{tr('النتائج', 'Results')}</CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      </CVisionTabContent>

      <CVisionTabContent id="pending" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {answering ? (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{answering.title}</span>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(answering.questions || []).map((q: any) => (
                    <div key={q.questionId}>
                      <label style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                        {q.text} {q.required && <span style={{ color: C.red }}>*</span>}
                      </label>
                      {(q.type === 'RATING_1_5') && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          {[1, 2, 3, 4, 5].map(v => (
                            <button key={v} style={{ width: 32, height: 32, borderRadius: 6, fontSize: 13, border: 'none', cursor: 'pointer', background: answers[q.questionId] === v ? C.blue : C.bgCard, color: answers[q.questionId] === v ? '#fff' : C.text }} onClick={() => setAnswers({ ...answers, [q.questionId]: v })}>{v}</button>
                          ))}
                        </div>
                      )}
                      {(q.type === 'RATING_1_10' || q.type === 'NPS') && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                            <button key={v} style={{ width: 28, height: 28, borderRadius: 6, fontSize: 11, border: 'none', cursor: 'pointer', background: answers[q.questionId] === v ? C.blue : C.bgCard, color: answers[q.questionId] === v ? '#fff' : C.text }} onClick={() => setAnswers({ ...answers, [q.questionId]: v })}>{v}</button>
                          ))}
                        </div>
                      )}
                      {q.type === 'TEXT' && (
                        <textarea style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, fontSize: 13, width: '100%', height: 64, marginTop: 6, background: C.bgCard, color: C.text, resize: 'vertical' }} value={answers[q.questionId] || ''} onChange={e => setAnswers({ ...answers, [q.questionId]: e.target.value })} />
                      )}
                      {q.type === 'BOOLEAN' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <CVisionButton C={C} isDark={isDark} variant={answers[q.questionId] === true ? 'primary' : 'outline'} size="sm" onClick={() => setAnswers({ ...answers, [q.questionId]: true })}>{tr('نعم', 'Yes')}</CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant={answers[q.questionId] === false ? 'primary' : 'outline'} size="sm" onClick={() => setAnswers({ ...answers, [q.questionId]: false })}>{tr('لا', 'No')}</CVisionButton>
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleSubmitResponse}>{tr('إرسال', 'Submit')}</CVisionButton>
                    <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => { setAnswering(null); setAnswers({}); }}>{tr('إلغاء', 'Cancel')}</CVisionButton>
                  </div>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ) : pending.length === 0 ? (
            <p style={{ color: C.textMuted, textAlign: 'center', padding: '32px 0' }}>{tr('لا توجد استبيانات معلقة', 'No pending surveys.')}</p>
          ) : pending.map(s => (
            <CVisionCard key={s.surveyId} C={C} onClick={() => setAnswering(s)} style={{ cursor: 'pointer' }}>
              <CVisionCardBody style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CVisionBadge C={C} variant={typeVariant(s.type)}>{s.type}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{(s.questions || []).length} {tr('أسئلة', 'questions')}</span>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      </CVisionTabContent>
    </CVisionPageLayout>
  );
}
