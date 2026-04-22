/**
 * Feature Flags
 *
 * Two layers:
 *  1. Environment flags (global kill switch)
 *  2. Tenant flags (per-customer toggle, stored in cvision_tenant_settings.enabledModules)
 *
 * Environment flags override tenant flags — if the env flag is off,
 * the feature is off even if the tenant has it enabled.
 */

export interface FeatureFlags {
  AI_MATCHING: boolean;
  VIDEO_INTERVIEW: boolean;
  WHATSAPP_NOTIFICATIONS: boolean;
  DEMO_MODE: boolean;
  DARK_MODE: boolean;
  MULTI_LANGUAGE: boolean;
  WELLNESS_PROGRAM: boolean;
  CAREER_PAGE: boolean;
  CHATBOT: boolean;
  PREDICTIVE_ANALYTICS: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    AI_MATCHING: process.env.FEATURE_AI_MATCHING === 'true',
    VIDEO_INTERVIEW: process.env.FEATURE_VIDEO_INTERVIEW === 'true',
    WHATSAPP_NOTIFICATIONS: process.env.FEATURE_WHATSAPP_NOTIFICATIONS === 'true',
    DEMO_MODE: process.env.FEATURE_DEMO_MODE === 'true',
    DARK_MODE: true,
    MULTI_LANGUAGE: true,
    WELLNESS_PROGRAM: false,
    CAREER_PAGE: true,
    CHATBOT: !!process.env.ANTHROPIC_API_KEY,
    PREDICTIVE_ANALYTICS: false,
  };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}

/**
 * Check if a specific feature is enabled for a given tenant.
 * In production, merge with tenant-level overrides from the DB.
 */
export async function isFeatureEnabledForTenant(
  flag: keyof FeatureFlags,
  _tenantId: string,
  _db?: any,
): Promise<boolean> {
  const globalFlag = isFeatureEnabled(flag);
  if (!globalFlag) return false;

  // Tenant-level override (if DB provided)
  if (_db) {
    const settings = await _db.collection('cvision_tenant_settings').findOne({ tenantId: _tenantId });
    if (settings?.disabledFeatures?.includes(flag)) return false;
  }

  return true;
}

/**
 * Returns a safe, client-friendly subset of feature flags
 * (never expose API keys or internal env vars).
 */
export function getClientFeatureFlags(): Record<string, boolean> {
  const flags = getFeatureFlags();
  return {
    aiMatching: flags.AI_MATCHING,
    videoInterview: flags.VIDEO_INTERVIEW,
    whatsapp: flags.WHATSAPP_NOTIFICATIONS,
    demoMode: flags.DEMO_MODE,
    darkMode: flags.DARK_MODE,
    multiLanguage: flags.MULTI_LANGUAGE,
    chatbot: flags.CHATBOT,
  };
}
