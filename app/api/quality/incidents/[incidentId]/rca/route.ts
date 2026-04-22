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

  const existing = await prisma.qualityRca.findFirst({
    where: { tenantId, incidentId },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, id: existing.id });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    whatHappened: z.string().min(1),
    why: z.string().min(1),
    correctiveAction: z.string().min(1),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const whatHappened = String(body.whatHappened || '').trim();
  const why = String(body.why || '').trim();
  const correctiveAction = String(body.correctiveAction || '').trim();
  const missing: string[] = [];
  if (!whatHappened) missing.push('whatHappened');
  if (!why) missing.push('why');
  if (!correctiveAction) missing.push('correctiveAction');
  if (missing.length) {
    return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });
  }

  const now = new Date();
  const rca = await prisma.qualityRca.create({
    data: {
      tenantId,
      incidentId,
      whatHappened,
      why,
      correctiveAction,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  await createAuditLog(
    'quality_rca',
    rca.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: rca },
    tenantId
  );

  return NextResponse.json({ success: true, id: rca.id });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'quality.manage' });
