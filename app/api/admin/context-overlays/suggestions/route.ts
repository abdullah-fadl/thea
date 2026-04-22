import { NextResponse } from 'next/server';
import { logger } from '@/lib/monitoring/logger';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { tenantWhere } from '@/lib/db/tenantLookup';
import { mergeContextPack } from '@/lib/sam/tenantContext';
import type { TenantContextOverlay, TenantContextPack } from '@/lib/models/TenantContext';
import { getSuggestedOverlays } from '@/lib/sam/overlaySuggestions';

export const dynamic = 'force-dynamic';

const suggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().min(1),
      description: z.string().min(1),
      type: z.enum(['ACCREDITATION', 'REQUIRED_DOCS', 'GLOSSARY', 'RULES']),
      payload: z.record(z.string(), z.any()),
    })
  ),
  isDraft: z.boolean().optional(),
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const buildId = (profileKey: string, type: string, title: string) =>
  `${profileKey}:${type}:${slugify(title)}`;

const getProfileKey = (orgType?: string, sector?: string, country?: string) =>
  [orgType || 'unknown', sector || 'unknown', country || 'unknown'].join('|').toLowerCase();

export const GET = withAuthTenant(async (req, { tenantId }) => {
  try {
    // Resolve tenant UUID
    const tenant = await prisma.tenant.findFirst({ where: tenantWhere(tenantId), select: { id: true } });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    const basePack = await prisma.tenantContextPack.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    }) as unknown as TenantContextPack | null;

    if (!basePack) {
      return NextResponse.json({ suggestions: [], isDraft: true });
    }

    const overlays = await prisma.tenantContextOverlay.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }) as unknown as TenantContextOverlay[];

    const merged = mergeContextPack(basePack, overlays);

    const profileKey = getProfileKey(
      merged.orgTypeNameSnapshot,
      merged.sectorSnapshot,
      merged.countryCode || undefined
    );
    const { suggestions: baseSuggestions, isDraft } = getSuggestedOverlays({
      orgTypeName: merged.orgTypeNameSnapshot,
      sector: merged.sectorSnapshot,
      countryCode: merged.countryCode || null,
      accreditationSets: merged.accreditationSets || [],
    });

    const validated = suggestionSchema.parse({
      suggestions: baseSuggestions,
      isDraft,
    });

    const suggestions = validated.suggestions.map((suggestion) => ({
      ...suggestion,
      id: suggestion.id || buildId(profileKey, suggestion.type, suggestion.title),
    }));

    return NextResponse.json({
      suggestions,
      isDraft: validated.isDraft ?? false,
    });
  } catch (error: any) {
    logger.error('Suggestion service error', { category: 'api', route: 'GET /api/admin/context-overlays/suggestions', error });
    // [SEC-03]
    return NextResponse.json(
      { error: 'Failed to load suggestions' },
      { status: 500 }
    );
  }
}, { platformKey: 'sam', tenantScoped: true });
