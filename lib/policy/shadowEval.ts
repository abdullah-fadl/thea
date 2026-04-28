/**
 * Cedar shadow-eval wrapper — Phase 4.3
 *
 * Calls evaluate() in parallel with the legacy authorization decision,
 * logs any disagreement, and ALWAYS returns void — the caller's decision
 * (legacy) is never affected.
 *
 * Flag guard: when FF_CEDAR_SHADOW_EVAL=false, this is a no-op.
 * Never throws — all errors are swallowed and logged.
 */

import { isEnabled } from '@/lib/core/flags';
import { logger } from '@/lib/monitoring/logger';
import { evaluate, type EvaluateArgs } from './cedar';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ShadowEvalArgs extends EvaluateArgs {
  /** The decision already made by the legacy authorization path. */
  legacyDecision: 'allow' | 'deny';
}

export type ShadowOutcome = 'match' | 'disagreement' | 'cedar_unavailable';

// ─── shadowEvaluate() ────────────────────────────────────────────────────────

/**
 * Run Cedar in shadow mode against a completed legacy authorization decision.
 *
 * - FF_CEDAR_SHADOW_EVAL=false → immediate no-op, returns void.
 * - FF_CEDAR_SHADOW_EVAL=true  → Cedar evaluates, result is logged, void returned.
 * - Never throws. Never changes the caller's decision.
 */
export async function shadowEvaluate(args: ShadowEvalArgs): Promise<void> {
  if (!isEnabled('FF_CEDAR_SHADOW_EVAL')) return;

  try {
    const result = await evaluate(args);

    let outcome: ShadowOutcome;
    if ('skipped' in result) {
      // evaluate() returned skipped — flag was OFF inside evaluate (shouldn't happen
      // since we already checked above, but defensive).
      return;
    } else if (result.reasons.includes('cedar_unavailable')) {
      outcome = 'cedar_unavailable';
    } else {
      outcome = result.decision === args.legacyDecision ? 'match' : 'disagreement';
    }

    logger.info('Cedar shadow evaluation', {
      category: 'policy',
      subCategory: 'shadow_eval',
      outcome,
      action: args.action,
      'principal.id': args.principal?.id,
      'resource.type': args.resource?.type,
      cedarDecision: 'decision' in result ? result.decision : undefined,
      legacyDecision: args.legacyDecision,
    });
  } catch (err) {
    // Belt-and-suspenders: evaluate() should never throw, but guard here too.
    logger.error('shadowEvaluate() caught unexpected error — legacy decision unaffected', {
      category: 'policy',
      action: args.action,
      error: err,
    });
  }
}
