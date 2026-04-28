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

function normalizeFlag(value: any): 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | null {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'NORMAL' || v === 'ABNORMAL' || v === 'CRITICAL') return v;
  return null;
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
  const order = event.order || {};
  const result = event.result || {};

  const missing: string[] = [];
  const invalid: string[] = [];

  const system = String(source.system || '').trim();
  const facilityCode = String(source.facilityCode || '').trim() || null;
  const traceId = String(source.traceId || '').trim();
  const occurredAt = parseDate(event.occurredAt);
  const eventType = String(event.type || '').trim().toUpperCase();

  if (!system) missing.push('source.system');
  if (!traceId) missing.push('source.traceId');
  if (!eventType) missing.push('event.type');
  if (eventType && eventType !== 'RESULT') invalid.push('event.type');
  if (!occurredAt) missing.push('event.occurredAt');

  const testCode = String(result.testCode || '').trim();
  const testName = String(result.testName || '').trim();
  const value = String(result.value || '').trim();
  const unit = String(result.unit || '').trim();
  const refRange = String(result.refRange || '').trim() || null;
  const flag = normalizeFlag(result.flag);
  const reportText = String(result.reportText || '').trim() || null;

  if (!testCode) missing.push('event.result.testCode');
  if (!testName) missing.push('event.result.testName');
  if (!value) missing.push('event.result.value');
  if (!unit) missing.push('event.result.unit');
  if (!flag) missing.push('event.result.flag');

  const attachments = Array.isArray(result.attachments) ? result.attachments : [];
  const normalizedAttachments = attachments.map((item: any) => ({
    filename: String(item?.filename || '').trim(),
    contentType: String(item?.contentType || '').trim(),
    size: Number(item?.size || 0),
    url: item?.url ? String(item.url || '').trim() : null,
  }));
  for (const attachment of normalizedAttachments) {
    if (!attachment.filename) invalid.push('event.result.attachments.filename');
    if (!attachment.contentType) invalid.push('event.result.attachments.contentType');
    if (!Number.isFinite(attachment.size)) invalid.push('event.result.attachments.size');
  }

  const link = patient.link || {};
  const patientMasterId = String(link.patientMasterId || '').trim() || null;
  const mrn = String(link.mrn || '').trim();
  const nationalId = String(link.nationalId || '').trim();
  if (!patientMasterId && !mrn && !nationalId) {
    missing.push('event.patient.link');
  }

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  const occurredAtIso = occurredAt ? occurredAt.toISOString() : new Date().toISOString();
  const patientIdentifier = patientMasterId || mrn || nationalId;
  const patientHash = sha256(`${tenantId}:${String(patientIdentifier || '')}`);
  const patientLink = {
    patientMasterId,
    mrnHash: mrn ? sha256(`${tenantId}:${mrn}`) : null,
    mrnLast4: mrn ? last4(mrn) : null,
    nationalIdHash: nationalId ? sha256(`${tenantId}:${nationalId}`) : null,
    nationalIdLast4: nationalId ? last4(nationalId) : null,
  };

  const payloadHash = computePayloadHash({
    testCode,
    testName,
    value,
    unit,
    refRange,
    flag,
    reportText,
    attachments: normalizedAttachments,
  });
  const dedupeKey = computeConnectDedupeKey({
    tenantId,
    eventType: 'RESULT',
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
      type: 'RESULT',
      source: { system, facilityCode, traceId },
      occurredAt: occurredAtIso,
      patientHash,
      dedupeKey,
      clientRequestId,
      createdAt: now,
      createdByUserId: userId || null,
    },
  });

  const connectResult = await prisma.connectResult.create({
    data: {
      tenantId,
      source: { system, facilityCode, traceId, occurredAt: occurredAtIso },
      patientLink,
      order: {
        orderId: order.orderId ? String(order.orderId || '').trim() : null,
        accession: order.accession ? String(order.accession || '').trim() : null,
      },
      result: {
        testCode,
        testName,
        value,
        unit,
        refRange,
        flag,
        reportText,
        attachments: normalizedAttachments,
      },
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

  return NextResponse.json({ success: true, eventId: ingestEvent.id, resultId: connectResult.id });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.edit' }
);
