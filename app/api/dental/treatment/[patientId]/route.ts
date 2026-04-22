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
  const patientId = String((params as Record<string, string>)?.patientId || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const items = await prisma.dentalTreatment.findMany({
    where: { tenantId, patientId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ items });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'dental.treatment.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }, params) => {
  const patientId = String((params as Record<string, string>)?.patientId || '').trim();
  if (!patientId) {
    return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const bodySchema = z.object({ action: z.string().optional() }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const action = String(body?.action || '').trim();
  const now = new Date();

  if (action === 'update') {
    const id = String(body?.id || '').trim();
    const status = String(body?.status || '').trim();
    if (!id || !status) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    await prisma.dentalTreatment.updateMany({
      where: { tenantId, patientId, id },
      data: { status, updatedAt: now, completedAt: status === 'COMPLETED' ? now : null },
    });
    return NextResponse.json({ success: true });
  }

  const item = body?.item;
  if (!item) {
    return NextResponse.json({ error: 'Item is required' }, { status: 400 });
  }

  const record = {
    tenantId,
    patientId,
    toothNumber: item.toothNumber,
    surface: item.surface || null,
    procedureCode: item.procedureCode,
    procedureName: item.procedureName,
    procedureNameAr: item.procedureNameAr,
    fee: item.fee,
    status: item.status || 'PLANNED',
    priority: item.priority != null ? String(item.priority) : '1',
    notes: item.notes || null,
    createdAt: now,
    createdBy: userId || null,
  };

  const created = await prisma.dentalTreatment.create({ data: record as any });
  return NextResponse.json({ success: true, item: created });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'dental.treatment.edit' }
);
