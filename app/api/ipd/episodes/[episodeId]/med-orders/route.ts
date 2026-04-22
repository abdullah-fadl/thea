import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { canAccessChargeConsole } from '@/lib/er/chargeAccess';
import { computeMarDue } from '@/lib/ipd/marDue';
import { buildMedicationSafetyFlags } from '@/lib/ipd/medSafety';
import { appendOrderEvent, auditOrder } from '@/lib/orders/ordersHub';
import { ensureNotDeceasedFinalized } from '@/lib/core/guards/deathGuard';
import { validateBody } from '@/lib/validation/helpers';
import { createMedOrderSchema } from '@/lib/validation/ipd.schema';
import type { OrdersHub, IpdEpisode, MedicationCatalog } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROUTES = ['PO', 'IV', 'IM', 'SC', 'INH', 'LOCAL'] as const;
const TYPES = ['STAT', 'PRN', 'SCHEDULED'] as const;
const SCHEDULES = ['Q6H', 'Q8H', 'Q12H', 'Q24H'] as const;

function normalizeName(v: unknown): string {
  return String(v || '').trim().toLowerCase();
}

function parseDateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Medication metadata embedded in OrdersHub.meta */
interface MedicationMeta {
  medicationName?: string;
  medicationCatalogId?: string | null;
  route?: string;
  orderType?: string;
  frequency?: string;
  doseValue?: string;
  doseUnit?: string;
  startAt?: string | Date;
  durationDays?: number | null;
  maxPer24h?: number | null;
  indication?: string | null;
  notes?: string | null;
  orderingDoctorId?: string | null;
  isNarcotic?: boolean;
  episodeId?: string;
}

/** OrdersHub.meta shape */
interface OrderMeta {
  medication?: MedicationMeta;
}

/** Mapped medication order */
interface MappedMedOrder {
  id: string;
  tenantId: string;
  episodeId: string;
  encounterId: string | null;
  drugName: string;
  medicationCatalogId: string | null;
  drugNameNormalized: string;
  dose: string;
  doseUnit: string;
  route: string;
  type: string;
  schedule: string | null;
  startAt: Date;
  endAt: Date | null;
  prnMaxPer24h: number | null;
  indication: string | null;
  note: string | null;
  orderingDoctorId: string | null;
  isNarcotic: boolean;
  createdAt: Date;
  status: string;
}

function mapOrderToMed(order: OrdersHub): MappedMedOrder {
  const meta = (order.meta as OrderMeta | null) || {};
  const medication = meta.medication || {};
  const medicationName = String(medication.medicationName || order.orderName || '').trim();
  const medicationCatalogId = medication.medicationCatalogId || null;
  const route = String(medication.route || '').trim().toUpperCase();
  const orderType = String(medication.orderType || '').trim().toUpperCase();
  const frequency = String(medication.frequency || '').trim().toUpperCase();
  const doseValue = String(medication.doseValue || '').trim();
  const doseUnit = String(medication.doseUnit || '').trim();
  const startAt = medication.startAt ? new Date(medication.startAt as string | number) : null;
  const durationDays = medication.durationDays != null ? Number(medication.durationDays) : null;
  const endAt = startAt && Number.isFinite(durationDays) && durationDays! > 0 ? addDays(startAt, durationDays!) : null;
  return {
    id: order.id,
    tenantId: order.tenantId,
    episodeId: String(medication.episodeId || ''),
    encounterId: order.encounterCoreId,
    drugName: medicationName,
    medicationCatalogId,
    drugNameNormalized: normalizeName(medicationName),
    dose: doseValue,
    doseUnit,
    route,
    type: orderType,
    schedule: frequency || null,
    startAt: startAt || order.createdAt,
    endAt: endAt || null,
    prnMaxPer24h: medication.maxPer24h ?? null,
    indication: medication.indication || null,
    note: medication.notes || null,
    orderingDoctorId: medication.orderingDoctorId || null,
    isNarcotic: Boolean(medication.isNarcotic),
    createdAt: order.createdAt,
    status: order.status || 'PLACED',
  };
}

async function ensureEncounterWritable(tenantId: string, encounterCoreId: string) {
  const encounter = await prisma.encounterCore.findFirst({ where: { tenantId, id: encounterCoreId } });
  if (!encounter) return { error: 'Encounter not found', status: 404 as const };
  if (String(encounter.status || '').toUpperCase() === 'CLOSED') {
    return { error: 'Encounter is closed', status: 409 as const };
  }
  const discharge = await prisma.dischargeSummary.findFirst({ where: { tenantId, encounterCoreId } });
  if (discharge) {
    return { error: 'Discharge finalized', status: 409 as const };
  }
  return { encounter };
}

/** IpdEpisode riskFlags JSON shape */
interface RiskFlags {
  allergies?: Array<{ allergen?: string; [key: string]: unknown }>;
}

/** IpdEpisode ownership JSON shape */
interface Ownership {
  attendingPhysicianUserId?: string;
  primaryInpatientNurseUserId?: string;
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user }, params) => {

  const routeParams = (params || {}) as any;
  const episodeId = String(routeParams.episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode.encounterId || '').trim();
  const riskFlags = (episode.riskFlags as RiskFlags | null) || {};
  const allergies = Array.isArray(riskFlags.allergies) ? riskFlags.allergies : [];
  const ordersHub = await prisma.ordersHub.findMany({
    where: { tenantId, encounterCoreId, kind: 'MEDICATION' },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const items = ordersHub.map(mapOrderToMed);
  const orderIds = items.map((o) => o.id).filter(Boolean);
  const events = await prisma.ipdMedOrderEvent.findMany({
    where: { tenantId, orderId: { in: orderIds } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  const latestByOrder: Record<string, typeof events[number]> = {};
  for (const ev of events) {
    if (!latestByOrder[ev.orderId]) latestByOrder[ev.orderId] = ev;
  }
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEvents = await prisma.ipdMarEvent.findMany({
    where: { tenantId, episodeId, scheduledFor: { gte: windowStart, lte: windowEnd } },
    orderBy: { performedAt: 'desc' },
    take: 500,
  });
  const { overdueCountByOrder } = computeMarDue({
    orders: items,
    latestByOrder,
    windowEvents,
    now,
  });
  const safetyByOrder = buildMedicationSafetyFlags(items, allergies);
  const enriched = items.map((o) => {
    const safety = safetyByOrder[o.id] || {
      allergyConflict: false,
      duplicateWarning: false,
      highRisk: false,
      existingOrderIds: [],
    };
    return {
      ...o,
      currentStatus: latestByOrder[o.id]?.status || o.status || 'DRAFT',
      allergyConflict: safety.allergyConflict,
      duplicateWarning: safety.duplicateWarning,
      highRisk: safety.highRisk,
      overdueDoseCount: overdueCountByOrder[o.id] || 0,
    };
  });

  return NextResponse.json({ items: enriched });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, userId }, params) => {

  const role = String(user?.role || '');
  const dev = false;
  const charge = canAccessChargeConsole({ email: user?.email, tenantId, role });

  const routeParams = (params || {}) as any;
  const episodeId = String(routeParams.episodeId || '').trim();
  if (!episodeId) {
    return NextResponse.json({ error: 'episodeId is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createMedOrderSchema);
  if ('error' in v) return v.error;

  const medicationCatalogId = String(body.medicationCatalogId || '').trim();
  const medicationName = String(body.medicationName || '').trim();
  const orderType = String(body.orderType || '').trim().toUpperCase();
  const doseValue = String(body.doseValue || '').trim();
  const doseUnit = String(body.doseUnit || '').trim();
  const route = String(body.route || '').trim().toUpperCase();
  const frequency = String(body.frequency || '').trim().toUpperCase();
  const durationDays = body.durationDays == null || body.durationDays === '' ? null : Number(body.durationDays);
  const startAt = parseDateOrNull(body.startAt);
  const orderingDoctorId = String(body.orderingDoctorId || '').trim();
  const isNarcotic = Boolean(body.isNarcotic);
  const notes = String(body.notes || '').trim();
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  const missing: string[] = [];
  const invalid: string[] = [];
  if (!medicationCatalogId && !medicationName) missing.push('medicationCatalogId');
  if (!doseValue) missing.push('doseValue');
  if (!doseUnit) missing.push('doseUnit');
  if (!route) missing.push('route');
  if (!orderType) missing.push('orderType');
  if (!orderingDoctorId) missing.push('orderingDoctorId');
  if (!idempotencyKey) missing.push('idempotencyKey');
  if (route && !(ROUTES as readonly string[]).includes(route)) invalid.push('route');
  if (orderType && !(TYPES as readonly string[]).includes(orderType)) invalid.push('orderType');
  if (orderType === 'SCHEDULED' && !frequency) missing.push('frequency');
  if (frequency && !(SCHEDULES as readonly string[]).includes(frequency)) invalid.push('frequency');
  if ((orderType === 'SCHEDULED' || orderType === 'PRN') && !startAt) missing.push('startAt');
  if (body.startAt && !startAt) invalid.push('startAt');
  if (durationDays != null && (!Number.isFinite(durationDays) || durationDays <= 0)) invalid.push('durationDays');
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const episode = await prisma.ipdEpisode.findFirst({ where: { tenantId, id: episodeId } });
  if (!episode) {
    return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
  }
  const encounterCoreId = String(episode.encounterId || '').trim();
  if (encounterCoreId) {
    const deathGuard = await ensureNotDeceasedFinalized({ tenantId, encounterCoreId });
    if (deathGuard) return deathGuard;
  }
  const guard = await ensureEncounterWritable(tenantId, encounterCoreId);
  if ('error' in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const ownership = (episode.ownership as Ownership | null) || {};
  const attendingId = String(ownership.attendingPhysicianUserId || '').trim();
  if (!dev && !charge && attendingId !== String(userId || '')) {
    return NextResponse.json(
      { error: 'Forbidden: only attending physician or charge roles can create med orders' },
      { status: 403 }
    );
  }

  const now = new Date();
  const existing = await prisma.ordersHub.findFirst({ where: { tenantId, idempotencyKey } });
  if (existing) {
    return NextResponse.json({ success: true, order: existing, noOp: true });
  }

  let resolvedMedicationName = medicationName;
  let resolvedMedicationCode: string | null = null;
  let resolvedChargeCode: string | null = null;
  let resolvedChargeCatalogId: string | null = null;
  let resolvedCatalogRoutes: string[] = [];
  if (medicationCatalogId) {
    const catalog = await prisma.medicationCatalog.findFirst({ where: { tenantId, id: medicationCatalogId } });
    if (!catalog) {
      return NextResponse.json({ error: 'Medication catalog item not found' }, { status: 404 });
    }
    resolvedMedicationName = String(catalog.genericName || '').trim();
    resolvedMedicationCode = String(catalog.code || '').trim() || null;
    resolvedChargeCode = String(catalog.chargeCode || '').trim() || null;
    resolvedChargeCatalogId = catalog.chargeCatalogId || null;
    resolvedCatalogRoutes = Array.isArray(catalog.routes)
      ? catalog.routes.map((r: string) => String(r || '').trim().toUpperCase()).filter(Boolean)
      : [];
    if (resolvedCatalogRoutes.length && !resolvedCatalogRoutes.includes(route)) {
      return NextResponse.json({ error: 'Route not allowed for medication' }, { status: 400 });
    }
  }
  if (!resolvedMedicationName) {
    return NextResponse.json({ error: 'Medication name required' }, { status: 400 });
  }

  const order = await prisma.ordersHub.create({
    data: {
      tenantId,
      encounterCoreId,
      patientMasterId: guard.encounter.patientId,
      sourceSystem: 'IPD',
      sourceEncounterId: encounterCoreId,
      kind: 'MEDICATION',
      departmentKey: 'pharmacy',
      orderCode:
        resolvedChargeCode ||
        resolvedMedicationCode ||
        `MED-${normalizeName(resolvedMedicationName).slice(0, 24).replace(/[^a-z0-9]+/g, '-')}`,
      orderName: resolvedMedicationName,
      priority: orderType === 'STAT' ? 'STAT' : 'ROUTINE',
      clinicalText: notes || null,
      status: 'ORDERED',
      cancelReason: null,
      orderedAt: now,
      acceptedAt: null,
      inProgressAt: null,
      resultedAt: null,
      completedAt: null,
      cancelledAt: null,
      assignedToUserId: null,
      meta: {
        medication: {
          episodeId,
          medicationName: resolvedMedicationName,
          medicationCatalogId: medicationCatalogId || null,
          medicationCode: resolvedMedicationCode,
          chargeCatalogId: resolvedChargeCatalogId,
          chargeCode: resolvedChargeCode,
          orderType,
          doseValue,
          doseUnit,
          route,
          frequency: frequency || null,
          durationDays: durationDays ?? null,
          startAt: startAt || now,
          orderingDoctorId,
          isNarcotic,
        },
      },
      idempotencyKey,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdByUserId: userId,
    },
  });

  await appendOrderEvent({
    tenantId,
    orderId: order.id,
    encounterCoreId,
    type: 'PLACE',
    time: now,
    actorUserId: userId || null,
    actorDisplay: user?.email || null,
    payload: { kind: 'MEDICATION', departmentKey: 'pharmacy' },
  });
  await auditOrder({
    tenantId,
    orderId: order.id,
    action: 'PLACE',
    userId: userId || null,
    userEmail: user?.email || null,
    changes: { after: order },
  });

  await prisma.ipdMedOrderEvent.create({
    data: {
      tenantId,
      episodeId,
      orderId: order.id,
      status: 'ORDERED',
      reason: null,
      createdByUserId: userId,
      createdAt: now,
    },
  });
  if (!isNarcotic) {
    await prisma.ipdMedOrderEvent.create({
      data: {
        tenantId,
        episodeId,
        orderId: order.id,
        status: 'ACTIVE',
        reason: null,
        createdByUserId: userId,
        createdAt: now,
      },
    });
  }

  const mapped = mapOrderToMed(order);
  const episodeRiskFlags = (episode.riskFlags as RiskFlags | null) || {};
  const episodeAllergies = Array.isArray(episodeRiskFlags.allergies) ? episodeRiskFlags.allergies : [];
  const safety = buildMedicationSafetyFlags([mapped], episodeAllergies);
  const duplicateWarning = safety[mapped.id]?.duplicateWarning || false;

  return NextResponse.json({ success: true, order: mapped, duplicateWarning });
}), { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'ipd.live-beds.edit' }
);
