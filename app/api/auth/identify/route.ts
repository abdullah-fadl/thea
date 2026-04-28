import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { User } from '@/lib/models/User';
import { normalizeRole } from '@/lib/auth/normalizeRole';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

const identifySchema = z.object({
  email: z.string().email(),
});

function getEmailCandidates(input: string): string[] {
  const normalized = input.trim().toLowerCase();
  return [normalized];
}

/**
 * POST /api/auth/identify
 * Identify user and return available tenants for login selection
 *
 * For owner roles: returns owner tenant
 * For normal users: returns tenant from user.tenantId (if exists)
 *
 * Returns: { email, tenants: [{ tenantId, name, status }] }
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { email } = identifySchema.parse(body);
    const emailCandidates = getEmailCandidates(email);

    // Search for user in PostgreSQL (single database)
    let user: User | null = null;
    let userTenantId: string | undefined = undefined;

    for (const candidate of emailCandidates) {
      const dbUser = await prisma.user.findFirst({
        where: {
          email: { equals: candidate, mode: 'insensitive' },
        },
      });
      if (dbUser) {
        user = {
          ...dbUser,
          role: normalizeRole(dbUser.role) as string,
          tenantId: dbUser.tenantId || undefined,
        } as unknown as User;

        // Resolve tenant key from tenant UUID
        if (dbUser.tenantId) {
          const tenant = await prisma.tenant.findFirst({
            where: { id: dbUser.tenantId },
            select: { tenantId: true },
          });
          userTenantId = tenant?.tenantId || undefined;
        }
        logger.info('Found user', { category: 'auth', email: dbUser.email, tenantId: userTenantId || 'none', isActive: dbUser.isActive });
        break;
      }
    }

    if (!user) {
      logger.info('User not found in database', { category: 'auth', email });
      // Don't reveal if user exists or not (security best practice)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (user.isActive === false) {
      logger.info('User found but is inactive', { category: 'auth', email });
      // Return same error as "not found" to prevent user enumeration
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Use the tenantId from found user or from search
    if (userTenantId && !user.tenantId) {
      user.tenantId = userTenantId;
    }

    logger.debug('User identified', { category: 'auth', email: user.email, role: user.role, tenantId: user.tenantId || 'none' });
    let availableTenants: Array<{ tenantId: string; name: string; status: string }> = [];

    // For owner roles: return ONLY Thea Owner Development Tenant
    if (user.role === 'thea-owner') {
      const ownerTenant = await prisma.tenant.findFirst({
        where: {
          tenantId: 'thea-owner-dev',
          status: 'ACTIVE',
        },
      });

      if (ownerTenant) {
        availableTenants = [{
          tenantId: ownerTenant.tenantId,
          name: ownerTenant.name || 'Thea Owner Development Tenant',
          status: ownerTenant.status.toLowerCase(),
        }];
      } else {
        // If owner tenant doesn't exist, allow owner to continue without tenant
        logger.warn('Owner tenant not found, allowing owner login without tenant', { category: 'auth' });
        availableTenants = [{
          tenantId: '__skip__',
          name: 'Owner (no tenant)',
          status: 'active',
        }];
      }
    } else {
      // For normal users: return their assigned tenant only
      if (user.tenantId) {
        // Try to find tenant by tenantId key or UUID
        const tenant = await prisma.tenant.findFirst({
          where: {
            OR: [
              { tenantId: user.tenantId },
              { id: user.tenantId },
            ],
          },
        });

        if (tenant) {
          const actualTenantId = tenant.tenantId || user.tenantId;
          if (actualTenantId && actualTenantId !== '') {
            availableTenants = [{
              tenantId: actualTenantId,
              name: tenant.name || actualTenantId,
              status: tenant.status.toLowerCase(),
            }];
          }
        } else {
          logger.warn('User has tenantId but tenant not found in database, returning fallback', { category: 'auth', email: user.email, tenantId: user.tenantId });
          availableTenants = [{
            tenantId: user.tenantId,
            name: user.tenantId,
            status: 'active',
          }];
        }
      } else {
        // User has no tenantId - try to find tenant by searching users in tenants
        logger.warn('User has no tenantId assigned', { category: 'auth', email: user.email, role: user.role });

        // Search all tenants to find which tenant this user belongs to
        const allTenants = await prisma.tenant.findMany({
          select: { id: true, tenantId: true, name: true, status: true },
        });

        for (const t of allTenants) {
          const tenantUser = await prisma.user.findFirst({
            where: {
              tenantId: t.id,
              OR: [
                { email: user.email },
                { id: user.id },
              ],
            },
          });

          if (tenantUser) {
            availableTenants = [{
              tenantId: t.tenantId,
              name: t.name || t.tenantId,
              status: t.status.toLowerCase(),
            }];
            logger.info('Found tenant for user by searching', { category: 'auth', tenantId: t.tenantId, email: user.email });
            break;
          }
        }

        // If still no tenant found, user needs tenantId assignment
        if (availableTenants.length === 0) {
          logger.warn('Cannot determine tenant for user, needs tenantId assignment', { category: 'auth', email: user.email });
        }
      }
    }

    // If no tenants found, return error
    if (availableTenants.length === 0) {
      return NextResponse.json(
        { error: 'No tenant assigned to this user' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      email: user.email,
      tenants: availableTenants,
      // If single tenant, include it for auto-selection
      ...(availableTenants.length === 1 && {
        selectedTenant: availableTenants[0],
      }),
    });
  } catch (error) {
    logger.error('Identify error', { category: 'auth', error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        // [SEC-10]
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
