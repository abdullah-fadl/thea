import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { allocateChargeCatalogCode, getChargeCodePrefix } from '@/lib/billing/chargeCatalogCode';
import { allocateSupplyCatalogCode } from '@/lib/billing/supplyCatalogCode';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { normalizeArabicNumerals } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const APPLICABILITY = new Set(['ER', 'OPD', 'IPD', 'ICU', 'OR']);
const UNIT_TYPES = new Set(['PER_VISIT', 'PER_TEST', 'PER_DAY', 'PER_PROCEDURE', 'PER_DOSE']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const DEPARTMENTS = new Set(['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER']);

function normalizeApplicability(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/g) : [];
  const normalized = raw
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((v) => APPLICABILITY.has(v));
  return Array.from(new Set(normalized));
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const search = normalizeArabicNumerals(String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim());
  const where: any = { tenantId };
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.suppliesCatalog.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
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
    name: z.string().min(1),
    category: z.union([z.string(), z.null()]).optional(),
    usageUnit: z.union([z.string(), z.null()]).optional(),
    description: z.union([z.string(), z.null()]).optional(),
    generateCharge: z.boolean().optional(),
    chargeCatalogId: z.string().optional(),
    chargeCode: z.string().optional(),
    basePrice: z.union([z.number(), z.string()]).optional(),
    unitType: z.string().optional(),
    applicability: z.unknown().optional(),
    allowedForCash: z.boolean().optional(),
    allowedForInsurance: z.boolean().optional(),
    status: z.string().optional(),
    departmentDomain: z.union([z.string(), z.null()]).optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const name = String(body.name || '').trim();
  const category = String(body.category || '').trim();
  const usageUnit = String(body.usageUnit || '').trim();
  const description = String(body.description || '').trim();
  const generateCharge = Boolean(body.generateCharge);
  const chargeCatalogId = String(body.chargeCatalogId || '').trim();
  const chargeCode = String(body.chargeCode || '').trim().toUpperCase();
  const basePrice = Number(body.basePrice);
  const unitType = String(body.unitType || '').trim().toUpperCase();
  const applicability = normalizeApplicability(body.applicability);
  const allowedForCash = Boolean(body.allowedForCash);
  const allowedForInsurance = Boolean(body.allowedForInsurance);
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();
  const departmentDomain = String(body.departmentDomain || '').trim().toUpperCase();

  const missing: string[] = [];
  const invalid: string[] = [];
  if (!name) missing.push('name');
  if (generateCharge) {
    if (Number.isNaN(basePrice)) missing.push('basePrice');
    if (!unitType) missing.push('unitType');
    if (!applicability.length) missing.push('applicability');
    if (body.allowedForCash === undefined) missing.push('allowedForCash');
    if (body.allowedForInsurance === undefined) missing.push('allowedForInsurance');
  }
  if (unitType && !UNIT_TYPES.has(unitType)) invalid.push('unitType');
  if (status && !STATUSES.has(status)) invalid.push('status');
  if (departmentDomain && !DEPARTMENTS.has(departmentDomain)) invalid.push('departmentDomain');
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const existingByName = await prisma.suppliesCatalog.findFirst({
    where: { tenantId, nameLower: name.toLowerCase() },
  });
  if (existingByName) {
    return NextResponse.json({ error: 'Supply name already exists' }, { status: 409 });
  }

  let linkedCharge: any = null;
  let chargeGenerated = false;
  if (generateCharge || chargeCatalogId || chargeCode) {
    if (generateCharge) {
      if (!getChargeCodePrefix('SUPPLY')) {
        return NextResponse.json({ error: 'Unknown type prefix' }, { status: 400 });
      }
      const code = await allocateChargeCatalogCode({ tenantId, itemType: 'SUPPLY' });
      if (!code) return NextResponse.json({ error: 'Unable to allocate code' }, { status: 500 });
      const now = new Date();
      linkedCharge = await prisma.billingChargeCatalog.create({
        data: {
          id: uuidv4(),
          tenantId,
          code,
          name,
          itemType: 'SUPPLY',
          departmentDomain: departmentDomain || null,
          applicability,
          flags: [],
          unitType,
          basePrice,
          allowedForCash,
          allowedForInsurance,
          status,
          createdAt: now,
          createdByUserId: userId,
        },
      });
      chargeGenerated = true;
    } else {
      linkedCharge = chargeCatalogId
        ? await prisma.billingChargeCatalog.findFirst({ where: { tenantId, id: chargeCatalogId } })
        : await prisma.billingChargeCatalog.findFirst({ where: { tenantId, code: chargeCode } });
      if (!linkedCharge || linkedCharge.itemType !== 'SUPPLY') {
        return NextResponse.json({ error: 'Supply charge not found' }, { status: 404 });
      }
      const duplicate = await prisma.suppliesCatalog.findFirst({
        where: { tenantId, chargeCatalogId: linkedCharge.id },
      });
      const medicationLink = await prisma.medicationCatalog.findFirst({
        where: { tenantId, chargeCatalogId: linkedCharge.id },
      });
      const serviceLink = await prisma.serviceCatalog.findFirst({
        where: { tenantId, chargeCatalogId: linkedCharge.id },
      });
      if (duplicate || medicationLink || serviceLink) {
        return NextResponse.json({ error: 'Charge already linked to another catalog' }, { status: 409 });
      }
    }
  }

  const now = new Date();
  const code = await allocateSupplyCatalogCode({ tenantId });
  const item = await prisma.suppliesCatalog.create({
    data: {
      id: uuidv4(),
      tenantId,
      code,
      name,
      nameLower: name.toLowerCase(),
      category: category || null,
      usageUnit: usageUnit || null,
      description: description || null,
      chargeCatalogId: linkedCharge?.id || null,
      chargeCode: linkedCharge?.code || null,
      chargeGenerated,
      status,
      createdAt: now,
      createdByUserId: userId,
    },
  });

  await createAuditLog(
    'supplies_catalog',
    item.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: item },
    tenantId
  );

  return NextResponse.json({ item });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });

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

  const deleteSchema = z.object({ id: z.string().min(1) }).passthrough();
  const vd = validateBody(body, deleteSchema);
  if ('error' in vd) return vd.error;

  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existing = await prisma.suppliesCatalog.findFirst({ where: { tenantId, id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.suppliesCatalog.delete({ where: { id } });
  if (existing.chargeGenerated && existing.chargeCatalogId) {
    await prisma.billingChargeCatalog.deleteMany({ where: { tenantId, id: existing.chargeCatalogId } });
  }

  await createAuditLog(
    'supplies_catalog',
    id,
    'DELETE',
    userId || 'system',
    user?.email,
    { before: existing },
    tenantId
  );

  return NextResponse.json({ ok: true });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });
