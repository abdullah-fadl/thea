'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardBody,
  CVisionButton, CVisionBadge,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Bell, CheckCheck, Eye } from 'lucide-react';

const TYPE_VARIANTS: Record<string, 'info' | 'success' | 'danger' | 'muted' | 'purple' | 'warning' | 'default'> = {
  APPROVAL_PENDING: 'info', APPROVAL_RESULT: 'success', EXPIRY_ALERT: 'danger',
  SYSTEM: 'muted', ANNOUNCEMENT: 'purple', REMINDER: 'warning', WORKFLOW: 'info',
};

export default function NotificationsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');

  const listParams: Record<string, string> = { action: 'list', limit: '50' };
  if (typeFilter) listParams.type = typeFilter;

  const { data: notifData, isLoading: listLoading } = useQuery({
    queryKey: cvisionKeys.notifications.list({ action: 'list', typeFilter }),
    queryFn: () => cvisionFetch<any>('/api/cvision/notifications', { params: listParams }),
  });
  const notifications = notifData?.ok ? notifData.data || [] : [];

  const { data: unreadData } = useQuery({
    queryKey: cvisionKeys.notifications.list({ action: 'unread-count' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/notifications', { params: { action: 'unread-count' } }),
  });
  const unread = unreadData?.ok ? unreadData.count || 0 : 0;

  const loading = listLoading;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => cvisionMutate<any>('/api/cvision/notifications', 'POST', { action: 'mark-read', id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: cvisionKeys.notifications.all }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/notifications', 'POST', { action: 'mark-all-read' }),
    onSuccess: () => {
      toast.success(tr('تم تحديد الكل كمقروء', 'All marked as read'));
      queryClient.invalidateQueries({ queryKey: cvisionKeys.notifications.all });
    },
  });

  const markRead = (id: string) => markReadMutation.mutate(id);
  const markAllRead = () => markAllReadMutation.mutate();

  if (loading) return <div style={{ padding: 24 }}><CVisionSkeletonCard C={C} height={260} /></div>;

  const filterTypes = ['', 'APPROVAL_PENDING', 'EXPIRY_ALERT', 'ANNOUNCEMENT', 'SYSTEM', 'WORKFLOW'];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('الإشعارات', 'Notifications')}
        titleEn="Notifications"
        subtitle={`${unread} ${tr('غير مقروءة', 'unread')}`}
        icon={Bell}
        isRTL={isRTL}
        actions={unread > 0 ? (
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<CheckCheck size={14} />} onClick={markAllRead}>
            {tr('تحديد الكل كمقروء', 'Mark All Read')}
          </CVisionButton>
        ) : undefined}
      />

      {/* Type Filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {filterTypes.map(t => (
          <CVisionButton key={t} C={C} isDark={isDark} variant={typeFilter === t ? 'primary' : 'outline'} size="sm" onClick={() => setTypeFilter(t)}>
            {t || tr('الكل', 'All')}
          </CVisionButton>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.length === 0 && <p style={{ textAlign: 'center', color: C.textMuted, padding: '32px 0' }}>{tr('لا توجد إشعارات.', 'No notifications.')}</p>}
        {notifications.map(n => (
          <CVisionCard C={C} key={n.notificationId} style={{ opacity: n.readAt ? 0.6 : 1 }}>
            <CVisionCardBody>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {!n.readAt && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue, marginTop: 6, flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <CVisionBadge C={C} variant={TYPE_VARIANTS[n.type] || 'muted'} style={{ fontSize: 9 }}>{n.type}</CVisionBadge>
                    <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{n.title}</span>
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{n.body}</p>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                {!n.readAt && (
                  <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<Eye size={12} />} onClick={() => markRead(n.notificationId)} />
                )}
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
