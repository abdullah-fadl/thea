export interface OPDDailyData {
  id: string;
  date: Date; // Date of the data entry
  
  // Basic Information
  departmentId: string;
  doctorId: string;
  employmentType: 'FT' | 'PPT'; // Full-Time or Part-Time
  subspecialty: string;
  isPrimarySpecialty: boolean; // true = primary, false = secondary (subspecialty)
  
  // Rooms
  rooms: {
    roomId: string;
    roomName: string;
    roomNumber: string;
    departmentId: string; // Department of the room (may differ from doctor's department)
  }[];
  
  // Schedule
  slotsPerHour: 1 | 2 | 3 | 4 | 5 | 6; // Patients per hour
  clinicStartTime: string; // HH:MM
  clinicEndTime: string; // HH:MM
  
  // Patient Counts
  totalPatients: number;
  booked: number;
  walkIn: number;
  noShow: number;
  
  // Time Distribution
  timeDistribution: {
    '0-6': number;
    '6-7': number; // Dawn (الفجر)
    '7-8': number;
    '8-12': number;
    '12-16': number;
    '16-20': number;
    '20-24': number;
  };
  
  // Visit Types
  fv: number; // First Visit
  fcv: number; // First Consultation Visit
  fuv: number; // Follow-up Visit
  rv: number; // Return Visit
  
  // Procedures
  procedures: number;
  orSurgeries: number;
  admissions: number;
  
  // Specialty-specific (conditional)
  cath?: number; // Only for Cardiology doctors
  deliveriesNormal?: number; // Only for OB/GYN doctors
  deliveriesSC?: number; // Only for OB/GYN doctors (SC = Cesarean)
  ivf?: number; // Only for OB/GYN doctors
  
  // Tenant isolation
  tenantId: string; // ALWAYS from session
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}



