import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { validateBody } from '@/lib/validation/helpers';
import { updateResourceStatusSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const resourceId = String((params as any)?.resourceId || '').trim();
  if (!resourceId) {
    return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateResourceStatusSchema);
  if ('error' in v) return v.error;

  const status = String(body.status || '').trim().toUpperCase();
  if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const existing = await prisma.schedulingResource.findFirst({
    where: { tenantId, id: resourceId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }
  if (existing.status === status) {
    return NextResponse.json({ success: true, noOp: true, resource: existing });
  }

  const resource = await prisma.schedulingResource.update({
    where: { id: resourceId },
    data: { status },
  });

  await createAuditLog(
    'scheduling_resource',
    resourceId,
    status === 'INACTIVE' ? 'INACTIVATE' : 'UPDATE',
    userId || 'system',
    user?.email,
    { before: existing, after: resource },
    tenantId
  );

  return NextResponse.json({ resource });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
