import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { allocateMedicationCatalogCode } from '@/lib/billing/medicationCatalogCode';
import { allocateChargeCatalogCode } from '@/lib/billing/chargeCatalogCode';
import { validateBody } from '@/lib/validation/helpers';
import { bulkMedicationCatalogSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

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

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('genericname') || header.includes('name');
  const rows = hasHeader ? lines.slice(1) : lines;
  const headerCols = hasHeader ? lines[0].split(',').map((c) => c.trim().toLowerCase()) : [];
  return rows.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    if (!hasHeader) {
      const [genericName, form, strength, routes, chargeCode, basePrice, isControlled, controlledSchedule, controlledClass] =
        cols;
      return { genericName, form, strength, routes, chargeCode, basePrice, isControlled, controlledSchedule, controlledClass };
    }
    const row: Record<string, string> = {};
    headerCols.forEach((key, idx) => {
      row[key] = cols[idx] || '';
    });
    return {
      genericName: row.genericname || row.name,
      form: row.form,
      strength: row.strength,
      routes: row.routes,
      chargeCode: row.chargecode || row.charge_code,
      basePrice: row.baseprice || row.base_price,
      isControlled: row.iscontrolled || row.controlled,
      controlledSchedule: row.controlledschedule || row.controlled_schedule,
      controlledClass: row.controlledclass || row.controlled_class,
    };
  });
}

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

  const v = validateBody(body, bulkMedicationCatalogSchema);
  if ('error' in v) return v.error;

  const itemsInput: any[] = Array.isArray(body.items) ? body.items : body.csvText ? parseCsv(String(body.csvText || '')) : [];
  if (!itemsInput.length) {
    return NextResponse.json({ error: 'No items provided' }, { status: 400 });
  }

  const MAX_BULK = 500;
  if (itemsInput.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Too many items. Maximum ${MAX_BULK} per request.`, code: 'BATCH_TOO_LARGE' },
      { status: 400 }
    );
  }

  const created: any[] = [];
  const errors: Array<{ index: number; error: string }> = [];

  for (let i = 0; i < itemsInput.length; i += 1) {
    const row = itemsInput[i] || {};
    const genericName = String(row.genericName || row.name || '').trim();
    const form = String(row.form || '').trim().toUpperCase();
    const strength = String(row.strength || '').trim();
    const routes = normalizeRoutes(row.routes);
    const chargeCode = String(row.chargeCode || '').trim().toUpperCase();
    const chargeCatalogId = String(row.chargeCatalogId || '').trim();
    const basePrice = row.basePrice !== undefined && row.basePrice !== '' ? Number(row.basePrice) : Number.NaN;
    const isControlled =
      row.isControlled !== undefined
        ? Boolean(row.isControlled)
        : String(row.isControlled || row.iscontrolled || '').toLowerCase() === 'true';
    const controlledSchedule = String(row.controlledSchedule || '').trim().toUpperCase() || null;
    const controlledClass = String(row.controlledClass || '').trim().toUpperCase() || null;

    if (!genericName || !form || !strength || !routes.length || (!chargeCatalogId && !chargeCode && Number.isNaN(basePrice))) {
      errors.push({ index: i, error: 'Missing required fields' });
      continue;
    }

    let catalog = null as any;
    if (chargeCatalogId || chargeCode) {
      catalog = chargeCatalogId
        ? await prisma.billingChargeCatalog.findFirst({ where: { tenantId, id: chargeCatalogId } })
        : await prisma.billingChargeCatalog.findFirst({ where: { tenantId, code: chargeCode } });
      if (!catalog) {
        errors.push({ index: i, error: 'Charge catalog item not found' });
        continue;
      }
      if (String(catalog.itemType || '') !== 'MEDICATION') {
        errors.push({ index: i, error: 'Charge is not a medication item' });
        continue;
      }
      const existingMedication = await prisma.medicationCatalog.findFirst({
        where: { tenantId, chargeCatalogId: catalog.id },
      });
      if (existingMedication) {
        errors.push({ index: i, error: 'Medication already linked' });
        continue;
      }
      // Check supplies_catalog link (no Prisma model, use raw SQL)
      const supplyLinks: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "supplies_catalog" WHERE "tenantId" = $1 AND "chargeCatalogId" = $2 LIMIT 1`,
        tenantId, catalog.id
      );
      if (supplyLinks.length) {
        errors.push({ index: i, error: 'Charge already linked to supplies catalog' });
        continue;
      }
      // Check service_catalog link (no Prisma model, use raw SQL)
      const serviceLinks: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "service_catalog" WHERE "tenantId" = $1 AND "chargeCatalogId" = $2 LIMIT 1`,
        tenantId, catalog.id
      );
      if (serviceLinks.length) {
        errors.push({ index: i, error: 'Charge already linked to service catalog' });
        continue;
      }
    } else {
      const code = await allocateChargeCatalogCode({ tenantId, itemType: 'MEDICATION' });
      if (!code) {
        errors.push({ index: i, error: 'Charge code allocation failed' });
        continue;
      }
      const now = new Date();
      const chargeName = [genericName, strength, form].filter(Boolean).join(' ');
      const applicability = normalizeApplicability(row.applicability).length ? normalizeApplicability(row.applicability) : ['ER'];
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
            allowedForCash: true,
            allowedForInsurance: true,
            status: 'ACTIVE',
            createdAt: now,
            createdByUserId: userId,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          errors.push({ index: i, error: 'Charge code already exists' });
        } else {
          errors.push({ index: i, error: 'Charge insert failed' });
        }
        continue;
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
      errors.push({ index: i, error: 'Code allocation failed' });
      continue;
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
      created.push(item);
      await createAuditLog(
        'medication_catalog',
        item.id,
        'CREATE',
        userId || 'system',
        user?.email,
        { after: item },
        tenantId
      );
    } catch (err: any) {
      if (err?.code === 'P2002') {
        errors.push({ index: i, error: 'Medication code already exists' });
      } else {
        errors.push({ index: i, error: 'Insert failed' });
      }
    }
  }

  return NextResponse.json({ createdCount: created.length, errorCount: errors.length, created, errors });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.manage' }
);
