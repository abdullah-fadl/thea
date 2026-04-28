/**
 * Environment variable validation and access
 * 
 * This module provides type-safe access to environment variables
 * and validates required variables at runtime.
 * 
 * Usage:
 *   import { env } from '@/lib/env';
 *   const jwtSecret = env.JWT_SECRET;
 */

import path from 'path';
import { logger } from '@/lib/monitoring/logger';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Validates that a required environment variable is present
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  
  if (!value || value.trim() === '') {
    const errorMessage = `Required environment variable "${key}" is missing or empty.`;
    
    if (isDev) {
      logger.error(errorMessage, { category: 'system', key });
      logger.error('Available env vars hint', { category: 'system', matchingKeys: Object.keys(process.env).filter(k => k.includes(key.toUpperCase().replace('_', ''))) });
      logger.error('Tip: Copy .env.example to .env.local and fill in the values.', { category: 'system' });
    }
    
    throw new Error(errorMessage);
  }
  
  return value;
}

function ensureNotPlaceholder(key: string, value: string): string {
  const normalized = value.trim().toLowerCase();
  const invalidValues = new Set([
    'change-me',
    'replace-me',
    'your-super-secret-jwt-key-here-change-this',
    'sk-...',
    'sk',
  ]);
  if (invalidValues.has(normalized)) {
    throw new Error(`Environment variable "${key}" is set to a placeholder value. Please provide a real value.`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value
 */
function getEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Gets an optional environment variable (returns undefined if not set)
 */
function getOptionalEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Type-safe environment variables object
 * All server routes should use this instead of process.env directly
 */
export const env = {
  // Required variables
  JWT_SECRET: ensureNotPlaceholder('JWT_SECRET', requireEnv('JWT_SECRET')),

  // Database (PostgreSQL via Prisma — MONGO_URL is deprecated)
  MONGO_URL: getEnv('MONGO_URL', ''), // @deprecated — no longer used, kept for backward compat
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // Optional variables with defaults
  DB_NAME: getEnv('DB_NAME', 'hospital_ops'), // @deprecated
  CORS_ORIGINS: getEnv('CORS_ORIGINS', ''),
  POLICIES_DIR: process.env.POLICIES_DIR || path.join(process.cwd(), 'storage', 'policies'),
  TRANSLATION_PROVIDER: getEnv('TRANSLATION_PROVIDER', 'none'),
  OPENAI_TRANSLATION_MODEL: getEnv('OPENAI_TRANSLATION_MODEL', 'gpt-4o-mini'),
  NEXT_PUBLIC_BASE_URL: getEnv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000'),
  LOG_LEVEL: getEnv('LOG_LEVEL', process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  
  // Security variables
  FIELD_ENCRYPTION_KEY: getOptionalEnv('FIELD_ENCRYPTION_KEY'),
  // JWT Key Rotation Procedure:
  // 1. Copy current JWT_SECRET value to JWT_SECRET_PREVIOUS
  // 2. Generate new JWT_SECRET (32+ chars random string)
  // 3. Deploy — new tokens use new secret, old tokens verified against previous
  // 4. After 7 days (JWT_EXPIRES_IN), all old tokens expired
  // 5. Remove JWT_SECRET_PREVIOUS
  // Recommended: Rotate every 90 days
  JWT_SECRET_PREVIOUS: getOptionalEnv('JWT_SECRET_PREVIOUS'),
  REDIS_URL: getOptionalEnv('REDIS_URL'),

  // SMTP / Email (all optional — falls back to console logging when not configured)
  SMTP_HOST: getOptionalEnv('SMTP_HOST'),
  SMTP_PORT: getOptionalEnv('SMTP_PORT'),
  SMTP_USER: getOptionalEnv('SMTP_USER'),
  SMTP_PASS: getOptionalEnv('SMTP_PASS'),
  SMTP_FROM: getOptionalEnv('SMTP_FROM'),

  // Optional variables (can be undefined)
  OPENAI_API_KEY: getOptionalEnv('OPENAI_API_KEY'),
  CRON_SECRET: getOptionalEnv('CRON_SECRET'),
  THEA_ENGINE_URL: getEnv('THEA_ENGINE_URL', process.env.POLICY_ENGINE_URL || 'http://localhost:8001'),
  THEA_ENGINE_TENANT_ID: getEnv('THEA_ENGINE_TENANT_ID', process.env.POLICY_ENGINE_TENANT_ID || 'default'),
  ADMIN_DELETE_CODE: getOptionalEnv('ADMIN_DELETE_CODE'),
  
  // NODE_ENV is always available in Next.js
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Helper to check if we're in development
  isDev,
  isProd: process.env.NODE_ENV === 'production',
} as const;

if (env.TRANSLATION_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
  throw new Error('TRANSLATION_PROVIDER is set to "openai" but OPENAI_API_KEY is missing.');
}

if (String(process.env.IDENTITY_STORE_RAW || '0') === '1') {
  const rawKey = String(process.env.IDENTITY_STORE_RAW_KEY || '').trim();
  if (!rawKey) {
    throw new Error('IDENTITY_STORE_RAW is enabled but IDENTITY_STORE_RAW_KEY is missing.');
  }
  ensureNotPlaceholder('IDENTITY_STORE_RAW_KEY', rawKey);
}

// ---------------------------------------------------------------------------
// Production startup validation
// ---------------------------------------------------------------------------

/**
 * Additional checks that run ONLY in production. These produce warnings
 * (not hard failures) because some features are optional, but they flag
 * misconfigurations that would reduce security or functionality.
 */
function validateProductionConfig(): void {
  if (!env.isProd) return;

  const warnings: string[] = [];

  // Security-critical checks
  if (!env.DATABASE_URL) {
    warnings.push('DATABASE_URL is not set — database connection will fail');
  }
  if (!env.REDIS_URL) {
    warnings.push('REDIS_URL not set — caching and rate limiting will use in-memory fallback (not suitable for multi-instance)');
  }
  if (!env.FIELD_ENCRYPTION_KEY) {
    warnings.push('FIELD_ENCRYPTION_KEY not set — PHI field encryption is disabled (HIPAA non-compliant)');
  }
  if (env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET is shorter than 32 characters — weak signing key');
  }

  // Operational checks
  if (!env.CRON_SECRET) {
    warnings.push('CRON_SECRET not set — cron endpoints are unprotected');
  }
  if (!getOptionalEnv('TWILIO_ACCOUNT_SID')) {
    warnings.push('TWILIO_ACCOUNT_SID not set — SMS/OTP will use dev mode (no real messages)');
  }

  // NPHIES integration
  if (getOptionalEnv('NPHIES_ENABLED') === 'true') {
    if (!getOptionalEnv('NPHIES_BASE_URL')) {
      warnings.push('NPHIES_ENABLED=true but NPHIES_BASE_URL is not set');
    }
    if (!getOptionalEnv('NPHIES_LICENSE_ID')) {
      warnings.push('NPHIES_ENABLED=true but NPHIES_LICENSE_ID is not set');
    }
  }

  // Log all warnings
  if (warnings.length > 0) {
    logger.warn('Production configuration warnings', {
      category: 'system',
      warningCount: warnings.length,
      warnings,
    });
    for (const w of warnings) {
      logger.warn(`  [WARN] ${w}`, { category: 'system' });
    }
  } else {
    logger.info('Production configuration validated — no issues found', { category: 'system' });
  }
}

// Run production checks (non-blocking — warnings only)
try {
  validateProductionConfig();
} catch {
  // Never crash on validation warnings
}

// Note: Required env vars are validated at module load time via requireEnv()
// This ensures the app fails fast with a clear error if required vars are missing

