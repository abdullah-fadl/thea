/**
 * Imdad In-Process Metrics
 *
 * Simple counter-based metrics for workflow operations.
 * Returns a snapshot of all counters via getMetrics().
 */

const counters: Record<string, number> = {};

/** Increment a named counter by the given amount (default 1). */
export function increment(name: string, amount = 1): void {
  counters[name] = (counters[name] ?? 0) + amount;
}

/** Return a snapshot of all current counters. */
export function getMetrics(): Record<string, number> {
  return { ...counters };
}

/** Reset all counters (useful in tests). */
export function resetMetrics(): void {
  for (const key of Object.keys(counters)) {
    delete counters[key];
  }
}
