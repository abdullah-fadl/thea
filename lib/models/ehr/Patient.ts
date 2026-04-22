/**
 * Patient Entity
 * Core patient demographic and medical information
 */
export interface Patient {
  id: string; // UUID
  
  // Demographic Information
  medicalRecordNumber: string; // MRN - unique identifier
  nationalId?: string; // National ID/IQAMA
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: Date;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  
  // Contact Information
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  
  // Medical Information
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  
  // Insurance
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: Date;
  
  // Status
  isActive: boolean;
  isDeceased: boolean;
  deceasedDate?: Date;
  
  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // User ID
  updatedBy?: string; // User ID
}
