'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea,
  CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow,
  CVisionSkeletonCard, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { toast } from 'sonner';
import { Shield, AlertTriangle, Clock, CheckCircle2, PlusCircle } from 'lucide-react';

export default function GrievancesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();

  const [showSubmit, setShowSubmit] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState({ subject: '', description: '', category: 'OTHER', anonymous: false });

  const statusVariant = (s: string) => s === 'RESOLVED' || s === 'CLOSED' ? 'success' as const : s === 'ESCALATED' ? 'danger' as const : s === 'INVESTIGATING' ? 'warning' as const : 'info' as const;
  const sevVariant = (s: string) => s === 'CRITICAL' || s === 'HIGH' ? 'danger' as const : s === 'MEDIUM' ? 'warning' as const : 'success' as const;

  const safeFetch = (url: string, params: Record<string, string>) =>
    cvisionFetch<any>(url, { params }).catch(() => ({ ok: false }));

  const { data: gData, isLoading: gLoading } = useQuery({
    queryKey: cvisionKeys.grievances.list({ view: 'list' }),
    queryFn: () => safeFetch('/api/cvision/grievances', { action: 'list' }),
  });
  const { data: mData, isLoading: mLoading } = useQuery({
    queryKey: cvisionKeys.grievances.list({ view: 'my-grievances' }),
    queryFn: () => safeFetch('/api/cvision/grievances', { action: 'my-grievances' }),
  });
  const { data: rData, isLoading: rLoading } = useQuery({
    queryKey: cvisionKeys.grievances.list({ view: 'report' }),
    queryFn: () => safeFetch('/api/cvision/grievances', { action: 'report' }),
  });

  const grievances = gData?.ok ? (gData.data || []) : [];
  const myGrievances = mData?.ok ? (mData.data || []) : [];
  const report = rData?.ok ? rData.data : null;
  const loading = gLoading || mLoading || rLoading;

  const invalidateGrievances = () => queryClient.invalidateQueries({ queryKey: cvisionKeys.grievances.all });

  const submitMutation = useMutation({
    mutationFn: () => cvisionMutate<any>('/api/cvision/grievances', 'POST', { action: 'submit', ...form }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم تقديم الشكوى', 'Grievance submitted')), setShowSubmit(false), invalidateGrievances()) : toast.error(d.error); },
  });
  const handleSubmit = () => {
    if (!form.subject || !form.description) { toast.error(tr('الموضوع والوصف مطلوبان', 'Subject and description required')); return; }
    submitMutation.mutate();
  };

  const resolveMutation = useMutation({
    mutationFn: ({ grievanceId, resolution }: { grievanceId: string; resolution: string }) =>
      cvisionMutate<any>('/api/cvision/grievances', 'POST', { action: 'resolve', grievanceId, resolution }),
    onSuccess: (d) => { d.ok ? (toast.success(tr('تم الحل', 'Resolved')), invalidateGrievances()) : toast.error(d.error); },
  });
  const handleResolve = (grievanceId: string) => {
    const resolution = prompt(tr('القرار:', 'Resolution:'));
    if (!resolution) return;
    resolveMutation.mutate({ grievanceId, resolution });
  };

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  const allGrievances = [...grievances, ...myGrievances.filter(m => !grievances.some((g: any) => g.grievanceId === m.grievanceId))];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('إدارة الشكاوى', 'Grievance Management')} titleEn="Grievance Management" icon={Shield} isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={<PlusCircle size={14} />} onClick={() => setShowSubmit(!showSubmit)}>
            {showSubmit ? tr('إلغاء', 'Cancel') : tr('تقديم شكوى', 'Submit Grievance')}
          </CVisionButton>
        }
      />

      {report && (
        <CVisionStatsRow>
          <CVisionMiniStat C={C} label={tr('الإجمالي', 'Total')} value={report.total} icon={Shield} color={C.blue} colorDim={C.blueDim} />
          <CVisionMiniStat C={C} label={tr('محلولة', 'Resolved')} value={report.byStatus?.RESOLVED || 0} icon={CheckCircle2} color={C.green} colorDim={C.greenDim} />
          <CVisionMiniStat C={C} label={tr('مفتوحة', 'Open')} value={(report.byStatus?.SUBMITTED || 0) + (report.byStatus?.INVESTIGATING || 0)} icon={AlertTriangle} color={C.orange} colorDim={C.orangeDim} />
          <CVisionMiniStat C={C} label={tr('متوسط الحل', 'Avg Resolution')} value={`${report.avgResolutionDays}d`} icon={Clock} color={C.blue} colorDim={C.blueDim} />
        </CVisionStatsRow>
      )}

      {showSubmit && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('تقديم شكوى', 'Submit Grievance')}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionInput C={C} placeholder={tr('الموضوع', 'Subject')} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
              <CVisionTextarea C={C} placeholder={tr('الوصف', 'Description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} />
              <CVisionSelect C={C} label={tr('الفئة', 'Category')} value={form.category} onChange={v => setForm({ ...form, category: v })} options={['HARASSMENT','DISCRIMINATION','SAFETY','PAY','MANAGEMENT','POLICY','WORKPLACE','OTHER'].map(c => ({ value: c, label: c }))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.textSecondary, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.anonymous} onChange={e => setForm({ ...form, anonymous: e.target.checked })} style={{ accentColor: C.gold }} />
                {tr('تقديم مجهول', 'Submit Anonymously')}
              </label>
              <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleSubmit}>{tr('إرسال', 'Submit')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {detail && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{detail.subject}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <CVisionBadge C={C} variant={statusVariant(detail.status)}>{detail.status}</CVisionBadge>
              <CVisionBadge C={C} variant={sevVariant(detail.severity)}>{detail.severity}</CVisionBadge>
              <CVisionBadge C={C} variant="muted">{detail.category}</CVisionBadge>
              {detail.anonymous && <CVisionBadge C={C} variant="muted">{tr('مجهول', 'Anonymous')}</CVisionBadge>}
            </div>
            <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>{detail.description}</p>
            <div style={{ borderLeft: isRTL ? 'none' : `2px solid ${C.blue}40`, borderRight: isRTL ? `2px solid ${C.blue}40` : 'none', paddingLeft: isRTL ? 0 : 12, paddingRight: isRTL ? 12 : 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(detail.timeline || []).map((t: any, i: number) => (
                <div key={i} style={{ fontSize: 12 }}>
                  <span style={{ color: C.textMuted }}>{new Date(t.date).toLocaleString()}</span> — <span style={{ fontWeight: 500, color: C.text }}>{t.action}</span>
                  {t.notes && <span style={{ color: C.textMuted }}> | {t.notes}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {detail.status !== 'RESOLVED' && <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" onClick={() => handleResolve(detail.grievanceId)}>{tr('حل', 'Resolve')}</CVisionButton>}
              <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setDetail(null)}>{tr('إغلاق', 'Close')}</CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allGrievances.map(g => (
          <CVisionCard key={g.grievanceId} C={C} onClick={() => setDetail(g)} style={{ cursor: 'pointer' }}>
            <CVisionCardBody style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <CVisionBadge C={C} variant={statusVariant(g.status)}>{g.status}</CVisionBadge>
                <CVisionBadge C={C} variant={sevVariant(g.severity)}>{g.severity}</CVisionBadge>
                <CVisionBadge C={C} variant="muted">{g.category}</CVisionBadge>
                <span style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{g.subject}</span>
                {g.anonymous && <CVisionBadge C={C} variant="muted">{tr('مجهول', 'Anonymous')}</CVisionBadge>}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{new Date(g.createdAt).toLocaleDateString()}</span>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        ))}
      </div>
    </CVisionPageLayout>
  );
}
