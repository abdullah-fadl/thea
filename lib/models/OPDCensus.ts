export interface OPDCensus {
  id: string;
  date: Date;
  clinicId: string;
  departmentId: string;
  doctorId?: string;
  patientCount: number;
  newPatients: number;
  followUpPatients: number;
  scheduledTime?: string;
  actualTime?: string;
  utilizationRate?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}
