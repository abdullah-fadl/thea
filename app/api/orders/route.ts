import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { appendOrderEvent, auditOrder, normalizeDepartmentKey, ORDER_KIND_TO_DEPARTMENT } from '@/lib/orders/ordersHub';
import { bridgeOrderToPharmacy } from '@/lib/opd/prescriptionBridge';
import { medicationOrderMetaSchema } from '@/lib/orders/medicationOrderValidation';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { checkDrugAllergy } from '@/lib/clinical/allergyCheck';
import { checkDuplicateTherapy } from '@/lib/clinical/duplicateCheck';
import { validateBody } from '@/lib/validation/helpers';
import { createOrderSchema } from '@/lib/validation/orders.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ORDER_KINDS = new Set(['LAB', 'RADIOLOGY', 'PROCEDURE', 'MEDICATION']);
const PRIORITIES = new Set(['ROUTINE', 'STAT']);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const encounterCoreId = String(req.nextUrl.searchParams.get('encounterCoreId') || '').trim();
  if (!encounterCoreId) {
    return NextResponse.json({ error: 'encounterCoreId is required' }, { status: 400 });
  }

  const orders = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 200,
  });

  return NextResponse.json({ items: orders });
}), {
  tenantScoped: true,
  platformKey: 'thea_health',
  permissionKeys: ['orders.hub.view', 'opd.doctor.encounter.view', 'opd.doctor.orders.create', 'opd.prescription.create'],
});

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createOrderSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const invalid: string[] = [];
  const encounterCoreId = String(body.encounterCoreId || '').trim();
  const kind = String(body.kind || '').trim().toUpperCase();
  const orderCode = String(body.orderCode || '').trim();
  const orderName = String(body.orderName || '').trim();
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  const priority = String(body.priority || 'ROUTINE').trim().toUpperCase();
  const clinicalText = body.clinicalText ? String(body.clinicalText || '').trim() : null;

  if (kind === 'MEDICATION' && body.meta && typeof body.meta === 'object') {
    body.meta.prescribedById = body.meta.prescribedById || userId;
    body.meta.prescribedAt = body.meta.prescribedAt || new Date().toISOString();
  }

  if (!encounterCoreId) missing.push('encounterCoreId');
  if (!kind) missing.push('kind');
  if (!orderCode) missing.push('orderCode');
  if (!orderName) missing.push('orderName');
  if (!idempotencyKey) missing.push('idempotencyKey');
  if (kind && !ORDER_KINDS.has(kind)) invalid.push('kind');
  if (priority && !PRIORITIES.has(priority)) invalid.push('priority');

  const departmentKey = normalizeDepartmentKey(body.departmentKey) || ORDER_KIND_TO_DEPARTMENT[kind as keyof typeof ORDER_KIND_TO_DEPARTMENT] || null;
  if (!departmentKey) invalid.push('departmentKey');

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  if (kind === 'MEDICATION') {
    const validationResult = medicationOrderMetaSchema.safeParse(body.meta);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid medication order',
          details: validationResult.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
  }

  const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
  if (deathGuard) return deathGuard;

  const encounter = await prisma.encounterCore.findFirst({
    where: { tenantId, id: encounterCoreId },
  });
  if (!encounter) {
    return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
  }
  if (String(encounter.status || '') === 'CLOSED') {
    return NextResponse.json({ error: 'Encounter is closed' }, { status: 409 });
  }

  // ── Clinical Safety Gates (MEDICATION only) ──────────────────────────────
  if (kind === 'MEDICATION') {
    const patientId = encounter.patientId;

    // 1) Allergy check — fetch patient allergies and check against drug
    const patientAllergies = await prisma.patientAllergy.findMany({
      where: { patientId, status: 'active' },
      select: { allergen: true, reaction: true, severity: true, onsetDate: true },
    });

    if (patientAllergies.length > 0) {
      const allergyResult = checkDrugAllergy(orderName, patientAllergies.map(a => ({
        allergen: a.allergen,
        reaction: a.reaction ?? undefined,
        severity: (a.severity as string) ?? undefined,
        onsetDate: a.onsetDate ? a.onsetDate.toISOString() : undefined,
      })) as any);

      if (!allergyResult.safe) {
        const critical = allergyResult.alerts.filter(a => a.requiresOverride);
        if (critical.length > 0 && !body.overrideAllergyCheck) {
          return NextResponse.json({
            error: 'ALLERGY_ALERT',
            code: 'CLINICAL_ALLERGY_BLOCK',
            message: critical[0].message,
            messageAr: critical[0].messageAr,
            alerts: allergyResult.alerts,
            requiresOverride: true,
          }, { status: 422 });
        }
        // Non-critical alerts or override provided — attach to order meta as warnings
        if (!body.meta) body.meta = {};
        body.meta._allergyAlerts = allergyResult.alerts;
        if (body.overrideAllergyCheck) {
          body.meta._allergyOverriddenBy = userId;
          body.meta._allergyOverriddenAt = new Date().toISOString();
        }
      }
    }

    // 2) Duplicate therapy check — fetch active medications for this patient
    const activeMeds = await prisma.ordersHub.findMany({
      where: {
        tenantId,
        patientMasterId: patientId,
        kind: 'MEDICATION',
        status: { in: ['ORDERED', 'IN_PROGRESS', 'ACCEPTED'] },
      },
      select: { orderCode: true, orderName: true, status: true, createdAt: true },
    });

    if (activeMeds.length > 0) {
      const dupeAlerts = checkDuplicateTherapy(
        orderName,
        activeMeds.map(m => ({
          drugCode: m.orderCode,
          drugName: m.orderName,
          startDate: m.createdAt.toISOString(),
          status: 'active' as const,
        }))
      );

      const highSeverity = dupeAlerts.filter(d => d.severity === 'high');
      if (highSeverity.length > 0 && !body.overrideDuplicateCheck) {
        return NextResponse.json({
          error: 'DUPLICATE_THERAPY_ALERT',
          code: 'CLINICAL_DUPLICATE_BLOCK',
          message: highSeverity[0].message,
          messageAr: highSeverity[0].messageAr,
          alerts: dupeAlerts,
          requiresOverride: true,
        }, { status: 422 });
      }
      if (dupeAlerts.length > 0) {
        if (!body.meta) body.meta = {};
        body.meta._duplicateAlerts = dupeAlerts;
        if (body.overrideDuplicateCheck) {
          body.meta._duplicateOverriddenBy = userId;
          body.meta._duplicateOverriddenAt = new Date().toISOString();
        }
      }
    }
  }

  let procedureCharge: { id: string; code: string } | null = null;
  if (kind === 'PROCEDURE') {
    procedureCharge = await prisma.billingChargeCatalog.findFirst({
      where: { tenantId, code: orderCode, itemType: 'PROCEDURE' },
    });
    if (!procedureCharge) {
      return NextResponse.json({ error: 'Procedure charge not found', code: 'PROCEDURE_CODE_REQUIRED' }, { status: 400 });
    }
  }

  const existing = await prisma.ordersHub.findFirst({
    where: { tenantId, idempotencyKey },
  });
  if (existing) {
    return NextResponse.json({ order: existing, noOp: true });
  }

  const now = new Date();
  const orderData = {
    id: uuidv4(),
    tenantId,
    encounterCoreId,
    patientMasterId: encounter.patientId,
    sourceSystem: 'OPD',
    sourceEncounterId: encounterCoreId,
    sourceDepartment: departmentKey || null,
    kind,
    departmentKey,
    orderCode,
    orderName,
    priority,
    clinicalText,
    status: 'ORDERED',
    orderedAt: now,
    acceptedAt: null,
    inProgressAt: null,
    resultedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    assignedToUserId: null,
    assignedToDept: null,
    meta:
      body.meta && typeof body.meta === 'object'
        ? {
            ...body.meta,
            ...(procedureCharge
              ? { procedureChargeId: procedureCharge.id, procedureChargeCode: procedureCharge.code }
              : {}),
          }
        : procedureCharge
        ? { procedureChargeId: procedureCharge.id, procedureChargeCode: procedureCharge.code }
        : null,
    idempotencyKey,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: userId,
  };

  let order: Awaited<ReturnType<typeof prisma.ordersHub.create>>;
  try {
    order = await prisma.ordersHub.create({ data: orderData as Parameters<typeof prisma.ordersHub.create>[0]['data'] });
  } catch (err: unknown) {
    // Handle unique constraint violation (Prisma P2002 = duplicate key)
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
      const fallback = await prisma.ordersHub.findFirst({
        where: { tenantId, idempotencyKey },
      });
      if (fallback) {
        return NextResponse.json({ order: fallback, noOp: true });
      }
    }
    throw err;
  }

  await appendOrderEvent({
    tenantId,
    orderId: order.id,
    encounterCoreId,
    type: 'PLACE',
    time: now,
    actorUserId: userId || null,
    actorDisplay: user?.email || null,
    payload: { kind, departmentKey },
  });
  await auditOrder({
    tenantId,
    orderId: order.id,
    action: 'PLACE',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { after: order },
  });

  // ── Pharmacy Bridge (MEDICATION only) ────────────────────────────────────
  // Fire-and-forget: errors here must never fail the order creation response.
  if (kind === 'MEDICATION') {
    const patient = await prisma.patientMaster.findFirst({
      where: { id: encounter.patientId },
      select: { fullName: true, mrn: true },
    }).catch(() => null);

    bridgeOrderToPharmacy(prisma, {
      order: { ...order, meta: order.meta ?? {} },
      encounter: {
        patientId: encounter.patientId,
        doctorId: (encounter as unknown as { doctorId?: string }).doctorId ?? null,
        doctorName: (encounter as unknown as { doctorName?: string }).doctorName ?? null,
      },
      patient,
      prescribedByUser: user ? { displayName: (user as unknown as { displayName?: string }).displayName, email: user.email } : null,
    }).catch(() => {});
  }

  return NextResponse.json({ order });
}), {
  tenantScoped: true,
  platformKey: 'thea_health',
  permissionKeys: ['orders.hub.view', 'opd.doctor.encounter.view', 'opd.doctor.orders.create', 'opd.prescription.create'],
});
