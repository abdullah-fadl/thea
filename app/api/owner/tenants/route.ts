import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, getAllAggregatedTenantData } from '@/lib/core/owner/separation';
import { requireAuthContext } from '@/lib/auth/requireAuthContext';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { buildDefaultContextPack, DEFAULT_REQUIRED_DOCUMENT_TYPES } from '@/lib/sam/tenantContext';
import { Tenant } from '@/lib/models/Tenant';
import { env } from '@/lib/env';
import { generateTenantDbName } from '@/lib/db/dbNameHelper';
import { validateBody } from '@/lib/validation/helpers';
import { createTenantSchema } from '@/lib/validation/owner.schema';
import { withErrorHandler } from '@/lib/core/errors';
import { logger } from '@/lib/monitoring/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/owner/tenants
 * List all tenants (owner only)
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
    // Require owner role
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get auth context for platform collection access
    const authContext = await requireAuthContext(request, true);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    // Hard gate: Only platform roles can access this endpoint
    if (authContext.tenantId !== 'platform') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      // Use aggregated tenant data (owner-only, no user names)
      const aggregatedTenants = await getAllAggregatedTenantData();
      // Exclude owner tenant from stats
      const customerTenants = aggregatedTenants.filter(t => t.tenantId !== 'thea-owner-dev');

      const stats = {
        totalTenants: customerTenants.length,
        activeTenants: customerTenants.filter(t => t.status === 'active').length,
        blockedTenants: customerTenants.filter(t => t.status === 'blocked').length,
        totalUsers: customerTenants.reduce((sum, t) => sum + t.activeUsersCount, 0),
      };
      return NextResponse.json({ stats });
    }

    // Get aggregated tenant data (owner-only, no user names)
    const aggregatedTenants = await getAllAggregatedTenantData();

    logger.info('Found aggregated tenants', { category: 'api', count: aggregatedTenants.length });

    // Filter out owner tenant -- it's the system foundation, not a regular tenant
    const OWNER_TENANT_KEY = 'thea-owner-dev';
    const customerTenants = aggregatedTenants.filter(
      (t) => t.tenantId !== OWNER_TENANT_KEY
    );

    // Map to include userCount for frontend compatibility
    const tenantsWithUserCount = customerTenants.map((agg) => ({
      ...agg,
      userCount: agg.activeUsersCount, // Map activeUsersCount to userCount for frontend
      planType: agg.planType, // From getAggregatedTenantData (demo | paid)
    }));

    return NextResponse.json({ tenants: tenantsWithUserCount });
});

/**
 * POST /api/owner/tenants
 * Create a new tenant (owner only)
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
    const authResult = await requireOwner(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { userId } = authResult;
    const body = await request.json();
    const v = validateBody(body, createTenantSchema);
    if ('error' in v) return v.error;

    const data = v.data;
    const now = new Date();

    // Get auth context for platform collection access
    const authContext = await requireAuthContext(request, true);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    // Hard gate: Only platform roles can create tenants
    if (authContext.tenantId !== 'platform') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Platform access required' },
        { status: 403 }
      );
    }

    // Check if tenantId already exists
    const existing = await prisma.tenant.findFirst({ where: { tenantId: data.tenantId } });
    if (existing) {
      return NextResponse.json(
        { error: 'Tenant ID already exists' },
        { status: 409 }
      );
    }

    // Generate dbName for tenant
    const dbName = generateTenantDbName(data.tenantId);

    let orgTypeId = data.orgTypeId;
    let orgTypeNameSnapshot = '';
    let orgTypeSectorSnapshot = data.sector;
    let orgTypeCountrySnapshot: string | null = data.countryCode;
    let contextPackStatus: 'ACTIVE' | 'PENDING_REVIEW' = 'ACTIVE';

    if (data.orgTypeDraftPayload) {
      const draftOrgType = await prisma.organizationType.create({
        data: {
          name: data.orgTypeDraftPayload.name.trim(),
          sector: data.orgTypeDraftPayload.sector.trim(),
          countryCode: data.orgTypeDraftPayload.countryCode || null,
          status: 'DRAFT_PENDING_REVIEW',
        },
      });

      orgTypeId = draftOrgType.id;
      orgTypeNameSnapshot = draftOrgType.name;
      orgTypeSectorSnapshot = draftOrgType.sector;
      orgTypeCountrySnapshot = draftOrgType.countryCode || data.countryCode;
      contextPackStatus = 'PENDING_REVIEW';

      const proposalPack = buildDefaultContextPack({
        tenantId: 'proposal',
        orgTypeId: draftOrgType.id,
        orgTypeNameSnapshot: draftOrgType.name,
        sectorSnapshot: draftOrgType.sector,
        countryCode: draftOrgType.countryCode || null,
        status: 'PENDING_REVIEW',
      });

      await prisma.organizationTypeProposal.create({
        data: {
          orgTypeId: draftOrgType.id,
          status: 'PENDING_REVIEW',
          proposal: proposalPack as unknown as Prisma.InputJsonValue,
        },
      });
    } else if (orgTypeId) {
      const orgType = await prisma.organizationType.findFirst({ where: { id: orgTypeId } });
      if (!orgType) {
        return NextResponse.json(
          { error: 'Organization type not found' },
          { status: 404 }
        );
      }
      orgTypeNameSnapshot = orgType.name;
      orgTypeSectorSnapshot = orgType.sector;
      orgTypeCountrySnapshot = orgType.countryCode || data.countryCode;
      contextPackStatus = orgType.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_REVIEW';
    }

    // Map status/planType to PostgreSQL enum values (ACTIVE, DEMO, etc.)
    const rawStatus = (data.status || 'active').toUpperCase();
    const statusEnum = ['ACTIVE', 'BLOCKED', 'EXPIRED'].includes(rawStatus) ? rawStatus : 'ACTIVE';
    const rawPlan = (data.planType || 'demo').toUpperCase();
    const planTypeEnum = ['DEMO', 'TRIAL', 'PAID', 'ENTERPRISE'].includes(rawPlan) ? rawPlan : 'DEMO';

    // Create tenant via Prisma
    const createdTenant = await prisma.tenant.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        dbName,
        orgTypeId,
        sector: data.sector,
        countryCode: data.countryCode,
        orgTypeChangeCount: 0,
        entitlementSam: data.entitlements?.sam ?? true,
        entitlementHealth: data.entitlements?.health ?? true,
        entitlementEdrac: data.entitlements?.edrac ?? false,
        entitlementCvision: data.entitlements?.cvision ?? false,
        status: statusEnum as any,
        planType: planTypeEnum as any,
        subscriptionEndsAt: data.subscriptionEndsAt ? new Date(data.subscriptionEndsAt) : undefined,
        maxUsers: data.maxUsers || 10,
        gracePeriodEnabled: false,
        createdBy: userId,
      },
    });

    // Create tenant context pack
    try {
      const existingProposal = orgTypeId
        ? await prisma.organizationTypeProposal.findFirst({ where: { orgTypeId } })
        : null;
      const proposalPack = existingProposal?.proposal;

      const contextPack = (proposalPack as unknown as Record<string, unknown>) || buildDefaultContextPack({
        tenantId: createdTenant.id,
        orgTypeId: orgTypeId || '',
        orgTypeNameSnapshot: orgTypeNameSnapshot || data.orgTypeDraftPayload?.name || 'Unknown',
        sectorSnapshot: orgTypeSectorSnapshot || data.sector,
        countryCode: orgTypeCountrySnapshot || data.countryCode,
        status: contextPackStatus,
      });

      contextPack.tenantId = createdTenant.id;
      contextPack.orgTypeId = orgTypeId || '';
      contextPack.orgTypeNameSnapshot = orgTypeNameSnapshot || data.orgTypeDraftPayload?.name || 'Unknown';
      contextPack.sectorSnapshot = orgTypeSectorSnapshot || data.sector;
      contextPack.countryCode = orgTypeCountrySnapshot || data.countryCode;
      contextPack.status = contextPackStatus;
      contextPack.requiredDocumentTypes = (contextPack.requiredDocumentTypes as any[])?.length
        ? contextPack.requiredDocumentTypes
        : DEFAULT_REQUIRED_DOCUMENT_TYPES;

      await prisma.tenantContextPack.create({
        data: {
          tenantId: createdTenant.id,
          orgTypeId: contextPack.orgTypeId as string,
          orgTypeNameSnapshot: contextPack.orgTypeNameSnapshot as string,
          sectorSnapshot: contextPack.sectorSnapshot as string,
          countryCode: (contextPack.countryCode as string) || null,
          accreditationSets: (contextPack.accreditationSets as Prisma.InputJsonValue) || [],
          requiredDocumentTypes: (contextPack.requiredDocumentTypes as string[]) || [],
          baselineOperations: (contextPack.baselineOperations as Prisma.InputJsonValue) || null,
          baselineFunctions: (contextPack.baselineFunctions as Prisma.InputJsonValue) || null,
          baselineRiskDomains: (contextPack.baselineRiskDomains as Prisma.InputJsonValue) || null,
          glossary: (contextPack.glossary as Prisma.InputJsonValue) || null,
          behavior: (contextPack.behavior as Prisma.InputJsonValue) || null,
          locked: (contextPack.locked as boolean) || false,
          version: (contextPack.version as number) || 1,
          status: (contextPack.status as string) || 'ACTIVE',
        },
      });

      logger.info('Tenant context pack created', { category: 'api', tenantId: data.tenantId });
    } catch (contextError) {
      logger.error('Failed to create tenant context pack', { category: 'api', tenantId: data.tenantId, error: contextError });
      // Don't fail tenant creation if context pack fails
    }

    const tenant: Tenant = {
      ...createdTenant as unknown as Tenant,
      tenantId: data.tenantId,
      entitlements: {
        sam: createdTenant.entitlementSam,
        health: createdTenant.entitlementHealth,
        edrac: createdTenant.entitlementEdrac,
        cvision: createdTenant.entitlementCvision,
        imdad: true,
      },
      status: data.status || 'active',
      planType: data.planType || 'demo',
    };

    return NextResponse.json({
      success: true,
      tenant,
    });
});
