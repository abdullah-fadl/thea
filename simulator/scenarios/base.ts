/**
 * BaseScenario — Interface for all simulation scenarios.
 */

import type { SimulationClock } from '../core/clock';
import type { SimulationState } from '../core/state';

export interface TenantCredentials {
  receptionist: { email: string; password: string };
  nurse: { email: string; password: string };
  doctor: { email: string; password: string };
  staff: { email: string; password: string };
  portal: { email: string; password: string };
  cvisionAdmin: { email: string; password: string };
  cvisionHR: { email: string; password: string };
  cvisionHRManager: { email: string; password: string };
  cvisionManager: { email: string; password: string };
  cvisionEmployee: { email: string; password: string };
  cvisionPayroll: { email: string; password: string };
}

export interface ScenarioContext {
  baseUrl: string;
  clock: SimulationClock;
  state: SimulationState;
  tenantId: string;
  credentials: TenantCredentials;
  /** Secondary tenant for cross-tenant isolation tests */
  secondaryTenantId?: string;
  secondaryCredentials?: TenantCredentials;
}

export interface ScenarioResult {
  name: string;
  module: string;
  passed: boolean;
  durationMs: number;
  steps: StepResult[];
  error?: string;
}

export interface StepResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export abstract class BaseScenario {
  abstract readonly name: string;
  abstract readonly module: string;
  abstract readonly description: string;

  protected ctx!: ScenarioContext;
  private steps: StepResult[] = [];

  /** Run the full scenario */
  async execute(ctx: ScenarioContext): Promise<ScenarioResult> {
    this.ctx = ctx;
    this.steps = [];
    const start = performance.now();

    try {
      await this.run();
      return {
        name: this.name,
        module: this.module,
        passed: true,
        durationMs: performance.now() - start,
        steps: this.steps,
      };
    } catch (err) {
      return {
        name: this.name,
        module: this.module,
        passed: false,
        durationMs: performance.now() - start,
        steps: this.steps,
        error: (err as Error).message,
      };
    }
  }

  /** Subclasses implement the actual scenario logic here */
  protected abstract run(): Promise<void>;

  /** Execute a named step with error capture */
  protected async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      this.steps.push({
        name,
        passed: true,
        durationMs: performance.now() - start,
      });
      return result;
    } catch (err) {
      this.steps.push({
        name,
        passed: false,
        durationMs: performance.now() - start,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /** Validate a condition */
  protected assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  /** Validate field exists and is not null/undefined */
  protected assertExists(value: unknown, fieldName: string): void {
    if (value === null || value === undefined) {
      throw new Error(`Assertion failed: ${fieldName} is ${value}`);
    }
  }

  /** Validate value equals expected (numeric-aware: handles string/number comparisons for PG Decimals and MongoDB Decimal128) */
  protected assertEqual(actual: unknown, expected: unknown, fieldName: string): void {
    if (actual === expected) return; // strict match

    // Numeric-aware comparison: PostgreSQL Decimal columns may return as strings
    // (e.g., "6000" or "6000.00"), and MongoDB Decimal128 objects have toString()
    // returning the numeric string but Number(decimal128) yields NaN.
    // Convert via String() first to handle Decimal128 and other wrapper types.
    if (actual != null && expected != null) {
      const actualStr = String(actual);
      const expectedStr = String(expected);

      // String equality (covers Decimal128.toString() vs string comparisons)
      if (actualStr === expectedStr) return;

      // Numeric comparison for cross-type matching (string "6000.00" vs number 6000)
      const actualNum = Number(actualStr);
      const expectedNum = Number(expectedStr);
      if (!isNaN(actualNum) && !isNaN(expectedNum) && actualNum === expectedNum) {
        return;
      }
    }

    throw new Error(`Assertion failed: ${fieldName} expected "${expected}" but got "${actual}"`);
  }
}
