import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { startAudit, finishAudit } from '@/lib/clinicalInfra/audit';
import { allocateShortCode } from '@/lib/clinicalInfra/publicIds';
import { prisma } from '@/lib/db/prisma';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROOM_TYPES = new Set(['clinicRoom', 'erRoom', 'ipdRoom', 'procedureRoom']);
const MAX_BULK = 500;

function normalizeName(value: any): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function buildRangeNames(prefixRaw: any, startRaw: any, endRaw: any): { names: string[] } | { error: string } {
  const prefix = normalizeName(prefixRaw) || 'Room';
  const startNumber = Number(startRaw);
  const endNumber = Number(endRaw);
  if (!Number.isFinite(startNumber) || !Number.isFinite(endNumber)) return { error: 'startNumber/endNumber must be numbers' };
  const start = Math.floor(startNumber);
  const end = Math.floor(endNumber);
  if (start <= 0 || end <= 0) return { error: 'startNumber/endNumber must be positive' };
  if (end < start) return { error: 'endNumber must be >= startNumber' };
  const count = end - start + 1;
  if (count > MAX_BULK) return { error: `Too many rooms. Max ${MAX_BULK}.` };
  const names = [];
  for (let i = start; i <= end; i++) names.push(`${prefix} ${i}`);
  return { names };
}

function buildListNames(input: any): { names: string[] } | { error: string } {
  let raw: string[] = [];
  if (Array.isArray(input)) {
    raw = input.map((x) => String(x || ''));
  } else if (typeof input === 'string') {
    raw = input.split(/\r?\n|,/g);
  } else {
    return { error: 'names must be an array of strings' };
  }
  const normalized = raw.map(normalizeName).filter(Boolean);
  if (!normalized.length) return { error: 'names is empty' };
  if (normalized.length > MAX_BULK) return { error: `Too many rooms. Max ${MAX_BULK}.` };
  return { names: normalized };
}

function uniqStable(names: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  const duplicatesInRequest: string[] = [];
  for (const n of names) {
    const k = n.toLowerCase();
    if (seen.has(k)) duplicatesInRequest.push(n);
    else {
      seen.add(k);
      unique.push(n);
    }
  }
  return { unique, duplicatesInRequest };
}

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const bulkSchema = z.object({
    facilityId: z.string().min(1),
    unitId: z.string().min(1),
    floorId: z.string().min(1),
    roomType: z.string().min(1),
    clientRequestId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bulkSchema);
  if ('error' in v) return v.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;

  const facilityId = String(body.facilityId || '').trim();
  const unitId = String(body.unitId || '').trim();
  const floorId = String(body.floorId || '').trim();
  const roomType = String(body.roomType || '').trim();
  if (!facilityId) return NextResponse.json({ error: 'facilityId is required' }, { status: 400 });
  if (!unitId) return NextResponse.json({ error: 'unitId is required' }, { status: 400 });
  if (!floorId) return NextResponse.json({ error: 'floorId is required' }, { status: 400 });
  if (!roomType || !ROOM_TYPES.has(roomType)) return NextResponse.json({ error: 'roomType invalid' }, { status: 400 });

  const fromRange = body.startNumber !== undefined || body.endNumber !== undefined || body.prefix !== undefined;
  const fromList = body.names !== undefined;
  if (fromRange && fromList) return NextResponse.json({ error: 'Provide either range OR names list, not both' }, { status: 400 });
  if (!fromRange && !fromList) return NextResponse.json({ error: 'Provide either range fields or names' }, { status: 400 });

  const namesRes = fromRange
    ? buildRangeNames(body.prefix, body.startNumber, body.endNumber)
    : buildListNames(body.names);
  if ('error' in namesRes) return NextResponse.json({ error: namesRes.error }, { status: 400 });

  // Deterministic order: range is naturally ordered, list is sorted by name.
  const initial = fromRange ? namesRes.names : [...namesRes.names].sort((a, b) => a.localeCompare(b));
  const { unique, duplicatesInRequest } = uniqStable(initial);

  return withIdempotency({
    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/rooms/bulk',
    clientRequestId,
    handler: async () => {
      // Find existing rooms with matching names in this unit
      const existing = await prisma.clinicalInfraRoom.findMany({
        where: { tenantId, unitId, name: { in: unique } },
        select: { id: true, name: true },
      });
      const existingByName = new Map(existing.map((e) => [String(e.name || '').toLowerCase(), e]));

      const created: any[] = [];
      const skipped: Array<{ name: string; reason: string; existingId?: string }> = [];
      const errors: Array<{ name: string; error: string }> = [];

      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
      const path = req.nextUrl.pathname;

      for (const name of unique) {
        const existingRow = existingByName.get(name.toLowerCase());
        if (existingRow) {
          skipped.push({ name, reason: 'EXISTS', existingId: String(existingRow.id || '') });
          continue;
        }

        const now = new Date();
        const shortCode = await allocateShortCode({
          tenantId,
          entityType: 'clinical_infra_room',
        });
        const docId = uuidv4();
        const doc = {
          id: docId,
          tenantId,
          unitId,
          floorId,
          name,
          roomType,
          shortCode: shortCode ?? undefined,
          createdAt: now,
          updatedAt: now,
        };

        const { auditId } = await startAudit({
          tenantId,
          userId,
          entityType: 'clinical_infra_room',
          entityId: doc.id,
          action: 'CREATE',
          before: null,
          after: doc,
          ip: ip || null,
          path,
        });

        try {
          await prisma.clinicalInfraRoom.create({ data: doc });
          await finishAudit({ tenantId, auditId, ok: true });
          created.push(doc);
        } catch (e: any) {
          const msg = String(e?.message || e);
          // Duplicate key => treat as graceful no-op
          if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
            await finishAudit({ tenantId, auditId, ok: false, error: 'DUPLICATE' });
            skipped.push({ name, reason: 'DUPLICATE' });
          } else {
            await finishAudit({ tenantId, auditId, ok: false, error: msg });
            errors.push({ name, error: msg });
          }
        }
      }

      return NextResponse.json({
        ok: true,
        mode: fromRange ? 'range' : 'list',
        requested: initial.length,
        uniqueRequested: unique.length,
        duplicatesInRequest,
        createdCount: created.length,
        skippedCount: skipped.length,
        errorCount: errors.length,
        created,
        skipped,
        errors,
      });
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.manage' });
