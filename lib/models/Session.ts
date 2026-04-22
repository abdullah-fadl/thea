export interface Session {
  userId: string;
  tenantId?: string; // User's identity tenant (from user.tenantId) - kept for backward compatibility
  activeTenantId?: string; // SINGLE SOURCE OF TRUTH: Currently active tenant for this session (selected at login)
  sessionId: string; // UUID
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
  // Enhanced security fields (optional for backward compatibility)
  idleExpiresAt?: Date; // Idle timeout expiration
  absoluteExpiresAt?: Date; // Absolute maximum lifetime
  lastActivityAt?: Date; // Last activity timestamp
}

