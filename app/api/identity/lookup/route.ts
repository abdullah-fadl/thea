import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import type { IdentityLookupRequest, IdentityLookupResponse, IdentityLookupStatus, IdentityMatchLevel, IdentityType } from '@/lib/identity/contract';
import { hashIdentityValue, sha256 } from '@/lib/identity/hash';
import { getIdentityLast4 } from '@/lib/identity/mask';
import { maybeEncryptIdentityValue } from '@/lib/identity/rawStore';
import { consumeIdentityRateLimit } from '@/lib/identity/rateLimit';
import { lookupIdentityProvider } from '@/lib/identityProviders';
import { normalizeIdentifier } from '@/lib/hospital/patientMaster';
import { createAuditLog } from '@/lib/utils/audit';
import { validateBody } from '@/lib/validation/helpers';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseDob(value: unknown): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : s;
}

function parseIdentityType(value: unknown): IdentityType | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NATIONAL_ID' || normalized === 'IQAMA' || normalized === 'PASSPORT') {
    return normalized as IdentityType;
  }
  return null;
}

function parseContextArea(value: unknown): IdentityLookupRequest['contextArea'] | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'registration' || normalized === 'opd' || normalized === 'er') {
    return normalized as IdentityLookupRequest['contextArea'];
  }
  return null;
}

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    identityType: z.string().min(1),
    identityValue: z.string().min(1),
    dob: z.string().optional(),
    contextArea: z.string().min(1),
    clientRequestId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const identityType = parseIdentityType(body.identityType);
  const identityValue = normalizeIdentifier(body.identityValue as string);
  const dob = parseDob(body.dob);
  const contextArea = parseContextArea(body.contextArea);
  const clientRequestId = String(body.clientRequestId || '').trim() || null;

  if (!identityType) {
    return NextResponse.json({ error: 'identityType is required' }, { status: 400 });
  }
  if (!identityValue) {
    return NextResponse.json({ error: 'identityValue is required' }, { status: 400 });
  }
  if (!contextArea) {
    return NextResponse.json({ error: 'Invalid contextArea' }, { status: 400 });
  }

  const requireDob = String(process.env.IDENTITY_REQUIRE_DOB_FOR_LOOKUP || '1') === '1';
  const allowErNoDob = String(process.env.IDENTITY_ER_ALLOW_NO_DOB || '1') === '1';
  if (contextArea !== 'er' && requireDob && !dob) {
    return NextResponse.json({ error: 'DOB required', code: 'DOB_REQUIRED' }, { status: 400 });
  }
  if (contextArea === 'er' && !dob && !allowErNoDob) {
    return NextResponse.json({ error: 'DOB required', code: 'DOB_REQUIRED' }, { status: 400 });
  }

  const actorUserId = userId || 'system';

  const identityValueHash = hashIdentityValue(identityValue);
  const identityLast4 = getIdentityLast4(identityValue);
  const provider = String(process.env.IDENTITY_PROVIDER || 'mock').toLowerCase() === 'nic' ? 'nic' : 'mock';
  const lookupId = uuidv4();
  const providerTraceId = uuidv4();
  const dedupeKey = sha256(
    [tenantId, identityType, identityValueHash, dob || '', provider, contextArea].join('|')
  );
  const now = new Date();

  if (clientRequestId) {
    const existing = await prisma.identityLookup.findFirst({
      where: { tenantId, userId: actorUserId, clientRequestId },
    });
    if (existing) {
      const res = NextResponse.json({
        status: existing.status as IdentityLookupStatus,
        matchLevel: existing.matchLevel as IdentityMatchLevel,
        payload: existing.payload as Record<string, unknown> | null,
        lookupId: existing.id,
        provider: existing.provider,
        providerTraceId: existing.providerTraceId || null,
        dedupeKey: existing.dedupeKey,
        reasonCode: existing.reasonCode || null,
      } satisfies IdentityLookupResponse);
      res.headers.set('x-idempotent-replay', '1');
      return res;
    }
  }

  const dedupeTtlMin = Number(process.env.IDENTITY_DEDUPE_TTL_MIN || 5);
  const dedupeWindowMin = Number.isFinite(dedupeTtlMin) ? dedupeTtlMin : 5;
  const dedupeCutoff = new Date(Date.now() - Math.max(0, dedupeWindowMin) * 60 * 1000);
  const dedupeDoc = await prisma.identityLookup.findFirst({
    where: { tenantId, dedupeKey, createdAt: { gte: dedupeCutoff } },
  });
  if (dedupeDoc) {
    const res = NextResponse.json({
      status: dedupeDoc.status as IdentityLookupStatus,
      matchLevel: dedupeDoc.matchLevel as IdentityMatchLevel,
      payload: dedupeDoc.payload as Record<string, unknown> | null,
      lookupId: dedupeDoc.id,
      provider: dedupeDoc.provider,
      providerTraceId: dedupeDoc.providerTraceId || null,
      dedupeKey: dedupeDoc.dedupeKey,
      reasonCode: dedupeDoc.reasonCode || null,
    } satisfies IdentityLookupResponse);
    res.headers.set('x-idempotent-replay', '1');
    return res;
  }

  const rlCapacityRaw = Number(process.env.IDENTITY_RL_CAPACITY || 20);
  const rlRefillRaw = Number(process.env.IDENTITY_RL_REFILL_PER_MIN || 20);
  const rlCapacity = Number.isFinite(rlCapacityRaw) ? rlCapacityRaw : 20;
  const rlRefillPerMin = Number.isFinite(rlRefillRaw) ? rlRefillRaw : 20;
  const rl = await consumeIdentityRateLimit({
    tenantId,
    userId: actorUserId,
    capacity: rlCapacity,
    refillPerMin: rlRefillPerMin,
    now,
  });
  if (!rl.allowed) {
    await prisma.identityLookup.create({
      data: {
        id: lookupId,
        tenantId,
        userId: actorUserId,
        clientRequestId,
        identityType,
        identityLast4,
        identityValueHash,
        identityValueEncrypted: maybeEncryptIdentityValue(identityValue) as unknown as string,
        dob: dob || null,
        contextArea,
        status: 'RATE_LIMITED',
        matchLevel: 'NONE',
        payload: null,
        provider,
        providerTraceId,
        dedupeKey,
        reasonCode: 'RATE_LIMITED',
        patientMasterId: null,
        createdAt: now,
      },
    });
    const res = NextResponse.json(
      {
        status: 'RATE_LIMITED',
        matchLevel: 'NONE',
        payload: null,
        lookupId,
        provider,
        providerTraceId,
        dedupeKey,
        reasonCode: 'RATE_LIMITED',
      } satisfies IdentityLookupResponse,
      { status: 429 }
    );
    return res;
  }

  let providerResult;
  try {
    providerResult = await lookupIdentityProvider({
      identityType,
      identityValue,
      dob,
      contextArea,
      clientRequestId,
    });
  } catch (error: unknown) {
    const reasonCode = String((error as Record<string, unknown>)?.code || 'PROVIDER_ERROR');
    await prisma.identityLookup.create({
      data: {
        id: lookupId,
        tenantId,
        userId: actorUserId,
        clientRequestId,
        identityType,
        identityLast4,
        identityValueHash,
        identityValueEncrypted: maybeEncryptIdentityValue(identityValue) as unknown as string,
        dob: dob || null,
        contextArea,
        status: 'ERROR',
        matchLevel: 'NONE',
        payload: null,
        provider,
        providerTraceId,
        dedupeKey,
        reasonCode,
        patientMasterId: null,
        createdAt: now,
      },
    });
    return NextResponse.json(
      {
        status: 'ERROR',
        matchLevel: 'NONE',
        payload: null,
        lookupId,
        provider,
        providerTraceId,
        dedupeKey,
        reasonCode,
      } satisfies IdentityLookupResponse,
      { status: 502 }
    );
  }

  const providerTrace = providerResult.providerTraceId || providerTraceId;
  const notConfigured = providerResult.status === 'NOT_CONFIGURED';
  const errorStatus = providerResult.status === 'ERROR';
  const hasPayload = Boolean(providerResult.payload);
  const matchLevel: IdentityMatchLevel = hasPayload
    ? (dob ? 'VERIFIED' : contextArea === 'er' ? 'PARTIAL' : 'NONE')
    : 'NONE';
  const status: IdentityLookupStatus = notConfigured
    ? 'NOT_CONFIGURED'
    : errorStatus
    ? 'ERROR'
    : matchLevel;

  const docData = {
    id: lookupId,
    tenantId,
    userId: actorUserId,
    clientRequestId,
    identityType,
    identityLast4,
    identityValueHash,
    identityValueEncrypted: maybeEncryptIdentityValue(identityValue),
    dob: dob || null,
    contextArea,
    status,
    matchLevel,
    payload: providerResult.payload || null,
    provider: providerResult.provider,
    providerTraceId: providerTrace,
    dedupeKey,
    reasonCode: providerResult.reasonCode || null,
    patientMasterId: null,
    createdAt: now,
  };

  if (clientRequestId) {
    // Idempotency: only insert if not already existing
    const existingLookup = await prisma.identityLookup.findFirst({
      where: { tenantId, userId: actorUserId, clientRequestId },
    });
    if (!existingLookup) {
      await prisma.identityLookup.create({ data: docData as any });
    }
  } else {
    await prisma.identityLookup.create({ data: docData as any });
  }

  await createAuditLog(
    'identity_lookup',
    docData.id,
    'LOOKUP',
    actorUserId,
    user?.email,
    {
      identityType,
      identityLast4,
      identityValueHash,
      dob: dob || null,
      contextArea,
      status,
      matchLevel,
      provider: providerResult.provider,
      providerTraceId: providerTrace,
      dedupeKey,
      clientRequestId,
      reasonCode: providerResult.reasonCode || null,
    },
    tenantId
  );

  return NextResponse.json({
    status,
    matchLevel,
    payload: providerResult.payload || null,
    lookupId,
    provider: providerResult.provider,
    providerTraceId: providerTrace,
    dedupeKey,
    reasonCode: providerResult.reasonCode || null,
  } satisfies IdentityLookupResponse);
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'patients.master.view' });

