import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { signOffShift } from '@/lib/clinical/carePathShiftSummary';

export const dynamic = 'force-dynamic';

// POST /api/care-path/[carePathId]/shifts/[shiftId]/sign-off
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const segments = req.nextUrl.pathname.split('/');
    const carePathIdIndex = segments.indexOf('care-path') + 1;
    const shiftIdIndex = segments.indexOf('shifts') + 1;
    const carePathId = segments[carePathIdIndex];
    const shiftId = segments[shiftIdIndex];

    if (!carePathId || !shiftId) {
      return NextResponse.json({ error: 'Missing IDs' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const signatureData = body.signatureData;

    const summary = await signOffShift(
      prisma,
      tenantId,
      carePathId,
      shiftId,
      userId,
      signatureData,
    );

    return NextResponse.json({ summary });
  }),
  { tenantScoped: true, permissionKey: 'nursing.care_path.manage' }
);
