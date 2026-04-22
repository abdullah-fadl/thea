import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { updateResourceSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const resourceId = String((params as any)?.resourceId || '').trim();
  if (!resourceId) return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateResourceSchema);
  if ('error' in v) return v.error;

  const existing = await prisma.schedulingResource.findFirst({
    where: { tenantId, id: resourceId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const patch: Record<string, any> = {};
  if (body.departmentKey !== undefined) patch.departmentKey = String(body.departmentKey || '').trim();
  if (body.displayName !== undefined) patch.displayName = String(body.displayName || '').trim();
  if (body.tags !== undefined) patch.tags = Array.isArray(body.tags) ? body.tags : [];
  if (body.resourceRef !== undefined) patch.resourceRef = body.resourceRef || null;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ item: existing, noOp: true });
  }

  const updated = await prisma.schedulingResource.update({
    where: { id: resourceId },
    data: patch,
  });

  await createAuditLog(
    'scheduling_resource',
    resourceId,
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
