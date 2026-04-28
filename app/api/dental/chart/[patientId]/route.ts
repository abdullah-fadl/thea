import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as Record<string, string> | undefined)?.patientId || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const chart = await prisma.dentalChart.findFirst({
    where: { tenantId, patientId },
  });

  return NextResponse.json(chart || { patientId, conditions: {} });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'dental.chart.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }, params) => {
  const patientId = String((params as Record<string, string> | undefined)?.patientId || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const bodySchema = z.object({ conditions: z.record(z.string(), z.unknown()).optional() }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const conditions = body?.conditions || {};

  const now = new Date();
  const existing = await prisma.dentalChart.findFirst({
    where: { tenantId, patientId },
  });

  if (existing) {
    await prisma.dentalChart.updateMany({
      where: { tenantId, patientId },
      data: {
        conditions: conditions as Parameters<typeof prisma.dentalChart.create>[0]['data']['conditions'],
        updatedAt: now,
      },
    });
  } else {
    await prisma.dentalChart.create({
      data: {
        tenantId,
        patientId,
        conditions: conditions as Parameters<typeof prisma.dentalChart.create>[0]['data']['conditions'],
        createdAt: now,
        updatedAt: now,
      } as Parameters<typeof prisma.dentalChart.create>[0]['data'],
    });
  }

  return NextResponse.json({ success: true });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'dental.chart.edit' }
);
