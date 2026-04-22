import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { generateDailyCarePath } from '@/lib/clinical/carePathEngine';

export const dynamic = 'force-dynamic';

// POST /api/care-path/generate
// Generates a daily care path for a patient from their active orders
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const body = await req.json();
    const {
      patientMasterId,
      encounterCoreId,
      episodeId,
      erEncounterId,
      department,
      date,
    } = body;

    if (!patientMasterId || !department) {
      return NextResponse.json(
        { error: 'patientMasterId and department are required' },
        { status: 400 }
      );
    }

    const pathDate = date ? new Date(date) : new Date();

    const result = await generateDailyCarePath(prisma, {
      tenantId,
      patientMasterId,
      encounterCoreId,
      episodeId,
      erEncounterId,
      department,
      date: pathDate,
      nurseUserId: userId,
      nurseName: user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : undefined,
    });

    if ((result as Record<string, unknown>).alreadyExists) {
      const existing = await prisma.dailyCarePath.findFirst({
        where: {
          tenantId,
          patientMasterId,
          date: new Date(pathDate.getFullYear(), pathDate.getMonth(), pathDate.getDate()),
          departmentType: department,
        },
        include: {
          shifts: { orderBy: { startTime: 'asc' } },
          tasks: { orderBy: { scheduledTime: 'asc' } },
          alerts: { where: { acknowledged: false }, orderBy: { createdAt: 'desc' } },
        },
      });
      return NextResponse.json({ path: existing, alreadyExists: true });
    }

    const carePath = await prisma.dailyCarePath.findUnique({
      where: { id: result.carePathId },
      include: {
        shifts: { orderBy: { startTime: 'asc' } },
        tasks: { orderBy: { scheduledTime: 'asc' } },
        alerts: { orderBy: { createdAt: 'desc' } },
      },
    });

    return NextResponse.json({
      path: carePath,
      tasksCreated: result.tasksCreated,
    });
  }),
  { tenantScoped: true, permissionKey: 'nursing.care_path.manage' }
);
