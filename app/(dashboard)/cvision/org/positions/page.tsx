'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea, CVisionLabel, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard, CVisionSkeletonStyles } from '@/components/cvision/ui';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Briefcase } from 'lucide-react';

interface Position {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function PositionsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', title: '', description: '' });
  const { toast } = useToast();

  const { data: posRaw, isLoading: loading, refetch: refetchPositions } = useQuery({
    queryKey: cvisionKeys.positions.list(),
    queryFn: () => cvisionFetch('/api/cvision/positions'),
  });
  const positions: Position[] = posRaw?.data?.items || posRaw?.data || [];

  function openCreateDialog() { setEditingId(null); setForm({ code: '', title: '', description: '' }); setDialogOpen(true); }
  function openEditDialog(position: Position) { setEditingId(position.id); setForm({ code: position.code, title: position.title, description: position.description || '' }); setDialogOpen(true); }

  const saveMutation = useMutation({
    mutationFn: (data: { editingId: string | null; form: typeof form }) => {
      const url = data.editingId ? `/api/cvision/positions/${data.editingId}` : '/api/cvision/positions';
      const method = data.editingId ? 'PATCH' : 'POST';
      return cvisionMutate(url, method as 'POST' | 'PATCH', data.form);
    },
    onSuccess: (_data, variables) => {
      toast({ title: tr('نجاح', 'Success'), description: variables.editingId ? tr('تم تحديث المنصب', 'Position updated') : tr('تم انشاء المنصب', 'Position created') });
      setDialogOpen(false);
      refetchPositions();
    },
    onError: (err: any) => {
      toast({ title: tr('خطأ', 'Error'), description: err?.data?.error || tr('فشل حفظ المنصب', 'Failed to save position'), variant: 'destructive' });
    },
  });

  function savePosition() {
    if (!form.code || !form.title) { toast({ title: tr('خطأ', 'Error'), description: tr('الرمز والعنوان مطلوبان', 'Code and Title are required'), variant: 'destructive' }); return; }
    saveMutation.mutate({ editingId, form });
  }

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={300} />
    </CVisionPageLayout>
  );

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('المناصب', 'Positions')}
        titleEn={isRTL ? 'Positions' : undefined}
        subtitle={tr('ادارة انواع المناصب', 'Manage position types')}
        icon={Briefcase}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={Plus} onClick={openCreateDialog}>
            {tr('اضافة منصب', 'Add Position')}
          </CVisionButton>
        }
      />

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('انواع المناصب', 'Position Types')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('الرمز', 'Code')}</CVisionTh>
              <CVisionTh C={C}>{tr('العنوان', 'Title')}</CVisionTh>
              <CVisionTh C={C}>{tr('الوصف', 'Description')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C} width={80}>{tr('اجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {positions.length === 0 ? (
                <CVisionTr C={C}>
                  <CVisionTd style={{ textAlign: 'center', color: C.textMuted }} colSpan={5}>
                    {tr('لا توجد مناصب. انشئ اول منصب.', 'No positions found. Create your first position.')}
                  </CVisionTd>
                </CVisionTr>
              ) : (
                positions.map(pos => (
                  <CVisionTr key={pos.id} C={C}>
                    <CVisionTd><span style={{ fontFamily: 'monospace', fontSize: 12, color: C.text }}>{pos.code}</span></CVisionTd>
                    <CVisionTd><span style={{ fontWeight: 500, color: C.text }}>{pos.title}</span></CVisionTd>
                    <CVisionTd><span style={{ fontSize: 12, color: C.textMuted }}>{pos.description || '-'}</span></CVisionTd>
                    <CVisionTd><CVisionBadge C={C} variant={pos.isActive ? 'success' : 'muted'}>{pos.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge></CVisionTd>
                    <CVisionTd>
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => openEditDialog(pos)}><Edit size={16} /></CVisionButton>
                    </CVisionTd>
                  </CVisionTr>
                ))
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      <CVisionDialog C={C} open={dialogOpen} onClose={() => setDialogOpen(false)} title={editingId ? tr('تعديل المنصب', 'Edit Position') : tr('انشاء منصب', 'Create Position')} isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CVisionInput C={C} label={`${tr('الرمز', 'Code')} *`} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="STAFF_NURSE" disabled={!!editingId} />
          <CVisionInput C={C} label={`${tr('العنوان', 'Title')} *`} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Staff Nurse" />
          <CVisionTextarea C={C} label={tr('الوصف', 'Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={tr('وصف المنصب...', 'Position description...')} />
        </div>
        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDialogOpen(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" loading={saveMutation.isPending} disabled={saveMutation.isPending || !form.code || !form.title} onClick={savePosition}>
            {editingId ? tr('تحديث', 'Update') : tr('انشاء', 'Create')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
