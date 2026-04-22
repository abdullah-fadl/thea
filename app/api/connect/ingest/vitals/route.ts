import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { computeConnectDedupeKey, computePayloadHash } from '@/lib/connect/dedupe';
import { last4, sha256 } from '@/lib/connect/hash';
import { createAuditLog } from '@/lib/utils/audit';

import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isAdminOrDev(role: string | null | undefined, _email: string | null | undefined, _tenantId: string): boolean {
  const r = String(role || '').toLowerCase();
  return r.includes('admin');
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(value: any): number | null {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, user, role, userId }) => {

  if (!isAdminOrDev(role, user?.email, tenantId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    source: z.object({ system: z.string().min(1), traceId: z.string().min(1) }).passthrough(),
    event: z.object({ type: z.string().min(1), occurredAt: z.string().min(1) }).passthrough(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const source = body.source || {};
  const event = body.event || {};
  const patient = event.patient || {};
  const location = event.location || {};
  const vitals = event.vitals || {};

  const missing: string[] = [];
  const invalid: string[] = [];

  const system = String(source.system || '').trim();
  const deviceId = String(source.deviceId || '').trim() || null;
  const traceId = String(source.traceId || '').trim();
  const occurredAt = parseDate(event.occurredAt);
  const eventType = String(event.type || '').trim().toUpperCase();

  if (!system) missing.push('source.system');
  if (!traceId) missing.push('source.traceId');
  if (!eventType) missing.push('event.type');
  if (eventType && eventType !== 'VITALS') invalid.push('event.type');
  if (!occurredAt) missing.push('event.occurredAt');

  const area = String(location.area || '').trim().toUpperCase();
  if (!area) missing.push('event.location.area');
  if (area && !['ER', 'IPD', 'ICU', 'OR'].includes(area)) invalid.push('event.location.area');
  const bedId = location.bedId ? String(location.bedId || '').trim() : null;
  const roomId = location.roomId ? String(location.roomId || '').trim() : null;

  const hr = toNumber(vitals.hr);
  const bpSys = toNumber(vitals.bpSys);
  const bpDia = toNumber(vitals.bpDia);
  const rr = toNumber(vitals.rr);
  const temp = toNumber(vitals.temp);
  const spo2 = toNumber(vitals.spo2);

  if (hr == null) missing.push('event.vitals.hr');
  if (bpSys == null) missing.push('event.vitals.bpSys');
  if (bpDia == null) missing.push('event.vitals.bpDia');
  if (rr == null) missing.push('event.vitals.rr');
  if (temp == null) missing.push('event.vitals.temp');
  if (spo2 == null) missing.push('event.vitals.spo2');

  const link = patient.link || {};
  const patientMasterId = String(link.patientMasterId || '').trim() || null;
  const mrn = String(link.mrn || '').trim();
  if (!patientMasterId && !mrn) {
    missing.push('event.patient.link');
  }

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const occurredAtIso = occurredAt ? occurredAt.toISOString() : new Date().toISOString();
  const patientIdentifier = patientMasterId || mrn;
  const patientHash = sha256(`${tenantId}:${String(patientIdentifier || '')}`);
  const patientLink = {
    patientMasterId,
    mrnHash: mrn ? sha256(`${tenantId}:${mrn}`) : null,
    mrnLast4: mrn ? last4(mrn) : null,
  };

  const payloadHash = computePayloadHash({ hr, bpSys, bpDia, rr, temp, spo2, area, bedId, roomId });
  const dedupeKey = computeConnectDedupeKey({
    tenantId,
    eventType: 'VITALS',
    occurredAt: occurredAtIso,
    patientHash,
    payloadHash,
    traceId,
  });

  const clientRequestId = body.clientRequestId ? String(body.clientRequestId || '').trim() : null;
  if (clientRequestId) {
    const existing = await prisma.connectIngestEvent.findFirst({
      where: { tenantId, clientRequestId },
    });
    if (existing) {
      const res = NextResponse.json({ success: true, noOp: true, eventId: existing.id });
      res.headers.set('x-idempotent-replay', '1');
      return res;
    }
  }

  const existingByDedupe = await prisma.connectIngestEvent.findFirst({
    where: { tenantId, dedupeKey },
  });
  if (existingByDedupe) {
    return NextResponse.json({ success: true, noOp: true, eventId: existingByDedupe.id });
  }

  const now = new Date();
  const ingestEvent = await prisma.connectIngestEvent.create({
    data: {
      tenantId,
      type: 'VITALS',
      source: { system, deviceId, traceId },
      occurredAt: occurredAtIso,
      patientHash,
      dedupeKey,
      clientRequestId,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  const connectVitals = await prisma.connectDeviceVitals.create({
    data: {
      tenantId,
      source: { system, deviceId, traceId },
      occurredAt: occurredAtIso,
      patientLink,
      location: { area, bedId, roomId },
      vitals: { hr, bpSys, bpDia, rr, temp, spo2 },
      createdAt: now,
    },
  });

  await createAuditLog(
    'connect_ingest_event',
    ingestEvent.id,
    'CREATE',
    userId || 'system',
    user?.email,
    { after: ingestEvent },
    tenantId
  );

  return NextResponse.json({ success: true, eventId: ingestEvent.id, vitalsId: connectVitals.id });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' }
);
