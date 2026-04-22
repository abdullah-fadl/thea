import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessQuality } from '@/lib/quality/access';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessQuality({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const incidentId = String(req.nextUrl.pathname.split('/').pop() || '').trim();
  if (!incidentId) {
    return NextResponse.json({ error: 'incidentId is required' }, { status: 400 });
  }

  const incident = await prisma.qualityIncident.findFirst({
    where: { tenantId, id: incidentId },
  });
  if (!incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }

  const rca = await prisma.qualityRca.findFirst({
    where: { tenantId, incidentId },
  });

  return NextResponse.json({ incident, rca: rca || null });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.view' });
