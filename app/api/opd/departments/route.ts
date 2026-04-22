import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    // Resolve tenantId — could be a UUID or a tenant key depending on auth path
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
    let tenantUuid = tenantId;
    if (!isUuid) {
      const tenant = await prisma.tenant.findFirst({
        where: { tenantId },
        select: { id: true },
      });
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      }
      tenantUuid = tenant.id;
    }

    const departments = await prisma.department.findMany({
      where: {
        tenantId: tenantUuid,
        isActive: true,
        type: { in: ['OPD', 'BOTH'] },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });

    return NextResponse.json({ success: true, departments });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.visit.view' }
);
