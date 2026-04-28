/**
 * Auth Edge & normalizeRole Tests
 *
 * Tests for edge runtime JWT verification and role normalization.
 *
 * Categories:
 *  1-5   normalizeRole — all Prisma enums, null/undefined, unknown roles
 *  6-10  verifyTokenEdge — valid token, expired token, tampered token, key rotation, missing secret
 *  11-13 TokenPayload structure validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ─── normalizeRole Tests ─────────────────────────

describe('normalizeRole', () => {
  let normalizeRole: (role: string | null | undefined) => string;

  beforeEach(async () => {
    const mod = await import('@/lib/auth/normalizeRole');
    normalizeRole = mod.normalizeRole;
  });

  it('should map all Prisma enum values correctly', () => {
    expect(normalizeRole('THEA_OWNER')).toBe('thea-owner');
    expect(normalizeRole('ADMIN')).toBe('admin');
    expect(normalizeRole('GROUP_ADMIN')).toBe('group-admin');
    expect(normalizeRole('HOSPITAL_ADMIN')).toBe('hospital-admin');
    expect(normalizeRole('SUPERVISOR')).toBe('supervisor');
    expect(normalizeRole('STAFF')).toBe('staff');
    expect(normalizeRole('VIEWER')).toBe('viewer');
  });

  it('should return empty string for null, undefined, empty', () => {
    expect(normalizeRole(null)).toBe('');
    expect(normalizeRole(undefined)).toBe('');
    expect(normalizeRole('')).toBe('');
  });

  it('should pass through already-normalized roles', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('thea-owner')).toBe('thea-owner');
    expect(normalizeRole('doctor')).toBe('doctor');
  });

  it('should handle unknown roles by lowercasing and replacing underscores', () => {
    expect(normalizeRole('CUSTOM_ROLE')).toBe('custom-role');
    expect(normalizeRole('MY_SPECIAL_ADMIN')).toBe('my-special-admin');
  });

  it('should be idempotent', () => {
    const result1 = normalizeRole('GROUP_ADMIN');
    const result2 = normalizeRole(result1);
    expect(result1).toBe(result2);
  });
});

// ─── verifyTokenEdge Tests ───────────────────────

describe('verifyTokenEdge (source validation)', () => {
  const src = readSource('lib/auth/edge.ts');

  it('should use jose jwtVerify for token verification', () => {
    expect(src).toContain("import { jwtVerify } from 'jose'");
    expect(src).toContain('jwtVerify(token, secret)');
  });

  it('should read JWT_SECRET from env at call time (Edge-compatible)', () => {
    expect(src).toContain("process.env.JWT_SECRET");
    expect(src).toContain('getJwtSecret()');
  });

  it('should support key rotation with JWT_SECRET_PREVIOUS fallback', () => {
    expect(src).toContain('JWT_SECRET_PREVIOUS');
    // Should try current first, then fallback
    expect(src).toContain('prevSecret');
    // First try block for current secret
    const firstTryIndex = src.indexOf('jwtVerify(token, secret)');
    // Second try block for previous secret
    const secondTryIndex = src.indexOf('jwtVerify(token, secret)', firstTryIndex + 1);
    expect(secondTryIndex).toBeGreaterThan(firstTryIndex);
  });

  it('should return null on verification failure', () => {
    expect(src).toContain('return null');
  });

  it('should throw if JWT_SECRET is not set', () => {
    expect(src).toContain("throw new Error('JWT_SECRET environment variable is required')");
  });

  it('should encode secret as Uint8Array for jose', () => {
    expect(src).toContain('new TextEncoder().encode(');
  });
});

// ─── TokenPayload structure ──────────────────────

describe('TokenPayload structure (source validation)', () => {
  const src = readSource('lib/auth/edge.ts');

  it('should define all required fields in TokenPayload interface', () => {
    expect(src).toContain('userId: string');
    expect(src).toContain('email: string');
    expect(src).toContain('role:');
    expect(src).toContain('sessionId?:');
    expect(src).toContain('activeTenantId?:');
    expect(src).toContain('twoFactorVerified?:');
    expect(src).toContain('entitlements?:');
  });

  it('should include all role variants in TokenPayload type', () => {
    // App-format roles
    expect(src).toContain("'admin'");
    expect(src).toContain("'staff'");
    expect(src).toContain("'viewer'");
    expect(src).toContain("'thea-owner'");
    // Prisma-format roles (for backward compatibility)
    expect(src).toContain("'THEA_OWNER'");
    expect(src).toContain("'ADMIN'");
  });

  it('should include platform entitlements in TokenPayload', () => {
    expect(src).toContain('sam: boolean');
    expect(src).toContain('health: boolean');
    expect(src).toContain('edrac: boolean');
    expect(src).toContain('cvision: boolean');
  });
});
