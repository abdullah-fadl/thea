export type EmploymentType = 'Full-Time' | 'Part-Time';
export type DayOfWeek = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type RoomType = 'Clinic' | 'VS' | 'Procedure';

export interface DoctorScheduleSlot {
  day: DayOfWeek;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  clinicId: string;
  roomNumber?: string;
}

export interface AssignedRoom {
  roomId: string;
  roomName: string;
  roomNumber: string;
  roomType: RoomType;
  isPrimary: boolean;
  applicableDays?: DayOfWeek[]; // If empty, applies to all days
}

export interface AssignedNurse {
  nurseId: string;
  nurseName: string;
  nurseEmployeeId: string;
  position: string;
  role: 'Primary' | 'Secondary' | 'Assistant' | 'Procedure Support';
  allocationRule: 'Always' | 'Selected Days' | 'Time Blocks';
  applicableDays?: DayOfWeek[];
  timeBlocks?: { day: DayOfWeek; startTime: string; endTime: string }[];
}

export interface Doctor {
  id: string;
  name: string;
  employeeId: string;
  employmentType: EmploymentType;
  primaryDepartmentId: string;
  primaryClinicId: string;
  
  // Weekly schedule
  weeklySchedule: DoctorScheduleSlot[];
  
  // Doctor-specific overrides
  assignedRooms: AssignedRoom[];
  assignedNurses: AssignedNurse[];
  
  // Status
  isActive: boolean;
  transferDate?: Date;
  exitDate?: Date;
  
  // Monthly indicators
  monthlyUtilization?: number; // Percentage
  weeklyChangeIndicator?: boolean; // True if schedule changed from previous week
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
