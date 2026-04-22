import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { allocateChargeCatalogCode, getChargeCodePrefix } from '@/lib/billing/chargeCatalogCode';
import { allocateConsultationCatalogCode, allocateServiceCatalogCode } from '@/lib/billing/serviceCatalogCode';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { normalizeArabicNumerals } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const APPLICABILITY = new Set(['ER', 'OPD', 'IPD', 'ICU', 'OR']);
const STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const DEPARTMENTS = new Set(['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER']);
const SERVICE_TYPES = new Set(['VISIT', 'BED_DAY', 'NURSING', 'CONSULTATION']);

function normalizePricing(payload: any, basePrice: number) {
  const pricing = payload?.pricing || {};
  const defaultPrice = Number(pricing.default ?? basePrice);
  return {
    consultant: Number(pricing.consultant ?? defaultPrice),
    specialist: Number(pricing.specialist ?? defaultPrice),
    resident: Number(pricing.resident ?? defaultPrice),
    default: defaultPrice,
  };
}

function normalizeRules(payload: any) {
  const rules = payload?.rules || {};
  return {
    followUpFree: rules.followUpFree !== false,
    followUpDays: Number.isFinite(Number(rules.followUpDays)) ? Number(rules.followUpDays) : 14,
    requiresApproval: Boolean(rules.requiresApproval),
  };
}

function normalizeApplicability(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,|]/g) : [];
  const normalized = raw
    .map((v) => String(v || '').trim().toUpperCase())
    .filter(Boolean)
    .filter((v) => APPLICABILITY.has(v));
  return Array.from(new Set(normalized));
}

function unitTypeForService(serviceType: string) {
  if (serviceType === 'BED_DAY') return 'PER_DAY';
  return 'PER_VISIT';
}

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role }) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const search = normalizeArabicNumerals(String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim());
  const serviceType = String(req.nextUrl.searchParams.get('serviceType') || '').trim().toUpperCase();
  const specialtyCode = String(req.nextUrl.searchParams.get('specialtyCode') || '').trim();

  const where: any = { tenantId };
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { nameAr: { contains: search, mode: 'insensitive' } },
      { nameEn: { contains: search, mode: 'insensitive' } },
      { specialtyCode: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (serviceType && SERVICE_TYPES.has(serviceType)) {
    where.serviceType = serviceType;
  }
  if (specialtyCode) {
    where.specialtyCode = specialtyCode;
  }

  const items = await prisma.serviceCatalog.findMany({
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
    name: z.string().optional(),
    nameAr: z.string().optional(),
    nameEn: z.string().optional(),
    serviceType: z.string().min(1),
    basePrice: z.union([z.number(), z.string()]),
    applicability: z.unknown(),
    allowedForCash: z.boolean(),
    allowedForInsurance: z.boolean(),
    status: z.string().optional(),
    departmentDomain: z.union([z.string(), z.null()]).optional(),
    description: z.union([z.string(), z.null()]).optional(),
    specialtyCode: z.union([z.string(), z.null()]).optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const nameAr = String(body.nameAr || '').trim();
  const nameEn = String(body.nameEn || '').trim();
  const name = String(body.name || nameEn || nameAr || '').trim();
  const serviceType = String(body.serviceType || '').trim().toUpperCase();
  const basePrice = Number(body.basePrice);
  const applicability = normalizeApplicability(body.applicability);
  const allowedForCash = Boolean(body.allowedForCash);
  const allowedForInsurance = Boolean(body.allowedForInsurance);
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();
  const departmentDomain = String(body.departmentDomain || '').trim().toUpperCase();
  const description = String(body.description || '').trim();
  const specialtyCode = String(body.specialtyCode || '').trim() || null;

  const missing: string[] = [];
  const invalid: string[] = [];
  if (!name) missing.push('name');
  if (!serviceType) missing.push('serviceType');
  if (Number.isNaN(basePrice)) missing.push('basePrice');
  if (!applicability.length) missing.push('applicability');
  if (body.allowedForCash === undefined) missing.push('allowedForCash');
  if (body.allowedForInsurance === undefined) missing.push('allowedForInsurance');
  if (serviceType && !SERVICE_TYPES.has(serviceType)) invalid.push('serviceType');
  if (status && !STATUSES.has(status)) invalid.push('status');
  if (departmentDomain && !DEPARTMENTS.has(departmentDomain)) invalid.push('departmentDomain');
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const existingByName = await prisma.serviceCatalog.findFirst({
    where: { tenantId, nameLower: name.toLowerCase() },
  });
  if (existingByName) {
    return NextResponse.json({ error: 'Service name already exists' }, { status: 409 });
  }

  if (!getChargeCodePrefix('SERVICE')) {
    return NextResponse.json({ error: 'Unknown type prefix' }, { status: 400 });
  }
  const code = await allocateChargeCatalogCode({ tenantId, itemType: 'SERVICE' });
  if (!code) return NextResponse.json({ error: 'Unable to allocate code' }, { status: 500 });

  const pricing = serviceType === 'CONSULTATION' ? normalizePricing(body, basePrice) : null;
  const rules = serviceType === 'CONSULTATION' ? normalizeRules(body) : null;
  if (serviceType === 'CONSULTATION' && pricing && pricing.default <= 0) {
    return NextResponse.json({ error: 'Validation failed', invalid: ['pricing.default'] }, { status: 400 });
  }

  const now = new Date();
  const chargeId = uuidv4();
  await prisma.billingChargeCatalog.create({
    data: {
      id: chargeId,
      tenantId,
      code,
      name,
      itemType: 'SERVICE',
      departmentDomain: departmentDomain || null,
      applicability,
      flags: [],
      unitType: unitTypeForService(serviceType),
      basePrice,
      allowedForCash,
      allowedForInsurance,
      status,
      createdAt: now,
      createdByUserId: userId,
    },
  });

  const serviceCode =
    serviceType === 'CONSULTATION'
      ? await allocateConsultationCatalogCode({ tenantId, specialtyCode })
      : await allocateServiceCatalogCode({ tenantId });
  const item = await prisma.serviceCatalog.create({
    data: {
      id: uuidv4(),
      tenantId,
      code: serviceCode,
      name,
      nameAr: nameAr || null,
      nameEn: nameEn || null,
      nameLower: name.toLowerCase(),
      serviceType,
      description: description || null,
      chargeCatalogId: chargeId,
      chargeCode: code,
      basePrice,
      pricing: pricing || undefined,
      rules: rules || undefined,
      specialtyCode,
      applicability,
      allowedForCash,
      allowedForInsurance,
      status,
      departmentDomain: departmentDomain || null,
      createdAt: now,
      createdByUserId: userId,
    },
  });

  await createAuditLog(
    'service_catalog',
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

  const existing = await prisma.serviceCatalog.findFirst({ where: { tenantId, id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.serviceCatalog.delete({ where: { id } });
  if (existing.chargeCatalogId) {
    await prisma.billingChargeCatalog.deleteMany({ where: { tenantId, id: existing.chargeCatalogId } });
  }

  await createAuditLog(
    'service_catalog',
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
