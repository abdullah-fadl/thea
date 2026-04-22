export type AuditAction = 
  | 'ASSIGNMENT_CHANGED'
  | 'STATUS_CHANGED'
  | 'NOTES_UPDATED'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'DELETED';

export interface PXCaseAudit {
  id: string;
  
  // Reference to case
  caseId: string; // Reference to PXCase.id
  
  // Actor (who made the change)
  actorUserId?: string; // User ID if available
  actorEmployeeId?: string; // Employee ID if available
  
  // Action type
  action: AuditAction;
  
  // Snapshot of changes
  before: {
    // Subset of case fields that changed
    status?: string;
    assignedDeptKey?: string;
    assignedRole?: string;
    assignedUserId?: string;
    resolutionNotesEn?: string;
    escalationLevel?: number;
    [key: string]: any; // Allow other fields
  };
  
  after: {
    // Subset of case fields after change
    status?: string;
    assignedDeptKey?: string;
    assignedRole?: string;
    assignedUserId?: string;
    resolutionNotesEn?: string;
    escalationLevel?: number;
    [key: string]: any; // Allow other fields
  };
  
  // Audit timestamp
  createdAt: Date;
}

