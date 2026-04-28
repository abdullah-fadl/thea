import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { comparePassword, hashPassword } from '@/lib/auth';
import { validatePassword, checkPasswordHistory, buildPasswordHistory, PasswordHistoryEntry } from '@/lib/security/passwordPolicy';
import { validateBody } from '@/lib/validation/helpers';
import { changePasswordSchema } from '@/lib/validation/auth.schema';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

/**
 * Change password endpoint
 *
 * POST /api/auth/change-password
 */
export const POST = withAuthTenant(async (req, { user, tenantId, userId }) => {
  try {
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const v = validateBody(body, changePasswordSchema);
    if ('error' in v) return v.error;
    const currentPassword = v.data.currentPassword || v.data.oldPassword;
    const { newPassword } = v.data;

    const passwordValidation = validatePassword(newPassword, { email: user?.email });
    if (!passwordValidation.valid) {
      return NextResponse.json(
        {
          error: 'Password policy violation',
          message: passwordValidation.errors[0]?.messageEn || 'Password does not meet requirements',
          errors: passwordValidation.errors,
        },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password', message: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Fetch user from database with tenant isolation
    const userDoc = await prisma.user.findFirst({
      where: { tenantId, id: userId },
    });

    if (!userDoc || !userDoc.isActive) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, userDoc.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect', message: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Check password history (last 5 passwords)
    const historyCheck = await checkPasswordHistory(
      newPassword,
      userDoc.passwordHistory as unknown as PasswordHistoryEntry[] | null,
      comparePassword,
    );
    if (historyCheck.reused) {
      return NextResponse.json(
        {
          error: 'Password policy violation',
          message: historyCheck.error?.messageEn || 'Cannot reuse recent passwords',
          errors: historyCheck.error ? [historyCheck.error] : [],
        },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    // Build updated password history
    const updatedHistory = buildPasswordHistory(
      userDoc.password,
      userDoc.passwordHistory as unknown as PasswordHistoryEntry[] | null,
    );

    // Update password in database
    await prisma.user.update({
      where: { id: userId! },
      data: {
        password: hashedNewPassword,
        passwordChangedAt: new Date(),
        passwordHistory: updatedHistory as unknown as Prisma.InputJsonValue,
        forcePasswordChange: false, // Clear forced change flag
      },
    });

    await createAuditLog('user', userId!, 'PASSWORD_CHANGE', userId || 'system', user?.email, {}, tenantId);

    // Password changed successfully — keep user logged in (don't destroy current session)
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Change password error', { category: 'auth', error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { tenantScoped: true, permissionKey: 'auth.change-password' });
