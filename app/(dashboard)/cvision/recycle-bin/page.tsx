'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionPageLayout, CVisionPageHeader, CVisionCard, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionSkeletonCard, CVisionEmptyState,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd,
  CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { Trash2, RotateCcw, Clock, AlertTriangle } from 'lucide-react';
import EmptyState from '@/components/cvision/EmptyState';
import { EMPTY_STATES } from '@/components/cvision/EmptyState';
import { toast } from 'sonner';

interface DeletedItem {
  id: string;
  sourceCollectionLabel: string;
  title: string;
  deletedByName: string;
  deletedAt: string;
  expiresAt: string;
}

const api = (params: Record<string, string>, signal?: AbortSignal) => {
  const sp = new URLSearchParams(params);
  return fetch(`/api/cvision/undo?${sp}`, { credentials: 'include', signal }).then(r => r.json());
};
const post = (body: any) =>
  fetch('/api/cvision/undo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  }).then(r => r.json());

export default function RecycleBinPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteTitle, setConfirmDeleteTitle] = useState('');

  const { data: binData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.recycleBin.list({ page }),
    queryFn: () => cvisionFetch<any>('/api/cvision/undo', { params: { action: 'recycle-bin', page: String(page), limit: '20' } }),
  });
  const items = binData?.success ? (binData.data?.items || []) as DeletedItem[] : [];
  const total = binData?.success ? (binData.data?.total || 0) : 0;
  const hasMore = binData?.success ? (binData.data?.hasMore || false) : false;

  const invalidateBin = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.recycleBin.all });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => cvisionMutate<any>('/api/cvision/undo', 'POST', { action: 'restore', deletedRecordId: id }),
    onSuccess: (res) => { res.success ? (toast.success(res.data?.description || tr('تم الاستعادة', 'Item restored')), invalidateBin()) : toast.error(res.error || tr('فشل في الاستعادة', 'Failed to restore')); },
    onError: () => toast.error(tr('فشل في استعادة العنصر', 'Failed to restore item')),
  });
  const handleRestore = (id: string) => restoreMutation.mutate(id);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cvisionMutate<any>('/api/cvision/undo', 'POST', { action: 'permanent-delete', deletedRecordId: id }),
    onSuccess: (res) => { res.success ? (toast.success(tr('تم الحذف نهائيا', 'Permanently deleted')), invalidateBin()) : toast.error(res.error || tr('فشل في الحذف', 'Failed to delete')); },
    onError: () => toast.error(tr('فشل في الحذف النهائي', 'Failed to permanently delete')),
    onSettled: () => setConfirmDeleteId(null),
  });
  const handlePermanentDelete = (id: string) => deleteMutation.mutate(id);

  function daysUntilExpiry(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <CVisionPageLayout style={{ maxWidth: 960, margin: '0 auto' }}>
      <CVisionPageHeader
        C={C}
        title={tr('سلة المحذوفات', 'Recycle Bin')}
        titleEn="Recycle Bin"
        subtitle={tr(
          `العناصر المحذوفة تبقى لمدة 30 يوما قبل الحذف النهائي.${total > 0 ? ` ${total} عنصر في السلة.` : ''}`,
          `Deleted items are kept for 30 days before permanent removal.${total > 0 ? ` ${total} item${total !== 1 ? 's' : ''} in bin.` : ''}`
        )}
        icon={Trash2}
        isRTL={isRTL}
      />

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <CVisionSkeletonCard key={i} C={C} height={56} />)}
        </div>
      )}

      {!loading && items.length === 0 && (
        <CVisionEmptyState
          C={C}
          icon={Trash2}
          title={tr('سلة المحذوفات فارغة', 'Recycle bin is empty')}
          description={tr('لا توجد عناصر محذوفة حاليا', 'No deleted items at this time')}
        />
      )}

      {!loading && items.length > 0 && (
        <>
          <CVisionCard C={C}>
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
                <CVisionTh C={C}>{tr('الاسم', 'Name')}</CVisionTh>
                <CVisionTh C={C}>{tr('حُذف بواسطة', 'Deleted By')}</CVisionTh>
                <CVisionTh C={C}>{tr('تاريخ الحذف', 'Deleted At')}</CVisionTh>
                <CVisionTh C={C}>{tr('ينتهي خلال', 'Expires In')}</CVisionTh>
                <CVisionTh C={C} align="right">{tr('الإجراءات', 'Actions')}</CVisionTh>
              </CVisionTableHead>
              <CVisionTableBody>
                {items.map((item) => {
                  const days = daysUntilExpiry(item.expiresAt);
                  return (
                    <CVisionTr C={C} key={item.id}>
                      <CVisionTd>
                        <CVisionBadge C={C} variant="muted">{item.sourceCollectionLabel}</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd style={{ fontWeight: 500, color: C.text }}>{item.title}</CVisionTd>
                      <CVisionTd style={{ color: C.textMuted }}>{item.deletedByName}</CVisionTd>
                      <CVisionTd style={{ color: C.textMuted, fontSize: 12 }}>{formatDate(item.deletedAt)}</CVisionTd>
                      <CVisionTd>
                        <CVisionBadge C={C} variant={days <= 3 ? 'danger' : days <= 7 ? 'warning' : 'muted'} dot>
                          <Clock size={12} style={{ marginRight: 4 }} />{days}{tr('ي', 'd')}
                        </CVisionBadge>
                      </CVisionTd>
                      <CVisionTd align="right">
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => handleRestore(item.id)} icon={<RotateCcw size={14} />}>
                            {tr('استعادة', 'Restore')}
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" onClick={() => { setConfirmDeleteId(item.id); setConfirmDeleteTitle(item.title); }} icon={<Trash2 size={14} />}>
                            {tr('حذف', 'Delete')}
                          </CVisionButton>
                        </div>
                      </CVisionTd>
                    </CVisionTr>
                  );
                })}
              </CVisionTableBody>
            </CVisionTable>
          </CVisionCard>

          {(hasMore || page > 1) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {tr('السابق', 'Previous')}
              </CVisionButton>
              <span style={{ fontSize: 13, color: C.textMuted, padding: '0 8px' }}>
                {tr(`صفحة ${page}`, `Page ${page}`)}
              </span>
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
                {tr('التالي', 'Next')}
              </CVisionButton>
            </div>
          )}
        </>
      )}

      {/* Confirm Delete Dialog */}
      <CVisionDialog
        C={C}
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title={tr('حذف نهائي؟', 'Permanently Delete?')}
        titleAr="حذف نهائي؟"
        isRTL={isRTL}
        width={440}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <AlertTriangle size={20} color={C.red} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6 }}>
            {tr(
              `سيتم حذف "${confirmDeleteTitle}" نهائيا. لا يمكن التراجع عن هذا الإجراء.`,
              `This will permanently delete "${confirmDeleteTitle}". This action cannot be undone.`
            )}
          </div>
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setConfirmDeleteId(null)}>
            {tr('إلغاء', 'Cancel')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={() => confirmDeleteId && handlePermanentDelete(confirmDeleteId)}>
            {tr('حذف نهائي', 'Delete Forever')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
