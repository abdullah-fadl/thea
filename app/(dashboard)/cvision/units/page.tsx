'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import {
  CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionDialog, CVisionDialogFooter, CVisionInput, CVisionLabel, CVisionSelect, CVisionTabContent, CVisionTable, CVisionTableBody, CVisionTableHead, CVisionTabs, CVisionTd, CVisionTextarea, CVisionTh, CVisionTr } from '@/components/cvision/ui';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';

import {
  Building2, Plus, Loader2, Pencil, Trash2, Users, User, Search,
  UserPlus, UserMinus, RefreshCw, Calendar, X, ArrowRightLeft,
  ArrowRightFromLine, GraduationCap, Waves,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────

interface Unit {
  id: string;
  name: string;
  nameAr?: string;
  code: string;
  departmentId: string;
  departmentName?: string;
  headNurseId?: string;
  headNurseName?: string;
  nursingManagerId?: string;
  nursingManagerName?: string;
  managerId?: string;
  managerName?: string;
  minStaffDay?: number;
  minStaffNight?: number;
  minStaffEvening?: number;
  employeeCount?: number;
  isActive: boolean;
}

interface Department {
  id: string;
  name: string;
  nameAr?: string;
  code?: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNo?: string;
  employeeNumber?: string;
  unitId?: string;
  departmentId?: string;
  nursingRole?: string;
}

interface Assignment {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeNo?: string;
  originalUnitId: string;
  originalUnitName?: string;
  originalUnitCode?: string;
  assignedUnitId: string | null;
  assignedUnitName?: string;
  assignedUnitCode?: string;
  assignmentType: 'LOAN' | 'TRAINING' | 'FLOAT' | 'PULL_OUT';
  startDate: string;
  endDate: string;
  reason?: string;
  hoursPerWeek?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

interface AvailableEmployee {
  id: string;
  name: string;
  employeeNo: string;
  departmentId?: string;
  unitId?: string;
  unitName?: string;
  unitCode?: string;
  nursingRole?: string;
  category: 'FLOAT_POOL' | 'SAME_DEPARTMENT' | 'CROSS_TRAINED' | 'OTHER_DEPARTMENT';
  activeAssignments: number;
}

// ─── Component ──────────────────────────────────────────────────

export default function UnitsPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  // Data state
  const [units, setUnits] = useState<Unit[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState<string>('all');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formNameAr, setFormNameAr] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formHeadNurseId, setFormHeadNurseId] = useState('');
  const [formNursingManagerId, setFormNursingManagerId] = useState('');
  const [formMinDay, setFormMinDay] = useState('2');
  const [formMinNight, setFormMinNight] = useState('2');
  const [formMinEvening, setFormMinEvening] = useState('1');

  // Employees for dropdown
  const [deptEmployees, setDeptEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);

  // ── Manage Employees Dialog (4-tab) ────────────────────────────
  const [manageOpen, setManageOpen] = useState(false);
  const [manageUnit, setManageUnit] = useState<Unit | null>(null);
  const [manageTab, setManageTab] = useState('staff');
  const [manageLoading, setManageLoading] = useState(false);

  // Tab 1: Unit Staff (primary employees)
  const [unitStaff, setUnitStaff] = useState<Employee[]>([]);
  const [availableStaff, setAvailableStaff] = useState<Employee[]>([]);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState<Set<string>>(new Set());
  const [savingStaff, setSavingStaff] = useState(false);

  // Tab 2: Borrowed Staff (assignments TO this unit)
  const [borrowedStaff, setBorrowedStaff] = useState<Assignment[]>([]);
  const [showBorrowDialog, setShowBorrowDialog] = useState(false);
  const [borrowableEmployees, setBorrowableEmployees] = useState<AvailableEmployee[]>([]);
  const [loadingBorrowable, setLoadingBorrowable] = useState(false);
  const [borrowSelected, setBorrowSelected] = useState<string | null>(null);
  const [borrowType, setBorrowType] = useState<'LOAN' | 'TRAINING'>('LOAN');
  const [borrowStartDate, setBorrowStartDate] = useState('');
  const [borrowEndDate, setBorrowEndDate] = useState('');
  const [borrowReason, setBorrowReason] = useState('');
  const [borrowHours, setBorrowHours] = useState('');
  const [savingBorrow, setSavingBorrow] = useState(false);

  // Tab 3: Pulled Out Staff
  const [pulledOutStaff, setPulledOutStaff] = useState<Assignment[]>([]);
  const [savingPullOut, setSavingPullOut] = useState(false);

  // Pull Out Dialog
  const [isPullOutOpen, setIsPullOutOpen] = useState(false);
  const [pullOutEmployee, setPullOutEmployee] = useState<Employee | null>(null);
  const [pullOutType, setPullOutType] = useState<string>('');
  const [destinationUnitId, setDestinationUnitId] = useState<string>('');
  const [pullOutStartDate, setPullOutStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [pullOutReason, setPullOutReason] = useState('');
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);

  // Tab 4: Float Pool
  const [floatEmployees, setFloatEmployees] = useState<AvailableEmployee[]>([]);
  const [savingFloat, setSavingFloat] = useState(false);

  // ─── Fetch Units via React Query ──────────────────────────────

  const unitFilters: Record<string, any> = { includeStats: 'true' };
  if (filterDept && filterDept !== 'all') unitFilters.departmentId = filterDept;
  if (searchQuery) unitFilters.search = searchQuery;

  const { data: unitsRaw, isLoading: unitsLoading, refetch: refetchUnits } = useQuery({
    queryKey: cvisionKeys.units.list(unitFilters),
    queryFn: () => cvisionFetch('/api/cvision/units', { params: unitFilters }),
  });
  useEffect(() => { if (unitsRaw?.success) setUnits(unitsRaw.data?.items || unitsRaw.data || []); }, [unitsRaw]);

  const { data: deptsRaw } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 200 }),
    queryFn: () => cvisionFetch('/api/cvision/org/departments', { params: { limit: 200 } }),
  });
  useEffect(() => { if (deptsRaw) setDepartments(deptsRaw.items ?? deptsRaw.data ?? []); }, [deptsRaw]);

  // Keep loading in sync
  useEffect(() => { setLoading(unitsLoading); }, [unitsLoading]);

  // Alias for backwards compat with CRUD handlers that call fetchUnits()
  const fetchUnits = useCallback(() => refetchUnits(), [refetchUnits]);

  // ─── Fetch Employees for Department ───────────────────────────

  const fetchDeptEmployees = async (departmentId: string) => {
    if (!departmentId) { setDeptEmployees([]); return; }
    setLoadingEmployees(true);
    try {
      const res = await fetch(
        `/api/cvision/employees?departmentId=${departmentId}&limit=200&status=ACTIVE`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data.success || data.data) { setDeptEmployees(data.data?.items || data.data || []); }
    } catch { setDeptEmployees([]); }
    finally { setLoadingEmployees(false); }
  };

  // ─── Open Create/Edit Dialog ──────────────────────────────────

  const openCreateDialog = () => {
    setEditingUnit(null);
    setFormName(''); setFormNameAr(''); setFormCode('');
    setFormDeptId(''); setFormHeadNurseId(''); setFormNursingManagerId('');
    setFormMinDay('2'); setFormMinNight('2'); setFormMinEvening('1');
    setDeptEmployees([]);
    setDialogOpen(true);
  };

  const openEditDialog = (unit: Unit) => {
    setEditingUnit(unit);
    setFormName(unit.name); setFormNameAr(unit.nameAr || '');
    setFormCode(unit.code); setFormDeptId(unit.departmentId);
    setFormHeadNurseId(unit.headNurseId || '');
    setFormNursingManagerId(unit.nursingManagerId || '');
    setFormMinDay(String(unit.minStaffDay ?? 2));
    setFormMinNight(String(unit.minStaffNight ?? 2));
    setFormMinEvening(String(unit.minStaffEvening ?? 1));
    setDialogOpen(true);
    if (unit.departmentId) fetchDeptEmployees(unit.departmentId);
  };

  // ─── Save Unit ────────────────────────────────────────────────

  const handleSaveUnit = async () => {
    if (!formName.trim() || !formDeptId) {
      toast.error(tr('الاسم والقسم مطلوبان', 'Name and Department are required')); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: formName.trim(),
        nameAr: formNameAr.trim() || undefined,
        code: formCode.trim() || formName.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 10),
        departmentId: formDeptId,
        headNurseId: formHeadNurseId || undefined,
        nursingManagerId: formNursingManagerId || undefined,
        minStaffDay: isNaN(parseInt(formMinDay)) ? 2 : parseInt(formMinDay),
        minStaffNight: isNaN(parseInt(formMinNight)) ? 2 : parseInt(formMinNight),
        minStaffEvening: isNaN(parseInt(formMinEvening)) ? 1 : parseInt(formMinEvening),
      };
      if (editingUnit) { payload.action = 'update'; payload.unitId = editingUnit.id; }

      if (process.env.NODE_ENV === 'development') console.log('[Units] Saving unit:', {
        action: editingUnit ? 'update' : 'create',
        minStaffDay: payload.minStaffDay, minStaffNight: payload.minStaffNight,
        minStaffEvening: payload.minStaffEvening,
      });

      const res = await fetch('/api/cvision/units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(editingUnit
          ? tr('تم تحديث الوحدة بنجاح', 'Unit updated successfully')
          : tr('تم إنشاء الوحدة بنجاح', 'Unit created successfully'));
        setDialogOpen(false); fetchUnits();
      } else { toast.error(data.error || tr('فشل حفظ الوحدة', 'Failed to save unit')); }
    } catch { toast.error(tr('فشل حفظ الوحدة', 'Failed to save unit')); }
    finally { setSaving(false); }
  };

  // ─── Delete Unit ──────────────────────────────────────────────

  const handleDeleteUnit = async () => {
    if (!deletingUnit) return;
    try {
      const res = await fetch('/api/cvision/units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ action: 'delete', unitId: deletingUnit.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم حذف الوحدة بنجاح', 'Unit deleted successfully'));
        setDeleteDialogOpen(false); setDeletingUnit(null); fetchUnits();
      } else { toast.error(data.error || tr('فشل حذف الوحدة', 'Failed to delete unit')); }
    } catch { toast.error(tr('فشل حذف الوحدة', 'Failed to delete unit')); }
  };

  // ─── Manage Employees Dialog ──────────────────────────────────

  const openManageDialog = async (unit: Unit) => {
    setManageUnit(unit);
    setManageTab('staff');
    setManageOpen(true);
    setShowAddStaff(false);
    setSelectedStaffToAdd(new Set());
    setShowBorrowDialog(false);
    setBorrowSelected(null);
    await loadManageData(unit);
  };

  const loadManageData = async (unit: Unit) => {
    setManageLoading(true);
    try {
      const staffRes = await fetch(
        `/api/cvision/employees?unitId=${unit.id}&limit=200&statuses=ACTIVE,PROBATION`,
        { credentials: 'include' }
      );
      const staffData = await staffRes.json();
      const staffList: Employee[] = (staffData.success || staffData.data) ? (staffData.data?.items || staffData.data || []) : [];

      const availRes = await fetch(
        `/api/cvision/employees?departmentId=${unit.departmentId}&limit=200&statuses=ACTIVE,PROBATION`,
        { credentials: 'include' }
      );
      const availData = await availRes.json();
      const allDept: Employee[] = (availData.success || availData.data) ? (availData.data?.items || availData.data || []) : [];
      const unitIds = new Set(staffList.map((e: Employee) => e.id));
      setAvailableStaff(allDept.filter(e => !unitIds.has(e.id) && (!e.unitId || e.unitId === '')));

      const assignRes = await fetch(
        `/api/cvision/assignments?unitId=${unit.id}&status=ACTIVE&includeEmployeeInfo=true`,
        { credentials: 'include' }
      );
      const assignData = await assignRes.json();
      const allAssignments: Assignment[] = assignData.success ? (assignData.data?.items || assignData.data || []) : [];
      setBorrowedStaff(allAssignments.filter(a => a.assignedUnitId === unit.id && a.assignmentType !== 'PULL_OUT'));

      const pullOutAssignments = allAssignments.filter(a => a.assignmentType === 'PULL_OUT' && a.originalUnitId === unit.id);
      setPulledOutStaff(pullOutAssignments);

      const pulledOutIds = new Set(pullOutAssignments.map(a => a.employeeId));
      setUnitStaff(staffList.filter(e => !pulledOutIds.has(e.id)));

      const floatRes = await fetch(
        `/api/cvision/assignments?targetUnitId=${unit.id}`,
        { credentials: 'include' }
      );
      const floatData = await floatRes.json();
      const available: AvailableEmployee[] = floatData.success ? (floatData.data?.items || floatData.data || []) : [];
      setFloatEmployees(available.filter(e => e.category === 'FLOAT_POOL'));
    } catch {
      toast.error(tr('فشل تحميل بيانات الموظفين', 'Failed to load employee data'));
    } finally {
      setManageLoading(false);
    }
  };

  // ── Tab 1: Add/Remove Staff ───────────────────────────────────

  const handleAddStaff = async () => {
    if (!manageUnit || selectedStaffToAdd.size === 0) return;
    setSavingStaff(true);
    try {
      const res = await fetch('/api/cvision/units', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'assign-employees',
          unitId: manageUnit.id,
          employeeIds: [...selectedStaffToAdd],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr(`تم إضافة ${selectedStaffToAdd.size} موظف(ين)`, `${selectedStaffToAdd.size} employee(s) added`));
        setSelectedStaffToAdd(new Set());
        setShowAddStaff(false);
        await loadManageData(manageUnit);
        fetchUnits();
      } else { toast.error(data.error || tr('فشل إضافة الموظفين', 'Failed to add employees')); }
    } catch { toast.error(tr('فشل إضافة الموظفين', 'Failed to add employees')); }
    finally { setSavingStaff(false); }
  };

  const handleRemoveStaff = async (empId: string) => {
    if (!manageUnit) return;
    try {
      await fetch(`/api/cvision/employees/${empId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ unitId: null }),
      });
      toast.success(tr('تم إزالة الموظف من الوحدة', 'Employee removed from unit'));
      await loadManageData(manageUnit);
      fetchUnits();
    } catch { toast.error(tr('فشل إزالة الموظف', 'Failed to remove employee')); }
  };

  // ── Pull Out / Return ────────────────────────────────────────

  const openPullOutDialog = async (employee: Employee) => {
    setPullOutEmployee(employee);
    setPullOutType('');
    setDestinationUnitId('');
    setPullOutStartDate(new Date().toISOString().split('T')[0]);
    setExpectedReturnDate('');
    setPullOutReason('');

    if (manageUnit?.departmentId) {
      try {
        const res = await fetch(`/api/cvision/units?departmentId=${manageUnit.departmentId}`, {
          credentials: 'include',
        });
        const data = await res.json();
        setAvailableUnits((data.data?.items || data.data || []).filter((u: Unit) => u.id !== manageUnit.id));
      } catch { setAvailableUnits([]); }
    }

    setIsPullOutOpen(true);
  };

  const handlePullOutSubmit = async () => {
    if (!pullOutType) {
      toast.error(tr('يرجى اختيار نوع السحب', 'Please select pull out type'));
      return;
    }
    if (pullOutType === 'TRANSFER' && !destinationUnitId) {
      toast.error(tr('يرجى اختيار الوحدة المستهدفة', 'Please select destination unit'));
      return;
    }
    if (!manageUnit || !pullOutEmployee) return;

    setSavingPullOut(true);
    try {
      const res = await fetch('/api/cvision/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'pull-out',
          employeeId: pullOutEmployee.id,
          originalUnitId: manageUnit.id,
          destinationUnitId: pullOutType === 'TRANSFER' ? destinationUnitId : null,
          pullOutType,
          startDate: pullOutStartDate,
          expectedReturnDate: expectedReturnDate || null,
          reason: pullOutReason || `Pull out: ${pullOutType}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr(`تم سحب ${empName(pullOutEmployee)} بنجاح`, `${empName(pullOutEmployee)} pulled out successfully`));
        setIsPullOutOpen(false);
        await loadManageData(manageUnit);
        fetchUnits();
      } else {
        toast.error(data.error || tr('فشل سحب الموظف', 'Failed to pull out employee'));
      }
    } catch { toast.error(tr('فشل سحب الموظف', 'Failed to pull out employee')); }
    finally { setSavingPullOut(false); }
  };

  const handleReturnToUnit = async (assignmentId: string) => {
    if (!manageUnit) return;
    try {
      const res = await fetch('/api/cvision/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'end', assignmentId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم إعادة الموظف للوحدة', 'Employee returned to unit'));
        await loadManageData(manageUnit);
        fetchUnits();
      } else {
        toast.error(data.error || tr('فشل إعادة الموظف', 'Failed to return employee'));
      }
    } catch { toast.error(tr('فشل إعادة الموظف', 'Failed to return employee')); }
  };

  // ── Tab 2: Borrow Staff ───────────────────────────────────────

  const openBorrowDialog = async () => {
    if (!manageUnit) return;
    setShowBorrowDialog(true);
    setBorrowSelected(null);
    setBorrowType('LOAN');
    setBorrowStartDate(new Date().toISOString().split('T')[0]);
    setBorrowEndDate('');
    setBorrowReason('');
    setBorrowHours('');
    setLoadingBorrowable(true);

    try {
      const res = await fetch(
        `/api/cvision/assignments?targetUnitId=${manageUnit.id}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (data.success) {
        setBorrowableEmployees(
          (data.data?.items || data.data || []).filter((e: AvailableEmployee) => e.category !== 'FLOAT_POOL')
        );
      }
    } catch { toast.error(tr('فشل تحميل الموظفين المتاحين', 'Failed to load available employees')); }
    finally { setLoadingBorrowable(false); }
  };

  const handleCreateBorrow = async () => {
    if (!manageUnit || !borrowSelected || !borrowStartDate) return;
    const selectedEmp = borrowableEmployees.find(e => e.id === borrowSelected);
    if (!selectedEmp) return;

    setSavingBorrow(true);
    try {
      const res = await fetch('/api/cvision/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create',
          employeeId: borrowSelected,
          originalUnitId: selectedEmp.unitId || selectedEmp.id,
          assignedUnitId: manageUnit.id,
          assignmentType: borrowType,
          startDate: borrowStartDate,
          endDate: borrowEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          reason: borrowReason || undefined,
          hoursPerWeek: borrowType === 'TRAINING' && borrowHours ? parseInt(borrowHours) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم استعارة الموظف بنجاح', 'Staff borrowed successfully'));
        setShowBorrowDialog(false);
        await loadManageData(manageUnit);
      } else { toast.error(data.error || tr('فشل إنشاء التكليف', 'Failed to create assignment')); }
    } catch { toast.error(tr('فشل إنشاء التكليف', 'Failed to create assignment')); }
    finally { setSavingBorrow(false); }
  };

  const handleEndAssignment = async (assignmentId: string) => {
    if (!manageUnit) return;
    try {
      const res = await fetch('/api/cvision/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'end', assignmentId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم إنهاء التكليف', 'Assignment ended'));
        await loadManageData(manageUnit);
      } else { toast.error(data.error || tr('فشل إنهاء التكليف', 'Failed to end assignment')); }
    } catch { toast.error(tr('فشل إنهاء التكليف', 'Failed to end assignment')); }
  };

  // ── Tab 4: Float Pool ─────────────────────────────────────────

  const handleAssignFloat = async (emp: AvailableEmployee) => {
    if (!manageUnit) return;
    setSavingFloat(true);
    try {
      const res = await fetch('/api/cvision/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'create',
          employeeId: emp.id,
          originalUnitId: emp.unitId || emp.id,
          assignedUnitId: manageUnit.id,
          assignmentType: 'FLOAT',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr(`تم تعيين ${emp.name} من المجمع المتنقل`, `${emp.name} assigned from Float Pool`));
        await loadManageData(manageUnit);
      } else { toast.error(data.error || tr('فشل تعيين الموظف', 'Failed to assign float')); }
    } catch { toast.error(tr('فشل تعيين الموظف', 'Failed to assign float')); }
    finally { setSavingFloat(false); }
  };

  // ─── Helpers ──────────────────────────────────────────────────

  const empName = (e: Employee) =>
    `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.employeeNo || e.employeeNumber || e.id;

  const assignTypeLabel = (type: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      LOAN: { en: 'Loan', ar: 'إعارة' },
      TRAINING: { en: 'Training', ar: 'تدريب' },
      FLOAT: { en: 'Float', ar: 'متنقل' },
      PULL_OUT: { en: 'Pull Out', ar: 'سحب' },
    };
    return labels[type] ? tr(labels[type].ar, labels[type].en) : type;
  };

  const assignTypeVariant = (type: string): 'info' | 'purple' | 'success' | 'warning' | 'muted' => {
    switch (type) {
      case 'LOAN': return 'info';
      case 'TRAINING': return 'purple';
      case 'FLOAT': return 'success';
      case 'PULL_OUT': return 'warning';
      default: return 'muted';
    }
  };

  const assignTypeIcon = (type: string) => {
    switch (type) {
      case 'LOAN': return <ArrowRightLeft style={{ height: 14, width: 14 }} />;
      case 'TRAINING': return <GraduationCap style={{ height: 14, width: 14 }} />;
      case 'FLOAT': return <Waves style={{ height: 14, width: 14 }} />;
      case 'PULL_OUT': return <UserMinus style={{ height: 14, width: 14 }} />;
      default: return null;
    }
  };

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
    catch { return d; }
  };

  const pullOutTypeOptions = [
    { value: 'TRANSFER', label: tr('نقل إلى وحدة أخرى', 'Transfer to another unit') },
    { value: 'TRAINING', label: tr('تدريب/دورة', 'Training/Course') },
    { value: 'EXTENDED_LEAVE', label: tr('إجازة مطولة', 'Extended Leave') },
    { value: 'SUSPENSION', label: tr('إيقاف مؤقت', 'Temporary Suspension') },
    { value: 'OTHER', label: tr('أخرى', 'Other') },
  ];

  const deptFilterOptions = [
    { value: 'all', label: tr('جميع الأقسام', 'All Departments') },
    ...departments.map(d => ({ value: d.id, label: isRTL ? (d.nameAr || d.name) : d.name })),
  ];

  const empSelectOptions = (list: Employee[]) =>
    [{ value: 'none', label: tr('بدون', 'None') }, ...list.map(emp => ({
      value: emp.id,
      label: `${empName(emp)}${emp.employeeNo ? ` (${emp.employeeNo})` : ''}`,
    }))];

  const deptSelectOptions = departments.map(d => ({
    value: d.id,
    label: isRTL ? (d.nameAr || d.name) : d.name,
  }));

  const borrowableOptions = borrowableEmployees.map(emp => ({
    value: emp.id,
    label: `${emp.name}${emp.employeeNo ? ` (${emp.employeeNo})` : ''}${emp.unitName ? ` -- ${emp.unitName}` : ''}`,
  }));

  const borrowTypeOptions = [
    { value: 'LOAN', label: tr('إعارة (نقل مؤقت)', 'Loan (Temporary Transfer)') },
    { value: 'TRAINING', label: tr('تدريب (تدريب متقاطع)', 'Training (Cross-Training)') },
  ];

  const destUnitOptions = availableUnits.map(u => ({
    value: u.id,
    label: `${u.name} (${u.code})`,
  }));

  const manageTabs = [
    { key: 'staff', label: tr('طاقم الوحدة', 'Unit Staff'), count: unitStaff.length },
    { key: 'borrowed', label: tr('مستعارون', 'Borrowed'), count: borrowedStaff.length },
    { key: 'pulled_out', label: tr('مسحوبون', 'Pulled Out'), count: pulledOutStaff.length },
    { key: 'float', label: tr('المجمع المتنقل', 'Float Pool'), count: floatEmployees.length },
  ];

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: C.text }}>
            <Building2 style={{ height: 24, width: 24 }} />
            {tr('إدارة الوحدات', 'Units Management')}
          </h1>
          <p style={{ color: C.textMuted, fontSize: 14, marginTop: 4 }}>{tr('إدارة وحدات التمريض وتعيين الطاقم', 'Manage nursing units and assign staff')}</p>
        </div>
        <CVisionButton C={C} isDark={isDark} onClick={openCreateDialog}>
          <Plus style={{ height: 16, width: 16, marginInlineEnd: 4 }} />
          {tr('وحدة جديدة', 'New Unit')}
        </CVisionButton>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 384 }}>
          <Search style={{ position: 'absolute', height: 16, width: 16, color: C.textMuted, top: '50%', transform: 'translateY(-50%)', ...(isRTL ? { right: 12 } : { left: 12 }) }} />
          <CVisionInput C={C}
            placeholder={tr('بحث الوحدات...', 'Search units...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...(isRTL ? { paddingRight: 36 } : { paddingLeft: 36 }) }}
          />
        </div>
        {departments.length > 0 && (
          <div style={{ minWidth: 220 }}>
            <CVisionSelect C={C} value={filterDept} onChange={setFilterDept} options={deptFilterOptions} />
          </div>
        )}
      </div>

      {/* ── Units Table ────────────────────────────────────── */}
      <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
              <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.textMuted }} />
            </div>
          ) : units.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80, color: C.textMuted }}>
              <Building2 style={{ height: 48, width: 48, marginBottom: 12, opacity: 0.5 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>{tr('لم يتم العثور على وحدات', 'No units found')}</p>
              <p style={{ fontSize: 13 }}>{tr('أنشئ وحدة جديدة للبدء', 'Create a new unit to get started')}</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <CVisionTable C={C}>
                <CVisionTableHead>
                  <CVisionTr>
                    <CVisionTh C={C}>{tr('الاسم', 'Name')}</CVisionTh>
                    <CVisionTh C={C}>{tr('الرمز', 'Code')}</CVisionTh>
                    <CVisionTh C={C}>{tr('القسم', 'Department')}</CVisionTh>
                    <CVisionTh C={C}>{tr('رئيسة التمريض', 'Head Nurse')}</CVisionTh>
                    <CVisionTh C={C}>{tr('مديرة التمريض', 'Nursing Manager')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'center' }}>{tr('الموظفون', 'Employees')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: 'center' }}>{tr('الحد الأدنى (ص/ل/م)', 'Min Staff (D/N/E)')}</CVisionTh>
                    <CVisionTh C={C}>{tr('الحالة', 'Status')}</CVisionTh>
                    <CVisionTh C={C} style={{ textAlign: isRTL ? 'left' : 'right' }}>{tr('الإجراءات', 'Actions')}</CVisionTh>
                  </CVisionTr>
                </CVisionTableHead>
                <CVisionTableBody>
                  {units.map(unit => (
                    <CVisionTr key={unit.id}>
                      <CVisionTd C={C}>
                        <div style={{ fontWeight: 500 }}>{unit.name}</div>
                        {unit.nameAr && (
                          <div style={{ fontSize: 12, color: C.textMuted }}>{unit.nameAr}</div>
                        )}
                      </CVisionTd>
                      <CVisionTd C={C}><CVisionBadge C={C} variant="muted">{unit.code}</CVisionBadge></CVisionTd>
                      <CVisionTd C={C} style={{ fontSize: 13 }}>{unit.departmentName || '--'}</CVisionTd>
                      <CVisionTd C={C} style={{ fontSize: 13 }}>
                        {unit.headNurseName || <span style={{ color: C.textMuted }}>--</span>}
                      </CVisionTd>
                      <CVisionTd C={C} style={{ fontSize: 13 }}>
                        {unit.nursingManagerName || <span style={{ color: C.textMuted }}>--</span>}
                      </CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'center' }}>
                        <CVisionButton C={C} isDark={isDark}
                          variant="ghost" size="sm"
                          style={{ color: C.blue, cursor: 'pointer' }}
                          onClick={() => openManageDialog(unit)}
                        >
                          <Users style={{ height: 16, width: 16, marginInlineEnd: 4 }} />
                          {unit.employeeCount ?? 0}
                        </CVisionButton>
                      </CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                          {unit.minStaffDay ?? 2}/{unit.minStaffNight ?? 2}/{unit.minStaffEvening ?? 1}
                        </span>
                      </CVisionTd>
                      <CVisionTd C={C}>
                        <CVisionBadge C={C} variant={unit.isActive ? 'success' : 'muted'}>
                          {unit.isActive ? tr('نشط', 'Active') : tr('غير نشط', 'Inactive')}
                        </CVisionBadge>
                      </CVisionTd>
                      <CVisionTd C={C} style={{ textAlign: isRTL ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRTL ? 'flex-start' : 'flex-end', gap: 4 }}>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" style={{ height: 32, width: 32 }}
                            onClick={() => openEditDialog(unit)}>
                            <Pencil style={{ height: 16, width: 16 }} />
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon"
                            style={{ height: 32, width: 32, color: C.red }}
                            onClick={() => { setDeletingUnit(unit); setDeleteDialogOpen(true); }}>
                            <Trash2 style={{ height: 16, width: 16 }} />
                          </CVisionButton>
                        </div>
                      </CVisionTd>
                    </CVisionTr>
                  ))}
                </CVisionTableBody>
              </CVisionTable>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>

      {/* ── Create / Edit Dialog ───────────────────────────── */}
      <CVisionDialog open={dialogOpen} onClose={() => setDialogOpen(false)}
        title={editingUnit ? 'Edit Unit' : 'Create New Unit'}
        titleAr={editingUnit ? 'تعديل الوحدة' : 'إنشاء وحدة جديدة'}
        isRTL={isRTL} C={C} isDark={isDark} maxWidth={512}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C} htmlFor="unit-name">{tr('الاسم', 'Name')} <span style={{ color: C.red }}>*</span></CVisionLabel>
            <CVisionInput C={C} id="unit-name" placeholder={tr('مثال: العناية المركزة، الطوارئ', 'e.g. ICU, ER, Ward A')} value={formName}
              onChange={e => setFormName(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C} htmlFor="unit-name-ar">{tr('الاسم (عربي)', 'Name (Arabic)')}</CVisionLabel>
            <CVisionInput C={C} id="unit-name-ar" value={formNameAr}
              onChange={e => setFormNameAr(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C} htmlFor="unit-code">{tr('الرمز', 'Code')}</CVisionLabel>
            <CVisionInput C={C} id="unit-code" placeholder={tr('يُولّد تلقائياً إن ترك فارغاً', 'Auto-generated if empty')} value={formCode}
              onChange={e => setFormCode(e.target.value.toUpperCase())} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('القسم', 'Department')} <span style={{ color: C.red }}>*</span></CVisionLabel>
            <CVisionSelect C={C} value={formDeptId} onChange={val => {
              setFormDeptId(val); setFormHeadNurseId(''); setFormNursingManagerId('');
              fetchDeptEmployees(val);
            }} options={deptSelectOptions} placeholder={tr('اختر القسم', 'Select department')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('رئيسة التمريض', 'Head Nurse')}</CVisionLabel>
            <CVisionSelect C={C} value={formHeadNurseId} onChange={setFormHeadNurseId}
              options={empSelectOptions(deptEmployees)}
              placeholder={loadingEmployees ? tr('جاري التحميل...', 'Loading...') : tr('اختر رئيسة التمريض', 'Select head nurse')} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <CVisionLabel C={C}>{tr('مديرة التمريض', 'Nursing Manager')}</CVisionLabel>
            <CVisionSelect C={C} value={formNursingManagerId} onChange={setFormNursingManagerId}
              options={empSelectOptions(deptEmployees)}
              placeholder={loadingEmployees ? tr('جاري التحميل...', 'Loading...') : tr('اختر مديرة التمريض', 'Select nursing manager')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="min-day">{tr('الحد الأدنى نهاري', 'Min Day')}</CVisionLabel>
              <CVisionInput C={C} id="min-day" type="number" min={0} value={formMinDay}
                onChange={e => setFormMinDay(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="min-night">{tr('الحد الأدنى ليلي', 'Min Night')}</CVisionLabel>
              <CVisionInput C={C} id="min-night" type="number" min={0} value={formMinNight}
                onChange={e => setFormMinNight(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C} htmlFor="min-evening">{tr('الحد الأدنى مسائي', 'Min Evening')}</CVisionLabel>
              <CVisionInput C={C} id="min-evening" type="number" min={0} value={formMinEvening}
                onChange={e => setFormMinEvening(e.target.value)} />
            </div>
          </div>
        </div>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} onClick={handleSaveUnit} disabled={saving || !formName.trim() || !formDeptId}>
            {saving && <Loader2 style={{ height: 16, width: 16, marginInlineEnd: 4, animation: 'spin 1s linear infinite' }} />}
            {editingUnit ? tr('تحديث', 'Update') : tr('إنشاء', 'Create')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Delete Confirmation ────────────────────────────── */}
      <CVisionDialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}
        title="Delete Unit" titleAr="حذف الوحدة" isRTL={isRTL} C={C} isDark={isDark} maxWidth={448}>
        <p style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.6 }}>
          {tr(
            `هل أنت متأكد من حذف الوحدة "${deletingUnit?.name}"؟ سيتم إزالة جميع تعيينات الموظفين.`,
            `Are you sure you want to delete "${deletingUnit?.name}"? This will remove all employee assignments from this unit.`
          )}
        </p>
        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setDeleteDialogOpen(false)}>{tr('إلغاء', 'Cancel')}</CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handleDeleteUnit}>
            {tr('حذف الوحدة', 'Delete Unit')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── Manage Employees Dialog (4 Tabs) ─────────────── */}
      {/* ══════════════════════════════════════════════════════ */}
      <CVisionDialog open={manageOpen} onClose={() => setManageOpen(false)}
        title={`Manage Employees -- ${manageUnit?.name || ''}`}
        titleAr={`إدارة الموظفين -- ${manageUnit?.name || ''}`}
        isRTL={isRTL} C={C} isDark={isDark} maxWidth={768}>

        {manageLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingBottom: 64 }}>
            <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.textMuted }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
              {manageTabs.map(tab => (
                <button key={tab.key}
                  onClick={() => setManageTab(tab.key)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: manageTab === tab.key ? 600 : 400,
                    background: manageTab === tab.key ? C.gold : 'transparent',
                    color: manageTab === tab.key ? '#000' : C.textMuted,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.key === 'staff' && <Users style={{ height: 14, width: 14 }} />}
                  {tab.key === 'borrowed' && <ArrowRightLeft style={{ height: 14, width: 14 }} />}
                  {tab.key === 'pulled_out' && <UserMinus style={{ height: 14, width: 14 }} />}
                  {tab.key === 'float' && <Waves style={{ height: 14, width: 14 }} />}
                  {tab.label}
                  <span style={{
                    background: manageTab === tab.key ? 'rgba(0,0,0,0.15)' : C.bgCard,
                    borderRadius: 10, padding: '1px 7px', fontSize: 11,
                  }}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* ── Tab 1: Unit Staff ──────────────────────── */}
            {manageTab === 'staff' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('الموظفون الأساسيون', 'Primary Employees')}</h3>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={() => setShowAddStaff(!showAddStaff)}>
                    <UserPlus style={{ height: 16, width: 16, marginInlineEnd: 4 }} />
                    {showAddStaff ? tr('إلغاء', 'Cancel') : tr('إضافة طاقم', 'Add Staff')}
                  </CVisionButton>
                </div>

                {/* Add staff panel */}
                {showAddStaff && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: C.greenDim, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: C.green }}>{tr('اختر الموظفين للإضافة:', 'Select employees to add:')}</p>
                    {availableStaff.length === 0 ? (
                      <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 8, paddingBottom: 8 }}>{tr('لا يوجد موظفون غير معيّنين في هذا القسم', 'No unassigned employees in this department')}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                        {availableStaff.map(emp => {
                          const selected = selectedStaffToAdd.has(emp.id);
                          return (
                            <div key={emp.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                                background: selected ? C.green + '22' : 'transparent',
                                border: selected ? `1px solid ${C.green}44` : '1px solid transparent',
                              }}
                              onClick={() => {
                                setSelectedStaffToAdd(prev => {
                                  const next = new Set(prev);
                                  next.has(emp.id) ? next.delete(emp.id) : next.add(emp.id);
                                  return next;
                                });
                              }}
                            >
                              <div style={{
                                width: 16, height: 16, borderRadius: 4,
                                border: `2px solid ${selected ? C.green : C.border}`,
                                background: selected ? C.green : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}>
                                {selected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>&#10003;</span>}
                              </div>
                              <span>{empName(emp)}</span>
                              {(emp.employeeNo || emp.employeeNumber) && (
                                <span style={{ color: C.textMuted, fontSize: 12 }}>({emp.employeeNo || emp.employeeNumber})</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {selectedStaffToAdd.size > 0 && (
                      <CVisionButton C={C} isDark={isDark} size="sm" onClick={handleAddStaff} disabled={savingStaff}>
                        {savingStaff && <Loader2 style={{ height: 16, width: 16, marginInlineEnd: 4, animation: 'spin 1s linear infinite' }} />}
                        {tr(`إضافة ${selectedStaffToAdd.size} موظف(ين)`, `Add ${selectedStaffToAdd.size} Employee(s)`)}
                      </CVisionButton>
                    )}
                  </div>
                )}

                {/* Current staff list */}
                {unitStaff.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 24, paddingBottom: 24, textAlign: 'center' }}>
                    {tr('لا يوجد موظفون في هذه الوحدة', 'No employees assigned to this unit')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {unitStaff.map(emp => (
                      <div key={emp.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${C.border}`, padding: '10px 12px', fontSize: 13 }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Users style={{ height: 16, width: 16, color: C.textMuted }} />
                          <span style={{ fontWeight: 500 }}>{empName(emp)}</span>
                          {(emp.employeeNo || emp.employeeNumber) && (
                            <span style={{ color: C.textMuted, fontSize: 12 }}>({emp.employeeNo || emp.employeeNumber})</span>
                          )}
                          {emp.nursingRole && (
                            <CVisionBadge C={C} variant="muted" style={{ fontSize: 11 }}>{emp.nursingRole}</CVisionBadge>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="sm"
                            style={{ height: 28, padding: '0 8px', color: C.orange, fontSize: 12, gap: 4 }}
                            onClick={() => openPullOutDialog(emp)}
                            disabled={savingPullOut}
                          >
                            <UserMinus style={{ height: 14, width: 14 }} />
                            {tr('سحب', 'Pull Out')}
                          </CVisionButton>
                          <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" style={{ height: 28, width: 28, color: C.red }}
                            onClick={() => handleRemoveStaff(emp.id)}
                          >
                            <X style={{ height: 16, width: 16 }} />
                          </CVisionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 2: Borrowed Staff ──────────────────── */}
            {manageTab === 'borrowed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('مستعارون من وحدات أخرى', 'Borrowed from Other Units')}</h3>
                  <CVisionButton C={C} isDark={isDark} size="sm" variant="outline" onClick={openBorrowDialog}>
                    <ArrowRightLeft style={{ height: 16, width: 16, marginInlineEnd: 4 }} />
                    {tr('استعارة طاقم', 'Borrow Staff')}
                  </CVisionButton>
                </div>

                {borrowedStaff.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 24, paddingBottom: 24, textAlign: 'center' }}>
                    {tr('لا يوجد طاقم مستعار في هذه الوحدة', 'No borrowed staff in this unit')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {borrowedStaff.map(a => (
                      <div key={a.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: `1px solid ${C.border}`, background: C.blueDim, padding: '12px 16px' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RefreshCw style={{ height: 16, width: 16, color: C.blue }} />
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{a.employeeName || a.employeeId}</span>
                            {a.employeeNo && <span style={{ fontSize: 12, color: C.textMuted }}>({a.employeeNo})</span>}
                            <CVisionBadge C={C} variant={assignTypeVariant(a.assignmentType)} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {assignTypeIcon(a.assignmentType)} {assignTypeLabel(a.assignmentType)}
                            </CVisionBadge>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.textMuted }}>
                            <span>{tr('من:', 'From:')} {a.originalUnitName || a.originalUnitCode || tr('غير معروف', 'Unknown')}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar style={{ height: 12, width: 12 }} />
                              {fmtDate(a.startDate)} - {fmtDate(a.endDate)}
                            </span>
                            {a.reason && <span title={a.reason}>{tr('السبب:', 'Reason:')} {a.reason.slice(0, 30)}{a.reason.length > 30 ? '...' : ''}</span>}
                          </div>
                        </div>
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline"
                          style={{ color: C.orange }}
                          onClick={() => handleEndAssignment(a.id)}
                        >
                          {tr('إنهاء', 'End')}
                        </CVisionButton>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Borrow Staff Sub-Dialog ─────────────── */}
                {showBorrowDialog && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, background: C.blueDim, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>{tr('استعارة موظف من وحدة أخرى', 'Borrow Staff from Another Unit')}</h4>
                      <CVisionButton C={C} isDark={isDark} variant="ghost" size="icon" style={{ height: 28, width: 28 }} onClick={() => setShowBorrowDialog(false)}>
                        <X style={{ height: 16, width: 16 }} />
                      </CVisionButton>
                    </div>

                    {loadingBorrowable ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingBottom: 24 }}>
                        <Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite', color: C.textMuted }} />
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <CVisionLabel C={C}>{tr('الموظف', 'Employee')}</CVisionLabel>
                          <CVisionSelect C={C} value={borrowSelected || ''} onChange={v => setBorrowSelected(v)}
                            options={borrowableOptions}
                            placeholder={tr('اختر الموظف للاستعارة', 'Select employee to borrow')} />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <CVisionLabel C={C}>{tr('نوع التكليف', 'Assignment Type')}</CVisionLabel>
                          <CVisionSelect C={C} value={borrowType} onChange={v => setBorrowType(v as 'LOAN' | 'TRAINING')}
                            options={borrowTypeOptions} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <CVisionLabel C={C}>{tr('تاريخ البدء', 'Start Date')}</CVisionLabel>
                            <CVisionInput C={C} type="date" value={borrowStartDate}
                              onChange={e => setBorrowStartDate(e.target.value)} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <CVisionLabel C={C}>{tr('تاريخ الانتهاء', 'End Date')}</CVisionLabel>
                            <CVisionInput C={C} type="date" value={borrowEndDate}
                              onChange={e => setBorrowEndDate(e.target.value)} />
                          </div>
                        </div>

                        {borrowType === 'TRAINING' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <CVisionLabel C={C}>{tr('ساعات في الأسبوع', 'Hours per Week')}</CVisionLabel>
                            <CVisionInput C={C} type="number" min={1} max={168} placeholder={tr('مثال: 20', 'e.g. 20')}
                              value={borrowHours} onChange={e => setBorrowHours(e.target.value)} />
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <CVisionLabel C={C}>{tr('السبب', 'Reason')}</CVisionLabel>
                          <CVisionTextarea C={C} placeholder={tr('سبب استعارة هذا الموظف...', 'Reason for borrowing this employee...')}
                            value={borrowReason} onChange={e => setBorrowReason(e.target.value)}
                            rows={2} />
                        </div>

                        <CVisionButton C={C} isDark={isDark} onClick={handleCreateBorrow}
                          disabled={savingBorrow || !borrowSelected || !borrowStartDate}
                          style={{ width: '100%' }}
                        >
                          {savingBorrow && <Loader2 style={{ height: 16, width: 16, marginInlineEnd: 4, animation: 'spin 1s linear infinite' }} />}
                          {tr('طلب التكليف', 'Request Assignment')}
                        </CVisionButton>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 3: Pulled Out ─────────────────────── */}
            {manageTab === 'pulled_out' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('الموظفون المسحوبون', 'Pulled Out Employees')}</h3>
                  <CVisionBadge C={C} variant="warning" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <UserMinus style={{ height: 12, width: 12 }} />
                    {pulledOutStaff.length} {tr('مسحوب', 'pulled out')}
                  </CVisionBadge>
                </div>

                {pulledOutStaff.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 24, paddingBottom: 24, textAlign: 'center' }}>
                    {tr('لا يوجد موظفون مسحوبون', 'No pulled out employees')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pulledOutStaff.map(a => (
                      <div key={a.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: `1px solid ${C.border}`, background: C.orangeDim, padding: '12px 16px' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <UserMinus style={{ height: 16, width: 16, color: C.orange }} />
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{a.employeeName || a.employeeId}</span>
                            {a.employeeNo && <span style={{ fontSize: 12, color: C.textMuted }}>({a.employeeNo})</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: C.textMuted }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar style={{ height: 12, width: 12 }} />
                              {tr('تم السحب:', 'Pulled out:')} {fmtDate(a.startDate)}
                            </span>
                            {a.reason && <span title={a.reason}>{tr('السبب:', 'Reason:')} {a.reason.length > 30 ? a.reason.slice(0, 30) + '...' : a.reason}</span>}
                          </div>
                        </div>
                        <CVisionButton C={C} isDark={isDark} size="sm" variant="outline"
                          style={{ color: C.green }}
                          onClick={() => handleReturnToUnit(a.id)}
                        >
                          <RefreshCw style={{ height: 14, width: 14, marginInlineEnd: 4 }} />
                          {tr('إعادة للوحدة', 'Return to Unit')}
                        </CVisionButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 4: Float Pool ──────────────────────── */}
            {manageTab === 'float' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{tr('طاقم المجمع المتنقل المتاح', 'Available Float Pool Staff')}</h3>
                  <CVisionBadge C={C} variant="info" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Waves style={{ height: 12, width: 12 }} />
                    {floatEmployees.length} {tr('متاح', 'available')}
                  </CVisionBadge>
                </div>

                {floatEmployees.length === 0 ? (
                  <p style={{ fontSize: 13, color: C.textMuted, paddingTop: 24, paddingBottom: 24, textAlign: 'center' }}>
                    {tr('لا يوجد موظفون في المجمع المتنقل', 'No float pool employees available')}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {floatEmployees.map(emp => (
                      <div key={emp.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: `1px solid ${C.border}`, padding: '12px 16px' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Waves style={{ height: 16, width: 16, color: C.green }} />
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{emp.name}</span>
                            {emp.employeeNo && <span style={{ fontSize: 12, color: C.textMuted }}>({emp.employeeNo})</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>
                            {emp.unitName ? `${tr('الحالي:', 'Current:')} ${emp.unitName}` : tr('غير معيّن', 'Unassigned')}
                            {emp.activeAssignments > 0 && ` · ${emp.activeAssignments} ${tr('تكليف(ات) نشطة', 'active assignment(s)')}`}
                          </div>
                        </div>
                        <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => handleAssignFloat(emp)} disabled={savingFloat}>
                          {savingFloat && <Loader2 style={{ height: 16, width: 16, marginInlineEnd: 4, animation: 'spin 1s linear infinite' }} />}
                          {tr('تعيين', 'Assign')}
                        </CVisionButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CVisionDialog>

      {/* ── Pull Out Dialog ──────────────────────── */}
      <CVisionDialog open={isPullOutOpen} onClose={() => setIsPullOutOpen(false)}
        title="Pull Out Employee" titleAr="سحب الموظف"
        isRTL={isRTL} C={C} isDark={isDark} maxWidth={448}>

        {pullOutEmployee && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Employee info */}
            <div style={{ background: C.bgCard, padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User style={{ height: 16, width: 16, color: C.textMuted }} />
                <span style={{ fontWeight: 500, color: C.text }}>{empName(pullOutEmployee)}</span>
                {(pullOutEmployee.employeeNo || pullOutEmployee.employeeNumber) && (
                  <span style={{ color: C.textMuted }}>({pullOutEmployee.employeeNo || pullOutEmployee.employeeNumber})</span>
                )}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>
                {tr('من:', 'From:')} {manageUnit?.name}
              </div>
            </div>

            {/* Pull Out Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('نوع السحب', 'Pull Out Type')} *</CVisionLabel>
              <CVisionSelect C={C} value={pullOutType} onChange={setPullOutType}
                options={pullOutTypeOptions}
                placeholder={tr('اختر النوع...', 'Select type...')} />
            </div>

            {/* Destination Unit - only for Transfer */}
            {pullOutType === 'TRANSFER' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('الوحدة المستهدفة', 'Destination Unit')} *</CVisionLabel>
                <CVisionSelect C={C} value={destinationUnitId} onChange={setDestinationUnitId}
                  options={destUnitOptions}
                  placeholder={tr('اختر الوحدة...', 'Select unit...')} />
              </div>
            )}

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('تاريخ البدء', 'Start Date')} *</CVisionLabel>
                <CVisionInput C={C}
                  type="date"
                  value={pullOutStartDate}
                  onChange={(e) => setPullOutStartDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CVisionLabel C={C}>{tr('تاريخ العودة المتوقع', 'Expected Return')}</CVisionLabel>
                <CVisionInput C={C}
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                />
              </div>
            </div>

            {/* Reason */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('السبب/ملاحظات', 'Reason/Notes')}</CVisionLabel>
              <CVisionTextarea C={C}
                value={pullOutReason}
                onChange={(e) => setPullOutReason(e.target.value)}
                placeholder={tr('أدخل سبب السحب...', 'Enter reason for pull out...')}
                rows={3}
              />
            </div>
          </div>
        )}

        <CVisionDialogFooter>
          <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => setIsPullOutOpen(false)}>
            {tr('إلغاء', 'Cancel')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="danger" onClick={handlePullOutSubmit} disabled={savingPullOut}>
            {savingPullOut ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginInlineEnd: 4 }} /> : null}
            {tr('تأكيد السحب', 'Confirm Pull Out')}
          </CVisionButton>
        </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
