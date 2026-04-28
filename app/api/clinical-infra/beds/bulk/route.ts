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

const BED_TYPES = new Set(['ER', 'IPD', 'ICU']);
const STATUSES = new Set(['active', 'inactive']);
const MAX_BULK = 500;

function normalizeLabel(value: any): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function buildRangeLabels(prefixRaw: any, startRaw: any, endRaw: any): { labels: string[] } | { error: string } {
  const prefix = normalizeLabel(prefixRaw) || 'Bed';
  const startNumber = Number(startRaw);
  const endNumber = Number(endRaw);
  if (!Number.isFinite(startNumber) || !Number.isFinite(endNumber)) return { error: 'startNumber/endNumber must be numbers' };
  const start = Math.floor(startNumber);
  const end = Math.floor(endNumber);
  if (start <= 0 || end <= 0) return { error: 'startNumber/endNumber must be positive' };
  if (end < start) return { error: 'endNumber must be >= startNumber' };
  const count = end - start + 1;
  if (count > MAX_BULK) return { error: `Too many beds. Max ${MAX_BULK}.` };
  const labels = [];
  for (let i = start; i <= end; i++) labels.push(`${prefix} ${i}`);
  return { labels };
}

function buildListLabels(input: any): { labels: string[] } | { error: string } {
  let raw: string[] = [];
  if (Array.isArray(input)) {
    raw = input.map((x) => String(x || ''));
  } else if (typeof input === 'string') {
    raw = input.split(/\r?\n|,/g);
  } else {
    return { error: 'labels must be an array of strings' };
  }
  const normalized = raw.map(normalizeLabel).filter(Boolean);
  if (!normalized.length) return { error: 'labels is empty' };
  if (normalized.length > MAX_BULK) return { error: `Too many beds. Max ${MAX_BULK}.` };
  return { labels: normalized };
}

function uniqStable(labels: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  const duplicatesInRequest: string[] = [];
  for (const n of labels) {
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
    roomId: z.string().min(1),
    bedType: z.string().min(1),
    status: z.string().optional(),
    clientRequestId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bulkSchema);
  if ('error' in v) return v.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;

  const facilityId = String(body.facilityId || '').trim();
  const unitId = String(body.unitId || '').trim();
  const floorId = String(body.floorId || '').trim();
  const roomId = String(body.roomId || '').trim();
  const bedType = String(body.bedType || '').trim().toUpperCase();
  const status = String(body.status || '').trim().toLowerCase();
  if (!facilityId) return NextResponse.json({ error: 'facilityId is required' }, { status: 400 });
  if (!unitId) return NextResponse.json({ error: 'unitId is required' }, { status: 400 });
  if (!floorId) return NextResponse.json({ error: 'floorId is required' }, { status: 400 });
  if (!roomId) return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  if (!bedType || !BED_TYPES.has(bedType)) return NextResponse.json({ error: 'bedType invalid' }, { status: 400 });
  if (!status || !STATUSES.has(status)) return NextResponse.json({ error: 'status invalid' }, { status: 400 });

  const fromRange = body.startNumber !== undefined || body.endNumber !== undefined || body.prefix !== undefined;
  const fromList = body.labels !== undefined;
  if (fromRange && fromList) return NextResponse.json({ error: 'Provide either range OR labels list, not both' }, { status: 400 });
  if (!fromRange && !fromList) return NextResponse.json({ error: 'Provide either range fields or labels' }, { status: 400 });

  const labelsRes = fromRange
    ? buildRangeLabels(body.prefix, body.startNumber, body.endNumber)
    : buildListLabels(body.labels);
  if ('error' in labelsRes) return NextResponse.json({ error: labelsRes.error }, { status: 400 });

  const initial = fromRange ? labelsRes.labels : [...labelsRes.labels].sort((a, b) => a.localeCompare(b));
  const { unique, duplicatesInRequest } = uniqStable(initial);

  return withIdempotency({
    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/beds/bulk',
    clientRequestId,
    handler: async () => {
      // Find existing beds with matching labels in this room
      const existing = await prisma.clinicalInfraBed.findMany({
        where: { tenantId, roomId, label: { in: unique } },
        select: { id: true, label: true },
      });
      const existingByLabel = new Map(existing.map((e) => [String(e.label || '').toLowerCase(), e]));

      const created: any[] = [];
      const skipped: Array<{ label: string; reason: string; existingId?: string }> = [];
      const errors: Array<{ label: string; error: string }> = [];

      const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
      const path = req.nextUrl.pathname;

      for (const label of unique) {
        const existingRow = existingByLabel.get(label.toLowerCase());
        if (existingRow) {
          skipped.push({ label, reason: 'EXISTS', existingId: String(existingRow.id || '') });
          continue;
        }

        const now = new Date();
        const shortCode = await allocateShortCode({
          tenantId,
          entityType: 'clinical_infra_bed',
        });
        const docId = uuidv4();
        const doc = {
          id: docId,
          tenantId,
          roomId,
          label,
          bedType,
          status,
          shortCode: shortCode ?? undefined,
          createdAt: now,
          updatedAt: now,
        };

        const { auditId } = await startAudit({
          tenantId,
          userId,
          entityType: 'clinical_infra_bed',
          entityId: doc.id,
          action: 'CREATE',
          before: null,
          after: doc,
          ip: ip || null,
          path,
        });

        try {
          await prisma.clinicalInfraBed.create({ data: doc });
          await finishAudit({ tenantId, auditId, ok: true });
          created.push(doc);
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('duplicate')) {
            await finishAudit({ tenantId, auditId, ok: false, error: 'DUPLICATE' });
            skipped.push({ label, reason: 'DUPLICATE' });
          } else {
            await finishAudit({ tenantId, auditId, ok: false, error: msg });
            errors.push({ label, error: msg });
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
