import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { requireAuth } from '@/lib/auth/requireAuth';
import { requireRole } from '@/lib/auth/requireRole';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users/find?email=demo@tak.com
 * Find a user by email (admin only)
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    // Authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    // Authorization - only admin can search users
    const authorized = await requireRole(request, ['admin', 'thea-owner']);
    if (authorized instanceof NextResponse) {
      return authorized;
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        groupId: true,
        hospitalId: true,
        staffId: true,
        department: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        permissions: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', email },
        { status: 404 }
      );
    }

    // Get tenant info if tenantId exists
    let tenant = null;
    if (user.tenantId) {
      tenant = await prisma.tenant.findFirst({
        where: { id: user.tenantId },
        select: {
          tenantId: true,
          name: true,
          status: true,
          planType: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        groupId: user.groupId,
        hospitalId: user.hospitalId,
        staffId: user.staffId,
        department: user.department,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        permissions: user.permissions,
      },
      tenant: tenant ? {
        tenantId: tenant.tenantId,
        name: tenant.name,
        status: tenant.status,
        planType: tenant.planType,
      } : null,
    });
});
