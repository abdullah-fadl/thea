export interface PatientRecord {
  id?: string;
  patientMasterId?: string;
  fullName?: string;
  displayName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  gender?: string;
  phone?: string;
  mobile?: string;
  mrn?: string;
  tempMrn?: string;
  nationalId?: string;
  iqama?: string;
  passport?: string;
  status?: string;
  department?: string;
  urgency?: string;
  insurance?: string;
  lastVisit?: string;
  nextAppointment?: string;
  diagnosis?: string;
  diagnosisAr?: string;
  tags?: string[];
  links?: {
    mrn?: string;
    tempMrn?: string;
  };
  identifiers?: {
    mrn?: string;
    tempMrn?: string;
    nationalId?: string;
    iqama?: string;
    passport?: string;
  };
}
