/**
 * CSRF Protection
 * Generates and validates CSRF tokens for state-changing requests
 */

import { serialize, parse } from 'cookie';
import { NextRequest, NextResponse } from 'next/server';
import crypto, { randomBytes } from 'crypto';

const CSRF_TOKEN_COOKIE = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie (httpOnly) + expose via response header for JS reads.
 * The cookie is httpOnly so XSS cannot exfiltrate it.
 * Client code reads the token from the X-CSRF-Token response header
 * and sends it back as the X-CSRF-Token request header on mutations.
 */
export function setCSRFTokenCookie(response: NextResponse, token: string): void {
  response.headers.append(
    'Set-Cookie',
    serialize(CSRF_TOKEN_COOKIE, token, {
      httpOnly: true, // [SEC] prevent XSS from reading CSRF token
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })
  );
  // Expose token via response header so client JS can read it for X-CSRF-Token
  response.headers.set('X-CSRF-Token', token);
}

/**
 * Get CSRF token submitted by the client (header or body field).
 * This must NOT fall back to the cookie — the cookie is the server-side
 * reference; the client must echo the token via a separate channel.
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // 1. X-CSRF-Token header (preferred — set by JS fetch calls)
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (headerToken) {
    return headerToken;
  }

  // 2. _csrf body field is checked asynchronously in validateCSRFToken
  return null;
}

/**
 * Validate CSRF token.
 *
 * Compares the token stored in the httpOnly cookie against the token the
 * client echoes back via the X-CSRF-Token header **or** the `_csrf` body
 * field.  The cookie itself is never accepted as the "client" token — the
 * whole point of the double-submit pattern is that an attacker cannot read
 * the cookie value to replay it.
 */
export async function validateCSRFToken(
  request: NextRequest,
  cookieToken?: string
): Promise<boolean> {
  // Server-side reference: httpOnly cookie
  const tokenInCookie = cookieToken || getCSRFTokenFromCookie(request);
  if (!tokenInCookie) return false;

  // Client-submitted token: header first
  let tokenInRequest = getCSRFTokenFromRequest(request);

  // Fallback: _csrf field in JSON/form body (only for POST/PUT/PATCH/DELETE)
  if (!tokenInRequest) {
    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const cloned = request.clone();
        const body = await cloned.json();
        if (body && typeof body._csrf === 'string') {
          tokenInRequest = body._csrf;
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const cloned = request.clone();
        const formData = await cloned.formData();
        const csrfField = formData.get('_csrf');
        if (typeof csrfField === 'string') {
          tokenInRequest = csrfField;
        }
      }
    } catch {
      // Body parse failed — token stays null
    }
  }

  if (!tokenInRequest) return false;

  // Constant-time comparison to prevent timing attacks
  if (tokenInCookie.length !== tokenInRequest.length) return false;
  const a = Buffer.from(tokenInCookie);
  const b = Buffer.from(tokenInRequest);
  return crypto.timingSafeEqual(a, b);
}

/**
 * Get CSRF token from cookie
 */
function getCSRFTokenFromCookie(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }
  const cookies = parse(cookieHeader);
  return cookies[CSRF_TOKEN_COOKIE] || null;
}

/**
 * CSRF protection middleware
 * Only applies to state-changing methods (POST, PUT, PATCH, DELETE)
 */
export async function requireCSRF(
  request: NextRequest
): Promise<NextResponse | null> {
  const method = request.method.toUpperCase();

  // Only protect state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null; // No CSRF check needed
  }

  // Skip CSRF for certain endpoints (e.g., login, logout if needed)
  const url = new URL(request.url);
  const skipCSRFPaths = ['/api/auth/login', '/api/auth/logout'];
  if (skipCSRFPaths.some(path => url.pathname.startsWith(path))) {
    return null; // Skip CSRF for these endpoints
  }

  // Validate CSRF token
  if (!(await validateCSRFToken(request))) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Invalid CSRF token' },
      { status: 403 }
    );
  }

  return null; // CSRF check passed
}

