import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessQuality } from '@/lib/quality/access';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NEXT: Record<string, string | null> = {
  OPEN: 'REVIEWED',
  REVIEWED: 'CLOSED',
  CLOSED: null,
};

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {
  if (!canAccessQuality({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const incidentId = String(req.nextUrl.pathname.split('/').slice(-2)[0] || '').trim();
  if (!incidentId) {
    return NextResponse.json({ error: 'incidentId is required' }, { status: 400 });
  }

  const incident = await prisma.qualityIncident.findFirst({
    where: { tenantId, id: incidentId },
  });
  if (!incident) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    status: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const nextStatus = String(body.status || '').trim().toUpperCase();
  const currentStatus = String(incident.status || 'OPEN').toUpperCase();
  const expected = NEXT[currentStatus] || null;
  if (!expected || nextStatus !== expected) {
    return NextResponse.json({ error: 'Invalid transition', current: currentStatus, expected }, { status: 409 });
  }

  const now = new Date();
  await prisma.qualityIncident.updateMany({
    where: { tenantId, id: incidentId },
    data: {
      status: nextStatus,
      updatedAt: now,
      updatedByUserId: userId || null,
    },
  });

  await createAuditLog(
    'quality_incident',
    incidentId,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: { status: currentStatus }, after: { status: nextStatus } },
    tenantId
  );

  return NextResponse.json({ success: true, status: nextStatus });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.manage' });
