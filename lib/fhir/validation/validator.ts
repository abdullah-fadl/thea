// Phase 8.1.5 — NPHIES profile validator (core).
//
// Hand-rolled, TypeScript-native validator that checks an outbound NPHIES
// FHIR resource against the structural + required-field rules of the
// NPHIES KSA profile it claims (`Resource.meta.profile[0]`).
//
// Design choices:
//   - Pure TS, zero external deps. We do NOT load FHIR `StructureDefinition`
//     JSON files at runtime — instead each profile has a hand-written
//     validator co-located in `./profiles/*.ts`. Trade-off: the rule set is
//     curated to the fields NPHIES KSA actually mandates, not the full R4
//     spec. Faster, smaller, and easier to audit; the cost is that drift
//     against new NPHIES profile versions has to be picked up by hand.
//   - Issues are emitted with FHIR-style severity (`fatal | error | warning |
//     information`). The adapter treats `error | fatal` as blocking only when
//     FF_NPHIES_VALIDATION_STRICT is ON.
//   - The path uses dot-notation (`Claim.insurance[0].coverage`) so the issue
//     is actionable in logs without a JSONPath dependency.
//
// This module is the dispatcher. It does not contain profile rules itself —
// see `./profiles/index.ts` for the per-profile registry, and the adapter
// integration in `lib/integrations/nphies/adapter.ts`.

import type { FhirResource } from '@/lib/fhir/types';
import { NPHIES_PROFILES } from '@/lib/fhir/nphies-profiles';
import { getProfileValidator } from './profiles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'fatal' | 'error' | 'warning' | 'information';

export interface ValidationIssue {
  /** FHIR-style severity. `error` and `fatal` are blocking under STRICT. */
  severity: ValidationSeverity;
  /** Dot-notation path: `Claim.insurance[0].coverage` or `Bundle.entry[2]`. */
  path: string;
  /** Short machine code: `required`, `cardinality`, `value-set`, `invariant`. */
  code: string;
  /** Human-readable message. */
  message: string;
  /** Profile URL the issue was raised against (omitted for cross-cutting checks). */
  profile?: string;
}

export interface ValidationResult {
  /** True iff there are no `error` / `fatal` issues. Warnings do not flip this. */
  valid: boolean;
  issues: ValidationIssue[];
  /** Profile URL the resource was evaluated against (or `null` if no validator matched). */
  profile: string | null;
  /** ResourceType being validated. */
  resourceType: string;
}

// ---------------------------------------------------------------------------
// Helpers (exported for use by per-profile validators)
// ---------------------------------------------------------------------------

/**
 * Build an `error` issue. The adapter treats these as blocking under STRICT.
 */
export function error(path: string, code: string, message: string, profile?: string): ValidationIssue {
  return { severity: 'error', path, code, message, profile };
}

/**
 * Build a `warning` issue. Never blocks the send; surfaces in logs + persisted summary.
 */
export function warning(path: string, code: string, message: string, profile?: string): ValidationIssue {
  return { severity: 'warning', path, code, message, profile };
}

/**
 * Build an `information` issue. Purely advisory.
 */
export function info(path: string, code: string, message: string, profile?: string): ValidationIssue {
  return { severity: 'information', path, code, message, profile };
}

/**
 * Walks `obj.path1.path2[.pathN]` and returns the value (or undefined).
 * Used inside per-profile validators for terse required-field checks.
 */
export function get(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Push an `error` issue if the field at `path` is missing/null/empty-string/empty-array.
 */
export function requireField(
  resource: unknown,
  path: string,
  resourceType: string,
  profile: string,
  out: ValidationIssue[],
): void {
  const v = get(resource, path);
  const missing =
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.length === 0) ||
    (Array.isArray(v) && v.length === 0);
  if (missing) {
    out.push(error(`${resourceType}.${path}`, 'required', `${resourceType}.${path} is required by ${profile}`, profile));
  }
}

/**
 * Push an `error` issue if the field's value is not in the allowed set.
 */
export function requireValueIn<T extends string>(
  resource: unknown,
  path: string,
  allowed: readonly T[],
  resourceType: string,
  profile: string,
  out: ValidationIssue[],
): void {
  const v = get(resource, path);
  if (v === undefined || v === null) return; // separate `required` check responsible for missing.
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    out.push(
      error(
        `${resourceType}.${path}`,
        'value-set',
        `${resourceType}.${path}='${String(v)}' is not in the allowed set [${allowed.join(', ')}]`,
        profile,
      ),
    );
  }
}

/**
 * Summarise a list of issues into a top-line `valid` boolean.
 * Errors and fatals flip valid → false; warnings/info do not.
 */
export function isValid(issues: readonly ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === 'error' || i.severity === 'fatal');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a single FHIR resource against the supplied NPHIES profile URL.
 *
 * Behaviour:
 *   - Unknown profile URL → returns a single `warning` (`profile=unknown-profile`)
 *     and `valid: true`. We choose to warn rather than error so a bundle
 *     containing one unrecognized resource doesn't block the whole send.
 *   - Resource missing `resourceType` → returns one `error` and `valid: false`.
 *   - Otherwise dispatches to the per-profile validator from
 *     `./profiles/index.ts`. The validator returns its own issue list.
 *
 * NOTE: This function does not check the feature flag. Flag gating happens
 * in `./index.ts` so this module remains a pure utility.
 */
export function validateAgainstNphiesProfile(
  resource: FhirResource,
  profileUrl: string,
): ValidationResult {
  const resourceType = resource?.resourceType ?? 'Unknown';

  if (!resource || !resource.resourceType) {
    return {
      valid: false,
      profile: profileUrl,
      resourceType,
      issues: [error(`${resourceType}.resourceType`, 'required', 'resource is missing resourceType', profileUrl)],
    };
  }

  const validator = getProfileValidator(profileUrl);
  if (!validator) {
    return {
      valid: true,
      profile: profileUrl,
      resourceType,
      issues: [warning(`${resourceType}`, 'unknown-profile', `No validator registered for profile ${profileUrl}`)],
    };
  }

  const issues = validator(resource, profileUrl);
  return {
    valid: isValid(issues),
    profile: profileUrl,
    resourceType,
    issues,
  };
}

/**
 * Convenience: returns the canonical NPHIES profile URL for a resourceType,
 * or null if the resourceType isn't part of the NPHIES profile set. Useful
 * when a resource doesn't carry `meta.profile` and the caller wants to check
 * it against the conventional profile for its type.
 */
export function defaultProfileFor(resourceType: string): string | null {
  switch (resourceType) {
    case 'Coverage':                      return NPHIES_PROFILES.COVERAGE;
    case 'Claim':                         return NPHIES_PROFILES.CLAIM;
    case 'ClaimResponse':                 return NPHIES_PROFILES.CLAIM_RESPONSE;
    case 'CoverageEligibilityRequest':    return NPHIES_PROFILES.COVERAGE_ELIGIBILITY_REQUEST;
    case 'CoverageEligibilityResponse':   return NPHIES_PROFILES.COVERAGE_ELIGIBILITY_RESPONSE;
    case 'Practitioner':                  return NPHIES_PROFILES.PRACTITIONER;
    case 'PractitionerRole':              return NPHIES_PROFILES.PRACTITIONER_ROLE;
    case 'Organization':                  return NPHIES_PROFILES.ORGANIZATION;
    case 'Location':                      return NPHIES_PROFILES.LOCATION;
    case 'Bundle':                        return NPHIES_PROFILES.MESSAGE_BUNDLE;
    case 'MessageHeader':                 return NPHIES_PROFILES.MESSAGE_HEADER;
    default:                              return null;
  }
}
