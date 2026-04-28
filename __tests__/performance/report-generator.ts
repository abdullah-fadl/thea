#!/usr/bin/env tsx
/**
 * Performance Report Generator
 *
 * Runs all performance tests and generates a consolidated markdown report
 * at `test-results/performance-report.md`.
 *
 * Usage:
 *   yarn test:perf:report
 *
 * The report includes:
 *   - Summary table of all endpoints with response times
 *   - Pass/fail against SLA targets
 *   - Recommendations for failing endpoints
 *   - Timestamp and environment info
 *
 * Prerequisites:
 *   - Running dev server: `yarn dev`
 *   - Seeded database
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'test-results');
const REPORT_PATH = path.join(OUTPUT_DIR, 'performance-report.md');
const JSON_RESULTS_PATH = path.join(OUTPUT_DIR, 'performance-results.json');

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface TestSuiteResult {
  suiteName: string;
  tests: TestResult[];
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

interface ParsedPerfResult {
  endpoint: string;
  method: string;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  sla: number;
  errors: string;
  pass: boolean;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🚀 Thea EHR — Performance Report Generator\n');
  console.log(`   Date: ${new Date().toISOString()}`);
  console.log(`   Node: ${process.version}`);
  console.log(`   Platform: ${os.platform()} ${os.arch()}`);
  console.log(`   CPUs: ${os.cpus().length}`);
  console.log(`   Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // ── Run all performance test suites ────────────────────────────────

  const suites: { name: string; pattern: string }[] = [
    { name: 'API Response Times', pattern: '__tests__/performance/api-response-times.test.ts' },
    { name: 'Concurrent Users', pattern: '__tests__/performance/concurrent-users.test.ts' },
    { name: 'Database Queries', pattern: '__tests__/performance/database-queries.test.ts' },
    { name: 'SSE Real-Time', pattern: '__tests__/performance/realtime-sse.test.ts' },
  ];

  const suiteResults: TestSuiteResult[] = [];
  const allOutput: string[] = [];

  for (const suite of suites) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`▶ Running: ${suite.name}`);
    console.log(`${'─'.repeat(60)}\n`);

    const startTime = Date.now();
    let output = '';
    let exitCode = 0;

    try {
      output = execSync(
        `npx vitest run --config vitest.performance.config.ts ${suite.pattern} 2>&1`,
        {
          cwd: PROJECT_ROOT,
          encoding: 'utf-8',
          timeout: 600_000, // 10 minutes per suite
          env: {
            ...process.env,
            FORCE_COLOR: '0', // Disable ANSI colors for parsing
          },
        },
      );
    } catch (err: any) {
      output = err.stdout || err.message || '';
      exitCode = err.status || 1;
    }

    const duration = Date.now() - startTime;
    allOutput.push(output);

    // Parse test results from output
    const tests = parseTestResults(output);
    const passed = tests.filter((t) => t.status === 'pass').length;
    const failed = tests.filter((t) => t.status === 'fail').length;
    const skipped = tests.filter((t) => t.status === 'skip').length;

    suiteResults.push({
      suiteName: suite.name,
      tests,
      duration,
      passed,
      failed,
      skipped,
    });

    console.log(output);
    console.log(`\n   ${suite.name}: ${passed} passed, ${failed} failed, ${skipped} skipped (${(duration / 1000).toFixed(1)}s)`);
  }

  // ── Parse performance metrics from output ──────────────────────────

  const perfResults = parsePerformanceMetrics(allOutput.join('\n'));

  // ── Generate Markdown Report ───────────────────────────────────────

  const report = generateMarkdownReport(suiteResults, perfResults);
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log(`\n\n✅ Performance report saved to: ${REPORT_PATH}`);

  // ── Save raw JSON results ──────────────────────────────────────────

  const jsonResults = {
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      cpus: os.cpus().length,
      memory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
    },
    suites: suiteResults,
    metrics: perfResults,
  };
  fs.writeFileSync(JSON_RESULTS_PATH, JSON.stringify(jsonResults, null, 2), 'utf-8');
  console.log(`   JSON results saved to: ${JSON_RESULTS_PATH}`);

  // ── Print summary ──────────────────────────────────────────────────

  const totalPassed = suiteResults.reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = suiteResults.reduce((sum, s) => sum + s.failed, 0);
  const totalDuration = suiteResults.reduce((sum, s) => sum + s.duration, 0);

  console.log('\n\n' + '═'.repeat(60));
  console.log('  PERFORMANCE TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Total: ${totalPassed + totalFailed} tests`);
  console.log(`  ✅ Passed: ${totalPassed}`);
  console.log(`  ❌ Failed: ${totalFailed}`);
  console.log(`  ⏱  Duration: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log('═'.repeat(60) + '\n');

  // Exit with failure if any tests failed
  if (totalFailed > 0) {
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Output parsing helpers
// ---------------------------------------------------------------------------

function parseTestResults(output: string): TestResult[] {
  const results: TestResult[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Match vitest output: "✓ test name (Xms)" or "× test name"
    const passMatch = line.match(/[✓✔]\s+(.+?)\s+\((\d+)\s*ms\)/);
    const failMatch = line.match(/[×✗❌]\s+(.+)/);
    const skipMatch = line.match(/[↓⇣-]\s+(.+)/);

    if (passMatch) {
      results.push({
        name: passMatch[1].trim(),
        status: 'pass',
        duration: parseInt(passMatch[2], 10),
      });
    } else if (failMatch) {
      results.push({
        name: failMatch[1].trim(),
        status: 'fail',
        duration: 0,
      });
    } else if (skipMatch) {
      results.push({
        name: skipMatch[1].trim(),
        status: 'skip',
        duration: 0,
      });
    }
  }

  return results;
}

function parsePerformanceMetrics(output: string): ParsedPerfResult[] {
  const results: ParsedPerfResult[] = [];
  const lines = output.split('\n');

  // Match lines like: "📊 GET /api/auth/me"
  // Followed by: "   Avg: 45.2ms | P50: 40.1ms | P95: 78.3ms | P99: 102.5ms | Max: 115.0ms"
  // Followed by: "   SLA: 200ms | ✅ PASS | Errors: 0/50"
  for (let i = 0; i < lines.length; i++) {
    const metricHeader = lines[i].match(/📊\s+(.+)/);
    if (metricHeader && i + 2 < lines.length) {
      const statLine = lines[i + 1];
      const slaLine = lines[i + 2];

      const statMatch = statLine.match(
        /Avg:\s*([\d.]+)ms\s*\|\s*P50:\s*([\d.]+)ms\s*\|\s*P95:\s*([\d.]+)ms\s*\|\s*P99:\s*([\d.]+)ms\s*\|\s*Max:\s*([\d.]+)ms/,
      );
      const slaMatch = slaLine.match(
        /SLA:\s*(\d+)ms\s*\|\s*(✅ PASS|❌ FAIL)\s*\|\s*Errors:\s*(\d+\/\d+)/,
      );

      if (statMatch) {
        const name = metricHeader[1].trim();
        // Extract method from name (e.g., "GET /api/auth/me" → method="GET", endpoint="/api/auth/me")
        const methodMatch = name.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)/);
        const method = methodMatch ? methodMatch[1] : 'GET';
        const endpoint = methodMatch ? methodMatch[2] : name;

        results.push({
          endpoint,
          method,
          avg: parseFloat(statMatch[1]),
          p50: parseFloat(statMatch[2]),
          p95: parseFloat(statMatch[3]),
          p99: parseFloat(statMatch[4]),
          max: parseFloat(statMatch[5]),
          sla: slaMatch ? parseInt(slaMatch[1], 10) : 0,
          errors: slaMatch ? slaMatch[3] : '0/0',
          pass: slaMatch ? slaMatch[2].includes('PASS') : true,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Markdown report generation
// ---------------------------------------------------------------------------

function generateMarkdownReport(
  suiteResults: TestSuiteResult[],
  perfResults: ParsedPerfResult[],
): string {
  const now = new Date();
  const totalPassed = suiteResults.reduce((sum, s) => sum + s.passed, 0);
  const totalFailed = suiteResults.reduce((sum, s) => sum + s.failed, 0);
  const totalSkipped = suiteResults.reduce((sum, s) => sum + s.skipped, 0);
  const totalDuration = suiteResults.reduce((sum, s) => sum + s.duration, 0);

  const lines: string[] = [];

  // Header
  lines.push('# Thea EHR — Performance Test Report');
  lines.push('');
  lines.push(`**Generated:** ${now.toISOString()}`);
  lines.push(`**Node.js:** ${process.version}`);
  lines.push(`**Platform:** ${os.platform()} ${os.arch()}`);
  lines.push(`**CPUs:** ${os.cpus().length}`);
  lines.push(`**Memory:** ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
  lines.push('');

  // Overall summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Tests | ${totalPassed + totalFailed + totalSkipped} |`);
  lines.push(`| ✅ Passed | ${totalPassed} |`);
  lines.push(`| ❌ Failed | ${totalFailed} |`);
  lines.push(`| ⏭ Skipped | ${totalSkipped} |`);
  lines.push(`| Duration | ${(totalDuration / 1000).toFixed(1)}s |`);
  lines.push(`| Overall | ${totalFailed === 0 ? '✅ ALL PASS' : '❌ FAILURES DETECTED'} |`);
  lines.push('');

  // Suite breakdown
  lines.push('## Test Suite Results');
  lines.push('');
  lines.push('| Suite | Passed | Failed | Skipped | Duration |');
  lines.push('|-------|--------|--------|---------|----------|');
  for (const suite of suiteResults) {
    const status = suite.failed === 0 ? '✅' : '❌';
    lines.push(
      `| ${status} ${suite.suiteName} | ${suite.passed} | ${suite.failed} | ${suite.skipped} | ${(suite.duration / 1000).toFixed(1)}s |`,
    );
  }
  lines.push('');

  // Response time results
  if (perfResults.length > 0) {
    lines.push('## API Response Times');
    lines.push('');
    lines.push('| Status | Method | Endpoint | Avg (ms) | P50 (ms) | P95 (ms) | P99 (ms) | Max (ms) | SLA (ms) | Errors |');
    lines.push('|--------|--------|----------|----------|----------|----------|----------|----------|----------|--------|');

    // Sort: failures first, then by p95 descending
    const sorted = [...perfResults].sort((a, b) => {
      if (a.pass !== b.pass) return a.pass ? 1 : -1;
      return b.p95 - a.p95;
    });

    for (const r of sorted) {
      const status = r.pass ? '✅' : '❌';
      lines.push(
        `| ${status} | \`${r.method}\` | \`${r.endpoint}\` | ${r.avg.toFixed(0)} | ${r.p50.toFixed(0)} | ${r.p95.toFixed(0)} | ${r.p99.toFixed(0)} | ${r.max.toFixed(0)} | ${r.sla} | ${r.errors} |`,
      );
    }
    lines.push('');
  }

  // SLA compliance
  lines.push('## SLA Compliance');
  lines.push('');
  lines.push('| Target | Threshold | Status |');
  lines.push('|--------|-----------|--------|');
  lines.push(`| Fast GETs (auth, notifications) | < 200ms (p95) | ${checkSLA(perfResults, 200)} |`);
  lines.push(`| Real-time dashboards (ER board, live beds) | < 250ms (p95) | ${checkSLA(perfResults, 250)} |`);
  lines.push(`| List/search endpoints | < 300ms (p95) | ${checkSLA(perfResults, 300)} |`);
  lines.push(`| POST operations | < 500ms (p95) | ${checkSLA(perfResults, 500)} |`);
  lines.push(`| Concurrent load (p95) | < 500ms | ${totalFailed === 0 ? '✅ Pass' : '⚠️ Check failures'} |`);
  lines.push(`| No 500 errors under load | 0% error rate | ${totalFailed === 0 ? '✅ Pass' : '⚠️ Check failures'} |`);
  lines.push('');

  // Recommendations
  const failingEndpoints = perfResults.filter((r) => !r.pass);
  if (failingEndpoints.length > 0) {
    lines.push('## ⚠️ Recommendations');
    lines.push('');
    lines.push('The following endpoints **exceeded their SLA targets** and may need optimization:');
    lines.push('');

    for (const ep of failingEndpoints) {
      lines.push(`### \`${ep.method} ${ep.endpoint}\``);
      lines.push(`- **P95:** ${ep.p95.toFixed(0)}ms (SLA: ${ep.sla}ms) — **${((ep.p95 / ep.sla - 1) * 100).toFixed(0)}% over target**`);
      lines.push(`- **Possible causes:**`);

      if (ep.p95 > 1000) {
        lines.push(`  - Missing database index on frequently-queried columns`);
        lines.push(`  - N+1 query pattern (multiple sequential DB calls)`);
        lines.push(`  - Large result sets without proper LIMIT/pagination`);
      } else if (ep.p95 > 500) {
        lines.push(`  - Unoptimized JOIN or subquery`);
        lines.push(`  - Missing composite index for tenant + filter columns`);
        lines.push(`  - Response serialization overhead for large payloads`);
      } else {
        lines.push(`  - Slight overhead — may improve with connection pooling tuning`);
        lines.push(`  - Cold-start latency from serverless/edge functions`);
      }
      lines.push(`- **Suggested fixes:**`);
      lines.push(`  - Add \`EXPLAIN ANALYZE\` to identify slow query plans`);
      lines.push(`  - Ensure composite index on \`(tenantId, <filter_column>)\``);
      lines.push(`  - Consider Redis caching for frequently-accessed read-only data`);
      lines.push('');
    }
  } else {
    lines.push('## ✅ All Endpoints Within SLA');
    lines.push('');
    lines.push('All measured endpoints meet their performance targets. No immediate optimization needed.');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Report generated by Thea EHR Performance Test Suite*');
  lines.push('');

  return lines.join('\n');
}

function checkSLA(results: ParsedPerfResult[], threshold: number): string {
  const relevant = results.filter((r) => r.sla <= threshold);
  const passing = relevant.filter((r) => r.pass);
  if (relevant.length === 0) return '—';
  return passing.length === relevant.length
    ? `✅ ${passing.length}/${relevant.length} pass`
    : `❌ ${relevant.length - passing.length}/${relevant.length} fail`;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  console.error('❌ Report generation failed:', err);
  process.exit(1);
});
