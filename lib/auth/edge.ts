/**
 * Edge Runtime compatible authentication functions
 * Only uses Web Crypto API compatible libraries (jose)
 *
 * JWT Key Rotation: Verifies against current secret first, then previous.
 */

import { jwtVerify } from 'jose';

// Edge runtime compatible: read env at function call time
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'supervisor' | 'staff' | 'viewer' | 'group-admin' | 'hospital-admin' | 'thea-owner'
    | 'THEA_OWNER' | 'ADMIN' | 'GROUP_ADMIN' | 'HOSPITAL_ADMIN' | 'SUPERVISOR' | 'STAFF' | 'VIEWER';
  sessionId?: string; // Session ID for single active session enforcement
  activeTenantId?: string; // Active tenant ID (selected at login) - for owner tenant check in Edge Runtime
  twoFactorVerified?: boolean; // Set to true after successful 2FA verification
  entitlements?: {
    sam: boolean;
    health: boolean;
    edrac: boolean;
    cvision: boolean;
    imdad: boolean;
  }; // Effective platform entitlements (computed at login)
}

/**
 * Edge Runtime compatible JWT verification
 * Supports key rotation: tries current secret, falls back to previous
 */
export async function verifyTokenEdge(token: string): Promise<TokenPayload | null> {
  // Try current secret first
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as TokenPayload;
  } catch {
    // If current fails and previous secret exists, try previous
    const prevSecret = process.env.JWT_SECRET_PREVIOUS;
    if (prevSecret) {
      try {
        const secret = new TextEncoder().encode(prevSecret);
        const { payload } = await jwtVerify(token, secret);
        return payload as unknown as TokenPayload;
      } catch {
        return null;
      }
    }
    return null;
  }
}
