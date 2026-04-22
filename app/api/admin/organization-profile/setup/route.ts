import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { buildDefaultContextPack } from '@/lib/sam/tenantContext';
import type { TenantContextPack } from '@/lib/models/TenantContext';
import { ORGANIZATION_TYPE_CATALOG, getCatalogOrgType } from '@/lib/organization/catalog';
import { validateBody } from '@/lib/validation/helpers';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const setupSchema = z.object({
  orgTypeId: z.string().optional(),
  orgTypeName: z.string().optional(),
  orgTypeSource: z.enum(['catalog', 'custom']),
  sector: z.string().min(1),
  countryCode: z.string().min(1),
  accreditationSets: z.array(z.string()).optional(),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export const POST = withAuthTenant(async (req, { tenantId }) => {
  try {
    const v = validateBody(await req.json(), setupSchema);
    if ('error' in v) return v.error;
    const body = v.data;

    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const existingPack = await prisma.tenantContextPack.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPack) {
      return NextResponse.json(
        { error: 'Organization profile is locked after creation' },
        { status: 409 }
      );
    }

    const isCatalog = body.orgTypeSource === 'catalog';
    const catalogItem = isCatalog ? getCatalogOrgType(body.orgTypeId) : undefined;
    if (isCatalog && !catalogItem) {
      return NextResponse.json(
        { error: 'Organization type not found in catalog' },
        { status: 404 }
      );
    }
    if (!isCatalog && !body.orgTypeName) {
      return NextResponse.json(
        { error: 'Custom organization type is required' },
        { status: 400 }
      );
    }

    const orgTypeId = isCatalog
      ? catalogItem!.orgTypeId
      : `custom:${slugify(body.orgTypeName!)}`;
    const orgTypeNameSnapshot = isCatalog ? catalogItem!.displayName : body.orgTypeName!;
    const sectorSnapshot = body.sector || catalogItem?.defaultSector || 'other';
    const accreditationSets = [
      ...(catalogItem?.baselineAccreditationSets || []),
      ...(body.accreditationSets || []),
    ];

    const basePack = buildDefaultContextPack({
      tenantId: tenant.id,
      orgTypeId,
      orgTypeNameSnapshot,
      sectorSnapshot,
      countryCode: body.countryCode,
      status: 'ACTIVE',
    });

    basePack.accreditationSets = accreditationSets;
    basePack.requiredDocumentTypes = catalogItem?.baselineRequiredDocumentTypes?.length
      ? catalogItem.baselineRequiredDocumentTypes
      : basePack.requiredDocumentTypes;
    basePack.glossary = catalogItem?.baselineGlossary || basePack.glossary;
    basePack.behavior = {
      ...(basePack.behavior || {}),
      ...(catalogItem?.baselineGuidanceDefaults || {}),
    };

    await prisma.tenantContextPack.create({
      data: {
        tenantId: tenant.id,
        orgTypeId: basePack.orgTypeId,
        orgTypeNameSnapshot: basePack.orgTypeNameSnapshot,
        sectorSnapshot: basePack.sectorSnapshot,
        countryCode: basePack.countryCode || null,
        accreditationSets: basePack.accreditationSets as Prisma.InputJsonValue,
        requiredDocumentTypes: basePack.requiredDocumentTypes || [],
        baselineOperations: (basePack.baselineOperations as Prisma.InputJsonValue) || null,
        baselineFunctions: (basePack.baselineFunctions as Prisma.InputJsonValue) || null,
        baselineRiskDomains: (basePack.baselineRiskDomains as Prisma.InputJsonValue) || null,
        glossary: (basePack.glossary as Prisma.InputJsonValue) || null,
        behavior: (basePack.behavior as Prisma.InputJsonValue) || null,
        locked: basePack.locked || false,
        version: basePack.version || 1,
        status: basePack.status || 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      profile: {
        orgTypeId,
        orgTypeNameSnapshot,
        sectorSnapshot,
        countryCode: body.countryCode,
        accreditationSets,
        catalog: ORGANIZATION_TYPE_CATALOG.map((item) => ({
          id: item.orgTypeId,
          name: item.displayName,
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save organization profile';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
