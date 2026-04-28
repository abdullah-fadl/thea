import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { allocateShortCode } from '@/lib/clinicalInfra/publicIds';
import { startAudit, finishAudit } from '@/lib/clinicalInfra/audit';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const REQUIRED_HEADERS = ['displayname', 'staffid', 'units'];
const COLUMN_ALIASES: Record<string, string> = {
  displayname: 'displayName',
  staffid: 'staffId',
  licensenumber: 'licenseNumber',
  email: 'email',
  employmenttype: 'employmentType',
  units: 'units',
  specialties: 'specialties',
  roomids: 'roomIds',
  canprescribe: 'canPrescribe',
  canrequestimaging: 'canRequestImaging',
  canperformprocedures: 'canPerformProcedures',
  procedurecategories: 'procedureCategories',
};

type ParsedRow = Record<string, string>;

function normalizeHeader(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function parseCsvLine(line: string) {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cols.push(current.trim());
  return cols;
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [] as ParsedRow[], rowOffset: 0 };

  const headerCols = parseCsvLine(lines[0]).map((col) => normalizeHeader(col));
  const hasHeader = REQUIRED_HEADERS.every((col) => headerCols.includes(col));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows = dataLines.map((line) => {
    const cols = parseCsvLine(line);
    if (!hasHeader) {
      const [
        displayName,
        staffId,
        licenseNumber,
        email,
        employmentType,
        units,
        specialties,
        roomIds,
        canPrescribe,
        canRequestImaging,
        canPerformProcedures,
        procedureCategories,
      ] = cols;
      return {
        displayName: displayName || '',
        staffId: staffId || '',
        licenseNumber: licenseNumber || '',
        email: email || '',
        employmentType: employmentType || '',
        units: units || '',
        specialties: specialties || '',
        roomIds: roomIds || '',
        canPrescribe: canPrescribe || '',
        canRequestImaging: canRequestImaging || '',
        canPerformProcedures: canPerformProcedures || '',
        procedureCategories: procedureCategories || '',
      } satisfies ParsedRow;
    }
    const row: ParsedRow = {};
    headerCols.forEach((header, idx) => {
      const key = COLUMN_ALIASES[header];
      if (!key) return;
      row[key] = cols[idx] || '';
    });
    return row;
  });

  return { rows, rowOffset: hasHeader ? 2 : 1 };
}

function splitList(input: string, allowComma = true) {
  const raw = String(input || '').trim();
  if (!raw) return [];
  const parts = allowComma ? raw.split(/[|,]/g) : raw.split(/[|]/g);
  return Array.from(new Set(parts.map((p) => p.trim()).filter(Boolean)));
}

function parseBoolean(input: string | undefined) {
  if (input === undefined) return false;
  const raw = String(input || '').trim().toLowerCase();
  if (!raw) return false;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function normalizeEmploymentType(input: string | undefined) {
  const raw = String(input || '').trim().toUpperCase();
  if (!raw) return 'FULL_TIME';
  if (raw === 'FT') return 'FULL_TIME';
  if (raw === 'PT') return 'PART_TIME';
  if (raw === 'FULL_TIME' || raw === 'PART_TIME') return raw;
  return null;
}

function buildLookupMap(items: Record<string, unknown>[], fields: string[]) {
  const map = new Map<string, any>();
  for (const item of items) {
    for (const field of fields) {
      const value = String(item?.[field] || '').trim();
      if (!value) continue;
      map.set(value.toLowerCase(), item);
    }
  }
  return map;
}

// Helper to upsert into a raw table (no Prisma model) by tenantId + providerId
async function upsertRawDoc(table: string, tenantId: string, providerId: string, id: string, data: Record<string, unknown>): Promise<void> {
  const fields = Object.keys(data);
  const columns = ['id', '"tenantId"', '"providerId"', ...fields.map(f => `"${f}"`)];
  const placeholders = [`$1::uuid`, `$2::uuid`, `$3::uuid`, ...fields.map((_, i) => `$${i + 4}`)];
  const updates = fields.map(f => `"${f}" = EXCLUDED."${f}"`).join(', ');
  const values = [id, tenantId, providerId, ...fields.map(f => data[f])];

  const sql = `INSERT INTO "${table}" (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT ("tenantId", "providerId") DO UPDATE SET ${updates}`;
  await (prisma.$executeRawUnsafe as Function)(sql, ...values);
}

async function findRawDoc(table: string, tenantId: string, providerId: string): Promise<any | null> {
  try {
    const rows: Record<string, unknown>[] = await (prisma.$queryRawUnsafe as Function)(
      `SELECT * FROM "${table}" WHERE "tenantId" = $1::uuid AND "providerId" = $2::uuid LIMIT 1`,
      tenantId,
      providerId
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  try {
    const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
    if (admin instanceof NextResponse) return admin;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart/form-data' }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'CSV file is required (field: file)' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const { rows, rowOffset } = parseCsv(text);
    if (!rows.length) {
      return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
    }

    const units = await prisma.clinicalInfraUnit.findMany({
      where: { tenantId, status: 'active' },
    });
    const specialties = await prisma.clinicalInfraSpecialty.findMany({
      where: { tenantId, isArchived: false },
    });
    const rooms = await prisma.clinicalInfraRoom.findMany({
      where: { tenantId },
    });

    const unitLookup = buildLookupMap(units as Record<string, unknown>[], ['id', 'shortCode', 'code', 'name']);
    const unitTypeLookup = units.reduce<Record<string, string[]>>((acc, unit) => {
      const unitType = String((unit as Record<string, unknown>).unitType || unit.type || '').trim().toUpperCase();
      if (!unitType) return acc;
      acc[unitType] = acc[unitType] || [];
      acc[unitType].push(String(unit.id || '').trim());
      return acc;
    }, {});
    const specialtyLookup = buildLookupMap(specialties as Record<string, unknown>[], ['id', 'shortCode', 'code', 'name']);
    const roomLookup = buildLookupMap(rooms as Record<string, unknown>[], ['id', 'shortCode', 'name']);

    const seenStaff = new Set<string>();
    const errors: Array<{ row: number; reason: string }> = [];
    let created = 0;
    let updated = 0;

    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const path = req.nextUrl.pathname;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = rowOffset + i;

    const displayName = String(row.displayName || '').trim();
    const staffId = String(row.staffId || '').trim();
    const licenseNumber = String(row.licenseNumber || '').trim();
    const email = String(row.email || '').trim();
    const employmentTypeRaw = String(row.employmentType || '').trim();
    const unitsRaw = String(row.units || '').trim();
    const specialtiesRaw = String(row.specialties || '').trim();
    const roomIdsRaw = String(row.roomIds || '').trim();
    const canPrescribe = parseBoolean(row.canPrescribe);
    const canRequestImaging = parseBoolean(row.canRequestImaging);
    const canPerformProcedures = parseBoolean(row.canPerformProcedures);
    const procedureCategoriesRaw = String(row.procedureCategories || '').trim();
    const employmentType = normalizeEmploymentType(employmentTypeRaw);
    if (!employmentType) {
      errors.push({ row: rowNumber, reason: 'employmentType invalid' });
      continue;
    }

    if (!displayName || !staffId || !unitsRaw) {
      errors.push({ row: rowNumber, reason: 'Missing required fields (displayName, staffId, units)' });
      continue;
    }
    if (seenStaff.has(staffId.toLowerCase())) {
      errors.push({ row: rowNumber, reason: `Duplicate staffId in CSV: ${staffId}` });
      continue;
    }
    seenStaff.add(staffId.toLowerCase());

    const unitTokens = splitList(unitsRaw, true);
    const unitIds: string[] = [];
    let unitError: string | null = null;
    for (const token of unitTokens) {
      const tokenKey = token.toLowerCase();
      const byId = unitLookup.get(tokenKey);
      if (byId) {
        unitIds.push(String(byId.id));
        continue;
      }
      const typeKey = token.toUpperCase();
      if (unitTypeLookup[typeKey]?.length === 1) {
        unitIds.push(unitTypeLookup[typeKey][0]);
        continue;
      }
      if (unitTypeLookup[typeKey]?.length > 1) {
        unitError = `Unit ${token} is ambiguous`;
        break;
      }
      unitError = `Unit ${token} not found`;
      break;
    }
    if (unitError) {
      errors.push({ row: rowNumber, reason: unitError });
      continue;
    }

    const specialtyIds: string[] = [];
    if (specialtiesRaw) {
      const specialtyTokens = splitList(specialtiesRaw, true);
      let specialtyError: string | null = null;
      for (const token of specialtyTokens) {
        const match = specialtyLookup.get(token.toLowerCase());
        if (!match) {
          specialtyError = `Specialty ${token} not found`;
          break;
        }
        specialtyIds.push(String(match.id));
      }
      if (specialtyError) {
        errors.push({ row: rowNumber, reason: specialtyError });
        continue;
      }
    }

    const roomIds: string[] = [];
    if (roomIdsRaw) {
      const roomTokens = splitList(roomIdsRaw, false);
      let roomError: string | null = null;
      for (const token of roomTokens) {
        const match = roomLookup.get(token.toLowerCase());
        if (!match) {
          roomError = `Room ${token} not found`;
          break;
        }
        roomIds.push(String(match.id));
      }
      if (roomError) {
        errors.push({ row: rowNumber, reason: roomError });
        continue;
      }
    }

    const procedureCategories = splitList(procedureCategoriesRaw, true);

    const existingProvider = await prisma.clinicalInfraProvider.findFirst({
      where: { tenantId, staffId },
    });
    const now = new Date();

    if (email) {
      const emailConflict = await prisma.clinicalInfraProvider.findFirst({
        where: {
          tenantId,
          email,
          isArchived: false,
          ...(existingProvider ? { id: { not: existingProvider.id } } : {}),
        },
      });
      if (emailConflict) {
        errors.push({ row: rowNumber, reason: `Email already used: ${email}` });
        continue;
      }
    }

    if (!existingProvider) {
      const providerId = uuidv4();
      const shortCode = await allocateShortCode({
        tenantId,
        entityType: 'clinical_infra_provider',
      });
      const providerDoc = {
        id: providerId,
        tenantId,
        displayName,
        email: email || undefined,
        staffId,
        employmentType,
        shortCode: shortCode ?? undefined,
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      };

      const { auditId } = await startAudit({
        tenantId,
        userId,
        entityType: 'clinical_infra_provider',
        entityId: providerId,
        action: 'CREATE',
        before: null,
        after: providerDoc,
        ip: ip || null,
        path,
      });

      try {
        await prisma.clinicalInfraProvider.create({ data: providerDoc });
        await finishAudit({ tenantId, auditId, ok: true });
        created += 1;
      } catch (error: unknown) {
        const e = error as Record<string, unknown>;
        await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || error) });
        const reason =
          e?.code === 'P2002'
            ? `Duplicate email: ${email || '(constraint)'}`
            : 'Failed to create provider';
        errors.push({ row: rowNumber, reason });
        continue;
      }

      // Create profile
      await prisma.clinicalInfraProviderProfile.upsert({
        where: { tenantId_providerId: { tenantId, providerId } },
        create: {
          id: uuidv4(),
          tenantId,
          providerId,
          licenseNumber: licenseNumber || undefined,
          unitIds,
          specialtyIds,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          licenseNumber: licenseNumber || undefined,
          unitIds,
          specialtyIds,
          updatedAt: now,
        },
      });

      // Create unit scopes (raw table)
      try {
        await upsertRawDoc('clinical_infra_provider_unit_scopes', tenantId, providerId, uuidv4(), {
          unitIds,
          createdAt: now,
          updatedAt: now,
          isArchived: false,
        });
      } catch { /* best effort */ }

      // Create room assignments (raw table)
      try {
        await upsertRawDoc('clinical_infra_provider_room_assignments', tenantId, providerId, uuidv4(), {
          roomIds,
          createdAt: now,
          updatedAt: now,
          isArchived: false,
        });
      } catch { /* best effort */ }

      // Create privileges (raw table)
      try {
        await upsertRawDoc('clinical_infra_provider_privileges', tenantId, providerId, uuidv4(), {
          canPrescribe,
          canOrderNarcotics: false,
          canRequestImaging,
          canPerformProcedures,
          procedureCategories,
          createdAt: now,
          updatedAt: now,
          isArchived: false,
        });
      } catch { /* best effort */ }

      continue;
    }

    const providerId = String(existingProvider.id || '').trim();
    if (!providerId) {
      errors.push({ row: rowNumber, reason: `Provider id missing for staffId ${staffId}` });
      continue;
    }

    const { auditId } = await startAudit({
      tenantId,
      userId,
      entityType: 'clinical_infra_provider',
      entityId: providerId,
      action: 'UPDATE',
      before: existingProvider,
      after: { ...existingProvider, displayName, employmentType, email: email || null },
      ip: ip || null,
      path,
    });

    try {
      await prisma.clinicalInfraProvider.updateMany({
        where: { tenantId, id: providerId },
        data: {
          displayName,
          updatedAt: now,
          employmentType,
          email: email || null,
        },
      });
      await finishAudit({ tenantId, auditId, ok: true });
      updated += 1;
    } catch (error: unknown) {
      const e = error as Record<string, unknown>;
      await finishAudit({ tenantId, auditId, ok: false, error: String(e?.message || error) });
      const reason =
        e?.code === 'P2002'
          ? `Duplicate email: ${email || '(constraint)'}`
          : `Failed to update provider ${staffId}`;
      errors.push({ row: rowNumber, reason });
      continue;
    }

    // Update profile
    await prisma.clinicalInfraProviderProfile.upsert({
      where: { tenantId_providerId: { tenantId, providerId } },
      create: {
        id: uuidv4(),
        tenantId,
        providerId,
        licenseNumber: licenseNumber || undefined,
        unitIds,
        specialtyIds,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        licenseNumber: licenseNumber || undefined,
        unitIds,
        specialtyIds,
        updatedAt: now,
      },
    });

    // Update unit scopes (raw)
    try {
      const scopesBefore = await findRawDoc('clinical_infra_provider_unit_scopes', tenantId, providerId);
      await upsertRawDoc('clinical_infra_provider_unit_scopes', tenantId, providerId, scopesBefore?.id || uuidv4(), {
        unitIds,
        createdAt: scopesBefore?.createdAt || now,
        updatedAt: now,
        isArchived: false,
      });
    } catch { /* best effort */ }

    // Update room assignments (raw)
    try {
      const roomBefore = await findRawDoc('clinical_infra_provider_room_assignments', tenantId, providerId);
      await upsertRawDoc('clinical_infra_provider_room_assignments', tenantId, providerId, roomBefore?.id || uuidv4(), {
        roomIds,
        createdAt: roomBefore?.createdAt || now,
        updatedAt: now,
        isArchived: false,
      });
    } catch { /* best effort */ }

    // Update privileges (raw)
    try {
      const privBefore = await findRawDoc('clinical_infra_provider_privileges', tenantId, providerId);
      await upsertRawDoc('clinical_infra_provider_privileges', tenantId, providerId, privBefore?.id || uuidv4(), {
        canPrescribe,
        canOrderNarcotics: privBefore?.canOrderNarcotics ?? false,
        canRequestImaging,
        canPerformProcedures,
        procedureCategories,
        createdAt: privBefore?.createdAt || now,
        updatedAt: now,
        isArchived: false,
      });
    } catch { /* best effort */ }
  }

    return NextResponse.json({
      created,
      updated,
      failed: errors.length,
      errors,
    });
  } catch (error: unknown) {
    const message = String((error as Record<string, unknown>)?.message || error);
    logger.error('Providers bulk import failed', { category: 'api', route: 'POST /api/admin/clinical-infra/providers/bulk', error: message });
    // [SEC-10]
    return NextResponse.json({ error: 'Bulk import failed' }, { status: 500 });
  }
}, { tenantScoped: true, platformKey: 'thea_health' });
