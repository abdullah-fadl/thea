import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';
import { executeOrderSetSchema } from '@/lib/validation/orders.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ENCOUNTER_TYPES = new Set(['ER', 'OPD', 'IPD']);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, executeOrderSetSchema);
  if ('error' in v) return v.error;

  const orderSetId = String(body.orderSetId || '').trim();
  const patientId = String(body.patientId || '').trim();
  const encounterIdInput = String(body.encounterId || '').trim();
  let encounterType = String(body.encounterType || '').trim().toUpperCase();

  if (!orderSetId) {
    return NextResponse.json({ error: 'orderSetId is required' }, { status: 400 });
  }

  const orderSet = await prisma.orderSet.findFirst({
    where: { tenantId, id: orderSetId },
  });
  if (!orderSet) {
    return NextResponse.json({ error: 'Order set not found' }, { status: 404 });
  }
  if (orderSet.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'Order set archived' }, { status: 409 });
  }

  let encounterId = encounterIdInput;
  let encounter: any = null;

  if (encounterId) {
    encounter = await prisma.encounterCore.findFirst({
      where: { tenantId, id: encounterId },
    });
  } else if (patientId) {
    encounter = await prisma.encounterCore.findFirst({
      where: {
        tenantId,
        patientId,
        OR: [{ status: 'CREATED' }, { status: 'ACTIVE' }],
      },
      orderBy: { createdAt: 'desc' },
    });
    encounterId = encounter?.id || '';
  }

  if (!encounter || !encounterId) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }

  if (!encounterType) {
    encounterType = String(
      (encounter as Record<string, unknown>).encounterType ||
      (encounter as Record<string, unknown>).type ||
      (encounter as Record<string, unknown>).module ||
      'OPD'
    ).toUpperCase();
  }

  if (!ENCOUNTER_TYPES.has(encounterType)) {
    return NextResponse.json({ error: 'Invalid encounterType' }, { status: 400 });
  }

  const encounterRefKey = `${encounterType}:${encounterId}`;

  // Check for existing application (idempotency)
  const existing = await prisma.orderSetApplication.findFirst({
    where: { tenantId, orderSetId, encounterRefKey },
  });
  if (existing) {
    return NextResponse.json({ success: true, noOp: true, application: existing });
  }

  const application = await prisma.orderSetApplication.create({
    data: {
      tenantId,
      orderSetId,
      encounterRef: { type: encounterType, id: encounterId },
      encounterRefKey,
      createdOrderIds: [],
      appliedByUserId: userId || null,
      appliedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, application });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'order.sets.view' }
);
