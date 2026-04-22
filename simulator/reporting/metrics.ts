/**
 * Metrics — Collects API call timings and scenario results.
 */

import type { ApiResult } from '../actors/base';
import type { ScenarioResult } from '../scenarios/base';

export interface EndpointMetric {
  endpoint: string;
  method: string;
  count: number;
  successCount: number;
  failCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

export interface SimulationMetrics {
  startTime: Date;
  endTime: Date;
  totalDurationMs: number;
  scenarios: ScenarioResult[];
  endpointMetrics: EndpointMetric[];
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    totalApiCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgResponseMs: number;
    p95ResponseMs: number;
    p99ResponseMs: number;
  };
}

export class MetricsCollector {
  private scenarioResults: ScenarioResult[] = [];
  private allCalls: ApiResult[] = [];
  private startTime: Date = new Date();

  start(): void {
    this.startTime = new Date();
    this.scenarioResults = [];
    this.allCalls = [];
  }

  addScenarioResult(result: ScenarioResult): void {
    this.scenarioResults.push(result);
  }

  addCalls(calls: ApiResult[]): void {
    this.allCalls.push(...calls);
  }

  finalize(): SimulationMetrics {
    const endTime = new Date();
    const totalDurationMs = endTime.getTime() - this.startTime.getTime();

    // Group calls by endpoint
    const groups = new Map<string, ApiResult[]>();
    for (const call of this.allCalls) {
      // Normalize dynamic IDs in paths
      const normalized = call.url
        .replace(/\/[a-f0-9]{24}/g, '/{id}')
        .replace(/\/[0-9a-f-]{36}/g, '/{uuid}')
        .replace(/\/c[a-z0-9]{24,}/g, '/{cuid}')
        .split('?')[0];
      const key = `${call.method} ${normalized}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(call);
    }

    const endpointMetrics: EndpointMetric[] = [];
    for (const [key, calls] of groups) {
      const [method, endpoint] = [key.split(' ')[0], key.split(' ').slice(1).join(' ')];
      const durations = calls.map((c) => c.durationMs).sort((a, b) => a - b);
      const successCount = calls.filter((c) => c.ok).length;

      endpointMetrics.push({
        endpoint,
        method,
        count: calls.length,
        successCount,
        failCount: calls.length - successCount,
        avgMs: Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
        p50Ms: Math.round(percentile(durations, 50)),
        p95Ms: Math.round(percentile(durations, 95)),
        p99Ms: Math.round(percentile(durations, 99)),
        maxMs: Math.round(durations[durations.length - 1] || 0),
      });
    }

    endpointMetrics.sort((a, b) => b.count - a.count);

    const allDurations = this.allCalls.map((c) => c.durationMs).sort((a, b) => a - b);
    const totalCalls = this.allCalls.length;
    const successfulCalls = this.allCalls.filter((c) => c.ok).length;

    return {
      startTime: this.startTime,
      endTime,
      totalDurationMs,
      scenarios: this.scenarioResults,
      endpointMetrics,
      summary: {
        totalScenarios: this.scenarioResults.length,
        passedScenarios: this.scenarioResults.filter((s) => s.passed).length,
        failedScenarios: this.scenarioResults.filter((s) => !s.passed).length,
        totalApiCalls: totalCalls,
        successfulCalls,
        failedCalls: totalCalls - successfulCalls,
        avgResponseMs: totalCalls ? Math.round(allDurations.reduce((s, d) => s + d, 0) / totalCalls) : 0,
        p95ResponseMs: totalCalls ? Math.round(percentile(allDurations, 95)) : 0,
        p99ResponseMs: totalCalls ? Math.round(percentile(allDurations, 99)) : 0,
      },
    };
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}
