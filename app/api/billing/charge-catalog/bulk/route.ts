import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canAccessBilling } from '@/lib/billing/access';
import { allocateChargeCatalogCode, getChargeCodePrefix } from '@/lib/billing/chargeCatalogCode';
import { validateBody } from '@/lib/validation/helpers';
import { bulkChargeCatalogSchema } from '@/lib/validation/billing.schema';
import { withErrorHandler } from '@/lib/core/errors';

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

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('name') && header.includes('type');
  const rows = hasHeader ? lines.slice(1) : lines;
  const headerCols = hasHeader ? lines[0].split(',').map((c) => c.trim().toLowerCase()) : [];
  return rows.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    if (!hasHeader) {
      const [
        name,
        itemType,
        unitType,
        basePrice,
        applicability,
        departmentDomain,
        allowedForCash,
        allowedForInsurance,
        status,
        flags,
        labSpecimen,
        labMethod,
        labPrepNotes,
        radModality,
        radBodySite,
        radContrastRequired,
      ] = cols;
      return {
        name,
        itemType,
        unitType,
        basePrice,
        applicability,
        departmentDomain,
        allowedForCash,
        allowedForInsurance,
        status,
        flags,
        labSpecimen,
        labMethod,
        labPrepNotes,
        radModality,
        radBodySite,
        radContrastRequired,
      };
    }
    const row: Record<string, string> = {};
    headerCols.forEach((key, idx) => {
      row[key] = cols[idx] || '';
    });
    return {
      name: row.name,
      itemType: row.itemtype || row.type,
      unitType: row.unittype || row.unit_type,
      basePrice: row.baseprice || row.base_price,
      applicability: row.applicability,
      departmentDomain: row.departmentdomain || row.department_domain || row.department,
      allowedForCash: row.allowedforcash || row.allowed_for_cash,
      allowedForInsurance: row.allowedforinsurance || row.allowed_for_insurance,
      status: row.status,
      flags: row.flags,
      labSpecimen: row.labspecimen || row.lab_specimen,
      labMethod: row.labmethod || row.lab_method,
      labPrepNotes: row.labprepnotes || row.lab_prep_notes || row.lab_prep,
      radModality: row.radmodality || row.rad_modality || row.modality,
      radBodySite: row.radbodysite || row.rad_body_site || row.bodysite || row.body_site,
      radContrastRequired: row.radcontrastrequired || row.rad_contrast_required || row.contrast_required,
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

  const v = validateBody(body, bulkChargeCatalogSchema);
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
    const name = String(row.name || '').trim();
    const itemType = String(row.itemType || row.type || '').trim().toUpperCase();
    const unitType = String(row.unitType || '').trim().toUpperCase();
    const basePrice = Number(row.basePrice);
    const allowedForCash =
      row.allowedForCash === undefined ? true : String(row.allowedForCash || '').toLowerCase() !== 'false';
    const allowedForInsurance =
      row.allowedForInsurance === undefined ? true : String(row.allowedForInsurance || '').toLowerCase() !== 'false';
    const status = String(row.status || 'ACTIVE').trim().toUpperCase();
    const departmentDomain = String(row.departmentDomain || row.department || '').trim().toUpperCase();
    const applicability = normalizeApplicability(row.applicability);
    const flags = normalizeFlags(row.flags);
    const labSpecimen = row.labSpecimen !== undefined ? String(row.labSpecimen || '').trim() : null;
    const labMethod = row.labMethod !== undefined ? String(row.labMethod || '').trim() : null;
    const labPrepNotes = row.labPrepNotes !== undefined ? String(row.labPrepNotes || '').trim() : null;
    const radModality = row.radModality !== undefined ? String(row.radModality || '').trim() : null;
    const radBodySite = row.radBodySite !== undefined ? String(row.radBodySite || '').trim() : null;
    const radContrastRequired =
      row.radContrastRequired !== undefined ? String(row.radContrastRequired || '').toLowerCase() === 'true' : null;

    if (!name || !itemType || !unitType || Number.isNaN(basePrice) || !applicability.length) {
      errors.push({ index: i, error: 'Missing required fields' });
      continue;
    }
    if (!ITEM_TYPES.has(itemType) || !UNIT_TYPES.has(unitType) || !STATUSES.has(status)) {
      errors.push({ index: i, error: 'Invalid enum value' });
      continue;
    }
    if (departmentDomain && !DEPARTMENTS.has(departmentDomain)) {
      errors.push({ index: i, error: 'Invalid departmentDomain' });
      continue;
    }
    if (!getChargeCodePrefix(itemType)) {
      errors.push({ index: i, error: 'Unknown type prefix' });
      continue;
    }

    const code = await allocateChargeCatalogCode({ tenantId, itemType });
    if (!code) {
      errors.push({ index: i, error: 'Code allocation failed' });
      continue;
    }

    const now = new Date();

    try {
      const charge = await prisma.billingChargeCatalog.create({
        data: {
          id: uuidv4(),
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
      created.push(charge);
      await createAuditLog(
        'charge_catalog',
        charge.id,
        'CREATE',
        userId || 'system',
        user?.email,
        { after: charge },
        tenantId
      );
    } catch (err: any) {
      if (err?.code === 'P2002') {
        errors.push({ index: i, error: 'Charge code already exists' });
      } else {
        errors.push({ index: i, error: 'Insert failed' });
      }
    }
  }

  return NextResponse.json({ createdCount: created.length, errorCount: errors.length, created, errors });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'billing.view' }
);
