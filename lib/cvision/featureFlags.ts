/**
 * CVision (HR OS) - Feature Flags
 * 
 * Controls integration with other platforms (SAM, Thea Health).
 * All integrations are disabled by default to maintain CVision isolation.
 * 
 * To enable an integration:
 * 1. Set the feature flag to true
 * 2. Implement the integration logic
 * 3. Add tests
 * 4. Document the integration in /docs/cvision/README.md
 */

// =============================================================================
// Integration Feature Flags
// =============================================================================

/**
 * Employee Sync Integration
 * 
 * When enabled, CVision can sync employee data with SAM/Thea Health.
 * Default: false (disabled)
 */
export const FEATURE_EMPLOYEE_SYNC = false;

/**
 * Auth Federation Integration
 * 
 * When enabled, CVision can federate authentication with SAM/Thea Health.
 * Default: false (disabled)
 */
export const FEATURE_AUTH_FEDERATION = false;

/**
 * Data Export Integration
 * 
 * When enabled, CVision can export data to SAM/Thea Health formats.
 * Default: false (disabled)
 */
export const FEATURE_DATA_EXPORT = false;

/**
 * Cross-Platform Reporting
 * 
 * When enabled, CVision can generate reports combining data from multiple platforms.
 * Default: false (disabled)
 */
export const FEATURE_CROSS_PLATFORM_REPORTING = false;

// =============================================================================
// Feature Flag Checks
// =============================================================================

/**
 * Check if employee sync is enabled
 */
export function isEmployeeSyncEnabled(): boolean {
  return FEATURE_EMPLOYEE_SYNC as boolean;
}

/**
 * Check if auth federation is enabled
 */
export function isAuthFederationEnabled(): boolean {
  return FEATURE_AUTH_FEDERATION as boolean;
}

/**
 * Check if data export is enabled
 */
export function isDataExportEnabled(): boolean {
  return FEATURE_DATA_EXPORT as boolean;
}

/**
 * Check if cross-platform reporting is enabled
 */
export function isCrossPlatformReportingEnabled(): boolean {
  return FEATURE_CROSS_PLATFORM_REPORTING as boolean;
}

// =============================================================================
// Feature Flag Metadata
// =============================================================================

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  requires: string[];
}

/**
 * Get all feature flags with metadata
 */
export function getAllFeatureFlags(): FeatureFlag[] {
  return [
    {
      key: 'employee_sync',
      name: 'Employee Sync',
      description: 'Sync employee data with SAM/Thea Health',
      enabled: FEATURE_EMPLOYEE_SYNC,
      requires: ['sam', 'health'],
    },
    {
      key: 'auth_federation',
      name: 'Auth Federation',
      description: 'Federate authentication with SAM/Thea Health',
      enabled: FEATURE_AUTH_FEDERATION,
      requires: ['sam', 'health'],
    },
    {
      key: 'data_export',
      name: 'Data Export',
      description: 'Export CVision data to SAM/Thea Health formats',
      enabled: FEATURE_DATA_EXPORT,
      requires: ['sam', 'health'],
    },
    {
      key: 'cross_platform_reporting',
      name: 'Cross-Platform Reporting',
      description: 'Generate reports combining data from multiple platforms',
      enabled: FEATURE_CROSS_PLATFORM_REPORTING,
      requires: ['sam', 'health'],
    },
  ];
}

/**
 * Get enabled feature flags only
 */
export function getEnabledFeatureFlags(): FeatureFlag[] {
  return getAllFeatureFlags().filter(flag => flag.enabled);
}

/**
 * Check if a specific feature flag is enabled
 */
export function isFeatureEnabled(key: string): boolean {
  const flag = getAllFeatureFlags().find(f => f.key === key);
  return flag?.enabled === true;
}

// =============================================================================
// Integration Guards
// =============================================================================

/**
 * Guard function to prevent integration code from running when disabled
 * Throws an error if the feature is not enabled
 */
export function requireFeature(key: string): void {
  if (!isFeatureEnabled(key)) {
    throw new Error(
      `Feature "${key}" is not enabled. ` +
      `Enable it in /lib/cvision/featureFlags.ts`
    );
  }
}

/**
 * Guard function that returns early if feature is disabled
 * Useful for conditional logic
 */
export function guardFeature<T>(
  key: string,
  fn: () => T
): T | null {
  if (!isFeatureEnabled(key)) {
    return null;
  }
  return fn();
}
