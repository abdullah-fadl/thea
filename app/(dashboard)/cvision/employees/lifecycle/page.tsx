'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionTextarea, CVisionSelect, CVisionSkeletonCard, CVisionSkeletonStyles, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionDialog, CVisionDialogFooter, CVisionTabs, CVisionTabContent, CVisionPageHeader, CVisionPageLayout } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';

import {
  UserPlus, UserMinus, FileText, Clock, CheckCircle, XCircle,
  ArrowLeft, RefreshCcw, Play, AlertTriangle, DollarSign, Star,
  ClipboardList, Shield, Monitor, GraduationCap, Users, Building2,
  Calendar, Eye, SkipForward, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const API = '/api/cvision/employees/lifecycle';

const CATEGORY_ICONS: Record<string, any> = {
  DOCUMENTS: FileText, IT_SETUP: Monitor, HR_TASKS: ClipboardList,
  TRAINING: GraduationCap, COMPLIANCE: Shield,
};
const CATEGORY_COLORS: Record<string, string> = {
  DOCUMENTS: 'text-blue-600', IT_SETUP: 'text-purple-600', HR_TASKS: 'text-green-600',
  TRAINING: 'text-amber-600', COMPLIANCE: 'text-red-600',
};
const ASSIGNED_COLORS: Record<string, string> = {
  HR: 'bg-green-100 text-green-700', IT: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700', EMPLOYEE: 'bg-amber-100 text-amber-700',
};

function fmtSAR(n: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: any) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── DASHBOARD TAB ──────────────────────────────────────────────────
function DashboardTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['cvision', 'lifecycle', 'dashboard'],
    queryFn: async () => {
      const d = await cvisionFetch<any>(`${API}?action=dashboard`);
      return d.success ? d : null;
    },
  });

  if (loading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><CVisionSkeletonCard C={C} height={200} style={{ height: 96, width: '100%' }}  /><CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><UserPlus style={{ height: 32, width: 32, color: C.green }} /><div><div style={{ fontSize: 24, fontWeight: 700 }}>{data?.stats?.onboardingActive || 0}</div><div style={{ fontSize: 13, color: C.textMuted }}>{tr('عمليات التعيين النشطة', 'Active Onboardings')}</div></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><UserMinus style={{ height: 32, width: 32, color: C.red }} /><div><div style={{ fontSize: 24, fontWeight: 700 }}>{data?.stats?.offboardingActive || 0}</div><div style={{ fontSize: 13, color: C.textMuted }}>{tr('عمليات إنهاء الخدمة النشطة', 'Active Offboardings')}</div></div></div></CVisionCardBody></CVisionCard>
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24 }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Users style={{ height: 32, width: 32, color: C.blue }} /><div><div style={{ fontSize: 24, fontWeight: 700 }}>{data?.stats?.totalEmployees || 0}</div><div style={{ fontSize: 13, color: C.textMuted }}>{tr('الموظفون النشطون', 'Active Employees')}</div></div></div></CVisionCardBody></CVisionCard>
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus style={{ height: 16, width: 16 }} /> {tr('عمليات التعيين الأخيرة', 'Recent Onboardings')}</div></CVisionCardHeader>
          <CVisionCardBody>
            {(data?.recentOnboardings || []).length === 0 ? (
              <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد سجلات تعيين بعد.', 'No onboarding records yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.recentOnboardings.map((o: any) => (
                  <div key={o._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                    <div><div style={{ fontSize: 13, fontWeight: 500 }}>{o.employeeName || o.employeeId}</div><div style={{ fontSize: 12, color: C.textMuted }}>{tr('بدأ', 'Started')} {fmtDate(o.startDate)}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 64, background: C.bgSubtle, borderRadius: '50%', height: 8 }}><div style={{ background: C.greenDim, height: 8, borderRadius: '50%', width: `${o.progress || 0}%` }} /></div>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{o.progress || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>

        <CVisionCard C={C}>
          <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}><UserMinus style={{ height: 16, width: 16 }} /> {tr('عمليات إنهاء الخدمة الأخيرة', 'Recent Offboardings')}</div></CVisionCardHeader>
          <CVisionCardBody>
            {(data?.recentOffboardings || []).length === 0 ? (
              <p style={{ fontSize: 13, color: C.textMuted }}>{tr('لا توجد سجلات إنهاء خدمة بعد.', 'No offboarding records yet.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.recentOffboardings.map((o: any) => (
                  <div key={o._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                    <div><div style={{ fontSize: 13, fontWeight: 500 }}>{o.employeeName || o.employeeId}</div><div style={{ fontSize: 12, color: C.textMuted }}>{o.type} — {fmtDate(o.lastWorkingDay)}</div></div>
                    <CVisionBadge C={C} variant={o.status === 'COMPLETED' ? 'default' : o.status === 'INITIATED' ? 'secondary' : 'outline'}>{o.status}</CVisionBadge>
                  </div>
                ))}
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      </div>
    </div>
  );
}

// ─── ONBOARDING TAB ─────────────────────────────────────────────────
function OnboardingTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [templateSteps, setTemplateSteps] = useState<any[]>([]);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [newEmpId, setNewEmpId] = useState('');
  const [starting, setStarting] = useState(false);

  const { data: onboardingData, isLoading: loading, refetch: loadList } = useQuery({
    queryKey: ['cvision', 'lifecycle', 'onboarding-list'],
    queryFn: async () => {
      const d = await cvisionFetch<any>(`${API}?action=onboarding-list`);
      return d.success ? (d.onboardings || []) : [];
    },
  });
  const onboardings = onboardingData || [];

  const loadDetail = async (employeeId: string) => {
    try {
      const d = await cvisionFetch<any>(`${API}`, { params: { action: 'onboarding-status', employeeId } });
      if (d.success) { setDetailData(d.onboarding); setTemplateSteps(d.templateSteps || []); }
    } catch { toast.error('Failed to load'); }
  };

  const loadEmployees = async () => {
    try {
      const d = await cvisionFetch<any>('/api/cvision/employees', { params: { limit: 200 } });
      setEmployees(d.data || d.employees || []);
    } catch { /* ignore */ }
  };

  const startOnboarding = async () => {
    if (!newEmpId) return;
    setStarting(true);
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'start-onboarding', employeeId: newEmpId });
      if (d.success) { toast.success('Onboarding started'); setStartDialogOpen(false); setNewEmpId(''); loadList(); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error('Network error'); } finally { setStarting(false); }
  };

  const completeStep = async (employeeId: string, stepId: string) => {
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'complete-onboard-step', employeeId, stepId });
      if (d.success) { toast.success(`Step completed (${d.progress}%)`); loadDetail(employeeId); loadList(); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const skipStep = async (employeeId: string, stepId: string) => {
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'skip-onboard-step', employeeId, stepId, reason: 'Not applicable' });
      if (d.success) { toast.success('Step skipped'); loadDetail(employeeId); loadList(); }
    } catch { toast.error('Network error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('تعيين الموظفين', 'Employee Onboarding')}</h3><p style={{ fontSize: 13, color: C.textMuted }}>{tr('تتبع تقدم تعيين الموظفين الجدد', 'Track new hire onboarding progress')}</p></div>
        <CVisionButton C={C} isDark={isDark} onClick={() => { setStartDialogOpen(true); loadEmployees(); }}><UserPlus style={{ width: 16, height: 16, marginRight: 8 }} /> {tr('بدء التعيين', 'Start Onboarding')}</CVisionButton>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 160, width: '100%' }}  /> : onboardings.length === 0 ? (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24, textAlign: 'center', color: C.textMuted }}><UserPlus style={{ height: 48, width: 48, marginBottom: 12 }} /><p>{tr('لا توجد عمليات تعيين بعد. ابدأ واحدة لموظف جديد.', 'No onboardings yet. Start one for a new employee.')}</p></CVisionCardBody></CVisionCard>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {onboardings.map((o: any) => (
            <CVisionCard C={C} key={o._id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedEmp(o); loadDetail(o.employeeId); }}>
              <CVisionCardBody style={{ paddingTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.greenDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserPlus style={{ height: 20, width: 20, color: C.green }} /></div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{o.employee?.fullName || o.employeeId}</div>
                      <div style={{ fontSize: 13, color: C.textMuted }}>{o.employee?.department || o.employee?.departmentName || '—'} · {o.employee?.jobTitle || '—'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 96, background: C.bgSubtle, borderRadius: '50%', height: 8 }}><div style={{ background: C.greenDim, height: 8, borderRadius: '50%', width: `${o.progress || 0}%` }} /></div><span style={{ fontSize: 13, fontWeight: 500, width: 40, textAlign: 'right' }}>{o.progress || 0}%</span></div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{o.steps?.filter((s: any) => s.status === 'COMPLETED').length || 0}/{o.steps?.length || 0} {tr('خطوات', 'steps')}</div>
                    </div>
                    <CVisionBadge C={C} variant={o.status === 'COMPLETED' ? 'default' : o.status === 'OVERDUE' ? 'destructive' : 'secondary'}>{o.status}</CVisionBadge>
                    <ChevronRight style={{ height: 16, width: 16, color: C.textMuted }} />
                  </div>
                </div>
              </CVisionCardBody>
            </CVisionCard>
          ))}
        </div>
      )}

      {/* Detail Panel */}
      <CVisionDialog C={C} open={!!selectedEmp && !!detailData} onClose={() => { setSelectedEmp(null); setDetailData(null); }} title={`Onboarding: ${selectedEmp?.employee?.fullName || selectedEmp?.employeeId}`} width={672}>
          {detailData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, background: C.bgSubtle, borderRadius: '50%', height: 12 }}><div style={{ background: C.greenDim, height: 12, borderRadius: '50%', transition: 'all 0.2s', width: `${detailData.progress || 0}%` }} /></div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{detailData.progress || 0}%</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(detailData.steps || []).map((step: any) => {
                  const tmpl = templateSteps.find((t: any) => t.id === step.stepId);
                  if (!tmpl) return null;
                  const Icon = CATEGORY_ICONS[tmpl.category] || ClipboardList;
                  const isDone = step.status === 'COMPLETED' || step.status === 'SKIPPED';

                  return (
                    <div key={step.stepId} className={`flex items-center gap-3 p-3 rounded-lg border ${isDone ? 'bg-muted/50 opacity-70' : 'bg-background'}`}>
                      <div className={`shrink-0 ${isDone ? 'text-green-500' : CATEGORY_COLORS[tmpl.category] || 'text-gray-500'}`}>
                        {isDone ? <CheckCircle style={{ height: 20, width: 20 }} /> : <Icon style={{ height: 20, width: 20 }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={`font-medium text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>{tmpl.title}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>{tmpl.description}</div>
                        {step.completedAt && <div style={{ fontSize: 12, color: C.green, marginTop: 2 }}>{tr('اكتمل', 'Completed')} {fmtDate(step.completedAt)}</div>}
                      </div>
                      <CVisionBadge C={C} className={`text-xs shrink-0 ${ASSIGNED_COLORS[tmpl.assignedTo] || 'bg-gray-100'}`}>{tmpl.assignedTo}</CVisionBadge>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{tr('اليوم', 'Day')} {tmpl.daysFromHire}</div>
                      {!isDone && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => completeStep(detailData.employeeId, step.stepId)}>
                            <CheckCircle style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('تم', 'Done')}
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} size="sm" variant="ghost" style={{ height: 28, fontSize: 12 }} onClick={() => skipStep(detailData.employeeId, step.stepId)}>
                            <SkipForward style={{ height: 12, width: 12 }} />
                          </CVisionButton>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </CVisionDialog>

      {/* Start Onboarding Dialog */}
      <CVisionDialog C={C} open={startDialogOpen} onClose={() => setStartDialogOpen(false)} title={tr('بدء تعيين الموظف', 'Start Employee Onboarding')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CVisionSelect C={C} label={tr('اختر الموظف', 'Select Employee')} value={newEmpId} onChange={setNewEmpId} placeholder={tr('اختر الموظف...', 'Choose employee...')}
              options={employees.map((e: any) => ({
                value: e.employeeId || e._id?.toString(),
                label: `${e.fullName || e.name} — ${e.department || e.departmentName || 'No dept'}`,
              }))}
            />
            <p style={{ fontSize: 13, color: C.textMuted }}>{tr('سيتم إنشاء قائمة تعيين من 14 خطوة بناءً على قالب التعيين السعودي الافتراضي.', 'This will create a 14-step onboarding checklist based on the default Saudi onboarding template.')}</p>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStartDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={startOnboarding} disabled={!newEmpId || starting}>
              {starting && <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />}
              {tr('بدء التعيين', 'Start Onboarding')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ─── OFFBOARDING TAB ────────────────────────────────────────────────
function OffboardingTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const queryClient = useQueryClient();
  const [selectedOff, setSelectedOff] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({ employeeId: '', type: 'RESIGNATION', reason: '', lastWorkingDay: '' });
  const [starting, setStarting] = useState(false);
  const [settlement, setSettlement] = useState<any>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitForm, setExitForm] = useState({ satisfactionRating: 3, reasonForLeaving: '', feedback: '', wouldRecommend: true, wouldReturn: false });

  const { data: offboardingData, isLoading: loading, refetch: loadList } = useQuery({
    queryKey: ['cvision', 'lifecycle', 'offboarding-list'],
    queryFn: async () => {
      const d = await cvisionFetch<any>(`${API}?action=offboarding-list`);
      return d.success ? (d.offboardings || []) : [];
    },
  });
  const offboardings = offboardingData || [];

  const loadDetail = async (employeeId: string) => {
    try {
      const d = await cvisionFetch<any>(API, { params: { action: 'offboarding-status', employeeId } });
      if (d.success) { setDetailData(d.offboarding); setSettlement(d.offboarding?.finalSettlement || null); }
    } catch { toast.error('Failed'); }
  };

  const loadEmployees = async () => {
    try {
      const d = await cvisionFetch<any>('/api/cvision/employees', { params: { limit: 200 } });
      setEmployees(d.data || d.employees || []);
    } catch { /* ignore */ }
  };

  const startOffboarding = async () => {
    if (!formData.employeeId || !formData.reason || !formData.lastWorkingDay) return;
    setStarting(true);
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'start-offboarding', ...formData });
      if (d.success) { toast.success('Offboarding initiated'); setStartDialogOpen(false); setFormData({ employeeId: '', type: 'RESIGNATION', reason: '', lastWorkingDay: '' }); loadList(); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error('Network error'); } finally { setStarting(false); }
  };

  const completeItem = async (employeeId: string, itemId: string) => {
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'complete-offboard-item', employeeId, itemId });
      if (d.success) { toast.success(`${d.completedCount}/${d.totalCount} completed`); loadDetail(employeeId); loadList(); }
    } catch { toast.error('Network error'); }
  };

  const calcSettlement = async (employeeId: string) => {
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'calculate-settlement', employeeId });
      if (d.success) { setSettlement(d.settlement); toast.success('Settlement calculated'); }
      else toast.error(d.error || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const saveExit = async (employeeId: string) => {
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'save-exit-interview', employeeId, interview: exitForm });
      if (d.success) { toast.success('Exit interview saved'); setExitOpen(false); loadDetail(employeeId); }
    } catch { toast.error('Network error'); }
  };

  const finalize = async (employeeId: string) => {
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'complete-offboarding', employeeId });
      if (d.success) { toast.success('Offboarding completed, employee terminated'); setSelectedOff(null); setDetailData(null); loadList(); }
    } catch { toast.error('Network error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div><h3 style={{ fontSize: 16, fontWeight: 600 }}>{tr('إنهاء خدمة الموظفين', 'Employee Offboarding')}</h3><p style={{ fontSize: 13, color: C.textMuted }}>{tr('إدارة المغادرات والمخالصات والتسويات النهائية', 'Manage exits, clearance, and final settlements')}</p></div>
        <CVisionButton C={C} isDark={isDark} variant="danger" onClick={() => { setStartDialogOpen(true); loadEmployees(); }}><UserMinus style={{ width: 16, height: 16, marginRight: 8 }} /> {tr('بدء إنهاء الخدمة', 'Initiate Offboarding')}</CVisionButton>
      </div>

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 160, width: '100%' }}  /> : offboardings.length === 0 ? (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24, textAlign: 'center', color: C.textMuted }}><UserMinus style={{ height: 48, width: 48, marginBottom: 12 }} /><p>{tr('لا توجد سجلات إنهاء خدمة.', 'No offboarding records.')}</p></CVisionCardBody></CVisionCard>
      ) : (
        <CVisionTable C={C}>
          <CVisionTableHead C={C}><CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh><CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh><CVisionTh C={C}>{tr('آخر يوم', 'Last Day')}</CVisionTh><CVisionTh C={C}>{tr('قائمة المراجعة', 'Checklist')}</CVisionTh><CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh><CVisionTh C={C}></CVisionTh></CVisionTableHead>
          <CVisionTableBody>
            {offboardings.map((o: any) => {
              const done = o.checklist?.filter((c: any) => c.status === 'COMPLETED').length || 0;
              const total = o.checklist?.length || 0;
              return (
                <CVisionTr C={C} key={o._id}>
                  <CVisionTd style={{ fontWeight: 500, color: C.text }}>{o.employee?.fullName || o.employeeId}</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant="outline">{o.type}</CVisionBadge></CVisionTd>
                  <CVisionTd style={{ color: C.text }}>{fmtDate(o.lastWorkingDay)}</CVisionTd>
                  <CVisionTd style={{ color: C.text }}>{done}/{total}</CVisionTd>
                  <CVisionTd><CVisionBadge C={C} variant={o.status === 'COMPLETED' ? 'default' : o.status === 'FINAL_SETTLEMENT' ? 'secondary' : 'outline'}>{o.status}</CVisionBadge></CVisionTd>
                  <CVisionTd><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => { setSelectedOff(o); loadDetail(o.employeeId); }}><Eye style={{ height: 16, width: 16 }} /></CVisionButton></CVisionTd>
                </CVisionTr>
              );
            })}
          </CVisionTableBody>
        </CVisionTable>
      )}

      {/* Detail Panel */}
      <CVisionDialog C={C} open={!!selectedOff && !!detailData} onClose={() => { setSelectedOff(null); setDetailData(null); setSettlement(null); }} title={`Offboarding: ${selectedOff?.employee?.fullName || selectedOff?.employeeId}`}>
          {detailData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, fontSize: 13 }}>
                <div><span style={{ color: C.textMuted }}>{tr('النوع:', 'Type:')}</span> <strong>{detailData.type}</strong></div>
                <div><span style={{ color: C.textMuted }}>{tr('آخر يوم:', 'Last Day:')}</span> <strong>{fmtDate(detailData.lastWorkingDay)}</strong></div>
                <div><span style={{ color: C.textMuted }}>{tr('الحالة:', 'Status:')}</span> <CVisionBadge C={C}>{detailData.status}</CVisionBadge></div>
              </div>
              {detailData.reason && <div style={{ fontSize: 13, background: C.bgSubtle, padding: 12, borderRadius: 6 }}><strong>{tr('السبب:', 'Reason:')}</strong> {detailData.reason}</div>}

              <div>
                <h4 style={{ fontWeight: 600, marginBottom: 12 }}>{tr('قائمة المخالصة', 'Clearance Checklist')}</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(detailData.checklist || []).map((item: any) => (
                    <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border ${item.status === 'COMPLETED' ? 'bg-muted/50 opacity-70' : ''}`}>
                      {item.status === 'COMPLETED' ? <CheckCircle style={{ height: 20, width: 20, color: C.green }} /> : <Clock style={{ height: 20, width: 20, color: C.textMuted }} />}
                      <span className={`flex-1 text-sm ${item.status === 'COMPLETED' ? 'line-through text-muted-foreground' : 'font-medium'}`}>{item.title}</span>
                      <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{item.assignedTo}</CVisionBadge>
                      {item.status !== 'COMPLETED' && (
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" style={{ height: 28, fontSize: 12 }} onClick={() => completeItem(detailData.employeeId, item.id)}>
                          <CheckCircle style={{ height: 12, width: 12, marginRight: 4 }} /> {tr('تم', 'Done')}
                        </CVisionButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => calcSettlement(detailData.employeeId)}><DollarSign style={{ width: 16, height: 16, marginRight: 8 }} /> {tr('حساب التسوية', 'Calculate Settlement')}</CVisionButton>
                <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setExitOpen(true)}><Star style={{ width: 16, height: 16, marginRight: 8 }} /> {tr('مقابلة الخروج', 'Exit Interview')}</CVisionButton>
                {detailData.status !== 'COMPLETED' && (
                  <CVisionButton C={C} isDark={isDark} variant="danger" onClick={() => finalize(detailData.employeeId)}><XCircle style={{ width: 16, height: 16, marginRight: 8 }} /> {tr('إنهاء وفصل', 'Finalize & Terminate')}</CVisionButton>
                )}
              </div>

              {settlement && (
                <CVisionCard C={C} className="border-green-200">
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{tr('التسوية النهائية', 'Final Settlement')}</div></CVisionCardHeader>
                  <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('الراتب غير المدفوع (نسبي)', 'Unpaid Salary (prorated)')}</span><span>{fmtSAR(settlement.unpaidSalary)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('تصفية الإجازات', 'Leave Encashment')}</span><span>{fmtSAR(settlement.leaveEncashment)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('مكافأة نهاية الخدمة', 'End of Service Benefit')}</span><span>{fmtSAR(settlement.endOfServiceBenefit)}</span></div>
                    {settlement.deductions > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: C.red }}><span>{tr('خصومات (قروض)', 'Deductions (loans)')}</span><span>-{fmtSAR(settlement.deductions)}</span></div>}
                    <hr />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}><span>{tr('إجمالي التسوية', 'Total Settlement')}</span><span style={{ color: C.green }}>{fmtSAR(settlement.totalSettlement)}</span></div>
                  </CVisionCardBody>
                </CVisionCard>
              )}

              {detailData.exitInterview && (
                <CVisionCard C={C}>
                  <CVisionCardHeader C={C} style={{ paddingBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('مقابلة الخروج', 'Exit Interview')}</div></CVisionCardHeader>
                  <CVisionCardBody style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{tr('الرضا', 'Satisfaction')}</span><span>{'★'.repeat(detailData.exitInterview.satisfactionRating)}{'☆'.repeat(5 - detailData.exitInterview.satisfactionRating)}</span></div>
                    <div><strong>{tr('السبب:', 'Reason:')}</strong> {detailData.exitInterview.reasonForLeaving}</div>
                    <div><strong>{tr('الملاحظات:', 'Feedback:')}</strong> {detailData.exitInterview.feedback}</div>
                    <div style={{ display: 'flex', gap: 16 }}><span>{tr('يوصي:', 'Would recommend:')} {detailData.exitInterview.wouldRecommend ? tr('نعم', 'Yes') : tr('لا', 'No')}</span><span>{tr('يعود:', 'Would return:')} {detailData.exitInterview.wouldReturn ? tr('نعم', 'Yes') : tr('لا', 'No')}</span></div>
                  </CVisionCardBody>
                </CVisionCard>
              )}
            </div>
          )}
      </CVisionDialog>

      {/* Start Offboarding Dialog */}
      <CVisionDialog C={C} open={startDialogOpen} onClose={() => setStartDialogOpen(false)} title={tr('بدء إنهاء الخدمة', 'Initiate Offboarding')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CVisionSelect C={C} label={tr('الموظف', 'Employee')} value={formData.employeeId} onChange={v => setFormData(p => ({ ...p, employeeId: v }))} placeholder={tr('اختر الموظف...', 'Select employee...')}
              options={employees.map((e: any) => ({ value: e.employeeId || e._id?.toString(), label: e.fullName || e.name }))}
            />
            <CVisionSelect C={C} label={tr('النوع', 'Type')} value={formData.type} onChange={v => setFormData(p => ({ ...p, type: v }))}
              options={[
                { value: 'RESIGNATION', label: tr('استقالة', 'Resignation') }, { value: 'TERMINATION', label: tr('فصل', 'Termination') },
                { value: 'END_OF_CONTRACT', label: tr('انتهاء العقد', 'End of Contract') }, { value: 'RETIREMENT', label: tr('تقاعد', 'Retirement') },
                { value: 'MUTUAL_AGREEMENT', label: tr('اتفاق متبادل', 'Mutual Agreement') },
              ]}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>{tr('السبب', 'Reason')}</label><CVisionTextarea C={C} value={formData.reason} onChange={e => setFormData(p => ({ ...p, reason: e.target.value }))} placeholder={tr('سبب المغادرة...', 'Reason for departure...')} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>{tr('آخر يوم عمل', 'Last Working Day')}</label><CVisionInput C={C} type="date" value={formData.lastWorkingDay} onChange={e => setFormData(p => ({ ...p, lastWorkingDay: e.target.value }))} /></div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setStartDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} variant="danger" onClick={startOffboarding} disabled={starting}>{starting && <RefreshCcw style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} />} {tr('بدء', 'Initiate')}</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* Exit Interview Dialog */}
      <CVisionDialog C={C} open={exitOpen} onClose={() => setExitOpen(false)} title={tr('مقابلة الخروج', 'Exit Interview')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CVisionSelect C={C} label={tr('الرضا العام (1-5)', 'Overall Satisfaction (1-5)')} value={String(exitForm.satisfactionRating)} onChange={v => setExitForm(p => ({ ...p, satisfactionRating: parseInt(v) }))}
              options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${'★'.repeat(n)}${'☆'.repeat(5 - n)} (${n})` }))}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>{tr('السبب الرئيسي للمغادرة', 'Primary Reason for Leaving')}</label><CVisionInput C={C} value={exitForm.reasonForLeaving} onChange={e => setExitForm(p => ({ ...p, reasonForLeaving: e.target.value }))} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><label style={{ fontSize: 13, fontWeight: 500 }}>{tr('الملاحظات', 'Feedback')}</label><CVisionTextarea C={C} value={exitForm.feedback} onChange={e => setExitForm(p => ({ ...p, feedback: e.target.value }))} placeholder={tr('ملاحظات عامة عن الشركة...', 'General feedback about the company...')} /></div>
            <div style={{ display: 'flex', gap: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={exitForm.wouldRecommend} onChange={e => setExitForm(p => ({ ...p, wouldRecommend: e.target.checked }))} /> {tr('يوصي بالشركة', 'Would recommend company')}</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><input type="checkbox" checked={exitForm.wouldReturn} onChange={e => setExitForm(p => ({ ...p, wouldReturn: e.target.checked }))} /> {tr('يعود مستقبلاً', 'Would return in future')}</label>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setExitOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={() => detailData && saveExit(detailData.employeeId)}>{tr('حفظ المقابلة', 'Save Interview')}</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ─── DOCUMENTS TAB ──────────────────────────────────────────────────
function DocumentsTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({ docType: '', fileName: '', expiryDate: '' });

  const REQUIRED_DOCS_SAUDI = ['national_id', 'bank_letter', 'certificates', 'photo'];
  const REQUIRED_DOCS_EXPAT = ['passport', 'iqama', 'visa', 'bank_letter', 'certificates', 'photo', 'medical_report'];
  const DOC_LABELS: Record<string, string> = {
    national_id: tr('الهوية الوطنية', 'National ID'), passport: tr('جواز السفر', 'Passport'), iqama: tr('الإقامة', 'Iqama'),
    visa: tr('تأشيرة العمل', 'Work Visa'), bank_letter: tr('خطاب البنك', 'Bank Letter'), certificates: tr('الشهادات التعليمية', 'Educational Certificates'),
    photo: tr('الصورة', 'Photo'), medical_report: tr('التقرير الطبي', 'Medical Report'), contract: tr('عقد العمل', 'Employment Contract'),
    other: tr('مستند آخر', 'Other Document'),
  };

  useEffect(() => {
    (async () => {
      try {
        const d = await cvisionFetch<any>('/api/cvision/employees', { params: { limit: 200 } });
        setEmployees(d.data || d.employees || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const loadDocs = async (empId: string) => {
    setLoading(true);
    try {
      const d = await cvisionFetch<any>(API, { params: { action: 'documents', employeeId: empId } });
      if (d.success) setDocs(d.documents || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const uploadDoc = async () => {
    if (!employeeId || !uploadForm.docType || !uploadForm.fileName) return;
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'upload-document', employeeId, ...uploadForm });
      if (d.success) { toast.success(tr('تم تسجيل المستند', 'Document recorded')); setUploadOpen(false); setUploadForm({ docType: '', fileName: '', expiryDate: '' }); loadDocs(employeeId); }
    } catch { toast.error('Failed'); }
  };

  const verifyDoc = async (documentId: string) => {
    try {
      const d = await cvisionMutate<any>(API, 'POST', { action: 'verify-document', documentId });
      if (d.success) { toast.success(tr('تم التحقق من المستند', 'Document verified')); loadDocs(employeeId); }
    } catch { toast.error('Failed'); }
  };

  const docTypeSet = new Set(docs.map(d => d.type));
  const requiredDocs = REQUIRED_DOCS_SAUDI;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
        <CVisionSelect C={C} label={tr('اختر الموظف', 'Select Employee')} value={employeeId} onChange={v => { setEmployeeId(v); loadDocs(v); }} placeholder={tr('اختر الموظف...', 'Choose employee...')}
          options={employees.map((e: any) => ({ value: e.employeeId || e._id?.toString(), label: e.fullName || e.name }))}
          style={{ flex: 1 }}
        />
        {employeeId && <CVisionButton C={C} isDark={isDark} onClick={() => setUploadOpen(true)}><FileText style={{ width: 16, height: 16, marginRight: 8 }} /> {tr('إضافة مستند', 'Add Document')}</CVisionButton>}
      </div>

      {employeeId && (
        <>
          <CVisionCard C={C}>
            <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('قائمة المستندات المطلوبة', 'Required Documents Checklist')}</div></CVisionCardHeader>
            <CVisionCardBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {requiredDocs.map(doc => {
                  const has = docTypeSet.has(doc);
                  return (
                    <div key={doc} className={`flex items-center gap-2 p-2 rounded border ${has ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      {has ? <CheckCircle style={{ height: 16, width: 16, color: C.green }} /> : <XCircle style={{ height: 16, width: 16, color: C.red }} />}
                      <span style={{ fontSize: 13 }}>{DOC_LABELS[doc] || doc}</span>
                    </div>
                  );
                })}
              </div>
            </CVisionCardBody>
          </CVisionCard>

          {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 160, width: '100%' }}  /> : docs.length === 0 ? (
            <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24, textAlign: 'center', color: C.textMuted }}>{tr('لم يتم رفع مستندات بعد.', 'No documents uploaded yet.')}</CVisionCardBody></CVisionCard>
          ) : (
            <CVisionCard C={C}>
              <CVisionCardHeader C={C}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('المستندات المرفوعة', 'Uploaded Documents')}</div></CVisionCardHeader>
              <CVisionCardBody>
                <CVisionTable C={C}>
                  <CVisionTableHead C={C}><CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh><CVisionTh C={C}>{tr('اسم الملف', 'File Name')}</CVisionTh><CVisionTh C={C}>{tr('تاريخ الرفع', 'Uploaded')}</CVisionTh><CVisionTh C={C}>{tr('الانتهاء', 'Expiry')}</CVisionTh><CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh><CVisionTh C={C}></CVisionTh></CVisionTableHead>
                  <CVisionTableBody>
                    {docs.map((doc: any) => {
                      const isExpired = doc.expiryDate && new Date(doc.expiryDate) < new Date();
                      const isExpiring = doc.expiryDate && !isExpired && new Date(doc.expiryDate) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
                      return (
                        <CVisionTr C={C} key={doc._id}>
                          <CVisionTd style={{ fontWeight: 500, color: C.text }}>{DOC_LABELS[doc.type] || doc.type}</CVisionTd>
                          <CVisionTd style={{ color: C.text }}>{doc.fileName}</CVisionTd>
                          <CVisionTd style={{ color: C.text }}>{fmtDate(doc.uploadedAt)}</CVisionTd>
                          <CVisionTd style={{ color: C.text }}>{doc.expiryDate ? fmtDate(doc.expiryDate) : '—'}</CVisionTd>
                          <CVisionTd>
                            {isExpired ? <CVisionBadge C={C} variant="danger">{tr('منتهي', 'Expired')}</CVisionBadge>
                              : isExpiring ? <CVisionBadge C={C} style={{ background: C.orangeDim, color: C.orange }}>{tr('ينتهي قريباً', 'Expiring Soon')}</CVisionBadge>
                              : doc.verifiedAt ? <CVisionBadge C={C} style={{ background: C.greenDim, color: C.green }}>{tr('تم التحقق', 'Verified')}</CVisionBadge>
                              : <CVisionBadge C={C} variant="secondary">{tr('قيد الانتظار', 'Pending')}</CVisionBadge>}
                          </CVisionTd>
                          <CVisionTd>{!doc.verifiedAt && <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" onClick={() => verifyDoc(doc._id)}>{tr('تحقق', 'Verify')}</CVisionButton>}</CVisionTd>
                        </CVisionTr>
                      );
                    })}
                  </CVisionTableBody>
                </CVisionTable>
              </CVisionCardBody>
            </CVisionCard>
          )}
        </>
      )}

      <CVisionDialog C={C} open={uploadOpen} onClose={() => setUploadOpen(false)} title={tr('تسجيل مستند', 'Record Document')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <CVisionSelect C={C} label={tr('نوع المستند', 'Document Type')} value={uploadForm.docType} onChange={v => setUploadForm(p => ({ ...p, docType: v }))} placeholder={tr('اختر النوع...', 'Select type...')}
              options={Object.entries(DOC_LABELS).map(([k, v]) => ({ value: k, label: v as string }))}
            />
            <CVisionInput C={C} label={tr('اسم الملف / المرجع', 'File Name / Reference')} value={uploadForm.fileName} onChange={e => setUploadForm(p => ({ ...p, fileName: e.target.value }))} placeholder="e.g. national_id_scan.pdf" />
            <CVisionInput C={C} label={tr('تاريخ الانتهاء (اختياري)', 'Expiry Date (optional)')} type="date" value={uploadForm.expiryDate} onChange={e => setUploadForm(p => ({ ...p, expiryDate: e.target.value }))} />
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setUploadOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={uploadDoc}>{tr('حفظ المستند', 'Save Document')}</CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}

// ─── TIMELINE TAB ───────────────────────────────────────────────────
function TimelineTab() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await cvisionFetch<any>('/api/cvision/employees', { params: { limit: 200 } });
        setEmployees(d.data || d.employees || []);
      } catch { /* ignore */ }
    })();
  }, []);

  const load = async (empId: string) => {
    setLoading(true);
    try {
      const d = await cvisionFetch<any>(API, { params: { action: 'timeline', employeeId: empId } });
      if (d.success) setHistory(d.history || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: 'bg-green-500', PROBATION: 'bg-amber-500', RESIGNED: 'bg-gray-500',
    TERMINATED: 'bg-red-500', OFFBOARDING: 'bg-orange-500', ON_LEAVE: 'bg-blue-500',
    SUSPENDED: 'bg-red-400',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <CVisionSelect C={C} label={tr('اختر الموظف', 'Select Employee')} value={employeeId} onChange={v => { setEmployeeId(v); load(v); }} placeholder={tr('اختر الموظف...', 'Choose employee...')}
        options={employees.map((e: any) => ({ value: e.employeeId || e._id?.toString(), label: e.fullName || e.name }))}
        style={{ width: 320 }}
      />

      {loading ? <CVisionSkeletonCard C={C} height={200} style={{ height: 192, width: '100%' }}  /> : !employeeId ? (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24, textAlign: 'center', color: C.textMuted }}><Clock style={{ height: 48, width: 48, marginBottom: 12 }} /><p>{tr('اختر موظفاً لعرض سجل حالته.', 'Select an employee to view their status history.')}</p></CVisionCardBody></CVisionCard>
      ) : history.length === 0 ? (
        <CVisionCard C={C}><CVisionCardBody style={{ paddingTop: 24, textAlign: 'center', color: C.textMuted }}>{tr('لا يوجد سجل حالة.', 'No status history found.')}</CVisionCardBody></CVisionCard>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', width: 2 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {history.map((entry: any, i: number) => (
              <div key={entry._id || i} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 16, paddingLeft: 48 }}>
                <div className={`absolute left-4 w-4 h-4 rounded-full border-2 border-background ${STATUS_COLORS[entry.toStatus?.toUpperCase()] || 'bg-gray-400'}`} />
                <CVisionCard C={C} style={{ flex: 1 }}>
                  <CVisionCardBody style={{ paddingTop: 16, paddingBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {entry.fromStatus && <CVisionBadge C={C} variant="outline" style={{ fontSize: 12 }}>{entry.fromStatus}</CVisionBadge>}
                        {entry.fromStatus && <ChevronRight style={{ height: 12, width: 12, color: C.textMuted }} />}
                        <CVisionBadge C={C} style={{ fontSize: 12 }}>{entry.toStatus}</CVisionBadge>
                      </div>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{fmtDate(entry.effectiveDate || entry.effectiveAt || entry.createdAt)}</span>
                    </div>
                    {entry.reason && <p style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>{entry.reason}</p>}
                    {entry.changedBy && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{tr('بواسطة:', 'By:')} {entry.changedByName || entry.changedBy}</p>}
                  </CVisionCardBody>
                </CVisionCard>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE ──────────────────────────────────────────────────────
export default function EmployeeLifecyclePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  return (
    <CVisionPageLayout style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/cvision/employees"><CVisionButton C={C} isDark={isDark} variant="ghost" size="sm"><ArrowLeft style={{ height: 16, width: 16, marginRight: 4 }} /> {tr('الموظفون', 'Employees')}</CVisionButton></Link>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700 }}>{tr('دورة حياة الموظف', 'Employee Lifecycle')}</h1>
          <p style={{ color: C.textMuted }}>{tr('التعيين، المستندات، الجدول الزمني والإنهاء', 'Onboarding, documents, timeline & offboarding')}</p>
        </div>
      </div>

      <CVisionTabs C={C} isRTL={isRTL} defaultTab="dashboard" tabs={[
        { id: 'dashboard', label: tr('لوحة المعلومات', 'Dashboard'), icon: Building2 },
        { id: 'onboarding', label: tr('التعيين', 'Onboarding'), icon: UserPlus },
        { id: 'documents', label: tr('المستندات', 'Documents'), icon: FileText },
        { id: 'timeline', label: tr('الجدول الزمني', 'Timeline'), icon: Clock },
        { id: 'offboarding', label: tr('إنهاء الخدمة', 'Offboarding'), icon: UserMinus },
      ]} style={{ marginTop: 24 }}>
        <CVisionTabContent tabId="dashboard"><DashboardTab /></CVisionTabContent>
        <CVisionTabContent tabId="onboarding"><OnboardingTab /></CVisionTabContent>
        <CVisionTabContent tabId="documents"><DocumentsTab /></CVisionTabContent>
        <CVisionTabContent tabId="timeline"><TimelineTab /></CVisionTabContent>
        <CVisionTabContent tabId="offboarding"><OffboardingTab /></CVisionTabContent>
      </CVisionTabs>
    </CVisionPageLayout>
  );
}
