import { NextRequest, NextResponse } from 'next/server';
import { withTenantOwner } from '@/lib/core/guards/withTenantOwner';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

/**
 * POST /api/tenant-owner/hospitals/[hospitalId]/admins
 * Create a branch admin user for a specific hospital under the caller's tenant.
 *
 * Body: { email: string; firstName: string; lastName: string; password: string; role?: string }
 * Response: 201 { id, email, firstName, lastName, role, hospitalId, tenantId }
 */
export const POST = withTenantOwner(
  async (req, { tenantId, userId }, params) => {
    const hospitalId = String((params as Record<string, string>)?.hospitalId ?? '');
    if (!hospitalId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'hospitalId param missing' },
        { status: 400 },
      );
    }

    // Cross-tenant guard: hospital must belong to caller's tenant
    const hospital = await prisma.hospital.findFirst({
      where: { id: hospitalId, tenantId },
      select: { id: true },
    });
    if (!hospital) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Hospital not found in this tenant' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Request body required' },
        { status: 400 },
      );
    }

    const { email, firstName, lastName, password } = body;
    if (
      typeof email !== 'string' ||
      typeof firstName !== 'string' ||
      typeof lastName !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message:
            'email, firstName, lastName (strings) and password (≥8 chars) are required',
        },
        { status: 400 },
      );
    }

    // Branch admin role — tenant-owner can only assign admin-tier roles, not thea-owner
    const role =
      typeof body.role === 'string' &&
      ['admin', 'tenant-admin'].includes(body.role.toLowerCase())
        ? body.role.toLowerCase()
        : 'admin';

    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), tenantId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Conflict', message: 'A user with this email already exists in this tenant' },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        tenantId,
        hospitalId,
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: passwordHash,
        role,
        createdBy: userId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        hospitalId: true,
        tenantId: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  },
);
