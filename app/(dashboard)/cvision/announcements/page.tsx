'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionTextarea, CVisionPageHeader, CVisionPageLayout,
  CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Megaphone, PlusCircle, Pin, Archive } from 'lucide-react';

const TYPE_VARIANT: Record<string, 'info' | 'danger' | 'purple' | 'success' | 'warning' | 'muted'> = {
  GENERAL: 'info', URGENT: 'danger', POLICY_UPDATE: 'purple', EVENT: 'success', CELEBRATION: 'warning',
};
const PRIORITY_VARIANT: Record<string, 'muted' | 'warning' | 'danger'> = {
  NORMAL: 'muted', HIGH: 'warning', URGENT: 'danger',
};

export default function AnnouncementsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', titleAr: '', body: '', bodyAr: '', type: 'GENERAL', priority: 'NORMAL' });

  const { data: announcementsData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.announcements.list({ action: 'list' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/announcements', { params: { action: 'list' } }),
  });
  const announcements = announcementsData?.ok ? announcementsData.data || [] : [];

  const createMutation = useMutation({
    mutationFn: (data: any) => cvisionMutate<any>('/api/cvision/announcements', 'POST', { action: 'create', ...data }),
    onSuccess: (d) => {
      d.ok ? (toast.success(tr('تم نشر الإعلان', 'Announcement published')), setShowCreate(false), queryClient.invalidateQueries({ queryKey: cvisionKeys.announcements.all })) : toast.error(d.error);
    },
  });

  const pinMutation = useMutation({
    mutationFn: (announcementId: string) => cvisionMutate<any>('/api/cvision/announcements', 'POST', { action: 'pin', announcementId }),
    onSuccess: (d) => {
      d.ok ? (toast.success(tr('تم التثبيت', 'Toggled pin')), queryClient.invalidateQueries({ queryKey: cvisionKeys.announcements.all })) : toast.error(d.error);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (announcementId: string) => cvisionMutate<any>('/api/cvision/announcements', 'POST', { action: 'archive', announcementId }),
    onSuccess: (d) => {
      d.ok ? (toast.success(tr('تم الأرشفة', 'Archived')), queryClient.invalidateQueries({ queryKey: cvisionKeys.announcements.all })) : toast.error(d.error);
    },
  });

  const handleCreate = async () => {
    if (!form.title || !form.body) { toast.error(tr('العنوان والمحتوى مطلوبان', 'Title and body required')); return; }
    createMutation.mutate(form);
  };

  const handlePin = (announcementId: string) => pinMutation.mutate(announcementId);
  const handleArchive = (announcementId: string) => archiveMutation.mutate(announcementId);

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
        title={tr('الإعلانات', 'Announcements')}
        titleEn="Announcements"
        icon={Megaphone}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('إعلان جديد', 'New Announcement')}
          </CVisionButton>
        }
      />

      {showCreate && (
        <CVisionCard C={C} style={{ marginBottom: 16 }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء إعلان', 'Create Announcement')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionInput C={C} placeholder={tr('العنوان', 'Title')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                <CVisionInput C={C} placeholder={tr('العنوان بالعربي', 'Title (AR)')} dir="rtl" value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} />
              </div>
              <CVisionTextarea C={C} placeholder={tr('المحتوى', 'Content')} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} />
              <CVisionTextarea C={C} placeholder={tr('المحتوى بالعربي', 'Content (AR)')} dir="rtl" value={form.bodyAr} onChange={e => setForm({ ...form, bodyAr: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <CVisionSelect C={C} label={tr('النوع', 'Type')} value={form.type} onChange={v => setForm({ ...form, type: v })} options={['GENERAL','URGENT','POLICY_UPDATE','EVENT','CELEBRATION'].map(t => ({ value: t, label: t }))} />
                <CVisionSelect C={C} label={tr('الأولوية', 'Priority')} value={form.priority} onChange={v => setForm({ ...form, priority: v })} options={['NORMAL','HIGH','URGENT'].map(p => ({ value: p, label: p }))} />
              </div>
              <CVisionButton C={C} isDark={isDark} onClick={handleCreate}>{tr('نشر', 'Publish')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {announcements.length === 0 && (
          <CVisionEmptyState C={C} icon={Megaphone} title={tr('لا توجد إعلانات', 'No announcements.')} />
        )}
        {announcements.map(a => (
          <CVisionCard
            key={a.announcementId}
            C={C}
            style={a.isPinned ? { borderColor: C.gold + '60' } : undefined}
          >
            <CVisionCardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {a.isPinned && <Pin size={14} color={C.gold} style={{ transform: 'rotate(45deg)' }} />}
                <CVisionBadge C={C} variant={TYPE_VARIANT[a.type] || 'muted'}>{a.type}</CVisionBadge>
                {a.priority !== 'NORMAL' && <CVisionBadge C={C} variant={PRIORITY_VARIANT[a.priority] || 'muted'}>{a.priority}</CVisionBadge>}
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{a.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{new Date(a.publishedAt).toLocaleDateString()}</span>
              </div>
              <p style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>{a.body}</p>
              {a.bodyAr && <p style={{ fontSize: 13, color: C.textSecondary, direction: 'rtl' }}>{a.bodyAr}</p>}
              <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<Pin size={12} />} onClick={() => handlePin(a.announcementId)}>
                  {a.isPinned ? tr('إلغاء التثبيت', 'Unpin') : tr('تثبيت', 'Pin')}
                </CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<Archive size={12} />} onClick={() => handleArchive(a.announcementId)}>
                  {tr('أرشفة', 'Archive')}
                </CVisionButton>
                <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 'auto' }}>{(a.readBy || []).length} {tr('قراءة', 'reads')}</span>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
