/**
 * Reporter — Generates console output + markdown report from metrics.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SimulationMetrics } from './metrics';

export class Reporter {
  /** Print summary to console */
  printConsole(metrics: SimulationMetrics): void {
    const { summary } = metrics;
    const hr = '─'.repeat(60);

    console.log(`\n${hr}`);
    console.log('  THEA HOSPITAL SIMULATOR — RESULTS');
    console.log(hr);
    console.log(`  Duration: ${(metrics.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`  Scenarios: ${summary.passedScenarios}/${summary.totalScenarios} passed`);
    console.log(`  API Calls: ${summary.totalApiCalls} total, ${summary.failedCalls} failed`);
    console.log(`  Response Time: avg ${summary.avgResponseMs}ms, p95 ${summary.p95ResponseMs}ms, p99 ${summary.p99ResponseMs}ms`);
    console.log(hr);

    // Failed scenarios
    const failed = metrics.scenarios.filter((s) => !s.passed);
    if (failed.length > 0) {
      console.log('\n  FAILED SCENARIOS:');
      for (const s of failed) {
        console.log(`    ✗ ${s.module}/${s.name}`);
        if (s.error) console.log(`      → ${s.error}`);
        const failedSteps = s.steps.filter((st) => !st.passed);
        for (const st of failedSteps) {
          console.log(`      step: ${st.name} → ${st.error}`);
        }
      }
    }

    // Passed scenarios
    const passed = metrics.scenarios.filter((s) => s.passed);
    if (passed.length > 0) {
      console.log('\n  PASSED SCENARIOS:');
      for (const s of passed) {
        console.log(`    ✓ ${s.module}/${s.name} (${(s.durationMs / 1000).toFixed(1)}s)`);
      }
    }

    // Slowest endpoints
    const slowest = [...metrics.endpointMetrics].sort((a, b) => b.p95Ms - a.p95Ms).slice(0, 10);
    if (slowest.length > 0) {
      console.log('\n  SLOWEST ENDPOINTS (p95):');
      for (const e of slowest) {
        console.log(`    ${e.method.padEnd(6)} ${e.endpoint.padEnd(50)} ${e.p95Ms}ms (×${e.count})`);
      }
    }

    // Failed endpoints
    const failedEndpoints = metrics.endpointMetrics.filter((e) => e.failCount > 0);
    if (failedEndpoints.length > 0) {
      console.log('\n  ENDPOINTS WITH FAILURES:');
      for (const e of failedEndpoints) {
        console.log(`    ${e.method.padEnd(6)} ${e.endpoint.padEnd(50)} ${e.failCount}/${e.count} failed`);
      }
    }

    console.log(`\n${hr}\n`);
  }

  /** Generate markdown report file */
  writeMarkdown(metrics: SimulationMetrics, outDir: string): string {
    const { summary } = metrics;
    const lines: string[] = [];

    lines.push('# Thea Hospital Simulator Report');
    lines.push('');
    lines.push(`**Date**: ${metrics.startTime.toISOString()}`);
    lines.push(`**Duration**: ${(metrics.totalDurationMs / 1000).toFixed(1)}s`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Scenarios Passed | ${summary.passedScenarios}/${summary.totalScenarios} |`);
    lines.push(`| Scenarios Failed | ${summary.failedScenarios} |`);
    lines.push(`| Total API Calls | ${summary.totalApiCalls} |`);
    lines.push(`| Failed API Calls | ${summary.failedCalls} |`);
    lines.push(`| Avg Response Time | ${summary.avgResponseMs}ms |`);
    lines.push(`| P95 Response Time | ${summary.p95ResponseMs}ms |`);
    lines.push(`| P99 Response Time | ${summary.p99ResponseMs}ms |`);
    lines.push('');

    // Scenario results
    lines.push('## Scenarios');
    lines.push('');
    lines.push('| Status | Module | Scenario | Duration | Steps |');
    lines.push('|--------|--------|----------|----------|-------|');
    for (const s of metrics.scenarios) {
      const status = s.passed ? '✅' : '❌';
      const stepsInfo = `${s.steps.filter((st) => st.passed).length}/${s.steps.length}`;
      lines.push(`| ${status} | ${s.module} | ${s.name} | ${(s.durationMs / 1000).toFixed(1)}s | ${stepsInfo} |`);
    }
    lines.push('');

    // Failed scenarios detail
    const failed = metrics.scenarios.filter((s) => !s.passed);
    if (failed.length > 0) {
      lines.push('## Failed Scenarios');
      lines.push('');
      for (const s of failed) {
        lines.push(`### ${s.module}/${s.name}`);
        lines.push('');
        if (s.error) lines.push(`**Error**: ${s.error}`);
        lines.push('');
        lines.push('| Step | Status | Duration | Error |');
        lines.push('|------|--------|----------|-------|');
        for (const st of s.steps) {
          const status = st.passed ? '✅' : '❌';
          lines.push(`| ${st.name} | ${status} | ${Math.round(st.durationMs)}ms | ${st.error || '-'} |`);
        }
        lines.push('');
      }
    }

    // Endpoint metrics
    lines.push('## API Endpoint Metrics');
    lines.push('');
    lines.push('| Method | Endpoint | Count | Fail | Avg | P95 | P99 | Max |');
    lines.push('|--------|----------|-------|------|-----|-----|-----|-----|');
    for (const e of metrics.endpointMetrics) {
      lines.push(`| ${e.method} | ${e.endpoint} | ${e.count} | ${e.failCount} | ${e.avgMs}ms | ${e.p95Ms}ms | ${e.p99Ms}ms | ${e.maxMs}ms |`);
    }
    lines.push('');

    // Write file
    const content = lines.join('\n');
    fs.mkdirSync(outDir, { recursive: true });
    const filePath = path.join(outDir, 'simulator-report.md');
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }
}
