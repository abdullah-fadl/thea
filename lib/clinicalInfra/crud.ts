import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/db/prisma';
import { startAudit, finishAudit } from '@/lib/clinicalInfra/audit';
import { allocateShortCode } from '@/lib/clinicalInfra/publicIds';

export function nowDates() {
  const now = new Date();
  return { now };
}

// ---------------------------------------------------------------------------
// Prisma model accessor mapping
// Maps collection names (from CLINICAL_INFRA_COLLECTIONS) to Prisma delegates.
// ---------------------------------------------------------------------------

type PrismaDelegate = {
  findMany: (...args: any[]) => Promise<any[]>;
  findFirst: (...args: any[]) => Promise<any>;
  create: (...args: any[]) => Promise<any>;
  update: (...args: any[]) => Promise<any>;
  delete: (...args: any[]) => Promise<any>;
  upsert: (...args: any[]) => Promise<any>;
  count: (...args: any[]) => Promise<number>;
};

/**
 * Models that use `isArchived` / `archivedAt` for soft-delete semantics.
 * Models NOT in this set use `status` field ('active' / 'inactive') instead.
 */
const ARCHIVABLE_COLLECTIONS = new Set([
  'clinical_infra_providers',
  'clinical_infra_clinics',
  'clinical_infra_specialties',
  'clinical_infra_provider_profiles',
  'clinical_infra_provider_assignments',
  'departments',
]);

const MODEL_MAP: Record<string, PrismaDelegate> = {
  clinical_infra_providers: prisma.clinicalInfraProvider as unknown as PrismaDelegate,
  clinical_infra_clinics: prisma.clinicalInfraClinic as unknown as PrismaDelegate,
  clinical_infra_specialties: prisma.clinicalInfraSpecialty as unknown as PrismaDelegate,
  clinical_infra_provider_profiles: prisma.clinicalInfraProviderProfile as unknown as PrismaDelegate,
  clinical_infra_provider_assignments: prisma.clinicalInfraProviderAssignment as unknown as PrismaDelegate,
  departments: prisma.department as unknown as PrismaDelegate,
  clinical_infra_facilities: prisma.clinicalInfraFacility as unknown as PrismaDelegate,
  clinical_infra_floors: prisma.clinicalInfraFloor as unknown as PrismaDelegate,
  clinical_infra_units: prisma.clinicalInfraUnit as unknown as PrismaDelegate,
  clinical_infra_rooms: prisma.clinicalInfraRoom as unknown as PrismaDelegate,
  clinical_infra_beds: prisma.clinicalInfraBed as unknown as PrismaDelegate,
};

function getModel(collection: string): PrismaDelegate {
  const model = MODEL_MAP[collection];
  if (!model) {
    throw new Error(`[clinicalInfra/crud] Unknown collection "${collection}"`);
  }
  return model;
}

function usesIsArchived(collection: string): boolean {
  return ARCHIVABLE_COLLECTIONS.has(collection);
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listDocs(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  collection: string;
  includeArchived?: boolean;
  limit?: number;
  search?: string;
  searchFields?: string[];
}) {
  const limit = Math.max(1, Math.min(2000, Number(args.limit ?? 2000)));
  const model = getModel(args.collection);

  const where: any = { tenantId: args.tenantId };

  if (!args.includeArchived) {
    if (usesIsArchived(args.collection)) {
      where.isArchived = false;
    } else {
      // Physical infra models use status field — filter out 'archived' status
      where.NOT = { status: 'archived' };
    }
  }

  const search = String(args.search || '').trim();
  if (search) {
    const fields = args.searchFields?.length
      ? args.searchFields
      : ['shortCode', 'code', 'name', 'displayName', 'label', 'email', 'staffId'];
    where.OR = fields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));
  }

  return model.findMany({ where, orderBy: [{ createdAt: 'asc' }], take: limit });
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createDoc(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  userId: string;
  collection: string;
  entityType: string;
  doc: Record<string, any>;
  ip?: string | null;
  path?: string | null;
}) {
  const { now } = nowDates();
  const id = String(args.doc.id || uuidv4());
  const shortCode = await allocateShortCode({
    tenantId: args.tenantId,
    entityType: args.entityType,
  });

  const isArchivable = usesIsArchived(args.collection);

  const doc: Record<string, any> = {
    ...args.doc,
    id,
    tenantId: args.tenantId,
    shortCode: shortCode || undefined,
    createdAt: now,
    updatedAt: now,
  };

  if (isArchivable) {
    doc.isArchived = false;
  }

  const { auditId } = await startAudit({
    tenantId: args.tenantId,
    userId: args.userId,
    entityType: args.entityType,
    entityId: id,
    action: 'CREATE',
    before: null,
    after: doc,
    ip: args.ip,
    path: args.path,
  });

  try {
    const model = getModel(args.collection);
    const stored = await model.upsert({
      where: { id },
      create: doc,
      update: {},
    });
    await finishAudit({ tenantId: args.tenantId, auditId, ok: true });
    return NextResponse.json({ item: stored, idempotent: false });
  } catch (e: any) {
    await finishAudit({ tenantId: args.tenantId, auditId, ok: false, error: String(e?.message || e) });
    if (e?.code === 'P2002') {
      const target = Array.isArray(e?.meta?.target) ? e.meta.target.join(', ') : e?.meta?.target ?? 'field';
      return NextResponse.json(
        { error: 'DUPLICATE_VALUE', message: `Duplicate value for: ${target}`, meta: e?.meta },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateDoc(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  userId: string;
  collection: string;
  entityType: string;
  id: string;
  patch: Record<string, any>;
  immutableKeys?: string[];
  ip?: string | null;
  path?: string | null;
}) {
  const { now } = nowDates();
  const id = String(args.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const model = getModel(args.collection);
  const before = await model.findFirst({ where: { tenantId: args.tenantId, id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (Object.prototype.hasOwnProperty.call(args.patch || {}, 'shortCode')) {
    return NextResponse.json({ error: 'shortCode is immutable' }, { status: 409 });
  }

  const immutable = new Set<string>(['tenantId', 'id', 'createdAt', ...(args.immutableKeys || [])]);
  immutable.add('shortCode');
  const patch: any = {};
  for (const [k, v] of Object.entries(args.patch || {})) {
    if (immutable.has(k)) continue;
    patch[k] = v;
  }
  patch.updatedAt = now;

  const afterPreview = { ...before, ...patch };
  const { auditId } = await startAudit({
    tenantId: args.tenantId,
    userId: args.userId,
    entityType: args.entityType,
    entityId: id,
    action: 'UPDATE',
    before,
    after: afterPreview,
    ip: args.ip,
    path: args.path,
  });

  try {
    const stored = await model.update({ where: { id }, data: patch });
    await finishAudit({ tenantId: args.tenantId, auditId, ok: true });
    return NextResponse.json({ item: stored });
  } catch (e: any) {
    await finishAudit({ tenantId: args.tenantId, auditId, ok: false, error: String(e?.message || e) });
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Archive (soft delete)
// ---------------------------------------------------------------------------

export async function archiveDoc(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  userId: string;
  collection: string;
  entityType: string;
  id: string;
  ip?: string | null;
  path?: string | null;
}) {
  const { now } = nowDates();
  const id = String(args.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const model = getModel(args.collection);
  const before = await model.findFirst({ where: { tenantId: args.tenantId, id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isArchivable = usesIsArchived(args.collection);
  const archivePatch: Record<string, any> = { updatedAt: now };
  if (isArchivable) {
    archivePatch.isArchived = true;
    archivePatch.archivedAt = now;
  } else {
    archivePatch.status = 'archived';
  }

  const afterPreview = { ...before, ...archivePatch };
  const { auditId } = await startAudit({
    tenantId: args.tenantId,
    userId: args.userId,
    entityType: args.entityType,
    entityId: id,
    action: 'ARCHIVE',
    before,
    after: afterPreview,
    ip: args.ip,
    path: args.path,
  });

  try {
    const stored = await model.update({
      where: { id },
      data: archivePatch,
    });
    await finishAudit({ tenantId: args.tenantId, auditId, ok: true });
    return NextResponse.json({ item: stored });
  } catch (e: any) {
    await finishAudit({ tenantId: args.tenantId, auditId, ok: false, error: String(e?.message || e) });
    return NextResponse.json({ error: 'Failed to archive' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Delete (hard delete)
// ---------------------------------------------------------------------------

export async function deleteDoc(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  userId: string;
  collection: string;
  entityType: string;
  id: string;
  ip?: string | null;
  path?: string | null;
}) {
  const id = String(args.id || '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const model = getModel(args.collection);
  const before = await model.findFirst({ where: { tenantId: args.tenantId, id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { auditId } = await startAudit({
    tenantId: args.tenantId,
    userId: args.userId,
    entityType: args.entityType,
    entityId: id,
    action: 'DELETE',
    before,
    after: null,
    ip: args.ip,
    path: args.path,
  });

  try {
    await model.delete({ where: { id } });
    await finishAudit({ tenantId: args.tenantId, auditId, ok: true });
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    await finishAudit({ tenantId: args.tenantId, auditId, ok: false, error: String(e?.message || e) });
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
