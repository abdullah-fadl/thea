import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const params = req.nextUrl.searchParams;
    const statusFilter = params.get('status'); // e.g. 'RECEIVED' or 'active' (all non-released)

    const whereStatus = statusFilter === 'active'
      ? { notIn: ['RELEASED_TO_FAMILY', 'TRANSFERRED_OUT'] }
      : statusFilter
        ? { equals: statusFilter }
        : undefined;

    const cases = await prisma.mortuaryCase.findMany({
      where: {
        tenantId,
        ...(whereStatus ? { status: whereStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    // Enrich with patient info from patientMasterId
    const patientIds = cases
      .map(c => c.patientMasterId)
      .filter((id): id is string => Boolean(id));

    const patients = patientIds.length
      ? await prisma.patientMaster.findMany({
          where: { id: { in: patientIds } },
          select: { id: true, fullName: true, mrn: true, gender: true, dob: true },
        })
      : [];

    const patientMap = new Map(patients.map(p => [p.id, p]));

    const enriched = cases.map(c => ({
      id: c.id,
      encounterCoreId: c.encounterCoreId,
      bodyTagNumber: c.bodyTagNumber ?? null,
      status: c.status,
      location: c.location as { morgueRoom?: string; shelf?: string } | null,
      releaseDetails: c.releaseDetails as Record<string, unknown> | null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt ?? null,
      patient: c.patientMasterId ? (patientMap.get(c.patientMasterId) ?? null) : null,
    }));

    const summary = {
      total: enriched.length,
      active: enriched.filter(c => !['RELEASED_TO_FAMILY', 'TRANSFERRED_OUT'].includes(c.status)).length,
      released: enriched.filter(c => c.status === 'RELEASED_TO_FAMILY').length,
      transferred: enriched.filter(c => c.status === 'TRANSFERRED_OUT').length,
    };

    return NextResponse.json({ cases: enriched, summary });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'mortuary.view' }
);
