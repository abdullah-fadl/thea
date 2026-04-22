import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { requireAdminDeleteCode } from '@/lib/clinicalInfra/access';
import { validateBody } from '@/lib/validation/helpers';
import { updateChargeCatalogSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATUSES = new Set(['ACTIVE', 'INACTIVE']);
const DEPARTMENTS = new Set(['ER', 'OPD', 'LAB', 'RAD', 'IPD', 'OR', 'ICU', 'OTHER']);
const APPLICABILITY = new Set(['ER', 'OPD', 'IPD', 'ICU', 'OR']);
const FLAG_SET = new Set(['CONTROLLED']);

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

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }, params) => {
  if (!canAccessBilling({ email: user?.email, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const chargeId = String((params as Record<string, string>)?.id || '').trim();
  if (!chargeId) {
    return NextResponse.json({ error: 'Charge id is required' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, updateChargeCatalogSchema);
  if ('error' in v) return v.error;

  const guard = requireAdminDeleteCode(req, body);
  if (guard) return guard;

  const charge = await prisma.billingChargeCatalog.findFirst({
    where: { tenantId, id: chargeId },
  });
  if (!charge) {
    return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
  }

  const nextName = body.name !== undefined ? String(body.name || '').trim() : charge.name;
  const nextBasePrice = body.basePrice !== undefined ? Number(body.basePrice) : Number(charge.basePrice);
  const nextStatus = body.status !== undefined ? String(body.status || '').trim().toUpperCase() : charge.status;
  const nextCash = body.allowedForCash !== undefined ? Boolean(body.allowedForCash) : charge.allowedForCash;
  const nextInsurance = body.allowedForInsurance !== undefined ? Boolean(body.allowedForInsurance) : charge.allowedForInsurance;
  const nextDepartmentDomain =
    body.departmentDomain !== undefined
      ? String(body.departmentDomain || '').trim().toUpperCase()
      : charge.departmentDomain || '';
  const nextApplicability =
    body.applicability !== undefined ? normalizeApplicability(body.applicability) : charge.applicability || [];
  const nextFlags = body.flags !== undefined ? normalizeFlags(body.flags) : charge.flags || [];
  const nextLabSpecimen =
    body.labSpecimen !== undefined ? String(body.labSpecimen || '').trim() : charge.labSpecimen || null;
  const nextLabMethod =
    body.labMethod !== undefined ? String(body.labMethod || '').trim() : charge.labMethod || null;
  const nextLabPrepNotes =
    body.labPrepNotes !== undefined ? String(body.labPrepNotes || '').trim() : charge.labPrepNotes || null;
  const nextRadModality =
    body.radModality !== undefined ? String(body.radModality || '').trim() : charge.radModality || null;
  const nextRadBodySite =
    body.radBodySite !== undefined ? String(body.radBodySite || '').trim() : charge.radBodySite || null;
  const nextRadContrastRequired =
    body.radContrastRequired !== undefined ? Boolean(body.radContrastRequired) : charge.radContrastRequired ?? null;

  const invalid: string[] = [];
  if (body.status !== undefined && !STATUSES.has(nextStatus)) invalid.push('status');
  if (body.basePrice !== undefined && Number.isNaN(nextBasePrice)) invalid.push('basePrice');
  if (body.departmentDomain !== undefined && nextDepartmentDomain && !DEPARTMENTS.has(nextDepartmentDomain)) {
    invalid.push('departmentDomain');
  }
  if (body.applicability !== undefined && !nextApplicability.length) invalid.push('applicability');
  if (invalid.length) {
    return NextResponse.json({ error: 'Validation failed', invalid }, { status: 400 });
  }

  const patch: any = {};
  if (nextName !== charge.name) patch.name = nextName;
  if (nextBasePrice !== Number(charge.basePrice)) patch.basePrice = nextBasePrice;
  if (nextStatus !== charge.status) patch.status = nextStatus;
  if (nextCash !== charge.allowedForCash) patch.allowedForCash = nextCash;
  if (nextInsurance !== charge.allowedForInsurance) patch.allowedForInsurance = nextInsurance;
  if (body.departmentDomain !== undefined && nextDepartmentDomain !== (charge.departmentDomain || '')) {
    patch.departmentDomain = nextDepartmentDomain || null;
  }
  if (body.applicability !== undefined) {
    patch.applicability = nextApplicability;
  }
  if (body.flags !== undefined) {
    patch.flags = nextFlags;
  }
  if (body.labSpecimen !== undefined) {
    patch.labSpecimen = nextLabSpecimen || null;
  }
  if (body.labMethod !== undefined) {
    patch.labMethod = nextLabMethod || null;
  }
  if (body.labPrepNotes !== undefined) {
    patch.labPrepNotes = nextLabPrepNotes || null;
  }
  if (body.radModality !== undefined) {
    patch.radModality = nextRadModality || null;
  }
  if (body.radBodySite !== undefined) {
    patch.radBodySite = nextRadBodySite || null;
  }
  if (body.radContrastRequired !== undefined) {
    patch.radContrastRequired = nextRadContrastRequired;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ charge, noOp: true });
  }

  const updated = await prisma.billingChargeCatalog.update({
    where: { id: chargeId },
    data: patch,
  });

  await createAuditLog(
    'charge_catalog',
    chargeId,
    'UPDATE',
    userId || 'system',
    user?.email,
    { before: charge, after: updated },
    tenantId
  );

  return NextResponse.json({ charge: updated });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
