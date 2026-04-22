/**
 * Performance Test Helpers
 *
 * Shared utilities for performance testing — reuses integration test seeding
 * patterns and adds latency measurement, statistics, and reporting helpers.
 *
 * Prerequisites:
 *   - The dev server running: `yarn dev`
 *   - PostgreSQL reachable via DATABASE_URL
 *   - JWT_SECRET env var set
 *   - Integration seed data OR fresh seed from these helpers
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration-tests-32chars!!';

// ---------------------------------------------------------------------------
// SLA Targets (milliseconds)
// ---------------------------------------------------------------------------

export const SLA = {
  GET_FAST: 200,        // Fast GETs (auth/me, simple lookups)
  GET_LIST: 300,        // List/search endpoints
  GET_REALTIME: 250,    // Real-time dashboard endpoints (ER board, live beds)
  POST_FAST: 500,       // Standard POST operations
  POST_AUTH: 400,       // Login
  CONCURRENT_MAX: 500,  // Max per-request under concurrent load
  CONCURRENT_HARD: 2000, // Absolute max — anything above this is a failure
  DB_SEARCH_NAME: 200,  // Patient search by name
  DB_SEARCH_MRN: 100,   // Patient search by MRN
  DB_LIST: 300,         // Paginated list queries
} as const;

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        '[Performance Tests] DATABASE_URL is not set. ' +
        'Make sure your .env.local is loaded or DATABASE_URL is exported.',
      );
    }
    const adapter = new PrismaPg({ connectionString });
    _prisma = new PrismaClient({ adapter, log: ['error'] });
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}

// ---------------------------------------------------------------------------
// JWT & Auth
// ---------------------------------------------------------------------------

export function generateTestToken(
  userId: string,
  email: string,
  role: string,
  sessionId: string,
  activeTenantId?: string,
): string {
  return jwt.sign(
    {
      userId,
      email,
      role,
      sessionId,
      activeTenantId,
      entitlements: { sam: true, health: true, edrac: true, cvision: true },
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

export async function authenticatedFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});
  headers.set('Cookie', `auth-token=${token}; activePlatform=health`);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...options, headers, redirect: 'manual' });
}

export async function authGet(path: string, token: string): Promise<Response> {
  return authenticatedFetch(path, token, { method: 'GET' });
}

export async function authPost(path: string, token: string, body: unknown): Promise<Response> {
  return authenticatedFetch(path, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Latency measurement
// ---------------------------------------------------------------------------

export interface LatencyResult {
  status: number;
  durationMs: number;
  ok: boolean;
}

/**
 * Measure the latency of a single HTTP request (ms precision via performance.now()).
 */
export async function measureLatency(
  fn: () => Promise<Response>,
): Promise<LatencyResult> {
  const start = performance.now();
  try {
    const res = await fn();
    const durationMs = performance.now() - start;
    return { status: res.status, durationMs, ok: res.status < 500 };
  } catch (err) {
    const durationMs = performance.now() - start;
    return { status: 0, durationMs, ok: false };
  }
}

/**
 * Run an HTTP request N times sequentially and collect all latency results.
 */
export async function benchmarkEndpoint(
  fn: () => Promise<Response>,
  iterations: number = 50,
  warmupRounds: number = 3,
): Promise<LatencyResult[]> {
  // Warmup — discard results
  for (let i = 0; i < warmupRounds; i++) {
    await measureLatency(fn);
  }

  const results: LatencyResult[] = [];
  for (let i = 0; i < iterations; i++) {
    results.push(await measureLatency(fn));
  }
  return results;
}

/**
 * Run an HTTP request concurrently (all at once) and collect latency results.
 */
export async function concurrentBenchmark(
  fn: () => Promise<Response>,
  concurrency: number,
): Promise<LatencyResult[]> {
  const promises = Array.from({ length: concurrency }, () => measureLatency(fn));
  return Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

export interface LatencyStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  errorCount: number;
  errorRate: number;
}

/**
 * Calculate statistics from an array of latency results.
 */
export function calculateStats(results: LatencyResult[]): LatencyStats {
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const count = durations.length;
  const errorCount = results.filter((r) => !r.ok).length;

  if (count === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, errorCount: 0, errorRate: 0 };
  }

  const sum = durations.reduce((a, b) => a + b, 0);
  const avg = sum / count;
  const min = durations[0];
  const max = durations[count - 1];

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * count) - 1;
    return durations[Math.max(0, Math.min(index, count - 1))];
  };

  return {
    count,
    avg: Math.round(avg * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    p50: Math.round(percentile(50) * 100) / 100,
    p95: Math.round(percentile(95) * 100) / 100,
    p99: Math.round(percentile(99) * 100) / 100,
    errorCount,
    errorRate: Math.round((errorCount / count) * 10000) / 100,
  };
}

/**
 * Format stats as a markdown table row.
 */
export function statsToMarkdownRow(
  endpoint: string,
  method: string,
  stats: LatencyStats,
  slaTarget: number,
): string {
  const pass = stats.p95 <= slaTarget;
  const status = pass ? '✅' : '❌';
  return `| ${status} | \`${method}\` | \`${endpoint}\` | ${stats.avg.toFixed(0)} | ${stats.p50.toFixed(0)} | ${stats.p95.toFixed(0)} | ${stats.p99.toFixed(0)} | ${stats.max.toFixed(0)} | ${slaTarget} | ${stats.errorRate}% |`;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

export interface EndpointBenchmark {
  endpoint: string;
  method: string;
  slaTarget: number;
  stats: LatencyStats;
  pass: boolean;
}

/** Global store — tests push results here; report generator reads them. */
const _benchmarkResults: EndpointBenchmark[] = [];

export function recordBenchmark(result: EndpointBenchmark): void {
  _benchmarkResults.push(result);
}

export function getBenchmarkResults(): EndpointBenchmark[] {
  return [..._benchmarkResults];
}

export function clearBenchmarkResults(): void {
  _benchmarkResults.length = 0;
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

export interface PerfTestContext {
  tenantId: string;      // UUID
  tenantKey: string;     // business key
  adminToken: string;
  doctorToken: string;
  nurseToken: string;
  userIds: string[];
  sessionIds: string[];
}

const TEST_PASSWORD = 'PerfTestP@ss2026!';

/**
 * Seed a single tenant with admin, doctor, and nurse users for performance tests.
 * Lighter than integration helpers — focused on speed.
 */
export async function seedPerfTestData(): Promise<PerfTestContext> {
  const prisma = getPrisma();
  const pw = await bcrypt.hash(TEST_PASSWORD, 10);
  const now = new Date();
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const tenantKey = `perf-test-${Date.now()}`;

  // Create tenant
  const tenantRow = await prisma.tenant.create({
    data: {
      tenantId: tenantKey,
      name: 'Performance Test Hospital',
      status: 'ACTIVE',
      planType: 'ENTERPRISE',
      entitlementSam: true,
      entitlementHealth: true,
      entitlementEdrac: true,
      entitlementCvision: true,
      maxUsers: 100,
      subscriptionEndsAt: oneYearFromNow,
    },
  });

  // Subscription contract
  await prisma.subscriptionContract.create({
    data: {
      tenantId: tenantRow.id,
      status: 'active',
      enabledSam: true,
      enabledTheaHealth: true,
      enabledCvision: true,
      enabledEdrac: true,
      maxUsers: 100,
      currentUsers: 0,
      planType: 'enterprise',
      enabledFeatures: {},
      storageLimit: BigInt(1_000_000_000),
      subscriptionStartsAt: now,
      subscriptionEndsAt: oneYearFromNow,
      gracePeriodEnabled: false,
    },
  });

  const userIds: string[] = [];
  const sessionIds: string[] = [];

  // Helper: create user + session + tenantUser + return token
  async function createUser(
    role: string,
    dbRole: string,
    permissions: string[],
    dept: string,
    deptKey: string,
  ): Promise<string> {
    const userId = uuidv4();
    const email = `${role}.${tenantKey}@perf.thea.local`;
    const sessionId = uuidv4();

    await prisma.user.create({
      data: {
        id: userId,
        email,
        password: pw,
        firstName: role.charAt(0).toUpperCase() + role.slice(1),
        lastName: 'PerfTest',
        role: dbRole as string,
        tenantId: tenantRow.id,
        isActive: true,
        department: dept,
        departmentKey: deptKey,
      },
    });

    await prisma.session.create({
      data: {
        sessionId,
        userId,
        tenantId: tenantRow.id,
        activeTenantId: tenantRow.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: 'PerfTest/1.0',
        ip: '127.0.0.1',
      },
    });

    try {
      await (prisma as Record<string, unknown>).tenantUser.create({
        data: {
          userId,
          tenantId: tenantRow.id,
          role: dbRole as string,
          permissions,
          areas: [deptKey, 'OPD', 'ER', 'IPD', 'ICU', 'ORDERS', 'RESULTS', 'BILLING', 'REGISTRATION', 'NOTIFICATIONS', 'SCHEDULING', 'LAB', 'PHARMACY', 'RADIOLOGY'],
          isActive: true,
        },
      });
    } catch { /* TenantUser may not exist */ }

    userIds.push(userId);
    sessionIds.push(sessionId);

    return generateTestToken(userId, email, role === 'admin' ? 'admin' : 'staff', sessionId, tenantKey);
  }

  const allPerms = [
    'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create', 'opd.visit.edit',
    'opd.doctor.encounter.view', 'opd.doctor.encounter.edit',
    'orders.hub.view', 'orders.hub.create',
    'er.register.create', 'er.triage.edit', 'er.beds.assign',
    'er.encounter.view', 'er.disposition.update',
    'ipd.live-beds.view', 'ipd.live-beds.edit', 'ipd.admin.view', 'ipd.admin.edit',
    'lab.orders.view', 'lab.orders.create', 'lab.specimens.view', 'lab.results.view',
    'pharmacy.dispense.view', 'pharmacy.prescriptions.create', 'pharmacy.dispense.create', 'pharmacy.view',
    'billing.payment.view', 'billing.payment.create', 'billing.invoices.view',
    'admin.users.view', 'admin.users.create', 'admin.users.edit',
    'admin.tenants.view', 'admin.settings.view',
    'scheduling.view',
  ];

  const doctorPerms = [
    'opd.dashboard.view', 'opd.visit.view', 'opd.visit.create', 'opd.visit.edit',
    'opd.doctor.encounter.view', 'opd.doctor.encounter.edit',
    'orders.hub.view', 'orders.hub.create',
    'er.encounter.view', 'er.triage.edit', 'er.disposition.update',
    'ipd.live-beds.view', 'ipd.live-beds.edit',
    'lab.orders.view', 'lab.orders.create', 'lab.results.view',
    'pharmacy.prescriptions.create',
    'billing.invoices.view',
    'scheduling.view',
  ];

  const nursePerms = [
    'opd.dashboard.view', 'opd.visit.view',
    'er.register.create', 'er.triage.edit', 'er.beds.assign', 'er.encounter.view',
    'ipd.live-beds.view', 'ipd.live-beds.edit',
    'lab.specimens.view',
    'pharmacy.dispense.view',
    'scheduling.view',
  ];

  const adminToken = await createUser('admin', 'ADMIN', allPerms, 'Administration', 'ADMIN');
  const doctorToken = await createUser('doctor', 'STAFF', doctorPerms, 'OPD', 'OPD');
  const nurseToken = await createUser('nurse', 'STAFF', nursePerms, 'ER', 'ER');

  return {
    tenantId: tenantRow.id,
    tenantKey,
    adminToken,
    doctorToken,
    nurseToken,
    userIds,
    sessionIds,
  };
}

/**
 * Clean up all performance test data.
 */
export async function cleanupPerfTestData(ctx: PerfTestContext | undefined): Promise<void> {
  if (!ctx?.tenantId) return; // Guard: nothing to clean if seed didn't run
  const prisma = getPrisma();
  const tenantIds = [ctx.tenantId];

  try {
    // Clinical data
    await prisma.opdEncounter.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.encounterCore.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.patientMaster.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // ER / IPD / Lab / Pharmacy / Billing / Orders
    await (prisma as Record<string, unknown>).erBedAssignment?.deleteMany({ where: { encounterId: { not: undefined } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erEncounter?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).erBed?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdMedOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdBedAssignment?.deleteMany({ where: { episodeId: { not: undefined } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdEpisode?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ipdBed?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).labResult?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).labSpecimen?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).labOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).prescription?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).payment?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).invoice?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).ordersHub?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).opdOrder?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).opdVisitNote?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).dischargeFinalization?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).chargeEvent?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).notification?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).auditLog?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as Record<string, unknown>).tenantUser?.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});

    // Sessions + Users
    await prisma.session.deleteMany({ where: { userId: { in: ctx.userIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } }).catch(() => {});

    // Subscription + Tenant
    await prisma.subscriptionContract.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => {});
  } catch (err) {
    console.warn('[perf cleanup] partial failure:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Bulk patient seeding (for DB perf tests)
// ---------------------------------------------------------------------------

/**
 * Create N test patients in bulk for a given tenant. Returns their IDs.
 */
export async function seedBulkPatients(
  tenantId: string,
  count: number,
  batchSize: number = 50,
): Promise<string[]> {
  const prisma = getPrisma();
  const ids: string[] = [];

  for (let batch = 0; batch < count; batch += batchSize) {
    const size = Math.min(batchSize, count - batch);
    const data = Array.from({ length: size }, (_, i) => {
      const idx = batch + i;
      const id = uuidv4();
      ids.push(id);
      return {
        id,
        tenantId,
        firstName: `PerfPatient${idx}`,
        lastName: `Load${Math.floor(idx / 100)}`,
        gender: idx % 2 === 0 ? 'MALE' : 'FEMALE',
        dob: new Date(1960 + (idx % 50), idx % 12, (idx % 28) + 1),
        mobile: `+9665${String(10000000 + idx).padStart(8, '0')}`,
        status: 'KNOWN',
        mrn: `PERF-${String(idx).padStart(6, '0')}`,
      };
    });

    await (prisma.patientMaster as unknown as { createMany: (args: Record<string, unknown>) => Promise<unknown> }).createMany({ data, skipDuplicates: true });
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Server health check
// ---------------------------------------------------------------------------

export async function ensureServerRunning(): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, { method: 'GET' });
    if (res.status >= 500) throw new Error(`Server error: ${res.status}`);
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const cause = e.cause as Record<string, unknown> | undefined;
    if (cause?.code === 'ECONNREFUSED' || (e.message as string)?.includes('fetch failed')) {
      throw new Error(
        `\n\n❌  Performance tests require a running dev server.\n` +
        `   Start it with:  yarn dev\n` +
        `   Then re-run:    yarn test:performance\n\n`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Markdown table helpers
// ---------------------------------------------------------------------------

export const MARKDOWN_TABLE_HEADER = [
  '| Status | Method | Endpoint | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) | SLA (ms) | Errors |',
  '|--------|--------|----------|----------|----------|----------|----------|----------|----------|--------|',
].join('\n');

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
