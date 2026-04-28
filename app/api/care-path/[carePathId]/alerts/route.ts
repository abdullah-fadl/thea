import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET /api/care-path/[carePathId]/alerts
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const segments = req.nextUrl.pathname.split('/');
    const carePathIdIndex = segments.indexOf('care-path') + 1;
    const carePathId = segments[carePathIdIndex];

    const alerts = await prisma.carePathAlert.findMany({
      where: { tenantId, carePathId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ alerts });
  }),
  { tenantScoped: true, permissionKey: 'nursing.care_path.view' }
);

// PATCH /api/care-path/[carePathId]/alerts - Acknowledge an alert
export const PATCH = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const segments = req.nextUrl.pathname.split('/');
    const carePathIdIndex = segments.indexOf('care-path') + 1;
    const carePathId = segments[carePathIdIndex];

    const body = await req.json();
    const { alertId, action } = body;

    if (!alertId) {
      return NextResponse.json({ error: 'alertId required' }, { status: 400 });
    }

    const alert = await prisma.carePathAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedByUserId: userId,
        acknowledgedByName: user?.firstName
          ? `${user.firstName} ${user.lastName ?? ''}`.trim()
          : undefined,
        acknowledgedAction: action ?? 'NOTED',
      },
    });

    return NextResponse.json({ alert });
  }),
  { tenantScoped: true, permissionKey: 'nursing.care_path.manage' }
);
