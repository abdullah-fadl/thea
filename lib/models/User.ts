import { Role } from '../rbac';

export interface User {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  role: Role;
  groupId: string; // Required - user must belong to exactly one group
  hospitalId?: string; // Optional - required for hospital-admin and staff roles, optional (null) for group-admin
  department?: string;
  staffId?: string; // Employee/Staff ID number
  employeeNo?: string; // HR Employee Number
  permissions?: string[]; // Array of permission keys (e.g., ['dashboard.view', 'opd.dashboard.view'])
  isActive: boolean;
  activeSessionId?: string; // Current active session ID (for single session enforcement)
  tenantId?: string; // Required for all non-owner users. Owner users have no tenantId (global access)
  
  // Platform access (optional - if not set, falls back to tenant entitlements)
  platformAccess?: {
    sam?: boolean;
    health?: boolean;
    edrac?: boolean;
    cvision?: boolean;
  };

  // Two-factor authentication (optional)
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: Array<{ hash: string; used: boolean }>;
  twoFactorEnabledAt?: Date;
  twoFactorPending?: {
    secret?: string;
    backupCodes?: Array<{ hash: string; used: boolean }>;
    createdAt?: Date;
  };
  
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface UserSession {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}
