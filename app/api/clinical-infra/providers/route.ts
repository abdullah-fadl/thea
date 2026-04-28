import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireAdminDeleteCode, requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { CLINICAL_INFRA_COLLECTIONS } from '@/lib/clinicalInfra/collections';
import { archiveDoc, createDoc, deleteDoc, listDocs, updateDoc } from '@/lib/clinicalInfra/crud';
import { validateBody } from '@/lib/validation/helpers';
import { prisma } from '@/lib/db/prisma';
import { cached } from '@/lib/cache';
import { CacheKeys, CacheTTL } from '@/lib/cache/keys';
import { invalidateProviders } from '@/lib/cache/invalidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPLOYMENT_TYPES = new Set(['FULL_TIME', 'PART_TIME']);

function normalizeEmploymentType(value: unknown) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw === 'FT') return 'FULL_TIME';
  if (raw === 'PT') return 'PART_TIME';
  if (EMPLOYMENT_TYPES.has(raw)) return raw;
  return null;
}

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';
  const search = req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '';

  // Only cache unfiltered list requests (no search, no archived)
  const canCache = !search && !includeArchived;
  const fetchProviders = () =>
    listDocs({
      tenantId,
      collection: CLINICAL_INFRA_COLLECTIONS.providers,
      includeArchived,
      search,
      searchFields: ['shortCode', 'displayName', 'email', 'staffId'],
    });

  const items = canCache
    ? await cached(CacheKeys.providerList(tenantId), fetchProviders, CacheTTL.PROVIDERS)
    : await fetchProviders();

  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'thea_health' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const postSchema = z.object({
    displayName: z.string().min(1),
    email: z.string().optional(),
    staffId: z.string().optional(),
    employmentType: z.string().optional(),
    clientRequestId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, postSchema);
  if ('error' in v) return v.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const displayName = String(body.displayName || '').trim();
  if (!displayName) return NextResponse.json({ error: 'displayName is required' }, { status: 400 });
  const employmentType =
    body.employmentType === undefined ? 'FULL_TIME' : normalizeEmploymentType(body.employmentType);
  if (!employmentType) {
    return NextResponse.json({ error: 'employmentType invalid' }, { status: 400 });
  }
  const email = String(body.email || '').trim() || undefined;

  return withIdempotency({

    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/providers',
    clientRequestId,
    handler: async () => {
      const result = await createDoc({
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.providers,
        entityType: 'clinical_infra_provider',
        doc: {
          displayName,
          email,
          staffId: String(body.staffId || '').trim() || undefined,
          employmentType,
        },
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      });
      await invalidateProviders(tenantId);
      return result;
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health' });

export const PUT = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const putSchema = z.object({ id: z.string().min(1), clientRequestId: z.string().optional() }).passthrough();
  const vp = validateBody(body, putSchema);
  if ('error' in vp) return vp.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const id = String(body.id || '').trim();
  const patch: any = {};
  if (body.displayName !== undefined) patch.displayName = String(body.displayName || '').trim();
  if (body.email !== undefined) patch.email = String(body.email || '').trim() || undefined;
  if (body.staffId !== undefined) patch.staffId = String(body.staffId || '').trim() || undefined;
  if (body.employmentType !== undefined) {
    const normalized = normalizeEmploymentType(body.employmentType);
    if (!normalized) {
      return NextResponse.json({ error: 'employmentType invalid' }, { status: 400 });
    }
    patch.employmentType = normalized;
  }

  return withIdempotency({

    tenantId,
    method: 'PUT',
    pathname: '/api/clinical-infra/providers',
    clientRequestId,
    handler: async () => {
      const result = await updateDoc({
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.providers,
        entityType: 'clinical_infra_provider',
        id,
        patch,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      });
      await invalidateProviders(tenantId);
      return result;
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health' });

export const PATCH = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const patchSchema = z.object({ id: z.string().min(1), clientRequestId: z.string().optional() }).passthrough();
  const va = validateBody(body, patchSchema);
  if ('error' in va) return va.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const id = String(body.id || '').trim();

  return withIdempotency({

    tenantId,
    method: 'PATCH',
    pathname: '/api/clinical-infra/providers',
    clientRequestId,
    handler: async () => {
      const result = await archiveDoc({
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.providers,
        entityType: 'clinical_infra_provider',
        id,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      });
      await invalidateProviders(tenantId);
      return result;
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health' });

export const DELETE = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const body = await req.json().catch(() => ({}));
  const guard = requireAdminDeleteCode(req, body);
  if (guard) return guard;
  const delSchema = z.object({ id: z.string().min(1), clientRequestId: z.string().optional() }).passthrough();
  const vd = validateBody(body, delSchema);
  if ('error' in vd) return vd.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const id = String(body.id || '').trim();

  return withIdempotency({

    tenantId,
    method: 'DELETE',
    pathname: '/api/clinical-infra/providers',
    clientRequestId,
    handler: async () => {
      const provider = await prisma.clinicalInfraProvider.findFirst({ where: { tenantId, id } });
      if (!provider) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      await prisma.$transaction(async (tx) => {
        await tx.clinicalInfraProviderProfile.deleteMany({ where: { tenantId, providerId: id } });
        await tx.clinicalInfraProviderAssignment.deleteMany({ where: { tenantId, providerId: id } });
        await tx.$executeRawUnsafe(
          'DELETE FROM clinical_infra_provider_privileges WHERE "tenantId" = $1::uuid AND "providerId" = $2::uuid',
          tenantId,
          id
        );
        await tx.$executeRawUnsafe(
          'DELETE FROM clinical_infra_provider_room_assignments WHERE "tenantId" = $1::uuid AND "providerId" = $2::uuid',
          tenantId,
          id
        );
        await tx.$executeRawUnsafe(
          'DELETE FROM clinical_infra_provider_unit_scopes WHERE "tenantId" = $1::uuid AND "providerId" = $2::uuid',
          tenantId,
          id
        );
        await tx.clinicalInfraProvider.delete({ where: { id } });
      });

      await invalidateProviders(tenantId);

      return NextResponse.json({ ok: true, id });
    },
  });
}, { tenantScoped: true, platformKey: 'thea_health' });

