export interface PatientExperience {
  id: string;
  
  // Staff Information
  staffName: string;
  staffId: string;
  
  // Patient Information
  patientName: string;
  patientFileNumber: string;
  
  // Canonical keys only (no Arabic strings in structured fields)
  floorKey: string; // e.g., "FLOOR_1"
  departmentKey: string; // e.g., "DEPT_NURSING"
  roomKey: string; // e.g., "ROOM_101"
  domainKey: string; // e.g., "NURSING", "MAINTENANCE"
  typeKey: string; // e.g., "COMPLAINT_NURSING", "PRAISE_MAINTENANCE"
  
  // Severity and status as English enums
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  
  // Free text details (bilingual)
  detailsOriginal: string; // Original text as entered
  detailsLang: 'ar' | 'en'; // Language of original text (detected or UI language)
  detailsEn: string; // English translation (for dashboard consistency)
  
  // Resolution fields (optional, for resolved cases)
  resolutionOriginal?: string; // Original resolution text as entered
  resolutionLang?: 'ar' | 'en'; // Language of resolution text
  resolutionEn?: string; // English translation of resolution
  
  // Optional fields
  complainedStaffName?: string;
  visitDate: Date;
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  
  // Backward compatibility fields (deprecated, kept for migration)
  floor?: string;
  department?: string;
  departmentId?: string;
  room?: string;
  complaintType?: string;
  category?: string;
  categoryKey?: string;
  nursingComplaintType?: string;
  nursingTypeKey?: string;
  statusKey?: string;
}
