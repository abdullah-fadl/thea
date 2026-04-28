/**
 * Consultation Pricing Migration
 *
 * Ensures every SchedulingResource that offers consultations has
 * pricing data in its metadata. If pricing is missing, seeds defaults
 * from DEFAULT_PRICING and records the migration in SystemSetting.
 *
 * Models: SystemSetting (core.prisma), SchedulingResource (scheduling.prisma),
 * BillingChargeCatalog (billing.prisma).
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

const MIGRATION_KEY = 'migration_consultation_pricing_v1';

const DEFAULT_PRICING = {
  consultant: 300,
  specialist: 200,
  resident: 100,
  default: 200,
};

const DEFAULT_RULES = {
  followUpFree: true,
  followUpDays: 14,
  requiresApproval: false,
};

function isMissingPricing(pricing: any) {
  return !pricing || typeof pricing.default !== 'number' || pricing.default <= 0;
}

export async function runConsultationPricingMigration(_db: any, tenantId: string) {
  try {
    // Check if migration already ran (key scoped by tenantId since SystemSetting is global)
    const scopedKey = `${MIGRATION_KEY}:${tenantId}`;
    const existing = await prisma.systemSetting.findUnique({
      where: { key: scopedKey },
    });
    if (existing) {
      return { skipped: true, reason: 'ALREADY_RAN' };
    }

    // Find scheduling resources without consultation pricing
    const resources = await prisma.schedulingResource.findMany({
      where: { tenantId },
    });

    let updated = 0;
    for (const resource of resources) {
      const meta = (resource as Record<string, unknown>).metadata as Record<string, unknown> || {};
      const pricing = meta.consultationPricing;

      if (isMissingPricing(pricing)) {
        const resourceType = String(meta.providerType || meta.type || 'default').toLowerCase();
        const price = (DEFAULT_PRICING as Record<string, number>)[resourceType] || DEFAULT_PRICING.default;

        await prisma.schedulingResource.update({
          where: { id: resource.id },
          data: {
            metadata: {
              ...meta,
              consultationPricing: {
                ...DEFAULT_PRICING,
                assigned: price,
              },
              consultationRules: DEFAULT_RULES,
            },
          } as Parameters<typeof prisma.schedulingResource.update>[0]['data'],
        });
        updated++;
      }
    }

    // Record migration (SystemSetting is global, scope key by tenantId)
    await prisma.systemSetting.create({
      data: {
        key: scopedKey,
        value: {
          tenantId,
          completedAt: new Date().toISOString(),
          resourcesUpdated: updated,
          totalResources: resources.length,
        },
      },
    });

    logger.info('Consultation pricing migration complete', {
      category: 'system',
      tenantId,
      updated,
      total: resources.length,
    });

    return { success: true, updated, total: resources.length };
  } catch (error) {
    logger.error('Consultation pricing migration failed', { category: 'system', tenantId, error });
    return { skipped: true, reason: 'ERROR', error: error instanceof Error ? error.message : String(error) };
  }
}

// Export constants for consumers that reference them
export { MIGRATION_KEY, DEFAULT_PRICING, DEFAULT_RULES, isMissingPricing };
