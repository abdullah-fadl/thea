/**
 * HTTP Cache Header Helpers
 *
 * Utility to set `Cache-Control` headers on API responses.
 *
 * Usage:
 * ```ts
 * import { withCacheHeaders } from '@/lib/cache/headers';
 *
 * return withCacheHeaders(
 *   NextResponse.json({ data }),
 *   { maxAge: 300, private: true }
 * );
 * ```
 */

import { NextResponse } from 'next/server';

export interface CacheHeaderOptions {
  /** Max age in seconds (default 60). */
  maxAge?: number;
  /** If true (default), sets `private`. Set to false for `public`. */
  private?: boolean;
  /** If true, sets `no-cache, no-store, must-revalidate` (ignores other options). */
  noCache?: boolean;
}

/**
 * Apply a `Cache-Control` header to a NextResponse.
 * Returns the same response instance (mutated) for chaining convenience.
 */
export function withCacheHeaders(
  response: NextResponse,
  options: CacheHeaderOptions,
): NextResponse {
  if (options.noCache) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  } else {
    const visibility = options.private !== false ? 'private' : 'public';
    const maxAge = options.maxAge ?? 60;
    response.headers.set('Cache-Control', `${visibility}, max-age=${maxAge}`);
  }
  return response;
}
