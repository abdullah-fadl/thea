/**
 * POST /api/owner/change-password
 * Change password for the owner user (no tenant required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/core/owner/separation';
import { prisma } from '@/lib/db/prisma';
import { comparePassword, hashPassword } from '@/lib/auth';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const authResult = await requireOwner(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'currentPassword and newPassword are required' },
      { status: 400 }
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters' },
      { status: 400 }
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: 'New password must be different from current password' },
      { status: 400 }
    );
  }

  // Fetch owner user
  const user = await prisma.user.findFirst({
    where: { id: authResult.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify current password
  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) {
    return NextResponse.json(
      { error: 'Current password is incorrect', errorCode: 'invalid_current_password' },
      { status: 400 }
    );
  }

  // Hash and update
  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed },
  });

  logger.info('Owner password changed', { category: 'auth', userId: user.id });

  return NextResponse.json({ ok: true });
});
