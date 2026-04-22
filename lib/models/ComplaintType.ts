export interface ComplaintType {
  id: string;
  // Canonical English key
  key: string; // e.g., "COMPLAINT_NURSING", "PRAISE_MAINTENANCE"
  // Relationship key
  domainKey: string; // e.g., "NURSING", "MAINTENANCE"
  // Bilingual labels (snake_case)
  label_en: string;
  label_ar: string;
  // Default severity for this type
  defaultSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface PraiseCategory {
  id: string;
  // Canonical English key
  key: string; // e.g., "PRAISE_GENERAL", "PRAISE_SPECIFIC"
  // Bilingual labels (snake_case)
  label_en: string;
  label_ar: string;
  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface SLARule {
  id: string;
  // Severity level
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  // Response time in minutes
  minutes: number;
  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Legacy interface for backward compatibility
export interface NursingComplaintType {
  id: string;
  type: 'call_bell' | 'nursing_error' | 'delay' | 'attitude' | 'medication' | 'other';
  typeKey: 'CALL_BELL' | 'NURSING_ERROR' | 'DELAY' | 'ATTITUDE' | 'MEDICATION' | 'OTHER';
  name: string;
  // Relationship to parent ComplaintType
  complaintTypeKey?: string; // Key of the parent ComplaintType (e.g., "COMPLAINT_NURSING")
  // Bilingual labels (snake_case)
  label_en: string;
  label_ar: string;
  // Soft delete
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}
