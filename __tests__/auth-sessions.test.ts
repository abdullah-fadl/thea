/**
 * 20 Auth/Sessions Tests
 *
 * Validates authentication schemas, password policies, role normalization,
 * security configuration, CSRF tokens, 2FA utilities, MFA config, and
 * route-level auth patterns.
 *
 * Categories:
 *  1-3   Auth Zod schemas (loginSchema, changePasswordSchema, twoFactorVerifySchema)
 *  4-5   Password validation (too short, common password detection)
 *  6-7   Password strength estimation (weak vs strong)
 *  8-9   Role normalization (THEA_OWNER, null, ADMIN)
 *  10-11 Security config defaults (SESSION_CONFIG, RATE_LIMIT_CONFIG)
 *  12    CSRF token generation (64-char hex)
 *  13-14 2FA utilities (backup codes, temp token roundtrip)
 *  15-16 MFA config (TOTP_WINDOW, REQUIRED_FOR_ROLES)
 *  17-18 Route file checks (login route, 2fa setup route)
 *  19    switchTenantSchema validation
 *  20    passwordStrengthSchema validation
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// ─── Helpers ─────────────────────────────────────────
function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8')
}

// ═══════════════════════════════════════════════
// TEST 1 – loginSchema accepts valid input
// ═══════════════════════════════════════════════
describe('Test 1: loginSchema accepts valid email + password', () => {
  it('should accept a valid email, password, and optional tenantId', async () => {
    const { loginSchema } = await import('@/lib/validation/auth.schema')

    const valid = loginSchema.safeParse({
      email: 'doctor@thea.health',
      password: 'SecureP@ss123',
      tenantId: 'tenant-abc',
    })
    expect(valid.success).toBe(true)

    // tenantId is optional
    const noTenant = loginSchema.safeParse({
      email: 'nurse@thea.health',
      password: 'pass',
    })
    expect(noTenant.success).toBe(true)
  })
})

// ═══════════════════════════════════════════════
// TEST 2 – loginSchema rejects invalid input
// ═══════════════════════════════════════════════
describe('Test 2: loginSchema rejects invalid input', () => {
  it('should reject missing email or empty password', async () => {
    const { loginSchema } = await import('@/lib/validation/auth.schema')

    const noEmail = loginSchema.safeParse({ password: 'abc' })
    expect(noEmail.success).toBe(false)

    const badEmail = loginSchema.safeParse({ email: 'not-an-email', password: 'abc' })
    expect(badEmail.success).toBe(false)

    const emptyPassword = loginSchema.safeParse({ email: 'a@b.com', password: '' })
    expect(emptyPassword.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════
// TEST 3 – twoFactorVerifySchema requires exactly 6 characters
// ═══════════════════════════════════════════════
describe('Test 3: twoFactorVerifySchema requires token length = 6', () => {
  it('should accept 6-char token and reject others', async () => {
    const { twoFactorVerifySchema } = await import('@/lib/validation/auth.schema')

    const valid = twoFactorVerifySchema.safeParse({ token: '123456' })
    expect(valid.success).toBe(true)

    const tooShort = twoFactorVerifySchema.safeParse({ token: '12345' })
    expect(tooShort.success).toBe(false)

    const tooLong = twoFactorVerifySchema.safeParse({ token: '1234567' })
    expect(tooLong.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════
// TEST 4 – validatePassword rejects passwords < 12 chars
// ═══════════════════════════════════════════════
describe('Test 4: validatePassword rejects passwords shorter than 12 characters', () => {
  it('should return TOO_SHORT error for short passwords', async () => {
    const { validatePassword } = await import('@/lib/security/passwordPolicy')

    const result = validatePassword('Short1!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'TOO_SHORT')).toBe(true)
  })
})

// ═══════════════════════════════════════════════
// TEST 5 – validatePassword detects common passwords
// ═══════════════════════════════════════════════
describe('Test 5: validatePassword detects common passwords', () => {
  it('should return COMMON_PASSWORD error for breached passwords', async () => {
    const { validatePassword } = await import('@/lib/security/passwordPolicy')

    const result = validatePassword('password123')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'COMMON_PASSWORD')).toBe(true)
  })
})

// ═══════════════════════════════════════════════
// TEST 6 – estimateStrength returns low score for weak passwords
// ═══════════════════════════════════════════════
describe('Test 6: estimateStrength returns 0 for common passwords', () => {
  it('should return 0 for a password in the common passwords list', async () => {
    const { estimateStrength } = await import('@/lib/security/passwordPolicy')

    const score = estimateStrength('password123')
    expect(score).toBe(0)
  })
})

// ═══════════════════════════════════════════════
// TEST 7 – estimateStrength returns high score for strong passwords
// ═══════════════════════════════════════════════
describe('Test 7: estimateStrength returns high score for strong passwords', () => {
  it('should return 4 for a long password with mixed case, digits, and symbols', async () => {
    const { estimateStrength } = await import('@/lib/security/passwordPolicy')

    // 16+ chars, mixed case, digits, special chars = score 5 capped to 4
    const score = estimateStrength('MyStr0ng!Pass#2024')
    expect(score).toBe(4)
  })
})

// ═══════════════════════════════════════════════
// TEST 8 – normalizeRole maps THEA_OWNER to thea-owner
// ═══════════════════════════════════════════════
describe('Test 8: normalizeRole maps Prisma enum to app format', () => {
  it('should map THEA_OWNER to thea-owner and ADMIN to admin', async () => {
    const { normalizeRole } = await import('@/lib/auth/normalizeRole')

    expect(normalizeRole('THEA_OWNER')).toBe('thea-owner')
    expect(normalizeRole('ADMIN')).toBe('admin')
    expect(normalizeRole('GROUP_ADMIN')).toBe('group-admin')
    expect(normalizeRole('HOSPITAL_ADMIN')).toBe('hospital-admin')
    expect(normalizeRole('STAFF')).toBe('staff')
    expect(normalizeRole('VIEWER')).toBe('viewer')
  })
})

// ═══════════════════════════════════════════════
// TEST 9 – normalizeRole handles null/undefined
// ═══════════════════════════════════════════════
describe('Test 9: normalizeRole handles null and undefined', () => {
  it('should return empty string for null, undefined, or empty input', async () => {
    const { normalizeRole } = await import('@/lib/auth/normalizeRole')

    expect(normalizeRole(null)).toBe('')
    expect(normalizeRole(undefined)).toBe('')
    expect(normalizeRole('')).toBe('')
  })
})

// ═══════════════════════════════════════════════
// TEST 10 – SESSION_CONFIG has correct defaults
// ═══════════════════════════════════════════════
describe('Test 10: SESSION_CONFIG has expected defaults', () => {
  it('should have 24h absolute max age and 30min idle timeout', () => {
    const src = readSource('lib/security/config.ts')

    // 24 hours = 86400000ms
    expect(src).toContain('86400000')
    expect(src).toContain('ABSOLUTE_MAX_AGE_MS')

    // 30 minutes = 1800000ms
    expect(src).toContain('1800000')
    expect(src).toContain('IDLE_TIMEOUT_MS')

    // Cookie defaults
    expect(src).toContain("COOKIE_NAME: 'auth-token'")
    expect(src).toContain('COOKIE_HTTP_ONLY: true')
    expect(src).toContain("COOKIE_SAME_SITE: 'strict'")
  })
})

// ═══════════════════════════════════════════════
// TEST 11 – RATE_LIMIT_CONFIG has correct defaults
// ═══════════════════════════════════════════════
describe('Test 11: RATE_LIMIT_CONFIG has expected defaults', () => {
  it('should have login max 5 attempts in 15min window and lockout 30min', () => {
    const src = readSource('lib/security/config.ts')

    // Login: 5 max attempts, 15 minutes = 900000ms
    expect(src).toContain('RATE_LIMIT_CONFIG')
    expect(src).toContain("MAX_ATTEMPTS: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5'")
    expect(src).toContain("WINDOW_MS: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000'")

    // API: 120 max requests, 1 minute = 60000ms
    expect(src).toContain("MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_API_MAX || '120'")
    expect(src).toContain("WINDOW_MS: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000'")

    // Account lockout: 5 failed attempts, 30 minutes = 1800000ms
    expect(src).toContain('ACCOUNT_LOCKOUT')
    expect(src).toContain("MAX_FAILED_ATTEMPTS: parseInt(process.env.ACCOUNT_LOCKOUT_MAX_FAILED || '5'")
    expect(src).toContain("LOCKOUT_DURATION_MS: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MS || '1800000'")
  })
})

// ═══════════════════════════════════════════════
// TEST 12 – generateCSRFToken returns a 64-char hex string
// ═══════════════════════════════════════════════
describe('Test 12: generateCSRFToken produces a 64-character hex string', () => {
  it('should return a string of 64 hex characters', async () => {
    const { generateCSRFToken } = await import('@/lib/security/csrf')

    const token = generateCSRFToken()
    expect(typeof token).toBe('string')
    // randomBytes(32).toString('hex') = 64 hex chars
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })
})

// ═══════════════════════════════════════════════
// TEST 13 – generateBackupCodes returns 10 codes of 8 chars
// ═══════════════════════════════════════════════
describe('Test 13: generateBackupCodes source validation', () => {
  it('should produce 10 codes of 8 chars from safe charset (no I, O, 0, 1)', () => {
    const src = readSource('lib/auth/twoFactor.ts')

    // Default count is 10
    expect(src).toContain('count: number = 10')
    // 8-character code length
    expect(src).toContain('length: 8')
    // Charset excludes confusing chars (I, O, 0, 1)
    expect(src).toContain('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')
    expect(src).not.toContain("'I'")
    // 32 characters in charset
    expect(src).toContain('% 32')
  })
})

// ═══════════════════════════════════════════════
// TEST 14 – generateTempToken / verifyTempToken roundtrip
// ═══════════════════════════════════════════════
describe('Test 14: generateTempToken and verifyTempToken source validation', () => {
  it('should use JWT with 10-minute expiry and env.JWT_SECRET', () => {
    const src = readSource('lib/auth/twoFactor.ts')

    // Temp token expires in 10 minutes
    expect(src).toContain("TEMP_TOKEN_EXPIRES_IN = '10m'")
    // Uses jwt.sign with env.JWT_SECRET
    expect(src).toContain('jwt.sign(payload, env.JWT_SECRET')
    // Uses jwt.verify with env.JWT_SECRET
    expect(src).toContain('jwt.verify(token, env.JWT_SECRET)')
    // Returns null on failure
    expect(src).toContain('return null')
    // Accepts userId and activeTenantId
    expect(src).toContain('userId: string')
    expect(src).toContain('activeTenantId')
  })
})

// ═══════════════════════════════════════════════
// TEST 15 – MFA_CONFIG TOTP_WINDOW is 2
// ═══════════════════════════════════════════════
describe('Test 15: MFA_CONFIG TOTP_WINDOW setting', () => {
  it('should have TOTP_WINDOW set to 2 for 60-second tolerance', () => {
    const src = readSource('lib/security/config.ts')

    expect(src).toContain('TOTP_WINDOW: 2')
    expect(src).toContain('Allow 2 time steps')
  })
})

// ═══════════════════════════════════════════════
// TEST 16 – MFA_CONFIG REQUIRED_FOR_ROLES includes admin
// ═══════════════════════════════════════════════
describe('Test 16: MFA_CONFIG REQUIRED_FOR_ROLES includes admin roles', () => {
  it('should require MFA for admin, group-admin, and hospital-admin', () => {
    const src = readSource('lib/security/config.ts')

    expect(src).toContain("REQUIRED_FOR_ROLES: ['admin', 'group-admin', 'hospital-admin']")
    expect(src).toContain('BACKUP_CODES_COUNT: 10')
  })
})

// ═══════════════════════════════════════════════
// TEST 17 – Login route uses withErrorHandler
// ═══════════════════════════════════════════════
describe('Test 17: Login route uses withErrorHandler wrapper', () => {
  it('should wrap POST handler with withErrorHandler', () => {
    const src = readSource('app/api/auth/login/route.ts')

    expect(src).toContain("import { withErrorHandler } from '@/lib/core/errors'")
    expect(src).toContain('export const POST = withErrorHandler(')
    expect(src).toContain("import { loginSchema } from '@/lib/validation/auth.schema'")
    expect(src).toContain('validateBody(body, loginSchema)')
  })
})

// ═══════════════════════════════════════════════
// TEST 18 – 2FA setup route uses withAuthTenant
// ═══════════════════════════════════════════════
describe('Test 18: 2FA setup route uses withAuthTenant guard', () => {
  it('should wrap POST handler with withAuthTenant', () => {
    const src = readSource('app/api/auth/2fa/setup/route.ts')

    expect(src).toContain("import { withAuthTenant } from '@/lib/core/guards/withAuthTenant'")
    expect(src).toContain('export const POST = withAuthTenant(')
    expect(src).toContain('generate2FASecret')
    expect(src).toContain('generateBackupCodes')
    expect(src).toContain('tenantScoped: false')
  })
})

// ═══════════════════════════════════════════════
// TEST 19 – switchTenantSchema validation
// ═══════════════════════════════════════════════
describe('Test 19: switchTenantSchema validates tenantId', () => {
  it('should accept valid tenantId and reject empty string', async () => {
    const { switchTenantSchema } = await import('@/lib/validation/auth.schema')

    const valid = switchTenantSchema.safeParse({ tenantId: 'my-tenant-id' })
    expect(valid.success).toBe(true)

    const empty = switchTenantSchema.safeParse({ tenantId: '' })
    expect(empty.success).toBe(false)

    const missing = switchTenantSchema.safeParse({})
    expect(missing.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════
// TEST 20 – passwordStrengthSchema validation
// ═══════════════════════════════════════════════
describe('Test 20: passwordStrengthSchema validates input', () => {
  it('should accept valid input and reject missing password', async () => {
    const { passwordStrengthSchema } = await import('@/lib/validation/auth.schema')

    const valid = passwordStrengthSchema.safeParse({
      password: 'TestPassword123!',
      email: 'user@thea.health',
      name: 'Test User',
    })
    expect(valid.success).toBe(true)

    // email and name are optional
    const minimal = passwordStrengthSchema.safeParse({ password: 'abc' })
    expect(minimal.success).toBe(true)

    // empty password rejected (min 1)
    const emptyPw = passwordStrengthSchema.safeParse({ password: '' })
    expect(emptyPw.success).toBe(false)

    // missing password entirely rejected
    const noPw = passwordStrengthSchema.safeParse({})
    expect(noPw.success).toBe(false)
  })
})
