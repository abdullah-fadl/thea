'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTabs, CVisionTabContent , CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import { toast } from 'sonner';
import { Target, BarChart3, Users, PlusCircle, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = { ON_TRACK: 'bg-green-100 text-green-800', AT_RISK: 'bg-yellow-100 text-yellow-800', BEHIND: 'bg-red-100 text-red-800', COMPLETED: 'bg-blue-100 text-blue-800' };
const LEVEL_COLORS: Record<string, string> = { COMPANY: 'bg-purple-100 text-purple-800', DEPARTMENT: 'bg-blue-100 text-blue-800', TEAM: 'bg-teal-100 text-teal-800', INDIVIDUAL: 'bg-gray-100 text-gray-800' };

export default function PerformancePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();
  const [showCreateOkr, setShowCreateOkr] = useState(false);
  const [form, setForm] = useState({ title: '', titleAr: '', level: 'INDIVIDUAL', keyResults: [{ description: '', target: 100, metricType: 'PERCENTAGE' }] });

  const { data: myOkrsRaw, isLoading: loadingMyOkrs } = useQuery({
    queryKey: cvisionKeys.performance.list({ action: 'my-okrs' }),
    queryFn: () => cvisionFetch('/api/cvision/performance', { params: { action: 'my-okrs' } }),
  });
  const myOkrs = (myOkrsRaw as any)?.data || [];

  const { data: companyOkrsRaw, isLoading: loadingCompanyOkrs } = useQuery({
    queryKey: cvisionKeys.performance.list({ action: 'company-okrs' }),
    queryFn: () => cvisionFetch('/api/cvision/performance', { params: { action: 'company-okrs' } }),
  });
  const companyOkrs = (companyOkrsRaw as any)?.data || [];

  const { data: kpisRaw } = useQuery({
    queryKey: cvisionKeys.performance.list({ action: 'kpi-dashboard' }),
    queryFn: () => cvisionFetch('/api/cvision/performance', { params: { action: 'kpi-dashboard' } }),
  });
  const kpis = (kpisRaw as any)?.data || [];

  const { data: cyclesRaw } = useQuery({
    queryKey: cvisionKeys.performance.list({ action: 'review-status' }),
    queryFn: () => cvisionFetch('/api/cvision/performance', { params: { action: 'review-status' } }),
  });
  const cycles = (cyclesRaw as any)?.data || [];

  const loading = loadingMyOkrs || loadingCompanyOkrs;

  const createOkrMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate('/api/cvision/performance', 'POST', payload),
    onSuccess: () => {
      toast.success(tr('تم إنشاء الهدف', 'Objective created'));
      setShowCreateOkr(false);
      queryClient.invalidateQueries({ queryKey: cvisionKeys.performance.all });
    },
    onError: (err: any) => toast.error(err.message || 'Error'),
  });

  const handleCreateOkr = async () => {
    if (!form.title) { toast.error(tr('العنوان مطلوب', 'Title required')); return; }
    createOkrMutation.mutate({ action: 'create-objective', ...form });
  };

  const updateProgressMutation = useMutation({
    mutationFn: (payload: any) => cvisionMutate('/api/cvision/performance', 'POST', payload),
    onSuccess: (d: any) => {
      toast.success(tr(`التقدم: ${d.data?.overallProgress}%`, `Progress: ${d.data?.overallProgress}%`));
      queryClient.invalidateQueries({ queryKey: cvisionKeys.performance.all });
    },
    onError: (err: any) => toast.error(err.message || 'Error'),
  });

  const handleUpdateProgress = async (objectiveId: string, krId: string) => {
    const val = prompt(tr('أدخل القيمة الحالية:', 'Enter current value:'));
    if (!val) return;
    updateProgressMutation.mutate({ action: 'update-progress', objectiveId, krId, current: parseFloat(val) });
  };

  const levelLabel = (level: string) => {
    const map: Record<string, string> = { COMPANY: tr('الشركة', 'Company'), DEPARTMENT: tr('القسم', 'Department'), TEAM: tr('الفريق', 'Team'), INDIVIDUAL: tr('فردي', 'Individual') };
    return map[level] || level;
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = { ON_TRACK: tr('على المسار', 'On Track'), AT_RISK: tr('في خطر', 'At Risk'), BEHIND: tr('متأخر', 'Behind'), COMPLETED: tr('مكتمل', 'Completed') };
    return map[status] || status;
  };

  if (loading) return <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}><CVisionSkeletonCard C={C} height={200} style={{ height: 32, width: 240 }}  /><CVisionSkeletonCard C={C} height={200} style={{ height: 256 }}  /></div>;

  const allOkrs = [...companyOkrs, ...myOkrs];

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }} dir={isRTL ? 'rtl' : 'ltr'}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><h1 style={{ fontSize: 24, fontWeight: 700 }}>{tr('إدارة الأداء', 'Performance Management')}</h1>
        <CVisionButton C={C} isDark={isDark} onClick={() => setShowCreateOkr(!showCreateOkr)}><PlusCircle style={{ height: 16, width: 16, marginInlineEnd: 4 }} />{showCreateOkr ? tr('إلغاء', 'Cancel') : tr('هدف جديد', 'New Objective')}</CVisionButton>
      </div>

      <CVisionTabs C={C} isRTL={isRTL} defaultTab="okrs" tabs={[
          { id: 'okrs', label: tr('الأهداف والنتائج', 'OKRs'), icon: Target },
          { id: 'kpis', label: tr('مؤشرات الأداء', 'KPIs'), icon: BarChart3 },
          { id: 'reviews', label: tr('المراجعات', 'Reviews'), icon: Users },
        ]}>

        <CVisionTabContent tabId="okrs">
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {showCreateOkr && <CVisionCard C={C}><CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('إنشاء هدف', 'Create Objective')}</div></CVisionCardHeader><CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}><CVisionInput C={C} placeholder={tr('العنوان بالإنجليزية', 'Title (English)')} value={form.title} onChange={e => setForm({...form, title: e.target.value})} /><CVisionInput C={C} placeholder={tr('العنوان بالعربية', 'Title (Arabic)')} dir="rtl" value={form.titleAr} onChange={e => setForm({...form, titleAr: e.target.value})} /></div>
            <select style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, fontSize: 13, width: '100%' }} value={form.level} onChange={e => setForm({...form, level: e.target.value})}>{['COMPANY','DEPARTMENT','TEAM','INDIVIDUAL'].map(l => <option key={l} value={l}>{levelLabel(l)}</option>)}</select>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{form.keyResults.map((kr, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}><CVisionInput C={C} placeholder={tr(`نتيجة رئيسية ${i+1}`, `Key Result ${i+1}`)} value={kr.description} onChange={e => { const krs = [...form.keyResults]; krs[i] = {...krs[i], description: e.target.value}; setForm({...form, keyResults: krs}); }} /><CVisionInput C={C} type="number" style={{ width: 80 }} value={kr.target} onChange={e => { const krs = [...form.keyResults]; krs[i] = {...krs[i], target: parseInt(e.target.value)}; setForm({...form, keyResults: krs}); }} /></div>
            ))}<CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setForm({...form, keyResults: [...form.keyResults, { description: '', target: 100, metricType: 'PERCENTAGE' }]})}>{tr('+ نتيجة رئيسية', '+ Key Result')}</CVisionButton></div>
            <CVisionButton C={C} isDark={isDark} onClick={handleCreateOkr}>{tr('إنشاء', 'Create')}</CVisionButton>
          </CVisionCardBody></CVisionCard>}

          {allOkrs.length === 0 && <p style={{ color: C.textMuted, textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد أهداف.', 'No objectives found.')}</p>}
          {allOkrs.map(okr => (
            <CVisionCard C={C} key={okr.objectiveId}><CVisionCardBody style={{ paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><CVisionBadge C={C} className={`text-[10px] ${LEVEL_COLORS[okr.level]||''}`}>{levelLabel(okr.level)}</CVisionBadge><span style={{ fontWeight: 500, fontSize: 13 }}>{isRTL ? (okr.titleAr || okr.title) : okr.title}</span><CVisionBadge C={C} className={`text-[10px] ${STATUS_COLORS[okr.status]||''}`}>{statusLabel(okr.status)}</CVisionBadge><span style={{ fontSize: 13, fontWeight: 700 }}>{okr.overallProgress}%</span></div>
              <div style={{ width: '100%', background: C.bgSubtle, borderRadius: '50%', height: 8, marginBottom: 8 }}><div className={`h-2 rounded-full transition-all ${okr.overallProgress >= 70 ? 'bg-green-500' : okr.overallProgress >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${okr.overallProgress}%` }} /></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{(okr.keyResults || []).map((kr: any) => (
                <div key={kr.krId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><CVisionBadge C={C} className={`text-[9px] ${STATUS_COLORS[kr.status]||''}`}>{statusLabel(kr.status)}</CVisionBadge><span style={{ flex: 1 }}>{kr.description}</span><span style={{ color: C.textMuted }}>{kr.current}/{kr.target}</span><span style={{ fontWeight: 500 }}>{kr.progress}%</span><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" style={{ height: 20, paddingLeft: 4, paddingRight: 4 }} onClick={() => handleUpdateProgress(okr.objectiveId, kr.krId)}>{tr('تحديث', 'Update')}</CVisionButton></div>
              ))}</div>
            </CVisionCardBody></CVisionCard>
          ))}
          </div>
        </CVisionTabContent>

        <CVisionTabContent tabId="kpis">
          <div style={{ marginTop: 16 }}>
          {kpis.length === 0 ? <p style={{ color: C.textMuted, textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد مؤشرات أداء.', 'No KPIs defined.')}</p> :
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 12 }}>{kpis.map(kpi => {
            const lastRecord = kpi.records?.[kpi.records.length - 1];
            const achievement = lastRecord?.achievement || 0;
            return (
              <CVisionCard C={C} key={kpi.kpiId}><CVisionCardBody style={{ paddingTop: 16, paddingBottom: 16, textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 8 }}><svg viewBox="0 0 36 36" style={{ width: 80, height: 80 }}><circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" className="text-muted" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke={achievement >= 80 ? '#16a34a' : achievement >= 50 ? '#eab308' : '#dc2626'} strokeWidth="3" strokeDasharray={`${achievement} ${100-achievement}`} strokeLinecap="round" /></svg><div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{achievement}%</div></div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{isRTL ? (kpi.nameAr || kpi.name) : kpi.name}</div>
                {kpi.nameAr && !isRTL && <div style={{ fontSize: 12, color: C.textMuted }} dir="rtl">{kpi.nameAr}</div>}
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('المستهدف', 'Target')}: {kpi.target} {kpi.unit} | {kpi.frequency}</div>
              </CVisionCardBody></CVisionCard>
            );
          })}</div>}
          </div>
        </CVisionTabContent>

        <CVisionTabContent tabId="reviews">
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cycles.length === 0 ? <p style={{ color: C.textMuted, textAlign: 'center', paddingTop: 32, paddingBottom: 32 }}>{tr('لا توجد دورات مراجعة.', 'No review cycles.')}</p> :
          cycles.map(c => (
            <CVisionCard C={C} key={c.cycleId}><CVisionCardBody style={{ paddingTop: 12, paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontWeight: 500 }}>{c.name}</span><CVisionBadge C={C} variant="outline" className="text-[10px]">{c.period}</CVisionBadge><CVisionBadge C={C} className={c.status === 'ACTIVE' ? 'bg-green-100 text-green-800 text-[10px]' : 'bg-gray-100 text-[10px]'}>{c.status === 'ACTIVE' ? tr('نشط', 'Active') : c.status}</CVisionBadge><span style={{ fontSize: 12, color: C.textMuted }}>{(c.reviews || []).length} {tr('مراجعة', 'reviews')}</span></div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{tr('الأوزان', 'Weights')}: {tr('ذاتي', 'Self')} {c.selfReviewWeight}% | {tr('المدير', 'Manager')} {c.managerReviewWeight}% | {tr('الزملاء', 'Peer')} {c.peerReviewWeight}%</div>
              {(c.reviews || []).length > 0 && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>{(c.reviews || []).slice(0, 5).map((r: any) => (
                <div key={r.employeeId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}><span>{r.employeeName || r.employeeId}</span><CVisionBadge C={C} className="text-[9px]">{r.status}</CVisionBadge>{r.overallScore != null && <span style={{ fontWeight: 700 }}>{r.overallScore}%</span>}</div>
              ))}</div>}
            </CVisionCardBody></CVisionCard>
          ))}
          </div>
        </CVisionTabContent>
      </CVisionTabs>
    </div>
  );
}
