import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// GET /api/care-path?patientMasterId=...&date=...&department=...
export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = new URL(req.url);
    const patientMasterId = url.searchParams.get('patientMasterId');
    const date = url.searchParams.get('date');
    const department = url.searchParams.get('department');

    const where: Record<string, unknown> = { tenantId };

    if (patientMasterId) where.patientMasterId = patientMasterId;
    if (department) where.departmentType = department;
    if (date) {
      where.date = new Date(date);
    } else {
      const today = new Date();
      where.date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    const paths = await prisma.dailyCarePath.findMany({
      where: where,
      include: {
        shifts: {
          orderBy: { startTime: 'asc' },
        },
        tasks: {
          orderBy: { scheduledTime: 'asc' },
        },
        alerts: {
          where: { acknowledged: false },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ paths });
  }),
  { tenantScoped: true, permissionKey: 'nursing.care_path.view' }
);
