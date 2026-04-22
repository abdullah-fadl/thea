import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { canAccessBilling } from '@/lib/billing/access';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

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
  const bodySchema = z.object({
    name: z.string().optional(),
    nameAr: z.string().optional(),
    nameEn: z.string().optional(),
    serviceType: z.string().optional(),
    description: z.union([z.string(), z.null()]).optional(),
    basePrice: z.union([z.number(), z.string()]).optional(),
    applicability: z.unknown().optional(),
    allowedForCash: z.boolean().optional(),
    allowedForInsurance: z.boolean().optional(),
    status: z.string().optional(),
    departmentDomain: z.union([z.string(), z.null()]).optional(),
    specialtyCode: z.union([z.string(), z.null()]).optional(),
    pricing: z.record(z.string(), z.unknown()).optional(),
    rules: z.record(z.string(), z.unknown()).optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const existing = await prisma.serviceCatalog.findFirst({ where: { tenantId, id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Cast existing to any for dynamic field access on Json fields
  const ex = existing as Record<string, unknown>;

  const nameAr = body.nameAr !== undefined ? String(body.nameAr || '').trim() : ex.nameAr || '';
  const nameEn = body.nameEn !== undefined ? String(body.nameEn || '').trim() : ex.nameEn || '';
  const name =
    body.name !== undefined
      ? String(body.name || '').trim()
      : String(ex.name || nameEn || nameAr || '').trim();
  const serviceType =
    body.serviceType !== undefined ? String(body.serviceType || '').trim().toUpperCase() : String(ex.serviceType || '');
  const description =
    body.description !== undefined ? String(body.description || '').trim() : ex.description || null;
  const basePrice = body.basePrice !== undefined ? Number(body.basePrice) : Number(ex.basePrice);
  const applicability = body.applicability !== undefined ? normalizeApplicability(body.applicability) : (ex.applicability as string[]) || [];
  const allowedForCash = body.allowedForCash !== undefined ? Boolean(body.allowedForCash) : ex.allowedForCash;
  const allowedForInsurance =
    body.allowedForInsurance !== undefined ? Boolean(body.allowedForInsurance) : ex.allowedForInsurance;
  const status = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : String(ex.status || '');
  const departmentDomain =
    body.departmentDomain !== undefined ? String(body.departmentDomain || '').trim().toUpperCase() : String(ex.departmentDomain || '');
  const specialtyCode =
    body.specialtyCode !== undefined ? String(body.specialtyCode || '').trim() || null : ex.specialtyCode || null;

  const pricing =
    body.pricing !== undefined
      ? normalizePricing(body, basePrice)
      : ex.pricing || (serviceType === 'CONSULTATION' ? normalizePricing(ex, basePrice) : null);
  const rules =
    body.rules !== undefined
      ? normalizeRules(body)
      : ex.rules || (serviceType === 'CONSULTATION' ? normalizeRules(ex) : null);

  const invalid: string[] = [];
  if (body.name !== undefined && !name) invalid.push('name');
  if (body.serviceType !== undefined && !SERVICE_TYPES.has(serviceType)) invalid.push('serviceType');
  if (body.status !== undefined && !STATUSES.has(status)) invalid.push('status');
  if (body.departmentDomain !== undefined && departmentDomain && !DEPARTMENTS.has(departmentDomain)) {
    invalid.push('departmentDomain');
  }
  if (body.applicability !== undefined && !applicability.length) invalid.push('applicability');
  if (body.basePrice !== undefined && Number.isNaN(basePrice)) invalid.push('basePrice');
  if (serviceType === 'CONSULTATION' && pricing && (pricing as any).default < 0) invalid.push('pricing.default');
  if (invalid.length) {
    logger.warn('Service update validation failed', { category: 'api', id, invalid, body: { ...body, adminCode: body?.adminCode ? '[REDACTED]' : undefined } });
    return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });
  }

  if (name && name.toLowerCase() !== String(ex.nameLower || '').toLowerCase()) {
    const duplicate = await prisma.serviceCatalog.findFirst({
      where: { tenantId, nameLower: name.toLowerCase(), id: { not: id } },
    });
    if (duplicate) return NextResponse.json({ error: 'Service name already exists' }, { status: 409 });
  }

  const patch: any = {};
  if (name !== ex.name) patch.name = name;
  if (body.nameAr !== undefined) patch.nameAr = nameAr || null;
  if (body.nameEn !== undefined) patch.nameEn = nameEn || null;
  if (name.toLowerCase() !== String(ex.nameLower || '').toLowerCase()) patch.nameLower = name.toLowerCase();
  if (body.serviceType !== undefined) patch.serviceType = serviceType;
  if (body.description !== undefined) patch.description = description || null;
  if (body.basePrice !== undefined) patch.basePrice = basePrice;
  if (body.applicability !== undefined) patch.applicability = applicability;
  if (body.allowedForCash !== undefined) patch.allowedForCash = allowedForCash;
  if (body.allowedForInsurance !== undefined) patch.allowedForInsurance = allowedForInsurance;
  if (body.status !== undefined) patch.status = status;
  if (body.departmentDomain !== undefined) patch.departmentDomain = departmentDomain || null;
  if (body.specialtyCode !== undefined) patch.specialtyCode = specialtyCode;
  if (body.pricing !== undefined) patch.pricing = pricing;
  if (body.rules !== undefined) patch.rules = rules;

  const chargePatch: any = {};
  if (name !== ex.name) chargePatch.name = name;
  if (body.basePrice !== undefined) chargePatch.basePrice = basePrice;
  if (body.status !== undefined) chargePatch.status = status;
  if (body.allowedForCash !== undefined) chargePatch.allowedForCash = allowedForCash;
  if (body.allowedForInsurance !== undefined) chargePatch.allowedForInsurance = allowedForInsurance;
  if (body.departmentDomain !== undefined) chargePatch.departmentDomain = departmentDomain || null;
  if (body.applicability !== undefined) chargePatch.applicability = applicability;
  if (body.serviceType !== undefined) chargePatch.unitType = unitTypeForService(serviceType);

  if (Object.keys(chargePatch).length && ex.chargeCatalogId) {
    await prisma.billingChargeCatalog.updateMany({
      where: { tenantId, id: ex.chargeCatalogId as string },
      data: chargePatch,
    });
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ item: existing, noOp: true });
  }

  await prisma.serviceCatalog.update({ where: { id }, data: patch });
  const updated = { ...ex, ...patch };

  await createAuditLog(
    'service_catalog',
    id,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: existing, after: updated },
    tenantId
  );

  return NextResponse.json({ item: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' });
