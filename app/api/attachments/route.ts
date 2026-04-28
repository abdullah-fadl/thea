import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/utils/audit';
import { ensureResultsWriteAllowed } from '@/lib/core/guards/resultsGuard';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ENTITY_TYPES = new Set([
  'order_result', 'clinical_note', 'encounter_core',
  'radiology_report', 'lab_result', 'imaging_study', 'discharge_summary',
]);
const STORAGE_PROVIDERS = new Set(['local_stub', 's3_stub']);
const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100MB

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const params = req.nextUrl.searchParams;
  const entityType = String(params.get('entityType') || '').trim();
  const entityId = String(params.get('entityId') || '').trim();
  if (!entityType || !entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
  }
  if (!ENTITY_TYPES.has(entityType)) {
    return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
  }

  const items = await prisma.attachment.findMany({
    where: { tenantId, entityType, entityId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return NextResponse.json({ items });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }, _params) => {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodySchema = z.object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: z.number().optional(),
    storageKey: z.string().optional(),
    storage: z.object({ provider: z.string().optional(), key: z.string().optional(), url: z.string().optional() }).optional(),
    checksum: z.string().optional(),
    idempotencyKey: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, bodySchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const invalid: string[] = [];
  const entityType = String(body.entityType || '').trim();
  const entityId = String(body.entityId || '').trim();
  const fileName = String(body.fileName || '').trim();
  const mimeType = String(body.mimeType || '').trim();
  const sizeBytes = Number(body.sizeBytes || 0);
  const storageKey = String(body.storageKey || body.storage?.key || '').trim();
  const storageProvider = String(body.storage?.provider || 'local_stub').trim();
  const storageUrl = body.storage?.url ? String(body.storage.url).trim() : null;
  const checksum = body.checksum ? String(body.checksum || '').trim() : null;
  const idempotencyKey = body.idempotencyKey ? String(body.idempotencyKey || '').trim() : null;

  if (!entityType) missing.push('entityType');
  if (!entityId) missing.push('entityId');
  if (!fileName) missing.push('fileName');
  if (!mimeType) missing.push('mimeType');
  if (!storageKey) missing.push('storageKey');
  if (entityType && !ENTITY_TYPES.has(entityType)) invalid.push('entityType');
  if (storageProvider && !STORAGE_PROVIDERS.has(storageProvider)) invalid.push('storage.provider');

  // [A-01] File size validation
  if (sizeBytes > MAX_ATTACHMENT_SIZE) {
    return NextResponse.json(
      { error: `File size exceeds maximum (${MAX_ATTACHMENT_SIZE / 1024 / 1024}MB)`, code: 'FILE_TOO_LARGE' },
      { status: 413 }
    );
  }

  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  let encounterCoreId = '';
  if (entityType === 'order_result') {
    const result = await prisma.orderResult.findFirst({
      where: { tenantId, id: entityId },
    });
    if (!result) {
      return NextResponse.json({ error: 'Order result not found' }, { status: 404 });
    }
    encounterCoreId = '';
  } else if (entityType === 'clinical_note') {
    const note = await prisma.clinicalNote.findFirst({
      where: { tenantId, id: entityId },
    });
    if (!note) {
      return NextResponse.json({ error: 'Clinical note not found' }, { status: 404 });
    }
    encounterCoreId = String(note.encounterCoreId || '');
  } else if (entityType === 'encounter_core') {
    const encounter = await prisma.encounterCore.findFirst({
      where: { tenantId, id: entityId },
    });
    if (!encounter) {
      return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
    }
    encounterCoreId = String(encounter.id || '');
  }

  const guard = await ensureResultsWriteAllowed({ tenantId, encounterCoreId });
  if (guard) return guard;

  if (idempotencyKey) {
    const existing = await prisma.attachment.findFirst({
      where: { tenantId, idempotencyKey },
    });
    if (existing) {
      return NextResponse.json({ success: true, noOp: true, id: existing.id, attachment: existing });
    }
  }

  const now = new Date();
  const attachmentData = {
    tenantId,
    entityType,
    entityId,
    fileName,
    mimeType,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
    storage: {
      provider: storageProvider || 'local_stub',
      key: storageKey,
      url: storageUrl || null,
    } as Prisma.InputJsonValue,
    checksum,
    createdAt: now,
    createdByUserId: userId || null,
    idempotencyKey: idempotencyKey || null,
  };

  try {
    const attachment = await prisma.attachment.create({ data: attachmentData });
    await createAuditLog(
      'attachment',
      attachment.id,
      'CREATE',
      userId || 'system',
      user?.email,
      { after: attachment },
      tenantId
    );
    return NextResponse.json({ attachment });
  } catch (err: unknown) {
    if (idempotencyKey) {
      const existing = await prisma.attachment.findFirst({
        where: { tenantId, idempotencyKey },
      });
      if (existing) {
        return NextResponse.json({ success: true, noOp: true, id: existing.id, attachment: existing });
      }
    }
    throw err;
  }
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' }
);
