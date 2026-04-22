import { DayOfWeek } from './Doctor';

export type TaskType = 'Cover Doctor' | 'Procedure' | 'Laser' | 'VS' | 'Other';
export type CodeBlueRole = 'First Responder - Compressor' | 'Second Responder - Crash Cart/Airway/AED' | 'Medication Nurse' | 'Recorder';

export interface TaskBlock {
  taskType: TaskType;
  doctorId?: string; // If taskType is 'Cover Doctor'
  doctorName?: string;
  roomId?: string;
  roomName?: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  notes?: string;
  isFullDoctorSchedule?: boolean; // If true, covers entire doctor schedule
}

export interface CodeBlueAssignment {
  role: CodeBlueRole;
  startTime: string;
  endTime: string;
}

export interface DailyAssignment {
  day: DayOfWeek;
  tasks: TaskBlock[];
  codeBlueRoles: CodeBlueAssignment[];
  totalHours: number; // Calculated
}

export interface NursingAssignment {
  id: string;
  nurseId: string;
  nurseName: string;
  nurseEmployeeId: string;
  nursePosition: string;
  departmentId: string;
  
  // Week identifier
  weekStartDate: Date; // Monday of the week
  weekEndDate: Date; // Sunday of the week
  weekNumber: number;
  year: number;
  
  // Daily assignments
  assignments: DailyAssignment[];
  
  // Weekly summary
  totalWeeklyHours: number;
  targetWeeklyHours: number;
  overtimeHours: number;
  undertimeHours: number;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
