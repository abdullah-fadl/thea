/**
 * 20 Security Audit Scenarios
 *
 * Validates every major security hardening applied during the
 * 10-phase security audit (SEC-01 through SEC-10, P-01 through P-07).
 *
 * Categories tested:
 *  1-3   Error detail leak prevention (SEC-10 / P-07)
 *  4-5   withErrorHandler wrapper behaviour
 *  6-7   Security headers (SEC-02 / S-01)
 *  8-9   CORS configuration
 *  10-11 Session & cookie security
 *  12-13 Rate-limit configuration
 *  14-15 Field-level encryption (AES-256-GCM)
 *  16-17 Tenant isolation
 *  18    Init route production block (SEC-01)
 *  19    Query limits / unbounded fetch prevention (P-01 to P-06)
 *  20    Code-level grep: zero remaining error.message leaks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Read a source file relative to project root */
function readSource(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8')
}

/** Glob API route files */
function globRouteFiles(dir: string): string[] {
  const base = path.join(process.cwd(), dir)
  if (!fs.existsSync(base)) return []
  const results: string[] = []
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name === 'route.ts') results.push(full)
    }
  }
  walk(base)
  return results
}

// ═══════════════════════════════════════════════
// SCENARIO 1 – No error.message leaks in API responses
// ═══════════════════════════════════════════════
describe('Scenario 1: No error.message leaks in API client responses', () => {
  it('should not return details: error.message in any API route catch block', () => {
    const routes = globRouteFiles('app/api')
    const violations: string[] = []

    for (const file of routes) {
      // Skip CVision routes (separate platform, tested independently)
      if (file.includes('/cvision/') || file.includes('/cron/cvision/')) continue
      const src = fs.readFileSync(file, 'utf-8')
      // Match patterns that leak error details to JSON responses
      // Exclude logger.error lines (server-side only)
      const lines = src.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip logger lines
        if (line.includes('logger.error') || line.includes('console.error')) continue
        // Check for error detail leaks in response JSON
        if (
          /details:\s*error\.message/.test(line) ||
          /details:\s*error\.issues/.test(line) ||
          /details:\s*errorMessage\b/.test(line) ||
          /details:\s*String\(e\?\.message/.test(line) ||
          /details:\s*fetchError\.message/.test(line)
        ) {
          const rel = path.relative(process.cwd(), file)
          violations.push(`${rel}:${i + 1} → ${line.trim()}`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 2 – All catch blocks return generic error messages
// ═══════════════════════════════════════════════
describe('Scenario 2: Admin routes return generic error messages', () => {
  it('should not expose error internals in admin API catch blocks', () => {
    const routes = globRouteFiles('app/api/admin')
    const violations: string[] = []

    for (const file of routes) {
      const src = fs.readFileSync(file, 'utf-8')
      // Check that catch blocks don't have "details: error" (leaking Error object)
      const catchPattern = /catch\s*\([^)]*\)\s*\{[\s\S]*?return\s+NextResponse\.json/g
      let match
      while ((match = catchPattern.exec(src)) !== null) {
        const block = match[0]
        if (/details:\s*(error|e|err)\.message/.test(block)) {
          const rel = path.relative(process.cwd(), file)
          violations.push(rel)
        }
      }
    }

    expect(violations).toEqual([])
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 3 – Portal routes have try/catch error handlers
// ═══════════════════════════════════════════════
describe('Scenario 3: Portal routes have error handlers', () => {
  const portalRoutes = [
    'app/api/portal/explain/route.ts',
    'app/api/portal/explain/history/route.ts',
    'app/api/portal/medications/route.ts',
    'app/api/portal/results/route.ts',
  ]

  for (const route of portalRoutes) {
    it(`${route} should have a try/catch block`, () => {
      const src = readSource(route)
      expect(src).toContain('try {')
      expect(src).toContain('catch (error)')
      expect(src).toContain('logger.error')
      expect(src).toContain('status: 500')
    })
  }
})

// ═══════════════════════════════════════════════
// SCENARIO 4 – withErrorHandler sanitizes unknown errors in production
// ═══════════════════════════════════════════════
describe('Scenario 4: withErrorHandler sanitizes errors in production', () => {
  it('should return "Internal server error" for unknown errors in prod', async () => {
    // Temporarily set to production
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const { withErrorHandler } = await import('@/lib/core/errors')

    const handler = withErrorHandler(async () => {
      throw new Error('Secret database connection string exposed!')
    })

    const result = await handler() as NextResponse
    const body = await result.json()

    expect(body.error).toBe('Internal server error')
    expect(body.error).not.toContain('Secret')
    expect(body.error).not.toContain('database')
    expect(body.code).toBe('INTERNAL_ERROR')

    process.env.NODE_ENV = origEnv
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 5 – withErrorHandler applies security headers
// ═══════════════════════════════════════════════
describe('Scenario 5: withErrorHandler applies security headers', () => {
  it('should add X-Frame-Options and X-Content-Type-Options to successful responses', async () => {
    const { withErrorHandler } = await import('@/lib/core/errors')

    const handler = withErrorHandler(async () => {
      return NextResponse.json({ ok: true })
    })

    const result = await handler() as NextResponse
    expect(result.headers.get('X-Frame-Options')).toBe('DENY')
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(result.headers.get('Cache-Control')).toBe('no-store')
  })

  it('should add security headers to error responses', async () => {
    const { withErrorHandler, BadRequestError } = await import('@/lib/core/errors')

    const handler = withErrorHandler(async () => {
      throw new BadRequestError('Invalid input')
    })

    const result = await handler() as NextResponse
    expect(result.status).toBe(400)
    expect(result.headers.get('X-Frame-Options')).toBe('DENY')
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 6 – Security headers module produces correct headers
// ═══════════════════════════════════════════════
describe('Scenario 6: addSecurityHeaders applies all expected headers', () => {
  it('should add X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy', () => {
    const src = readSource('lib/security/headers.ts')

    expect(src).toContain("'X-Frame-Options', 'DENY'")
    expect(src).toContain("'X-Content-Type-Options', 'nosniff'")
    expect(src).toContain("'Referrer-Policy', 'strict-origin-when-cross-origin'")
    expect(src).toContain('geolocation=(), microphone=(), camera=()')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 7 – Middleware applies security headers globally
// ═══════════════════════════════════════════════
describe('Scenario 7: Middleware applies security headers globally', () => {
  it('should set X-Frame-Options and X-Content-Type-Options in middleware.ts', () => {
    const src = readSource('middleware.ts')

    expect(src).toContain('X-Frame-Options')
    expect(src).toContain('DENY')
    expect(src).toContain('X-Content-Type-Options')
    expect(src).toContain('nosniff')
    expect(src).toContain('Referrer-Policy')
    expect(src).toContain('Permissions-Policy')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 8 – CORS blocks wildcard in production
// ═══════════════════════════════════════════════
describe('Scenario 8: CORS blocks wildcard (*) in production', () => {
  it('should contain SEC-02 wildcard filter logic in CORS config', () => {
    const src = readSource('lib/security/config.ts')

    // [SEC-02] Never allow wildcard (*) in production CORS
    expect(src).toContain('[SEC-02]')
    expect(src).toContain("o !== '*'")
    expect(src).toContain('isProd')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 9 – CORS preflight returns 403 for unknown origins
// ═══════════════════════════════════════════════
describe('Scenario 9: CORS preflight rejects unknown origins', () => {
  it('should return 403 for origins not in the allowed list', () => {
    const src = readSource('lib/security/headers.ts')

    // Verify handleCORSPreflight checks allowed origins
    expect(src).toContain('ALLOWED_ORIGINS.includes(origin)')
    expect(src).toContain('status: 403')
    expect(src).toContain("'Origin not allowed'")
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 10 – Session cookies are httpOnly + secure + strict
// ═══════════════════════════════════════════════
describe('Scenario 10: Session cookie configuration is secure', () => {
  it('should have httpOnly, secure in prod, and strict sameSite', () => {
    const src = readSource('lib/security/config.ts')

    expect(src).toContain('COOKIE_HTTP_ONLY: true')
    expect(src).toContain('COOKIE_SECURE: env.isProd')
    expect(src).toContain("COOKIE_SAME_SITE: 'strict'")
  })

  it('should enforce absolute max session lifetime', () => {
    const src = readSource('lib/security/config.ts')

    // 24 hours default
    expect(src).toContain('ABSOLUTE_MAX_AGE_MS')
    expect(src).toContain('86400000')
  })

  it('should enforce idle timeout', () => {
    const src = readSource('lib/security/config.ts')

    // 30 minutes default
    expect(src).toContain('IDLE_TIMEOUT_MS')
    expect(src).toContain('1800000')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 11 – Portal cookie is httpOnly + strict
// ═══════════════════════════════════════════════
describe('Scenario 11: Portal cookie configuration is secure', () => {
  it('should set portal cookies as httpOnly and sameSite strict', () => {
    const src = readSource('lib/portal/auth.ts')

    expect(src).toContain('httpOnly: true')
    expect(src).toContain("sameSite: 'strict'")
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 12 – Rate limiting is configured for login
// ═══════════════════════════════════════════════
describe('Scenario 12: Login rate limiting is configured', () => {
  it('should limit login attempts per IP', () => {
    const src = readSource('app/api/auth/login/route.ts')

    // IP-based rate limiting
    expect(src).toContain('checkRateLimit')
    expect(src).toMatch(/status:\s*429/)
  })

  it('should have rate limit config in security module', () => {
    const src = readSource('lib/security/config.ts')

    expect(src).toContain('RATE_LIMIT_CONFIG')
    expect(src).toContain('MAX_ATTEMPTS')
    expect(src).toContain('ACCOUNT_LOCKOUT')
    expect(src).toContain('LOCKOUT_DURATION_MS')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 13 – Portal OTP rate limiting
// ═══════════════════════════════════════════════
describe('Scenario 13: Portal OTP rate limiting is configured', () => {
  it('should limit OTP requests per mobile and per IP', () => {
    const src = readSource('app/api/portal/auth/request-otp/route.ts')

    expect(src).toContain('MAX_PER_MOBILE')
    expect(src).toContain('MAX_PER_IP')
    expect(src).toMatch(/status:\s*429/)
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 14 – Field encryption uses AES-256-GCM
// ═══════════════════════════════════════════════
describe('Scenario 14: Field encryption uses AES-256-GCM', () => {
  it('should use aes-256-gcm algorithm with 12-byte IV', () => {
    const src = readSource('lib/security/fieldEncryption.ts')

    expect(src).toContain("'aes-256-gcm'")
    expect(src).toContain('IV_LENGTH = 12')
    expect(src).toContain('getAuthTag')
    expect(src).toContain('setAuthTag')
  })

  it('should encrypt and decrypt a string symmetrically', async () => {
    // Set encryption key for test
    const origKey = process.env.FIELD_ENCRYPTION_KEY
    process.env.FIELD_ENCRYPTION_KEY = 'test-encryption-key-32chars-long!'

    // Re-import to pick up the env change
    vi.resetModules()
    const mod = await import('@/lib/security/fieldEncryption')
    const { encryptField, decryptField } = mod

    const plain = 'Patient Sensitive Name'
    const encrypted = encryptField(plain)

    // Should be a JSON string, not plain text
    expect(typeof encrypted).toBe('string')
    expect(encrypted).not.toBe(plain)

    // Should contain encrypted marker
    const parsed = JSON.parse(encrypted as string)
    expect(parsed.__enc).toBe(true)
    expect(parsed.alg).toBe('aes-256-gcm')
    expect(parsed.iv).toBeTruthy()
    expect(parsed.tag).toBeTruthy()
    expect(parsed.data).toBeTruthy()

    // Decrypt should return original
    const decrypted = decryptField(encrypted)
    expect(decrypted).toBe(plain)

    process.env.FIELD_ENCRYPTION_KEY = origKey
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 15 – Sensitive fields are defined for patient data
// ═══════════════════════════════════════════════
describe('Scenario 15: Sensitive patient fields are defined for encryption', () => {
  it('should define SENSITIVE_FIELDS for patient collections', () => {
    const src = readSource('lib/security/fieldEncryption.ts')

    expect(src).toContain("patients: ['firstName'")
    expect(src).toContain("'nationalId'")
    expect(src).toContain("'email'")
    expect(src).toContain("'phone'")
    expect(src).toContain('patient_master')
  })

  it('should define sensitive identifier fields', () => {
    const src = readSource('lib/security/fieldEncryption.ts')

    expect(src).toContain("'nationalId'")
    expect(src).toContain("'iqama'")
    expect(src).toContain("'passport'")
    expect(src).toContain("'insuranceId'")
  })

  it('should store searchable HMAC hashes for encrypted identifiers', () => {
    const src = readSource('lib/security/fieldEncryption.ts')

    expect(src).toContain('hashForSearch')
    expect(src).toContain('createHmac')
    expect(src).toContain("'sha256'")
    expect(src).toContain('nationalId_hash')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 16 – Tenant isolation: tenantId comes from session only
// ═══════════════════════════════════════════════
describe('Scenario 16: Tenant isolation — tenantId from session only', () => {
  it('should NOT read tenantId from query params or request body', () => {
    const src = readSource('lib/tenant.ts')

    expect(src).toContain('getActiveTenantId')
    // Should NOT extract tenantId from URL/body
    expect(src).not.toContain('searchParams.get')
    expect(src).not.toContain('request.json()')
    expect(src).not.toContain('request.body')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 17 – withAuthTenant enforces permission keys
// ═══════════════════════════════════════════════
describe('Scenario 17: withAuthTenant enforces permission-based access', () => {
  it('should require permissionKey for sensitive admin routes', () => {
    const sensitiveRoutes = [
      'app/api/admin/audit/route.ts',
      'app/api/admin/encounters/route.ts',
    ]

    for (const route of sensitiveRoutes) {
      if (fs.existsSync(path.join(process.cwd(), route))) {
        const src = readSource(route)
        expect(src).toContain('permissionKey')
        expect(src).toContain('withAuthTenant')
      }
    }
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 18 – /api/init blocks production & never returns password
// ═══════════════════════════════════════════════
describe('Scenario 18: /api/init is blocked in production', () => {
  it('should block in production with 403', () => {
    const src = readSource('app/api/init/route.ts')

    // [SEC-01] Block in production
    expect(src).toContain('[SEC-01]')
    expect(src).toContain("process.env.NODE_ENV === 'production'")
    expect(src).toContain('status: 403')
  })

  it('should NOT return password in NextResponse.json body', () => {
    const src = readSource('app/api/init/route.ts')

    // [SEC-01] Never return credentials in the API response
    expect(src).toContain('Check server logs for credentials')

    // Extract all NextResponse.json(...) calls and ensure none contain 'password'
    const jsonCalls = src.match(/NextResponse\.json\(\{[^}]+\}/g) || []
    for (const call of jsonCalls) {
      expect(call).not.toContain('password')
      expect(call).not.toContain('initPassword')
    }

    // Password should only go to server-side logging (logger or console)
    expect(src.includes('logger.info') || src.includes('console.log')).toBe(true)
  })

  it('should use env-provided password or generate random, never hardcode', () => {
    const src = readSource('app/api/init/route.ts')

    expect(src).toContain('INIT_ADMIN_PASSWORD')
    expect(src).toContain('Math.random()')
    // Should NOT contain a hardcoded password string
    expect(src).not.toMatch(/password\s*[:=]\s*['"](?:admin|password|123|test)/i)
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 19 – Prisma queries have take limits (P-01 to P-06)
// ═══════════════════════════════════════════════
describe('Scenario 19: Database queries have take limits', () => {
  const routesWithLimits = [
    { file: 'app/api/er/board/route.ts', marker: '[P-01]' },
    { file: 'app/api/opd/queue/route.ts', marker: '[P-06]' },
    { file: 'app/api/admin/audit/route.ts', marker: '[P-03]' },
    { file: 'app/api/portal/medications/route.ts', pattern: 'take: 100' },
    { file: 'app/api/portal/results/route.ts', pattern: 'take: 50' },
  ]

  for (const { file, marker, pattern } of routesWithLimits) {
    it(`${file} should have a take limit`, () => {
      const src = readSource(file)
      expect(src).toContain('take:')
      if (marker) expect(src).toContain(marker)
      if (pattern) expect(src).toContain(pattern)
    })
  }

  it('audit route should cap user-provided limit to 1000', () => {
    const src = readSource('app/api/admin/audit/route.ts')
    expect(src).toContain('Math.min')
    expect(src).toContain('1000')
  })
})

// ═══════════════════════════════════════════════
// SCENARIO 20 – Code-level grep: zero remaining error detail leaks
// ═══════════════════════════════════════════════
describe('Scenario 20: Comprehensive grep — zero error detail leaks across ALL API routes', () => {
  it('should have zero instances of details: <error-info> in client responses', () => {
    const routes = globRouteFiles('app/api')
    const leakPatterns = [
      /details:\s*error\.message/,
      /details:\s*error\.issues/,
      /details:\s*errorMessage\b/,
      /details:\s*String\(e\?\.message/,
      /details:\s*String\(error\?\.message/,
      /details:\s*fetchError\.message/,
      /details:\s*fetchError\b/,
      /details:\s*err\.message/,
    ]
    const violations: string[] = []

    for (const file of routes) {
      // Skip CVision routes (separate platform, tested independently)
      if (file.includes('/cvision/') || file.includes('/cron/cvision/')) continue
      const src = fs.readFileSync(file, 'utf-8')
      const lines = src.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Skip server-side logging
        if (line.includes('logger.error') || line.includes('console.error') || line.includes('logger.warn')) continue
        for (const pattern of leakPatterns) {
          if (pattern.test(line)) {
            const rel = path.relative(process.cwd(), file)
            violations.push(`${rel}:${i + 1}`)
            break
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('should have [SEC-10] markers in previously-leaking routes', () => {
    const routes = globRouteFiles('app/api')
    let secMarkerCount = 0

    for (const file of routes) {
      const src = fs.readFileSync(file, 'utf-8')
      if (src.includes('[SEC-10]')) secMarkerCount++
    }

    // We fixed 100+ routes, at minimum we should see 30+ markers
    expect(secMarkerCount).toBeGreaterThan(30)
  })
})
