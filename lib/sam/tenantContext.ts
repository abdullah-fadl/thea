import { prisma } from '@/lib/db/prisma';
import type { TenantContextOverlay, TenantContextPack, TenantContextOverlayType } from '@/lib/models/TenantContext';
import { logger } from '@/lib/monitoring/logger';

export const DEFAULT_REQUIRED_DOCUMENT_TYPES = [
  'policy',
  'sop',
  'workflow',
  'checklist',
  'form',
  'guideline',
  'instruction',
];

const overlayArray = (value: any): any[] => (Array.isArray(value) ? value : value ? [value] : []);

const toUniqueList = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export function mergeContextPack(
  basePack: TenantContextPack,
  overlays: TenantContextOverlay[]
): TenantContextPack {
  const merged: TenantContextPack = {
    ...basePack,
    accreditationSets: [...(basePack.accreditationSets || [])],
    requiredDocumentTypes: [...(basePack.requiredDocumentTypes || [])],
    glossary: { ...(basePack.glossary || {}) },
    behavior: { ...(basePack.behavior || {}) },
  };

  overlays.forEach((overlay) => {
    switch (overlay.type) {
      case 'ACCREDITATION': {
        merged.accreditationSets = [
          ...merged.accreditationSets,
          ...overlayArray(overlay.payload?.items || overlay.payload),
        ];
        merged.accreditationSets = toUniqueList(
          merged.accreditationSets.map((item) => String(item))
        );
        break;
      }
      case 'REQUIRED_DOCS': {
        merged.requiredDocumentTypes = toUniqueList([
          ...merged.requiredDocumentTypes,
          ...overlayArray(overlay.payload?.items || overlay.payload).map((item) => String(item)),
        ]);
        break;
      }
      case 'GLOSSARY': {
        const glossaryEntries = overlay.payload?.entries || overlay.payload;
        if (glossaryEntries && typeof glossaryEntries === 'object') {
          merged.glossary = { ...(merged.glossary || {}), ...glossaryEntries };
        }
        break;
      }
      case 'RULES': {
        const rules = overlay.payload?.rules || overlay.payload;
        if (rules && typeof rules === 'object') {
          merged.behavior = { ...(merged.behavior || {}), ...rules };
        }
        break;
      }
      case 'SUGGESTION_PREFS': {
        break;
      }
      default:
        break;
    }
  });

  return merged;
}

export async function getTenantContextPack(tenantId: string) {
  try {
    // TODO: Add Prisma models for tenant_context_packs and tenant_context_overlays
    // For now, return null (no context pack found)
    const packs = await prisma.$queryRawUnsafe(
      `SELECT * FROM tenant_context_packs WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      tenantId
    ) as Record<string, unknown>[];

    if (!packs || packs.length === 0) {
      return null;
    }

    const basePack = packs[0] as unknown as TenantContextPack;

    const overlays = await prisma.$queryRawUnsafe(
      `SELECT * FROM tenant_context_overlays WHERE "tenantId" = $1 ORDER BY "createdAt" ASC`,
      basePack.tenantId
    ) as TenantContextOverlay[];

    return mergeContextPack(basePack, overlays || []);
  } catch (error) {
    // Tables may not exist yet
    logger.warn('getTenantContextPack error (tables may not exist yet)', { category: 'general', error });
    return null;
  }
}

export function buildDefaultContextPack({
  tenantId,
  orgTypeId,
  orgTypeNameSnapshot,
  sectorSnapshot,
  countryCode,
  status,
}: {
  tenantId: string;
  orgTypeId: string;
  orgTypeNameSnapshot: string;
  sectorSnapshot: string;
  countryCode?: string | null;
  status: TenantContextPack['status'];
}): TenantContextPack {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    tenantId,
    orgTypeId,
    orgTypeNameSnapshot,
    sectorSnapshot,
    countryCode: countryCode || null,
    accreditationSets: [],
    requiredDocumentTypes: [...DEFAULT_REQUIRED_DOCUMENT_TYPES],
    baselineOperations: [],
    baselineFunctions: [],
    baselineRiskDomains: [],
    glossary: {},
    behavior: {
      strictness: 'balanced',
      tone: 'operational',
    },
    locked: true,
    version: 1,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

export const OVERLAY_TYPES: TenantContextOverlayType[] = [
  'ACCREDITATION',
  'REQUIRED_DOCS',
  'GLOSSARY',
  'RULES',
  'SUGGESTION_PREFS',
];
