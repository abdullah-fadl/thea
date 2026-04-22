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

  const incidents = await prisma.qualityIncident.findMany({
    where: { tenantId },
    select: { type: true, severity: true, status: true },
    take: 500,
  });
  const incidentCountsByType: Record<string, number> = {};
  const incidentCountsBySeverity: Record<string, number> = {};
  incidents.forEach((item: any) => {
    const type = String(item.type || 'UNKNOWN');
    const severity = String(item.severity || 'UNKNOWN');
    incidentCountsByType[type] = (incidentCountsByType[type] || 0) + 1;
    incidentCountsBySeverity[severity] = (incidentCountsBySeverity[severity] || 0) + 1;
  });

  const claims = await prisma.billingClaim.findMany({
    where: { tenantId },
    select: { id: true },
    take: 500,
  });
  const claimIds = claims.map((c: any) => String(c.id || '')).filter(Boolean);
  const claimEvents = claimIds.length
    ? await prisma.billingClaimEvent.findMany({
        where: { tenantId, claimId: { in: claimIds } },
        select: { claimId: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];
  const latestStatusByClaim = claimEvents.reduce<Record<string, string>>((acc, event) => {
    const id = String(event.claimId || '');
    if (!acc[id]) acc[id] = String(event.status || 'DRAFT').toUpperCase();
    return acc;
  }, {});
  const rcmMetrics = claimIds.reduce<Record<string, number>>((acc, id) => {
    const status = latestStatusByClaim[id] || 'DRAFT';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    incidents: {
      byType: incidentCountsByType,
      bySeverity: incidentCountsBySeverity,
    },
    rcm: rcmMetrics,
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.view' });
