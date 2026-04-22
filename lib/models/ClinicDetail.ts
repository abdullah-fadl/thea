export interface ClinicDetail {
  id: string;
  clinicId: string; // References Clinic collection
  departmentId: string;
  hospitalId?: string;
  
  // Clinic infrastructure
  numberOfClinics: number;
  clinicNumbers: string[]; // e.g., ['C1', 'C2', 'C3']
  numberOfVSRooms: number;
  numberOfProcedureRooms: number;
  procedureRoomNames: string[];
  
  // Operating hours
  operatingHours: {
    startTime: string; // HH:MM
    endTime: string; // HH:MM
  };
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
