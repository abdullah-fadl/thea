import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { generate2FASecret, generateQRCode, generateBackupCodes } from '@/lib/auth/twoFactor';
import { hashPassword } from '@/lib/auth';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { userId, user }) => {
    // Check if 2FA already enabled
    const existingUser = await prisma.user.findFirst({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    if (existingUser?.twoFactorEnabled) {
      return NextResponse.json({ error: '2FA is already enabled' }, { status: 400 });
    }

    // Generate secret
    const { secret, otpAuthUrl } = generate2FASecret(user?.email || '');
    const qrCode = await generateQRCode(otpAuthUrl);
    const backupCodes = generateBackupCodes(10);

    // Hash backup codes for storage
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (code) => ({
        hash: await hashPassword(code),
        used: false,
      }))
    );

    // Store pending 2FA setup (not enabled yet until verified)
    await prisma.user.update({
      where: { id: userId! },
      data: {
        twoFactorPending: {
          secret,
          backupCodes: hashedBackupCodes,
          createdAt: new Date().toISOString(),
        },
      },
    });

    await createAuditLog(
      'auth',
      userId || 'unknown',
      '2FA_SETUP_INITIATED',
      userId || 'system',
      user?.email,
      {},
    );

    return NextResponse.json({
      qrCode,
      secret,
      backupCodes,
    });
  }),
  { tenantScoped: false }
);
