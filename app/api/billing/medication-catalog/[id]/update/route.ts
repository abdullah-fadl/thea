import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { requireAdminDeleteCode } from '@/lib/clinicalInfra/access';
import { validateBody } from '@/lib/validation/helpers';
import { updateMedicationCatalogSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROUTES = new Set(['PO', 'IV', 'IM', 'SC', 'INH', 'LOCAL']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const CONTROLLED_FLAG = 'CONTROLLED';

function normalizeRoutes(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/g) : [];
  const normalized = raw
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((v) => ROUTES.has(v));
  return Array.from(new Set(normalized));
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const id = String((params as Record<string, string>)?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateMedicationCatalogSchema);
  if ('error' in v) return v.error;

  const guard = requireAdminDeleteCode(req, body);
  if (guard) return guard;

  const existing = await prisma.medicationCatalog.findFirst({
    where: { tenantId, id },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const genericName = body.genericName !== undefined ? String(body.genericName || '').trim() : existing.genericName;
  const form = body.form !== undefined ? String(body.form || '').trim().toUpperCase() : existing.form;
  const strength = body.strength !== undefined ? String(body.strength || '').trim() : existing.strength;
  const routes = body.routes !== undefined ? normalizeRoutes(body.routes) : existing.routes;
  const chargeCatalogId = String(body.chargeCatalogId || '').trim();
  const chargeCode = String(body.chargeCode || '').trim().toUpperCase();
  const nextIsControlled =
    body.isControlled !== undefined ? Boolean(body.isControlled) : Boolean(existing.isControlled);
  const currentStatus = String(existing.status || 'ACTIVE').trim().toUpperCase();
  const nextStatus = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : currentStatus;
  const nextControlledSchedule =
    body.controlledSchedule !== undefined
      ? String(body.controlledSchedule || '').trim().toUpperCase()
      : existing.controlledSchedule || null;
  const nextControlledClass =
    body.controlledClass !== undefined
      ? String(body.controlledClass || '').trim().toUpperCase()
      : existing.controlledClass || null;

  const invalid: string[] = [];
  if (body.routes !== undefined && !routes.length) invalid.push('routes');
  if (body.genericName !== undefined && !genericName) invalid.push('genericName');
  if (body.form !== undefined && !form) invalid.push('form');
  if (body.strength !== undefined && !strength) invalid.push('strength');
  if (body.status !== undefined && !STATUSES.has(nextStatus)) invalid.push('status');
  if (invalid.length) return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });

  let nextChargeCatalogId = existing.chargeCatalogId;
  let nextChargeCode = existing.chargeCode;
  if (chargeCatalogId || chargeCode) {
    const catalog = chargeCatalogId
      ? await prisma.billingChargeCatalog.findFirst({ where: { tenantId, id: chargeCatalogId } })
      : await prisma.billingChargeCatalog.findFirst({ where: { tenantId, code: chargeCode } });
    if (!catalog) return NextResponse.json({ error: 'Charge catalog item not found' }, { status: 404 });
    if (String(catalog.itemType || '') !== 'MEDICATION') {
      return NextResponse.json({ error: 'Charge is not a medication item' }, { status: 409 });
    }
    const existingLink = await prisma.medicationCatalog.findFirst({
      where: { tenantId, chargeCatalogId: catalog.id, id: { not: id } },
    });
    if (existingLink) {
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
    nextChargeCatalogId = catalog.id;
    nextChargeCode = catalog.code;
  }
  if (nextChargeCatalogId) {
    // Update flags on charge catalog item
    const chargeCatalog = await prisma.billingChargeCatalog.findFirst({
      where: { tenantId, id: nextChargeCatalogId },
    });
    if (chargeCatalog) {
      const currentFlags: string[] = chargeCatalog.flags || [];
      const newFlags = nextIsControlled
        ? Array.from(new Set([...currentFlags, CONTROLLED_FLAG]))
        : currentFlags.filter((f: string) => f !== CONTROLLED_FLAG);
      const updateData: any = { flags: newFlags };
      if (body.status !== undefined) {
        updateData.status = nextStatus;
      }
      await prisma.billingChargeCatalog.update({
        where: { id: nextChargeCatalogId },
        data: updateData,
      });
    }
  }

  const patch: any = {};
  if (genericName !== existing.genericName) patch.genericName = genericName;
  if (form !== existing.form) patch.form = form;
  if (strength !== existing.strength) patch.strength = strength;
  if (JSON.stringify(routes) !== JSON.stringify(existing.routes)) patch.routes = routes;
  if (nextChargeCatalogId !== existing.chargeCatalogId) patch.chargeCatalogId = nextChargeCatalogId;
  if (nextChargeCode !== existing.chargeCode) patch.chargeCode = nextChargeCode;
  if (nextIsControlled !== Boolean(existing.isControlled)) patch.isControlled = nextIsControlled;
  if (nextControlledSchedule !== (existing.controlledSchedule || null)) patch.controlledSchedule = nextControlledSchedule;
  if (nextControlledClass !== (existing.controlledClass || null)) patch.controlledClass = nextControlledClass;
  if (body.status !== undefined && nextStatus !== currentStatus) patch.status = nextStatus;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ item: existing, noOp: true });
  }

  const updated = await prisma.medicationCatalog.update({
    where: { id },
    data: patch,
  });

  await createAuditLog(
    'medication_catalog',
    id,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: existing, after: updated },
    tenantId
  );

  return NextResponse.json({ item: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
