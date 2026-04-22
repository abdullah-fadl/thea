import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { requireAdminDeleteCode, requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { withIdempotency } from '@/lib/clinicalInfra/idempotency';
import { CLINICAL_INFRA_COLLECTIONS } from '@/lib/clinicalInfra/collections';
import { archiveDoc, createDoc, deleteDoc, listDocs, updateDoc } from '@/lib/clinicalInfra/crud';
import { validateBody } from '@/lib/validation/helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;
  const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';
  const search = req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '';
  const items = await listDocs({

    tenantId,
    collection: CLINICAL_INFRA_COLLECTIONS.floors,
    includeArchived,
    search,
    searchFields: ['shortCode', 'name'],
  });
  return NextResponse.json({ items });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.view' });

export const POST = withAuthTenant(async (req: NextRequest, { tenantId, userId, user }) => {
  const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const postSchema = z.object({
    name: z.string().min(1),
    facilityId: z.string().min(1),
    level: z.unknown().optional(),
    clientRequestId: z.string().optional(),
  }).passthrough();
  const v = validateBody(body, postSchema);
  if ('error' in v) return v.error;

  const clientRequestId = String(body.clientRequestId || '').trim() || null;
  const name = String(body.name || '').trim();
  const facilityId = String(body.facilityId || '').trim();
  const level = body.level === undefined || body.level === null || body.level === '' ? null : Number(body.level);
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!facilityId) return NextResponse.json({ error: 'facilityId is required' }, { status: 400 });

  return withIdempotency({

    tenantId,
    method: 'POST',
    pathname: '/api/clinical-infra/floors',
    clientRequestId,
    handler: () =>
      createDoc({
    
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.floors,
        entityType: 'clinical_infra_floor',
        doc: { name, facilityId, level: Number.isFinite(level) ? level : null },
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.manage' });

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
  if (body.name !== undefined) patch.name = String(body.name || '').trim();
  if (body.facilityId !== undefined) patch.facilityId = String(body.facilityId || '').trim();
  if (body.level !== undefined) {
    const lvl = body.level === null || body.level === '' ? null : Number(body.level);
    patch.level = Number.isFinite(lvl) ? lvl : null;
  }

  return withIdempotency({

    tenantId,
    method: 'PUT',
    pathname: '/api/clinical-infra/floors',
    clientRequestId,
    handler: () =>
      updateDoc({
    
        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.floors,
        entityType: 'clinical_infra_floor',
        id,
        patch,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.manage' });

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
    pathname: '/api/clinical-infra/floors',
    clientRequestId,
    handler: () =>
      archiveDoc({

        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.floors,
        entityType: 'clinical_infra_floor',
        id,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.manage' });

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
    pathname: '/api/clinical-infra/floors',
    clientRequestId,
    handler: () =>
      deleteDoc({

        tenantId,
        userId,
        collection: CLINICAL_INFRA_COLLECTIONS.floors,
        entityType: 'clinical_infra_floor',
        id,
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
        path: req.nextUrl.pathname,
      }),
  });
}, { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.manage' });

