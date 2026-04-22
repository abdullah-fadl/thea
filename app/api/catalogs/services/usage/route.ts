import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { normalizeChargeDepartmentKey } from '@/lib/billing/chargeEvents';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const serviceCatalogId = String(req.nextUrl.searchParams.get('serviceCatalogId') || '').trim();
  const where: any = { tenantId };
  if (serviceCatalogId) where.serviceCatalogId = serviceCatalogId;

  const items = await prisma.serviceUsageEvent.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    serviceCatalogId: z.string().min(1),
    requestId: z.string().min(1),
    encounterId: z.string().min(1),
    note: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const serviceCatalogId = String(body.serviceCatalogId || '').trim();
  const requestId = String(body.requestId || '').trim();
  const encounterId = String(body.encounterId || '').trim();
  const note = String(body.note || '').trim();

  const missing: string[] = [];
  if (!serviceCatalogId) missing.push('serviceCatalogId');
  if (!encounterId) missing.push('encounterId');
  if (!requestId) missing.push('requestId');
  if (missing.length) return NextResponse.json({ error: 'Validation failed', missing }, { status: 400 });

  const service = await prisma.serviceCatalog.findFirst({
    where: { tenantId, id: serviceCatalogId },
  });
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  if (!service.chargeCatalogId) {
    return NextResponse.json({ error: 'Service has no linked charge' }, { status: 409 });
  }

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterId },
  });
  if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  if (String(encounter.status || '') === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  const catalog = await prisma.billingChargeCatalog.findFirst({
    where: { tenantId, id: service.chargeCatalogId },
  });
  if (!catalog) return NextResponse.json({ error: 'Charge catalog item not found' }, { status: 404 });

  const now = new Date();
  const usageEventId = uuidv4();
  const chargeEventId = uuidv4();

  // Idempotency check
  try {
    await prisma.catalogUsageIdempotency.create({
      data: {
        id: uuidv4(),
        tenantId,
        requestId,
        kind: 'SERVICE_USAGE',
        usageEventId,
        chargeEventId,
        createdAt: now,
        createdByUserId: userId || null,
        createdByEmail: user?.email || null,
      },
    });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existingRecord = await prisma.catalogUsageIdempotency.findFirst({
        where: { tenantId, requestId, kind: 'SERVICE_USAGE' },
      });
      return NextResponse.json(
        { success: true, noOp: true, id: existingRecord?.usageEventId || null },
        { headers: { 'x-idempotent-replay': '1' } }
      );
    }
    throw err;
  }

  const event = await prisma.serviceUsageEvent.create({
    data: {
      id: usageEventId,
      tenantId,
      serviceCatalogId,
      encounterId,
      note: note || null,
      createdAt: now,
      createdByUserId: userId || null,
      createdByEmail: user?.email || null,
    },
  });

  const departmentKey = normalizeChargeDepartmentKey(catalog.departmentDomain) || 'OTHER';
  const unitPrice = Number(catalog.basePrice || 0);
  await prisma.billingChargeEvent.create({
    data: {
      id: chargeEventId,
      tenantId,
      encounterCoreId: encounterId,
      patientMasterId: encounter.patientId || null,
      departmentKey,
      source: {
        type: 'SERVICE_USAGE',
        serviceCatalogId,
        usageEventId: event.id,
      },
      chargeCatalogId: catalog.id,
      code: catalog.code,
      name: catalog.name,
      unitType: catalog.unitType,
      quantity: 1,
      unitPrice,
      totalPrice: Number(unitPrice.toFixed(2)),
      payerType: 'PENDING',
      status: 'ACTIVE',
      reason: null,
      createdAt: now,
      createdBy: userId || null,
    },
  });

  return NextResponse.json({ success: true, id: event.id, event });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });
