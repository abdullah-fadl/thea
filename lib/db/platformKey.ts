import { NextRequest } from 'next/server';
import { ACTIVE_PLATFORM_COOKIE, parseActivePlatform } from '@/lib/shell/platform';
import { logger } from '@/lib/monitoring/logger';

/**
 * Platform Key Type (unified - underscore only)
 * CRITICAL: All platform keys use underscore, NOT hyphen
 * - 'sam' (no change)
 * - 'thea_health' (NOT 'thea-health')
 * - 'cvision' (no change)
 * - 'edrac' (no change)
 */
export type PlatformKey = 'sam' | 'thea_health' | 'cvision' | 'edrac' | 'imdad';

/**
 * Get platform key from request
 * 
 * Reads from (in order):
 * 1. Cookie: "activePlatform" (e.g., "sam", "health")
 * 2. Header: "x-thea-platform" (fallback)
 * 3. Request pathname: /api/sam/* => "sam", /api/thea_health/* => "thea_health", etc.
 * 
 * Normalizes hyphen to underscore (e.g., "thea-health" → "thea_health")
 * 
 * @param request - Next.js request object
 * @returns Platform key or undefined if not found
 */
export function getPlatformKeyFromRequest(request: NextRequest): PlatformKey | undefined {
  // Try cookie first (activePlatform is source of truth)
  const cookiePlatform = parseActivePlatform(request.cookies.get(ACTIVE_PLATFORM_COOKIE)?.value);
  if (cookiePlatform) {
    return cookiePlatform === 'health' ? 'thea_health' : 'sam';
  }
  
  // Fallback to header
  const headerPlatform = request.headers.get('x-thea-platform');
  if (headerPlatform) {
    const normalized = normalizeInputPlatformKey(headerPlatform);
    if (normalized && isValidPlatformKey(normalized)) {
      return normalized;
    }
  }
  
  // Fallback to pathname-based resolution
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Extract platform from pathname: /api/sam/* => "sam"
    // Pattern: /api/<platform>/...
    const pathnameMatch = pathname.match(/^\/api\/([^/]+)/);
    if (pathnameMatch) {
      const pathPlatform = pathnameMatch[1];
      
      // Map known platform paths to platform keys
      if (pathPlatform === 'sam') {
        return 'sam';
      } else if (pathPlatform === 'thea_health' || pathPlatform === 'thea-health' || pathPlatform === 'health') {
        return 'thea_health';
      } else if (pathPlatform === 'cvision') {
        return 'cvision';
      } else if (pathPlatform === 'edrac') {
        return 'edrac';
      } else if (pathPlatform === 'imdad') {
        return 'imdad';
      }
    }
  } catch (urlError) {
    // Invalid URL - ignore and continue
    logger.warn('Failed to parse URL for platform key', { category: 'db', error: urlError });
  }
  
  return undefined;
}

/**
 * Normalize input platform key (accepts hyphen or underscore, returns underscore)
 * Converts "thea-health" → "thea_health"
 */
function normalizeInputPlatformKey(key: string): PlatformKey | undefined {
  const normalized = key.replace(/-/g, '_');
  return normalized as PlatformKey;
}

/**
 * Validate platform key
 */
function isValidPlatformKey(key: string): boolean {
  const validKeys: PlatformKey[] = ['sam', 'thea_health', 'cvision', 'edrac', 'imdad'];
  return validKeys.includes(key as PlatformKey);
}

/**
 * Shared collections (no platform prefix)
 * These collections are accessible across all platforms within the same tenant
 */
export const SHARED_COLLECTIONS = new Set([
  'org_nodes',
  'structure_floors',
  'structure_departments',
  'structure_floor_departments',
  'users',
  'roles',
  'permissions',
  'audit_logs',
  'notifications',
]);

/**
 * Normalize platform key for collection prefix
 * 
 * Since PlatformKey already uses underscore, this just returns the key as-is.
 * Kept for API consistency (in case input needs normalization).
 */
export function normalizePlatformKeyForPrefix(platformKey: PlatformKey): string {
  // PlatformKey already uses underscore, so return as-is
  return platformKey;
}
