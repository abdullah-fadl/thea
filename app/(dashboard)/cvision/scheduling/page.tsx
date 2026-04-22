'use client';

import { useCVisionTheme } from '@/lib/cvision/theme';
import { useLang } from '@/hooks/use-lang';
import { CVisionBadge, CVisionButton, CVisionCard, CVisionCardBody, CVisionCardHeader, CVisionInput, CVisionLabel, CVisionTextarea, CVisionSelect, CVisionDialog, CVisionDialogFooter } from '@/components/cvision/ui';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cvisionFetch, cvisionKeys } from '@/lib/cvision/hooks';
import { useMe } from '@/lib/hooks/useMe';

import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  Loader2,
  Users,
  Sun,
  Moon,
  Sunset,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  Bell,
  CheckCircle,
  XCircle,
  Building2,
  UserPlus,
  RefreshCw,
  ArrowLeftRight,
  CalendarRange,
  Zap,
  Heart,
  Repeat2,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { analyzeSchedule, sortSuggestions } from '@/lib/cvision/scheduling/suggestions';
import type { ScheduleSuggestion } from '@/lib/cvision/scheduling/types';
import { Checkbox } from '@/components/ui/checkbox';

// ─── Extracted Components & Shared Types ────────────────────────

import {
  type ShiftType,
  type ViewMode,
  type StaffFilter,
  type AssignmentType,
  type BorrowedEmployee,
  type EmployeeSchedule,
  type UnitOption,
  type ApprovalStatus,
  type PendingApproval,
  type CurrentApprovalRecord,
  type DayEntry,
  type ShiftDef,
  type ScheduleSummary,
  type Department,
  type WorkSettingsData,
  type DeptEmployee,
  type EditingEmployeeWs,
  type BulkWs,
  SHIFT_CONFIG,
  DAY_NAMES,
  LEAVE_TYPES,
  ADMIN_ROLES,
} from './_components/types';

import { WorkSettingsTab } from './_components/WorkSettingsTab';
import { ApprovalBanner } from './_components/ApprovalBanner';

export default function SchedulingPage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => (isRTL ? ar : en);

  const { me } = useMe();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<EmployeeSchedule[]>([]);
  const [shifts, setShifts] = useState<ShiftDef[]>([]);
  const [summary, setSummary] = useState<ScheduleSummary | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [days, setDays] = useState<Date[]>([]);
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [showAlerts, setShowAlerts] = useState(true);

  // Unit filter
  const [availableUnits, setAvailableUnits] = useState<UnitOption[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  // Borrowed employees & staff filter
  const [borrowedEmployees, setBorrowedEmployees] = useState<BorrowedEmployee[]>([]);
  const [staffFilter, setStaffFilter] = useState<StaffFilter>('all');
  const [addStaffOpen, setAddStaffOpen] = useState(false);

  // Approval flow
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>('DRAFT');
  const [approvalReason, setApprovalReason] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingApprovalId, setRejectingApprovalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [currentApproval, setCurrentApproval] = useState<CurrentApprovalRecord | null>(null);

  // Role-based: admin/HR can always manage approvals; other roles rely on API filtering
  const isAdminUser = ADMIN_ROLES.includes(me?.user?.role?.toLowerCase() || '');
  const canManageApprovals = isAdminUser || pendingApprovals.length > 0;
  const isScheduleLocked = approvalStatus === 'APPROVED' || approvalStatus === 'PUBLISHED';

  // Filter departments in Settings tab based on user role
  // Non-admin users can only see their own department
  const userDepartmentId = me?.user?.department || null;
  const settingsDepartments = useMemo(() => {
    if (isAdminUser) return departments;
    if (!userDepartmentId) return departments;
    return departments.filter(d => d.id === userDepartmentId || d.name === userDepartmentId);
  }, [departments, isAdminUser, userDepartmentId]);

  // Auto-generate modal
  const [autoGenOpen, setAutoGenOpen] = useState(false);
  const [autoGenLoading, setAutoGenLoading] = useState(false);
  const [autoGenPreview, setAutoGenPreview] = useState<any[] | null>(null);
  const [autoGenDayReq, setAutoGenDayReq] = useState(5);
  const [autoGenEveReq, setAutoGenEveReq] = useState(0);
  const [autoGenNightReq, setAutoGenNightReq] = useState(0);
  const [autoGenDays, setAutoGenDays] = useState([true, true, true, true, true, false, false]); // Sat-Fri
  const [autoGenRespectPrefs, setAutoGenRespectPrefs] = useState(true);
  const [autoGenMinRest, setAutoGenMinRest] = useState(true);
  const [autoGenMaxConsec, setAutoGenMaxConsec] = useState(true);

  // Preferences
  const [prefsEmployeeId, setPrefsEmployeeId] = useState('');
  const [prefsData, setPrefsData] = useState<{
    preferredShifts: string[];
    unavailableDays: number[];
    maxOvertimeHours: number;
    nightShiftOk: boolean;
    medicalRestrictions: string;
    notes: string;
  }>({ preferredShifts: ['DAY'], unavailableDays: [5], maxOvertimeHours: 4, nightShiftOk: false, medicalRestrictions: '', notes: '' });
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [allPrefs, setAllPrefs] = useState<any[]>([]);
  const [mainTab, setMainTab] = useState<'schedule' | 'preferences' | 'settings'>('schedule');

  // Work schedule settings (configurable rest/work days & hours)
  const [workSettings, setWorkSettings] = useState<WorkSettingsData>({
    workDays: [0, 1, 2, 3, 4],   // Sun-Thu
    restDays: [5, 6],             // Fri, Sat
    defaultStartTime: '08:00',
    defaultEndTime: '17:00',
    defaultWorkingHours: 8,
    breakDurationMinutes: 60,
    graceMinutes: 15,
    splitShiftEnabled: false,
    splitShiftSegments: [],
  });
  const [tenantDefaultWs, setTenantDefaultWs] = useState<WorkSettingsData | null>(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [wsSaving, setWsSaving] = useState(false);
  const [settingsDeptScope, setSettingsDeptScope] = useState<string | null>(null); // null = tenant default
  const [settingsUnitScope, setSettingsUnitScope] = useState<string | null>(null); // null = all units in dept
  const [settingsUnits, setSettingsUnits] = useState<UnitOption[]>([]); // units for selected dept
  const [deptOverrides, setDeptOverrides] = useState<any[]>([]);

  // Employee-level work schedule settings
  const [deptEmployees, setDeptEmployees] = useState<DeptEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [editingEmployeeWs, setEditingEmployeeWs] = useState<EditingEmployeeWs | null>(null);
  const [employeeSaving, setEmployeeSaving] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkWs, setBulkWs] = useState<BulkWs>({
    workDays: [0, 1, 2, 3, 4], restDays: [5, 6],
    startTime: '08:00', endTime: '17:00', workingHours: 8,
    breakDurationMinutes: 60, graceMinutes: 15,
    splitShiftEnabled: false, splitShiftSegments: [],
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  // Swap
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapSource, setSwapSource] = useState<{ employeeId: string; employeeName: string; date: Date; dayEntry: DayEntry } | null>(null);
  const [swapTargetId, setSwapTargetId] = useState('');
  const [swapSaving, setSwapSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    employeeId: string;
    employeeName: string;
    date: Date;
    current: DayEntry | null;
    isBorrowed?: boolean;
    assignmentType?: AssignmentType;
    originalUnitName?: string;
  } | null>(null);
  const [editShiftType, setEditShiftType] = useState<ShiftType>('DAY');
  const [editOvertimeHours, setEditOvertimeHours] = useState('');
  const [editOvertimeReason, setEditOvertimeReason] = useState('');
  const [editLeaveType, setEditLeaveType] = useState('ANNUAL');
  const [editAutoLeave, setEditAutoLeave] = useState(true);
  const [editLeaveReason, setEditLeaveReason] = useState('');
  const [editLeaveEndDate, setEditLeaveEndDate] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // ─── Date Helpers ───────────────────────────────────────────

  const getWeekStart = useCallback((date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    // Saturday = 6, so we calculate offset to get to Saturday
    const diff = day === 6 ? 0 : -(day + 1);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const getWeekEnd = useCallback((start: Date): Date => {
    const d = new Date(start);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const getMonthStart = useCallback((date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }, []);

  const getMonthEnd = useCallback((date: Date): Date => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }, []);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatDayHeader = (date: Date): string => {
    const dayIdx = date.getDay();
    const dayName = dayIdx === 0 ? 'Sun' : dayIdx === 1 ? 'Mon' : dayIdx === 2 ? 'Tue' :
                    dayIdx === 3 ? 'Wed' : dayIdx === 4 ? 'Thu' : dayIdx === 5 ? 'Fri' : 'Sat';
    return `${dayName} ${date.getDate()}/${date.getMonth() + 1}`;
  };

  const getPeriodLabel = (): string => {
    if (viewMode === 'weekly') {
      const start = getWeekStart(currentDate);
      const end = getWeekEnd(start);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}, ${end.getFullYear()}`;
    }
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  // ─── Data Fetching ──────────────────────────────────────────

  const scheduleControllerRef = useRef<AbortController | null>(null);

  const fetchSchedule = useCallback(async () => {
    scheduleControllerRef.current?.abort();
    const controller = new AbortController();
    scheduleControllerRef.current = controller;
    setLoading(true);
    try {
      let start: Date, end: Date;
      if (viewMode === 'weekly') {
        start = getWeekStart(currentDate);
        end = getWeekEnd(start);
      } else {
        start = getMonthStart(currentDate);
        end = getMonthEnd(currentDate);
      }

      const params = new URLSearchParams({
        action: viewMode,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      });
      if (selectedDept && selectedDept !== 'all') {
        params.set('departmentId', selectedDept);
      }
      if (selectedUnit && selectedUnit !== 'all') {
        params.set('unitId', selectedUnit);
      }

      const res = await fetch(`/api/cvision/schedules?${params}`, { credentials: 'include', signal: controller.signal });
      const data = await res.json();

      if (data.success && data.data) {
        setSchedule(data.data.schedule || []);
        setShifts(data.data.shifts || []);
        setSummary(data.data.summary || null);

        // Build days array from the response dates
        const startD = new Date(data.data.startDate);
        const endD = new Date(data.data.endDate);
        const d: Date[] = [];
        const cur = new Date(startD);
        while (cur <= endD) {
          d.push(new Date(cur));
          cur.setDate(cur.getDate() + 1);
        }
        setDays(d);
      }

      // Extract available units for filter
      if (data?.data?.availableUnits) {
        setAvailableUnits(data.data.availableUnits);
      }

      // ── Fetch active assignments (borrowed employees) ──
      if (selectedUnit && selectedUnit !== 'all') {
        try {
          const assignParams = new URLSearchParams({
            assignedUnitId: selectedUnit,
            status: 'ACTIVE',
            includeEmployeeInfo: 'true',
          });
          const assignRes = await fetch(`/api/cvision/assignments?${assignParams}`, { credentials: 'include', signal: controller.signal });
          const assignData = await assignRes.json();

          // Filter out PULL_OUT assignments — already handled server-side in schedule response
          const filteredAssignData = (assignData.data?.items || assignData.data || []).filter((a: any) => a.assignmentType !== 'PULL_OUT');

          if (assignData.success && filteredAssignData.length > 0) {
            const borrowed: BorrowedEmployee[] = filteredAssignData.map((a: any) => ({
              assignmentId: a.id || a._id,
              employeeId: a.employeeId,
              employeeName: a.employeeName || a.employee?.name || 'Unknown',
              employeeNo: a.employeeNo || a.employee?.employeeNo || '',
              originalUnitId: a.originalUnitId,
              originalUnitName: a.originalUnitName || a.originalUnit?.name || 'Unknown',
              assignmentType: a.assignmentType,
              startDate: a.startDate,
              endDate: a.endDate,
              hoursPerWeek: a.hoursPerWeek,
              reason: a.reason,
            }));
            setBorrowedEmployees(borrowed);

            // Merge borrowed employees into schedule if they aren't already included
            const scheduleData: EmployeeSchedule[] = data.data.schedule || [];
            const existingIds = new Set(scheduleData.map((s: EmployeeSchedule) => s.employee.id));

            for (const b of borrowed) {
              if (!existingIds.has(b.employeeId)) {
                // Create default schedule entries for borrowed employee
                const startD = new Date(data.data.startDate);
                const endD = new Date(data.data.endDate);
                const borrowedDays: DayEntry[] = [];
                const cur = new Date(startD);
                while (cur <= endD) {
                  const dayOfWeek = cur.getDay();
                  const isRestDay = workSettings.restDays.includes(dayOfWeek);
                  borrowedDays.push({
                    date: cur.toISOString().split('T')[0],
                    shiftType: isRestDay ? 'OFF' : 'DAY',
                    isDefault: true,
                  });
                  cur.setDate(cur.getDate() + 1);
                }
                scheduleData.push({
                  employee: {
                    id: b.employeeId,
                    name: b.employeeName,
                    employeeNo: b.employeeNo,
                    isBorrowed: true,
                    assignmentType: b.assignmentType,
                    originalUnitName: b.originalUnitName,
                    assignmentId: b.assignmentId,
                  },
                  days: borrowedDays,
                });
              } else {
                // Mark existing employee as borrowed
                const existing = scheduleData.find((s: EmployeeSchedule) => s.employee.id === b.employeeId);
                if (existing) {
                  existing.employee.isBorrowed = true;
                  existing.employee.assignmentType = b.assignmentType;
                  existing.employee.originalUnitName = b.originalUnitName;
                  existing.employee.assignmentId = b.assignmentId;
                }
              }
            }

            // Sort: regular first, then borrowed
            scheduleData.sort((a, b) => {
              if (a.employee.isBorrowed && !b.employee.isBorrowed) return 1;
              if (!a.employee.isBorrowed && b.employee.isBorrowed) return -1;
              return (a.employee.name || '').localeCompare(b.employee.name || '');
            });

            setSchedule(scheduleData);
          } else {
            setBorrowedEmployees([]);
          }
        } catch (err) {
          console.error('[Scheduling] Failed to fetch assignments:', err);
          setBorrowedEmployees([]);
        }
      } else {
        setBorrowedEmployees([]);
      }

      // Run smart analysis
      const analyzed = analyzeSchedule(data?.data?.schedule || []);
      setSuggestions(sortSuggestions(analyzed));
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      toast.error(tr('فشل في تحميل الجدول', 'Failed to load schedule'));
      console.error('Failed to load schedule:', error);
    } finally {
      setLoading(false);
    }
  }, [viewMode, currentDate, selectedDept, selectedUnit, getWeekStart, getWeekEnd, getMonthStart, getMonthEnd]);

  // Fetch departments via React Query
  const { data: deptQueryRaw } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 200 }),
    queryFn: () => cvisionFetch('/api/cvision/org/departments', { params: { limit: 200 } }),
  });
  useEffect(() => { if (deptQueryRaw) setDepartments(deptQueryRaw.items ?? deptQueryRaw.data ?? []); }, [deptQueryRaw]);

  useEffect(() => {
    fetchSchedule();
    return () => { scheduleControllerRef.current?.abort(); };
  }, [fetchSchedule]);

  // ── Fetch work schedule settings ────────────────────────────
  const fetchWorkSettings = useCallback(async () => {
    try {
      setWsLoading(true);
      const res = await fetch('/api/cvision/scheduling?action=work-settings', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data?.workSchedule) {
        const ws = data.data.workSchedule;
        setWorkSettings({ ...ws, splitShiftEnabled: ws.splitShiftEnabled || false, splitShiftSegments: ws.splitShiftSegments || [] });
        setTenantDefaultWs({ ...ws, splitShiftEnabled: ws.splitShiftEnabled || false, splitShiftSegments: ws.splitShiftSegments || [] });
        if (data.data?.departmentOverrides) {
          setDeptOverrides(data.data.departmentOverrides);
        }
        // Update auto-gen defaults based on configured work days
        const dayMap = [6, 0, 1, 2, 3, 4, 5];
        setAutoGenDays(dayMap.map(d => ws.workDays.includes(d)));
      }
    } catch {
      // use defaults
    } finally {
      setWsLoading(false);
    }
  }, []);

  // ── Load department-specific work schedule ──
  // Fetch employees for a department/unit with their work schedule overrides
  const fetchDeptEmployees = useCallback(async (departmentId: string, unitId?: string | null) => {
    try {
      setEmployeesLoading(true);
      let url = `/api/cvision/scheduling?action=department-employees-work-schedules&departmentId=${departmentId}`;
      if (unitId) url += `&unitId=${unitId}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setDeptEmployees(data.data?.employees || []);
      }
    } catch {
      toast.error(tr('فشل في تحميل الموظفين', 'Failed to load employees'));
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  // Save individual employee work schedule override
  const saveEmployeeWorkSettings = useCallback(async (employeeId: string, settings: any) => {
    setEmployeeSaving(true);
    try {
      const res = await fetch('/api/cvision/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'update-employee-work-settings', employeeId, ...settings }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم حفظ جدول الموظف', 'Employee schedule saved'));
        setDeptEmployees(prev => prev.map(emp =>
          emp.id === employeeId ? { ...emp, hasCustomSchedule: true, workSchedule: settings } : emp
        ));
        setExpandedEmployeeId(null);
        setEditingEmployeeWs(null);
      } else {
        toast.error(data.error || tr('فشل في الحفظ', 'Failed to save'));
      }
    } catch {
      toast.error(tr('فشل في حفظ جدول الموظف', 'Failed to save employee schedule'));
    } finally {
      setEmployeeSaving(false);
    }
  }, []);

  // Reset employee to department default
  const resetEmployeeWorkSettings = useCallback(async (employeeId: string) => {
    try {
      const res = await fetch('/api/cvision/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'delete-employee-work-settings', employeeId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تمت إعادة التعيين للافتراضي', 'Reset to default'));
        setDeptEmployees(prev => prev.map(emp =>
          emp.id === employeeId ? { ...emp, hasCustomSchedule: false, workSchedule: null } : emp
        ));
        setExpandedEmployeeId(null);
        setEditingEmployeeWs(null);
      }
    } catch {
      toast.error(tr('فشل في إعادة التعيين', 'Failed to reset'));
    }
  }, []);

  // Bulk update employee work schedules
  const saveBulkEmployeeSettings = useCallback(async (employeeIds: string[], settings: any) => {
    setBulkSaving(true);
    try {
      const res = await fetch('/api/cvision/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'bulk-update-employee-work-settings', employeeIds, ...settings }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr(`تم تحديث ${employeeIds.length} موظف`, `Updated ${employeeIds.length} employees`));
        setDeptEmployees(prev => prev.map(emp =>
          employeeIds.includes(emp.id) ? { ...emp, hasCustomSchedule: true, workSchedule: settings } : emp
        ));
        setSelectedEmployeeIds(new Set());
        setBulkEditOpen(false);
      } else {
        toast.error(data.error || tr('فشل في الحفظ', 'Failed to save'));
      }
    } catch {
      toast.error(tr('فشل في التحديث الجماعي', 'Failed to bulk update'));
    } finally {
      setBulkSaving(false);
    }
  }, []);

  const loadDeptWorkSchedule = useCallback(async (departmentId: string | null) => {
    setSettingsDeptScope(departmentId);
    setSettingsUnitScope(null);
    setSettingsUnits([]);
    // Reset employee-level state
    setDeptEmployees([]);
    setExpandedEmployeeId(null);
    setEditingEmployeeWs(null);
    setSelectedEmployeeIds(new Set());
    setEmployeeSearchTerm('');

    if (!departmentId) {
      // Reset to tenant default
      if (tenantDefaultWs) {
        setWorkSettings(tenantDefaultWs);
      }
      return;
    }
    try {
      setWsLoading(true);
      const res = await fetch(`/api/cvision/scheduling?action=department-work-schedule&departmentId=${departmentId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const deptWs = data.data?.departmentSchedule;
        const tenantWs = data.data?.tenantDefault || tenantDefaultWs;
        if (deptWs) {
          setWorkSettings({
            workDays: deptWs.workDays ?? tenantWs?.workDays ?? [0, 1, 2, 3, 4],
            restDays: deptWs.restDays ?? tenantWs?.restDays ?? [5, 6],
            defaultStartTime: deptWs.defaultStartTime ?? tenantWs?.defaultStartTime ?? '08:00',
            defaultEndTime: deptWs.defaultEndTime ?? tenantWs?.defaultEndTime ?? '17:00',
            defaultWorkingHours: deptWs.defaultWorkingHours ?? tenantWs?.defaultWorkingHours ?? 8,
            breakDurationMinutes: deptWs.breakDurationMinutes ?? tenantWs?.breakDurationMinutes ?? 60,
            graceMinutes: deptWs.graceMinutes ?? tenantWs?.graceMinutes ?? 15,
            splitShiftEnabled: deptWs.splitShiftEnabled ?? tenantWs?.splitShiftEnabled ?? false,
            splitShiftSegments: deptWs.splitShiftSegments ?? tenantWs?.splitShiftSegments ?? [],
          });
        } else {
          if (tenantWs) {
            setWorkSettings({ ...tenantWs, splitShiftEnabled: tenantWs.splitShiftEnabled || false, splitShiftSegments: tenantWs.splitShiftSegments || [] });
          }
        }
      }

      // Fetch employees + units for this department (units come from same API)
      try {
        setEmployeesLoading(true);
        const empRes = await fetch(`/api/cvision/scheduling?action=department-employees-work-schedules&departmentId=${departmentId}`, { credentials: 'include' });
        const empData = await empRes.json();
        if (empData.success) {
          setDeptEmployees(empData.data?.employees || []);
          setSettingsUnits(empData.data?.units || availableUnits.filter(u => u.departmentId === departmentId));
        }
      } catch {
        setSettingsUnits(availableUnits.filter(u => u.departmentId === departmentId));
      } finally {
        setEmployeesLoading(false);
      }
    } catch {
      // Keep current
    } finally {
      setWsLoading(false);
    }
  }, [tenantDefaultWs, fetchDeptEmployees, availableUnits]);

  useEffect(() => {
    fetchWorkSettings();
  }, [fetchWorkSettings]);

  // ─── Approval Flow ────────────────────────────────────────────

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch('/api/cvision/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'get-approvals', status: 'PENDING_APPROVAL' }),
      });
      if (!res.ok) return; // Non-critical — silently skip on auth/permission errors
      const data = await res.json();
      if (data.success) {
        setPendingApprovals(data.data?.items || data.data || []);
      }
    } catch {
      // optional — pending approvals fetch is non-critical
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // Fetch approval status for the currently selected unit + week
  const fetchApprovalStatus = useCallback(async () => {
    if (!selectedUnit || selectedUnit === 'all' || days.length === 0) {
      setCurrentApproval(null);
      setApprovalStatus('DRAFT');
      setApprovalReason('');
      return;
    }

    try {
      const res = await fetch('/api/cvision/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'get-approvals',
          unitId: selectedUnit,
        }),
      });
      if (!res.ok) {
        setCurrentApproval(null);
        setApprovalStatus('DRAFT');
        setApprovalReason('');
        return;
      }
      const data = await res.json();

      if (data.success && data.data?.length > 0) {
        const weekStart = days[0];
        const weekEnd = days[days.length - 1];

        // Find the approval that matches the current week's date range
        const matching = data.data.find((a: CurrentApprovalRecord) => {
          if (!a.startDate || !a.endDate) return false;
          const aStart = new Date(a.startDate);
          const aEnd = new Date(a.endDate);
          // Check overlap: approval range overlaps with current view range
          return aStart.toDateString() === weekStart.toDateString()
            || (aStart <= weekEnd && aEnd >= weekStart);
        });

        if (matching) {
          setCurrentApproval(matching);
          setApprovalStatus(matching.status);
          setApprovalReason(matching.rejectionReason || '');
        } else {
          setCurrentApproval(null);
          setApprovalStatus('DRAFT');
          setApprovalReason('');
        }
      } else {
        setCurrentApproval(null);
        setApprovalStatus('DRAFT');
        setApprovalReason('');
      }
    } catch {
      setCurrentApproval(null);
      setApprovalStatus('DRAFT');
    }
  }, [selectedUnit, days]);

  useEffect(() => {
    fetchApprovalStatus();
  }, [fetchApprovalStatus]);

  const handleSubmitForApproval = async () => {
    try {
      const res = await fetch('/api/cvision/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'submit-for-approval',
          unitId: selectedUnit !== 'all' ? selectedUnit : undefined,
          startDate: days[0]?.toISOString(),
          endDate: days[days.length - 1]?.toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم إرسال الجدول للاعتماد', 'Schedule submitted for approval'));
        setApprovalStatus('PENDING_APPROVAL');
        fetchApprovals();
        fetchApprovalStatus();
      } else {
        toast.error(data.error || tr('فشل في الإرسال', 'Failed to submit'));
      }
    } catch {
      toast.error(tr('فشل في إرسال الجدول للاعتماد', 'Failed to submit for approval'));
    }
  };

  const handleApprove = async (approvalId: string) => {
    try {
      const res = await fetch('/api/cvision/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'approve-schedule', approvalId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم اعتماد الجدول بنجاح', 'Schedule approved successfully'));
        fetchApprovals();
        fetchApprovalStatus();
        fetchSchedule();
      } else {
        toast.error(data.error || tr('فشل في الاعتماد', 'Failed to approve'));
      }
    } catch {
      toast.error(tr('فشل في اعتماد الجدول', 'Failed to approve schedule'));
    }
  };

  const handleReject = async () => {
    if (!rejectingApprovalId) return;
    try {
      const res = await fetch('/api/cvision/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject-schedule',
          approvalId: rejectingApprovalId,
          rejectionReason: rejectReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم رفض الجدول', 'Schedule rejected'));
        setRejectDialogOpen(false);
        setRejectReason('');
        setRejectingApprovalId(null);
        fetchApprovals();
        fetchApprovalStatus();
        fetchSchedule();
      } else {
        toast.error(data.error || tr('فشل في الرفض', 'Failed to reject'));
      }
    } catch {
      toast.error(tr('فشل في رفض الجدول', 'Failed to reject schedule'));
    }
  };

  // ─── Navigation ─────────────────────────────────────────────

  const navigatePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'weekly') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setMonth(d.getMonth() - 1);
    }
    setCurrentDate(d);
  };

  const navigateNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'weekly') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setMonth(d.getMonth() + 1);
    }
    setCurrentDate(d);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // ─── Cell Click ─────────────────────────────────────────────

  const handleCellClick = (emp: EmployeeSchedule, dayEntry: DayEntry, dayDate: Date) => {
    // Lock editing for approved/published schedules
    if (isScheduleLocked) {
      toast.info(tr('هذا الجدول معتمد ولا يمكن تعديله.', 'This schedule is approved and cannot be edited.'));
      return;
    }

    setSelectedCell({
      employeeId: emp.employee.id,
      employeeName: emp.employee.name,
      date: dayDate,
      current: dayEntry,
      isBorrowed: emp.employee.isBorrowed,
      assignmentType: emp.employee.assignmentType,
      originalUnitName: emp.employee.originalUnitName,
    });
    setEditShiftType(dayEntry.shiftType || 'DAY');
    setEditOvertimeHours(dayEntry.overtimeHours?.toString() || '');
    setEditOvertimeReason('');
    setEditLeaveType(dayEntry.leaveType || 'ANNUAL');
    setEditAutoLeave(true);
    setEditLeaveReason('');
    setEditLeaveEndDate(dayDate.toISOString().split('T')[0]);
    setEditNotes(dayEntry.notes || '');
    setDialogOpen(true);
  };

  // ─── Save Entry ─────────────────────────────────────────────

  const handleSaveEntry = async () => {
    if (!selectedCell) return;
    setSaving(true);

    try {
      // ─── LEAVE: POST to /api/cvision/leaves + update all days in range ─
      if (editShiftType === 'LEAVE') {
        const startDate = formatDate(selectedCell.date);
        const endDate = editLeaveEndDate || startDate;

        // 1. Create leave request via leaves API
        if (process.env.NODE_ENV === 'development') console.log('[Scheduling] Saving leave:', { employeeId: selectedCell.employeeId, startDate, endDate, leaveType: editLeaveType, reason: editLeaveReason });
        const leaveRes = await fetch('/api/cvision/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            employeeId: selectedCell.employeeId,
            type: editLeaveType,
            startDate,
            endDate,
            reason: editLeaveReason || undefined,
            fromSchedule: true,
            status: 'PENDING_EMPLOYEE',
          }),
        });
        const leaveData = await leaveRes.json();

        if (!leaveData.success) {
          toast.error(leaveData.error || 'Failed to create leave request');
          setSaving(false);
          return;
        }

        // 2. Update all working days in range to LEAVE in the schedule grid
        const cur = new Date(startDate);
        const endD = new Date(endDate);
        const updatePromises: Promise<any>[] = [];

        while (cur <= endD) {
          const dayOfWeek = cur.getDay();
          // Skip weekends (Friday=5, Saturday=6)
          if (dayOfWeek !== 5 && dayOfWeek !== 6) {
            updatePromises.push(
              fetch('/api/cvision/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  action: 'update-entry',
                  employeeId: selectedCell.employeeId,
                  date: cur.toISOString(),
                  shiftType: 'LEAVE',
                  leaveType: editLeaveType,
                  leaveRequestId: leaveData.data?.id,
                  notes: editNotes || undefined,
                }),
              })
            );
          }
          cur.setDate(cur.getDate() + 1);
        }

        await Promise.all(updatePromises);

        toast.success(
          `Leave request created for ${selectedCell.employeeName} (${leaveWorkingDays} day${leaveWorkingDays !== 1 ? 's' : ''}) – Pending employee confirmation`,
          { duration: 5000 }
        );

        setDialogOpen(false);
        fetchSchedule();
        setSaving(false);
        return;
      }

      // ─── Non-LEAVE shifts ──────────────────────────────────────
      const res = await fetch('/api/cvision/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update-entry',
          employeeId: selectedCell.employeeId,
          date: selectedCell.date.toISOString(),
          shiftType: editShiftType,
          notes: editNotes || undefined,
          overtimeHours: editShiftType === 'OVERTIME' ? parseFloat(editOvertimeHours) || 0 : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // If overtime, also create the overtime request
        if (editShiftType === 'OVERTIME' && editOvertimeHours) {
          const otRes = await fetch('/api/cvision/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              action: 'create-overtime',
              employeeId: selectedCell.employeeId,
              date: selectedCell.date.toISOString(),
              hours: parseFloat(editOvertimeHours),
              reason: editOvertimeReason,
            }),
          });
          const otData = await otRes.json();
          const amt = otData.data?.amount;
          toast.success(`Overtime request created${amt ? ` – ${amt.toLocaleString()} SAR` : ''}`);
        } else {
          toast.success(tr('تم تحديث الوردية بنجاح', 'Shift updated successfully'));
        }

        setDialogOpen(false);
        fetchSchedule();
      } else {
        toast.error(data.error || tr('فشل في تحديث الجدول', 'Failed to update schedule'));
      }
    } catch (error) {
      toast.error(tr('فشل في تحديث الجدول', 'Failed to update schedule'));
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  // ─── Auto-Generate Handler ──────────────────────────────────

  const handleAutoGenerate = async () => {
    setAutoGenLoading(true);
    try {
      const start = getWeekStart(currentDate);
      const dayNames = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      const shiftRequirements = [];

      for (let i = 0; i < 7; i++) {
        if (!autoGenDays[i]) continue;
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const dateStr = formatDate(d);

        if (autoGenDayReq > 0) shiftRequirements.push({ date: dateStr, shiftType: 'DAY', minStaff: autoGenDayReq });
        if (autoGenEveReq > 0) shiftRequirements.push({ date: dateStr, shiftType: 'EVENING', minStaff: autoGenEveReq });
        if (autoGenNightReq > 0) shiftRequirements.push({ date: dateStr, shiftType: 'NIGHT', minStaff: autoGenNightReq });
      }

      const res = await fetch('/api/cvision/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'auto-generate',
          department: selectedDept !== 'all' ? selectedDept : '',
          weekStart: formatDate(start),
          shiftRequirements,
          respectPreferences: autoGenRespectPrefs,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Schedule generated: ${data.data?.assignedCount || 0} shifts assigned`);
        setAutoGenOpen(false);
        fetchSchedule();
      } else {
        toast.error(data.error || tr('فشل في إنشاء الجدول', 'Failed to generate schedule'));
      }
    } catch {
      toast.error(tr('فشل في إنشاء الجدول', 'Failed to generate schedule'));
    } finally {
      setAutoGenLoading(false);
    }
  };

  // ─── Preferences Handlers ─────────────────────────────────

  const loadPreference = useCallback(async (empId: string) => {
    if (!empId) return;
    setPrefsLoading(true);
    try {
      const res = await fetch(`/api/cvision/scheduling?action=preferences&employeeId=${empId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.data?.preference) {
        const p = data.data.preference;
        setPrefsData({
          preferredShifts: p.preferredShifts || ['DAY'],
          unavailableDays: p.unavailableDays || [5],
          maxOvertimeHours: p.maxOvertimeHours ?? 4,
          nightShiftOk: p.nightShiftOk ?? false,
          medicalRestrictions: p.medicalRestrictions || '',
          notes: p.notes || '',
        });
      } else {
        setPrefsData({ preferredShifts: ['DAY'], unavailableDays: [5], maxOvertimeHours: 4, nightShiftOk: false, medicalRestrictions: '', notes: '' });
      }
    } catch {
      // default
    } finally {
      setPrefsLoading(false);
    }
  }, []);

  const savePreference = async () => {
    if (!prefsEmployeeId) return;
    setPrefsSaving(true);
    try {
      const res = await fetch('/api/cvision/scheduling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'save-preference', employeeId: prefsEmployeeId, ...prefsData }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(tr('تم حفظ التفضيلات', 'Preferences saved'));
        loadAllPreferences();
      } else {
        toast.error(data.error || tr('فشل في حفظ التفضيلات', 'Failed to save preferences'));
      }
    } catch {
      toast.error(tr('فشل في حفظ التفضيلات', 'Failed to save preferences'));
    } finally {
      setPrefsSaving(false);
    }
  };

  const loadAllPreferences = useCallback(async () => {
    const empIds = schedule.map(s => s.employee.id);
    if (empIds.length === 0) return;
    const results: any[] = [];
    for (const empId of empIds) {
      try {
        const res = await fetch(`/api/cvision/scheduling?action=preferences&employeeId=${empId}`, { credentials: 'include' });
        const data = await res.json();
        const emp = schedule.find(s => s.employee.id === empId);
        if (data.success) {
          results.push({ employeeId: empId, employeeName: emp?.employee.name || 'Unknown', ...(data.data?.preference || {}) });
        }
      } catch { /* skip */ }
    }
    setAllPrefs(results);
  }, [schedule]);

  useEffect(() => {
    if (mainTab === 'preferences' && schedule.length > 0) {
      loadAllPreferences();
      if (!prefsEmployeeId && schedule.length > 0) {
        setPrefsEmployeeId(schedule[0].employee.id);
        loadPreference(schedule[0].employee.id);
      }
    }
  }, [mainTab, schedule, loadAllPreferences, prefsEmployeeId, loadPreference]);

  // ─── Swap Handler ──────────────────────────────────────────

  const handleSwap = async () => {
    if (!swapSource || !swapTargetId) return;
    setSwapSaving(true);
    try {
      const targetEmp = schedule.find(s => s.employee.id === swapTargetId);
      const targetEntry = targetEmp?.days.find(d => d.date === formatDate(swapSource.date));

      const res = await fetch('/api/cvision/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'swap-shifts',
          employeeId1: swapSource.employeeId,
          employeeId2: swapTargetId,
          date: formatDate(swapSource.date),
          entryId1: swapSource.dayEntry.entryId || null,
          entryId2: targetEntry?.entryId || null,
          shift1: swapSource.dayEntry.shiftType,
          shift2: targetEntry?.shiftType || 'DAY',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Shifts swapped: ${swapSource.employeeName} ↔ ${targetEmp?.employee.name || 'Unknown'}`);
        setSwapOpen(false);
        fetchSchedule();
      } else {
        toast.error(data.error || tr('فشل في تبديل الورديات', 'Failed to swap shifts'));
      }
    } catch {
      toast.error(tr('فشل في تبديل الورديات', 'Failed to swap shifts'));
    } finally {
      setSwapSaving(false);
    }
  };

  const openSwapDialog = (emp: EmployeeSchedule, dayEntry: DayEntry, dayDate: Date) => {
    setSwapSource({
      employeeId: emp.employee.id,
      employeeName: emp.employee.name,
      date: dayDate,
      dayEntry,
    });
    setSwapTargetId('');
    setSwapOpen(true);
  };

  // ─── Render Helpers ─────────────────────────────────────────

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return workSettings.restDays.includes(day);
  };

  // ─── Leave Working Days Calculation ────────────────────────

  const calculateWorkingDays = (startDateStr: string, endDateStr: string): number => {
    if (!startDateStr || !endDateStr) return 0;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (!workSettings.restDays.includes(day)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const leaveStartDate = selectedCell ? formatDate(selectedCell.date) : '';
  const leaveWorkingDays = editShiftType === 'LEAVE'
    ? calculateWorkingDays(leaveStartDate, editLeaveEndDate || leaveStartDate)
    : 0;

  // ─── Assignment Type Display ────────────────────────────────

  const getAssignmentBadge = (type?: AssignmentType) => {
    switch (type) {
      case 'LOAN': return { label: 'Loan', className: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'TRAINING': return { label: 'Training', className: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'FLOAT': return { label: 'Float', className: 'bg-teal-100 text-teal-700 border-teal-200' };
      default: return null;
    }
  };

  // ─── Filtered Schedule ─────────────────────────────────────

  const filteredSchedule = schedule.filter(emp => {
    if (staffFilter === 'unit') return !emp.employee.isBorrowed;
    if (staffFilter === 'borrowed') return emp.employee.isBorrowed;
    return true;
  });

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar style={{ height: 24, width: 24 }} />
            {tr('الجدولة الذكية', 'Smart Scheduling')}
          </h1>
          <p style={{ color: C.textMuted }}>{tr('إدارة ورديات وجداول الموظفين', 'Manage employee shifts and schedules')}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => { setMainTab('schedule'); setViewMode('weekly'); }}
            className={mainTab === 'schedule' && viewMode === 'weekly' ? 'bg-primary text-primary-foreground' : ''}>
            <CalendarDays style={{ height: 16, width: 16, marginRight: 4 }} />
            {tr('أسبوعي', 'Weekly')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => { setMainTab('schedule'); setViewMode('monthly'); }}
            className={mainTab === 'schedule' && viewMode === 'monthly' ? 'bg-primary text-primary-foreground' : ''}>
            <Calendar style={{ height: 16, width: 16, marginRight: 4 }} />
            {tr('شهري', 'Monthly')}
          </CVisionButton>
          <div style={{ height: 24 }} />
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setMainTab('preferences')}
            className={mainTab === 'preferences' ? 'bg-primary text-primary-foreground' : ''}>
            <Heart style={{ height: 16, width: 16, marginRight: 4 }} />
            {tr('التفضيلات', 'Preferences')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setMainTab('settings')}
            className={mainTab === 'settings' ? 'bg-primary text-primary-foreground' : ''}>
            <Settings style={{ height: 16, width: 16, marginRight: 4 }} />
            {tr('إعدادات العمل', 'Work Settings')}
          </CVisionButton>
        </div>
      </div>

      {/* ── Navigation & Filters ───────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft style={{ height: 16, width: 16 }} />
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={goToToday}>
            {tr('اليوم', 'Today')}
          </CVisionButton>
          <CVisionButton C={C} isDark={isDark} variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight style={{ height: 16, width: 16 }} />
          </CVisionButton>
          <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 8 }}>{getPeriodLabel()}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {departments.length > 0 && (
            <CVisionSelect
                C={C}
                value={selectedDept}
                placeholder={tr('جميع الأقسام', 'All Departments')}
                options={[
                  { value: 'all', label: tr('جميع الأقسام', 'All Departments') },
                  ...departments.map(dept => (
                  ({ value: dept.id, label: dept.nameEn || dept.name })
                )),
                ]}
              />
          )}

          {(() => {
            const filteredUnits = selectedDept && selectedDept !== 'all'
              ? availableUnits.filter(u => u.departmentId === selectedDept)
              : availableUnits;
            return filteredUnits.length > 0 && (
              <CVisionSelect
                C={C}
                value={selectedUnit}
                onChange={setSelectedUnit}
                placeholder="All Units"
                options={[
                  { value: 'all', label: 'All Units' },
                  ...filteredUnits.map(unit => (
                    ({ value: unit.id, label: `${unit.name} (${unit.code})` })
                  )),
                ]}
              />
            );
          })()}

          {/* Staff Filter */}
          {selectedUnit && selectedUnit !== 'all' && borrowedEmployees.length > 0 && (
            <CVisionSelect
                C={C}
                value={staffFilter}
                placeholder="All Staff"
                options={[
                  { value: 'all', label: 'All Staff' },
                  { value: 'unit', label: 'Unit Only' },
                  { value: 'borrowed', label: 'Borrowed Only' },
                ]}
              />
          )}

          {/* + Add Staff Button */}
          {selectedUnit && selectedUnit !== 'all' && (
            <CVisionButton C={C} isDark={isDark} variant="outline" size="sm" onClick={() => setAddStaffOpen(true)}>
              <UserPlus style={{ height: 16, width: 16, marginRight: 4 }} />
              Add Staff
            </CVisionButton>
          )}

          {!isScheduleLocked && mainTab === 'schedule' && (
            <CVisionButton C={C} isDark={isDark} size="sm" onClick={() => setAutoGenOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
              <Zap style={{ height: 16, width: 16, marginRight: 4 }} />
              Auto-Generate
            </CVisionButton>
          )}

        </div>
      </div>

      {mainTab === 'preferences' && (
        <CVisionCard C={C}>
          <CVisionCardHeader C={C} style={{ paddingBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Heart style={{ height: 20, width: 20 }} />
              Employee Scheduling Preferences
            </div>
          </CVisionCardHeader>
          <CVisionCardBody style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Employee selector + Save */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CVisionLabel C={C}>Select Employee</CVisionLabel>
                <CVisionSelect
                C={C}
                value={prefsEmployeeId}
                placeholder="Choose employee..."
                options={schedule.map(s => (
                      ({ value: s.employee.id, label: `${s.employee.name} ${s.employee.employeeNo ? `(${s.employee.employeeNo})` : ''}` })
                    ))}
              />
              </div>
              <CVisionButton C={C} isDark={isDark} onClick={savePreference} disabled={prefsSaving || !prefsEmployeeId} size="sm">
                {prefsSaving ? <Loader2 style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} /> : <CheckCircle style={{ height: 16, width: 16, marginRight: 4 }} />}
                Save Preferences
              </CVisionButton>
            </div>

            {prefsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 32, paddingBottom: 32 }}><Loader2 style={{ height: 24, width: 24, animation: 'spin 1s linear infinite', color: C.textMuted }} /></div>
            ) : prefsEmployeeId ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 24 }}>
                {/* Left: Preferences form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C} style={{ fontWeight: 500 }}>Preferred Shifts</CVisionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(['DAY', 'EVENING', 'NIGHT'] as const).map(shift => {
                        const cfg = SHIFT_CONFIG[shift];
                        const checked = prefsData.preferredShifts.includes(shift);
                        return (
                          <label key={shift} className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${checked ? cfg.bg : 'hover:bg-muted/50'}`}>
                            <Checkbox checked={checked} onCheckedChange={(v) => {
                              setPrefsData(prev => ({
                                ...prev,
                                preferredShifts: v ? [...prev.preferredShifts, shift] : prev.preferredShifts.filter(s => s !== shift),
                              }));
                            }} />
                            <cfg.Icon className="h-4 w-4" />
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{cfg.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <CVisionLabel C={C} style={{ fontWeight: 500 }}>Unavailable Days</CVisionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {DAY_NAMES.map((name, idx) => {
                        const dayNum = idx === 0 ? 6 : idx - 1; // Sat=6, Sun=0, Mon=1...
                        const isRestDay = workSettings.restDays.includes(dayNum);
                        const checked = prefsData.unavailableDays.includes(dayNum) || isRestDay;
                        return (
                          <label key={name} className={`flex items-center gap-1.5 rounded border p-2 cursor-pointer text-xs ${checked ? 'bg-red-50 border-red-200' : 'hover:bg-muted/50'} ${isRestDay ? 'opacity-70' : ''}`}>
                            <Checkbox checked={checked} disabled={isRestDay} onCheckedChange={(v) => {
                              setPrefsData(prev => ({
                                ...prev,
                                unavailableDays: v ? [...prev.unavailableDays, dayNum] : prev.unavailableDays.filter(d => d !== dayNum),
                              }));
                            }} />
                            <span>{name}</span>
                            {isRestDay && <span style={{ color: C.textMuted }}>(rest day)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: More settings */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <CVisionLabel C={C} style={{ fontWeight: 500 }}>Max Overtime Per Week (hours)</CVisionLabel>
                    <CVisionInput C={C} type="number" min={0} max={20} value={prefsData.maxOvertimeHours}
                      onChange={e => setPrefsData(prev => ({ ...prev, maxOvertimeHours: parseInt(e.target.value) || 0 }))} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
                    <div>
                      <CVisionLabel C={C} style={{ fontWeight: 500 }}>Night Shift OK</CVisionLabel>
                      <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Can this employee work night shifts?</p>
                    </div>
                    <input type="checkbox" checked={prefsData.nightShiftOk} onChange={e => setPrefsData(prev => ({ ...prev, nightShiftOk: e.target.checked }))} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <CVisionLabel C={C} style={{ fontWeight: 500 }}>Medical Restrictions</CVisionLabel>
                    <CVisionTextarea C={C} value={prefsData.medicalRestrictions} rows={2} placeholder="Any medical restrictions..."
                      onChange={e => setPrefsData(prev => ({ ...prev, medicalRestrictions: e.target.value }))} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <CVisionLabel C={C} style={{ fontWeight: 500 }}>Notes</CVisionLabel>
                    <CVisionTextarea C={C} value={prefsData.notes} rows={2} placeholder="Additional scheduling notes..."
                      onChange={e => setPrefsData(prev => ({ ...prev, notes: e.target.value }))} />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: C.textMuted }}>
                <Heart style={{ height: 32, width: 32, marginBottom: 8, opacity: 0.4 }} />
                <p>Select an employee to view and edit their scheduling preferences</p>
              </div>
            )}

            {/* All Preferences Overview Table */}
            {allPrefs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users style={{ height: 16, width: 16 }} />
                  All Employee Preferences Overview
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Employee</th>
                        <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Preferred</th>
                        <th style={{ textAlign: 'left', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Unavailable</th>
                        <th style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Night OK</th>
                        <th style={{ textAlign: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, fontWeight: 500, color: C.textMuted }}>Max OT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPrefs.map(p => (
                        <tr key={p.employeeId} style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}
                          onClick={() => { setPrefsEmployeeId(p.employeeId); loadPreference(p.employeeId); }}>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontWeight: 500 }}>{p.employeeName}</td>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {(p.preferredShifts || ['DAY']).map((s: string) => {
                                const PrefIcon = SHIFT_CONFIG[s as ShiftType]?.Icon;
                                return (
                                  <CVisionBadge C={C} key={s} variant="outline" className="text-[10px] inline-flex items-center gap-1">
                                    {PrefIcon && <PrefIcon className="h-2.5 w-2.5" />} {SHIFT_CONFIG[s as ShiftType]?.label || s}
                                  </CVisionBadge>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, fontSize: 12, color: C.textMuted }}>
                            {(p.unavailableDays || [5]).map((d: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] || d).join(', ')}
                          </td>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'center' }}>
                            {p.nightShiftOk ? <CheckCircle style={{ height: 16, width: 16, color: C.green }} /> : <XCircle style={{ height: 16, width: 16, color: C.red }} />}
                          </td>
                          <td style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, textAlign: 'center', fontSize: 12 }}>{p.maxOvertimeHours ?? 4}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* ── Work Settings Tab ─────────────────────────────── */}
      {mainTab === 'settings' && (
        <WorkSettingsTab
          departments={departments}
          settingsDepartments={settingsDepartments}
          workSettings={workSettings}
          setWorkSettings={setWorkSettings}
          tenantDefaultWs={tenantDefaultWs}
          wsLoading={wsLoading}
          setWsLoading={setWsLoading}
          wsSaving={wsSaving}
          setWsSaving={setWsSaving}
          settingsDeptScope={settingsDeptScope}
          settingsUnitScope={settingsUnitScope}
          settingsUnits={settingsUnits}
          deptOverrides={deptOverrides}
          setDeptOverrides={setDeptOverrides}
          deptEmployees={deptEmployees}
          employeesLoading={employeesLoading}
          expandedEmployeeId={expandedEmployeeId}
          setExpandedEmployeeId={setExpandedEmployeeId}
          editingEmployeeWs={editingEmployeeWs}
          setEditingEmployeeWs={setEditingEmployeeWs}
          employeeSaving={employeeSaving}
          selectedEmployeeIds={selectedEmployeeIds}
          setSelectedEmployeeIds={setSelectedEmployeeIds}
          employeeSearchTerm={employeeSearchTerm}
          setEmployeeSearchTerm={setEmployeeSearchTerm}
          bulkEditOpen={bulkEditOpen}
          setBulkEditOpen={setBulkEditOpen}
          bulkWs={bulkWs}
          setBulkWs={setBulkWs}
          bulkSaving={bulkSaving}
          isAdminUser={isAdminUser}
          loadDeptWorkSchedule={loadDeptWorkSchedule}
          fetchDeptEmployees={fetchDeptEmployees}
          saveEmployeeWorkSettings={saveEmployeeWorkSettings}
          resetEmployeeWorkSettings={resetEmployeeWorkSettings}
          saveBulkEmployeeSettings={saveBulkEmployeeSettings}
          fetchWorkSettings={fetchWorkSettings}
        />
      )}

      {/* ── Approval Status Banner + Pending Approvals ── */}
      {mainTab === 'schedule' && (
        <ApprovalBanner
          approvalStatus={approvalStatus}
          currentApproval={currentApproval}
          selectedUnit={selectedUnit}
          availableUnits={availableUnits}
          days={days}
          canManageApprovals={canManageApprovals}
          pendingApprovals={pendingApprovals}
          handleSubmitForApproval={handleSubmitForApproval}
          handleApprove={handleApprove}
          onReject={(approvalId) => {
            setRejectingApprovalId(approvalId);
            setRejectReason('');
            setRejectDialogOpen(true);
          }}
        />
      )}

      {/* ── Schedule Grid ──────────────────────────────────── */}
      {mainTab === 'schedule' && <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80 }}>
              <Loader2 style={{ height: 32, width: 32, animation: 'spin 1s linear infinite', color: C.textMuted }} />
            </div>
          ) : filteredSchedule.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingBottom: 80, color: C.textMuted }}>
              <Users style={{ height: 48, width: 48, marginBottom: 16, opacity: 0.5 }} />
              <p style={{ fontSize: 16, fontWeight: 500 }}>No employees found</p>
              <p style={{ fontSize: 13 }}>
                {staffFilter !== 'all'
                  ? `No ${staffFilter === 'borrowed' ? 'borrowed' : 'unit'} staff found. Try changing the filter.`
                  : 'Add employees or adjust your department filter'}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ position: 'sticky', zIndex: 10, background: C.bgCard, textAlign: 'left', paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, fontSize: 13, fontWeight: 500, color: C.textMuted }}>
                      Employee
                      {borrowedEmployees.length > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: C.blue }}>
                          ({borrowedEmployees.length} borrowed)
                        </span>
                      )}
                    </th>
                    {days.map((day, i) => (
                      <th
                        key={i}
                        className={`px-1 py-3 text-center text-xs font-medium min-w-[80px] ${
                          isToday(day) ? 'bg-blue-50 text-blue-700' :
                          isWeekend(day) ? 'bg-slate-50 text-slate-500' : 'text-muted-foreground'
                        }`}
                      >
                        <div>{formatDayHeader(day)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedule.map((emp, empIdx) => {
                    const isBorrowed = emp.employee.isBorrowed;
                    const assignBadge = isBorrowed ? getAssignmentBadge(emp.employee.assignmentType) : null;

                    return (
                      <tr
                        key={emp.employee.id}
                        className={`border-b ${
                          isBorrowed
                            ? 'bg-blue-50/60 hover:bg-blue-50'
                            : empIdx % 2 === 0 ? '' : 'bg-muted/30'
                        }`}
                      >
                        <td className={`sticky left-0 z-10 px-4 py-2 border-r ${
                          isBorrowed ? 'bg-blue-50' : 'bg-background'
                        }`}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isBorrowed && (
                              <RefreshCw style={{ height: 14, width: 14, color: C.blue }} />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {emp.employee.name || 'Unknown'}
                                {assignBadge && (
                                  <CVisionBadge C={C} variant="outline" className={`text-[10px] px-1.5 py-0 ${assignBadge.className}`}>
                                    {assignBadge.label}
                                  </CVisionBadge>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textMuted }}>
                                {emp.employee.employeeNo && <span>{emp.employee.employeeNo}</span>}
                                {isBorrowed && emp.employee.originalUnitName && (
                                  <span style={{ color: C.blue }}>(from {emp.employee.originalUnitName})</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        {emp.days.map((dayEntry, dayIdx) => {
                          const dayDate = days[dayIdx];
                          if (!dayDate) return null;
                          const config = SHIFT_CONFIG[dayEntry.shiftType] || SHIFT_CONFIG.DAY;

                          // Split shift: render stacked segments
                          if (dayEntry.isSplitShift && dayEntry.splitSegments && dayEntry.splitSegments.length > 0) {
                            return (
                              <td
                                key={dayIdx}
                                className={`px-1 py-1 text-center ${isToday(dayDate) ? 'bg-blue-50/50' : ''}`}
                              >
                                <div style={{ position: 'relative' }}>
                                  <button
                                    onClick={() => handleCellClick(emp, dayEntry, dayDate)}
                                    className={`w-full rounded-md border px-1 py-1 text-xs font-medium transition-colors ${
                                      isScheduleLocked
                                        ? 'bg-purple-50 text-purple-700 opacity-60 cursor-not-allowed border-purple-200'
                                        : 'bg-purple-100 hover:bg-purple-200 text-purple-700 cursor-pointer border-purple-200'
                                    }`}
                                    title={dayEntry.splitSegments.map((s: DayEntry) => {
                                      const segCfg = SHIFT_CONFIG[s.shiftType] || SHIFT_CONFIG.DAY;
                                      return segCfg.label;
                                    }).join(' + ')}
                                  >
                                    {dayEntry.splitSegments.map((seg: DayEntry, sIdx: number) => {
                                      const segCfg = SHIFT_CONFIG[seg.shiftType] || SHIFT_CONFIG.DAY;
                                      const SegIcon = segCfg.Icon;
                                      return (
                                        <div key={sIdx} className={`flex items-center ${sIdx > 0 ? 'border-t border-purple-200 mt-0.5 pt-0.5' : ''}`}>
                                          <SegIcon className="h-2.5 w-2.5 shrink-0" />
                                          <span style={{ marginLeft: 2 }}>{seg.notes || segCfg.label}</span>
                                        </div>
                                      );
                                    })}
                                  </button>
                                  {!isScheduleLocked && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openSwapDialog(emp, dayEntry, dayDate); }}
                                      style={{ position: 'absolute', display: 'none', height: 16, width: 16, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: C.purpleDim }}
                                      title="Swap shift"
                                    >
                                      <Repeat2 style={{ height: 10, width: 10 }} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          return (
                            <td
                              key={dayIdx}
                              className={`px-1 py-1 text-center ${isToday(dayDate) ? 'bg-blue-50/50' : ''}`}
                            >
                              <div style={{ position: 'relative' }}>
                                <button
                                  onClick={() => handleCellClick(emp, dayEntry, dayDate)}
                                  className={`w-full rounded-md border px-1 py-1.5 text-xs font-medium transition-colors ${
                                    isScheduleLocked
                                      ? `${config.bg.split(' ')[0]} ${config.color} opacity-60 cursor-not-allowed`
                                      : `${config.bg} ${config.color} cursor-pointer`
                                  }`}
                                  title={
                                    isScheduleLocked
                                      ? 'Schedule is locked (approved)'
                                      : `${emp.employee.name}${isBorrowed ? ` (${emp.employee.assignmentType})` : ''} – ${config.label}${dayEntry.overtimeHours ? ` (+${dayEntry.overtimeHours}h)` : ''}`
                                  }
                                >
                                  <config.Icon className="h-3.5 w-3.5 mx-auto" />
                                  <div style={{ marginTop: 2 }}>{config.label}</div>
                                  {dayEntry.overtimeHours && (
                                    <div style={{ opacity: 0.75 }}>+{dayEntry.overtimeHours}h</div>
                                  )}
                                </button>
                                {!isScheduleLocked && dayEntry.shiftType !== 'OFF' && dayEntry.shiftType !== 'LEAVE' && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openSwapDialog(emp, dayEntry, dayDate); }}
                                    style={{ position: 'absolute', display: 'none', height: 16, width: 16, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: C.blueDim }}
                                    title="Swap shift"
                                  >
                                    <Repeat2 style={{ height: 10, width: 10 }} />
                                  </button>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CVisionCardBody>
      </CVisionCard>}

      {/* ── Stats Cards ────────────────────────────────────── */}
      {mainTab === 'schedule' && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <CVisionCard C={C}>
            <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
              <Users style={{ height: 20, width: 20, marginBottom: 4, color: C.textMuted }} />
              <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.totalEmployees}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>Employees</div>
            </CVisionCardBody>
          </CVisionCard>
          {(Object.keys(SHIFT_CONFIG) as ShiftType[]).map(type => {
            const cfg = SHIFT_CONFIG[type];
            const count = summary.shiftsCount[type] || 0;
            const SummaryIcon = cfg.Icon;
            return (
              <CVisionCard C={C} key={type}>
                <CVisionCardBody style={{ padding: 16, textAlign: 'center' }}>
                  <SummaryIcon className={`h-5 w-5 mx-auto ${cfg.color}`} />
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{count}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{cfg.label}</div>
                </CVisionCardBody>
              </CVisionCard>
            );
          })}
        </div>
      )}

      {/* ── Smart Alerts ─────────────────────────────────────── */}
      {mainTab === 'schedule' && suggestions.length > 0 && (
        <CVisionCard C={C} className="border-amber-200">
          <CVisionCardHeader C={C} style={{ padding: 16, paddingBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell style={{ height: 20, width: 20, color: C.orange }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Alerts</div>
                <CVisionBadge C={C} variant="secondary" style={{ background: C.orangeDim, color: C.orange }}>
                  {suggestions.length}
                </CVisionBadge>
              </div>
              <CVisionButton C={C} isDark={isDark}
                variant="ghost"
                size="sm"
                onClick={() => setShowAlerts(!showAlerts)}
                style={{ height: 32, width: 32, padding: 0 }}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAlerts ? '' : '-rotate-90'}`}
                />
              </CVisionButton>
            </div>
          </CVisionCardHeader>
          {showAlerts && (
            <CVisionCardBody style={{ padding: 16, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {suggestions.map((s, i) => {
                const isCritical = s.severity === 'CRITICAL';
                const isWarning = s.severity === 'WARNING';
                const isInfo = s.severity === 'INFO';

                const borderColor = isCritical
                  ? 'border-red-200'
                  : isWarning
                    ? 'border-amber-200'
                    : 'border-blue-200';
                const bgColor = isCritical
                  ? 'bg-red-50'
                  : isWarning
                    ? 'bg-amber-50'
                    : 'bg-blue-50';
                const textColor = isCritical
                  ? 'text-red-700'
                  : isWarning
                    ? 'text-amber-700'
                    : 'text-blue-700';

                const Icon = isCritical ? AlertTriangle : isWarning ? AlertCircle : Info;

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${borderColor} ${bgColor}`}
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${textColor}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className={`text-sm font-medium ${textColor}`}>{s.message}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.shiftType && (() => {
                        const SIcon = SHIFT_CONFIG[s.shiftType]?.Icon;
                        return (
                          <CVisionBadge C={C} variant="outline" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {SIcon && <SIcon className="h-3 w-3" />} {SHIFT_CONFIG[s.shiftType]?.label || s.shiftType}
                          </CVisionBadge>
                        );
                      })()}
                      <CVisionBadge C={C}
                        className={`text-xs ${
                          isCritical
                            ? 'bg-red-600 hover:bg-red-600'
                            : isWarning
                              ? 'bg-amber-500 hover:bg-amber-500'
                              : 'bg-blue-500 hover:bg-blue-500'
                        }`}
                      >
                        {s.severity}
                      </CVisionBadge>
                    </div>
                  </div>
                );
              })}
            </CVisionCardBody>
          )}
        </CVisionCard>
      )}

      {/* ── Legend ──────────────────────────────────────────── */}
      {mainTab === 'schedule' && <CVisionCard C={C}>
        <CVisionCardBody style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>Legend:</span>
            {(Object.keys(SHIFT_CONFIG) as ShiftType[]).map(type => {
              const cfg = SHIFT_CONFIG[type];
              const ShiftIcon = cfg.Icon;
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium border ${cfg.bg} ${cfg.color}`}
                  >
                    <ShiftIcon className="h-3 w-3" /> {cfg.label}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {borrowedEmployees.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, fontSize: 12, fontWeight: 500, border: `1px solid ${C.border}`, background: C.blueDim, color: C.blue }}>
                    <RefreshCw style={{ height: 12, width: 12 }} /> {tr('مُعار', 'Borrowed')}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 6, background: C.blueDim, border: `1px solid ${C.border}` }} />
                <span style={{ fontSize: 12, color: C.textMuted }}>{tr('اليوم', 'Today')}</span>
              </div>
            </div>
          </div>
        </CVisionCardBody>
      </CVisionCard>}

      {/* ── Edit Dialog ────────────────────────────────────── */}
      <CVisionDialog C={C} open={dialogOpen} onClose={() => setDialogOpen(false)} title={tr('التفاصيل', 'Details')} isDark={isDark}>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {selectedCell ? `${selectedCell.employeeName} – ${selectedCell.date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : tr('تعديل تعيين الوردية', 'Modify shift assignment')}
            </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8, overflowY: 'auto' }}>
            {/* Borrowed Employee Warning */}
            {selectedCell?.isBorrowed && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 12, border: `1px solid ${C.border}`, background: C.orangeDim, padding: 12 }}>
                <AlertTriangle style={{ height: 16, width: 16, color: C.orange, marginTop: 2 }} />
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 500, color: C.orange }}>{tr('موظف مُعار', 'Borrowed Employee')}</p>
                  <p style={{ color: C.orange, fontSize: 12, marginTop: 2 }}>
                    {tr(
                      `هذا الموظف في ${selectedCell.assignmentType?.toLowerCase() || 'إعارة'} من ${selectedCell.originalUnitName || 'وحدة أخرى'}. تغييرات الجدول ستطبق على تعيينه في هذه الوحدة.`,
                      `This employee is on ${selectedCell.assignmentType?.toLowerCase() || 'loan'} from ${selectedCell.originalUnitName || 'another unit'}. Schedule changes will apply to their assignment in this unit.`
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Shift Type Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C}>{tr('نوع الوردية', 'Shift Type')}</CVisionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {(Object.keys(SHIFT_CONFIG) as ShiftType[]).map(type => {
                  const cfg = SHIFT_CONFIG[type];
                  const isSelected = editShiftType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => setEditShiftType(type)}
                      className={`rounded-lg border-2 p-2 text-center transition-all ${
                        isSelected
                          ? `${cfg.bg} ${cfg.color} border-current ring-2 ring-offset-1`
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <cfg.Icon className={`h-5 w-5 mx-auto ${isSelected ? cfg.color : ''}`} />
                      <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{cfg.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Leave Options */}
            {editShiftType === 'LEAVE' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                {/* Date Range */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <CVisionLabel C={C} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarRange style={{ height: 16, width: 16 }} />
                    {tr('فترة الإجازة', 'Leave Period')}
                  </CVisionLabel>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{tr('من', 'From')}</span>
                      <CVisionInput C={C}
                        type="date"
                        value={leaveStartDate}
                        disabled
                        style={{ fontSize: 13 }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{tr('إلى', 'To')}</span>
                      <CVisionInput C={C}
                        type="date"
                        value={editLeaveEndDate}
                        min={leaveStartDate}
                        onChange={e => setEditLeaveEndDate(e.target.value)}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  </div>
                  {/* Working Days Count */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, border: `1px solid ${C.border}`, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8 }}>
                    <span style={{ fontSize: 13 }}>{tr('أيام العمل', 'Working days')}</span>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{leaveWorkingDays}</span>
                  </div>
                  <p style={{ color: C.textMuted }}>
                    {tr('تستثني أيام الراحة المُعدة', 'Excludes configured rest days')} ({(() => {
                      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                      return workSettings.restDays.map(d => names[d]).join(' & ');
                    })()})
                  </p>
                </div>

                {/* Leave Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('نوع الإجازة', 'Leave Type')}</CVisionLabel>
                  <CVisionSelect
                C={C}
                value={editLeaveType}
                onChange={setEditLeaveType}
                options={LEAVE_TYPES.map(lt => (
                        ({ value: lt.value, label: lt.label })
                      ))}
              />
                </div>

                {/* Reason */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('السبب (اختياري)', 'Reason (optional)')}</CVisionLabel>
                  <CVisionTextarea C={C}
                    value={editLeaveReason}
                    onChange={e => setEditLeaveReason(e.target.value)}
                    placeholder={tr('سبب الإجازة...', 'Leave reason...')}
                    rows={2}
                  />
                </div>

                {/* Approval Flow Info */}
                <div style={{ borderRadius: 8, border: `1px solid ${C.border}`, background: C.blueDim, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.blue, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info style={{ height: 14, width: 14 }} />
                    {tr('سير الاعتماد', 'Approval Flow')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.blue }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: C.blueDim, color: C.blue, fontWeight: 700 }}>1</div>
                      <span>{tr('تأكيد الموظف مطلوب', 'Employee confirmation required')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.blue }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: C.blueDim, color: C.blue, fontWeight: 700 }}>2</div>
                      <span>{tr('اعتماد مدير التمريض', 'Nursing Manager approval')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overtime Options */}
            {editShiftType === 'OVERTIME' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: C.redDim }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('ساعات العمل الإضافي', 'Overtime Hours')}</CVisionLabel>
                  <CVisionInput C={C}
                    type="number"
                    min="0.5"
                    max="12"
                    step="0.5"
                    value={editOvertimeHours}
                    onChange={e => setEditOvertimeHours(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <CVisionLabel C={C}>{tr('السبب', 'Reason')}</CVisionLabel>
                  <CVisionTextarea C={C}
                    value={editOvertimeReason}
                    onChange={e => setEditOvertimeReason(e.target.value)}
                    placeholder={tr('لماذا العمل الإضافي مطلوب؟', 'Why is overtime needed?')}
                    rows={2}
                  />
                </div>
                {editOvertimeHours && parseFloat(editOvertimeHours) > 0 && (
                  <div style={{ borderRadius: 8, background: C.orangeDim, border: `1px solid ${C.border}`, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: C.orange }}>{tr('الأجر التقديري', 'Estimated pay')}</span>
                    <span style={{ fontWeight: 700, color: C.orange }}>
                      {(() => {
                        const hours = parseFloat(editOvertimeHours);
                        const hourlyRate = 5000 / 30 / 8;
                        const isWknd = selectedCell ? [5, 6].includes(selectedCell.date.getDay()) : false;
                        const rate = isWknd ? 1.75 : 1.5;
                        return `${Math.round(hourlyRate * hours * rate).toLocaleString()} SAR`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>{tr('ملاحظات (اختياري)', 'Notes (optional)')}</CVisionLabel>
              <CVisionInput C={C}
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder={tr('أي ملاحظات إضافية...', 'Any additional notes...')}
              />
            </div>
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => {}}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSaveEntry} disabled={saving || (editShiftType === 'LEAVE' && leaveWorkingDays === 0)}>
              {saving ? <Loader2 style={{ height: 16, width: 16, animation: 'spin 1s linear infinite', marginRight: 8 }} /> : null}
              {editShiftType === 'LEAVE' ? tr('إرسال طلب إجازة', 'Submit Leave Request') : tr('حفظ', 'Save')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Reject Reason Dialog ──────────────────────────── */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('رفض الجدول', 'Reject Schedule')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('يرجى تقديم سبب رفض هذا الجدول.', 'Please provide a reason for rejecting this schedule.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div style={{ paddingTop: 16, paddingBottom: 16 }}>
            <CVisionTextarea C={C}
              placeholder={tr('سبب الرفض...', 'Reason for rejection...')}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('إلغاء', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              style={{ background: C.redDim }}
              onClick={handleReject}
              disabled={!rejectReason.trim()}
            >
              {tr('رفض الجدول', 'Reject Schedule')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add Staff Dialog ───────────────────────────────── */}
      <CVisionDialog C={C} open={addStaffOpen} onClose={() => setAddStaffOpen(false)} title={tr('إضافة موظفين', 'Add Staff')} isDark={isDark}>
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>{tr('تعيين موظفين لجدول هذه الوحدة', 'Assign employees to this unit\'s schedule')}</p>          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <p style={{ fontSize: 13, color: C.textMuted }}>
              {tr('لإضافة موظفين لجدول هذه الوحدة، استخدم صفحة', 'To add employees to this unit\'s schedule, use the')}{' '}
              <a href="/cvision/units" style={{ color: C.blue, fontWeight: 500 }}>{tr('إدارة الوحدات', 'Units Management')}</a>{' '}
              {tr('من أجل:', 'page to:')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, transition: 'color 0.2s, background 0.2s' }}>
                <Users style={{ height: 20, width: 20, color: C.green, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('تعيين موظفي الوحدة', 'Assign Unit Staff')}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('عيّن الوحدة الأساسية للموظفين لإضافتهم بشكل دائم', 'Set employees\' primary unit to add them permanently')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, transition: 'color 0.2s, background 0.2s' }}>
                <ArrowLeftRight style={{ height: 20, width: 20, color: C.blue, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('استعارة من وحدة أخرى', 'Borrow from Another Unit')}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('أنشئ تعيين إعارة أو تدريب لإضافة موظفين مؤقتاً', 'Create a Loan or Training assignment to temporarily add staff')}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, transition: 'color 0.2s, background 0.2s' }}>
                <RefreshCw style={{ height: 20, width: 20, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('تعيين مجمع العائمين', 'Assign Float Pool')}</p>
                  <p style={{ fontSize: 12, color: C.textMuted }}>{tr('تعيين سريع للموظفين المتاحين من المجمع العائم', 'Quick-assign available float pool employees')}</p>
                </div>
              </div>
            </div>
          </div>
          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => {}}>{tr('إغلاق', 'Close')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={() => { setAddStaffOpen(false); window.location.href = '/cvision/units'; }}>
              {tr('الذهاب للوحدات', 'Go to Units')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Auto-Generate Dialog ──────────────────────────── */}
      <CVisionDialog C={C} open={autoGenOpen} onClose={() => setAutoGenOpen(false)} title={tr('إنشاء الجدول تلقائياً', 'Auto-Generate Schedule')} isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {getPeriodLabel()}
              {selectedDept !== 'all' && ` • ${departments.find(d => d.id === selectedDept)?.nameEn || departments.find(d => d.id === selectedDept)?.name || 'Dept'}`}
            </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8, paddingBottom: 8, overflowY: 'auto' }}>
            {/* Shift Requirements */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('متطلبات الورديات', 'Shift Requirements')}</CVisionLabel>

              <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-green-100 text-green-700">
                      <Sun className="h-4 w-4" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('وردية صباحية', 'Day Shift')}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>08:00 – 17:00</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الحد الأدنى/يوم:', 'Min per day:')}</CVisionLabel>
                    <CVisionInput C={C} type="number" min={0} max={20} value={autoGenDayReq}
                      onChange={e => setAutoGenDayReq(parseInt(e.target.value) || 0)}
                      style={{ width: 64, height: 32, textAlign: 'center' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-amber-100 text-amber-700">
                      <Sunset className="h-4 w-4" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('وردية مسائية', 'Evening Shift')}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>15:00 – 23:00</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الحد الأدنى/يوم:', 'Min per day:')}</CVisionLabel>
                    <CVisionInput C={C} type="number" min={0} max={20} value={autoGenEveReq}
                      onChange={e => setAutoGenEveReq(parseInt(e.target.value) || 0)}
                      style={{ width: 64, height: 32, textAlign: 'center' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-indigo-100 text-indigo-700">
                      <Moon className="h-4 w-4" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{tr('وردية ليلية', 'Night Shift')}</p>
                      <p style={{ fontSize: 12, color: C.textMuted }}>23:00 – 07:00</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CVisionLabel C={C} style={{ fontSize: 12, color: C.textMuted }}>{tr('الحد الأدنى/يوم:', 'Min per day:')}</CVisionLabel>
                    <CVisionInput C={C} type="number" min={0} max={20} value={autoGenNightReq}
                      onChange={e => setAutoGenNightReq(parseInt(e.target.value) || 0)}
                      style={{ width: 64, height: 32, textAlign: 'center' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Working Days */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('أيام العمل', 'Working Days')}</CVisionLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                {DAY_NAMES.map((name, i) => (
                  <label key={name} className={`flex flex-col items-center gap-1 rounded-lg border p-2 cursor-pointer transition-colors min-w-[44px] ${autoGenDays[i] ? 'bg-green-50 border-green-300' : 'hover:bg-muted/50'}`}>
                    <Checkbox checked={autoGenDays[i]} onCheckedChange={(v) => {
                      const next = [...autoGenDays];
                      next[i] = !!v;
                      setAutoGenDays(next);
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Constraints */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CVisionLabel C={C} style={{ fontWeight: 500 }}>{tr('القيود', 'Constraints')}</CVisionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <Checkbox checked={autoGenRespectPrefs} onCheckedChange={v => setAutoGenRespectPrefs(!!v)} />
                  {tr('احترام تفضيلات الموظفين', 'Respect employee preferences')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <Checkbox checked={autoGenMinRest} onCheckedChange={v => setAutoGenMinRest(!!v)} />
                  {tr('ضمان حد أدنى 12 ساعة راحة بين الورديات', 'Ensure minimum 12hr rest between shifts')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <Checkbox checked={autoGenMaxConsec} onCheckedChange={v => setAutoGenMaxConsec(!!v)} />
                  {tr('حد أقصى 6 أيام عمل متتالية', 'Max 6 consecutive work days')}
                </label>
                <p style={{ fontSize: 12, color: C.textMuted, marginLeft: 24 }}>
                  {tr('أيام الراحة', 'Rest days')} ({(() => {
                    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return workSettings.restDays.map(d => names[d]).join(', ');
                  })()}) {tr('مستثناة تلقائياً بناءً على إعدادات العمل.', 'are automatically excluded based on Work Settings.')}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{tr('ملخص الجدول', 'Schedule Summary')}</p>
              <p style={{ fontSize: 13 }}>
                {autoGenDays.filter(Boolean).length} working days × {
                  [autoGenDayReq > 0 && `${autoGenDayReq} Day`, autoGenEveReq > 0 && `${autoGenEveReq} Evening`, autoGenNightReq > 0 && `${autoGenNightReq} Night`].filter(Boolean).join(' + ') || 'No shifts'
                } = ~{autoGenDays.filter(Boolean).length * (autoGenDayReq + autoGenEveReq + autoGenNightReq)} shift assignments
              </p>
            </div>
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => {}}>{tr('إلغاء', 'Cancel')}</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleAutoGenerate} disabled={autoGenLoading} className="bg-violet-600 hover:bg-violet-700">
              {autoGenLoading ? <Loader2 style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} /> : <Zap style={{ height: 16, width: 16, marginRight: 4 }} />}
              {tr('إنشاء الجدول', 'Generate Schedule')}
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>

      {/* ── Swap Dialog ──────────────────────────────────── */}
      <CVisionDialog C={C} open={swapOpen} onClose={() => setSwapOpen(false)} title="Swap Shift" isDark={isDark}>            
            <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
              {swapSource ? `${swapSource.employeeName} – ${swapSource.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Swap shift between employees'}
            </p>
            {swapSource && (() => {
              const SwapIcon = SHIFT_CONFIG[swapSource.dayEntry.shiftType]?.Icon;
              return (
                <p style={{ fontSize: 13, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {swapSource.employeeName} – {swapSource.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' ('}
                  {SwapIcon && <SwapIcon className="h-3 w-3 inline" />}
                  {' '}{SHIFT_CONFIG[swapSource.dayEntry.shiftType]?.label}{')'}
                </p>
              );
            })()}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8, paddingBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <CVisionLabel C={C}>Swap with employee</CVisionLabel>
              <CVisionSelect
                C={C}
                value={swapTargetId}
                onChange={setSwapTargetId}
                placeholder="Select employee..."
                options={schedule
                    .filter(s => s.employee.id !== swapSource?.employeeId)
                    .map(s => {
                      const targetDay = swapSource ? s.days.find(d => d.date === formatDate(swapSource.date)) : null;
                      return (
                        ({ value: s.employee.id, label: `<span style=${{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            ${s.employee.name}
                            ${targetDay && (() => {
                              const TIcon = SHIFT_CONFIG[targetDay.shiftType]?.Icon;
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  (${TIcon && <TIcon className="h-3 w-3" />} ${SHIFT_CONFIG[targetDay.shiftType]?.label})
                                </span>
                              );
                            })()}
                          </span>` })
                      );
                    })}
              />
            </div>

            {swapTargetId && swapSource && (() => {
              const targetEmp = schedule.find(s => s.employee.id === swapTargetId);
              const targetDay = targetEmp?.days.find(d => d.date === formatDate(swapSource.date));
              if (!targetDay || !targetEmp) return null;
              const srcCfg = SHIFT_CONFIG[swapSource.dayEntry.shiftType];
              const tgtCfg = SHIFT_CONFIG[targetDay.shiftType];
              const SrcIcon = srcCfg.Icon;
              const TgtIcon = tgtCfg.Icon;
              return (
                <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>Swap Preview</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <p style={{ fontSize: 12, color: C.textMuted }}>{swapSource.employeeName}</p>
                      <div className={`text-sm font-medium mt-1 rounded px-2 py-1 inline-flex items-center justify-center gap-1.5 ${srcCfg.bg} ${srcCfg.color}`}>
                        <SrcIcon className="h-3.5 w-3.5" /> {srcCfg.label}
                      </div>
                    </div>
                    <ArrowLeftRight style={{ height: 20, width: 20, color: C.textMuted, marginLeft: 8, marginRight: 8 }} />
                    <div style={{ textAlign: 'center', flex: 1 }}>
                      <p style={{ fontSize: 12, color: C.textMuted }}>{targetEmp.employee.name}</p>
                      <div className={`text-sm font-medium mt-1 rounded px-2 py-1 inline-flex items-center justify-center gap-1.5 ${tgtCfg.bg} ${tgtCfg.color}`}>
                        <TgtIcon className="h-3.5 w-3.5" /> {tgtCfg.label}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <CVisionDialogFooter C={C}>
            <CVisionButton C={C} isDark={isDark} variant="outline" onClick={() => {}}>Cancel</CVisionButton>
            <CVisionButton C={C} isDark={isDark} onClick={handleSwap} disabled={swapSaving || !swapTargetId}>
              {swapSaving ? <Loader2 style={{ height: 16, width: 16, marginRight: 4, animation: 'spin 1s linear infinite' }} /> : <Repeat2 style={{ height: 16, width: 16, marginRight: 4 }} />}
              Swap Shifts
            </CVisionButton>
          </CVisionDialogFooter>
      </CVisionDialog>
    </div>
  );
}
