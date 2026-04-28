'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge,
  CVisionInput, CVisionSelect, CVisionPageHeader, CVisionPageLayout, CVisionTabs, CVisionTabContent,
  CVisionDialog, CVisionDialogFooter, CVisionEmptyState,
  CVisionSkeletonCard, CVisionSkeletonStyles,
} from '@/components/cvision/ui';
import type { CVisionTabItem } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  UserMinus, ClipboardCheck, Calculator, MessageSquare, CheckCircle, Clock, AlertTriangle,
} from 'lucide-react';

const api = (endpoint: string, params?: Record<string, string>) =>
  cvisionFetch<any>(endpoint, { params });
const post = (endpoint: string, body: any) =>
  cvisionMutate<any>(endpoint, 'POST', body);

function statusVariant(status: string): 'info' | 'warning' | 'success' | 'danger' | 'muted' {
  switch (status) {
    case 'INITIATED': return 'info';
    case 'IN_PROGRESS': return 'warning';
    case 'CLEARANCE_PENDING': return 'warning';
    case 'FINAL_SETTLEMENT': return 'info';
    case 'COMPLETED': return 'success';
    default: return 'muted';
  }
}

/* ─── Active Processes Tab ─────────────────────────────────────────── */
function ActiveTab({ C, isDark, tr }: any) {
  const queryClient = useQueryClient();
  const [showInitiate, setShowInitiate] = useState(false);
  const [form, setForm] = useState({ employeeId: '', type: 'RESIGNATION', reason: '', lastWorkingDay: '' });

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['cvision', 'offboarding', 'list'],
    queryFn: () => api('/api/cvision/offboarding'),
  });
  const processes = rawData?.success ? rawData.data || [] : [];

  const initiateMut = useMutation({
    mutationFn: (d: any) => post('/api/cvision/offboarding', { action: 'initiate', ...d }),
    onSuccess: () => {
      toast.success(tr('تم بدء إجراء إنهاء الخدمة', 'Offboarding initiated'));
      queryClient.invalidateQueries({ queryKey: ['cvision', 'offboarding'] });
      setShowInitiate(false);
      setForm({ employeeId: '', type: 'RESIGNATION', reason: '', lastWorkingDay: '' });
    },
    onError: (e: any) => toast.error(e?.message || tr('خطأ', 'Error')),
  });

  if (isLoading) return <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={200} /></>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <CVisionButton C={C} onClick={() => setShowInitiate(true)} variant="primary" size="sm">
          {tr('بدء إنهاء خدمة', 'Initiate Offboarding')}
        </CVisionButton>
      </div>

      {processes.length === 0 ? (
        <CVisionEmptyState C={C} icon={UserMinus} title={tr('لا توجد إجراءات إنهاء خدمة', 'No offboarding processes')} />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {processes.map((p: any, i: number) => (
            <CVisionCard key={i} C={C} hover>
              <CVisionCardBody style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.employeeName || p.employeeId}</span>
                    {p.employeeNumber && <span style={{ color: C.textMuted, marginLeft: 8, fontSize: 12 }}>#{p.employeeNumber}</span>}
                  </div>
                  <CVisionBadge C={C} variant={statusVariant(p.status)}>{p.status}</CVisionBadge>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.textMuted }}>
                  <span>{tr('النوع', 'Type')}: {p.type}</span>
                  <span>{tr('آخر يوم عمل', 'Last Working Day')}: {p.lastWorkingDay ? new Date(p.lastWorkingDay).toLocaleDateString() : '-'}</span>
                  {p.checklistProgress && (
                    <span>{tr('التقدم', 'Progress')}: {p.checklistProgress.completed}/{p.checklistProgress.total} ({p.checklistProgress.percent}%)</span>
                  )}
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}

      {showInitiate && (
        <CVisionDialog C={C} open onClose={() => setShowInitiate(false)} title={tr('بدء إنهاء خدمة', 'Initiate Offboarding')}>
          <div style={{ display: 'grid', gap: 12, padding: 16 }}>
            <CVisionInput C={C} label={tr('رقم الموظف', 'Employee ID')} value={form.employeeId}
              onChange={(e: any) => setForm({ ...form, employeeId: e.target.value })} placeholder={tr('أدخل معرف الموظف', 'Enter employee ID')} />
            <CVisionSelect C={C} label={tr('نوع الإنهاء', 'Termination Type')} value={form.type}
              onChange={(e: any) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: 'RESIGNATION', label: tr('استقالة', 'Resignation') },
                { value: 'TERMINATION', label: tr('إنهاء', 'Termination') },
                { value: 'END_OF_CONTRACT', label: tr('انتهاء عقد', 'End of Contract') },
                { value: 'RETIREMENT', label: tr('تقاعد', 'Retirement') },
                { value: 'MUTUAL_AGREEMENT', label: tr('اتفاق متبادل', 'Mutual Agreement') },
              ]} />
            <CVisionInput C={C} label={tr('السبب', 'Reason')} value={form.reason}
              onChange={(e: any) => setForm({ ...form, reason: e.target.value })} placeholder={tr('سبب الإنهاء', 'Reason for termination')} />
            <CVisionInput C={C} type="date" label={tr('آخر يوم عمل', 'Last Working Day')} value={form.lastWorkingDay}
              onChange={(e: any) => setForm({ ...form, lastWorkingDay: e.target.value })} />
          </div>
          <CVisionDialogFooter>
            <CVisionButton C={C} variant="ghost" onClick={() => setShowInitiate(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} variant="primary" onClick={() => initiateMut.mutate(form)}
              disabled={!form.employeeId || !form.lastWorkingDay || initiateMut.isPending}>
              {initiateMut.isPending ? tr('جارٍ...', 'Processing...') : tr('بدء', 'Initiate')}
            </CVisionButton>
          </CVisionDialogFooter>
        </CVisionDialog>
      )}
    </div>
  );
}

/* ─── Clearance Tab ────────────────────────────────────────────────── */
function ClearanceTab({ C, isDark, tr }: any) {
  const queryClient = useQueryClient();
  const [empId, setEmpId] = useState('');
  const [searched, setSearched] = useState(false);

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['cvision', 'offboarding', 'clearance', empId],
    queryFn: () => api('/api/cvision/offboarding/clearance', { employeeId: empId }),
    enabled: !!empId && searched,
  });
  const clearance = rawData?.success ? rawData.data : null;

  const completeMut = useMutation({
    mutationFn: (itemId: string) => post('/api/cvision/offboarding/clearance', { employeeId: empId, itemId }),
    onSuccess: () => {
      toast.success(tr('تم إكمال البند', 'Item completed'));
      refetch();
    },
    onError: (e: any) => toast.error(e?.message || tr('خطأ', 'Error')),
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <CVisionInput C={C} placeholder={tr('معرف الموظف', 'Employee ID')} value={empId}
          onChange={(e: any) => setEmpId(e.target.value)} />
        <CVisionButton C={C} variant="primary" size="sm" onClick={() => setSearched(true)}>{tr('بحث', 'Search')}</CVisionButton>
      </div>

      {isLoading && <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={200} /></>}

      {clearance && (
        <>
          <div style={{ marginBottom: 12 }}>
            <CVisionBadge C={C} variant={statusVariant(clearance.status)}>{clearance.status}</CVisionBadge>
            <span style={{ marginLeft: 12, fontSize: 13, color: C.textMuted }}>
              {clearance.progress?.completed}/{clearance.progress?.total} {tr('مكتمل', 'completed')} ({clearance.progress?.percent}%)
            </span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {(clearance.checklist || []).map((item: any) => (
              <CVisionCard key={item.id} C={C}>
                <CVisionCardBody style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{item.title}</span>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{tr('مسؤول', 'Assigned to')}: {item.assignedTo}</div>
                  </div>
                  {item.status === 'COMPLETED' ? (
                    <CVisionBadge C={C} variant="success">{tr('مكتمل', 'Done')}</CVisionBadge>
                  ) : (
                    <CVisionButton C={C} size="sm" variant="primary" onClick={() => completeMut.mutate(item.id)}
                      disabled={completeMut.isPending}>
                      {tr('إكمال', 'Complete')}
                    </CVisionButton>
                  )}
                </CVisionCardBody>
              </CVisionCard>
            ))}
          </div>
        </>
      )}

      {searched && !isLoading && !clearance && (
        <CVisionEmptyState C={C} icon={ClipboardCheck} title={tr('لم يتم العثور على إجراء إنهاء خدمة', 'No offboarding found for this employee')} />
      )}
    </div>
  );
}

/* ─── Settlement Tab ───────────────────────────────────────────────── */
function SettlementTab({ C, isDark, tr }: any) {
  const [empId, setEmpId] = useState('');
  const [searched, setSearched] = useState(false);

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['cvision', 'offboarding', 'settlement', empId],
    queryFn: () => api('/api/cvision/offboarding/settlement', { employeeId: empId }),
    enabled: !!empId && searched,
  });
  const settlement = rawData?.success ? rawData.data : null;

  const calcMut = useMutation({
    mutationFn: () => post('/api/cvision/offboarding/settlement', { employeeId: empId }),
    onSuccess: () => {
      toast.success(tr('تم حساب المخالصة', 'Settlement calculated'));
      refetch();
    },
    onError: (e: any) => toast.error(e?.message || tr('خطأ', 'Error')),
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <CVisionInput C={C} placeholder={tr('معرف الموظف', 'Employee ID')} value={empId}
          onChange={(e: any) => setEmpId(e.target.value)} />
        <CVisionButton C={C} variant="primary" size="sm" onClick={() => setSearched(true)}>{tr('بحث', 'Search')}</CVisionButton>
      </div>

      {isLoading && <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={200} /></>}

      {settlement?.settlement ? (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>{tr('تفاصيل المخالصة', 'Settlement Details')}</CVisionCardHeader>
          <CVisionCardBody style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div>{tr('الراتب غير المدفوع', 'Unpaid Salary')}: <b>{settlement.settlement.unpaidSalary?.toLocaleString()} SAR</b></div>
              <div>{tr('بدل الإجازات', 'Leave Encashment')}: <b>{settlement.settlement.leaveEncashment?.toLocaleString()} SAR</b></div>
              <div>{tr('مكافأة نهاية الخدمة', 'End of Service')}: <b>{settlement.settlement.endOfServiceBenefit?.toLocaleString()} SAR</b></div>
              <div>{tr('بدلات أخرى', 'Other Allowances')}: <b>{settlement.settlement.otherAllowances?.toLocaleString()} SAR</b></div>
              <div style={{ color: C.danger }}>{tr('الاستقطاعات', 'Deductions')}: <b>{settlement.settlement.deductions?.toLocaleString()} SAR</b></div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{tr('الإجمالي', 'Total')}: <b>{settlement.settlement.totalSettlement?.toLocaleString()} SAR</b></div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ) : settlement?.status === 'NOT_CALCULATED' ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ marginBottom: 12, color: C.textMuted }}>{tr('لم يتم حساب المخالصة بعد', 'Settlement not yet calculated')}</p>
          <CVisionButton C={C} variant="primary" onClick={() => calcMut.mutate()} disabled={calcMut.isPending}>
            {calcMut.isPending ? tr('جارٍ الحساب...', 'Calculating...') : tr('حساب المخالصة', 'Calculate Settlement')}
          </CVisionButton>
        </div>
      ) : searched && !isLoading && !settlement ? (
        <CVisionEmptyState C={C} icon={Calculator} title={tr('لم يتم العثور على بيانات', 'No data found')} />
      ) : null}
    </div>
  );
}

/* ─── Exit Interview Tab ───────────────────────────────────────────── */
function ExitInterviewTab({ C, isDark, tr }: any) {
  const [empId, setEmpId] = useState('');
  const [searched, setSearched] = useState(false);
  const [form, setForm] = useState({
    satisfactionRating: 3, reasonForLeaving: '', feedback: '', wouldRecommend: false, wouldReturn: false,
  });

  const { data: rawData, isLoading, refetch } = useQuery({
    queryKey: ['cvision', 'offboarding', 'exit-interview', empId],
    queryFn: () => api('/api/cvision/offboarding/exit-interview', { employeeId: empId }),
    enabled: !!empId && searched,
  });
  const interview = rawData?.success ? rawData.data : null;

  const saveMut = useMutation({
    mutationFn: () => post('/api/cvision/offboarding/exit-interview', { employeeId: empId, ...form }),
    onSuccess: () => {
      toast.success(tr('تم حفظ مقابلة الخروج', 'Exit interview saved'));
      refetch();
    },
    onError: (e: any) => toast.error(e?.message || tr('خطأ', 'Error')),
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <CVisionInput C={C} placeholder={tr('معرف الموظف', 'Employee ID')} value={empId}
          onChange={(e: any) => setEmpId(e.target.value)} />
        <CVisionButton C={C} variant="primary" size="sm" onClick={() => setSearched(true)}>{tr('بحث', 'Search')}</CVisionButton>
      </div>

      {isLoading && <><CVisionSkeletonStyles /><CVisionSkeletonCard C={C} height={200} /></>}

      {interview?.conductedAt ? (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}>{tr('مقابلة الخروج', 'Exit Interview')}</CVisionCardHeader>
          <CVisionCardBody style={{ padding: 16, fontSize: 13 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div>{tr('التقييم', 'Satisfaction')}: <b>{interview.satisfactionRating}/5</b></div>
              <div>{tr('سبب المغادرة', 'Reason')}: {interview.reasonForLeaving}</div>
              <div>{tr('ملاحظات', 'Feedback')}: {interview.feedback || '-'}</div>
              <div>{tr('يوصي بالعمل هنا', 'Would Recommend')}: {interview.wouldRecommend ? tr('نعم', 'Yes') : tr('لا', 'No')}</div>
              <div>{tr('يرغب بالعودة', 'Would Return')}: {interview.wouldReturn ? tr('نعم', 'Yes') : tr('لا', 'No')}</div>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ) : interview?.status === 'NOT_CONDUCTED' ? (
        <CVisionCard C={C}>
          <CVisionCardBody style={{ padding: 16 }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: C.textMuted }}>{tr('التقييم (1-5)', 'Satisfaction (1-5)')}</label>
                <CVisionInput C={C} type="number" min={1} max={5} value={form.satisfactionRating}
                  onChange={(e: any) => setForm({ ...form, satisfactionRating: Number(e.target.value) })} />
              </div>
              <CVisionInput C={C} label={tr('سبب المغادرة', 'Reason for Leaving')} value={form.reasonForLeaving}
                onChange={(e: any) => setForm({ ...form, reasonForLeaving: e.target.value })} />
              <CVisionInput C={C} label={tr('ملاحظات', 'Feedback')} value={form.feedback}
                onChange={(e: any) => setForm({ ...form, feedback: e.target.value })} />
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={form.wouldRecommend} onChange={e => setForm({ ...form, wouldRecommend: e.target.checked })} />
                  {' '}{tr('يوصي بالعمل', 'Would Recommend')}
                </label>
                <label style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={form.wouldReturn} onChange={e => setForm({ ...form, wouldReturn: e.target.checked })} />
                  {' '}{tr('يرغب بالعودة', 'Would Return')}
                </label>
              </div>
              <CVisionButton C={C} variant="primary" onClick={() => saveMut.mutate()} disabled={!form.reasonForLeaving || saveMut.isPending}>
                {saveMut.isPending ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
              </CVisionButton>
            </div>
          </CVisionCardBody>
        </CVisionCard>
      ) : searched && !isLoading && !interview ? (
        <CVisionEmptyState C={C} icon={MessageSquare} title={tr('لم يتم العثور على بيانات', 'No data found')} />
      ) : null}
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────────────── */
export default function OffboardingPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const tabs: CVisionTabItem[] = [
    { key: 'active', label: tr('الإجراءات النشطة', 'Active Processes') },
    { key: 'clearance', label: tr('إخلاء الطرف', 'Clearance') },
    { key: 'settlement', label: tr('المخالصة', 'Settlement') },
    { key: 'exit', label: tr('مقابلة الخروج', 'Exit Interview') },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('إنهاء الخدمة', 'Offboarding')}
        titleEn={isRTL ? 'Offboarding' : undefined}
        icon={UserMinus}
        isRTL={isRTL}
      />

      <CVisionTabs C={C} tabs={tabs}>
        <CVisionTabContent tabKey="active">
          <ActiveTab C={C} isDark={isDark} tr={tr} />
        </CVisionTabContent>
        <CVisionTabContent tabKey="clearance">
          <ClearanceTab C={C} isDark={isDark} tr={tr} />
        </CVisionTabContent>
        <CVisionTabContent tabKey="settlement">
          <SettlementTab C={C} isDark={isDark} tr={tr} />
        </CVisionTabContent>
        <CVisionTabContent tabKey="exit">
          <ExitInterviewTab C={C} isDark={isDark} tr={tr} />
        </CVisionTabContent>
      </CVisionTabs>
    </CVisionPageLayout>
  );
}
