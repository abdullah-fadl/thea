import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requirePortalSession } from '@/lib/portal/auth';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withErrorHandler(async (request: NextRequest) => {
  const payload = await requirePortalSession(request);
  if (payload instanceof NextResponse) return payload;

  const portalUser = await prisma.patientPortalUser.findFirst({
    where: { tenantId: payload.tenantId, id: payload.portalUserId },
  });

  if (!portalUser?.patientMasterId) {
    return NextResponse.json({ profile: null });
  }

  const patient = await prisma.patientMaster.findFirst({
    where: { tenantId: payload.tenantId, id: portalUser.patientMasterId },
  });

  return NextResponse.json({
    profile: patient
      ? {
          id: patient.id,
          fullName: patient.fullName || (patient as any).displayName || (patient as any).name,
          mrn: (patient.links as any)?.mrn || null,
          dob: patient.dob || null,
          gender: patient.gender || null,
        }
      : null,
  });
});
