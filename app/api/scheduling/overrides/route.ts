import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { createOverrideSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const resourceId = String(params.get('resourceId') || '').trim();
  const from = parseDate(params.get('from'));
  const to = parseDate(params.get('to'));

  const where: any = { tenantId };
  if (resourceId) where.resourceId = resourceId;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = from.toISOString().slice(0, 10);
    if (to) where.date.lte = to.toISOString().slice(0, 10);
  }

  const items = await prisma.schedulingAvailabilityOverride.findMany({
    where,
    orderBy: { date: 'asc' },
    take: 200,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createOverrideSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const resourceId = String(body.resourceId || '').trim();
  const date = String(body.date || '').trim();
  const blocks = Array.isArray(body.blocks) ? body.blocks : [];
  const opens = Array.isArray(body.opens) ? body.opens : [];

  if (!resourceId) missing.push('resourceId');
  if (!date) missing.push('date');
  if (missing.length) {
    return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });
  }

  const blocksData = blocks.map((b: any) => ({
    startTime: String(b.startTime || '').trim(),
    endTime: String(b.endTime || '').trim(),
    reason: b.reason ? String(b.reason || '').trim() : null,
  }));
  const opensData = opens.map((o: any) => ({
    startTime: String(o.startTime || '').trim(),
    endTime: String(o.endTime || '').trim(),
    reason: o.reason ? String(o.reason || '').trim() : null,
  }));

  // @@unique([tenantId, resourceId, date]) enables the upsert
  const override = await prisma.schedulingAvailabilityOverride.upsert({
    where: {
      tenantId_resourceId_date: { tenantId, resourceId, date },
    },
    update: {
      blocks: blocksData,
      opens: opensData,
    },
    create: {
      id: uuidv4(),
      tenantId,
      resourceId,
      date,
      blocks: blocksData,
      opens: opensData,
      createdByUserId: userId || null,
    },
  });

  await createAuditLog(
    'scheduling_override',
    override.id || `${resourceId}:${date}`,
    'UPSERT',
    userId || 'system',
    user?.email,
    { after: override },
    tenantId
  );

  return NextResponse.json({ override });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
