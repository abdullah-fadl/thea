export type PatientMasterStatus = 'KNOWN' | 'UNKNOWN' | 'MERGED';
export type PatientMasterGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export interface PatientMaster {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nameNormalized: string;
  dob: Date | null;
  gender: PatientMasterGender;
  identifiers: {
    nationalId?: string | null;
    iqama?: string | null;
    passport?: string | null;
  };
  status: PatientMasterStatus;
  links?: Array<{
    system: 'ER' | 'IPD' | 'OPD';
    patientId: string;
    mrn?: string | null;
    tempMrn?: string | null;
  }>;
  mergedIntoPatientId?: string | null;
  mergedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId?: string;
  updatedByUserId?: string;
}
