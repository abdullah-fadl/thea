import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { allocateChargeCatalogCode, getChargeCodePrefix } from '@/lib/billing/chargeCatalogCode';
import { requireAdminDeleteCode } from '@/lib/clinicalInfra/access';
import { validateBody } from '@/lib/validation/helpers';
import { createChargeCatalogSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { normalizeArabicNumerals } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEPARTMENTS = new Set(['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER']);
const ITEM_TYPES = new Set([
  'VISIT',
  'LAB_TEST',
  'IMAGING',
  'PROCEDURE',
  'MEDICATION',
  'BED',
  'SUPPLY',
  'SERVICE',
]);
const APPLICABILITY = new Set(['ER', 'OPD', 'IPD', 'ICU', 'OR']);
const UNIT_TYPES = new Set(['PER_VISIT', 'PER_TEST', 'PER_DAY', 'PER_PROCEDURE', 'PER_DOSE']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const CONTROLLED_FLAG = 'CONTROLLED';
const FLAG_SET = new Set([CONTROLLED_FLAG]);

function normalizeApplicability(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/g) : [];
  const normalized = raw
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((v) => APPLICABILITY.has(v));
  return Array.from(new Set(normalized));
}

function normalizeFlags(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/g) : [];
  const normalized = raw
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((v) => FLAG_SET.has(v));
  return Array.from(new Set(normalized));
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const department = String(
    req.nextUrl.searchParams.get('departmentDomain') || req.nextUrl.searchParams.get('department') || ''
  )
    .trim()
    .toUpperCase();
  const status = String(req.nextUrl.searchParams.get('status') || '').trim().toUpperCase();
  const itemType = String(req.nextUrl.searchParams.get('itemType') || req.nextUrl.searchParams.get('type') || '')
    .trim()
    .toUpperCase();
  const search = normalizeArabicNumerals(String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim());
  const controlledOnly = String(req.nextUrl.searchParams.get('controlledOnly') || '').trim().toLowerCase() === 'true';

  const where: any = { tenantId };
  if (department && DEPARTMENTS.has(department)) {
    where.departmentDomain = department;
  }
  if (status && STATUSES.has(status)) {
    where.status = status;
  }
  if (itemType && ITEM_TYPES.has(itemType)) {
    where.itemType = itemType;
  }
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (controlledOnly) {
    where.flags = { has: CONTROLLED_FLAG };
  }

  const items = await prisma.billingChargeCatalog.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }],
    take: 200,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
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

  const v = validateBody(body, createChargeCatalogSchema);
  if ('error' in v) return v.error;

  const name = String(v.data.name || '').trim();
  const departmentDomain = String(v.data.departmentDomain || '').trim().toUpperCase();
  const itemType = String(v.data.itemType || '').trim().toUpperCase();
  const unitType = String(v.data.unitType || '').trim().toUpperCase();
  const basePrice = v.data.basePrice;
  const allowedForCash = v.data.allowedForCash;
  const allowedForInsurance = v.data.allowedForInsurance;
  const status = String(v.data.status || 'ACTIVE').trim().toUpperCase();
  const applicability = normalizeApplicability(v.data.applicability);
  const flags = normalizeFlags(v.data.flags);
  const labSpecimen = v.data.labSpecimen !== undefined ? String(v.data.labSpecimen || '').trim() : null;
  const labMethod = v.data.labMethod !== undefined ? String(v.data.labMethod || '').trim() : null;
  const labPrepNotes = v.data.labPrepNotes !== undefined ? String(v.data.labPrepNotes || '').trim() : null;
  const radModality = v.data.radModality !== undefined ? String(v.data.radModality || '').trim() : null;
  const radBodySite = v.data.radBodySite !== undefined ? String(v.data.radBodySite || '').trim() : null;
  const radContrastRequired =
    v.data.radContrastRequired !== undefined ? Boolean(v.data.radContrastRequired) : null;

  const prefixConfig = getChargeCodePrefix(itemType);
  if (!prefixConfig) {
    return NextResponse.json({ error: 'Unknown type prefix' }, { status: 400 });
  }
  const code = await allocateChargeCatalogCode({ tenantId, itemType });
  if (!code) {
    return NextResponse.json({ error: 'Unable to allocate code' }, { status: 500 });
  }

  const now = new Date();
  const chargeId = uuidv4();

  try {
    const charge = await prisma.billingChargeCatalog.create({
      data: {
        id: chargeId,
        tenantId,
        code,
        name,
        itemType,
        departmentDomain: departmentDomain || null,
        applicability,
        flags,
        unitType,
        basePrice,
        allowedForCash,
        allowedForInsurance,
        status,
        createdAt: now,
        createdByUserId: userId,
        labSpecimen: itemType === 'LAB_TEST' ? labSpecimen : null,
        labMethod: itemType === 'LAB_TEST' ? labMethod : null,
        labPrepNotes: itemType === 'LAB_TEST' ? labPrepNotes : null,
        radModality: itemType === 'IMAGING' ? radModality : null,
        radBodySite: itemType === 'IMAGING' ? radBodySite : null,
        radContrastRequired: itemType === 'IMAGING' ? radContrastRequired : null,
      },
    });

    await createAuditLog(
      'charge_catalog',
      charge.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: charge },
      tenantId
    );

    return NextResponse.json({ charge });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Charge code already exists' }, { status: 409 });
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
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

  const rawIds = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
  const ids = rawIds.map((v: any) => String(v || '').trim()).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: 'id(s) are required' }, { status: 400 });

  const existing = await prisma.billingChargeCatalog.findMany({
    where: { tenantId, id: { in: ids } },
  });
  if (!existing.length) return NextResponse.json({ error: 'Charge not found' }, { status: 404 });

  await prisma.billingChargeCatalog.deleteMany({
    where: { tenantId, id: { in: ids } },
  });

  for (const item of existing) {
    await createAuditLog(
      'charge_catalog',
      item.id,
      'DELETE',
      userId || 'system',
      user?.email,
      { before: item },
      tenantId
    );
  }

  return NextResponse.json({ ok: true, deletedCount: existing.length });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
