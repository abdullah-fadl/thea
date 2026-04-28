import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { withSchedulingIdempotency } from '@/lib/scheduling/idempotency';
import { validateBody } from '@/lib/validation/helpers';
import { createTemplateSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseRruleDays(rrule: string) {
  const match = rrule.match(/BYDAY=([^;]+)/i);
  if (!match) return [];
  const map: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  return match[1]
    .split(',')
    .map((d) => d.trim().toUpperCase())
    .filter(Boolean)
    .map((d) => map[d])
    .filter((d) => Number.isFinite(d));
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const resourceId = String(req.nextUrl.searchParams.get('resourceId') || '').trim();
  const where: any = { tenantId };
  if (resourceId) where.resourceId = resourceId;

  const items = await prisma.schedulingTemplate.findMany({
    where,
    orderBy: { createdAt: 'asc' },
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

  const v = validateBody(body, createTemplateSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const invalid: string[] = [];
  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const resourceId = String(body.resourceId || '').trim();
  const timezone = String(body.timezone || 'UTC').trim();
  const rruleInput = body.rrule ? String(body.rrule || '').trim() : null;
  const daysOfWeek = Array.isArray(body.daysOfWeek)
    ? body.daysOfWeek.map((d: any) => Number(d)).filter((d: number) => d >= 0 && d <= 6)
    : rruleInput
    ? parseRruleDays(rruleInput)
    : [];
  const rrule = rruleInput || (daysOfWeek.length
    ? `FREQ=WEEKLY;BYDAY=${daysOfWeek
        .map((d) => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][d])
        .join(',')}`
    : null);
  const startTime = String(body.startTime || '').trim();
  const endTime = String(body.endTime || '').trim();
  const slotMinutes = Number(body.slotMinutes || 0);
  const effectiveFrom = String(body.effectiveFrom || '').trim();
  const effectiveTo = body.effectiveTo ? String(body.effectiveTo || '').trim() : null;
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();

  if (!resourceId) missing.push('resourceId');
  if (!startTime) missing.push('startTime');
  if (!endTime) missing.push('endTime');
  if (!slotMinutes) missing.push('slotMinutes');
  if (!effectiveFrom) missing.push('effectiveFrom');
  if (!daysOfWeek.length) invalid.push('daysOfWeek');
  if (!['ACTIVE', 'ARCHIVED'].includes(status)) invalid.push('status');
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  return withSchedulingIdempotency({
    tenantId,
    method: 'POST',
    pathname: '/api/scheduling/templates',
    clientRequestId,
    handler: async () => {
      // Check for existing duplicate
      const existing = await prisma.schedulingTemplate.findFirst({
        where: { tenantId, resourceId, rrule: rrule || null, startTime, endTime, slotMinutes, effectiveFrom },
      });
      if (existing) {
        return NextResponse.json({ success: true, noOp: true, template: existing });
      }

      const templateId = uuidv4();
      const template = await prisma.schedulingTemplate.create({
        data: {
          id: templateId,
          tenantId,
          resourceId,
          timezone,
          rrule: rrule || null,
          daysOfWeek,
          startTime,
          endTime,
          slotMinutes,
          effectiveFrom,
          effectiveTo,
          status,
          createdByUserId: userId || null,
        },
      });

      await createAuditLog(
        'scheduling_template',
        template.id,
        'CREATE',
        userId || 'system',
        user?.email,
        { after: template },
        tenantId
      );

      return NextResponse.json({ template });
    },
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.create' }
);
