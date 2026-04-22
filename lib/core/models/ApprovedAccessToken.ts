/**
 * Approved Access Token Model
 * 
 * Allows Thea Owner to access tenant data temporarily with tenant admin approval.
 * - Time-limited access
 * - Tenant-admin approved
 * - Fully audited
 */

export interface ApprovedAccessToken {
  id: string; // UUID
  ownerId: string; // Thea Owner user ID
  ownerEmail: string; // Thea Owner email (for display)
  tenantId: string; // Tenant ID to access
  tenantName?: string; // Tenant name (for display)
  
  // Approval details
  requestedAt: Date; // When owner requested access
  approvedAt?: Date; // When tenant admin approved
  approvedBy?: string; // Tenant admin user ID who approved
  approvedByEmail?: string; // Tenant admin email (for display)
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'revoked';
  
  // Access details
  expiresAt: Date; // When access expires
  accessToken?: string; // JWT token for approved access (generated after approval)
  refreshToken?: string; // Refresh token (if needed)
  
  // Scope of access
  allowedPlatforms: {
    sam?: boolean;
    health?: boolean;
    edrac?: boolean;
    cvision?: boolean;
  };
  allowedActions: string[]; // e.g., ['view', 'export'] - no modifications allowed
  
  // Request details
  reason?: string; // Why owner needs access
  notes?: string; // Additional notes from tenant admin
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date; // Last time token was used
  usageCount: number; // How many times token was used
}

/**
 * Check if approved access token is valid and not expired
 */
export function isApprovedAccessTokenValid(token: ApprovedAccessToken): boolean {
  if (token.status !== 'approved') {
    return false;
  }
  
  const now = new Date();
  if (token.expiresAt < now) {
    return false;
  }
  
  return true;
}

/**
 * Check if approved access token allows access to a specific platform
 */
export function canAccessPlatform(
  token: ApprovedAccessToken,
  platform: 'sam' | 'health' | 'edrac' | 'cvision'
): boolean {
  if (!isApprovedAccessTokenValid(token)) {
    return false;
  }
  
  return token.allowedPlatforms[platform] === true;
}
