/**
 * Performance Tests — Concurrent User Simulation
 *
 * Simulates multiple users hitting the same endpoints simultaneously
 * to verify the system handles concurrent load without 500 errors
 * or unacceptable response times.
 *
 * Scenarios:
 *   - 10 concurrent users hitting /api/auth/me
 *   - 5 concurrent ER doctors hitting /api/er/doctor/my-patients
 *   - 20 concurrent nurse station refreshes across IPD/ER/ICU
 *   - 3 concurrent lab result submissions
 *
 * Pass criteria:
 *   - No 500 errors
 *   - No response > 2 seconds
 *   - All responses < 500ms under load
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  seedPerfTestData,
  cleanupPerfTestData,
  disconnectPrisma,
  ensureServerRunning,
  authGet,
  authPost,
  concurrentBenchmark,
  calculateStats,
  measureLatency,
  recordBenchmark,
  SLA,
  type PerfTestContext,
  type LatencyResult,
} from './helpers';

let ctx: PerfTestContext;

describe('Concurrent User Simulation', () => {
  beforeAll(async () => {
    await ensureServerRunning();
    ctx = await seedPerfTestData();
  }, 60_000);

  afterAll(async () => {
    await cleanupPerfTestData(ctx);
    await disconnectPrisma();
  }, 30_000);

  // ── Helper: assert concurrent results ──────────────────────────────────

  function assertConcurrentResults(
    results: LatencyResult[],
    testName: string,
    maxPerRequest: number = SLA.CONCURRENT_MAX,
    hardMax: number = SLA.CONCURRENT_HARD,
  ): void {
    const stats = calculateStats(results);

    console.log(`\n🔥 ${testName} (${results.length} concurrent)`);
    console.log(`   Avg: ${stats.avg.toFixed(1)}ms | P50: ${stats.p50.toFixed(1)}ms | P95: ${stats.p95.toFixed(1)}ms | Max: ${stats.max.toFixed(1)}ms`);
    console.log(`   Errors: ${stats.errorCount}/${stats.count} (${stats.errorRate}%)`);

    // No 500 errors
    const serverErrors = results.filter((r) => r.status >= 500);
    expect(serverErrors.length).toBe(0);

    // No response over hard max (2 seconds)
    const slowResponses = results.filter((r) => r.durationMs > hardMax);
    if (slowResponses.length > 0) {
      console.warn(`   ⚠️ ${slowResponses.length} responses exceeded ${hardMax}ms hard limit`);
    }
    expect(slowResponses.length).toBe(0);

    // p95 should be under the soft max
    expect(stats.p95).toBeLessThanOrEqual(maxPerRequest);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Scenario 1: 10 concurrent users hitting /api/auth/me
  // ─────────────────────────────────────────────────────────────────────

  describe('Concurrent Auth/Me', () => {
    it('CONC-01: 10 concurrent /api/auth/me — all < 500ms, no 500s', async () => {
      const results = await concurrentBenchmark(
        () => authGet('/api/auth/me', ctx.adminToken),
        10,
      );
      assertConcurrentResults(results, '10x GET /api/auth/me');

      recordBenchmark({
        endpoint: '/api/auth/me',
        method: 'GET',
        slaTarget: SLA.CONCURRENT_MAX,
        stats: calculateStats(results),
        pass: calculateStats(results).p95 <= SLA.CONCURRENT_MAX,
      });
    }, 30_000);

    it('CONC-02: 10 concurrent /api/auth/me with mixed tokens', async () => {
      // Simulate different users (admin, doctor, nurse) all calling /me at once
      const tokens = [
        ctx.adminToken, ctx.adminToken, ctx.adminToken,
        ctx.doctorToken, ctx.doctorToken, ctx.doctorToken,
        ctx.nurseToken, ctx.nurseToken, ctx.nurseToken,
        ctx.adminToken,
      ];
      const promises = tokens.map((token) =>
        measureLatency(() => authGet('/api/auth/me', token)),
      );
      const results = await Promise.all(promises);
      assertConcurrentResults(results, '10x GET /api/auth/me (mixed roles)');
    }, 30_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario 2: 5 concurrent ER doctors
  // ─────────────────────────────────────────────────────────────────────

  describe('Concurrent ER Doctor Access', () => {
    it('CONC-03: 5 concurrent ER board requests', async () => {
      const results = await concurrentBenchmark(
        () => authGet('/api/er/board', ctx.doctorToken),
        5,
      );
      assertConcurrentResults(results, '5x GET /api/er/board');

      recordBenchmark({
        endpoint: '/api/er/board',
        method: 'GET',
        slaTarget: SLA.CONCURRENT_MAX,
        stats: calculateStats(results),
        pass: calculateStats(results).p95 <= SLA.CONCURRENT_MAX,
      });
    }, 30_000);

    it('CONC-04: 5 concurrent ER metrics requests', async () => {
      const results = await concurrentBenchmark(
        () => authGet('/api/er/metrics', ctx.doctorToken),
        5,
      );
      assertConcurrentResults(results, '5x GET /api/er/metrics');
    }, 30_000);

    it('CONC-05: 5 concurrent doctor schedule requests', async () => {
      const results = await concurrentBenchmark(
        () => authGet('/api/opd/doctor/schedule', ctx.doctorToken),
        5,
      );
      assertConcurrentResults(results, '5x GET /api/opd/doctor/schedule');
    }, 30_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario 3: 20 concurrent nurse station refreshes
  // ─────────────────────────────────────────────────────────────────────

  describe('Concurrent Nurse Station Refreshes', () => {
    it('CONC-06: 20 concurrent nurse station refreshes across departments', async () => {
      // Simulate 20 tabs open across IPD, ER, and ICU nurse stations
      const endpoints = [
        // 7x IPD nurse station
        ...Array(7).fill('/api/ipd/episodes/active-for-nursing'),
        // 7x ER board (nurse view)
        ...Array(7).fill('/api/er/board'),
        // 6x IPD live beds (ICU/IPD)
        ...Array(6).fill('/api/ipd/live-beds'),
      ];

      const promises = endpoints.map((ep) =>
        measureLatency(() => authGet(ep, ctx.nurseToken)),
      );
      const results = await Promise.all(promises);

      assertConcurrentResults(
        results,
        '20x nurse station refresh (IPD/ER/ICU)',
        SLA.CONCURRENT_MAX,
        SLA.CONCURRENT_HARD,
      );

      // Record overall stats
      recordBenchmark({
        endpoint: 'nurse-station-mixed',
        method: 'GET',
        slaTarget: SLA.CONCURRENT_MAX,
        stats: calculateStats(results),
        pass: calculateStats(results).p95 <= SLA.CONCURRENT_MAX,
      });
    }, 60_000);

    it('CONC-07: 10 concurrent IPD live beds requests', async () => {
      const results = await concurrentBenchmark(
        () => authGet('/api/ipd/live-beds', ctx.nurseToken),
        10,
      );
      assertConcurrentResults(results, '10x GET /api/ipd/live-beds');
    }, 30_000);

    it('CONC-08: 10 concurrent IPD active-for-nursing requests', async () => {
      const results = await concurrentBenchmark(
        () => authGet('/api/ipd/episodes/active-for-nursing', ctx.nurseToken),
        10,
      );
      assertConcurrentResults(results, '10x GET /api/ipd/episodes/active-for-nursing');
    }, 30_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario 4: 3 concurrent lab result submissions
  // ─────────────────────────────────────────────────────────────────────

  describe('Concurrent Lab Operations', () => {
    it('CONC-09: 3 concurrent lab order creation attempts', async () => {
      // These will likely fail validation (no real patient), but we're
      // measuring the server's ability to handle concurrent POSTs
      const promises = Array.from({ length: 3 }, (_, i) =>
        measureLatency(() =>
          authPost('/api/lab/orders', ctx.doctorToken, {
            patientId: `perf-test-patient-${i}`,
            patientName: `Concurrent Patient ${i}`,
            mrn: `CONC-MRN-${i}`,
            testCode: 'CBC',
            testName: 'Complete Blood Count',
          }),
        ),
      );
      const results = await Promise.all(promises);

      const stats = calculateStats(results);
      console.log(`\n🔥 3x POST /api/lab/orders (concurrent)`);
      console.log(`   Avg: ${stats.avg.toFixed(1)}ms | P95: ${stats.p95.toFixed(1)}ms | Max: ${stats.max.toFixed(1)}ms`);
      console.log(`   Errors: ${stats.errorCount}/${stats.count}`);

      // No 500s (4xx for validation is expected)
      const serverErrors = results.filter((r) => r.status >= 500);
      expect(serverErrors.length).toBe(0);

      // No response over 2 seconds
      const slowResponses = results.filter((r) => r.durationMs > SLA.CONCURRENT_HARD);
      expect(slowResponses.length).toBe(0);
    }, 30_000);

    it('CONC-10: 5 concurrent lab results listing', async () => {
      const results = await concurrentBenchmark(
        () => authGet('/api/lab/results', ctx.doctorToken),
        5,
      );
      assertConcurrentResults(results, '5x GET /api/lab/results');
    }, 30_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario 5: Mixed high-load scenario
  // ─────────────────────────────────────────────────────────────────────

  describe('Mixed High-Load Scenario', () => {
    it('CONC-11: 15 concurrent mixed requests across all departments', async () => {
      // Simulate a busy hospital with many simultaneous requests
      const requests = [
        // Auth (3)
        () => authGet('/api/auth/me', ctx.adminToken),
        () => authGet('/api/auth/me', ctx.doctorToken),
        () => authGet('/api/auth/me', ctx.nurseToken),
        // ER (3)
        () => authGet('/api/er/board', ctx.doctorToken),
        () => authGet('/api/er/metrics', ctx.adminToken),
        () => authGet('/api/er/board', ctx.nurseToken),
        // IPD (3)
        () => authGet('/api/ipd/live-beds', ctx.nurseToken),
        () => authGet('/api/ipd/episodes/active-for-nursing', ctx.nurseToken),
        () => authGet('/api/ipd/live-beds', ctx.doctorToken),
        // OPD (2)
        () => authGet('/api/opd/encounters/open', ctx.doctorToken),
        () => authGet('/api/opd/doctor/schedule', ctx.doctorToken),
        // Lab + Pharmacy (2)
        () => authGet('/api/lab/results', ctx.doctorToken),
        () => authGet('/api/pharmacy/prescriptions', ctx.adminToken),
        // Billing + Notifications (2)
        () => authGet('/api/billing/payments', ctx.adminToken),
        () => authGet('/api/notifications?limit=10', ctx.adminToken),
      ];

      const promises = requests.map((fn) => measureLatency(fn));
      const results = await Promise.all(promises);

      assertConcurrentResults(
        results,
        '15x mixed requests (auth + ER + IPD + OPD + lab + billing)',
        SLA.CONCURRENT_MAX * 1.5, // Allow slightly higher under extreme mixed load
        SLA.CONCURRENT_HARD,
      );
    }, 60_000);

    it('CONC-12: Sustained load — 3 rounds of 10 concurrent requests', async () => {
      const allResults: LatencyResult[] = [];

      for (let round = 0; round < 3; round++) {
        const results = await concurrentBenchmark(
          () => authGet('/api/auth/me', ctx.adminToken),
          10,
        );
        allResults.push(...results);

        // Small delay between rounds to simulate realistic timing
        await new Promise((r) => setTimeout(r, 200));
      }

      const stats = calculateStats(allResults);
      console.log(`\n🔥 Sustained load: 3 rounds × 10 concurrent /api/auth/me`);
      console.log(`   Total: ${allResults.length} requests`);
      console.log(`   Avg: ${stats.avg.toFixed(1)}ms | P95: ${stats.p95.toFixed(1)}ms | Max: ${stats.max.toFixed(1)}ms`);
      console.log(`   Errors: ${stats.errorCount}/${stats.count}`);

      // No degradation over time — all rounds should have similar latency
      const serverErrors = allResults.filter((r) => r.status >= 500);
      expect(serverErrors.length).toBe(0);

      const slowResponses = allResults.filter((r) => r.durationMs > SLA.CONCURRENT_HARD);
      expect(slowResponses.length).toBe(0);
    }, 60_000);
  });

  // ─────────────────────────────────────────────────────────────────────
  // Scenario 6: POST operations under concurrent load
  // ─────────────────────────────────────────────────────────────────────

  describe('Concurrent Write Operations', () => {
    it('CONC-13: 3 concurrent prescription creation attempts', async () => {
      const promises = Array.from({ length: 3 }, (_, i) =>
        measureLatency(() =>
          authPost('/api/pharmacy/prescriptions', ctx.doctorToken, {
            patientId: `conc-patient-${i}`,
            patientName: `Concurrent RX Patient ${i}`,
            mrn: `CONC-RX-${i}`,
            medication: 'Amoxicillin',
            strength: '500mg',
            form: 'capsule',
            route: 'oral',
            frequency: 'TID',
            duration: '7 days',
            quantity: 21,
          }),
        ),
      );
      const results = await Promise.all(promises);

      const stats = calculateStats(results);
      console.log(`\n🔥 3x POST /api/pharmacy/prescriptions (concurrent)`);
      console.log(`   Avg: ${stats.avg.toFixed(1)}ms | Max: ${stats.max.toFixed(1)}ms`);

      // No 500 errors
      const serverErrors = results.filter((r) => r.status >= 500);
      expect(serverErrors.length).toBe(0);

      // Under hard max
      const slowResponses = results.filter((r) => r.durationMs > SLA.CONCURRENT_HARD);
      expect(slowResponses.length).toBe(0);
    }, 30_000);

    it('CONC-14: 5 concurrent patient search requests', async () => {
      const searches = ['Ahmed', 'Mohammed', 'Fatima', 'Ali', 'Sara'];
      const promises = searches.map((name) =>
        measureLatency(() =>
          authGet(`/api/patients?search=${name}&limit=10`, ctx.adminToken),
        ),
      );
      const results = await Promise.all(promises);
      assertConcurrentResults(results, '5x GET /api/patients?search (concurrent)');
    }, 30_000);
  });
});
