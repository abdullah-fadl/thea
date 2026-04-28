import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { verify2FAToken } from '@/lib/auth/twoFactor';
import { comparePassword } from '@/lib/auth';
import { validateBody } from '@/lib/validation/helpers';
import { twoFactorDisableSchema } from '@/lib/validation/auth.schema';
import { createAuditLog } from '@/lib/utils/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(async (req: NextRequest, { userId }) => {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const v = validateBody(body, twoFactorDisableSchema);
  if ('error' in v) return v.error;
  const { password, token } = v.data;

  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: { password: true, twoFactorEnabled: true, twoFactorSecret: true },
  });

  if (!user?.twoFactorEnabled) {
    return NextResponse.json({ error: '2FA is not enabled' }, { status: 400 });
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
  }

  // Verify 2FA token
  const isTokenValid = verify2FAToken(token, user.twoFactorSecret);
  if (!isTokenValid) {
    return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 400 });
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: userId! },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: null,
      twoFactorEnabledAt: null,
    },
  });

  await createAuditLog(
    'auth',
    userId || 'unknown',
    '2FA_DISABLED',
    userId || 'system',
    undefined,
    {},
  );

  return NextResponse.json({ success: true, message: '2FA disabled' });
}, { tenantScoped: false });
