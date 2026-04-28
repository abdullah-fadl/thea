'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput,
  CVisionPageHeader, CVisionPageLayout, CVisionMiniStat, CVisionStatsRow,
  CVisionSkeletonCard, CVisionSelect, CVisionDialog, CVisionDialogFooter,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd } from '@/components/cvision/ui';
import { toast } from 'sonner';
import {
  FileText, Plus, RefreshCw, AlertTriangle, CheckCircle, Clock,
  Users, Search, Building2, Eye, XCircle, MoreHorizontal,
} from 'lucide-react';

// Types
interface Contract {
  id: string; employeeId: string; employeeName?: string; departmentName?: string;
  contractNumber: string; type: string; status: string; startDate: string; endDate?: string;
  probationEndDate?: string; basicSalary: number; housingAllowance: number; transportAllowance: number;
  totalSalary?: number; durationMonths?: number; vacationDaysPerYear?: number; workingHoursPerWeek?: number;
}
interface Employee { id: string; _id?: string; firstName: string; lastName: string; name?: string; employeeNumber?: string; employeeNo?: string; departmentId?: string; }
interface Department { id: string; name: string; }

const statusVariant = (s: string) => s === 'ACTIVE' ? 'success' as const : s === 'EXPIRED' || s === 'TERMINATED' ? 'danger' as const : s === 'RENEWED' ? 'info' as const : 'muted' as const;
const statusLabelsMap: Record<string, { en: string; ar: string }> = {
  DRAFT: { en: 'Draft', ar: 'مسودة' }, ACTIVE: { en: 'Active', ar: 'نشط' }, EXPIRED: { en: 'Expired', ar: 'منتهي' },
  TERMINATED: { en: 'Terminated', ar: 'منهي' }, RENEWED: { en: 'Renewed', ar: 'مجدد' },
};
const typeLabelsMap: Record<string, { en: string; ar: string }> = {
  PERMANENT: { en: 'Permanent', ar: 'دائم' }, FIXED_TERM: { en: 'Fixed Term', ar: 'محدد المدة' },
  PART_TIME: { en: 'Part Time', ar: 'دوام جزئي' }, PROBATION: { en: 'Probation', ar: 'فترة تجربة' },
};

export default function ContractsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isTerminateDialogOpen, setIsTerminateDialogOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Form
  const [formData, setFormData] = useState({ employeeId: '', type: 'FIXED_TERM', startDate: '', durationValue: '1', durationType: 'years', basicSalary: '', housingAllowance: '', transportAllowance: '', vacationDaysPerYear: '21', workingHoursPerWeek: '48' });
  const [formDepartment, setFormDepartment] = useState('');

  const calculateEndDate = () => {
    if (!formData.startDate || !formData.durationValue) return '';
    const startDate = new Date(formData.startDate);
    const duration = parseInt(formData.durationValue) || 0;
    if (formData.durationType === 'years') startDate.setFullYear(startDate.getFullYear() + duration);
    else startDate.setMonth(startDate.getMonth() + duration);
    startDate.setDate(startDate.getDate() - 1);
    return startDate.toISOString().split('T')[0];
  };
  const calculatedEndDate = calculateEndDate();

  // Fetch contracts
  const { data: contractsRaw, isLoading: loading, refetch: refetchContracts } = useQuery({
    queryKey: cvisionKeys.contracts.list(),
    queryFn: () => cvisionFetch('/api/cvision/contracts'),
  });
  const contracts: Contract[] = Array.isArray(contractsRaw?.data) ? contractsRaw.data : contractsRaw?.data?.contracts || [];

  // Fetch employees
  const { data: empRaw } = useQuery({
    queryKey: cvisionKeys.employees.list({ statuses: 'ACTIVE,PROBATION' }),
    queryFn: () => cvisionFetch('/api/cvision/employees', { params: { statuses: 'ACTIVE,PROBATION' } }),
  });
  const employees: Employee[] = (empRaw?.data?.items || empRaw?.data || []).map((emp: any) => ({
    ...emp, id: emp.id || emp._id, name: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
  }));

  // Fetch departments
  const { data: deptRaw } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 200 }),
    queryFn: () => cvisionFetch('/api/cvision/org/departments', { params: { limit: 200 } }),
  });
  const departments: Department[] = deptRaw?.items ?? deptRaw?.data ?? [];

  // Fetch expiring contracts
  const { data: expiringRaw, refetch: refetchExpiring } = useQuery({
    queryKey: cvisionKeys.contracts.list({ action: 'expiring-soon' }),
    queryFn: () => cvisionFetch('/api/cvision/contracts', { params: { action: 'expiring-soon' } }),
  });
  const expiringContracts: Contract[] = expiringRaw?.data?.contracts || [];

  // Fetch probation contracts
  const { data: probationRaw } = useQuery({
    queryKey: cvisionKeys.contracts.list({ action: 'in-probation' }),
    queryFn: () => cvisionFetch('/api/cvision/contracts', { params: { action: 'in-probation' } }),
  });
  const probationContracts: Contract[] = probationRaw?.data?.contracts || [];

  const filteredFormEmployees = employees.filter(emp => !formDepartment || emp.departmentId === formDepartment);
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = !searchQuery || contract.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) || contract.contractNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !selectedStatus || contract.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const createMutation = useMutation({
    mutationFn: (body: any) => cvisionMutate('/api/cvision/contracts', 'POST', body),
    onSuccess: () => { toast.success(tr('تم إنشاء العقد بنجاح', 'Contract created successfully')); setIsDialogOpen(false); refetchContracts(); setFormData({ employeeId: '', type: 'FIXED_TERM', startDate: '', durationValue: '1', durationType: 'years', basicSalary: '', housingAllowance: '', transportAllowance: '', vacationDaysPerYear: '21', workingHoursPerWeek: '48' }); setFormDepartment(''); },
    onError: (err: any) => toast.error(err?.data?.error || tr('خطأ في إنشاء العقد', 'Error creating contract')),
  });

  const handleSubmit = () => {
    const endDate = formData.type === 'PERMANENT' ? null : calculatedEndDate;
    createMutation.mutate({ employeeId: formData.employeeId, type: formData.type, startDate: formData.startDate, endDate, durationMonths: formData.durationType === 'years' ? parseInt(formData.durationValue) * 12 : parseInt(formData.durationValue), basicSalary: parseFloat(formData.basicSalary), housingAllowance: parseFloat(formData.housingAllowance) || 0, transportAllowance: parseFloat(formData.transportAllowance) || 0, vacationDaysPerYear: parseInt(formData.vacationDaysPerYear), workingHoursPerWeek: parseInt(formData.workingHoursPerWeek) });
  };

  const renewMutation = useMutation({
    mutationFn: (contractId: string) => { const newEndDate = new Date(); newEndDate.setFullYear(newEndDate.getFullYear() + 1); return cvisionMutate('/api/cvision/contracts', 'POST', { action: 'renew', contractId, newEndDate: newEndDate.toISOString() }); },
    onSuccess: (data: any) => { toast.success(data?.message || tr('تم التجديد', 'Renewed')); refetchContracts(); refetchExpiring(); },
    onError: (err: any) => toast.error(err?.data?.error || tr('خطأ في تجديد العقد', 'Error renewing contract')),
  });
  const handleRenew = (contractId: string) => renewMutation.mutate(contractId);

  const terminateMutation = useMutation({
    mutationFn: (contractId: string) => cvisionMutate('/api/cvision/contracts', 'POST', { action: 'terminate', contractId }),
    onSuccess: () => { toast.success(tr('تم إنهاء العقد بنجاح', 'Contract terminated successfully')); setIsTerminateDialogOpen(false); setSelectedContract(null); refetchContracts(); },
    onError: (err: any) => toast.error(err?.data?.error || tr('خطأ في إنهاء العقد', 'Error terminating contract')),
  });
  const handleTerminate = () => { if (!selectedContract) return; terminateMutation.mutate(selectedContract.id); };

  const formatDate = (dateString?: string) => { if (!dateString) return tr('غير محدد', 'Indefinite'); return new Date(dateString).toLocaleDateString('en-US'); };
  const formatCurrency = (amount: number) => amount.toLocaleString('en-US') + ' SAR';

  if (loading) return <CVisionPageLayout><CVisionSkeletonCard C={C} height={250} /></CVisionPageLayout>;

  return (
    <CVisionPageLayout>
      <CVisionPageHeader C={C} title={tr('إدارة العقود', 'Contract Management')} titleEn="Contract Management" icon={FileText} isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={<Plus size={14} />} onClick={() => setIsDialogOpen(true)}>
            {tr('عقد جديد', 'New Contract')}
          </CVisionButton>
        }
      />

      {/* Stats */}
      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('إجمالي العقود', 'Total Contracts')} value={contracts.length} icon={FileText} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('العقود النشطة', 'Active Contracts')} value={contracts.filter(c => c.status === 'ACTIVE').length} icon={CheckCircle} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('تنتهي قريباً', 'Expiring Soon')} value={expiringContracts.length} icon={AlertTriangle} color={C.gold} colorDim={C.goldDim} />
        <CVisionMiniStat C={C} label={tr('فترة تجربة', 'In Probation')} value={probationContracts.length} icon={Clock} color={C.blue} colorDim={C.blueDim} />
      </CVisionStatsRow>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={14} color={C.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
              <CVisionInput C={C} placeholder={tr('بحث بالاسم أو رقم العقد...', 'Search by name or contract #...')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
            <div style={{ width: 180 }}>
              <CVisionSelect C={C} label={tr('القسم', 'Department')} value={selectedDepartment || 'all'} onChange={v => setSelectedDepartment(v === 'all' ? '' : v)} options={[{ value: 'all', label: tr('جميع الأقسام', 'All Departments') }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
            </div>
            <div style={{ width: 150 }}>
              <CVisionSelect C={C} label={tr('الحالة', 'Status')} value={selectedStatus || 'all'} onChange={v => setSelectedStatus(v === 'all' ? '' : v)} options={[{ value: 'all', label: tr('الكل', 'All Status') }, ...Object.entries(statusLabelsMap).map(([k, v]) => ({ value: k, label: isRTL ? v.ar : v.en }))]} />
            </div>
            <CVisionButton C={C} isDark={isDark} variant="outline" icon={<RefreshCw size={14} />} onClick={() => refetchContracts()}>{tr('تحديث', 'Refresh')}</CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Expiring Contracts Alert */}
      {expiringContracts.length > 0 && (
        <CVisionCard C={C} style={{ border: `1px solid ${C.gold}40` }}>
          <CVisionCardHeader C={C}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color={C.gold} />
              <span style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>{tr('عقود تنتهي خلال 30 يوم', 'Contracts Expiring Within 30 Days')}</span>
            </div>
          </CVisionCardHeader>
          <CVisionCardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {expiringContracts.map(contract => (
                <div key={contract.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: C.bgCard }}>
                  <span style={{ color: C.text, fontSize: 13 }}>{contract.employeeName || contract.contractNumber}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{tr('ينتهي:', 'Expires:')} {formatDate(contract.endDate)}</span>
                    <CVisionButton C={C} isDark={isDark} variant="primary" size="sm" onClick={() => handleRenew(contract.id)}>{tr('تجديد', 'Renew')}</CVisionButton>
                  </div>
                </div>
              ))}
            </div>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Contracts Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('قائمة العقود', 'Contracts List')} ({filteredContracts.length})</span>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr('رقم العقد', 'Contract #')}</CVisionTh>
              <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
              <CVisionTh C={C}>{tr('النوع', 'Type')}</CVisionTh>
              <CVisionTh C={C}>{tr('البداية', 'Start Date')}</CVisionTh>
              <CVisionTh C={C}>{tr('النهاية', 'End Date')}</CVisionTh>
              <CVisionTh C={C}>{tr('المدة', 'Duration')}</CVisionTh>
              <CVisionTh C={C} align="right">{tr('الراتب', 'Salary')}</CVisionTh>
              <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
              <CVisionTh C={C}>{tr('إجراءات', 'Actions')}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {filteredContracts.length === 0 ? (
                <CVisionTr C={C}>
                  <CVisionTd colSpan={9} style={{ textAlign: 'center', padding: 32 }}>
                    <Users size={48} color={C.textMuted} style={{ margin: '0 auto 8px' }} />
                    <p style={{ color: C.textMuted }}>{tr('لا توجد عقود', 'No contracts found')}</p>
                  </CVisionTd>
                </CVisionTr>
              ) : filteredContracts.map(contract => (
                <CVisionTr key={contract.id} C={C}>
                  <CVisionTd style={{ fontFamily: 'monospace', color: C.textSecondary, fontSize: 12 }}>{contract.contractNumber}</CVisionTd>
                  <CVisionTd>
                    <div style={{ fontWeight: 500, color: C.text, fontSize: 13 }}>{contract.employeeName || '-'}</div>
                    {contract.departmentName && <div style={{ fontSize: 11, color: C.textMuted }}>{contract.departmentName}</div>}
                  </CVisionTd>
                  <CVisionTd style={{ color: C.textSecondary, fontSize: 13 }}>{isRTL ? (typeLabelsMap[contract.type]?.ar || contract.type) : (typeLabelsMap[contract.type]?.en || contract.type)}</CVisionTd>
                  <CVisionTd style={{ fontSize: 12, color: C.textSecondary }}>{formatDate(contract.startDate)}</CVisionTd>
                  <CVisionTd style={{ fontSize: 12, color: C.textSecondary }}>{formatDate(contract.endDate)}</CVisionTd>
                  <CVisionTd style={{ fontSize: 12, color: C.textMuted }}>
                    {contract.durationMonths ? (contract.durationMonths >= 12 ? `${Math.floor(contract.durationMonths / 12)} ${tr('سنة', 'year(s)')}` : `${contract.durationMonths} ${tr('شهر', 'month(s)')}`) : contract.type === 'PERMANENT' ? tr('غير محدد', 'Indefinite') : '-'}
                  </CVisionTd>
                  <CVisionTd align="right" style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{formatCurrency(contract.basicSalary + (contract.housingAllowance || 0) + (contract.transportAllowance || 0))}</CVisionTd>
                  <CVisionTd>
                    <CVisionBadge C={C} variant={statusVariant(contract.status)}>{isRTL ? (statusLabelsMap[contract.status]?.ar || contract.status) : (statusLabelsMap[contract.status]?.en || contract.status)}</CVisionBadge>
                  </CVisionTd>
                  <CVisionTd>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => { setSelectedContract(contract); setIsViewDialogOpen(true); }} title={tr('عرض', 'View')}><Eye size={14} /></CVisionButton>
                      {contract.status === 'ACTIVE' && contract.endDate && (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => handleRenew(contract.id)} title={tr('تجديد', 'Renew')}><RefreshCw size={14} /></CVisionButton>
                      )}
                      {contract.status === 'ACTIVE' && (
                        <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" onClick={() => { setSelectedContract(contract); setIsTerminateDialogOpen(true); }} title={tr('إنهاء', 'Terminate')}><XCircle size={14} color={C.red} /></CVisionButton>
                      )}
                    </div>
                  </CVisionTd>
                </CVisionTr>
              ))}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

      {/* Create Contract Dialog */}
      <CVisionDialog C={C} open={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={tr('إنشاء عقد جديد', 'Create New Contract')} titleAr="إنشاء عقد جديد" isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <CVisionSelect C={C} label={tr('القسم', 'Department')} value={formDepartment || 'all'} onChange={v => { setFormDepartment(v === 'all' ? '' : v); setFormData({ ...formData, employeeId: '' }); }} options={[{ value: 'all', label: tr('جميع الأقسام', 'All Departments') }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
            <CVisionSelect C={C} label={tr('الموظف *', 'Employee *')} value={formData.employeeId || undefined} onChange={v => {
              setFormData(prev => ({ ...prev, employeeId: v }));
              if (v) {
                const empContracts = contracts.filter((c: any) => c.employeeId === v).sort((a: any, b: any) => new Date(b.endDate || b.startDate).getTime() - new Date(a.endDate || a.startDate).getTime());
                const latest = empContracts[0];
                if (latest) {
                  let newStart = '';
                  if (latest.endDate) { const end = new Date(latest.endDate); end.setDate(end.getDate() + 1); newStart = end.toISOString().split('T')[0]; }
                  setFormData(prev => ({ ...prev, employeeId: v, type: latest.type || 'FIXED_TERM', startDate: newStart || prev.startDate, basicSalary: String(latest.basicSalary || ''), housingAllowance: String(latest.housingAllowance || ''), transportAllowance: String(latest.transportAllowance || ''), vacationDaysPerYear: String(latest.vacationDaysPerYear || 21), workingHoursPerWeek: String(latest.workingHoursPerWeek || 48) }));
                }
              }
            }} options={filteredFormEmployees.map(e => ({ value: e.id, label: `${e.name}${e.employeeNo ? ` (${e.employeeNo})` : ''}` }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <CVisionInput C={C} label={tr('تاريخ البداية *', 'Start Date *')} type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
            <CVisionSelect C={C} label={tr('نوع العقد *', 'Contract Type *')} value={formData.type} onChange={v => setFormData({ ...formData, type: v })} options={Object.entries(typeLabelsMap).filter(([k]) => k !== 'PROBATION').map(([k, v]) => ({ value: k, label: isRTL ? v.ar : v.en }))} />
          </div>
          {formData.type !== 'PERMANENT' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <CVisionInput C={C} label={tr('المدة *', 'Duration *')} type="number" value={formData.durationValue} onChange={e => setFormData({ ...formData, durationValue: e.target.value })} style={{ width: 70 }} />
                <div style={{ flex: 1 }}>
                  <CVisionSelect C={C} label=" " value={formData.durationType} onChange={v => setFormData({ ...formData, durationType: v })} options={[{ value: 'months', label: tr('أشهر', 'Months') }, { value: 'years', label: tr('سنوات', 'Years') }]} />
                </div>
              </div>
              <CVisionInput C={C} label={tr('تاريخ النهاية (تلقائي)', 'End Date (Auto)')} type="date" value={calculatedEndDate} disabled />
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <CVisionInput C={C} label={tr('الراتب الأساسي *', 'Basic Salary *')} type="number" placeholder="5000" value={formData.basicSalary} onChange={e => setFormData({ ...formData, basicSalary: e.target.value })} />
            <CVisionInput C={C} label={tr('بدل سكن', 'Housing')} type="number" placeholder="1500" value={formData.housingAllowance} onChange={e => setFormData({ ...formData, housingAllowance: e.target.value })} />
            <CVisionInput C={C} label={tr('بدل نقل', 'Transport')} type="number" placeholder="500" value={formData.transportAllowance} onChange={e => setFormData({ ...formData, transportAllowance: e.target.value })} />
          </div>
          <CVisionInput C={C} label={tr('أيام الإجازة السنوية', 'Annual Vacation Days')} type="number" value={formData.vacationDaysPerYear} onChange={e => setFormData({ ...formData, vacationDaysPerYear: e.target.value })} style={{ width: 100 }} />

          <div style={{ padding: 12, background: C.bgCard, borderRadius: 10, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{tr('إجمالي الراتب الشهري:', 'Total Monthly Salary:')}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: C.green }}>{formatCurrency((parseFloat(formData.basicSalary) || 0) + (parseFloat(formData.housingAllowance) || 0) + (parseFloat(formData.transportAllowance) || 0))}</span>
            </div>
            {formData.type !== 'PERMANENT' && formData.startDate && calculatedEndDate && (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{formData.durationValue} {formData.durationType === 'years' ? tr('سنة', 'Year(s)') : tr('شهر', 'Month(s)')} - {formData.startDate} → {calculatedEndDate}</div>
            )}
            {formData.type === 'PERMANENT' && <div style={{ fontSize: 11, color: C.purple, marginTop: 4 }}>{tr('عقد دائم (بدون تاريخ انتهاء)', 'Permanent Contract (No End Date)')}</div>}
          </div>
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setIsDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleSubmit} disabled={!formData.employeeId || !formData.startDate}>{tr('إنشاء العقد', 'Create Contract')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>

      {/* View Contract Dialog */}
      <CVisionDialog C={C} open={isViewDialogOpen} onClose={() => setIsViewDialogOpen(false)} title={tr('تفاصيل العقد', 'Contract Details')} titleAr="تفاصيل العقد" isRTL={isRTL}>
        {selectedContract && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                [tr('رقم العقد', 'Contract #'), selectedContract.contractNumber],
                [tr('الحالة', 'Status'), null],
                [tr('الموظف', 'Employee'), selectedContract.employeeName || '-'],
                [tr('القسم', 'Department'), selectedContract.departmentName || '-'],
                [tr('النوع', 'Type'), isRTL ? (typeLabelsMap[selectedContract.type]?.ar || selectedContract.type) : (typeLabelsMap[selectedContract.type]?.en || selectedContract.type)],
                [tr('تاريخ البداية', 'Start Date'), formatDate(selectedContract.startDate)],
                [tr('تاريخ النهاية', 'End Date'), formatDate(selectedContract.endDate)],
                [tr('نهاية التجربة', 'Probation End'), formatDate(selectedContract.probationEndDate)],
              ].map(([label, value], i) => (
                <div key={i}>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{label}</p>
                  {i === 1 ? <CVisionBadge C={C} variant={statusVariant(selectedContract.status)}>{isRTL ? (statusLabelsMap[selectedContract.status]?.ar || selectedContract.status) : (statusLabelsMap[selectedContract.status]?.en || selectedContract.status)}</CVisionBadge> : <p style={{ fontWeight: 500, color: C.text }}>{value}</p>}
                </div>
              ))}
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 8 }}>{tr('تفصيل الراتب', 'Salary Breakdown')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('الراتب الأساسي:', 'Basic Salary:')}</span><span style={{ color: C.text }}>{formatCurrency(selectedContract.basicSalary)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('بدل السكن:', 'Housing:')}</span><span style={{ color: C.text }}>{formatCurrency(selectedContract.housingAllowance || 0)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: C.textMuted }}>{tr('بدل النقل:', 'Transport:')}</span><span style={{ color: C.text }}>{formatCurrency(selectedContract.transportAllowance || 0)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}><span style={{ color: C.text }}>{tr('الإجمالي:', 'Total:')}</span><span style={{ color: C.green }}>{formatCurrency(selectedContract.basicSalary + (selectedContract.housingAllowance || 0) + (selectedContract.transportAllowance || 0))}</span></div>
              </div>
            </div>
          </div>
        )}
      </CVisionDialog>

      {/* Terminate Contract Dialog */}
      <CVisionDialog C={C} open={isTerminateDialogOpen} onClose={() => setIsTerminateDialogOpen(false)} title={tr('إنهاء العقد', 'Terminate Contract')} titleAr="إنهاء العقد" isRTL={isRTL}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: C.textSecondary, fontSize: 13 }}>{tr('هل أنت متأكد من إنهاء هذا العقد؟', 'Are you sure you want to terminate this contract?')}</p>
          {selectedContract && (
            <div style={{ padding: 12, background: C.bgCard, borderRadius: 10, fontSize: 13 }}>
              <p style={{ color: C.text }}><strong>{tr('الموظف:', 'Employee:')}</strong> {selectedContract.employeeName}</p>
              <p style={{ color: C.text }}><strong>{tr('العقد:', 'Contract:')}</strong> {selectedContract.contractNumber}</p>
            </div>
          )}
          <p style={{ fontSize: 12, color: C.textMuted }}>{tr('هذا الإجراء لا يمكن التراجع عنه. سيتم تغيير حالة العقد إلى "منهي".', 'This action cannot be undone. The contract status will be changed to Terminated.')}</p>
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setIsTerminateDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleTerminate}>{tr('إنهاء العقد', 'Terminate Contract')}</CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
