import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { verify2FAToken } from '@/lib/auth/twoFactor';
import { validateBody } from '@/lib/validation/helpers';
import { twoFactorVerifySchema } from '@/lib/validation/auth.schema';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req: NextRequest, { userId }) => {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const v = validateBody(body, twoFactorVerifySchema);
  if ('error' in v) return v.error;
  const { token } = v.data;

  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { twoFactorPending: true },
  });

  const pending = user?.twoFactorPending as { secret?: string; backupCodes?: Array<{ hash: string; used: boolean }> } | null;
  if (!pending?.secret) {
    return NextResponse.json({ error: 'No pending 2FA setup' }, { status: 400 });
  }

  // Verify token
  const isValid = verify2FAToken(token, pending.secret);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
  }

  // Enable 2FA
  await prisma.user.update({
    where: { id: userId! },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: pending.secret,
      twoFactorBackupCodes: pending.backupCodes as Prisma.InputJsonValue,
      twoFactorEnabledAt: new Date(),
      twoFactorPending: null, // Clear pending ($unset equivalent)
    },
  });

  await createAuditLog(
    'auth',
    userId || 'unknown',
    '2FA_ENABLED',
    userId || 'system',
    undefined,
    {},
  );

  return NextResponse.json({ success: true, message: '2FA enabled successfully' });
}, { tenantScoped: false });
