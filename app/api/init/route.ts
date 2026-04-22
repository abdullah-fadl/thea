import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth';
import { getDefaultPermissionsForRole } from '@/lib/permissions';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const POST = withErrorHandler(async () => {
  // [SEC-01] Block in production — this is a dev/staging bootstrap only
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    );
  }

  // Check if admin exists
  const existingAdmin = await prisma.user.findFirst({
    where: { email: 'admin@hospital.com' },
  });

  if (existingAdmin) {
    return NextResponse.json({ message: 'Admin user already exists' });
  }

  // [SEC-01] Use env-provided password or generate a random one — never hardcode
  const initPassword = process.env.INIT_ADMIN_PASSWORD || `init-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const hashedPassword = await hashPassword(initPassword);
  const adminPermissions = getDefaultPermissionsForRole('admin');

  await prisma.user.create({
    data: {
      email: 'admin@hospital.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      permissions: adminPermissions,
      isActive: true,
    },
  });

  // [SEC-01] Never return credentials in response — log to server console only
  logger.info('[INIT] Admin user created. Password was set from INIT_ADMIN_PASSWORD env or generated.', { category: 'auth' });

  return NextResponse.json({
    success: true,
    message: 'Database initialized. Check server logs for credentials.',
  });
});
