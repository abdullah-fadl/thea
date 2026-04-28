import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { withAccessAudit } from '@/lib/audit/accessLogger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withAccessAudit(withErrorHandler(async (req: NextRequest, { tenantId }) => {
    const url = req.nextUrl.pathname;
    const segments = url.split('/');
    // URL pattern: /api/clinical/consents/[consentId]
    const consentId = segments[segments.length - 1];

    if (!consentId) {
      return NextResponse.json({ error: 'Missing consentId' }, { status: 400 });
    }

    const consent = await prisma.clinicalConsent.findFirst({
      where: { id: consentId, tenantId },
    });

    if (!consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    return NextResponse.json({ consent });
  }), { resourceType: 'consent', extractResourceId: (req) => req.nextUrl.pathname.split('/').pop() || null }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'opd.registration' }
);
