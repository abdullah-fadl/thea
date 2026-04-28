import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { allocateMedicationCatalogCode } from '@/lib/billing/medicationCatalogCode';
import { allocateChargeCatalogCode } from '@/lib/billing/chargeCatalogCode';
import { requireAdminDeleteCode } from '@/lib/clinicalInfra/access';
import { validateBody } from '@/lib/validation/helpers';
import { createMedicationCatalogSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { normalizeArabicNumerals } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROUTES = new Set(['PO', 'IV', 'IM', 'SC', 'INH', 'LOCAL']);
const CONTROLLED_FLAG = 'CONTROLLED';
const APPLICABILITY = new Set(['ER', 'OPD', 'IPD', 'ICU', 'OR']);

function normalizeApplicability(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/g) : [];
  const normalized = raw
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((v) => APPLICABILITY.has(v));
  return Array.from(new Set(normalized));
}

function normalizeRoutes(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/g) : [];
  const normalized = raw
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((v) => ROUTES.has(v));
  return Array.from(new Set(normalized));
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const search = normalizeArabicNumerals(String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim());
  const where: any = { tenantId };
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { genericName: { contains: search, mode: 'insensitive' } },
      { chargeCode: { contains: search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.medicationCatalog.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
    take: 200,
  });

  return NextResponse.json({ items });
}),
  {
    tenantScoped: true,
    platformKey: 'thea_health',
    permissionKeys: ['billing.view', 'opd.doctor.encounter.view', 'opd.doctor.orders.create', 'opd.prescription.create', 'opd.nursing.edit'],
  }
);

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

  const v = validateBody(body, createMedicationCatalogSchema);
  if ('error' in v) return v.error;

  const genericName = String(v.data.genericName || '').trim();
  const form = String(v.data.form || '').trim().toUpperCase();
  const strength = String(v.data.strength || '').trim();
  const routes = normalizeRoutes(v.data.routes);
  const chargeCatalogId = String(v.data.chargeCatalogId || '').trim();
  const chargeCode = String(v.data.chargeCode || '').trim().toUpperCase();
  const basePrice = v.data.basePrice !== undefined && v.data.basePrice !== null ? Number(v.data.basePrice) : Number.NaN;
  const allowedForCash = v.data.allowedForCash;
  const allowedForInsurance = v.data.allowedForInsurance;
  const applicabilityInput = normalizeApplicability(v.data.applicability);
  const isControlled = Boolean(v.data.isControlled);
  const controlledSchedule = String(v.data.controlledSchedule || '').trim().toUpperCase() || null;
  const controlledClass = String(v.data.controlledClass || '').trim().toUpperCase() || null;

  let catalog = null as any;
  if (chargeCatalogId || chargeCode) {
    catalog = chargeCatalogId
      ? await prisma.billingChargeCatalog.findFirst({ where: { tenantId, id: chargeCatalogId } })
      : await prisma.billingChargeCatalog.findFirst({ where: { tenantId, code: chargeCode } });
    if (!catalog) {
      return NextResponse.json({ error: 'Charge catalog item not found' }, { status: 404 });
    }
    if (String(catalog.itemType || '') !== 'MEDICATION') {
      return NextResponse.json({ error: 'Charge is not a medication item' }, { status: 409 });
    }
    const existingMedication = await prisma.medicationCatalog.findFirst({
      where: { tenantId, chargeCatalogId: catalog.id },
    });
    if (existingMedication) {
      return NextResponse.json({ error: 'Medication already linked', code: 'MEDICATION_ALREADY_LINKED' }, { status: 409 });
    }
    // Check supplies_catalog link (no Prisma model, use raw SQL)
    const supplyLinks: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "supplies_catalog" WHERE "tenantId" = $1 AND "chargeCatalogId" = $2 LIMIT 1`,
      tenantId, catalog.id
    );
    if (supplyLinks.length) {
      return NextResponse.json({ error: 'Charge already linked to supplies catalog' }, { status: 409 });
    }
    // Check service_catalog link (no Prisma model, use raw SQL)
    const serviceLinks: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "service_catalog" WHERE "tenantId" = $1 AND "chargeCatalogId" = $2 LIMIT 1`,
      tenantId, catalog.id
    );
    if (serviceLinks.length) {
      return NextResponse.json({ error: 'Charge already linked to service catalog' }, { status: 409 });
    }
  } else {
    const code = await allocateChargeCatalogCode({ tenantId, itemType: 'MEDICATION' });
    if (!code) {
      return NextResponse.json({ error: 'Unable to allocate charge code' }, { status: 500 });
    }
    const now = new Date();
    const chargeName = [genericName, strength, form].filter(Boolean).join(' ');
    const applicability = applicabilityInput.length ? applicabilityInput : ['ER'];
    const flags = isControlled ? [CONTROLLED_FLAG] : [];
    try {
      catalog = await prisma.billingChargeCatalog.create({
        data: {
          id: uuidv4(),
          tenantId,
          code,
          name: chargeName,
          itemType: 'MEDICATION',
          departmentDomain: null,
          applicability,
          flags,
          unitType: 'PER_DOSE',
          basePrice,
          allowedForCash,
          allowedForInsurance,
          status: 'ACTIVE',
          createdAt: now,
          createdByUserId: userId,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return NextResponse.json({ error: 'Charge code already exists' }, { status: 409 });
      }
      throw err;
    }
    await createAuditLog(
      'charge_catalog',
      catalog.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: catalog },
      tenantId
    );
  }

  // Update flags on the charge catalog item
  if (catalog?.id) {
    const currentFlags: string[] = catalog.flags || [];
    const newFlags = isControlled
      ? Array.from(new Set([...currentFlags, CONTROLLED_FLAG]))
      : currentFlags.filter((f: string) => f !== CONTROLLED_FLAG);
    await prisma.billingChargeCatalog.update({
      where: { id: catalog.id },
      data: { flags: newFlags },
    });
  }

  const code = await allocateMedicationCatalogCode({ tenantId });
  if (!code) {
    return NextResponse.json({ error: 'Unable to allocate code' }, { status: 500 });
  }

  const now = new Date();

  try {
    const item = await prisma.medicationCatalog.create({
      data: {
        id: uuidv4(),
        tenantId,
        code,
        genericName,
        form,
        strength,
        routes,
        chargeCatalogId: catalog.id,
        chargeCode: catalog.code,
        isControlled,
        controlledSchedule,
        controlledClass,
        status: 'ACTIVE',
        createdAt: now,
        createdByUserId: userId,
      },
    });

    await createAuditLog(
      'medication_catalog',
      item.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: item },
      tenantId
    );

    return NextResponse.json({ item });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Medication code already exists' }, { status: 409 });
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);

export const DELETE = withAuthTenant(
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
  const guard = requireAdminDeleteCode(req, body);
  if (guard) return guard;

  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existing = await prisma.medicationCatalog.findFirst({
    where: { tenantId, id },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.medicationCatalog.delete({
    where: { id },
  });

  await createAuditLog(
    'medication_catalog',
    id,
    'DELETE',
    userId || 'system',
    user?.email,
    { before: existing },
    tenantId
  );

  return NextResponse.json({ ok: true });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
