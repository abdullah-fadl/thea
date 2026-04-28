import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/security/requireOwner';
import { prisma } from '@/lib/db/prisma';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/users
 * List all users in the system (owner only).
 * The owner account (thea-owner role) is excluded -- it is the system
 * foundation and must never be deleted, edited, or displayed as a
 * regular user.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get all users except owner accounts
    const users = await prisma.user.findMany({
      where: {
        NOT: { role: { in: ['thea-owner', 'THEA_OWNER', 'thea_owner'] } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build a tenantUuid->tenantName lookup for display purposes
    const tenantUuids = [...new Set(users.map(u => u.tenantId).filter(Boolean))] as string[];
    const tenantMap = new Map<string, string>();
    if (tenantUuids.length > 0) {
      try {
        const tenants = await prisma.tenant.findMany({
          where: { id: { in: tenantUuids } },
          select: { id: true, tenantId: true, name: true },
        });
        for (const t of tenants) {
          tenantMap.set(t.id, t.name || t.tenantId);
        }
      } catch {
        // Fallback: if lookup fails, UUID will be shown
      }
    }

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        tenantId: u.tenantId,
        tenantName: (u.tenantId && tenantMap.get(u.tenantId)) || u.tenantId || null,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    });
});
