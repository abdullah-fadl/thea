/**
 * Performance Tests — API Response Times
 *
 * Measures response times for critical API endpoints against SLA targets.
 * Each endpoint is called 50 times; the test fails if p95 exceeds the SLA.
 *
 * SLA Targets:
 *   - GET endpoints:          < 200ms
 *   - POST endpoints:         < 500ms
 *   - Search/list endpoints:  < 300ms
 *   - Real-time dashboards:   < 250ms
 *
 * Prerequisites:
 *   - Running dev server: `yarn dev`
 *   - Seeded database with at least one tenant
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  seedPerfTestData,
  cleanupPerfTestData,
  disconnectPrisma,
  ensureServerRunning,
  authGet,
  authPost,
  benchmarkEndpoint,
  calculateStats,
  statsToMarkdownRow,
  recordBenchmark,
  SLA,
  MARKDOWN_TABLE_HEADER,
  BASE_URL,
  type PerfTestContext,
  type LatencyStats,
} from './helpers';

let ctx: PerfTestContext;

// ---------------------------------------------------------------------------
// Endpoint definitions
// ---------------------------------------------------------------------------

interface EndpointDef {
  name: string;
  method: 'GET' | 'POST';
  path: string | (() => string);
  body?: Record<string, unknown>;
  tokenKey: 'adminToken' | 'doctorToken' | 'nurseToken';
  sla: number;
  iterations: number;
  description: string;
}

const ENDPOINTS: EndpointDef[] = [
  // ── Auth ──────────────────────────────────────────────────────────────
  {
    name: 'GET /api/auth/me',
    method: 'GET',
    path: '/api/auth/me',
    tokenKey: 'adminToken',
    sla: SLA.GET_FAST,
    iterations: 50,
    description: 'Called on every page load — must be fast',
  },
  {
    name: 'POST /api/auth/login',
    method: 'POST',
    path: '/api/auth/login',
    body: { email: 'nonexistent@test.local', password: 'wrong' },
    tokenKey: 'adminToken',
    sla: SLA.POST_AUTH,
    iterations: 50,
    description: 'Login speed (invalid creds — avoids side effects)',
  },

  // ── ER (real-time, refreshes every 5s) ────────────────────────────────
  {
    name: 'GET /api/er/board',
    method: 'GET',
    path: '/api/er/board',
    tokenKey: 'doctorToken',
    sla: SLA.GET_REALTIME,
    iterations: 50,
    description: 'ER board — refreshes every 5 seconds',
  },

  // ── OPD Doctor Station ────────────────────────────────────────────────
  {
    name: 'GET /api/opd/doctor/schedule',
    method: 'GET',
    path: '/api/opd/doctor/schedule',
    tokenKey: 'doctorToken',
    sla: SLA.GET_REALTIME,
    iterations: 50,
    description: 'Doctor station visits — refreshes every 15 seconds',
  },

  // ── IPD Nurse Station ─────────────────────────────────────────────────
  {
    name: 'GET /api/ipd/episodes/active-for-nursing',
    method: 'GET',
    path: '/api/ipd/episodes/active-for-nursing',
    tokenKey: 'nurseToken',
    sla: SLA.GET_REALTIME,
    iterations: 50,
    description: 'IPD nurse station — active episode refresh',
  },

  // ── IPD Live Beds ─────────────────────────────────────────────────────
  {
    name: 'GET /api/ipd/live-beds',
    method: 'GET',
    path: '/api/ipd/live-beds',
    tokenKey: 'doctorToken',
    sla: SLA.GET_REALTIME,
    iterations: 50,
    description: 'Real-time bed map',
  },

  // ── Scheduling ────────────────────────────────────────────────────────
  {
    name: 'GET /api/scheduling/slots',
    method: 'GET',
    path: '/api/scheduling/slots?resourceId=none&date=2026-03-04',
    tokenKey: 'adminToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'Appointment booking slot lookup',
  },

  // ── Lab Results ───────────────────────────────────────────────────────
  {
    name: 'GET /api/lab/results',
    method: 'GET',
    path: '/api/lab/results',
    tokenKey: 'doctorToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'Lab results listing',
  },

  // ── Notifications ─────────────────────────────────────────────────────
  {
    name: 'GET /api/notifications',
    method: 'GET',
    path: '/api/notifications?limit=20',
    tokenKey: 'adminToken',
    sla: SLA.GET_FAST,
    iterations: 50,
    description: 'Notification polling — frequent background fetch',
  },

  // ── Orders ────────────────────────────────────────────────────────────
  {
    name: 'POST /api/orders (validation)',
    method: 'POST',
    path: '/api/orders',
    body: {
      encounterCoreId: 'nonexistent-encounter',
      kind: 'LAB',
      priority: 'ROUTINE',
      items: [{ testCode: 'CBC', testName: 'Complete Blood Count' }],
    },
    tokenKey: 'doctorToken',
    sla: SLA.POST_FAST,
    iterations: 50,
    description: 'Order creation — validation path (no real encounter)',
  },

  // ── Additional hot paths ──────────────────────────────────────────────
  {
    name: 'GET /api/opd/encounters/open',
    method: 'GET',
    path: '/api/opd/encounters/open',
    tokenKey: 'doctorToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'Open OPD encounters listing',
  },
  {
    name: 'GET /api/er/metrics',
    method: 'GET',
    path: '/api/er/metrics',
    tokenKey: 'adminToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'ER metrics dashboard KPIs',
  },
  {
    name: 'GET /api/pharmacy/prescriptions',
    method: 'GET',
    path: '/api/pharmacy/prescriptions',
    tokenKey: 'adminToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'Pharmacy prescriptions queue',
  },
  {
    name: 'GET /api/billing/payments',
    method: 'GET',
    path: '/api/billing/payments',
    tokenKey: 'adminToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'Billing payments listing',
  },
  {
    name: 'GET /api/patients',
    method: 'GET',
    path: '/api/patients?limit=20',
    tokenKey: 'adminToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'Patient listing with pagination',
  },
  {
    name: 'GET /api/admin/users',
    method: 'GET',
    path: '/api/admin/users',
    tokenKey: 'adminToken',
    sla: SLA.GET_LIST,
    iterations: 50,
    description: 'Admin user management listing',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Response Times', () => {
  beforeAll(async () => {
    await ensureServerRunning();
    ctx = await seedPerfTestData();
  }, 60_000);

  afterAll(async () => {
    await cleanupPerfTestData(ctx);
    await disconnectPrisma();
  }, 30_000);

  // Generate a test for each endpoint
  for (const ep of ENDPOINTS) {
    it(
      `PERF-RT: ${ep.name} — p95 < ${ep.sla}ms (${ep.description})`,
      async () => {
        const token = ctx[ep.tokenKey];
        const path = typeof ep.path === 'function' ? ep.path() : ep.path;

        const results = await benchmarkEndpoint(
          () =>
            ep.method === 'GET'
              ? authGet(path, token)
              : authPost(path, token, ep.body || {}),
          ep.iterations,
          3, // warmup rounds
        );

        const stats = calculateStats(results);

        // Record for report generator
        recordBenchmark({
          endpoint: path,
          method: ep.method,
          slaTarget: ep.sla,
          stats,
          pass: stats.p95 <= ep.sla,
        });

        // Log detailed results
        console.log(`\n📊 ${ep.name}`);
        console.log(`   Avg: ${stats.avg.toFixed(1)}ms | P50: ${stats.p50.toFixed(1)}ms | P95: ${stats.p95.toFixed(1)}ms | P99: ${stats.p99.toFixed(1)}ms | Max: ${stats.max.toFixed(1)}ms`);
        console.log(`   SLA: ${ep.sla}ms | ${stats.p95 <= ep.sla ? '✅ PASS' : '❌ FAIL'} | Errors: ${stats.errorCount}/${stats.count}`);

        // Assert: p95 must be under SLA
        expect(stats.p95).toBeLessThanOrEqual(ep.sla);

        // Assert: no server errors (5xx)
        expect(stats.errorRate).toBeLessThan(5); // Allow < 5% transient errors
      },
      120_000, // 2 min timeout per endpoint benchmark
    );
  }

  // ── Summary table ──────────────────────────────────────────────────────

  it('PERF-SUMMARY: Print markdown results table', async () => {
    // This test always passes — it's just for output
    const allResults = ENDPOINTS.map((ep) => {
      const path = typeof ep.path === 'function' ? ep.path() : ep.path;
      const token = ctx[ep.tokenKey];
      return { ep, path };
    });

    console.log('\n\n# API Response Time Results\n');
    console.log(MARKDOWN_TABLE_HEADER);
    // Results are logged per-test above; this is a placeholder for the report generator
    console.log('\n(See individual test output above for detailed results)\n');

    expect(true).toBe(true);
  });
});
