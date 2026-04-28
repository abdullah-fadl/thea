'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionSelect, CVisionPageHeader, CVisionPageLayout,
  CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { FileText, Download, Eye, Check } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'muted'> = {
  REQUESTED: 'warning', APPROVED: 'info', GENERATED: 'success', DELIVERED: 'muted',
};

export default function LettersPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const { data: lettersData, isLoading: lettersLoading } = useQuery({
    queryKey: cvisionKeys.letters.list({ action: 'list' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/letters', { params: { action: 'list' } }),
  });
  const letters = lettersData?.ok ? lettersData.data || [] : [];

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: cvisionKeys.letters.list({ action: 'templates' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/letters', { params: { action: 'templates' } }),
  });
  const templates = templatesData?.ok ? templatesData.data || [] : [];

  const loading = lettersLoading || templatesLoading;

  const invalidateLetters = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.letters.all });

  const requestMutation = useMutation({
    mutationFn: (data: any) => cvisionMutate<any>('/api/cvision/letters', 'POST', data),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم طلب الخطاب', `Letter requested: ${d.data.letterId}`)), setShowCreate(false), invalidateLetters()) : toast.error(d.error); },
    onError: () => toast.error(tr('خطأ في الاتصال', 'Connection error')),
  });

  const generateMutation = useMutation({
    mutationFn: (letterId: string) => cvisionMutate<any>('/api/cvision/letters', 'POST', { action: 'generate', letterId }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم إنشاء الخطاب', 'Letter generated')), invalidateLetters()) : toast.error(d.error); },
    onError: () => toast.error(tr('خطأ في الاتصال', 'Connection error')),
  });

  const approveMutation = useMutation({
    mutationFn: (letterId: string) => cvisionMutate<any>('/api/cvision/letters', 'POST', { action: 'approve', letterId }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تمت الموافقة', 'Approved')), invalidateLetters()) : toast.error(d.error); },
    onError: () => toast.error(tr('خطأ في الاتصال', 'Connection error')),
  });

  const handleRequest = () => {
    if (!selectedTemplate) { toast.error(tr('اختر قالب', 'Select template')); return; }
    requestMutation.mutate({ action: 'request', templateKey: selectedTemplate, employeeId: employeeId || undefined });
  };

  const handleGenerate = (letterId: string) => generateMutation.mutate(letterId);
  const handleApprove = (letterId: string) => approveMutation.mutate(letterId);

  if (loading) return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <CVisionPageHeader
        C={C}
        title={tr('إدارة الخطابات', 'Letter Management')}
        titleEn="Letter Management"
        icon={FileText}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} icon={<FileText size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('خطاب جديد', 'New Letter')}
          </CVisionButton>
        }
      />

      {showCreate && (
        <CVisionCard C={C} style={{ marginBottom: 16 }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('طلب خطاب', 'Request Letter')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionSelect
                C={C}
                placeholder={tr('اختر القالب...', 'Select template...')}
                value={selectedTemplate}
                onChange={v => setSelectedTemplate(v)}
                options={templates.map(t => ({ value: t.templateKey, label: `${t.nameEn} — ${t.nameAr}` }))}
              />
              <CVisionInput C={C} placeholder={tr('رقم الموظف (اختياري)', 'Employee ID (optional, default = self)')} value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
              <CVisionButton C={C} isDark={isDark} onClick={handleRequest}>{tr('إرسال الطلب', 'Submit Request')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {letters.length === 0 && (
          <CVisionEmptyState C={C} icon={FileText} title={tr('لا توجد خطابات', 'No letters found.')} />
        )}
        {letters.map(l => (
          <CVisionCard key={l.letterId} C={C}>
            <CVisionCardBody style={{ padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <CVisionBadge C={C} variant={STATUS_VARIANT[l.status] || 'muted'}>{l.status}</CVisionBadge>
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{l.letterId}</span>
                <CVisionBadge C={C} variant="muted">{l.templateKey || l.type}</CVisionBadge>
                <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>{new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                {l.status === 'REQUESTED' && (
                  <CVisionButton C={C} isDark={isDark} size="sm" icon={<Check size={12} />} onClick={() => handleApprove(l.letterId)}>
                    {tr('موافقة', 'Approve')}
                  </CVisionButton>
                )}
                {(l.status === 'APPROVED' || l.status === 'REQUESTED') && (
                  <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => handleGenerate(l.letterId)}>
                    {tr('إنشاء', 'Generate')}
                  </CVisionButton>
                )}
                {l.status === 'GENERATED' && (
                  <>
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<Eye size={12} />} onClick={() => window.open(`/api/cvision/letters?action=download&id=${l.letterId}`, '_blank')}>
                      {tr('عرض', 'View')}
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<Download size={12} />} onClick={() => window.open(`/api/cvision/letters?action=download&id=${l.letterId}`, '_blank')}>
                      {tr('تحميل', 'Download')}
                    </CVisionButton>
                  </>
                )}
              </div>
              {l.verificationCode && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{tr('رمز التحقق', 'Verification')}: {l.verificationCode}</div>}
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
