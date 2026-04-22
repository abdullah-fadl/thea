import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { updateTemplateSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const templateId = String((params as any)?.templateId || '').trim();
  if (!templateId) return NextResponse.json({ error: 'templateId is required' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateTemplateSchema);
  if ('error' in v) return v.error;

  const resourceId = String(body.resourceId || '').trim();
  const timezone = String(body.timezone || 'UTC').trim();
  const daysOfWeek = Array.isArray(body.daysOfWeek)
    ? body.daysOfWeek.map((d: any) => Number(d)).filter((d: number) => d >= 0 && d <= 6)
    : [];
  const startTime = String(body.startTime || '').trim();
  const endTime = String(body.endTime || '').trim();
  const slotMinutes = Number(body.slotMinutes || 0);
  const effectiveFrom = String(body.effectiveFrom || '').trim();
  const effectiveTo = body.effectiveTo ? String(body.effectiveTo || '').trim() : null;
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();

  const invalid: string[] = [];
  if (!resourceId) invalid.push('resourceId');
  if (!startTime) invalid.push('startTime');
  if (!endTime) invalid.push('endTime');
  if (!slotMinutes) invalid.push('slotMinutes');
  if (!effectiveFrom) invalid.push('effectiveFrom');
  if (!daysOfWeek.length) invalid.push('daysOfWeek');
  if (!['ACTIVE', 'ARCHIVED'].includes(status)) invalid.push('status');
  if (invalid.length) {
    return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });
  }

  const existing = await prisma.schedulingTemplate.findFirst({
    where: { tenantId, id: templateId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updated = await prisma.schedulingTemplate.update({
    where: { id: templateId },
    data: {
      resourceId,
      timezone,
      daysOfWeek,
      startTime,
      endTime,
      slotMinutes,
      effectiveFrom,
      effectiveTo,
      status,
    },
  });

  await createAuditLog(
    'scheduling_template',
    templateId,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: existing, after: updated },
    tenantId
  );

  return NextResponse.json({ item: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
