import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { getAbsherClient } from '@/lib/integrations/absher/client';
import { nanoid } from 'nanoid';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const absherVerifySchema = z.object({
  idNumber: z.string().min(1, 'idNumber is required'),
  birthDate: z.string().min(1, 'birthDate is required'),
  idType: z.string().optional(),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, absherVerifySchema);
  if ('error' in v) return v.error;
  const { idNumber, birthDate, idType } = v.data;

  const client = getAbsherClient();
  const isNationalId = idType === 'national' || String(idNumber).startsWith('1');

  const result = isNationalId
    ? await client.verifyNationalId(idNumber, birthDate)
    : await client.verifyIqama(idNumber, birthDate);

  await prisma.absherVerificationLog.create({
    data: {
      id: `abs_${nanoid(12)}`,
      tenantId,
      idNumber: String(idNumber).substring(0, 4) + '****',
      idType: isNationalId ? 'national' : 'iqama',
      verified: result.verified,
      createdAt: new Date(),
      createdBy: userId,
    },
  });

  if (!result.verified) {
    return NextResponse.json({
      success: false,
      verified: false,
      error: result.error || 'Verification failed',
    });
  }

  return NextResponse.json({
    success: true,
    verified: true,
    personInfo: result.personInfo,
  });
}),
  { tenantScoped: true, permissionKey: 'patients.verify' });
