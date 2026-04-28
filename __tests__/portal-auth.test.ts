/**
 * Portal Auth (OTP) Module Tests
 *
 * Covers:
 *  - normalizeMobile: whitespace stripping, 00->+ conversion, Saudi phone formats
 *  - normalizeIdType: valid types, null/empty handling, alternate casing
 *  - buildIdentifiers: NATIONAL_ID, IQAMA, PASSPORT mapping
 *  - buildIdentifierQuery: MongoDB-style query structure
 *  - generateSecureOtp: 6-digit numeric string
 *  - Route file checks: rate limiting, error handling, Zod validation, HTML sanitization
 *  - normalizeIdNumber: whitespace/hyphen stripping, null handling
 *  - OTP expiry constant (5 minutes)
 *  - ID validation patterns (NATIONAL_ID/IQAMA 10-digit, PASSPORT 5-20 chars)
 *  - Portal session constants (PORTAL_SESSION_DAYS, PORTAL_IDLE_MINUTES)
 *  - Logout route clears portal cookie
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

import { normalizeMobile, generateSecureOtp } from '@/lib/portal/auth';
import {
  normalizeIdType,
  normalizeIdNumber,
  buildIdentifiers,
  buildIdentifierQuery,
} from '@/lib/portal/identity';

function readRoute(...segments: string[]): string {
  return fs.readFileSync(path.join(process.cwd(), ...segments), 'utf-8');
}

// ---------------------------------------------------------------------------
// 1-3. normalizeMobile
// ---------------------------------------------------------------------------
describe('normalizeMobile', () => {
  it('1 — strips spaces and non-numeric characters except +', () => {
    // normalizeMobile removes all characters that are not digits or +
    expect(normalizeMobile(' +966 50 123 4567 ')).toBe('+966501234567');
    expect(normalizeMobile('(050) 123-4567')).toBe('0501234567');
  });

  it('2 — converts leading 00 to + for international format', () => {
    // The regex .replace(/^00/, '+') converts 00966 to +966
    expect(normalizeMobile('00966501234567')).toBe('+966501234567');
    expect(normalizeMobile('009715551234')).toBe('+9715551234');
  });

  it('3 — handles various Saudi phone formats (0-prefix, +966, bare number)', () => {
    // Local format starting with 0 stays as-is (normalizeMobile does not add +966)
    expect(normalizeMobile('0501234567')).toBe('0501234567');
    // International format with + stays as-is
    expect(normalizeMobile('+966501234567')).toBe('+966501234567');
    // 00-prefix is converted to +
    expect(normalizeMobile('00966501234567')).toBe('+966501234567');
    // Empty/null input returns empty string
    expect(normalizeMobile('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 4-5. normalizeIdType
// ---------------------------------------------------------------------------
describe('normalizeIdType', () => {
  it('4 — returns correct PortalIdType for valid inputs and null for invalid', () => {
    expect(normalizeIdType('NATIONAL_ID')).toBe('NATIONAL_ID');
    expect(normalizeIdType('IQAMA')).toBe('IQAMA');
    expect(normalizeIdType('PASSPORT')).toBe('PASSPORT');
    // Invalid / unknown types return null
    expect(normalizeIdType('DRIVER_LICENSE')).toBeNull();
    expect(normalizeIdType('')).toBeNull();
    expect(normalizeIdType(null)).toBeNull();
    expect(normalizeIdType(undefined)).toBeNull();
  });

  it('5 — normalizes alternate casing and NATIONALID (no underscore) to NATIONAL_ID', () => {
    // The function uppercases input and handles NATIONALID -> NATIONAL_ID
    expect(normalizeIdType('national_id')).toBe('NATIONAL_ID');
    expect(normalizeIdType('NATIONALID')).toBe('NATIONAL_ID');
    expect(normalizeIdType('iqama')).toBe('IQAMA');
    expect(normalizeIdType('passport')).toBe('PASSPORT');
    // Leading/trailing whitespace is trimmed
    expect(normalizeIdType('  IQAMA  ')).toBe('IQAMA');
  });
});

// ---------------------------------------------------------------------------
// 6-7. buildIdentifiers
// ---------------------------------------------------------------------------
describe('buildIdentifiers', () => {
  it('6 — NATIONAL_ID maps to { nationalId } object', () => {
    const result = buildIdentifiers('NATIONAL_ID', '1234567890');
    expect(result).toEqual({ nationalId: '1234567890' });
  });

  it('7 — IQAMA maps to { iqama } and PASSPORT maps to { passport }', () => {
    expect(buildIdentifiers('IQAMA', '2345678901')).toEqual({ iqama: '2345678901' });
    expect(buildIdentifiers('PASSPORT', 'AB1234567')).toEqual({ passport: 'AB1234567' });
  });
});

// ---------------------------------------------------------------------------
// 8. buildIdentifierQuery
// ---------------------------------------------------------------------------
describe('buildIdentifierQuery', () => {
  it('8 — returns MongoDB-style dot-notation query for each ID type', () => {
    expect(buildIdentifierQuery('NATIONAL_ID', '1234567890')).toEqual({
      'identifiers.nationalId': '1234567890',
    });
    expect(buildIdentifierQuery('IQAMA', '2345678901')).toEqual({
      'identifiers.iqama': '2345678901',
    });
    expect(buildIdentifierQuery('PASSPORT', 'AB1234567')).toEqual({
      'identifiers.passport': 'AB1234567',
    });
  });
});

// ---------------------------------------------------------------------------
// 9. generateSecureOtp
// ---------------------------------------------------------------------------
describe('generateSecureOtp', () => {
  it('9 — produces a 6-digit numeric string between 100000 and 999999', () => {
    // Run multiple times to check format consistency
    for (let i = 0; i < 20; i++) {
      const otp = generateSecureOtp();
      expect(otp).toMatch(/^\d{6}$/);
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });
});

// ---------------------------------------------------------------------------
// 10-11. Route file checks (request-otp, verify-otp)
// ---------------------------------------------------------------------------
describe('Portal OTP Route Files', () => {
  it('10 — request-otp route has rate limiting by mobile and IP', () => {
    const src = readRoute('app', 'api', 'portal', 'auth', 'request-otp', 'route.ts');
    // Rate limit constants are defined
    expect(src).toContain('RATE_WINDOW_MS');
    expect(src).toContain('MAX_PER_MOBILE');
    expect(src).toContain('MAX_PER_IP');
    // Rate limit check uses patientPortalRateLimit.count
    expect(src).toContain('patientPortalRateLimit.count');
    // Returns 429 when rate limited
    expect(src).toContain('status: 429');
    // Tracks both mobile and IP rate limits
    expect(src).toContain("type: 'mobile'");
    expect(src).toContain("type: 'ip'");
  });

  it('11 — verify-otp route uses withErrorHandler and Zod validation', () => {
    const src = readRoute('app', 'api', 'portal', 'auth', 'verify-otp', 'route.ts');
    // Wrapped with withErrorHandler for consistent error responses
    expect(src).toContain('withErrorHandler');
    // Uses Zod schema for body validation
    expect(src).toContain('z.object');
    expect(src).toContain('portalVerifyOtpBodySchema');
    expect(src).toContain('validateBody');
    // Has OTP attempt lockout mechanism
    expect(src).toContain('otp_lock');
    expect(src).toContain('MAX_ATTEMPTS');
  });
});

// ---------------------------------------------------------------------------
// 12-13. Register route checks
// ---------------------------------------------------------------------------
describe('Portal Register Route', () => {
  const registerSrc = readRoute('app', 'api', 'portal', 'auth', 'register', 'route.ts');

  it('12 — register route has Zod validation for fullName, idType, idNumber, mobile', () => {
    // Zod schema enforces required fields with min(1)
    expect(registerSrc).toContain('z.object');
    expect(registerSrc).toContain("fullName: z.string().min(1, 'fullName is required')");
    expect(registerSrc).toContain("idType: z.string().min(1, 'idType is required')");
    expect(registerSrc).toContain("idNumber: z.string().min(1, 'idNumber is required')");
    expect(registerSrc).toContain("mobile: z.string().min(1, 'mobile is required')");
    expect(registerSrc).toContain('portalRegisterBodySchema');
  });

  it('13 — register route has sanitizeText to escape HTML entities', () => {
    // sanitizeText function replaces < > " ' with HTML entities to prevent XSS
    expect(registerSrc).toContain('function sanitizeText');
    expect(registerSrc).toContain('&lt;');
    expect(registerSrc).toContain('&gt;');
    expect(registerSrc).toContain('&quot;');
    expect(registerSrc).toContain('&#x27;');
    // sanitizeText is applied to fullName
    expect(registerSrc).toContain('sanitizeText(body.fullName)');
  });
});

// ---------------------------------------------------------------------------
// 14-15. normalizeIdNumber
// ---------------------------------------------------------------------------
describe('normalizeIdNumber', () => {
  it('14 — strips whitespace and hyphens from ID numbers', () => {
    // normalizeIdNumber delegates to normalizeIdentifier which removes spaces and hyphens
    expect(normalizeIdNumber('123 456 7890')).toBe('1234567890');
    expect(normalizeIdNumber('12-345-67890')).toBe('1234567890');
    expect(normalizeIdNumber(' AB 123-456 ')).toBe('AB123456');
  });

  it('15 — returns null for null, undefined, and empty string', () => {
    expect(normalizeIdNumber(null)).toBeNull();
    expect(normalizeIdNumber(undefined)).toBeNull();
    expect(normalizeIdNumber('')).toBeNull();
    expect(normalizeIdNumber('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 16. OTP expiry constant
// ---------------------------------------------------------------------------
describe('OTP Expiry', () => {
  it('16 — OTP expiry is 5 minutes (300000 ms)', () => {
    const authSrc = readRoute('lib', 'portal', 'auth.ts');
    // OTP_EXPIRY_MS = 5 * 60 * 1000 = 300000
    expect(authSrc).toContain('OTP_EXPIRY_MS = 5 * 60 * 1000');
    expect(authSrc).toContain('// 5 minutes');
    // Used when creating OTP: expiresAt = Date.now() + OTP_EXPIRY_MS
    expect(authSrc).toContain('Date.now() + OTP_EXPIRY_MS');
  });
});

// ---------------------------------------------------------------------------
// 17-18. ID validation patterns
// ---------------------------------------------------------------------------
describe('ID Validation Patterns', () => {
  const registerSrc = readRoute('app', 'api', 'portal', 'auth', 'register', 'route.ts');

  it('17 — NATIONAL_ID and IQAMA must be 10 digits starting with 1 or 2', () => {
    // Register route validates NATIONAL_ID/IQAMA with regex /^[12]\d{9}$/
    expect(registerSrc).toContain("idType === 'NATIONAL_ID' || idType === 'IQAMA'");
    expect(registerSrc).toContain('/^[12]\\d{9}$/');
    expect(registerSrc).toContain("'Invalid ID number format'");
    // Test the regex directly
    const regex = /^[12]\d{9}$/;
    expect(regex.test('1234567890')).toBe(true);  // starts with 1, 10 digits
    expect(regex.test('2987654321')).toBe(true);  // starts with 2, 10 digits
    expect(regex.test('3234567890')).toBe(false); // starts with 3
    expect(regex.test('123456789')).toBe(false);  // only 9 digits
    expect(regex.test('12345678901')).toBe(false); // 11 digits
  });

  it('18 — PASSPORT must be between 5 and 20 characters', () => {
    // Register route validates PASSPORT by length (5-20 chars)
    expect(registerSrc).toContain("idType === 'PASSPORT'");
    expect(registerSrc).toContain('idNumberNormalized.length < 5');
    expect(registerSrc).toContain('idNumberNormalized.length > 20');
    // The error message is the same for all ID types
    expect(registerSrc).toContain("'Invalid ID number format'");
  });
});

// ---------------------------------------------------------------------------
// 19. Portal session constants
// ---------------------------------------------------------------------------
describe('Portal Session Constants', () => {
  it('19 — PORTAL_SESSION_DAYS defaults to 7 and PORTAL_IDLE_MINUTES defaults to 30', () => {
    const authSrc = readRoute('lib', 'portal', 'auth.ts');
    // Session duration: defaults to 7 days
    expect(authSrc).toContain("PORTAL_SESSION_DAYS = Number(process.env.PORTAL_SESSION_DAYS || '7')");
    // Idle timeout: defaults to 30 minutes
    expect(authSrc).toContain("PORTAL_IDLE_MINUTES = Number(process.env.PORTAL_IDLE_MINUTES || '30')");
    // Session days is used in JWT expiry
    expect(authSrc).toContain('`${PORTAL_SESSION_DAYS}d`');
    // Idle minutes is used in session validation with millisecond conversion
    expect(authSrc).toContain('PORTAL_IDLE_MINUTES * 60 * 1000');
  });
});

// ---------------------------------------------------------------------------
// 20. Logout route clears portal cookie
// ---------------------------------------------------------------------------
describe('Portal Logout Route', () => {
  it('20 — logout route calls clearPortalCookie and deletes session from DB', () => {
    const logoutSrc = readRoute('app', 'api', 'portal', 'auth', 'logout', 'route.ts');
    // Imports clearPortalCookie from portal auth
    expect(logoutSrc).toContain('clearPortalCookie');
    // Calls clearPortalCookie on the response
    expect(logoutSrc).toContain('clearPortalCookie(response)');
    // Deletes the session from patientPortalSession table
    expect(logoutSrc).toContain('patientPortalSession.deleteMany');
    expect(logoutSrc).toContain('id: payload.sessionId');
    // Requires authenticated session via requirePortalSession
    expect(logoutSrc).toContain('requirePortalSession');
    // Returns success: true
    expect(logoutSrc).toContain('success: true');
  });
});
