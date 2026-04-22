import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { createAuditLog } from '@/lib/utils/audit';
import { canManageScheduling } from '@/lib/scheduling/access';
import { withSchedulingIdempotency } from '@/lib/scheduling/idempotency';
import { validateBody } from '@/lib/validation/helpers';
import { createResourceSchema } from '@/lib/validation/scheduling.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';
import { cached } from '@/lib/cache';
import { CacheKeys, CacheTTL } from '@/lib/cache/keys';
import { invalidateOnSchedulingChange } from '@/lib/cache/invalidation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const AREA_KEYS = ['opd', 'er', 'ipd', 'or', 'radiology', 'lab'] as const;
function isValidAreaKey(value: string) {
  const v = String(value || '').trim().toLowerCase();
  return (AREA_KEYS as readonly string[]).includes(v);
}

const RESOURCE_TYPES = new Set([
  'CLINIC_ROOM',
  'PROCEDURE_ROOM',
  'RADIOLOGY_ROOM',
  'LAB_STATION',
  'OR_ROOM',
  'CATH_LAB',
  'PHYSIO_ROOM',
  'BED',
  'EQUIPMENT',
  'STAFF_POOL',
  'PROVIDER',
]);

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId }) => {
  const normalizeDisplayName = (resource: any, providerDisplayById?: Record<string, string>) => {
    const direct = String(
      resource?.displayName ||
        resource?.nameAr ||
        resource?.nameEn ||
        resource?.name ||
        ''
    ).trim();
    if (direct) return direct;
    const providerId = String((resource?.resourceRef as Record<string, string>)?.providerId || resource?.resourceRefProviderId || '').trim();
    if (providerId && providerDisplayById?.[providerId]) return providerDisplayById[providerId];
    if (providerId) return providerId;
    const id = String(resource?.id || '').trim();
    return id || '—';
  };

  const params = req.nextUrl.searchParams;
  const departmentKey = String(params.get('departmentKey') || '').trim();
  const type = String(params.get('type') || '').trim().toUpperCase();
  const specialtyCode = String(params.get('specialtyCode') || '').trim();
  const specialtyCodeUpper = specialtyCode ? specialtyCode.toUpperCase() : '';
  const clinicId = String(params.get('clinicId') || '').trim();
  const date = String(params.get('date') || '').trim();

  const filterHash = [departmentKey, type, specialtyCode, clinicId].join('|');
  const canCache = !date && !specialtyCode;

  const fetchResources = async () => {
    const where: any = { tenantId };
    if (departmentKey) where.departmentKey = departmentKey;
    if (type) {
      if (type === 'PROVIDER') {
        where.resourceType = { in: ['PROVIDER', 'DOCTOR'] };
      } else {
        where.resourceType = type;
      }
    }
    if (clinicId) where.clinicId = clinicId;

    // Build OR conditions for specialty filtering
    const orConditions: any[] = [];

    if (specialtyCode && type === 'PROVIDER') {
      try {
        const codesToTry = Array.from(new Set([specialtyCode, specialtyCodeUpper, specialtyCode.toLowerCase()].filter(Boolean)));
        // Match by specialtyCode on the resource itself
        for (const c of codesToTry) {
          orConditions.push({ specialtyCode: c });
        }
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const specialtyOr: any[] = [
          ...codesToTry.flatMap((c) => [
            { code: { equals: c, mode: 'insensitive' as const } },
            { shortCode: { equals: c, mode: 'insensitive' as const } },
            { name: { equals: c, mode: 'insensitive' as const } },
          ]),
        ];
        if (uuidRe.test(specialtyCode)) specialtyOr.push({ id: specialtyCode });

        const specialties = await prisma.clinicalInfraSpecialty.findMany({
          where: { tenantId, isArchived: false, OR: specialtyOr },
          select: { id: true, code: true, name: true },
        });
        const resolvedIds = specialties.map((sp) => sp.id);
        const specialtyCodesResolved = specialties.map((sp) => sp.code);
        const specialtyNamesResolved = specialties.map((sp) => sp.name);
        const specialtyIdsForProfile = Array.from(new Set([...resolvedIds, ...specialtyCodesResolved].filter(Boolean)));

        const providerIdSets: string[] = [];
        if (specialtyIdsForProfile.length) {
          const providerProfiles = await prisma.clinicalInfraProviderProfile.findMany({
            where: { tenantId, specialtyIds: { hasSome: specialtyIdsForProfile } },
            select: { providerId: true },
          });
          providerIdSets.push(...providerProfiles.map((p) => p.providerId));
        }
        // Fallback: match providers whose ClinicalInfraProvider.specialtyCode matches (case-insensitive)
        const allCodesToMatch = Array.from(new Set([...codesToTry, ...specialtyCodesResolved, ...specialtyNamesResolved].filter(Boolean)));
        if (allCodesToMatch.length) {
          const providersBySpecialtyCode = await prisma.clinicalInfraProvider.findMany({
            where: {
              tenantId,
              isArchived: false,
              specialtyCode: { not: null },
              OR: allCodesToMatch.map((c) => ({ specialtyCode: { equals: c, mode: 'insensitive' as const } })),
            },
            select: { id: true },
          });
          providerIdSets.push(...providersBySpecialtyCode.map((p) => p.id));
        }
        // Fallback: providers assigned to clinics with this specialty
        if (resolvedIds.length > 0) {
          const clinicsWithSpecialty = await prisma.clinicalInfraClinic.findMany({
            where: { tenantId, isArchived: false, specialtyId: { in: resolvedIds } },
            select: { id: true },
          });
          const clinicIds = clinicsWithSpecialty.map((c) => c.id);
          if (clinicIds.length > 0) {
            const assignments = await prisma.clinicalInfraProviderAssignment.findMany({
              where: {
                tenantId,
                OR: [
                  { primaryClinicId: { in: clinicIds } },
                  { parallelClinicIds: { hasSome: clinicIds } },
                ],
              },
              select: { providerId: true },
            });
            providerIdSets.push(...assignments.map((a) => a.providerId));
          }
        }

        const allProviderIds = Array.from(new Set(providerIdSets.filter(Boolean)));
        if (allProviderIds.length) {
          orConditions.push({ resourceRefProviderId: { in: allProviderIds } });
        }
      } catch (err) {
        logger.warn('Scheduling resources specialty filter failed', { category: 'api', error: String(err) });
      }
    }

    if (orConditions.length) {
      where.OR = orConditions;
    }

    const items = await prisma.schedulingResource.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    const uniqueItems = Array.from(
      new Map(
        items.map((item) => {
          const providerId = String((item.resourceRef as Record<string, unknown>)?.providerId || item.resourceRefProviderId || '').trim();
          const isProviderLike = ['PROVIDER', 'DOCTOR'].includes(String(item.resourceType || '').toUpperCase());
          const key = isProviderLike && providerId ? `provider:${providerId}` : item.id;
          return [key, item];
        })
      ).values()
    );

    const providerIds = Array.from(
      new Set(
        uniqueItems
          .filter((r: any) => ['PROVIDER', 'DOCTOR'].includes(String(r.resourceType || '').toUpperCase()))
          .map((r: any) => String((r.resourceRef as Record<string, string>)?.providerId || r.resourceRefProviderId || '').trim())
          .filter(Boolean)
      )
    );
    let providerDisplayById: Record<string, string> = {};
    if (providerIds.length) {
      const providers = await prisma.clinicalInfraProvider.findMany({
        where: { tenantId, id: { in: providerIds }, isArchived: false },
        select: { id: true, displayName: true },
      });
      providerDisplayById = providers.reduce<Record<string, string>>((acc, p) => {
        if (p.displayName) acc[String(p.id)] = p.displayName;
        return acc;
      }, {});
    }
    return uniqueItems.map((resource: any) => {
      const displayName = normalizeDisplayName(resource, providerDisplayById);
      return { ...resource, displayName, name: resource?.name || displayName };
    });
  };

  const normalizedItems = canCache
    ? await cached(
        CacheKeys.schedulingResourcesFiltered(tenantId, filterHash),
        fetchResources,
        CacheTTL.SCHEDULING,
      )
    : await fetchResources();

  if (!date || normalizedItems.length === 0) {
    return NextResponse.json({ items: normalizedItems });
  }

  // Date-enriched path: add live slot counts (never cached)
  const enrichedItems = await Promise.all(
    normalizedItems.map(async (resource: any) => {
      const resourceId = resource.id;
      if (!resourceId) return resource;
      const [availableSlots, bookedSlots] = await Promise.all([
        prisma.schedulingSlot.count({
          where: { tenantId, resourceId, date, status: 'OPEN' },
        }),
        prisma.schedulingSlot.count({
          where: { tenantId, resourceId, date, status: { in: ['HELD', 'BOOKED', 'CHECKED_IN', 'BLOCKED'] } },
        }),
      ]);
      const totalSlots = availableSlots + bookedSlots;
      return {
        ...resource,
        availableSlots,
        bookedSlots,
        totalSlots,
      };
    })
  );

  return NextResponse.json({ items: enrichedItems });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.view' }
);

export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user, role }) => {
  if (!canManageScheduling({ user, tenantId, role })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const v = validateBody(body, createResourceSchema);
  if ('error' in v) return v.error;

  const missing: string[] = [];
  const invalid: string[] = [];
  const resourceType = String(body.resourceType || '').trim().toUpperCase();
  let departmentKey = String(body.departmentKey || '').trim();
  let displayName = String(body.displayName || '').trim();
  const tags = Array.isArray(body.tags) ? body.tags.map((t: any) => String(t).trim()).filter(Boolean) : [];
  const status = String(body.status || 'ACTIVE').trim().toUpperCase();
  const consultationServiceCode = String(body.consultationServiceCode || '').trim() || null;
  const level = String(body.level || '').trim().toUpperCase() || null;
  const allowClinicalRef = process.env.CLINICAL_INFRA_SCHEDULING_REF === '1';
  const resourceRef = allowClinicalRef && body.resourceRef ? body.resourceRef : null;
  const clientRequestId = String(body.clientRequestId || '').trim() || null;

  if (!resourceType) missing.push('resourceType');
  if (resourceType && !RESOURCE_TYPES.has(resourceType)) invalid.push('resourceType');
  if (resourceType !== 'PROVIDER') {
    if (!departmentKey) missing.push('departmentKey');
    if (!displayName) missing.push('displayName');
  }
  if (missing.length || invalid.length) {
    return NextResponse.json({ error: 'Validation failed', missing, invalid }, { status: 400 });
  }

  return withSchedulingIdempotency({
    tenantId,
    method: 'POST',
    pathname: '/api/scheduling/resources',
    clientRequestId,
    handler: async () => {
      try {
        let providerLink: any = null;
        let providerIdentity: { providerId: string } | null = null;
        if (resourceType === 'PROVIDER') {
          const deptLower = String(departmentKey || '').trim().toLowerCase();
          if (!deptLower) {
            departmentKey = 'opd';
          } else if (deptLower.startsWith('provider:')) {
            return NextResponse.json({ error: 'Invalid departmentKey', code: 'INVALID_DEPARTMENT_KEY' }, { status: 400 });
          } else if (!isValidAreaKey(deptLower)) {
            return NextResponse.json({ error: 'Invalid departmentKey', code: 'INVALID_DEPARTMENT_KEY' }, { status: 400 });
          } else {
            departmentKey = deptLower;
          }

          const providerId =
            String(body.providerId || '').trim() ||
            String(body.resourceRef?.providerId || '').trim();
          if (!providerId) {
            return NextResponse.json({ error: 'providerId is required for PROVIDER resources' }, { status: 400 });
          }
          const provider = await prisma.clinicalInfraProvider.findFirst({
            where: { tenantId, id: providerId, isArchived: false },
            select: { id: true, displayName: true },
          });
          if (!provider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
          }
          displayName = provider.displayName || providerId;
          providerLink = { kind: 'provider', providerId };
          providerIdentity = { providerId };
        }

        // Provider resources must be unique by providerId
        if (providerIdentity?.providerId) {
          const existingProvider = await prisma.schedulingResource.findFirst({
            where: {
              tenantId,
              resourceType: { in: ['PROVIDER', 'DOCTOR'] },
              resourceRefProviderId: providerIdentity.providerId,
              status: { not: 'ARCHIVED' },
            },
          });
          if (existingProvider) {
            return NextResponse.json({ success: true, noOp: true, resource: existingProvider });
          }
        }

        // For non-provider resources, use the @@unique constraint for upsert
        // For provider resources, we already checked uniqueness above, so just create
        const resourceId = uuidv4();
        let resource: any = null;

        if (!providerIdentity?.providerId) {
          // Non-provider: use unique constraint upsert
          try {
            resource = await prisma.schedulingResource.upsert({
              where: {
                tenantId_resourceType_departmentKey_displayName: {
                  tenantId,
                  resourceType,
                  departmentKey,
                  displayName,
                },
              },
              update: {}, // no-op if exists
              create: {
                id: resourceId,
                tenantId,
                resourceType,
                departmentKey,
                displayName,
                tags,
                status,
                ...(consultationServiceCode ? { consultationServiceCode } : {}),
                ...(level ? { level } : {}),
                ...(resourceRef ? { resourceRef } : {}),
              },
            });
            // Check if this was an existing resource (upsert returned existing)
            if (resource.id !== resourceId) {
              return NextResponse.json({ success: true, noOp: true, resource });
            }
          } catch (error: any) {
            if (error?.code === 'P2002') {
              resource = await prisma.schedulingResource.findFirst({
                where: { tenantId, resourceType, departmentKey, displayName },
              });
              if (resource) {
                return NextResponse.json({ success: true, noOp: true, resource });
              }
            }
            throw error;
          }
        } else {
          // Provider: just create
          resource = await prisma.schedulingResource.create({
            data: {
              id: resourceId,
              tenantId,
              resourceType,
              departmentKey,
              displayName,
              tags,
              status,
              resourceRef: providerLink,
              resourceRefProviderId: providerIdentity.providerId,
              resourceRefKind: 'provider',
              ...(consultationServiceCode ? { consultationServiceCode } : {}),
              ...(level ? { level } : {}),
            },
          });
        }

        if (!resource) {
          return NextResponse.json(
            { error: 'Failed to create resource', code: 'RESOURCE_UPSERT_NULL' },
            { status: 500 }
          );
        }

        try {
          await createAuditLog(
            'scheduling_resource',
            resource.id,
            'CREATE',
            userId || 'system',
            user?.email,
            { after: resource },
            tenantId
          );
        } catch (error) {
          logger.warn('Scheduling resources audit failed', { category: 'api', error });
        }

        await invalidateOnSchedulingChange(tenantId);

        return NextResponse.json({ resource });
      } catch (error: any) {
        logger.error('Scheduling resources handler failed', { category: 'api', error });
        return NextResponse.json(
          // [SEC-10]
          { error: 'Failed to create resource' },
          { status: 500 }
        );
      }
    },
  });
}),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'scheduling.create' }
);
