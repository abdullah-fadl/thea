/**
 * Group Model
 * 
 * Represents a group/organization in the hierarchical user management system.
 * Groups contain multiple hospitals.
 */
export interface Group {
  id: string; // UUID
  name: string;
  code: string; // Unique code identifier
  isActive: boolean;
  tenantId: string; // Always required - from session
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

