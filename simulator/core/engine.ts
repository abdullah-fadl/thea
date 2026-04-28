/**
 * Engine — Main orchestrator that runs scenarios in parallel batches.
 */

import { SimulationClock } from './clock';
import { SimulationState } from './state';
import { MetricsCollector } from '../reporting/metrics';
import { Reporter } from '../reporting/reporter';
import type { BaseScenario, ScenarioContext, ScenarioResult } from '../scenarios/base';
import type { SimulationConfig } from '../config/default';
import type { BaseActor } from '../actors/base';

export class SimulationEngine {
  private clock: SimulationClock;
  private state: SimulationState;
  private metrics: MetricsCollector;
  private reporter: Reporter;
  private scenarios: BaseScenario[] = [];
  private config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
    this.clock = new SimulationClock(config.speed);
    this.state = new SimulationState();
    this.metrics = new MetricsCollector();
    this.reporter = new Reporter();
  }

  /** Register scenarios to run */
  registerScenarios(scenarios: BaseScenario[]): void {
    this.scenarios.push(...scenarios);
  }

  /** Filter to only specific modules */
  filterModules(modules: string[]): void {
    if (modules.length > 0) {
      this.scenarios = this.scenarios.filter((s) => modules.includes(s.module));
    }
  }

  /** Run all registered scenarios */
  async run(): Promise<void> {
    const { concurrency, duration } = this.config;
    console.log(`\n  Starting Thea Hospital Simulator`);
    console.log(`  Scenarios: ${this.scenarios.length}`);
    console.log(`  Concurrency: ${concurrency}`);
    console.log(`  Speed: ${this.config.speed}x`);
    if (duration) console.log(`  Duration: ${duration} minutes`);
    console.log('');

    this.metrics.start();

    if (duration) {
      await this.runContinuous(duration);
    } else {
      await this.runOnce();
    }

    const finalMetrics = this.metrics.finalize();
    this.reporter.printConsole(finalMetrics);

    const reportPath = this.reporter.writeMarkdown(finalMetrics, 'test-results');
    console.log(`  Report written to: ${reportPath}\n`);

    if (finalMetrics.summary.failedScenarios > 0) {
      process.exit(1);
    }
  }

  /** Run all scenarios once in batches — with stagger delay to avoid DB connection stampede */
  private async runOnce(): Promise<void> {
    const batches = chunk(this.scenarios, this.config.concurrency);
    for (const batch of batches) {
      const results = await Promise.all(
        batch.map((scenario, idx) =>
          // Stagger starts by 2 seconds to avoid login stampede on DB pool
          new Promise<ScenarioResult>((resolve) =>
            setTimeout(() => resolve(this.runScenario(scenario)), idx * 2000)
          )
        ),
      );
      for (const result of results) {
        this.metrics.addScenarioResult(result);
      }
    }
  }

  /** Run scenarios continuously for N minutes */
  private async runContinuous(minutes: number): Promise<void> {
    const endAt = Date.now() + minutes * 60 * 1000;
    let cycle = 0;
    while (Date.now() < endAt) {
      cycle++;
      console.log(`  --- Cycle ${cycle} ---`);
      const batches = chunk(this.scenarios, this.config.concurrency);
      for (const batch of batches) {
        if (Date.now() >= endAt) break;
        const results = await Promise.all(
          batch.map((scenario) => this.runScenario(scenario)),
        );
        for (const result of results) {
          this.metrics.addScenarioResult(result);
        }
      }
    }
  }

  /** Run a single scenario */
  private async runScenario(scenario: BaseScenario): Promise<ScenarioResult> {
    const ctx: ScenarioContext = {
      baseUrl: this.config.baseUrl,
      clock: this.clock,
      state: this.state,
      tenantId: this.config.tenants.primary.tenantId,
      credentials: this.config.tenants.primary.users,
      secondaryTenantId: this.config.tenants.secondary.tenantId,
      secondaryCredentials: this.config.tenants.secondary.users,
    };

    const label = `${scenario.module}/${scenario.name}`;
    console.log(`  ▸ Running: ${label}`);

    const result = await scenario.execute(ctx);

    if (result.passed) {
      console.log(`  ✓ Passed:  ${label} (${(result.durationMs / 1000).toFixed(1)}s)`);
    } else {
      console.log(`  ✗ Failed:  ${label}`);
      if (result.error) console.log(`    → ${result.error}`);
    }

    return result;
  }

  /** Collect actor metrics */
  collectActorMetrics(actor: BaseActor): void {
    this.metrics.addCalls(actor.calls);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
