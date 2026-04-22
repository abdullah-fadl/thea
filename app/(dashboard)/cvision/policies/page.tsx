'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionTextarea, CVisionSelect, CVisionPageHeader, CVisionPageLayout,
  CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { FileCheck, PlusCircle, CheckCircle2 } from 'lucide-react';

const CATEGORY_VARIANT: Record<string, 'info' | 'purple' | 'danger' | 'success' | 'muted'> = {
  HR: 'info', IT: 'purple', SAFETY: 'danger', FINANCE: 'success', GENERAL: 'muted',
};

/** Sanitize HTML by escaping dangerous tags/attributes while preserving safe formatting tags. */
function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Remove script tags and their contents
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove on* event handlers (onclick, onerror, onload, etc.)
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
  // Remove javascript: URLs
  clean = clean.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  clean = clean.replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, '');
  // Remove iframe, object, embed, form tags
  clean = clean.replace(/<\/?(iframe|object|embed|form|meta|link|base)\b[^>]*>/gi, '');
  // Remove style attributes (can be used for CSS-based attacks)
  clean = clean.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
  return clean;
}

export default function PoliciesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
  const [form, setForm] = useState({ title: '', titleAr: '', category: 'GENERAL', content: '', contentAr: '', requiresAcknowledgment: true });

  const { data: pData, isLoading: pLoading } = useQuery({
    queryKey: cvisionKeys.companyPolicies.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/company-policies', { params: { action: 'list' } }),
  });
  const { data: prData, isLoading: prLoading } = useQuery({
    queryKey: cvisionKeys.companyPolicies.list({ view: 'my-pending' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/company-policies', { params: { action: 'my-pending' } }),
  });

  const policies = pData?.ok ? (pData.data || []) : [];
  const pending = prData?.ok ? (prData.data || []) : [];
  const loading = pLoading || prLoading;

  const invalidatePolicies = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.companyPolicies.all });

  const createMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/company-policies', 'POST', { action: 'create', ...form }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم إنشاء السياسة', 'Policy created')), setShowCreate(false), invalidatePolicies()) : toast.error(d.error); },
    onError: () => toast.error(tr('خطأ في الاتصال', 'Connection error')),
  });
  const handleCreate = () => createMutation.mutate();

  const publishMutation = useMutation({
    mutationFn: (policyId: string) => cvisionMutate<any>('/api/cvision/company-policies', 'POST', { action: 'publish', policyId }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم النشر', 'Published')), invalidatePolicies()) : toast.error(d.error); },
    onError: () => toast.error(tr('خطأ في الاتصال', 'Connection error')),
  });
  const handlePublish = (policyId: string) => publishMutation.mutate(policyId);

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => cvisionMutate<any>('/api/cvision/company-policies', 'POST', { action: 'acknowledge', id }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم الاعتراف', 'Acknowledged')), invalidatePolicies()) : toast.error(d.error); },
    onError: () => toast.error(tr('خطأ في الاتصال', 'Connection error')),
  });
  const handleAcknowledge = (id: string) => acknowledgeMutation.mutate(id);

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
        title={tr('سياسات الشركة', 'Company Policies')}
        titleEn="Company Policies"
        icon={FileCheck}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('سياسة جديدة', 'New Policy')}
          </CVisionButton>
        }
      />

      {/* Pending acknowledgment */}
      {pending.length > 0 && (
        <CVisionCard C={C} style={{ borderColor: C.gold + '60', marginBottom: 16 }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>
              {tr('بانتظار الاعتراف', 'Pending Acknowledgment')} ({pending.length})
            </span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pending.map((p: any) => (
                <div key={p.policyId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <FileCheck size={16} color={C.gold} />
                  <span style={{ color: C.text }}>{p.title}</span>
                  <CVisionBadge C={C} variant={CATEGORY_VARIANT[p.category] || 'muted'}>{p.category}</CVisionBadge>
                  <CVisionButton C={C} isDark={isDark} size="sm" style={{ marginLeft: 'auto' }} icon={<CheckCircle2 size={12} />} onClick={() => handleAcknowledge(p.policyId)}>
                    {tr('أقر وأوافق', 'I Acknowledge')}
                  </CVisionButton>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Create form */}
      {showCreate && (
        <CVisionCard C={C} style={{ marginBottom: 16 }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء سياسة', 'Create Policy')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('العنوان (EN)', 'Title (EN)')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('العنوان (AR)', 'Title (AR)')} value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} dir="rtl" />
              </div>
              <CVisionSelect C={C} label={tr('الفئة', 'Category')} value={form.category} onChange={v => setForm({ ...form, category: v })} options={['HR','IT','SAFETY','FINANCE','GENERAL'].map(c => ({ value: c, label: c }))} />
              <CVisionTextarea C={C} placeholder={tr('المحتوى (EN)', 'Content (EN)')} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              <CVisionTextarea C={C} placeholder={tr('المحتوى (AR)', 'Content (AR)')} dir="rtl" value={form.contentAr} onChange={e => setForm({ ...form, contentAr: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.requiresAcknowledgment} onChange={e => setForm({ ...form, requiresAcknowledgment: e.target.checked })} style={{ accentColor: C.gold }} />
                {tr('يتطلب اعتراف', 'Requires Acknowledgment')}
              </label>
              <CVisionButton C={C} isDark={isDark} onClick={handleCreate}>{tr('إنشاء', 'Create')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Selected policy detail */}
      {selectedPolicy && (
        <CVisionCard C={C} style={{ marginBottom: 16 }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{selectedPolicy.title}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedPolicy.content || '<p>No content.</p>') }} />
            {selectedPolicy.contentAr && (
              <div style={{ fontSize: 13, color: C.text, lineHeight: 1.8, marginTop: 16, direction: 'rtl' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedPolicy.contentAr) }} />
            )}
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" style={{ marginTop: 12 }} onClick={() => setSelectedPolicy(null)}>
              {tr('إغلاق', 'Close')}
            </CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Policy list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {policies.map(p => (
          <CVisionCard key={p.policyId} C={C} onClick={() => setSelectedPolicy(p)}>
            <CVisionCardBody style={{ padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <CVisionBadge C={C} variant={CATEGORY_VARIANT[p.category] || 'muted'}>{p.category}</CVisionBadge>
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{p.title}</span>
                {p.titleAr && <span style={{ fontSize: 11, color: C.textMuted }}>({p.titleAr})</span>}
                <CVisionBadge C={C} variant="muted">{p.status}</CVisionBadge>
                {p.status === 'DRAFT' && (
                  <CVisionButton C={C} isDark={isDark} size="sm" style={{ marginLeft: 'auto' }} onClick={e => { e.stopPropagation(); handlePublish(p.policyId); }}>
                    {tr('نشر', 'Publish')}
                  </CVisionButton>
                )}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
