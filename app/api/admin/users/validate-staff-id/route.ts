import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const staffId = String(req.nextUrl.searchParams.get('staffId') || '').trim();
    if (!staffId) {
      return NextResponse.json({ error: 'staffId is required' }, { status: 400 });
    }

    const provider = await prisma.clinicalInfraProvider.findFirst({
      where: { tenantId, staffId, isArchived: { not: true } },
      select: { id: true, displayName: true, email: true, staffId: true, employmentType: true },
    });

    const existingUser = await prisma.user.findFirst({
      where: { tenantId, staffId },
      select: { email: true },
    });

    const providerInfo = provider
      ? {
          id: provider.id,
          displayName: provider.displayName || null,
          email: provider.email || null,
          staffId: provider.staffId || null,
          employmentType: provider.employmentType || null,
        }
      : null;

    return NextResponse.json({
      valid: !!provider && !existingUser,
      providerFound: !!provider,
      providerName: provider?.displayName || null,
      provider: providerInfo,
      alreadyAssigned: !!existingUser,
      assignedTo: existingUser?.email || null,
    });
  }),
  { tenantScoped: true, permissionKey: 'admin.users.create' }
);
