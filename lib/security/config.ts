/**
 * Security Configuration
 * Centralized security settings with environment variable support
 */

import { env } from '@/lib/env';
import { appConfig } from '@/lib/config';

/**
 * Session configuration
 */
export const SESSION_CONFIG = {
  // Absolute maximum session lifetime (even if active)
  ABSOLUTE_MAX_AGE_MS: parseInt(process.env.SESSION_ABSOLUTE_MAX_AGE_MS || '86400000', 10), // 24 hours default
  
  // Idle timeout - session expires after this inactivity period
  IDLE_TIMEOUT_MS: parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || '1800000', 10), // 30 minutes default
  
  // Cookie settings
  COOKIE_NAME: 'auth-token',
  COOKIE_HTTP_ONLY: true,
  COOKIE_SECURE: env.isProd, // Only secure in production
  COOKIE_SAME_SITE: 'strict' as const, // Strict CSRF protection
  COOKIE_PATH: '/',
  
  // Session rotation
  ROTATE_ON_PRIVILEGE_CHANGE: true, // Rotate session when role/permissions change
  ROTATE_ON_LOGIN: true, // Always rotate on new login
} as const;

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  // Login endpoint - strict limits
  LOGIN: {
    MAX_ATTEMPTS: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000', 10), // 15 minutes
  },
  
  // General API - moderate limits
  API: {
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_API_MAX || '120', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10), // 1 minute
  },
  
  // Account lockout after repeated failed logins
  ACCOUNT_LOCKOUT: {
    MAX_FAILED_ATTEMPTS: parseInt(process.env.ACCOUNT_LOCKOUT_MAX_FAILED || '5', 10),
    LOCKOUT_DURATION_MS: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MS || '1800000', 10), // 30 minutes
  },

  // AI / Clinical Decision Support endpoints — expensive external API calls
  AI: {
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_AI_MAX || '30', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_AI_WINDOW_MS || '60000', 10), // 30 per minute
  },

  // Patient search endpoints — prevent scraping
  SEARCH: {
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_SEARCH_MAX || '60', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_SEARCH_WINDOW_MS || '60000', 10), // 60 per minute
  },

  // Data export endpoints — heavy resource usage
  EXPORT: {
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_EXPORT_MAX || '5', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_EXPORT_WINDOW_MS || '300000', 10), // 5 per 5 minutes
  },

  // Portal (patient-facing) endpoints
  PORTAL: {
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_PORTAL_MAX || '30', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_PORTAL_WINDOW_MS || '60000', 10), // 30 per minute
  },

  // OTP / SMS endpoints — prevent abuse
  OTP: {
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_OTP_MAX || '3', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_OTP_WINDOW_MS || '300000', 10), // 3 per 5 minutes
  },

  // PDF generation — CPU-intensive
  PDF: {
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_PDF_MAX || '10', 10),
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_PDF_WINDOW_MS || '60000', 10), // 10 per minute
  },
} as const;

/**
 * CORS configuration
 */
export const CORS_CONFIG = {
  // Parse allowed origins from env (comma-separated)
  ALLOWED_ORIGINS: (() => {
    const origins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
    if (origins && origins.length > 0) {
      // [SEC-02] Never allow wildcard (*) in production CORS
      if (env.isProd) {
        return origins.filter(o => o !== '*');
      }
      return origins;
    }
    if (env.isDev) return ['http://localhost:3000', 'http://localhost:3001'];
    // In production with no explicit origins: only same-origin allowed
    return [];
  })(),
  
  ALLOW_CREDENTIALS: true,
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
} as const;

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  HSTS_MAX_AGE: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10), // 1 year
  CSP_REPORT_URI: process.env.CSP_REPORT_URI,
  
  // Content Security Policy - baseline safe for Next.js
  CSP: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval and unsafe-inline
    "style-src 'self' 'unsafe-inline'", // Tailwind/Next.js requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self'${env.OPENAI_API_KEY ? ' https://api.openai.com' : ''}${env.THEA_ENGINE_URL ? ` ${env.THEA_ENGINE_URL}` : ''}`,
    process.env.CSP_REPORT_URI ? `report-uri ${process.env.CSP_REPORT_URI}` : '',
  ].filter(Boolean).join('; '),
} as const;

/**
 * MFA configuration
 */
export const MFA_CONFIG = {
  // TOTP settings
  TOTP_ISSUER: process.env.MFA_TOTP_ISSUER || appConfig.name,
  TOTP_WINDOW: 2, // Allow 2 time steps (60 seconds) tolerance
  
  // Backup codes
  BACKUP_CODES_COUNT: 10,
  
  // Admin roles that require MFA
  REQUIRED_FOR_ROLES: ['admin', 'group-admin', 'hospital-admin'] as const,
} as const;

/**
 * Validate security configuration on startup
 */
export function validateSecurityConfig(): void {
  const errors: string[] = [];
  
  if (SESSION_CONFIG.ABSOLUTE_MAX_AGE_MS < SESSION_CONFIG.IDLE_TIMEOUT_MS) {
    errors.push('SESSION_ABSOLUTE_MAX_AGE_MS must be >= SESSION_IDLE_TIMEOUT_MS');
  }
  
  if (RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS < 1) {
    errors.push('RATE_LIMIT_LOGIN_MAX must be >= 1');
  }
  
  if (RATE_LIMIT_CONFIG.API.MAX_REQUESTS < 1) {
    errors.push('RATE_LIMIT_API_MAX must be >= 1');
  }
  
  if (errors.length > 0) {
    throw new Error(`Security configuration errors:\n${errors.join('\n')}`);
  }
}

// Validate on module load
if (typeof window === 'undefined') {
  validateSecurityConfig();
}

