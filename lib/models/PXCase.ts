export interface PXCase {
  id: string;
  
  // Link to visit
  visitId: string; // Reference to PatientExperience.id
  
  // Case status
  status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
  
  // Severity (copied from visit)
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  // Assignment
  assignedDeptKey?: string; // Department key (e.g., "DEPT_NURSING")
  assignedRole?: string; // Role (e.g., "NURSE", "MANAGER")
  assignedUserId?: string; // User ID if assigned to specific user
  
  // SLA tracking
  slaMinutes: number; // SLA time in minutes (from SLARule)
  dueAt: Date; // Calculated: createdAt + slaMinutes
  
  // Response tracking
  firstResponseAt?: Date; // When first response/action was taken
  resolvedAt?: Date; // When case was resolved
  
  // Resolution notes (bilingual)
  resolutionNotesOriginal?: string; // Original resolution text
  resolutionNotesLang?: 'ar' | 'en'; // Language of resolution notes
  resolutionNotesEn?: string; // English translation of resolution notes
  
  // Escalation
  escalationLevel: number; // 0 = no escalation, 1+ = escalation level
  
  // Tenant isolation
  tenantId: string;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}
