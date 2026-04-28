'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { GOSI_RATES } from '@/lib/cvision/gosi';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody, CVisionButton, CVisionBadge, CVisionInput, CVisionLabel, CVisionSelect, CVisionDialog, CVisionDialogFooter, CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd, CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat, CVisionEmptyState, CVisionSkeletonCard, CVisionSkeletonStyles } from '@/components/cvision/ui';
import { Plus, Edit, DollarSign, Search, Building2, User, Hash, Calculator, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Employee { id: string; firstName: string; lastName: string; email: string; employeeNumber?: string; departmentId?: string; departmentName?: string; jobTitleId?: string; status: string; }
interface Contract { id: string; employeeId: string; basicSalary: number; housingAllowance: number; transportAllowance: number; otherAllowances: number; status: string; }
interface Department { id: string; name: string; }
interface PayrollProfile { id: string; employeeId: string; employeeName?: string; employeeNumber?: string; departmentId?: string; departmentName?: string; baseSalary: number; allowancesJson: Record<string, number>; deductionsJson: Record<string, number>; isActive: boolean; createdAt: string; updatedAt: string; }

const ALLOWANCE_TYPES = [
  { key: 'housing', en: 'Housing', ar: 'السكن' },
  { key: 'transport', en: 'Transport', ar: 'النقل' },
  { key: 'food', en: 'Food', ar: 'الطعام' },
  { key: 'phone', en: 'Phone', ar: 'الهاتف' },
  { key: 'other', en: 'Other', ar: 'اخرى' },
];

const GOSI_RATE = GOSI_RATES.EMPLOYEE_RATE; // 9.75%

export default function PayrollProfilesPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const queryClient = useQueryClient();

  const { data: profilesData, isLoading: profilesLoading } = useQuery({
    queryKey: cvisionKeys.payroll.profiles.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/payroll/profiles'),
  });
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: cvisionKeys.employees.list({ statuses: 'ACTIVE,PROBATION' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/employees', { params: { statuses: 'ACTIVE,PROBATION' } }),
  });
  const { data: deptsData, isLoading: deptsLoading } = useQuery({
    queryKey: cvisionKeys.departments.list(),
    queryFn: () => cvisionFetch<any>('/api/cvision/org/departments'),
  });
  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: cvisionKeys.contracts.list({ status: 'ACTIVE' }),
    queryFn: () => cvisionFetch<any>('/api/cvision/contracts', { params: { status: 'ACTIVE' } }),
  });

  const profiles: PayrollProfile[] = profilesData?.profiles || profilesData?.data?.items || profilesData?.data || [];
  const employees: Employee[] = employeesData?.employees || employeesData?.data?.items || employeesData?.data || [];
  const departments: Department[] = deptsData?.departments || deptsData?.items || deptsData?.data?.items || deptsData?.data || [];
  const contracts: Contract[] = contractsData?.data || contractsData?.contracts || [];
  const loading = profilesLoading || employeesLoading || deptsLoading || contractsLoading;

  const saveMutation = useMutation({
    mutationFn: (params: { url: string; method: 'POST' | 'PATCH'; body: any }) =>
      cvisionMutate(params.url, params.method, params.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cvisionKeys.payroll.profiles.all });
    },
  });
  const saving = saveMutation.isPending;
  const [syncingContract, setSyncingContract] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PayrollProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchEmployeeId, setSearchEmployeeId] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [dialogSearchName, setDialogSearchName] = useState('');
  const [dialogSearchId, setDialogSearchId] = useState('');
  const [dialogFilterDept, setDialogFilterDept] = useState<string>('all');
  const [selectedEmployeeContract, setSelectedEmployeeContract] = useState<Contract | null>(null);

  const [formData, setFormData] = useState({
    employeeId: '', baseSalary: 0,
    allowances: {} as Record<string, number>,
    deductions: {} as Record<string, number>,
    autoCalculateGosi: true,
  });

  useEffect(() => {
    if (formData.autoCalculateGosi && formData.baseSalary > 0) {
      const gosiAmount = Math.round(formData.baseSalary * GOSI_RATE);
      setFormData(prev => ({ ...prev, deductions: { ...prev.deductions, gosi: gosiAmount } }));
    }
  }, [formData.baseSalary, formData.autoCalculateGosi]);

  function loadContractForEmployee(employeeId: string) {
    const contract = contracts.find(c => c.employeeId === employeeId);
    if (contract) {
      setSelectedEmployeeContract(contract);
      const gosiAmount = Math.round(contract.basicSalary * GOSI_RATE);
      setFormData(prev => ({ ...prev, employeeId, baseSalary: contract.basicSalary,
        allowances: { housing: contract.housingAllowance || 0, transport: contract.transportAllowance || 0, other: contract.otherAllowances || 0 },
        deductions: { ...prev.deductions, gosi: gosiAmount } }));
      toast.success(tr('تم تحميل بيانات العقد', 'Contract data loaded'));
    } else {
      setSelectedEmployeeContract(null);
      setFormData(prev => ({ ...prev, employeeId }));
    }
  }

  function syncFromContract() {
    if (!editingProfile) return;
    const contract = contracts.find(c => c.employeeId === editingProfile.employeeId);
    if (!contract) { toast.error(tr('لا يوجد عقد نشط', 'No active contract found')); return; }
    setSyncingContract(true);
    const gosiAmount = Math.round(contract.basicSalary * GOSI_RATE);
    setFormData(prev => ({ ...prev, baseSalary: contract.basicSalary,
      allowances: { housing: contract.housingAllowance || 0, transport: contract.transportAllowance || 0, other: contract.otherAllowances || 0 },
      deductions: { ...prev.deductions, gosi: gosiAmount } }));
    setSelectedEmployeeContract(contract);
    toast.success(tr('تم المزامنة من العقد', 'Synced from contract'));
    setSyncingContract(false);
  }

  function openCreateDialog() {
    setEditingProfile(null); setSelectedEmployeeContract(null);
    setFormData({ employeeId: '', baseSalary: 0, allowances: {}, deductions: {}, autoCalculateGosi: true });
    setDialogSearchName(''); setDialogSearchId(''); setDialogFilterDept('all');
    setDialogOpen(true);
  }

  function openEditDialog(profile: PayrollProfile) {
    setEditingProfile(profile);
    const contract = contracts.find(c => c.employeeId === profile.employeeId);
    setSelectedEmployeeContract(contract || null);
    const currentGosi = profile.deductionsJson?.gosi || 0;
    const expectedGosi = Math.round(profile.baseSalary * GOSI_RATE);
    setFormData({ employeeId: profile.employeeId, baseSalary: profile.baseSalary,
      allowances: profile.allowancesJson || {}, deductions: profile.deductionsJson || {},
      autoCalculateGosi: Math.abs(currentGosi - expectedGosi) < 1 });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formData.employeeId && !editingProfile) { toast.error(tr('اختر موظف', 'Please select an employee')); return; }
    if (formData.baseSalary <= 0) { toast.error(tr('ادخل الراتب الاساسي', 'Please enter the base salary')); return; }
    try {
      const url = editingProfile ? `/api/cvision/payroll/profiles/${editingProfile.id}` : '/api/cvision/payroll/profiles';
      const data = await saveMutation.mutateAsync({
        url,
        method: editingProfile ? 'PATCH' : 'POST',
        body: { employeeId: formData.employeeId, baseSalary: formData.baseSalary, allowancesJson: formData.allowances, deductionsJson: formData.deductions },
      });
      if (data.success) {
        toast.success(editingProfile ? tr('تم تحديث الملف', 'Profile updated') : tr('تم انشاء الملف', 'Profile created'));
        setDialogOpen(false);
      } else { toast.error(data.error || tr('فشل الحفظ', 'Failed to save profile')); }
    } catch { toast.error(tr('فشل الحفظ', 'Failed to save profile')); }
  }

  const calculateTotalSalary = () => {
    const totalAllow = Object.values(formData.allowances).reduce((s, v) => s + (v || 0), 0);
    const totalDeduct = Object.values(formData.deductions).reduce((s, v) => s + (v || 0), 0);
    return formData.baseSalary + totalAllow - totalDeduct;
  };

  const filteredProfiles = profiles.filter(p => {
    const matchesName = !searchTerm || p.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEmpId = !searchEmployeeId || p.employeeNumber?.toLowerCase().includes(searchEmployeeId.toLowerCase()) || p.employeeId?.toLowerCase().includes(searchEmployeeId.toLowerCase());
    const matchesDept = filterDepartment === 'all' || p.departmentId === filterDepartment || p.departmentName === filterDepartment;
    return matchesName && matchesEmpId && matchesDept;
  });

  const employeesWithoutProfiles = employees.filter(emp => !profiles.some(p => p.employeeId === emp.id));
  const filteredEmployeesForDialog = employeesWithoutProfiles.filter(emp => {
    const matchesName = !dialogSearchName || `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(dialogSearchName.toLowerCase());
    const matchesId = !dialogSearchId || emp.employeeNumber?.toLowerCase().includes(dialogSearchId.toLowerCase());
    const matchesDept = dialogFilterDept === 'all' || emp.departmentId === dialogFilterDept;
    return matchesName && matchesId && matchesDept;
  });

  if (loading) {
    return (
      <CVisionPageLayout>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={40} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {[1,2,3,4].map(i => <CVisionSkeletonCard key={i} C={C} height={100} />)}
        </div>
        <CVisionSkeletonCard C={C} height={300} />
      </CVisionPageLayout>
    );
  }

  return (
    <CVisionPageLayout>
      <CVisionPageHeader
        C={C}
        title={tr('ملفات الرواتب', 'Payroll Profiles')}
        titleEn={isRTL ? 'Payroll Profiles' : undefined}
        subtitle={tr('ادارة ملفات رواتب الموظفين', 'Manage employee salary profiles')}
        icon={DollarSign}
        isRTL={isRTL}
        actions={
          <CVisionButton C={C} isDark={isDark} variant="primary" icon={Plus} onClick={openCreateDialog}>
            {tr('اضافة ملف', 'Add Profile')}
          </CVisionButton>
        }
      />

      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr('ملفات نشطة', 'Active Profiles')} value={profiles.length} icon={User} color={C.green} colorDim={C.greenDim} />
        <CVisionMiniStat C={C} label={tr('بدون ملف', 'Without Profile')} value={employeesWithoutProfiles.length} icon={User} color={C.orange} colorDim={C.orangeDim} />
        <CVisionMiniStat C={C} label={tr('اجمالي الرواتب', 'Total Base Salaries')} value={profiles.reduce((s, p) => s + p.baseSalary, 0).toLocaleString()} icon={DollarSign} color={C.blue} colorDim={C.blueDim} />
        <CVisionMiniStat C={C} label={tr('متوسط الراتب', 'Average Salary')} value={Math.round(profiles.reduce((s, p) => s + p.baseSalary, 0) / (profiles.length || 1)).toLocaleString()} icon={DollarSign} color={C.purple} colorDim={C.purpleDim} />
      </CVisionStatsRow>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <CVisionInput C={C} placeholder={tr('بحث بالاسم...', 'Search by name...')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div style={{ width: 200 }}>
              <CVisionInput C={C} placeholder={tr('بحث برقم الموظف...', 'Search by Employee ID...')} value={searchEmployeeId} onChange={(e) => setSearchEmployeeId(e.target.value)} />
            </div>
            <div style={{ width: 200 }}>
              <CVisionSelect C={C} value={filterDepartment} onChange={setFilterDepartment}
                options={[{ value: 'all', label: tr('كل الاقسام', 'All Departments') }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Profiles Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr('ملفات الرواتب', 'Payroll Profiles')} ({filteredProfiles.length})</span>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          {filteredProfiles.length === 0 ? (
            <CVisionEmptyState C={C} icon={DollarSign} title={tr('لا توجد ملفات رواتب', 'No payroll profiles found')}
              action={<CVisionButton C={C} isDark={isDark} variant="primary" icon={Plus} onClick={openCreateDialog}>{tr('اضافة ملف', 'Add Profile')}</CVisionButton>} />
          ) : (
            <CVisionTable C={C}>
              <CVisionTableHead C={C}>
                <CVisionTr C={C}>
                  <CVisionTh C={C}>{tr('رقم الموظف', 'Employee ID')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الموظف', 'Employee')}</CVisionTh>
                  <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الراتب الاساسي', 'Base Salary')}</CVisionTh>
                  <CVisionTh C={C}>{tr('البدلات', 'Allowances')}</CVisionTh>
                  <CVisionTh C={C}>{tr('التأمينات', 'GOSI')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الصافي (تقريبي)', 'Net (Approx)')}</CVisionTh>
                  <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                  <CVisionTh C={C}>{tr('اجراءات', 'Actions')}</CVisionTh>
                </CVisionTr>
              </CVisionTableHead>
              <CVisionTableBody>
                {filteredProfiles.map(profile => {
                  const totalAllowances = Object.values(profile.allowancesJson || {}).reduce((s, v) => s + v, 0);
                  const totalDeductions = Object.values(profile.deductionsJson || {}).reduce((s, v) => s + v, 0);
                  const netSalary = profile.baseSalary + totalAllowances - totalDeductions;
                  const gosiAmount = profile.deductionsJson?.gosi || 0;
                  return (
                    <CVisionTr key={profile.id} C={C}>
                      <CVisionTd C={C} style={{ fontFamily: 'monospace', fontSize: 12 }}>{profile.employeeNumber || '-'}</CVisionTd>
                      <CVisionTd C={C} style={{ fontWeight: 500 }}>{profile.employeeName || '-'}</CVisionTd>
                      <CVisionTd C={C}>{profile.departmentName || '-'}</CVisionTd>
                      <CVisionTd C={C}>{profile.baseSalary.toLocaleString()} {tr('ر.س', 'SAR')}</CVisionTd>
                      <CVisionTd C={C} style={{ color: C.green }}>+{totalAllowances.toLocaleString()}</CVisionTd>
                      <CVisionTd C={C} style={{ color: C.red }}>-{gosiAmount.toLocaleString()}</CVisionTd>
                      <CVisionTd C={C} style={{ fontWeight: 700 }}>{netSalary.toLocaleString()} {tr('ر.س', 'SAR')}</CVisionTd>
                      <CVisionTd C={C}>
                        <CVisionBadge C={C} variant={profile.isActive ? 'success' : 'muted'}>{profile.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}</CVisionBadge>
                      </CVisionTd>
                      <CVisionTd C={C}>
                        <CVisionButton C={C} isDark={isDark} variant="ghost" icon={Edit} onClick={() => openEditDialog(profile)} />
                      </CVisionTd>
                    </CVisionTr>
                  );
                })}
              </CVisionTableBody>
            </CVisionTable>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* Create/Edit Dialog */}
      <CVisionDialog C={C} open={dialogOpen} onClose={() => setDialogOpen(false)}
        title={editingProfile ? tr('تعديل ملف الراتب', 'Edit Payroll Profile') : tr('انشاء ملف راتب', 'Create Payroll Profile')}
        maxWidth={640}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Employee Selection */}
          {!editingProfile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <CVisionLabel C={C} style={{ fontSize: 15, fontWeight: 600 }}>{tr('اختر الموظف', 'Select Employee')}</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <CVisionInput C={C} placeholder={tr('بحث بالاسم...', 'Search by name...')} value={dialogSearchName} onChange={(e) => setDialogSearchName(e.target.value)} />
                <CVisionInput C={C} placeholder={tr('رقم الموظف...', 'Employee ID...')} value={dialogSearchId} onChange={(e) => setDialogSearchId(e.target.value)} />
                <CVisionSelect C={C} value={dialogFilterDept} onChange={setDialogFilterDept}
                  options={[{ value: 'all', label: tr('كل الاقسام', 'All Departments') }, ...departments.map(d => ({ value: d.id, label: d.name }))]} />
              </div>
              <CVisionSelect C={C} value={formData.employeeId}
                onChange={(value) => loadContractForEmployee(value)}
                options={filteredEmployeesForDialog.map(emp => ({ value: emp.id, label: `${emp.firstName} ${emp.lastName} (${emp.employeeNumber || tr('بدون رقم', 'No ID')})` }))}
                label={tr('الموظف', 'Employee')} />
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {filteredEmployeesForDialog.length} {tr('موظف متاح', 'employees available')}
              </span>
              {selectedEmployeeContract && (
                <div style={{ background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.green, fontWeight: 500, fontSize: 13 }}>
                    <FileText size={14} /> {tr('تم تحميل بيانات العقد', 'Contract Data Loaded')}
                  </div>
                </div>
              )}
              {formData.employeeId && !selectedEmployeeContract && (
                <div style={{ background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.orange, fontWeight: 500, fontSize: 13 }}>
                    <FileText size={14} /> {tr('لا يوجد عقد نشط - ادخل البيانات يدوياً', 'No Active Contract - enter salary data manually')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contract sync for editing */}
          {editingProfile && (
            <div style={{ background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.blue, fontWeight: 500, fontSize: 13 }}><FileText size={14} /> {tr('مزامنة العقد', 'Contract Sync')}</div>
                <span style={{ fontSize: 11, color: C.blue }}>{selectedEmployeeContract ? `${tr('راتب العقد', 'Contract salary')}: ${selectedEmployeeContract.basicSalary.toLocaleString()} ${tr('ر.س', 'SAR')}` : tr('لا يوجد عقد نشط', 'No active contract found')}</span>
              </div>
              <CVisionButton C={C} isDark={isDark} variant="outline" icon={RefreshCw} onClick={syncFromContract} disabled={syncingContract || !contracts.some(c => c.employeeId === editingProfile.employeeId)}>
                {tr('مزامنة', 'Sync')}
              </CVisionButton>
            </div>
          )}

          {/* Base Salary */}
          <CVisionInput C={C} type="number" label={`${tr('الراتب الاساسي', 'Base Salary')} *`} value={String(formData.baseSalary || '')}
            onChange={(e) => setFormData({ ...formData, baseSalary: parseFloat(e.target.value) || 0 })} placeholder="5000" />

          {/* Allowances */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} style={{ color: C.green, fontWeight: 600 }}>{tr('البدلات', 'Allowances')}</CVisionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {ALLOWANCE_TYPES.map(type => (
                <CVisionInput key={type.key} C={C} type="number" label={tr(type.ar, type.en)}
                  value={String(formData.allowances[type.key] || '')}
                  onChange={(e) => setFormData({ ...formData, allowances: { ...formData.allowances, [type.key]: parseFloat(e.target.value) || 0 } })}
                  placeholder="0" />
              ))}
            </div>
          </div>

          {/* Deductions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CVisionLabel C={C} style={{ color: C.red, fontWeight: 600 }}>{tr('الخصومات الثابتة', 'Fixed Deductions')}</CVisionLabel>
            {/* GOSI */}
            <div style={{ background: C.bgSubtle, borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Calculator size={14} color={C.textMuted} /> {tr(`التأمينات الاجتماعية (${GOSI_RATE * 100}%)`, `GOSI (${GOSI_RATE * 100}%)`)}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.textMuted, cursor: 'pointer' }}>
                  {tr('حساب تلقائي', 'Auto-calculate')}
                  <input type="checkbox" checked={formData.autoCalculateGosi} onChange={(e) => {
                    setFormData(prev => ({ ...prev, autoCalculateGosi: e.target.checked,
                      deductions: { ...prev.deductions, gosi: e.target.checked ? Math.round(prev.baseSalary * GOSI_RATE) : prev.deductions.gosi || 0 } }));
                  }} />
                </label>
              </div>
              <CVisionInput C={C} type="number" value={String(formData.deductions.gosi || '')} disabled={formData.autoCalculateGosi}
                onChange={(e) => setFormData({ ...formData, deductions: { ...formData.deductions, gosi: parseFloat(e.target.value) || 0 }, autoCalculateGosi: false })}
                placeholder="0" />
              {formData.autoCalculateGosi && formData.baseSalary > 0 && (
                <span style={{ fontSize: 11, color: C.textMuted, marginTop: 4, display: 'block' }}>
                  {tr('حساب تلقائي', 'Auto-calculated')}: {formData.baseSalary.toLocaleString()} x {GOSI_RATE * 100}% = {Math.round(formData.baseSalary * GOSI_RATE).toLocaleString()} {tr('ر.س', 'SAR')}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <CVisionInput C={C} type="number" label={tr('ضريبة', 'Tax')} value={String(formData.deductions.tax || '')}
                onChange={(e) => setFormData({ ...formData, deductions: { ...formData.deductions, tax: parseFloat(e.target.value) || 0 } })} placeholder="0" />
              <CVisionInput C={C} type="number" label={tr('اخرى', 'Other')} value={String(formData.deductions.other || '')}
                onChange={(e) => setFormData({ ...formData, deductions: { ...formData.deductions, other: parseFloat(e.target.value) || 0 } })} placeholder="0" />
            </div>
          </div>

          {/* Summary */}
          <CVisionCard C={C} style={{ background: C.bgSubtle }}>
            <CVisionCardBody style={{ padding: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.text }}><span>{tr('الراتب الاساسي', 'Base Salary')}:</span><span>{formData.baseSalary.toLocaleString()} {tr('ر.س', 'SAR')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.green }}><span>+ {tr('البدلات', 'Allowances')}:</span><span>{Object.values(formData.allowances).reduce((s, v) => s + (v || 0), 0).toLocaleString()} {tr('ر.س', 'SAR')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.red }}><span>- {tr('التأمينات', 'GOSI')}:</span><span>{(formData.deductions.gosi || 0).toLocaleString()} {tr('ر.س', 'SAR')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: C.red }}><span>- {tr('خصومات اخرى', 'Other Deductions')}:</span><span>{((formData.deductions.tax || 0) + (formData.deductions.other || 0)).toLocaleString()} {tr('ر.س', 'SAR')}</span></div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16, color: C.text }}>
                  <span>{tr('الصافي (تقريبي)', 'Net (Approx)')}:</span><span>{calculateTotalSalary().toLocaleString()} {tr('ر.س', 'SAR')}</span>
                </div>
              </div>
            </CVisionCardBody>
          </CVisionCard>
        </div>

        <CVisionDialogFooter C={C}>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDialogOpen(false)}>{tr('الغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="primary" onClick={handleSave} disabled={saving}>
            {editingProfile ? tr('تحديث', 'Update') : tr('انشاء', 'Create')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </CVisionPageLayout>
  );
}
