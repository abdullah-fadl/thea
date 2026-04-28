import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth';
import { validateBody } from '@/lib/validation/helpers';
import { resetPasswordSchema } from '@/lib/validation/auth.schema';
import { validatePassword } from '@/lib/security/passwordPolicy';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

/**
 * Reset password endpoint
 *
 * POST /api/auth/reset-password
 *
 * Validates the reset token, updates the password, clears reset fields,
 * and invalidates all existing sessions for the user.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, resetPasswordSchema);
  if ('error' in v) return v.error;

  const { token, newPassword } = v.data;

  // Hash the incoming token with SHA-256 to compare against stored hash
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Find user with matching token hash AND non-expired
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpires: { gt: new Date() },
      isActive: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or expired reset token' },
      { status: 400 },
    );
  }

  // Validate password against policy
  const policyResult = validatePassword(newPassword, { email: user.email || undefined });
  if (!policyResult.valid) {
    return NextResponse.json(
      { error: policyResult.errors[0]?.messageEn || 'Password does not meet requirements', errors: policyResult.errors },
      { status: 400 },
    );
  }

  // Hash the new password with bcrypt
  const hashedPassword = await hashPassword(newPassword);

  // Update user: set new password, clear reset token fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      passwordResetToken: null,
      passwordResetExpires: null,
      forcePasswordChange: false,
    },
  });

  // Invalidate all existing sessions for this user
  await prisma.session.deleteMany({
    where: { userId: user.id },
  });

  // Also clear the activeSessionId on the user record
  await prisma.user.update({
    where: { id: user.id },
    data: { activeSessionId: null },
  });

  await createAuditLog(
    'auth',
    user.id,
    'PASSWORD_RESET_COMPLETED',
    user.id,
    user.email || undefined,
    {},
    user.tenantId || undefined
  );

  logger.info('Password reset completed', {
    category: 'auth',
    userId: user.id,
    email: user.email,
  });

  return NextResponse.json({
    ok: true,
    message: 'Password has been reset successfully. Please log in with your new password.',
  });
});
