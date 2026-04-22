/**
 * Secure Cookie Utilities
 * Provides secure cookie setting with consistent security settings
 */

import { serialize, parse } from 'cookie';
import { NextResponse } from 'next/server';
import { SESSION_CONFIG } from './config';

/**
 * Set secure authentication cookie
 */
export function setAuthCookie(
  response: NextResponse,
  token: string,
  maxAge: number = SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS / 1000 // Convert to seconds
): void {
  response.headers.set(
    'Set-Cookie',
    serialize(SESSION_CONFIG.COOKIE_NAME, token, {
      httpOnly: SESSION_CONFIG.COOKIE_HTTP_ONLY,
      secure: SESSION_CONFIG.COOKIE_SECURE,
      sameSite: SESSION_CONFIG.COOKIE_SAME_SITE,
      maxAge,
      path: SESSION_CONFIG.COOKIE_PATH,
    })
  );
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(response: NextResponse): void {
  response.headers.set(
    'Set-Cookie',
    serialize(SESSION_CONFIG.COOKIE_NAME, '', {
      httpOnly: SESSION_CONFIG.COOKIE_HTTP_ONLY,
      secure: SESSION_CONFIG.COOKIE_SECURE,
      sameSite: SESSION_CONFIG.COOKIE_SAME_SITE,
      maxAge: 0,
      path: SESSION_CONFIG.COOKIE_PATH,
    })
  );
}

/**
 * Parse cookies from request
 */
export function getCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const cookies = parse(cookieHeader);
  return cookies[name];
}

