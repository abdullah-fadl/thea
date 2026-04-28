/**
 * Security Headers Middleware
 * Adds security headers to responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { SECURITY_HEADERS, CORS_CONFIG } from './config';

/**
 * Add security headers to response
 */
export function addSecurityHeaders(
  response: NextResponse,
  options: {
    corsOrigin?: string;
    skipCSP?: boolean;
  } = {}
): NextResponse {
  // HSTS (HTTP Strict Transport Security) - only when explicitly enabled (e.g. behind HTTPS proxy).
  // Do not enable for local yarn start, or the browser will force HTTPS and break (ERR_SSL_PROTOCOL_ERROR).
  if (process.env.SECURITY_HSTS === '1') {
    response.headers.set(
      'Strict-Transport-Security',
      `max-age=${SECURITY_HEADERS.HSTS_MAX_AGE}; includeSubDomains; preload`
    );
  }

  // X-Frame-Options (prevent clickjacking)
  response.headers.set('X-Frame-Options', 'DENY');

  // X-Content-Type-Options (prevent MIME sniffing)
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy (formerly Feature-Policy)
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );

  // Content Security Policy
  if (!options.skipCSP) {
    response.headers.set('Content-Security-Policy', SECURITY_HEADERS.CSP);
  }

  // CORS headers (if origin specified)
  if (options.corsOrigin) {
    if (CORS_CONFIG.ALLOWED_ORIGINS.includes(options.corsOrigin) || 
        CORS_CONFIG.ALLOWED_ORIGINS.includes('*')) {
      response.headers.set('Access-Control-Allow-Origin', options.corsOrigin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set(
        'Access-Control-Allow-Methods',
        CORS_CONFIG.ALLOWED_METHODS.join(', ')
      );
      response.headers.set(
        'Access-Control-Allow-Headers',
        CORS_CONFIG.ALLOWED_HEADERS.join(', ')
      );
    }
  }

  return response;
}

/**
 * CORS preflight handler
 */
export function handleCORSPreflight(
  request: NextRequest
): NextResponse | null {
  const origin = request.headers.get('origin');

  if (!origin) {
    return null; // Not a CORS request
  }

  // Check if origin is allowed
  if (!CORS_CONFIG.ALLOWED_ORIGINS.includes(origin) && 
      !CORS_CONFIG.ALLOWED_ORIGINS.includes('*')) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Origin not allowed' },
      { status: 403 }
    );
  }

  const response = new NextResponse(null, { status: 204 });
  return addSecurityHeaders(response, { corsOrigin: origin });
}

