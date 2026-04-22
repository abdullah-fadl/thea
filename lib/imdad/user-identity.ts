/**
 * Imdad User Identity Resolver
 *
 * Fetches the authoritative user identity (name, role, hospital, department)
 * from the database, ensuring approval chains use canonical data rather
 * than client-supplied values.
 */

import { prisma } from '@/lib/db/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedIdentity {
  userId: string;
  fullName: string;
  role: string;
  hospitalId?: string;
  departmentId?: string;
  email?: string;
}

// ---------------------------------------------------------------------------
// IdentityError
// ---------------------------------------------------------------------------

export class IdentityError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(code: string, message: string, statusCode = 403) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
    this.statusCode = statusCode;
  }

  toResponse() {
    return {
      error: this.code,
      message: this.message,
    };
  }
}

// ---------------------------------------------------------------------------
// resolveIdentity
// ---------------------------------------------------------------------------

/**
 * Look up the canonical identity for the given userId + tenantId.
 * Throws IdentityError if the user cannot be found or is inactive.
 */
export async function resolveIdentity(
  userId: string,
  tenantId: string,
): Promise<ResolvedIdentity> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hospitalId: true,
      departmentId: true,
      isActive: true,
    } as any,
  });

  if (!user) {
    throw new IdentityError(
      'USER_NOT_FOUND',
      `User ${userId} not found in tenant ${tenantId}`,
      403,
    );
  }

  if (user.isActive === false) {
    throw new IdentityError(
      'USER_INACTIVE',
      `User ${userId} is deactivated`,
      403,
    );
  }

  return {
    userId: user.id,
    fullName: (user as any).name || user.email || userId,
    role: user.role || 'UNKNOWN',
    hospitalId: user.hospitalId || undefined,
    departmentId: (user as any).departmentId || undefined,
    email: user.email || undefined,
  };
}
