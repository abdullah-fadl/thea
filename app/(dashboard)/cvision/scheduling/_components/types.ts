import {
  Sun,
  Moon,
  Sunset,
  Home,
  Palmtree,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────

export type ShiftType = 'DAY' | 'NIGHT' | 'EVENING' | 'OFF' | 'LEAVE' | 'OVERTIME' | 'SPLIT';
export type ViewMode = 'weekly' | 'monthly';
export type StaffFilter = 'all' | 'unit' | 'borrowed';
export type AssignmentType = 'REGULAR' | 'LOAN' | 'TRAINING' | 'FLOAT';

export interface BorrowedEmployee {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  originalUnitId: string;
  originalUnitName: string;
  assignmentType: AssignmentType;
  startDate: string;
  endDate: string;
  hoursPerWeek?: number;
  reason?: string;
}

export interface EmployeeSchedule {
  employee: {
    id: string;
    name: string;
    employeeNo: string;
    departmentId?: string;
    unitId?: string;
    unitName?: string;
    unitCode?: string;
    nursingRole?: string;
    // Borrowed employee fields
    isBorrowed?: boolean;
    assignmentType?: AssignmentType;
    originalUnitName?: string;
    assignmentId?: string;
  };
  days: DayEntry[];
}

export interface UnitOption {
  id: string;
  name: string;
  nameAr?: string;
  code: string;
  departmentId?: string;
}

export type ApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';

export interface PendingApproval {
  id: string;
  scheduleId: string;
  unitId?: string;
  unitName?: string;
  startDate?: string;
  endDate?: string;
  status: ApprovalStatus;
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: string;
  approvedByName?: string;
  rejectedByName?: string;
  rejectionReason?: string;
}

export interface CurrentApprovalRecord {
  id: string;
  scheduleId: string;
  unitId?: string;
  unitName?: string;
  startDate?: string;
  endDate?: string;
  status: ApprovalStatus;
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  publishedBy?: string;
  publishedAt?: string;
}

export interface DayEntry {
  date: string;
  shiftType: ShiftType;
  shiftId?: string;
  entryId?: string;
  overtimeHours?: number;
  notes?: string;
  leaveRequestId?: string;
  leaveType?: string;
  isDefault?: boolean;
  splitGroupId?: string;
  splitSegmentIndex?: number;
  isSplitShift?: boolean;
  splitSegments?: DayEntry[]; // For grouped display: holds all segments
}

export interface ShiftDef {
  id: string;
  name: string;
  nameEn: string;
  code: ShiftType;
  color: string;
  icon: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  allowance?: number;
}

export interface ScheduleSummary {
  totalEmployees: number;
  shiftsCount: Record<ShiftType, number>;
  daysInPeriod: number;
}

export interface Department {
  id: string;
  name: string;
  nameEn?: string;
}

// ─── Shift Display Config ───────────────────────────────────────

export type ShiftIcon = typeof Sun;

export const SHIFT_CONFIG: Record<ShiftType, { label: string; color: string; bg: string; Icon: ShiftIcon }> = {
  DAY:      { label: 'Day',      color: 'text-green-700',  bg: 'bg-green-100 hover:bg-green-200 border-green-200', Icon: Sun },
  EVENING:  { label: 'Evening',  color: 'text-amber-700',  bg: 'bg-amber-100 hover:bg-amber-200 border-amber-200', Icon: Sunset },
  NIGHT:    { label: 'Night',    color: 'text-indigo-700', bg: 'bg-indigo-100 hover:bg-indigo-200 border-indigo-200', Icon: Moon },
  OFF:      { label: 'Off',      color: 'text-slate-500',  bg: 'bg-slate-100 hover:bg-slate-200 border-slate-200', Icon: Home },
  LEAVE:    { label: 'Leave',    color: 'text-pink-700',   bg: 'bg-pink-100 hover:bg-pink-200 border-pink-200', Icon: Palmtree },
  OVERTIME: { label: 'Overtime', color: 'text-red-700',    bg: 'bg-red-100 hover:bg-red-200 border-red-200', Icon: Clock },
  SPLIT:    { label: 'Split',    color: 'text-purple-700', bg: 'bg-purple-100 hover:bg-purple-200 border-purple-200', Icon: ArrowLeftRight },
};

export const DAY_NAMES = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Annual Leave' },
  { value: 'SICK', label: 'Sick Leave' },
  { value: 'EMERGENCY', label: 'Emergency Leave' },
  { value: 'UNPAID', label: 'Unpaid Leave' },
  { value: 'MATERNITY', label: 'Maternity Leave' },
  { value: 'PATERNITY', label: 'Paternity Leave' },
];

// Admin/HR roles that can approve/reject schedules
export const ADMIN_ROLES = ['admin', 'hr-admin', 'hr-manager', 'super-admin', 'owner', 'thea-owner'];

// ─── Work Settings Type ─────────────────────────────────────────

export interface WorkSettingsData {
  workDays: number[];
  restDays: number[];
  defaultStartTime: string;
  defaultEndTime: string;
  defaultWorkingHours: number;
  breakDurationMinutes: number;
  graceMinutes: number;
  splitShiftEnabled: boolean;
  splitShiftSegments: { label: string; startTime: string; endTime: string }[];
}

export interface DeptEmployee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  unitId?: string | null;
  nursingRole?: string | null;
  hasCustomSchedule: boolean;
  workSchedule: any | null;
}

export interface EditingEmployeeWs {
  workDays: number[];
  restDays: number[];
  startTime: string;
  endTime: string;
  workingHours: number;
  breakDurationMinutes: number;
  graceMinutes: number;
  splitShiftEnabled: boolean;
  splitShiftSegments: { label: string; startTime: string; endTime: string }[];
}

export interface BulkWs {
  workDays: number[];
  restDays: number[];
  startTime: string;
  endTime: string;
  workingHours: number;
  breakDurationMinutes: number;
  graceMinutes: number;
  splitShiftEnabled: boolean;
  splitShiftSegments: { label: string; startTime: string; endTime: string }[];
}
