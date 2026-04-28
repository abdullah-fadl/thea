import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { requireClinicalInfraAdmin } from '@/lib/clinicalInfra/access';
import { prisma } from '@/lib/db/prisma';
import { cached } from '@/lib/cache';
import { CacheKeys, CacheTTL } from '@/lib/cache/keys';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const GET = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId, user }) => {
    const admin = await requireClinicalInfraAdmin(req, { tenantId, userId, user });
    if (admin instanceof NextResponse) return admin;

    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === '1';
    const search = String(req.nextUrl.searchParams.get('search') || req.nextUrl.searchParams.get('q') || '').trim();
    const specialtyId = String(req.nextUrl.searchParams.get('specialtyId') || req.nextUrl.searchParams.get('specialtyCode') || '').trim();

    // Only cache the unfiltered summary (no search, no specialty filter, no archived)
    const canCache = !search && !specialtyId && !includeArchived;

    const fetchSummary = async () => {
      const where: any = { tenantId };
      if (!includeArchived) where.isArchived = false;

      if (search) {
        where.OR = [
          { shortCode: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { staffId: { contains: search, mode: 'insensitive' } },
          { specialtyCode: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (specialtyId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(specialtyId);
        const resolvedSpecialtyIds = isUuid
          ? [specialtyId]
          : (await prisma.clinicalInfraSpecialty.findMany({
              where: { tenantId, OR: [{ code: specialtyId }, { shortCode: specialtyId }] },
              select: { id: true },
            })).map((s) => s.id);
        if (resolvedSpecialtyIds.length === 0) {
          return { items: [], earlyReturn: true };
        }
        const profiles = await prisma.clinicalInfraProviderProfile.findMany({
          where: { tenantId, specialtyIds: { hasSome: resolvedSpecialtyIds } },
          select: { providerId: true },
        });
        const providerIds = [...new Set(profiles.map((p) => p.providerId).filter(Boolean))];
        if (providerIds.length === 0) {
          return { items: [], earlyReturn: true };
        }
        where.id = { in: providerIds };
      }

      const providers = await prisma.clinicalInfraProvider.findMany({
        where,
        orderBy: [{ displayName: 'asc' }],
        take: 2000,
      });

      const providerIds = providers.map((p: any) => String(p.id || '')).filter(Boolean);
      const profiles = providerIds.length
        ? await prisma.clinicalInfraProviderProfile.findMany({
            where: { tenantId, providerId: { in: providerIds } },
          })
        : [];
      const profileByProviderId = profiles.reduce<Record<string, any>>((acc, profile) => {
        acc[String(profile.providerId || '')] = profile;
        return acc;
      }, {});

      const items = providers.map((provider: any) => ({
        ...provider,
        profile: profileByProviderId[String(provider.id || '')] || null,
      }));

      return { items, earlyReturn: false };
    };

    const result = canCache
      ? await cached(CacheKeys.providerSummary(tenantId), fetchSummary, CacheTTL.PROVIDERS)
      : await fetchSummary();

    return NextResponse.json({ items: result.items });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical_infra.view' }
);
