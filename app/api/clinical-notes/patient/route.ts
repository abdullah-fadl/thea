import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { logPatientAccess } from '@/lib/audit/patientAccessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const { searchParams } = new URL(req.url);
    const patientMasterId = String(searchParams.get('patientMasterId') || '').trim();
    if (!patientMasterId) {
      return NextResponse.json({ error: 'patientMasterId is required' }, { status: 400 });
    }

    const items = await prisma.clinicalNote.findMany({
      where: { tenantId, patientMasterId },
      orderBy: { createdAt: 'asc' },
    });

    // Fire-and-forget patient access audit
    logPatientAccess({
      tenantId,
      userId,
      userRole: user?.role || 'unknown',
      userEmail: user?.email,
      patientId: patientMasterId,
      accessType: 'view',
      resourceType: 'clinical_notes',
      path: '/api/clinical-notes/patient',
    });

    return NextResponse.json({ items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' }
);
