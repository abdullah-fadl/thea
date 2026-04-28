import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { forgotPasswordSchema } from '@/lib/validation/auth.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { sendPasswordResetEmail } from '@/lib/services/email';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';

/**
 * Forgot password endpoint
 *
 * POST /api/auth/forgot-password
 *
 * Generates a secure reset token, stores the SHA-256 hash in the user record,
 * and logs the reset URL to the console (no email service yet).
 *
 * Always returns success to prevent email enumeration.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, forgotPasswordSchema);
  if ('error' in v) return v.error;

  const { email } = v.data;

  // Always return success to prevent enumeration
  const successResponse = NextResponse.json({
    ok: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  });

  try {
    // Find user by email (could be in any tenant or owner)
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
    });

    if (!user) {
      // Return success even if user doesn't exist (prevent enumeration)
      return successResponse;
    }

    // Generate a secure 32-byte random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store the SHA-256 hash of the token (never store the raw token)
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store token hash and expiry on the user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: tokenHash,
        passwordResetExpires: expiresAt,
      },
    });

    // Send the password reset email (falls back to console logging if SMTP is not configured)
    await sendPasswordResetEmail(email, resetToken);

    await createAuditLog(
      'auth',
      user.id,
      'PASSWORD_RESET_REQUESTED',
      user.id,
      email,
      {},
      user.tenantId || undefined
    );

    logger.info('Password reset token generated', {
      category: 'auth',
      userId: user.id,
      email,
    });
  } catch (error) {
    // Log error but still return success to prevent enumeration
    logger.error('Error generating password reset token', {
      category: 'auth',
      error: error instanceof Error ? error : undefined,
    });
  }

  return successResponse;
});
