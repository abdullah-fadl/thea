import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const acknowledgeAlertSchema = z.object({
  alertId: z.string().min(1, 'alertId is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const unacknowledged = req.nextUrl.searchParams.get('unacknowledged') === 'true';
  const where: any = { tenantId };
  if (unacknowledged) where.acknowledgedAt = null;

  const alerts = await prisma.labCriticalAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ alerts });
}),
  { tenantScoped: true, permissionKey: 'lab.alerts.view' });

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json().catch(() => ({}));
  const v = validateBody(body, acknowledgeAlertSchema);
  if ('error' in v) return v.error;
  const { alertId } = v.data;

  await prisma.labCriticalAlert.updateMany({
    where: { id: alertId, tenantId },
    data: { acknowledgedAt: new Date(), acknowledgedBy: userId },
  });

  return NextResponse.json({ success: true });
}),
  { tenantScoped: true, permissionKey: 'lab.alerts.acknowledge' });
