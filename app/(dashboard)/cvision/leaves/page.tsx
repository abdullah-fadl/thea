'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionTextarea, CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow, CVisionSkeletonCard, CVisionSelect, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  CalendarDays, Plus, RefreshCw, CheckCircle, XCircle, Clock,
  Palmtree, Stethoscope, Plane, Baby, Bell, UserCheck, ShieldCheck, Filter,
  Ban, ChevronDown, ChevronUp, Trash2, Shield,
} from 'lucide-react';

// Types
interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  fromSchedule?: boolean;
  employeeConfirmedAt?: string;
  employeeRejectReason?: string;
}

interface Employee {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  name?: string;
}

interface LeaveBalance {
  type: string;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
}

// Config
const leaveTypeLabels: Record<string, { en: string; ar: string }> = {
  ANNUAL: { en: 'Annual', ar: 'سنوية' },
  SICK: { en: 'Sick', ar: 'مرضية' },
  UNPAID: { en: 'Unpaid', ar: 'بدون راتب' },
  MATERNITY: { en: 'Maternity', ar: 'أمومة' },
  PATERNITY: { en: 'Paternity', ar: 'أبوة' },
  MARRIAGE: { en: 'Marriage', ar: 'زواج' },
  BEREAVEMENT: { en: 'Bereavement', ar: 'وفاة' },
  HAJJ: { en: 'Hajj', ar: 'حج' },
  EMERGENCY: { en: 'Emergency', ar: 'طارئة' },
};

const leaveTypeIcons: Record<string, any> = {
  ANNUAL: Palmtree, SICK: Stethoscope, UNPAID: CalendarDays, MATERNITY: Baby,
  PATERNITY: Baby, MARRIAGE: CalendarDays, BEREAVEMENT: CalendarDays, HAJJ: Plane, EMERGENCY: Clock,
};

const statusVariant = (s: string) => s === 'APPROVED' || s === 'TAKEN' ? 'success' as const : s === 'REJECTED' || s === 'EMPLOYEE_REJECTED' || s === 'CANCELLED' ? 'danger' as const : s === 'PENDING_EMPLOYEE' || s === 'PENDING_MANAGER' || s === 'PENDING' ? 'warning' as const : 'muted' as const;
const statusLabels: Record<string, { en: string; ar: string }> = {
  PENDING: { en: 'Pending', ar: 'معلق' },
  PENDING_EMPLOYEE: { en: 'Awaiting Employee', ar: 'بانتظار الموظف' },
  PENDING_MANAGER: { en: 'Awaiting Manager', ar: 'بانتظار المدير' },
  APPROVED: { en: 'Approved', ar: 'موافق عليه' },
  REJECTED: { en: 'Rejected', ar: 'مرفوض' },
  EMPLOYEE_REJECTED: { en: 'Employee Declined', ar: 'رفض الموظف' },
  CANCELLED: { en: 'Cancelled', ar: 'ملغي' },
  TAKEN: { en: 'Taken', ar: 'تم أخذها' },
};

type StatusFilter = 'all' | 'PENDING_EMPLOYEE' | 'PENDING_MANAGER' | 'APPROVED' | 'REJECTED';

export default function LeavesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [calculatedDays, setCalculatedDays] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Blackout management
  const [showBlackouts, setShowBlackouts] = useState(false);
  const [blackoutDialog, setBlackoutDialog] = useState(false);
  const [blackoutForm, setBlackoutForm] = useState({ name: '', nameAr: '', startDate: '', endDate: '', reason: '', reasonAr: '', scope: 'ALL' as const, leaveTypes: [] as string[] });

  const { data: blackoutsData, refetch: refetchBlackouts } = useQuery({
    queryKey: ['cvision', 'leave-blackouts'],
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/leaves/blackout');
      return data.ok ? (data.data || []) : [];
    },
    enabled: showBlackouts,
  });
  const blackouts = blackoutsData || [];

  const handleCreateBlackout = async () => {
    try {
      const data = await cvisionMutate<any>('/api/cvision/leaves/blackout', 'POST', { action: 'create', ...blackoutForm });
      if (data.ok) {
        toast.success(tr('تم إنشاء فترة الحظر', 'Blackout period created'));
        setBlackoutDialog(false); refetchBlackouts();
        setBlackoutForm({ name: '', nameAr: '', startDate: '', endDate: '', reason: '', reasonAr: '', scope: 'ALL', leaveTypes: [] });
      } else toast.error(data.error || tr('خطأ', 'Error'));
    } catch { toast.error(tr('خطأ في الاتصال', 'Connection error')); }
  };

  const handleDeleteBlackout = async (id: string) => {
    try {
      const data = await cvisionMutate<any>('/api/cvision/leaves/blackout', 'POST', { action: 'delete', blackoutId: id });
      if (data.ok) { toast.success(tr('تم حذف فترة الحظر', 'Blackout period deleted')); refetchBlackouts(); }
      else toast.error(data.error || tr('خطأ', 'Error'));
    } catch { toast.error(tr('خطأ في الاتصال', 'Connection error')); }
  };

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectingAction, setRejectingAction] = useState<string>('');
  const [rejectReason, setRejectReason] = useState('');

  // Form
  const [formData, setFormData] = useState({ employeeId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' });

  // Data Fetching
  const { data: requestsData, isLoading: loading, refetch: refetchRequests } = useQuery({
    queryKey: cvisionKeys.leaves.list(),
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/leaves');
      return data.success ? (data.data.leaves || []) : [];
    },
  });
  const requests: LeaveRequest[] = requestsData || [];

  const { data: employeesData } = useQuery({
    queryKey: cvisionKeys.employees.list({ statuses: 'ACTIVE,PROBATION' }),
    queryFn: async () => {
      const data = await cvisionFetch<any>('/api/cvision/employees', { params: { statuses: 'ACTIVE,PROBATION' } });
      if (data.success) {
        return (data.data?.items || data.data || []).map((emp: any) => ({
          ...emp, id: emp.id || emp._id, name: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
        }));
      }
      return [];
    },
  });
  const employees: Employee[] = employeesData || [];

  useEffect(() => { if (selectedEmployee) fetchBalances(selectedEmployee); }, [selectedEmployee]);
  useEffect(() => { if (formData.startDate && formData.endDate) calculateDays(); }, [formData.startDate, formData.endDate]);

  const fetchBalances = async (employeeId: string) => {
    try {
      const data = await cvisionFetch<any>('/api/cvision/leaves', { params: { action: 'balance', employeeId } });
      if (data.success) setBalances(data.data.balances || []);
    } catch { /* optional */ }
  };

  const calculateDays = async () => {
    try {
      const data = await cvisionMutate<any>('/api/cvision/leaves', 'POST', { action: 'calculate-days', startDate: formData.startDate, endDate: formData.endDate });
      if (data.success) setCalculatedDays(data.data.workingDays);
    } catch { /* optional */ }
  };

  // Actions
  const handleSubmit = async () => {
    try {
      const data = await cvisionMutate<any>('/api/cvision/leaves', 'POST', formData);
      if (data.success) {
        toast.success(tr('تم تقديم طلب الإجازة بنجاح', 'Leave request submitted successfully'));
        setIsDialogOpen(false); refetchRequests();
        setFormData({ employeeId: '', type: 'ANNUAL', startDate: '', endDate: '', reason: '' }); setCalculatedDays(null);
      } else toast.error(data.error || tr('خطأ في تقديم الطلب', 'Error submitting request'));
    } catch (err: any) { toast.error(tr('خطأ في الاتصال بالخادم', 'Error connecting to server')); }
  };

  const handleAction = async (requestId: string, action: string, reason?: string) => {
    try {
      const data = await cvisionMutate<any>(`/api/cvision/leaves/${requestId}`, 'PATCH', { action, reason, reviewNotes: reason });
      if (data.success) { toast.success(data.message || tr('تمت العملية', 'Action completed')); refetchRequests(); }
      else toast.error(data.error || tr('فشلت العملية', 'Action failed'));
    } catch (err: any) { toast.error(tr('خطأ في تنفيذ العملية', 'Error performing action')); }
  };

  const openRejectDialog = (id: string, action: string) => {
    setRejectingId(id); setRejectingAction(action); setRejectReason(''); setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (rejectingId && rejectReason.trim()) { handleAction(rejectingId, rejectingAction, rejectReason); setRejectDialogOpen(false); }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Computed
  const pendingEmployee = requests.filter(r => r.status === 'PENDING_EMPLOYEE');
  const pendingManager = requests.filter(r => r.status === 'PENDING_MANAGER' || r.status === 'PENDING');
  const stats = {
    pendingEmployee: pendingEmployee.length,
    pendingManager: pendingManager.length,
    approved: requests.filter(r => r.status === 'APPROVED').length,
    total: requests.length,
  };

  const filteredRequests = statusFilter === 'all' ? requests
    : statusFilter === 'REJECTED' ? requests.filter(r => r.status === 'REJECTED' || r.status === 'EMPLOYEE_REJECTED')
    : requests.filter(r => r.status === statusFilter || (statusFilter === 'PENDING_MANAGER' && r.status === 'PENDING'));

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  const filterButtons: { value: StatusFilter; labelEn: string; labelAr: string }[] = [
    { value: 'all', labelEn: 'All', labelAr: 'الكل' },
    { value: 'PENDING_EMPLOYEE', labelEn: 'Pending Employee', labelAr: 'بانتظار الموظف' },
    { value: 'PENDING_MANAGER', labelEn: 'Pending Manager', labelAr: 'بانتظار المدير' },
    { value: 'APPROVED', labelEn: 'Approved', labelAr: 'موافق عليه' },
    { value: 'REJECTED', labelEn: 'Rejected', labelAr: 'مرفوض' },
  ];

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('إدارة الإجازات', 'Leave Management')} titleEn="Leave Management" icon={CalendarDays} isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={<Plus size={14} />} onClick={() => setIsDialogOpen(true)}>
            {tr('طلب إجازة', 'Leave Request')}
          </CVisionButton>
        }
      />

      {/* Stats */}
      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('بانتظار الموظف', 'Awaiting Employee')} value={stats.pendingEmployee} icon={UserCheck} color={C.gold} colorDim={C.goldDim} />
        <CVisionMiniStat C={C} label={tr('بانتظار المدير', 'Awaiting Manager')} value={stats.pendingManager} icon={ShieldCheck} color={C.orange} colorDim={C.orangeDim} />
        <CVisionMiniStat C={C} label={tr('موافق عليه', 'Approved')} value={stats.approved} icon={CheckCircle} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('الإجمالي', 'Total')} value={stats.total} icon={CalendarDays} color={C.blue} colorDim={C.blueDim} />
      </CVisionStatsRow>

      {/* Pending Employee Confirmation */}
      {pendingEmployee.length > 0 && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.gold}40` }}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={16} color={C.gold} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{tr('بانتظار تأكيد الموظف', 'Pending Employee Confirmation')} ({pendingEmployee.length})</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingEmployee.map(request => (
                <div key={request.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CVisionBadge C={C} variant="info">{isRTL ? (leaveTypeLabels[request.type]?.ar || request.type) : (leaveTypeLabels[request.type]?.en || request.type)}</CVisionBadge>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{request.employeeName}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>{formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.totalDays} {tr('أيام', 'days')})</p>
                      {request.fromSchedule && <p style={{ fontSize: 11, color: C.gold, marginTop: 2 }}>{tr('مطلوب من الجدول بواسطة رئيسة التمريض', 'Requested from schedule by Head Nurse')}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<CheckCircle size={12} />} onClick={() => handleAction(request.id, 'employee-confirm')}>{tr('تأكيد', 'Confirm')}</CVisionButton>
                    <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<XCircle size={12} />} onClick={() => openRejectDialog(request.id, 'employee-reject')}>{tr('رفض', 'Decline')}</CVisionButton>
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Pending Manager Approval */}
      {pendingManager.length > 0 && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.orange}40` }}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} color={C.orange} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.orange }}>{tr('بانتظار موافقة المدير', 'Pending Manager Approval')} ({pendingManager.length})</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingManager.map(request => (
                <div key={request.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: `1px solid ${C.border}`, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CVisionBadge C={C} variant="info">{isRTL ? (leaveTypeLabels[request.type]?.ar || request.type) : (leaveTypeLabels[request.type]?.en || request.type)}</CVisionBadge>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{request.employeeName}</p>
                      <p style={{ fontSize: 11, color: C.textMuted }}>{formatDate(request.startDate)} - {formatDate(request.endDate)} ({request.totalDays} {tr('أيام', 'days')})</p>
                      {request.employeeConfirmedAt && (
                        <p style={{ fontSize: 11, color: C.green, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={10} /> {tr('تم تأكيد الموظف', 'Employee confirmed')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" icon={<CheckCircle size={12} />} onClick={() => handleAction(request.id, 'manager-approve')}>{tr('موافقة', 'Approve')}</CVisionButton>
                    <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<XCircle size={12} />} onClick={() => openRejectDialog(request.id, 'manager-reject')}>{tr('رفض', 'Reject')}</CVisionButton>
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Status Filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Filter size={14} color={C.textMuted} />
        <div style={{ display: 'flex', gap: 4 }}>
          {filterButtons.map(f => (
            <CVisionButton key={f.value} C={C} isDark={isDark} variant={statusFilter === f.value ? 'primary' : 'outline'} size="sm" onClick={() => setStatusFilter(f.value)}>
              {tr(f.labelAr, f.labelEn)}
            </CVisionButton>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {statusFilter === 'all' ? tr('جميع طلبات الإجازة', 'All Leave Requests') : `${tr('طلبات الإجازة', 'Leave Requests')} — ${statusFilter.replace('_', ' ')}`}
          </span>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
              <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
              <CVisionTh C={C}>{tr('من', 'From')}</CVisionTh>
              <CVisionTh C={C}>{tr('إلى', 'To')}</CVisionTh>
              <CVisionTh C={C}>{tr('الأيام', 'Days')}</CVisionTh>
              <CVisionTh C={C}>{tr('السبب', 'Reason')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C}>{tr('إجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {filteredRequests.length === 0 ? (
                <CVisionTr C={C}>
                  <CVisionTd colSpan={8} style={{ textAlign: 'center', padding: 32 }}>
                    <CalendarDays size={48} color={C.textMuted} style={{ margin: '0 auto 8px' }} />
                    <p style={{ color: C.textMuted }}>{tr('لا توجد طلبات إجازة', 'No leave requests found')}</p>
                  </CVisionTd>
                </CVisionTr>
              ) : filteredRequests.map(request => {
                const TypeIcon = leaveTypeIcons[request.type] || CalendarDays;
                return (
                  <CVisionTr key={request.id} C={C}>
                    <CVisionTd style={{ fontWeight: 500, color: C.text }}>{request.employeeName || '-'}</CVisionTd>
                    <CVisionTd>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.textSecondary }}>
                        <TypeIcon size={14} />
                        {isRTL ? (leaveTypeLabels[request.type]?.ar || request.type) : (leaveTypeLabels[request.type]?.en || request.type)}
                      </div>
                    </CVisionTd>
                    <CVisionTd style={{ fontSize: 12, color: C.textSecondary }}>{formatDate(request.startDate)}</CVisionTd>
                    <CVisionTd style={{ fontSize: 12, color: C.textSecondary }}>{formatDate(request.endDate)}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{request.totalDays}</CVisionTd>
                    <CVisionTd style={{ maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: C.textMuted }}>{request.reason || '-'}</CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant={statusVariant(request.status)}>
                        {isRTL ? (statusLabels[request.status]?.ar || request.status) : (statusLabels[request.status]?.en || request.status)}
                      </CVisionBadge>
                    </CVisionTd>
                    <CVisionTd>
                      {request.status === 'PENDING_EMPLOYEE' && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => handleAction(request.id, 'employee-confirm')} title={tr('تأكيد', 'Confirm')}>
                            <CheckCircle size={14} color={C.green} />
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => openRejectDialog(request.id, 'employee-reject')} title={tr('رفض', 'Decline')}>
                            <XCircle size={14} color={C.red} />
                          </CVisionButton>
                        </div>
                      )}
                      {(request.status === 'PENDING_MANAGER' || request.status === 'PENDING') && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => handleAction(request.id, 'manager-approve')} title={tr('موافقة', 'Approve')}>
                            <CheckCircle size={14} color={C.green} />
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => openRejectDialog(request.id, 'manager-reject')} title={tr('رفض', 'Reject')}>
                            <XCircle size={14} color={C.red} />
                          </CVisionButton>
                        </div>
                      )}
                    </CVisionTd>
                  </CVisionTr>
                );
              })}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* New Leave Request Dialog */}
      <CVisionDialog C={C} open={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={tr('طلب إجازة جديد', 'New Leave Request')} titleAr="طلب إجازة جديد" isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <CVisionSelect C={C} label={tr('الموظف *', 'Employee *')} value={formData.employeeId} onChange={v => { setFormData({ ...formData, employeeId: v }); setSelectedEmployee(v); }} options={employees.map(e => ({ value: e.id, label: e.name || '' }))} />

          {balances.length > 0 && (
            <div style={{ padding: 12, background: `${C.blue}10`, borderRadius: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.blue, marginBottom: 8 }}>{tr('الرصيد المتاح:', 'Available Balance:')}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {balances.map(bal => (
                  <CVisionBadge key={bal.type} C={C} variant="muted">
                    {isRTL ? (leaveTypeLabels[bal.type]?.ar || bal.type) : (leaveTypeLabels[bal.type]?.en || bal.type)}: {bal.entitled - bal.used - bal.pending} {tr('أيام', 'days')}
                  </CVisionBadge>
                ))}
              </div>
            </div>
          )}

          <CVisionSelect C={C} label={tr('نوع الإجازة *', 'Leave Type *')} value={formData.type} onChange={v => setFormData({ ...formData, type: v })} options={Object.entries(leaveTypeLabels).map(([key, val]) => ({ value: key, label: isRTL ? val.ar : val.en }))} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionInput C={C} label={tr('من تاريخ *', 'From Date *')} type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            <CVisionInput C={C} label={tr('إلى تاريخ *', 'To Date *')} type="date" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
          </div>

          {calculatedDays !== null && (
            <div style={{ padding: 12, background: `${C.green}10`, borderRadius: 10 }}>
              <p style={{ color: C.green, fontSize: 13 }}>
                {tr('أيام العمل:', 'Working days:')} <strong>{calculatedDays} {tr('أيام', 'days')}</strong>
                <span style={{ fontSize: 11, marginLeft: 8, color: C.textMuted }}>({tr('باستثناء عطلات نهاية الأسبوع', 'excluding weekends')})</span>
              </p>
            </div>
          )}

          <CVisionTextarea C={C} label={tr('السبب', 'Reason')} value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} placeholder={tr('سبب الإجازة (اختياري)...', 'Reason for leave (optional)...')} rows={3} />
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleSubmit}>{tr('تقديم الطلب', 'Submit Request')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>

      {/* Reject Reason Dialog */}
      <CVisionDialog C={C} open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} title={rejectingAction === 'employee-reject' ? tr('رفض طلب الإجازة', 'Decline Leave Request') : tr('رفض طلب الإجازة', 'Reject Leave Request')} titleAr={rejectingAction === 'employee-reject' ? 'رفض طلب الإجازة' : 'رفض طلب الإجازة'} isRTL={isRTL}>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
          {rejectingAction === 'employee-reject' ? tr('يرجى تقديم سبب لرفض طلب الإجازة', 'Please provide a reason for declining this leave request.') : tr('يرجى تقديم سبب لرفض طلب الإجازة', 'Please provide a reason for rejecting this leave request.')}
        </p>
        <CVisionTextarea C={C} placeholder={tr('السبب...', 'Reason...')} value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setRejectDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={confirmReject} disabled={!rejectReason.trim()}>
            {rejectingAction === 'employee-reject' ? tr('رفض', 'Decline') : tr('رفض', 'Reject')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>

      {/* ─── Blackout Periods Section ─────────────────────────────────── */}
      <CVisionCard C={C} style={{ marginTop: 16 }}>
        <CVisionCardHeader C={C}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer' }} onClick={() => setShowBlackouts(!showBlackouts)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Ban size={16} color={C.red} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('فترات حظر الإجازات', 'Leave Blackout Periods')}</span>
              {blackouts.length > 0 && <CVisionBadge C={C} variant="danger">{blackouts.length}</CVisionBadge>}
            </div>
            {showBlackouts ? <ChevronUp size={16} color={C.textMuted} /> : <ChevronDown size={16} color={C.textMuted} />}
          </div>
        </CVisionCardHeader>
        {showBlackouts && (
          <CVisionCardBody>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setBlackoutDialog(true)}>
                {tr('إضافة فترة حظر', 'Add Blackout')}
              </CVisionButton>
            </div>
            {blackouts.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textMuted, fontSize: 13, padding: 20 }}>
                {tr('لا توجد فترات حظر مسجلة', 'No blackout periods configured')}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blackouts.map((b: any) => {
                  const isActive = new Date(b.endDate) >= new Date() && b.isActive;
                  return (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, border: `1px solid ${isActive ? C.red + '40' : C.border}`, background: isActive ? `${C.red}05` : 'transparent', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Shield size={16} color={isActive ? C.red : C.textMuted} />
                        <div>
                          <p style={{ fontWeight: 500, fontSize: 13, color: C.text }}>{isRTL ? (b.nameAr || b.name) : b.name}</p>
                          <p style={{ fontSize: 11, color: C.textMuted }}>
                            {formatDate(b.startDate)} → {formatDate(b.endDate)}
                            {b.scope !== 'ALL' && <span> · {tr('النطاق:', 'Scope:')} {b.scope}</span>}
                          </p>
                          {(isRTL ? b.reasonAr : b.reason) && <p style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{isRTL ? (b.reasonAr || b.reason) : b.reason}</p>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CVisionBadge C={C} variant={isActive ? 'danger' : 'muted'}>{isActive ? tr('فعّال', 'Active') : tr('منتهي', 'Expired')}</CVisionBadge>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => handleDeleteBlackout(b.id)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CVisionCardBody>
        )}
      </CVisionCard>

      {/* Blackout Create Dialog */}
      <CVisionDialog C={C} open={blackoutDialog} onClose={() => setBlackoutDialog(false)} title={tr('إضافة فترة حظر إجازات', 'Add Leave Blackout Period')} titleAr="إضافة فترة حظر إجازات" isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionInput C={C} label={tr('الاسم (عربي)', 'Name (Arabic)')} value={blackoutForm.nameAr} onChange={e => setBlackoutForm({ ...blackoutForm, nameAr: e.target.value })} placeholder={tr('مثال: تجميد رمضان', 'e.g. Ramadan Freeze')} />
            <CVisionInput C={C} label={tr('الاسم (إنجليزي) *', 'Name (English) *')} value={blackoutForm.name} onChange={e => setBlackoutForm({ ...blackoutForm, name: e.target.value })} placeholder="e.g. Ramadan Freeze" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionInput C={C} label={tr('من تاريخ *', 'From Date *')} type="date" value={blackoutForm.startDate} onChange={e => setBlackoutForm({ ...blackoutForm, startDate: e.target.value })} />
            <CVisionInput C={C} label={tr('إلى تاريخ *', 'To Date *')} type="date" value={blackoutForm.endDate} onChange={e => setBlackoutForm({ ...blackoutForm, endDate: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <CVisionTextarea C={C} label={tr('السبب (عربي)', 'Reason (Arabic)')} value={blackoutForm.reasonAr} onChange={e => setBlackoutForm({ ...blackoutForm, reasonAr: e.target.value })} rows={2} />
            <CVisionTextarea C={C} label={tr('السبب (إنجليزي)', 'Reason (English)')} value={blackoutForm.reason} onChange={e => setBlackoutForm({ ...blackoutForm, reason: e.target.value })} rows={2} />
          </div>
          <CVisionSelect C={C} label={tr('النطاق', 'Scope')} value={blackoutForm.scope} onChange={v => setBlackoutForm({ ...blackoutForm, scope: v as any })} options={[
            { value: 'ALL', label: tr('جميع الموظفين', 'All Employees') },
            { value: 'DEPARTMENT', label: tr('قسم محدد', 'Specific Department') },
            { value: 'UNIT', label: tr('وحدة محددة', 'Specific Unit') },
          ]} />
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setBlackoutDialog(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleCreateBlackout} disabled={!blackoutForm.name || !blackoutForm.startDate || !blackoutForm.endDate}>
            {tr('إنشاء فترة الحظر', 'Create Blackout')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
