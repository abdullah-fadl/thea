/**
 * WHO ICD API Integration
 *
 * Provides fallback ICD-10/ICD-11 code lookup via the WHO ICD API.
 * Used when a code is not found in the local comprehensive dataset.
 *
 * WHO ICD API docs: https://icd.who.int/icdapi
 * Requires: WHO_ICD_CLIENT_ID and WHO_ICD_CLIENT_SECRET env vars.
 * If credentials are not configured, the fallback is silently skipped.
 */

import { logger } from '@/lib/monitoring/logger';

// ── Types ──────────────────────────────────────────────────────────

export interface WHOIcdResult {
  code: string;
  description: string;
  descriptionAr?: string;
  chapter?: string;
  category?: string;
  source: 'who';
}

interface WHOTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface WHOSearchResult {
  destinationEntities?: Array<{
    id: string;
    title: string;
    theCode?: string;
    score?: number;
    chapter?: string;
  }>;
  resultChopped?: boolean;
  wordSuggestions?: unknown;
  error?: boolean;
  errorMessage?: string;
}

// ── Token cache ────────────────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

const WHO_TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';
const WHO_API_BASE = 'https://id.who.int';

// ── Helpers ────────────────────────────────────────────────────────

function getCredentials() {
  const clientId = process.env.WHO_ICD_CLIENT_ID;
  const clientSecret = process.env.WHO_ICD_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string | null> {
  const creds = getCredentials();
  if (!creds) return null;

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'icdapi_access',
    });

    const res = await fetch(WHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      logger.error('WHO ICD token request failed', {
        category: 'system',
        status: res.status,
      });
      return null;
    }

    const data = (await res.json()) as WHOTokenResponse;
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + data.expires_in * 1000;
    return cachedToken;
  } catch (error) {
    logger.error('WHO ICD token request error', { category: 'system', error });
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Check if WHO ICD API is configured (has credentials).
 */
export function isWHOApiConfigured(): boolean {
  return getCredentials() !== null;
}

/**
 * Search ICD-10 codes via the WHO ICD API.
 * Returns empty array if API is not configured or request fails.
 */
export async function searchWHOIcd(
  query: string,
  options: {
    limit?: number;
    language?: 'en' | 'ar';
  } = {}
): Promise<WHOIcdResult[]> {
  const { limit = 20, language = 'en' } = options;

  if (query.length < 2) return [];

  const token = await getAccessToken();
  if (!token) return [];

  try {
    // Search ICD-10 (2019 release)
    const lang = language === 'ar' ? 'ar' : 'en';
    const searchUrl = `${WHO_API_BASE}/icd/release/10/2019/search?q=${encodeURIComponent(query)}&useFlexisearch=true&flatResults=true&highlightingEnabled=false`;

    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': lang,
        'API-Version': 'v2',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      logger.error('WHO ICD search failed', {
        category: 'system',
        status: res.status,
      });
      return [];
    }

    const data = (await res.json()) as WHOSearchResult;

    if (data.error) {
      logger.error('WHO ICD search returned error', {
        category: 'system',
        errorMessage: data.errorMessage,
      });
      return [];
    }

    const entities = data.destinationEntities || [];

    // If we searched in English, also fetch Arabic descriptions (best effort)
    const results: WHOIcdResult[] = [];

    for (const entity of entities.slice(0, limit)) {
      const code = entity.theCode || extractCodeFromId(entity.id);
      if (!code) continue;

      // Strip HTML tags from title
      const description = stripHtml(entity.title);

      results.push({
        code,
        description,
        descriptionAr: language === 'ar' ? description : undefined,
        chapter: entity.chapter,
        category: 'WHO',
        source: 'who',
      });
    }

    // If we searched in English, try to get Arabic titles too
    if (language !== 'ar' && results.length > 0) {
      const arResults = await searchWHOIcdArabic(query, token, results.length);
      for (let i = 0; i < results.length && i < arResults.length; i++) {
        if (arResults[i]?.code === results[i].code) {
          results[i].descriptionAr = arResults[i].description;
        }
      }
    }

    return results;
  } catch (error) {
    logger.error('WHO ICD search error', { category: 'system', error });
    return [];
  }
}

/**
 * Look up a specific ICD-10 code via the WHO API.
 */
export async function lookupWHOCode(code: string): Promise<WHOIcdResult | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const url = `${WHO_API_BASE}/icd/release/10/2019/${encodeURIComponent(code)}`;

    const [enRes, arRes] = await Promise.all([
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Accept-Language': 'en',
          'API-Version': 'v2',
        },
        signal: AbortSignal.timeout(8_000),
      }),
      fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Accept-Language': 'ar',
          'API-Version': 'v2',
        },
        signal: AbortSignal.timeout(8_000),
      }),
    ]);

    if (!enRes.ok) return null;

    const enData = await enRes.json();
    const arData = arRes.ok ? await arRes.json() : null;

    return {
      code: enData.code || code,
      description: stripHtml(enData.title?.['@value'] || enData.title || ''),
      descriptionAr: arData ? stripHtml(arData.title?.['@value'] || arData.title || '') : undefined,
      chapter: enData.classKind,
      category: 'WHO',
      source: 'who',
    };
  } catch (error) {
    logger.error('WHO ICD lookup error', { category: 'system', code, error });
    return null;
  }
}

// ── Internal helpers ───────────────────────────────────────────────

async function searchWHOIcdArabic(
  query: string,
  token: string,
  limit: number
): Promise<Array<{ code: string; description: string }>> {
  try {
    const searchUrl = `${WHO_API_BASE}/icd/release/10/2019/search?q=${encodeURIComponent(query)}&useFlexisearch=true&flatResults=true&highlightingEnabled=false`;

    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': 'ar',
        'API-Version': 'v2',
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as WHOSearchResult;
    const entities = data.destinationEntities || [];

    return entities.slice(0, limit).map((e) => ({
      code: e.theCode || extractCodeFromId(e.id),
      description: stripHtml(e.title),
    }));
  } catch {
    return [];
  }
}

function extractCodeFromId(id: string): string {
  // WHO IDs look like: "http://id.who.int/icd/release/10/2019/J06.9"
  const parts = id.split('/');
  return parts[parts.length - 1] || '';
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
