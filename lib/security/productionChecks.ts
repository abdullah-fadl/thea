import { logger } from '@/lib/monitoring/logger';

export function validateProductionSecurity(): void {
  // Skip during Next.js build phase — these checks are for runtime only
  const isBuildPhase =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-export';
  if (isBuildPhase) return;

  if (process.env.NODE_ENV === 'production') {
    const isLocalDev = process.env.LOCAL_DEV === '1';

    if (process.env.DEBUG_AUTH === '1') {
      throw new Error(
        '[ALERT] SECURITY ERROR: DEBUG_AUTH must not be enabled in production! ' +
          'Remove DEBUG_AUTH=1 from environment variables.'
      );
    }

    const dangerousFlags = [
      'DEBUG_AUTH',
      'SKIP_AUTH',
      'BYPASS_PERMISSIONS',
      'ALLOW_INSECURE',
    ];

    for (const flag of dangerousFlags) {
      if (process.env[flag] === '1' || process.env[flag] === 'true') {
        throw new Error(`[ALERT] SECURITY ERROR: ${flag} must not be enabled in production!`);
      }
    }

    if (!isLocalDev) {
      if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET.length < 32) {
        throw new Error('[ALERT] SECURITY ERROR: CSRF_SECRET must be set with at least 32 characters');
      }
      if (!process.env.FIELD_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY.length < 32) {
        throw new Error('[ALERT] SECURITY ERROR: FIELD_ENCRYPTION_KEY must be set with at least 32 characters');
      }
    }

    // CORS must not be wildcard
    if (process.env.CORS_ORIGINS === '*' || process.env.CORS_ALLOWED_ORIGINS === '*') {
      throw new Error('[ALERT] SECURITY ERROR: CORS_ORIGINS must not be wildcard (*) in production. Set explicit domains.');
    }

    logger.info('Production security checks passed', { category: 'system' });
  }
}
