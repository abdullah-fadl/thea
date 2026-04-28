/**
 * Integration Settings Helpers
 *
 * Functions to check integration settings and gating rules
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export interface IntegrationSettings {
  enabled: boolean;
  autoTriggerEnabled: boolean;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  engineTimeoutMs: number;
}

/**
 * Get integration settings for a tenant
 */
export async function getIntegrationSettings(tenantId: string): Promise<IntegrationSettings | null> {
  try {
    const tenant = await prisma.tenant.findFirst({
      where: { tenantId },
    });

    if (!tenant) {
      return null;
    }

    return (tenant as any).integrations?.samHealth || null;
  } catch (error) {
    logger.error('Error fetching integration settings', { category: 'system', error });
    return null;
  }
}

/**
 * Check if integration is enabled for a tenant
 * Integration requires:
 * 1. Both SAM and Health entitlements
 * 2. Integration enabled in settings
 */
export async function isIntegrationEnabled(
  tenantId: string,
  hasSam: boolean,
  hasHealth: boolean
): Promise<boolean> {
  // Must have both platforms
  if (!hasSam || !hasHealth) {
    return false;
  }

  // Check integration settings
  const settings = await getIntegrationSettings(tenantId);
  if (!settings) {
    // Default: enabled if both platforms available
    return true;
  }

  return settings.enabled;
}

/**
 * Check if auto-trigger is enabled for a tenant
 */
export async function isAutoTriggerEnabled(tenantId: string): Promise<boolean> {
  const settings = await getIntegrationSettings(tenantId);
  if (!settings) {
    // Default: enabled
    return true;
  }

  return settings.autoTriggerEnabled;
}

/**
 * Get severity threshold for a tenant
 */
export async function getSeverityThreshold(tenantId: string): Promise<'low' | 'medium' | 'high' | 'critical'> {
  const settings = await getIntegrationSettings(tenantId);
  if (!settings) {
    return 'low'; // Default: show all alerts
  }

  return settings.severityThreshold;
}

/**
 * Check if alert severity meets threshold
 */
export function meetsSeverityThreshold(
  alertSeverity: 'low' | 'medium' | 'high' | 'critical',
  threshold: 'low' | 'medium' | 'high' | 'critical'
): boolean {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  return severityOrder[alertSeverity] >= severityOrder[threshold];
}
