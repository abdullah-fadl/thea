'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionSkeletonCard,
  CVisionTabs, CVisionTabContent, CVisionSelect,
  type CVisionTabItem, type CVisionSelectOption, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Plane, Receipt, PlusCircle, Check, X } from 'lucide-react';

const STATUS_VARIANTS: Record<string, 'muted' | 'info' | 'success' | 'danger' | 'purple'> = {
  DRAFT: 'muted', SUBMITTED: 'info', APPROVED: 'success', REJECTED: 'danger', COMPLETED: 'purple',
};

export default function TravelPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ destination: '', purpose: '', startDate: '', endDate: '', travelType: 'DOMESTIC', estimatedCost: 0 });
  const [activeTab, setActiveTab] = useState('my');

  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: cvisionKeys.travel.list({ action: 'my-requests' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/travel', { params: { action: 'my-requests' } }),
  });
  const { data: pendingData } = useQuery({
    queryKey: cvisionKeys.travel.list({ action: 'pending-approval' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/travel', { params: { action: 'pending-approval' } }).catch(() => ({ ok: false })),
  });
  const { data: reportData } = useQuery({
    queryKey: cvisionKeys.travel.list({ action: 'report' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/travel', { params: { action: 'report' } }).catch(() => ({ ok: false })),
  });

  const myRequests = myData?.ok ? (myData.data || []) : [];
  const pendingApproval = pendingData?.ok ? (pendingData.data || []) : [];
  const report = reportData?.ok ? reportData.data : null;
  const loading = myLoading;

  const invalidateTravel = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.travel.all });

  const handleCreate = async () => {
    if (!form.destination) { toast.error(tr('الوجهة مطلوبة', 'Destination required')); return; }
    const d = await cvisionMutate<any>('/api/cvision/travel', 'POST', { action: 'create-request', ...form });
    d.ok ? (toast.success(tr('تم إنشاء طلب السفر', 'Travel request created')), setShowCreate(false), invalidateTravel()) : toast.error(d.error);
  };

  const handleAction = async (travelId: string, act: string) => {
    const d = await cvisionMutate<any>('/api/cvision/travel', 'POST', { action: act, travelId });
    d.ok ? (toast.success(tr('تم التنفيذ', `${act}d`)), invalidateTravel()) : toast.error(d.error);
  };

  if (loading) return <div style={{ padding: 24 }}><CVisionSkeletonCard C={C} height={260} /></div>;

  const tabs: CVisionTabItem[] = [
    { id: 'my', label: tr('طلباتي', 'My Requests') },
    { id: 'approval', label: `${tr('الموافقات', 'Approvals')} (${pendingApproval.length})` },
  ];

  const travelTypeOptions: CVisionSelectOption[] = [
    { value: 'DOMESTIC', label: tr('محلي', 'Domestic') },
    { value: 'INTERNATIONAL', label: tr('دولي', 'International') },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('السفر والمصاريف', 'Travel & Expenses')}
        titleEn="Travel & Expenses"
        icon={Plane}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant={showCreate ? 'outline' : 'primary'} icon={<PlusCircle size={14} />} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? tr('إلغاء', 'Cancel') : tr('طلب جديد', 'New Request')}
          </CVisionButton>
        }
      />

      {/* Report Stats */}
      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Plane size={20} color={C.blue} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{report.totalTrips}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('رحلات', 'Trips')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Receipt size={20} color={C.green} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{report.totalExpenses}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مصاريف', 'Expenses')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{(report.totalSpend || 0).toLocaleString()}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{tr('إجمالي الإنفاق (ر.س)', 'Total Spend (SAR)')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
          <CVisionCard C={C}><CVisionCardBody>
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.entries(report.byCategory || {}).map(([k, v]) => (
                  <CVisionBadge key={k} C={C} variant="muted" style={{ fontSize: 9 }}>{k}: {Number(v).toLocaleString()}</CVisionBadge>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{tr('حسب الفئة', 'By Category')}</div>
            </div>
          </CVisionCardBody></CVisionCard>
        </div>
      )}

      <CVisionTabs C={C} tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* My Requests Tab */}
      <CVisionTabContent id="my" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showCreate && (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('طلب سفر جديد', 'New Travel Request')}</div>
              </CVisionCardHeader>
              <CVisionCardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <CVisionInput C={C} placeholder={tr('الوجهة', 'Destination')} value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} />
                    <CVisionInput C={C} placeholder={tr('الغرض', 'Purpose')} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <CVisionInput C={C} label={tr('البداية', 'Start')} type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                    <CVisionInput C={C} label={tr('النهاية', 'End')} type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                    <CVisionInput C={C} label={tr('التكلفة المتوقعة', 'Est. Cost')} type="number" value={String(form.estimatedCost)} onChange={e => setForm({ ...form, estimatedCost: parseInt(e.target.value) })} />
                  </div>
                  <CVisionSelect C={C} options={travelTypeOptions} value={form.travelType} onChange={v => setForm({ ...form, travelType: v })} />
                  <CVisionButton C={C} isDark={isDark} onClick={handleCreate}>{tr('تقديم', 'Submit')}</CVisionButton>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          )}
          {myRequests.map(r => (
            <CVisionCard C={C} key={r.travelId}>
              <CVisionCardBody>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <CVisionBadge C={C} variant={STATUS_VARIANTS[r.status] || 'muted'} style={{ fontSize: 9 }}>{r.status}</CVisionBadge>
                  <CVisionBadge C={C} variant="muted" style={{ fontSize: 9 }}>{r.travelType}</CVisionBadge>
                  <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{r.destination}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{r.purpose}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{r.startDate} — {r.endDate}</span>
                </div>
                {r.estimatedCost > 0 && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{tr('التكلفة المتوقعة', 'Est')}: {r.estimatedCost.toLocaleString()} {tr('ر.س', 'SAR')}</div>}
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      </CVisionTabContent>

      {/* Approvals Tab */}
      <CVisionTabContent id="approval" activeTab={activeTab}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pendingApproval.length === 0
            ? <p style={{ textAlign: 'center', color: C.textMuted, padding: '32px 0' }}>{tr('لا توجد موافقات معلقة.', 'No pending approvals.')}</p>
            : pendingApproval.map(r => (
              <CVisionCard C={C} key={r.travelId}>
                <CVisionCardBody>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{r.employeeName}</span>
                    <span style={{ fontSize: 13, color: C.textSecondary }}>{'\u2192'} {r.destination}</span>
                    <CVisionBadge C={C} variant="muted" style={{ fontSize: 9 }}>{r.travelType}</CVisionBadge>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{r.estimatedCost?.toLocaleString()} {tr('ر.س', 'SAR')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <CVisionButton C={C} isDark={isDark} size="sm" icon={<Check size={12} />} onClick={() => handleAction(r.travelId, 'approve')}>
                      {tr('موافقة', 'Approve')}
                    </CVisionButton>
                    <CVisionButton C={C} isDark={isDark} variant="danger" size="sm" icon={<X size={12} />} onClick={() => handleAction(r.travelId, 'reject')}>
                      {tr('رفض', 'Reject')}
                    </CVisionButton>
                  </div>
                </CVisionCardBody>
              </CVisionCard>
            ))
          }
        </div>
      </CVisionTabContent>
    </CVisionPageLayout>
  );
}
