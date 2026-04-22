/**
 * Imdad SFDA Integration Client
 *
 * Client for interacting with the Saudi Food and Drug Authority (SFDA) APIs.
 * Supports GTIN verification, NDC lookup, compliance checks,
 * drug track & trace, and medical device UDI lookup.
 */

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class SfdaError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'SFDA_ERROR', statusCode = 502) {
    super(message);
    this.name = 'SfdaError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Client interface
// ---------------------------------------------------------------------------

interface SfdaProduct {
  gtin?: string;
  ndc?: string;
  productName?: string;
  productNameAr?: string;
  manufacturer?: string;
  registrationStatus?: string;
  marketAuthorizationHolder?: string;
  [key: string]: unknown;
}

interface SfdaComplianceResult {
  licenseNumber: string;
  facilityName?: string;
  status: string;
  isCompliant: boolean;
  lastInspectionDate?: string;
  [key: string]: unknown;
}

interface SfdaTrackTraceResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
}

interface SfdaDeviceResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
}

interface SfdaClientInstance {
  verifyGtin(gtin: string, tenantId: string): Promise<SfdaProduct>;
  getProductByNdc(ndc: string, tenantId: string): Promise<SfdaProduct>;
  getComplianceStatus(licenseNumber: string, tenantId: string): Promise<SfdaComplianceResult>;
  submitDrugTrackAndTrace(data: Record<string, unknown>, tenantId: string, organizationId: string): Promise<SfdaTrackTraceResult>;
  lookupDeviceUdi(udiCode: string, tenantId: string, organizationId: string): Promise<SfdaDeviceResult>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  return process.env.SFDA_BASE_URL || 'https://api.sfda.gov.sa';
}

function getApiKey(): string {
  return process.env.SFDA_API_KEY || '';
}

async function sfdaFetch(path: string, options?: RequestInit): Promise<Response> {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new SfdaError('SFDA_API_KEY is not configured', 'SFDA_NOT_CONFIGURED', 503);
  }

  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        ...(options?.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new SfdaError(
        `SFDA API returned ${response.status}: ${body.slice(0, 500)}`,
        'SFDA_API_ERROR',
        response.status >= 500 ? 502 : response.status,
      );
    }

    return response;
  } catch (err) {
    if (err instanceof SfdaError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown SFDA error';
    throw new SfdaError(message, 'SFDA_NETWORK_ERROR', 502);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

function createClient(_tenantId?: string): SfdaClientInstance {
  return {
    async verifyGtin(gtin: string, tenantId: string): Promise<SfdaProduct> {
      const res = await sfdaFetch(`/v1/products/gtin/${encodeURIComponent(gtin)}?tenantId=${tenantId}`);
      return res.json();
    },

    async getProductByNdc(ndc: string, tenantId: string): Promise<SfdaProduct> {
      const res = await sfdaFetch(`/v1/products/ndc/${encodeURIComponent(ndc)}?tenantId=${tenantId}`);
      return res.json();
    },

    async getComplianceStatus(licenseNumber: string, tenantId: string): Promise<SfdaComplianceResult> {
      const res = await sfdaFetch(`/v1/compliance/${encodeURIComponent(licenseNumber)}?tenantId=${tenantId}`);
      return res.json();
    },

    async submitDrugTrackAndTrace(
      data: Record<string, unknown>,
      tenantId: string,
      organizationId: string,
    ): Promise<SfdaTrackTraceResult> {
      try {
        const res = await sfdaFetch('/v1/track-trace/submit', {
          method: 'POST',
          body: JSON.stringify({ ...data, tenantId, organizationId }),
        });
        const json = await res.json();
        return { success: true, data: json };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message, errorCode: 'SFDA_SUBMISSION_FAILED' };
      }
    },

    async lookupDeviceUdi(
      udiCode: string,
      tenantId: string,
      organizationId: string,
    ): Promise<SfdaDeviceResult> {
      try {
        const res = await sfdaFetch(
          `/v1/devices/udi/${encodeURIComponent(udiCode)}?tenantId=${tenantId}&organizationId=${organizationId}`,
        );
        const json = await res.json();
        return { success: true, data: json };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: message, errorCode: 'SFDA_DEVICE_LOOKUP_FAILED' };
      }
    },
  };
}

/**
 * Create a tenant-scoped SFDA client.
 * Usage: `const client = createSfdaClient(tenantId);`
 */
export function createSfdaClient(tenantId: string): SfdaClientInstance {
  return createClient(tenantId);
}

/**
 * Default (non-tenant-scoped) SFDA client singleton.
 * Used by routes that import `sfdaClient` directly.
 */
export const sfdaClient: SfdaClientInstance = createClient();
