import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { withErrorHandler } from '@/lib/core/errors';
import { validateBody } from '@/lib/validation/helpers';
import { checkDrugInteractions } from '@/lib/pharmacy/drugInteractions';
import { logger } from '@/lib/monitoring/logger';
import interactionData from '@/data/drug-interactions.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const interactionsCheckSchema = z.object({
  medications: z.array(z.object({
    name: z.string().min(1),
    id: z.string().optional(),
  })).min(2, 'At least two medications are required to check interactions'),
});

function normalizeName(value: string) {
  return String(value || '').trim().toLowerCase();
}

/**
 * POST /api/clinical/interactions/check
 * Check drug-drug interactions for a list of medications.
 * Returns warnings with severity levels (critical, major, moderate, minor).
 */
export const POST = withAuthTenant(
  withErrorHandler(async (req: NextRequest, { tenantId, userId }) => {
    const body = await req.json().catch(() => ({}));
    const v = validateBody(body, interactionsCheckSchema);
    if ('error' in v) return v.error;

    const { medications } = v.data;
    const interactions: Array<{
      drug1: string;
      drug2: string;
      severity: string;
      description: string;
      descriptionAr: string;
      recommendation: string;
      recommendationAr: string;
    }> = [];

    const aliases = (interactionData as Record<string, unknown>).drugAliases as Record<string, string[]> || {};
    const interactionList = (interactionData as Record<string, unknown>).interactions as Array<Record<string, string>> || [];

    const normalizeWithAliases = (name: string) => {
      const normalized = normalizeName(name);
      const aliasList = Object.entries(aliases).find(([, list]: any) =>
        Array.isArray(list) && list.some((alias: string) => normalized.includes(normalizeName(alias)))
      );
      return aliasList ? normalizeName(aliasList[0]) : normalized;
    };

    // Check all pairwise combinations
    for (let i = 0; i < medications.length; i += 1) {
      for (let j = i + 1; j < medications.length; j += 1) {
        const drug1 = normalizeWithAliases(medications[i].name);
        const drug2 = normalizeWithAliases(medications[j].name);

        const interaction = interactionList.find((int) => {
          const d1 = normalizeName(int.drug1);
          const d2 = normalizeName(int.drug2);
          return (
            (drug1.includes(d1) || drug1.includes(d2)) &&
            (drug2.includes(d1) || drug2.includes(d2))
          );
        });

        if (interaction) {
          interactions.push({
            drug1: medications[i].name,
            drug2: medications[j].name,
            severity: interaction.severity || 'moderate',
            description: interaction.description || '',
            descriptionAr: interaction.descriptionAr || '',
            recommendation: interaction.recommendation || '',
            recommendationAr: interaction.recommendationAr || '',
          });
        }
      }
    }

    // Also check via the pharmacy drugInteractions library for broader coverage
    for (let i = 0; i < medications.length; i += 1) {
      const others = medications.filter((_, idx) => idx !== i).map((m) => m.name);
      const libResults = checkDrugInteractions(medications[i].name, others);
      for (const result of libResults) {
        // Avoid duplicates
        const alreadyFound = interactions.some(
          (existing) =>
            (existing.drug1 === medications[i].name && existing.drug2 === result.interaction?.drug2) ||
            (existing.drug2 === medications[i].name && existing.drug1 === result.interaction?.drug1)
        );
        if (!alreadyFound && result.interaction) {
          const desc = result.interaction.description;
          const rec = result.interaction.recommendation;
          interactions.push({
            drug1: result.interaction.drug1 || medications[i].name,
            drug2: result.interaction.drug2 || '',
            severity: result.severity || 'moderate',
            description: typeof desc === 'string' ? desc : desc?.en || '',
            descriptionAr: typeof desc === 'string' ? '' : desc?.ar || '',
            recommendation: typeof rec === 'string' ? rec : rec?.en || '',
            recommendationAr: typeof rec === 'string' ? '' : rec?.ar || '',
          });
        }
      }
    }

    const severityOrder: Record<string, number> = { critical: 0, major: 1, moderate: 2, minor: 3 };
    interactions.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

    const hasCritical = interactions.some((i) => i.severity === 'critical');
    const hasMajor = interactions.some((i) => i.severity === 'major');

    if (hasCritical || hasMajor) {
      logger.warn('Drug interactions detected', {
        category: 'api',
        tenantId,
        userId,
        route: '/api/clinical/interactions/check',
        medicationCount: medications.length,
        interactionCount: interactions.length,
        hasCritical,
        hasMajor,
      });
    }

    return NextResponse.json({
      hasInteractions: interactions.length > 0,
      hasCritical,
      hasMajor,
      interactions,
      summary: {
        total: interactions.length,
        critical: interactions.filter((i) => i.severity === 'critical').length,
        major: interactions.filter((i) => i.severity === 'major').length,
        moderate: interactions.filter((i) => i.severity === 'moderate').length,
        minor: interactions.filter((i) => i.severity === 'minor').length,
      },
    });
  }),
  { tenantScoped: true, platformKey: 'thea_health', permissionKey: 'clinical.view' }
);
