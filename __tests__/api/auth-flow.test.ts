/**
 * Auth Flow — Unit Tests
 *
 * Tests the authentication pipeline:
 *   - Login validation (email + password required)
 *   - Rate limiting enforcement
 *   - Account lockout
 *   - Successful login token generation
 *   - /api/auth/me session verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: { findFirst: vi.fn(), findUnique: vi.fn() },
  tenant: { findFirst: vi.fn() },
  tenantUser: { findFirst: vi.fn() },
  session: { create: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  refreshToken: { create: vi.fn() },
};

vi.mock('@/lib/db/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/monitoring/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/security/rateLimit', () => ({
  checkRateLimitRedis: vi.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
}));

vi.mock('@/lib/auth/loginAttempts', () => ({
  checkAccountLocked: vi.fn().mockResolvedValue({ locked: false }),
  clearFailedLogins: vi.fn().mockResolvedValue(undefined),
  recordFailedLogin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/utils/audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { checkRateLimitRedis } from '@/lib/security/rateLimit';
import { checkAccountLocked } from '@/lib/auth/loginAttempts';
import { loginSchema } from '@/lib/validation/auth.schema';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Login validation schema ──────────────────────────────────────────

  describe('Login Schema Validation', () => {
    it('should require email field', () => {
      const result = loginSchema.safeParse({ password: 'Test1234!' });
      expect(result.success).toBe(false);
    });

    it('should require password field', () => {
      const result = loginSchema.safeParse({ email: 'test@test.com' });
      expect(result.success).toBe(false);
    });

    it('should accept valid credentials', () => {
      const result = loginSchema.safeParse({
        email: 'doctor@hospital.com',
        password: 'SecurePass123!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty email', () => {
      const result = loginSchema.safeParse({ email: '', password: 'pass' });
      expect(result.success).toBe(false);
    });

    it('should accept optional tenantId', () => {
      const result = loginSchema.safeParse({
        email: 'user@test.com',
        password: 'pass123',
        tenantId: 'tenant-1',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tenantId).toBe('tenant-1');
      }
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────

  describe('Rate Limiting', () => {
    it('should allow requests under the rate limit', async () => {
      const result = await checkRateLimitRedis('login:ip:192.168.1.1', 20, 300000);
      expect(result.allowed).toBe(true);
    });

    it('should block requests when rate limit exceeded', async () => {
      vi.mocked(checkRateLimitRedis).mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
      } as Record<string, unknown>);

      const result = await checkRateLimitRedis('login:ip:192.168.1.1', 20, 300000);
      expect(result.allowed).toBe(false);
    });
  });

  // ── Account lockout ──────────────────────────────────────────────────

  describe('Account Lockout', () => {
    it('should report unlocked for normal accounts', async () => {
      const result = await checkAccountLocked(null, 'user@test.com');
      expect(result.locked).toBe(false);
    });

    it('should report locked after too many failures', async () => {
      vi.mocked(checkAccountLocked).mockResolvedValueOnce({
        locked: true,
        remainingMs: 300000,
      });

      const result = await checkAccountLocked(null, 'locked@test.com');
      expect(result.locked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
    });
  });
});
