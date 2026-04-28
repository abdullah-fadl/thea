// Phase 8.1.5 — Public, flag-gated entry points for the NPHIES validator.
//
// Two entry points:
//   - validateBundle(bundle): checks the bundle envelope itself + every entry
//     against the profile each entry declares (or the conventional default for
//     its resourceType when none is declared).
//   - validateResource(resource): checks one resource against the profile in
//     its `meta.profile[0]` (or the default).
//
// Flag gating: when FF_NPHIES_VALIDATION_ENABLED is OFF both functions return
// `[{ valid: true, issues: [], … }]` / `{ valid: true, issues: [], … }` so
// callers can integrate them unconditionally without changing 8.1.4 behaviour.
//
// This file does NOT decide what to do with errors — that's the adapter's
// responsibility (it consults FF_NPHIES_VALIDATION_STRICT). Returning issues
// keeps this layer pure and testable.

import { isEnabled } from '@/lib/core/flags';
import type { FhirBundle, FhirResource } from '@/lib/fhir/types';
import {
  validateAgainstNphiesProfile,
  defaultProfileFor,
  type ValidationResult,
} from './validator';

export type { ValidationIssue, ValidationResult, ValidationSeverity } from './validator';

function offResult(resourceType: string, profile: string | null): ValidationResult {
  return { valid: true, issues: [], profile, resourceType };
}

/**
 * Validate every resource in a NPHIES message bundle. The bundle itself is
 * also validated (against the MESSAGE_BUNDLE profile).
 *
 * Returns one ValidationResult per validated unit (bundle + each entry that
 * has a resource). Order: bundle first, then entries in order.
 *
 * When FF_NPHIES_VALIDATION_ENABLED is OFF, returns a single passing result
 * for the bundle and skips per-entry work entirely (zero CPU on the hot path).
 */
export function validateBundle(bundle: FhirBundle): ValidationResult[] {
  if (!isEnabled('FF_NPHIES_VALIDATION_ENABLED')) {
    return [offResult('Bundle', defaultProfileFor('Bundle'))];
  }

  const results: ValidationResult[] = [];

  // ── Bundle envelope itself ─────────────────────────────────────────────
  const bundleProfile = bundle?.meta?.profile?.[0] ?? defaultProfileFor('Bundle');
  if (bundleProfile) {
    results.push(validateAgainstNphiesProfile(bundle, bundleProfile));
  }

  // ── Each entry's resource ──────────────────────────────────────────────
  for (const entry of bundle?.entry ?? []) {
    const r = entry.resource;
    if (!r) continue;
    const profile = r.meta?.profile?.[0] ?? defaultProfileFor(r.resourceType);
    if (!profile) continue; // resourceType outside our NPHIES set — silently skip.
    results.push(validateAgainstNphiesProfile(r, profile));
  }

  return results;
}

/**
 * Validate a single resource against its declared profile (or the default).
 *
 * When FF_NPHIES_VALIDATION_ENABLED is OFF, returns a single passing result.
 */
export function validateResource(resource: FhirResource): ValidationResult {
  if (!isEnabled('FF_NPHIES_VALIDATION_ENABLED')) {
    return offResult(resource?.resourceType ?? 'Unknown', null);
  }
  const profile = resource?.meta?.profile?.[0] ?? defaultProfileFor(resource?.resourceType);
  if (!profile) {
    return offResult(resource?.resourceType ?? 'Unknown', null);
  }
  return validateAgainstNphiesProfile(resource, profile);
}

/**
 * Aggregate helper: flatten an array of ValidationResults into a single summary.
 * Used by the adapter when persisting to the log row.
 */
export interface ValidationSummary {
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  failed: boolean;
}

export function summarize(results: readonly ValidationResult[]): ValidationSummary {
  let totalIssues = 0;
  let errorCount  = 0;
  let warningCount = 0;
  let failed = false;
  for (const r of results) {
    for (const i of r.issues) {
      totalIssues++;
      if (i.severity === 'error' || i.severity === 'fatal') {
        errorCount++;
        failed = true;
      } else if (i.severity === 'warning') {
        warningCount++;
      }
    }
  }
  return { totalIssues, errorCount, warningCount, failed };
}
