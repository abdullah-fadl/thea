// app/(dashboard)/cvision/attendance/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from '@tanstack/react-query';
import { cvisionFetch, cvisionMutate, cvisionKeys } from '@/lib/cvision/hooks';
import { useLang } from "@/hooks/use-lang";
import { useCVisionTheme } from "@/lib/cvision/theme";
import {
  CVisionCard, CVisionCardHeader, CVisionCardBody,
  CVisionButton, CVisionBadge, CVisionInput, CVisionSelect,
  CVisionTable, CVisionTableHead, CVisionTableBody, CVisionTh, CVisionTr, CVisionTd,
  CVisionDialog, CVisionDialogFooter,
  CVisionTabs, CVisionTabContent,
  CVisionPageHeader, CVisionPageLayout, CVisionStatsRow, CVisionMiniStat,
  CVisionSkeletonCard, CVisionSkeletonStyles,
} from "@/components/cvision/ui";
import {
  Clock,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
  AlertTriangle,
  Calendar,
  Timer,
  Search,
  Building2,
  CalendarDays,
  FileEdit,
  MapPin,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import AttendanceCalendar from "./_components/AttendanceCalendar";
import CorrectionQueue from "./_components/CorrectionQueue";
import GeofenceManager from "./_components/GeofenceManager";
import AbsenteeismReport from "./_components/AbsenteeismReport";

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  status: string;
  scheduledIn?: string;
  scheduledOut?: string;
  actualIn?: string;
  actualOut?: string;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  workedMinutes: number;
}

interface Employee {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  name?: string;
  employeeNumber?: string;
  employeeNo?: string;
  departmentId?: string;
}

interface Department {
  id: string;
  name: string;
}

interface MonthlySummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalLateMinutes: number;
  totalOvertimeMinutes: number;
  attendancePercentage: number;
}

const statusColors: Record<string, string> = {
  PRESENT: "bg-green-500",
  ABSENT: "bg-red-500",
  LATE: "bg-yellow-500",
  EARLY_LEAVE: "bg-orange-500",
  ON_LEAVE: "bg-blue-500",
  HOLIDAY: "bg-purple-500",
  REMOTE: "bg-cyan-500",
  INCOMPLETE: "bg-amber-500",
};

export default function AttendancePage() {
  const { C, isDark } = useCVisionTheme();
  const { language } = useLang();
  const isRTL = language === 'ar';
  const tr = (ar: string, en: string) => isRTL ? ar : en;

  const statusLabels: Record<string, string> = {
    PRESENT: tr("حاضر", "Present"),
    ABSENT: tr("غائب", "Absent"),
    LATE: tr("متأخر", "Late"),
    EARLY_LEAVE: tr("خروج مبكر", "Early Leave"),
    ON_LEAVE: tr("في إجازة", "On Leave"),
    HOLIDAY: tr("إجازة رسمية", "Holiday"),
    REMOTE: tr("عمل عن بعد", "Remote"),
    INCOMPLETE: tr("غير مكتمل", "Incomplete"),
  };
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [formData, setFormData] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    actualIn: "",
    actualOut: "",
    notes: "",
  });

  const [activeTab, setActiveTab] = useState("records");

  // Bulk mode state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkMonth, setBulkMonth] = useState(new Date().getMonth() + 1);
  const [bulkYear, setBulkYear] = useState(new Date().getFullYear());
  const [workingHours, setWorkingHours] = useState(8);
  const [isSaving, setIsSaving] = useState(false);
  const [manualCheckOut, setManualCheckOut] = useState(false);

  // Calculate check-out time based on check-in time
  const calculateCheckOut = (checkInTime: string, hours: number = 8) => {
    if (!checkInTime) return "";
    const [h, m] = checkInTime.split(":").map(Number);
    const totalMinutes = h * 60 + m + hours * 60;
    const outHours = Math.floor(totalMinutes / 60) % 24;
    const outMinutes = totalMinutes % 60;
    return `${outHours.toString().padStart(2, "0")}:${outMinutes.toString().padStart(2, "0")}`;
  };

  // Auto-update check-out time when check-in changes — only if user hasn't manually edited it
  useEffect(() => {
    if (formData.actualIn && !bulkMode && !manualCheckOut) {
      const autoCheckOut = calculateCheckOut(formData.actualIn, workingHours);
      setFormData(prev => ({ ...prev, actualOut: autoCheckOut }));
    }
  }, [formData.actualIn, workingHours]);

  // Fetch attendance records
  const attFilters: Record<string, any> = { month: selectedMonth, year: selectedYear };
  if (selectedEmployee) attFilters.employeeId = selectedEmployee;
  const { data: attRaw, isLoading: loading, refetch: refetchAttendance } = useQuery({
    queryKey: cvisionKeys.attendance.list(attFilters),
    queryFn: () => cvisionFetch('/api/cvision/attendance', { params: attFilters }),
  });
  const records: AttendanceRecord[] = attRaw?.data?.attendance || [];

  // Fetch employees (reference data)
  const { data: empRaw } = useQuery({
    queryKey: cvisionKeys.employees.list({ statuses: 'ACTIVE,PROBATION' }),
    queryFn: () => cvisionFetch('/api/cvision/employees', { params: { statuses: 'ACTIVE,PROBATION' } }),
  });
  useEffect(() => {
    if (empRaw?.success) {
      const mapped = (empRaw.data?.items || empRaw.data || []).map((emp: any) => ({
        ...emp,
        id: emp.id || emp._id,
        name: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      }));
      setEmployees(mapped);
    }
  }, [empRaw]);

  // Fetch departments (reference data)
  const { data: deptRaw } = useQuery({
    queryKey: cvisionKeys.departments.list({ limit: 200 }),
    queryFn: () => cvisionFetch('/api/cvision/org/departments', { params: { limit: 200 } }),
  });
  useEffect(() => {
    if (deptRaw) setDepartments(deptRaw.items ?? deptRaw.data ?? []);
  }, [deptRaw]);

  // Fetch monthly summary
  const { data: summaryRaw } = useQuery({
    queryKey: cvisionKeys.attendance.summary({ employeeId: selectedEmployee, month: selectedMonth, year: selectedYear }),
    queryFn: () => cvisionFetch('/api/cvision/attendance', { params: { action: 'monthly-summary', employeeId: selectedEmployee, month: selectedMonth, year: selectedYear } }),
    enabled: !!selectedEmployee,
  });
  const monthlySummary: MonthlySummary | null = summaryRaw?.data?.summary ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (bulkMode) {
        // Bulk entry for entire month
        const daysInMonth = new Date(bulkYear, bulkMonth, 0).getDate();
        let successCount = 0;
        let errorCount = 0;

        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(bulkYear, bulkMonth - 1, day);
          const dayOfWeek = currentDate.getDay();

          // Skip Friday and Saturday (weekend)
          if (dayOfWeek === 5 || dayOfWeek === 6) continue;

          // Skip future dates
          if (currentDate > new Date()) continue;

          const dateStr = currentDate.toISOString().split("T")[0];
          const checkOut = calculateCheckOut(formData.actualIn, workingHours);
          const schedIn = formData.actualIn || "08:00";
          const schedOut = calculateCheckOut(schedIn, workingHours);

          try {
            const res = await fetch("/api/cvision/attendance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: 'include',
              body: JSON.stringify({
                employeeId: formData.employeeId,
                date: dateStr,
                actualIn: `${dateStr}T${formData.actualIn}:00`,
                actualOut: `${dateStr}T${checkOut}:00`,
                scheduledIn: schedIn,
                scheduledOut: schedOut,
                workingHours,
                notes: formData.notes || "Bulk entry",
              }),
            });

            const data = await res.json();
            if (data.success) {
              successCount++;
            } else {
              errorCount++;
            }
          } catch {
            errorCount++;
          }
        }

        if (successCount > 0) {
          toast.success(tr(`تم تسجيل ${successCount} يوم بنجاح`, `Successfully recorded ${successCount} days`));
          setIsDialogOpen(false);
          refetchAttendance();
          setFormData({
            employeeId: "",
            date: new Date().toISOString().split("T")[0],
            actualIn: "",
            actualOut: "",
            notes: "",
          });
          setBulkMode(false);
          setManualCheckOut(false);
        }
        if (errorCount > 0) {
          toast.error(tr(`فشل تسجيل ${errorCount} يوم`, `Failed to record ${errorCount} days`));
        }
      } else {
        // Single day entry
        const dateStr = formData.date;
        // Calculate scheduled times based on working hours
        const schedIn = formData.actualIn || "08:00";
        const schedOut = calculateCheckOut(schedIn, workingHours);
        const res = await fetch("/api/cvision/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: 'include',
          body: JSON.stringify({
            ...formData,
            actualIn: formData.actualIn ? `${dateStr}T${formData.actualIn}:00` : undefined,
            actualOut: formData.actualOut ? `${dateStr}T${formData.actualOut}:00` : undefined,
            scheduledIn: schedIn,
            scheduledOut: schedOut,
            workingHours,
          }),
        });

        const data = await res.json();

        if (data.success) {
          toast.success(data.message || "Attendance recorded successfully");
          setIsDialogOpen(false);
          refetchAttendance();
          setFormData({
            employeeId: "",
            date: new Date().toISOString().split("T")[0],
            actualIn: "",
            actualOut: "",
            notes: "",
          });
          setManualCheckOut(false);
        } else {
          toast.error(data.error || "Error recording attendance");
        }
      }
    } catch (error) {
      toast.error(tr("خطأ في الاتصال", "Connection error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickCheckIn = async (employeeId: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const now = new Date();
      const res = await fetch("/api/cvision/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          employeeId,
          date: now.toISOString().split("T")[0],
          actualIn: now.toISOString(),
        }),
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (data.success) {
        toast.success(tr("تم تسجيل الدخول", "Check-in recorded"));
        refetchAttendance();
      } else {
        toast.error(data.error);
      }
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        toast.error(tr("انتهت مهلة الطلب", "Request timed out"));
        return;
      }
      toast.error(tr("خطأ في تسجيل الدخول", "Error recording check-in"));
    }
  };

  const handleQuickCheckOut = async (employeeId: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const now = new Date();
      const res = await fetch("/api/cvision/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          employeeId,
          date: now.toISOString().split("T")[0],
          actualOut: now.toISOString(),
        }),
      });
      clearTimeout(timeout);

      const data = await res.json();

      if (data.success) {
        toast.success(tr("تم تسجيل الخروج", "Check-out recorded"));
        refetchAttendance();
      } else {
        toast.error(data.error);
      }
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        toast.error(tr("انتهت مهلة الطلب", "Request timed out"));
        return;
      }
      toast.error(tr("خطأ في تسجيل الخروج", "Error recording check-out"));
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US");
  };

  const formatMinutes = (minutes: number) => {
    if (minutes === 0) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  // Filter employees by department and search query
  const filteredEmployees = employees.filter((emp) => {
    const matchesDepartment = !selectedDepartment || emp.departmentId === selectedDepartment;
    const matchesSearch = !searchQuery ||
      emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDepartment && matchesSearch;
  });

  const todayStats = {
    present: records.filter(r =>
      r.date === new Date().toISOString().split("T")[0] &&
      ["PRESENT", "LATE", "EARLY_LEAVE"].includes(r.status)
    ).length,
    absent: records.filter(r =>
      r.date === new Date().toISOString().split("T")[0] &&
      r.status === "ABSENT"
    ).length,
    late: records.filter(r =>
      r.date === new Date().toISOString().split("T")[0] &&
      r.status === "LATE"
    ).length,
  };

  const months = [
    tr("يناير", "January"), tr("فبراير", "February"), tr("مارس", "March"),
    tr("أبريل", "April"), tr("مايو", "May"), tr("يونيو", "June"),
    tr("يوليو", "July"), tr("أغسطس", "August"), tr("سبتمبر", "September"),
    tr("أكتوبر", "October"), tr("نوفمبر", "November"), tr("ديسمبر", "December"),
  ];

  if (loading && records.length === 0) {
    return (
      <CVisionPageLayout style={{ padding: 24 }}>
        <CVisionSkeletonStyles />
        <CVisionSkeletonCard C={C} height={260} />
      </CVisionPageLayout>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
    <CVisionPageLayout style={{ padding: 24 }}>
      {/* Header */}
      <CVisionPageHeader C={C} title={tr("الحضور", "Attendance")} titleEn="Attendance" icon={Clock} isRTL={isRTL}
        actions={activeTab === "records" ? (
          <CVisionButton C={C} isDark={isDark} icon={<Plus size={14} />} onClick={() => setIsDialogOpen(true)}>
            {tr("تسجيل الحضور", "Record Attendance")}
          </CVisionButton>
        ) : undefined}
      />

      {/* Record Attendance Dialog */}
      <CVisionDialog C={C} open={isDialogOpen} onClose={() => setIsDialogOpen(false)} title={tr("تسجيل الحضور", "Record Attendance")} isRTL={isRTL} isDark={isDark} width={520}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Employee Selection */}
              <CVisionSelect C={C} label={tr("الموظف *", "Employee *")}
                value={formData.employeeId || ""}
                onChange={(value) => setFormData({ ...formData, employeeId: value })}
                placeholder={tr("اختر موظفاً", "Select employee")}
                options={employees.filter((emp) => emp.id && emp.id.trim() !== '').map((emp) => ({
                  value: emp.id,
                  label: `${emp.name}${emp.employeeNo ? ` (${emp.employeeNo})` : ''}`,
                }))}
              />

              {/* Bulk Mode Option */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: C.bgSubtle, borderRadius: 10, cursor: 'pointer', fontSize: 13, color: C.text }}>
                <input type="checkbox" checked={bulkMode} onChange={(e) => setBulkMode(e.target.checked)} style={{ accentColor: C.gold }} />
                {tr("تسجيل الحضور لشهر كامل (أيام العمل فقط)", "Record attendance for entire month (working days only)")}
              </label>

              {bulkMode ? (
                /* Bulk Entry Interface */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <CVisionSelect C={C} label={tr("الشهر", "Month")}
                      value={bulkMonth.toString()}
                      onChange={(value) => setBulkMonth(parseInt(value))}
                      options={months.map((month, i) => ({ value: (i + 1).toString(), label: month }))}
                    />
                    <CVisionSelect C={C} label={tr("السنة", "Year")}
                      value={bulkYear.toString()}
                      onChange={(value) => setBulkYear(parseInt(value))}
                      options={[2024, 2025, 2026].map((year) => ({ value: year.toString(), label: year.toString() }))}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <CVisionInput C={C} label={tr("وقت الدخول *", "Check-in Time *")} type="time" value={formData.actualIn} onChange={(e) => setFormData({ ...formData, actualIn: e.target.value })} required />
                    <CVisionSelect C={C} label={tr("ساعات العمل", "Working Hours")}
                      value={workingHours.toString()}
                      onChange={(value) => setWorkingHours(parseInt(value))}
                      options={[6,7,8,9,10,12].map(h => ({ value: h.toString(), label: tr(`${h} ساعات`, `${h} hours`) }))}
                    />
                  </div>

                  {formData.actualIn && (
                    <div style={{ padding: 12, background: C.greenDim, borderRadius: 10, fontSize: 13, color: C.green }}>
                      <p>{tr("وقت الخروج التلقائي:", "Auto Check-out Time:")} <strong>{calculateCheckOut(formData.actualIn, workingHours)}</strong></p>
                      <p style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>{tr("سيتم تسجيل أيام العمل فقط (الأحد-الخميس)، الجمعة والسبت مستثنيان", "Only working days (Sun-Thu) will be recorded, Fri & Sat are skipped")}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* Single Day Interface */
                <>
                  <CVisionInput C={C} label={tr("التاريخ *", "Date *")} type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <CVisionInput C={C} label={tr("وقت الدخول", "Check-in Time")} type="time" value={formData.actualIn} onChange={(e) => setFormData({ ...formData, actualIn: e.target.value })} />
                    <CVisionInput C={C} label={`${tr("وقت الخروج", "Check-out Time")} ${!manualCheckOut && formData.actualOut ? tr("(تلقائي)", "(auto)") : ""}`} type="time" value={formData.actualOut} onChange={(e) => { setManualCheckOut(true); setFormData({ ...formData, actualOut: e.target.value }); }} />
                  </div>

                  <CVisionSelect C={C} label={tr("ساعات العمل", "Working Hours")}
                    value={workingHours.toString()}
                    onChange={(value) => setWorkingHours(parseInt(value))}
                    options={[6,7,8,9,10,12].map(h => ({ value: h.toString(), label: tr(`${h} ساعات`, `${h} hours`) }))}
                  />
                </>
              )}

              <CVisionInput C={C} label={tr("ملاحظات", "Notes")} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder={tr("ملاحظات اختيارية...", "Optional notes...")} />

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <CVisionButton C={C} isDark={isDark} variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  {tr("إلغاء", "Cancel")}
                </CVisionButton>
                <CVisionButton C={C} isDark={isDark} type="submit" disabled={isSaving || !formData.employeeId}>
                  {isSaving ? tr("جاري الحفظ...", "Saving...") : bulkMode ? tr("تسجيل الشهر", "Record Month") : tr("حفظ", "Save")}
                </CVisionButton>
              </div>
            </form>
      </CVisionDialog>

      {/* Tabs */}
      <CVisionTabs C={C} isRTL={isRTL} activeTab={activeTab} onChange={setActiveTab} tabs={[
        { id: 'records', label: tr('السجلات', 'Records'), icon: Clock },
        { id: 'calendar', label: tr('التقويم', 'Calendar'), icon: CalendarDays },
        { id: 'corrections', label: tr('التصحيحات', 'Corrections'), icon: FileEdit },
        { id: 'geofences', label: tr('المناطق الجغرافية', 'Geofences'), icon: MapPin },
        { id: 'absenteeism', label: tr('الغياب', 'Absenteeism'), icon: BarChart3 },
      ]} style={{ marginTop: 16 }}>

        <CVisionTabContent tabId="records">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>

      {/* Stats Cards */}
      <CVisionStatsRow>
        <CVisionMiniStat C={C} label={tr("الحاضرون اليوم", "Present Today")} value={todayStats.present} icon={UserCheck} color={C.green} />
        <CVisionMiniStat C={C} label={tr("الغائبون اليوم", "Absent Today")} value={todayStats.absent} icon={UserX} color={C.red} />
        <CVisionMiniStat C={C} label={tr("المتأخرون اليوم", "Late Today")} value={todayStats.late} icon={AlertTriangle} color={C.orange} />
        <CVisionMiniStat C={C} label={tr("إجمالي السجلات", "Total Records")} value={records.length} icon={Calendar} color={C.textMuted} />
      </CVisionStatsRow>

      {/* Filters */}
      <CVisionCard C={C}>
        <CVisionCardBody>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <CVisionInput C={C} label={tr("بحث", "Search")} icon={<Search size={14} />}
              placeholder={tr("بحث بالرقم أو الاسم...", "Search by ID or name...")}
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: 192 }}
            />

            <CVisionSelect C={C} label={tr("القسم", "Department")}
              value={selectedDepartment || "all"}
              onChange={(value) => setSelectedDepartment(value === "all" ? "" : value)}
              placeholder={tr("جميع الأقسام", "All Departments")}
              options={[
                { value: 'all', label: tr("جميع الأقسام", "All Departments") },
                ...departments.map((dept) => ({ value: dept.id, label: dept.name })),
              ]}
              style={{ width: 192 }}
            />

            <CVisionSelect C={C} label={tr("الشهر", "Month")}
              value={selectedMonth.toString()}
              onChange={(value) => setSelectedMonth(parseInt(value))}
              options={months.map((month, i) => ({ value: (i + 1).toString(), label: month }))}
              style={{ width: 144 }}
            />

            <CVisionSelect C={C} label={tr("السنة", "Year")}
              value={selectedYear.toString()}
              onChange={(value) => setSelectedYear(parseInt(value))}
              options={[2024, 2025, 2026].map((year) => ({ value: year.toString(), label: year.toString() }))}
              style={{ width: 112 }}
            />

            <CVisionSelect C={C} label={tr("الموظف", "Employee")}
              value={selectedEmployee || "all"}
              onChange={(value) => setSelectedEmployee(value === "all" ? "" : value)}
              placeholder={tr("جميع الموظفين", "All Employees")}
              options={[
                { value: 'all', label: tr("جميع الموظفين", "All Employees") },
                ...filteredEmployees.filter((emp) => emp.id && emp.id.trim() !== '').map((emp) => ({ value: emp.id, label: emp.name || emp.id })),
              ]}
              style={{ width: 192 }}
            />

            <CVisionButton C={C} isDark={isDark} variant="outline" icon={<RefreshCw size={14} />} onClick={() => refetchAttendance()}>
              {tr("تحديث", "Refresh")}
            </CVisionButton>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Monthly Summary */}
      {selectedEmployee && monthlySummary && (
        <CVisionCard C={C} style={{ borderColor: C.blue + '40' }}>
          <CVisionCardHeader C={C}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.blue }}>{tr("الملخص الشهري", "Monthly Summary")}</span>
          </CVisionCardHeader>
          <CVisionCardBody>
            <CVisionStatsRow>
              <CVisionMiniStat C={C} label={tr("أيام الحضور", "Present Days")} value={monthlySummary.presentDays} color={C.green} />
              <CVisionMiniStat C={C} label={tr("أيام الغياب", "Absent Days")} value={monthlySummary.absentDays} color={C.red} />
              <CVisionMiniStat C={C} label={tr("أيام التأخر", "Late Days")} value={monthlySummary.lateDays} color={C.orange} />
              <CVisionMiniStat C={C} label={tr("إجمالي التأخر", "Total Late")} value={formatMinutes(monthlySummary.totalLateMinutes)} color={C.orange} />
              <CVisionMiniStat C={C} label={tr("نسبة الحضور", "Attendance Rate")} value={`${monthlySummary.attendancePercentage}%`} color={C.blue} />
            </CVisionStatsRow>
          </CVisionCardBody>
        </CVisionCard>
      )}

      {/* Attendance Methods */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: C.text }}>
            <Timer size={18} /> {tr("طرق تسجيل الحضور", "Attendance Methods")}
          </span>
        </CVisionCardHeader>
        <CVisionCardBody>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <a href="/cvision/attendance/scan" style={{ textDecoration: 'none' }}>
              <CVisionCard C={C}>
                <CVisionCardBody style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ padding: 10, background: C.blueDim, borderRadius: 10 }}><Search size={20} color={C.blue} /></div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{tr("ماسح الباركود / رمز QR", "Barcode / QR Scanner")}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{tr("مسح بطاقات الموظفين", "Scan employee badges")}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted }}>{tr("استخدم ماسح USB أو الكاميرا لرموز QR", "Use USB barcode scanner or camera for QR codes")}</p>
                </CVisionCardBody>
              </CVisionCard>
            </a>

            <a href="/cvision/attendance/devices" style={{ textDecoration: 'none' }}>
              <CVisionCard C={C}>
                <CVisionCardBody style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ padding: 10, background: C.greenDim, borderRadius: 10 }}><Timer size={20} color={C.green} /></div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{tr("الأجهزة البيومترية", "Biometric Devices")}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{tr("بصمة الإصبع والوجه", "Fingerprint & Face ID")}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted }}>{tr("إعداد أجهزة ZKTeco والأجهزة البيومترية الأخرى", "Configure ZKTeco and other biometric devices")}</p>
                </CVisionCardBody>
              </CVisionCard>
            </a>

            <CVisionCard C={C} onClick={() => setIsDialogOpen(true)}>
              <CVisionCardBody style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ padding: 10, background: C.orangeDim, borderRadius: 10 }}><Plus size={20} color={C.orange} /></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.text }}>{tr("الإدخال اليدوي", "Manual Entry")}</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{tr("تسجيل الحضور يدوياً", "Record attendance manually")}</div>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: C.textMuted }}>{tr("للإدخال الجماعي والتصحيحات", "For bulk entries and corrections")}</p>
              </CVisionCardBody>
            </CVisionCard>
          </div>
        </CVisionCardBody>
      </CVisionCard>

      {/* Records Table */}
      <CVisionCard C={C}>
        <CVisionCardHeader C={C}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{tr("سجلات الحضور", "Attendance Records")}</span>
        </CVisionCardHeader>
        <CVisionCardBody style={{ padding: 0 }}>
          <CVisionTable C={C}>
            <CVisionTableHead C={C}>
              <CVisionTh C={C}>{tr("التاريخ", "Date")}</CVisionTh>
              <CVisionTh C={C}>{tr("الموظف", "Employee")}</CVisionTh>
              <CVisionTh C={C}>{tr("الحالة", "Status")}</CVisionTh>
              <CVisionTh C={C}>{tr("تسجيل الدخول", "Check-in")}</CVisionTh>
              <CVisionTh C={C}>{tr("تسجيل الخروج", "Check-out")}</CVisionTh>
              <CVisionTh C={C}>{tr("التأخر", "Late")}</CVisionTh>
              <CVisionTh C={C}>{tr("الخروج المبكر", "Early Leave")}</CVisionTh>
              <CVisionTh C={C}>{tr("الإضافي", "Overtime")}</CVisionTh>
              <CVisionTh C={C}>{tr("ساعات العمل", "Hours Worked")}</CVisionTh>
            </CVisionTableHead>
            <CVisionTableBody>
              {records.length === 0 ? (
                <CVisionTr C={C}>
                  <CVisionTd colSpan={9} align="center" style={{ paddingTop: 32, paddingBottom: 32 }}>
                    <Clock size={40} color={C.textMuted} style={{ margin: '0 auto 8px' }} />
                    <p style={{ color: C.textMuted }}>{tr("لا توجد سجلات", "No records found")}</p>
                  </CVisionTd>
                </CVisionTr>
              ) : (
                records.map((record) => {
                  const hrs = Math.floor(record.workedMinutes / 60);
                  const mins = record.workedMinutes % 60;
                  const workedDisplay = record.workedMinutes > 0
                    ? mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
                    : "-";

                  const statusVariantMap: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'muted'> = {
                    PRESENT: 'success', ABSENT: 'danger', LATE: 'warning', EARLY_LEAVE: 'warning',
                    ON_LEAVE: 'info', HOLIDAY: 'purple', REMOTE: 'info', INCOMPLETE: 'muted',
                  };

                  return (
                  <CVisionTr C={C} key={record.id}>
                    <CVisionTd style={{ color: C.text }}>{formatDate(record.date)}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{record.employeeName || "-"}</CVisionTd>
                    <CVisionTd>
                      <CVisionBadge C={C} variant={statusVariantMap[record.status] || 'muted'}>
                        {statusLabels[record.status] || record.status}
                      </CVisionBadge>
                    </CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{formatTime(record.actualIn)}</CVisionTd>
                    <CVisionTd style={{ color: C.text }}>{formatTime(record.actualOut)}</CVisionTd>
                    <CVisionTd style={{ color: record.lateMinutes > 0 ? C.red : C.text, fontWeight: record.lateMinutes > 0 ? 500 : 400 }}>
                      {formatMinutes(record.lateMinutes)}
                    </CVisionTd>
                    <CVisionTd style={{ color: record.earlyLeaveMinutes > 0 ? C.orange : C.text, fontWeight: record.earlyLeaveMinutes > 0 ? 500 : 400 }}>
                      {record.earlyLeaveMinutes > 0 ? formatMinutes(record.earlyLeaveMinutes) : "-"}
                    </CVisionTd>
                    <CVisionTd style={{ color: record.overtimeMinutes > 0 ? C.green : C.text, fontWeight: record.overtimeMinutes > 0 ? 500 : 400 }}>
                      {formatMinutes(record.overtimeMinutes)}
                    </CVisionTd>
                    <CVisionTd style={{ color: C.text, fontWeight: 500 }}>
                      {workedDisplay}
                    </CVisionTd>
                  </CVisionTr>
                  );
                })
              )}
            </CVisionTableBody>
          </CVisionTable>
        </CVisionCardBody>
      </CVisionCard>

          </div>
        </CVisionTabContent>

        <CVisionTabContent tabId="calendar">
          <div style={{ marginTop: 16 }}><AttendanceCalendar /></div>
        </CVisionTabContent>

        <CVisionTabContent tabId="corrections">
          <div style={{ marginTop: 16 }}><CorrectionQueue /></div>
        </CVisionTabContent>

        <CVisionTabContent tabId="geofences">
          <div style={{ marginTop: 16 }}><GeofenceManager /></div>
        </CVisionTabContent>

        <CVisionTabContent tabId="absenteeism">
          <div style={{ marginTop: 16 }}><AbsenteeismReport /></div>
        </CVisionTabContent>

      </CVisionTabs>
    </CVisionPageLayout>
    </div>
  );
}
