/**
 * CVision Integrations — Factory & Re-exports
 *
 * Central entry point for all Saudi government and banking integrations.
 * Use `getIntegrationClient()` to get a pre-configured client by ID.
 */

import type { IntegrationMode } from './shared/types';
import type { IntegrationClient } from './shared/api-client';

// Clients
import { QiwaClient } from './qiwa/qiwa-client';
import { MudadClient } from './mudad/mudad-client';
import { GOSIClient } from './gosi/gosi-client';
import { AbsherClient } from './absher/absher-client';
import { MuqeemAPIClient } from './muqeem/muqeem-api-client';
import { YaqeenClient } from './yaqeen/yaqeen-client';
import { NafathClient } from './nafath/nafath-client';
import { WathqClient } from './wathq/wathq-client';
import { ZATCAClient } from './zatca/zatca-client';

// Shared
export { INTEGRATIONS_REGISTRY, FEATURE_LABELS } from './shared/types';
export type {
  IntegrationConfig,
  IntegrationLog,
  IntegrationMode,
  IntegrationStatus,
  IntegrationRegistryEntry,
  FileExport,
} from './shared/types';
export { IntegrationClient, IntegrationApiError } from './shared/api-client';
export type { IntegrationClientConfig } from './shared/api-client';

// Re-export all clients
export { QiwaClient } from './qiwa/qiwa-client';
export { MudadClient } from './mudad/mudad-client';
export { GOSIClient } from './gosi/gosi-client';
export { AbsherClient } from './absher/absher-client';
export { MuqeemAPIClient } from './muqeem/muqeem-api-client';
export { YaqeenClient } from './yaqeen/yaqeen-client';
export { NafathClient } from './nafath/nafath-client';
export { WathqClient } from './wathq/wathq-client';
export { ZATCAClient } from './zatca/zatca-client';

// ---------------------------------------------------------------------------
// Default API URLs (used when no custom URL is provided)
// ---------------------------------------------------------------------------

const DEFAULT_URLS: Record<string, string> = {
  qiwa: 'https://api.qiwa.sa',
  mudad: 'https://api.mudad.mlsd.gov.sa',
  gosi: 'https://api.gosi.gov.sa',
  absher: 'https://api.absher.sa',
  muqeem: 'https://api.muqeem.com.sa',
  yaqeen: 'https://api.elm.sa',
  nafath: 'https://api.iam.gov.sa',
  wathq: 'https://api.wathq.sa',
  zatca: 'https://gw-fatoora.zatca.gov.sa',
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface IntegrationFactoryConfig {
  tenantId: string;
  mode?: IntegrationMode;
  baseUrl?: string;
  apiKey?: string;
}

/**
 * Get a pre-configured integration client by registry ID.
 *
 * @example
 * ```ts
 * const yaqeen = getIntegrationClient('yaqeen', { tenantId }) as YaqeenClient;
 * const result = await yaqeen.verifyIdentity({ idNumber: '1098765432' });
 * ```
 */
export function getIntegrationClient(
  integrationId: string,
  config: IntegrationFactoryConfig,
): IntegrationClient {
  const baseUrl = config.baseUrl || DEFAULT_URLS[integrationId] || '';
  const mode = config.mode || 'SIMULATION';
  const shared = { tenantId: config.tenantId, baseUrl, apiKey: config.apiKey, mode };

  switch (integrationId) {
    case 'qiwa':
      return new QiwaClient(shared);
    case 'mudad':
      return new MudadClient(shared);
    case 'gosi':
      return new GOSIClient(shared);
    case 'absher':
      return new AbsherClient(shared);
    case 'muqeem':
      return new MuqeemAPIClient(shared);
    case 'yaqeen':
      return new YaqeenClient(shared);
    case 'nafath':
      return new NafathClient(shared);
    case 'wathq':
      return new WathqClient(shared);
    case 'zatca':
      return new ZATCAClient(shared);
    default:
      throw new Error(`Unknown integration: ${integrationId}`);
  }
}
