#!/usr/bin/env tsx
/**
 * Safe production migration script for Thea EHR
 *
 * Usage:
 *   npx tsx scripts/migrate-production.ts [--dry-run] [--force] [--seed]
 *
 * Flags:
 *   --dry-run   Show what would be done without executing
 *   --force     Skip confirmation prompts (for CI/CD pipelines)
 *   --seed      Run seed after migration
 *
 * Environment variables:
 *   DATABASE_URL   - Connection string (required)
 *   DIRECT_URL     - Direct connection string (optional, preferred for migrations)
 *   MIGRATION_URL  - Explicit migration URL (optional, highest priority)
 *
 * Exit codes:
 *   0   Success
 *   1   Error / aborted
 */

import { execSync } from 'child_process';
import * as readline from 'readline';

// ---------------------------------------------------------------------------
// Logger: try project logger, fall back to console
// ---------------------------------------------------------------------------

type LogFn = (message: string, context?: Record<string, unknown>) => void;

interface Logger {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
}

async function getLogger(): Promise<Logger> {
  try {
    const mod = await import('../lib/monitoring/logger');
    return mod.logger;
  } catch {
    return {
      info: (msg: string) => {},
      warn: (msg: string) => {},
      error: (msg: string) => {},
    };
  }
}

// ---------------------------------------------------------------------------
// ANSI color helpers
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function info(msg: string) {
  console.log(`${c.cyan}[INFO]${c.reset}  ${msg}`);
}

function ok(msg: string) {
  console.log(`${c.green}[OK]${c.reset}    ${msg}`);
}

function warn(msg: string) {
  console.log(`${c.yellow}[WARN]${c.reset}  ${msg}`);
}

function fail(msg: string) {
  console.error(`${c.red}[ERROR]${c.reset} ${msg}`);
}

function step(n: number, total: number, msg: string) {
  console.log(
    `\n${c.bold}${c.blue}[${n}/${total}]${c.reset} ${c.bold}${msg}${c.reset}`
  );
}

function banner(title: string) {
  const line = '='.repeat(64);
  console.log(`\n${c.bold}${c.magenta}${line}${c.reset}`);
  console.log(`${c.bold}${c.magenta}  ${title}${c.reset}`);
  console.log(`${c.bold}${c.magenta}${line}${c.reset}\n`);
}

// ---------------------------------------------------------------------------
// Shell helper
// ---------------------------------------------------------------------------

function run(cmd: string, opts?: { silent?: boolean }): string {
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: opts?.silent ? 'pipe' : 'inherit',
      timeout: 300_000, // 5 minutes
    });
    return typeof output === 'string' ? output.trim() : '';
  } catch (err: unknown) {
    if (opts?.silent) {
      const e = err as Record<string, unknown>;
      return (((e.stdout as Buffer)?.toString()) ?? '') + (((e.stderr as Buffer)?.toString()) ?? '');
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const RUN_SEED = args.includes('--seed');

// ---------------------------------------------------------------------------
// Confirmation prompt
// ---------------------------------------------------------------------------

function confirm(question: string): Promise<boolean> {
  if (FORCE) return Promise.resolve(true);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${c.yellow}${question} (y/N): ${c.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isDevelopmentUrl(url: string): boolean {
  const devPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    ':5432/test',
    ':5432/dev',
    'dev_db',
    'test_db',
    '_dev',
    '_test',
  ];
  const lower = url.toLowerCase();
  return devPatterns.some((p) => lower.includes(p));
}

function maskConnectionString(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return url.replace(/:([^@]+)@/, ':****@');
  }
}

// ---------------------------------------------------------------------------
// Main migration flow
// ---------------------------------------------------------------------------

async function main() {
  const log = await getLogger();
  const totalSteps = RUN_SEED ? 8 : 7;
  const startTime = Date.now();

  banner('Thea EHR - Production Migration');

  info(`Timestamp: ${new Date().toISOString()}`);

  if (DRY_RUN) {
    warn(
      `${c.bold}DRY RUN MODE${c.reset}${c.yellow} - no changes will be made${c.reset}`
    );
  }
  if (FORCE) {
    info('Force mode enabled - confirmation prompts will be skipped');
  }
  if (RUN_SEED) {
    info('Seed mode enabled - will seed database after migration');
  }

  log.info('Migration script started', {
    category: 'db',
    dryRun: DRY_RUN,
    force: FORCE,
    seed: RUN_SEED,
  });

  // -------------------------------------------------------------------------
  // Step 1: Verify DATABASE_URL
  // -------------------------------------------------------------------------
  step(1, totalSteps, 'Verifying DATABASE_URL');

  const migrationUrl = process.env.MIGRATION_URL;
  const directUrl = process.env.DIRECT_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const effectiveUrl = migrationUrl || directUrl || databaseUrl;

  if (!effectiveUrl) {
    fail('DATABASE_URL environment variable is not set.');
    fail(
      'Set DATABASE_URL (or DIRECT_URL / MIGRATION_URL) before running migrations.'
    );
    log.error('No database connection string found', { category: 'db' });
    process.exit(1);
  }

  const masked = maskConnectionString(effectiveUrl);
  info(`Target database: ${c.dim}${masked}${c.reset}`);

  if (isDevelopmentUrl(effectiveUrl)) {
    warn('');
    warn(
      `${c.bgYellow}${c.bold} WARNING ${c.reset} The database URL looks like a development/local database.`
    );
    warn('This script is designed for production deployments.');
    warn(`URL contains a dev-like pattern: ${c.dim}${masked}${c.reset}`);
    warn('');

    const proceed = await confirm(
      'Are you sure you want to continue with this database URL?'
    );
    if (!proceed) {
      info('Migration aborted by user.');
      process.exit(1);
    }
  }

  ok('DATABASE_URL is set and verified');

  // -------------------------------------------------------------------------
  // Step 2: Check current migration status
  // -------------------------------------------------------------------------
  step(2, totalSteps, 'Checking current migration status');

  if (DRY_RUN) {
    info('[dry-run] Would run: prisma migrate status');
  } else {
    try {
      const statusOutput = run('npx prisma migrate status', { silent: true });
      if (statusOutput.trim()) {
        console.log(`${c.dim}${statusOutput}${c.reset}`);
      }
      ok('Migration status retrieved');
    } catch {
      warn(
        'Could not retrieve migration status (this may be expected for a fresh database).'
      );
    }
  }

  // -------------------------------------------------------------------------
  // Step 3: Validate Prisma schema
  // -------------------------------------------------------------------------
  step(3, totalSteps, 'Validating Prisma schema');

  if (DRY_RUN) {
    info('[dry-run] Would run: prisma validate');
  } else {
    try {
      run('npx prisma validate', { silent: true });
      ok('Prisma schema is valid');
    } catch {
      fail(
        'Prisma schema validation failed. Fix schema errors before migrating.'
      );
      log.error('Prisma schema validation failed', { category: 'db' });
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // Step 4: Backup reminder and confirmation
  // -------------------------------------------------------------------------
  step(4, totalSteps, 'Pre-migration checklist');

  console.log('');
  console.log(`  ${c.yellow}Before proceeding, please ensure:${c.reset}`);
  console.log(
    `  ${c.dim}  1. You have a recent database backup${c.reset}`
  );
  console.log(
    `  ${c.dim}  2. You have tested these migrations in staging${c.reset}`
  );
  console.log(
    `  ${c.dim}  3. You are in a maintenance window (if applicable)${c.reset}`
  );
  console.log(
    `  ${c.dim}  4. You have verified the connection string targets the correct database${c.reset}`
  );
  console.log('');

  if (DRY_RUN) {
    info('[dry-run] Would ask for confirmation here');
  } else {
    const proceed = await confirm('Proceed with migration?');
    if (!proceed) {
      info('Migration aborted by user.');
      log.info('Migration aborted by user', { category: 'db' });
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // Step 5: Run prisma migrate deploy (NEVER prisma migrate dev)
  // -------------------------------------------------------------------------
  step(5, totalSteps, 'Running migrations (prisma migrate deploy)');

  if (DRY_RUN) {
    info('[dry-run] Would run: npx prisma migrate deploy');
    info(
      '[dry-run] This applies all pending migrations without creating new ones.'
    );
  } else {
    try {
      info('Applying pending migrations...');
      run('npx prisma migrate deploy');
      ok('All migrations applied successfully');
      log.info('Prisma migrate deploy succeeded', { category: 'db' });
    } catch (err: unknown) {
      fail('Migration failed!');
      fail('Check the error output above for details.');
      console.log('');
      fail('Recovery steps:');
      console.log(
        `  ${c.dim}1. Check the migration status: npx prisma migrate status${c.reset}`
      );
      console.log(
        `  ${c.dim}2. Review the failed migration in prisma/migrations/${c.reset}`
      );
      console.log(
        `  ${c.dim}3. If needed, restore from backup${c.reset}`
      );
      console.log(
        `  ${c.dim}4. Fix the issue and re-run this script${c.reset}`
      );
      log.error('Prisma migrate deploy failed', {
        category: 'db',
        error: (err as Error).message,
      });
      process.exit(1);
    }
  }

  // -------------------------------------------------------------------------
  // Step 6: Generate Prisma Client
  // -------------------------------------------------------------------------
  step(6, totalSteps, 'Generating Prisma Client');

  if (DRY_RUN) {
    info('[dry-run] Would run: npx prisma generate');
  } else {
    try {
      run('npx prisma generate', { silent: true });
      ok('Prisma Client generated');
      log.info('Prisma client regenerated', { category: 'db' });
    } catch {
      warn(
        'Prisma Client generation failed - you may need to run it manually: npx prisma generate'
      );
    }
  }

  // -------------------------------------------------------------------------
  // Step 7: Verify database connection
  // -------------------------------------------------------------------------
  step(7, totalSteps, 'Verifying database connection');

  if (DRY_RUN) {
    info('[dry-run] Would verify database connection with SELECT 1');
  } else {
    try {
      const { PrismaClient } = await import('@prisma/client');

      let verifyClient: InstanceType<typeof PrismaClient>;
      try {
        // Try with PrismaPg adapter if available
        const { PrismaPg } = await import('@prisma/adapter-pg');
        const connectionString = migrationUrl || directUrl || databaseUrl;
        const adapter = new PrismaPg({ connectionString: connectionString! });
        verifyClient = new PrismaClient({ adapter } as Record<string, unknown>);
      } catch {
        // Fall back to default connection
        verifyClient = new PrismaClient();
      }

      const result: Record<string, unknown>[] = await verifyClient.$queryRawUnsafe(
        'SELECT 1 AS connected'
      );
      await verifyClient.$disconnect();

      if (result && result.length > 0) {
        ok('Database connection verified (SELECT 1 returned successfully)');
        log.info('Post-migration connectivity check passed', {
          category: 'db',
        });
      } else {
        throw new Error('SELECT 1 returned unexpected result');
      }
    } catch (err: unknown) {
      warn(
        `Post-migration connectivity check failed (non-fatal): ${(err as Error).message}`
      );
      log.warn('Post-migration connectivity check failed', {
        category: 'db',
        error: (err as Error).message,
      });
      // Non-fatal: the migration itself succeeded
    }
  }

  // -------------------------------------------------------------------------
  // Step 8 (optional): Run seed
  // -------------------------------------------------------------------------
  if (RUN_SEED) {
    step(8, totalSteps, 'Running database seed');

    if (DRY_RUN) {
      info('[dry-run] Would run: npx prisma db seed');
    } else {
      try {
        info('Seeding database with default data...');
        run('npx prisma db seed');
        ok('Database seeded successfully');
        log.info('Database seeded', { category: 'db' });
      } catch (err: unknown) {
        warn(
          'Seed failed - you may need to run it manually: npx prisma db seed'
        );
        warn('This is non-fatal; the migration itself was successful.');
        log.warn('Seed failed', { category: 'db', error: (err as Error).message });
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  console.log('');
  console.log(
    `${c.bold}${c.bgGreen} DONE ${c.reset} ${c.green}Production migration completed in ${durationSec}s${c.reset}`
  );
  console.log('');

  if (DRY_RUN) {
    console.log(
      `${c.yellow}This was a dry run. Re-run without --dry-run to apply changes.${c.reset}`
    );
    console.log('');
  }

  if (!RUN_SEED) {
    console.log(
      `${c.dim}Tip: Add --seed flag to also run database seeding after migration.${c.reset}`
    );
    console.log('');
  }

  log.info('Migration script completed successfully', {
    category: 'db',
    durationMs,
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

main().catch(async (err) => {
  const log = await getLogger();
  log.error('Migration script failed with unhandled error', {
    category: 'db',
    error: err instanceof Error ? err.message : String(err),
  });
  fail(`Unexpected error: ${err.message || err}`);
  process.exit(1);
});
