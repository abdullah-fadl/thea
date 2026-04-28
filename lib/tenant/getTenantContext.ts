import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { mergeContextPack } from '@/lib/sam/tenantContext';
import { logger } from '@/lib/monitoring/logger';
import type { TenantContextOverlay, TenantContextPack } from '@/lib/models/TenantContext';

export const ORG_PROFILE_REQUIRED = 'ORG_PROFILE_REQUIRED';

export class OrgProfileRequiredError extends Error {
  code = ORG_PROFILE_REQUIRED;
  constructor() {
    super('Organization profile is required');
  }
}

export type TenantContextSummary = {
  tenantId: string;
  org: {
    typeId: string;
    typeName: string;
    sectorId: string;
    countryCode?: string | null;
    accreditationSetIds: string[];
  };
  requiredDocumentTypes: string[];
  glossary: Record<string, string>;
  guidanceDefaults: Record<string, any>;
  overlays: {
    applied: TenantContextOverlay[];
    ignored: TenantContextOverlay[];
  };
  contextVersion: string;
};

const buildContextHash = (payload: Record<string, any>) =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

function buildEmptyContext(tenantId: string): TenantContextSummary {
  return {
    tenantId,
    org: {
      typeId: '',
      typeName: '',
      sectorId: '',
      countryCode: null,
      accreditationSetIds: [],
    },
    requiredDocumentTypes: [],
    glossary: {},
    guidanceDefaults: {},
    overlays: { applied: [], ignored: [] },
    contextVersion: 'none',
  };
}

export async function getTenantContext(request: Request, tenantId: string): Promise<TenantContextSummary> {
  // Resolve tenant UUID
  let tenantUuid: string;
  try {
    const tenant = await prisma.tenant.findFirst({
      where: tenantWhere(tenantId),
      select: { id: true },
    });
    tenantUuid = tenant?.id || tenantId;
  } catch (error) {
    logger.error('getTenantContext: tenant lookup failed', { category: 'system', error });
    return buildEmptyContext(tenantId);
  }

  let packs: any[];
  try {
    packs = await prisma.$queryRawUnsafe(
      `SELECT * FROM tenant_context_packs WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      tenantUuid
    ) as Record<string, unknown>[];
  } catch (error) {
    // Table may not exist yet or DB error — return empty context, not 409
    logger.warn('getTenantContext: context packs query failed (table may not exist)', { category: 'system', error });
    return buildEmptyContext(tenantId);
  }

  if (!packs || packs.length === 0) {
    // No context pack configured — normal for tenants that don't use SAM.
    return buildEmptyContext(tenantId);
  }

  const basePack = packs[0] as TenantContextPack;

  let overlays: TenantContextOverlay[] = [];
  try {
    overlays = (await prisma.$queryRawUnsafe(
      `SELECT * FROM tenant_context_overlays WHERE "tenantId" = $1 ORDER BY "createdAt" ASC`,
      tenantUuid
    )) as TenantContextOverlay[];
  } catch (error) {
    logger.warn('getTenantContext: overlays query failed', { category: 'system', error });
  }

  const merged = mergeContextPack(basePack, overlays || []);
  const applied = (overlays || []).filter((overlay) => overlay.type !== 'SUGGESTION_PREFS');
  const ignored = (overlays || []).filter((overlay) => overlay.type === 'SUGGESTION_PREFS');

  const contextPayload = {
    orgTypeId: merged.orgTypeId,
    orgTypeNameSnapshot: merged.orgTypeNameSnapshot,
    sectorSnapshot: merged.sectorSnapshot,
    countryCode: merged.countryCode || null,
    accreditationSets: merged.accreditationSets || [],
    requiredDocumentTypes: merged.requiredDocumentTypes || [],
    glossary: merged.glossary || {},
    behavior: merged.behavior || {},
    appliedCount: applied.length,
    ignoredCount: ignored.length,
  };

  return {
    tenantId,
    org: {
      typeId: merged.orgTypeId,
      typeName: merged.orgTypeNameSnapshot,
      sectorId: merged.sectorSnapshot,
      countryCode: merged.countryCode || null,
      accreditationSetIds: merged.accreditationSets || [],
    },
    requiredDocumentTypes: merged.requiredDocumentTypes || [],
    glossary: merged.glossary || {},
    guidanceDefaults: merged.behavior || {},
    overlays: {
      applied,
      ignored,
    },
    contextVersion: buildContextHash(contextPayload),
  };
}

export function isContextEmpty(ctx: TenantContextSummary): boolean {
  return !ctx.org.typeId;
}

export function buildOrgProfileRequiredResponse() {
  return NextResponse.json({ error: ORG_PROFILE_REQUIRED }, { status: 409 });
}

/**
 * Get tenant context for SAM routes that require an org profile.
 * Throws OrgProfileRequiredError if no context pack exists.
 */
export async function requireTenantContext(request: Request, tenantId: string): Promise<TenantContextSummary> {
  const ctx = await getTenantContext(request, tenantId);
  if (isContextEmpty(ctx)) {
    throw new OrgProfileRequiredError();
  }
  return ctx;
}
