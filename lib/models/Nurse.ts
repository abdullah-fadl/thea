export type NursePosition = 'SN' | 'AN' | 'CA' | 'Midwife' | 'Team Leader' | 'Charge Nurse' | 'Other';
export type PerformanceRating = 'Excellent' | 'Good' | 'Satisfactory' | 'Needs Improvement';

export interface TransferHistory {
  fromDepartment?: string;
  fromHospital?: string;
  toDepartment?: string;
  toHospital?: string;
  transferDate: Date;
}

export interface Nurse {
  id: string;
  name: string;
  employeeId: string;
  position: NursePosition;
  departmentId: string;
  
  // HR Information
  hireDate: Date;
  lengthOfService?: number; // Calculated in years
  previousYearPerformance?: PerformanceRating;
  transferHistory: TransferHistory[];
  
  // Leadership
  isTeamLeader: boolean;
  isChargeNurse: boolean;
  
  // Status
  isActive: boolean;
  
  // Weekly hours
  targetWeeklyHours: number; // Default 40
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
