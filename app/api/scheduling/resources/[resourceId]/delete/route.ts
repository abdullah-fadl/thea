import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { invalidateOnSchedulingChange } from '@/lib/cache/invalidation';
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

  const existing = await prisma.schedulingResource.findFirst({
    where: { tenantId, id: resourceId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const deleteResult = await prisma.schedulingResource.deleteMany({
    where: { tenantId, id: resourceId },
  });

  await createAuditLog(
    'scheduling_resource',
    resourceId,
    'DELETE',
    userId || 'system',
    user?.email,
    { before: existing },
    tenantId
  );

  await invalidateOnSchedulingChange(tenantId);

  return NextResponse.json({ ok: true, deletedCount: deleteResult.count });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.edit' }
);
