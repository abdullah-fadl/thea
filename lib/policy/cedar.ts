/**
 * Cedar policy engine wrapper — Phase 4.3
 *
 * Shadow-eval only. Cedar is NEVER authoritative in this phase.
 * Flag guard: when FF_CEDAR_SHADOW_EVAL=false, evaluate() returns { skipped: true }
 * and performs zero work — no WASM load, no policy read, no I/O.
 *
 * Panic-safe: any error inside Cedar (load failure, parse error, eval throw) is
 * caught, logged, and returns { decision: 'allow', reasons: ['cedar_unavailable'] }.
 * It NEVER propagates a throw to the caller.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface EvaluateArgs {
  principal?: { id: string; type?: string; attrs?: Record<string, unknown> };
  action: string;
  resource?: { id: string; type?: string; attrs?: Record<string, unknown> };
  context?: Record<string, unknown>;
}

export type EvaluateResult =
  | { skipped: true }
  | { decision: 'allow' | 'deny'; reasons: string[] };

// ─── Internal types (minimal slice of cedar-wasm API) ────────────────────────

type Decision = 'allow' | 'deny';
interface CedarResponse { decision: Decision; diagnostics: { reason: string[]; errors: unknown[] } }
type CedarAuthAnswer =
  | { type: 'success'; response: CedarResponse; warnings: unknown[] }
  | { type: 'failure'; errors: unknown[]; warnings: unknown[] };
interface CedarModule {
  isAuthorized(call: Record<string, unknown>): CedarAuthAnswer;
}

// ─── Lazy WASM load (cached, panic-safe) ─────────────────────────────────────

let _cedarModule: CedarModule | null = null;
let _cedarLoadAttempted = false;
let _policyText: string | null = null;

/** Exported for test reset only — do not call in production code. */
export function _resetCedarForTesting(): void {
  _cedarModule = null;
  _cedarLoadAttempted = false;
  _policyText = null;
}

/** Inject a Cedar module directly (bypasses dynamic import) — tests only. */
export function _injectCedarModuleForTesting(mod: CedarModule | null): void {
  _cedarModule = mod;
  _cedarLoadAttempted = true;
}

/** Simulate a failed WASM load (getCedar returns null) — tests only. */
export function _forceCedarUnavailableForTesting(): void {
  _cedarModule = null;
  _cedarLoadAttempted = true;
}

async function getCedar(): Promise<CedarModule | null> {
  if (_cedarLoadAttempted) return _cedarModule;
  _cedarLoadAttempted = true;
  try {
    // Dynamic import for testability (vi.mock intercepts this)
    const mod = await import('@cedar-policy/cedar-wasm/nodejs');
    _cedarModule = mod as unknown as CedarModule;
  } catch (err) {
    logger.error('Cedar WASM load failed — shadow-eval will return cedar_unavailable', {
      category: 'policy',
      subCategory: 'cedar.load_error',
      error: err,
    });
    _cedarModule = null;
  }
  return _cedarModule;
}

function getPolicyText(): string {
  if (_policyText) return _policyText;
  const dir = join(process.cwd(), 'lib/policy/policies');
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.cedar'))
    .sort();
  const parts: string[] = [];
  for (const name of files) {
    parts.push(`// ── ${name} ──`);
    parts.push(readFileSync(join(dir, name), 'utf8'));
  }
  _policyText = parts.join('\n');
  return _policyText;
}

// ─── evaluate() ──────────────────────────────────────────────────────────────

/**
 * Evaluate an authorization request against Cedar policies.
 *
 * Returns `{ skipped: true }` when FF_CEDAR_SHADOW_EVAL is OFF.
 * Returns `{ decision, reasons }` when evaluated.
 * Never throws — all errors are caught and surfaced as `reasons: ['cedar_unavailable']`.
 */
export async function evaluate(args: EvaluateArgs): Promise<EvaluateResult> {
  if (!isEnabled('FF_CEDAR_SHADOW_EVAL')) {
    return { skipped: true };
  }

  try {
    const cedar = await getCedar();
    if (!cedar) {
      return { decision: 'allow', reasons: ['cedar_unavailable'] };
    }

    const principalId   = args.principal?.id ?? 'unknown';
    const principalType = args.principal?.type ?? 'Thea::User';
    const resourceId    = args.resource?.id ?? 'unknown';
    const resourceType  = args.resource?.type ?? 'Thea::Resource';
    const principalAttrs = args.principal?.attrs ?? {};
    const resourceAttrs  = args.resource?.attrs ?? {};

    const call = {
      principal: { type: principalType, id: principalId },
      action:    { type: 'Thea::Action', id: args.action },
      resource:  { type: resourceType,  id: resourceId  },
      context:   (args.context ?? {}) as Record<string, unknown>,
      policies:  { staticPolicies: getPolicyText() },
      entities: [
        { uid: { type: principalType, id: principalId }, attrs: principalAttrs, parents: [] },
        { uid: { type: resourceType,  id: resourceId  }, attrs: resourceAttrs,  parents: [] },
      ],
    };

    const answer = cedar.isAuthorized(call);

    if (answer.type === 'failure') {
      logger.warn('Cedar evaluation returned failure', {
        category: 'policy',
        action: args.action,
        errors: answer.errors,
      });
      return { decision: 'allow', reasons: ['cedar_unavailable'] };
    }

    return {
      decision: answer.response.decision,
      reasons:  answer.response.diagnostics.reason,
    };
  } catch (err) {
    logger.error('Cedar evaluate() threw unexpectedly', {
      category: 'policy',
      subCategory: 'cedar.panic',
      action: args.action,
      error: err,
    });
    return { decision: 'allow', reasons: ['cedar_unavailable'] };
  }
}
