'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton,
  CVisionInput,
  CVisionBadge,
  CVisionSelect,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionSkeletonCard, CVisionSkeletonStyles,
  CVisionEmptyState, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { CalendarDays, Clock, CheckCircle, XCircle, PlusCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

const LEAVE_TYPES = ['ANNUAL','SICK','EMERGENCY','MATERNITY','PATERNITY','UNPAID','HAJJ','MARRIAGE','BEREAVEMENT'];

export default function LeavesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: 'ANNUAL', startDate: '', endDate: '', days: 1, reason: '' });

  const { data: rawData, isLoading: loading } = useQuery({
    queryKey: cvisionKeys.selfService.list({ action: 'my-leaves' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/self-service', { params: { action: 'my-leaves' } }),
  });
  const data = rawData?.ok ? rawData.data : { leaves: [], balance: {} };

  const handleSubmit = async () => {
    if (!form.startDate || !form.endDate) { toast.error(tr('التواريخ مطلوبة', 'Dates required')); return; }
    const d = await cvisionMutate<any>('/api/cvision/self-service', 'POST', { action: 'request-leave', ...form });
    d.ok ? (toast.success(tr('تم طلب الاجازة', 'Leave requested')), setShowForm(false), queryClient.invalidateQueries({ queryKey: cvisionKeys.selfService.all })) : toast.error(d.error);
  };

  if (loading) return (
    <CVisionPageLayout>
      <CVisionSkeletonStyles />
      <CVisionSkeletonCard C={C} height={260} />
    </CVisionPageLayout>
  );

  const bal = data.balance || {};

  const statusVariant = (s: string) => s === 'APPROVED' ? 'success' as const : s === 'REJECTED' ? 'danger' as const : 'warning' as const;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('اجازاتي', 'My Leaves')}
        titleEn={isRTL ? 'My Leaves' : undefined}
        icon={CalendarDays}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant={showForm ? 'outline' : 'primary'} icon={showForm ? XCircle : PlusCircle} onClick={() => setShowForm(!showForm)}>
            {showForm ? tr('الغاء', 'Cancel') : tr('طلب اجازة', 'Request Leave')}
          </CVisionButton>
        }
      />

      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('سنوية', 'Annual')} value={bal.annual ?? 21} icon={CalendarDays} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('مرضية', 'Sick')} value={bal.sick ?? 30} icon={Clock} color={C.orange} colorDim={C.orangeDim} />
        <CVisionMiniStat C={C} label={tr('المتبقي', 'Remaining')} value={bal.remaining ?? 21} icon={CheckCircle} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('المستخدم', 'Used')} value={bal.used ?? 0} icon={XCircle} color={C.red} colorDim={C.redDim} />
      </CVisionStatsRow>

      {showForm && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('طلب اجازة جديد', 'New Leave Request')}</span>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <CVisionSelect
              C={C}
              label={tr('نوع الاجازة', 'Leave Type')}
              value={form.leaveType}
              onChange={v => setForm({ ...form, leaveType: v })}
              options={LEAVE_TYPES.map(t => ({ value: t, label: t }))}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <CVisionInput C={C} type="date" label={tr('تاريخ البداية', 'Start Date')} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              <CVisionInput C={C} type="date" label={tr('تاريخ النهاية', 'End Date')} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <CVisionInput C={C} type="number" label={tr('عدد الايام', 'Days')} value={String(form.days)} onChange={e => setForm({ ...form, days: parseInt(e.target.value) })} />
            <CVisionInput C={C} label={tr('السبب', 'Reason')} placeholder={tr('سبب الاجازة', 'Reason for leave')} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
            <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleSubmit}>{tr('ارسال', 'Submit')}</CVisionButton>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('سجل الاجازات', 'Leave History')}</span>
        </CVisionCardHeader>
        <CVisionCardBody>
          {data.leaves.length === 0 ? (
            <CVisionEmptyState C={C} icon={FileText} title={tr('لا يوجد سجل اجازات', 'No leave history.')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.leaves.map((l: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, borderBottom: `1px solid ${C.border}`, paddingBottom: 10, flexWrap: 'wrap' }}>
                  <CVisionBadge C={C} variant={statusVariant(l.status)}>{l.status}</CVisionBadge>
                  <CVisionBadge C={C} variant="muted">{l.type}</CVisionBadge>
                  <span style={{ color: C.text }}>{l.startDate} → {l.endDate}</span>
                  <span style={{ color: C.textMuted }}>({l.days} {tr('ايام', 'days')})</span>
                </div>
              ))}
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>
    </CVisionPageLayout>
  );
}
