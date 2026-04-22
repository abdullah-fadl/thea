import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { getNafisClient } from '@/lib/integrations/nafis/client';
import { nanoid } from 'nanoid';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';

const nafisStatisticsSchema = z.object({
  reportType: z.string().min(1, 'reportType is required'),
}).passthrough();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const v = validateBody(body, nafisStatisticsSchema);
  if ('error' in v) return v.error;
  const result = await getNafisClient().submitHealthStatistics(v.data as any);

  await prisma.nafisStatisticsLog.create({
    data: {
      id: `ns_${nanoid(12)}`,
      tenantId,
      request: v.data as any,
      response: result as any,
      success: result.success,
      createdAt: new Date(),
      createdBy: userId,
    },
  });

  return NextResponse.json({ success: result.success, data: result.data, error: result.error });
}),
  { tenantScoped: true, permissionKey: 'nafis.statistics.submit' });
