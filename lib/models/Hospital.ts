/**
 * Hospital Model
 * 
 * Represents a hospital within a group in the hierarchical user management system.
 * Hospitals belong to exactly one group.
 */
export interface Hospital {
  id: string; // UUID
  name: string;
  code: string; // Unique code identifier within group
  groupId: string; // Reference to Group.id
  isActive: boolean;
  tenantId: string; // Always required - from session
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

