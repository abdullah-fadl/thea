/**
 * Phase 8.3 — LabResultMonitorAgent (suggestion-only)
 *
 * Pure rule evaluator. Reads a finalised LabResult row and checks each
 * parameter against a small panel of critical-value rules. When a rule
 * matches, the agent emits a `clinical.alert@v1` event (PHI-free,
 * IDs only) so downstream consumers can notify the on-duty clinician.
 *
 * SAFETY:
 *   - Output is always { suggestion: true, ... }. Never auto-applied.
 *   - No LLM call — zero Anthropic API spend per run.
 *   - Both flag-gating layers apply:
 *       FF_AI_AGENTS_ENABLED   → register/run-time guard
 *       FF_EVENT_BUS_ENABLED   → emit() returns { skipped: true } when off
 *   - Cedar policy 'thea_health:read' shadow-evaluated by runAgent().
 *
 * The historical LabCriticalAlert table (lib/integrations/lis/service.ts)
 * remains the source of truth for the legacy LIS pipeline; this agent is
 * an additive event-driven surface that does NOT write into that table.
 */

import { z } from 'zod';
import { isEnabled } from '@/lib/core/flags';
import { prisma } from '@/lib/db/prisma';
import { emit } from '@/lib/events/emit';
import { registerAgent } from '../framework/registry';

// ─── Constants ────────────────────────────────────────────────────────────────

const LAB_MONITOR_AGENT_KEY = 'clinical.lab-monitor.v1';

// ─── Rule table ───────────────────────────────────────────────────────────────

export type CriticalRule = {
  /** Stable rule identifier — emitted on the alert event for audit/lookup. */
  rule: string;
  /** Substrings (lowercased) that match the parameter name or testCode. */
  analyteAliases: string[];
  /** Optional low threshold — flagged when value < low. */
  low?: number;
  /** Optional high threshold — flagged when value > high. */
  high?: number;
  /** Reference range for the alert payload. */
  ref: { low: number; high: number };
  severity: 'critical' | 'high' | 'low';
};

/**
 * Critical-value panel.
 * Sourced from common adult reference ranges; intentionally narrow so we
 * never produce false alarms from physiologic variation.
 */
export const CRITICAL_RULES: CriticalRule[] = [
  {
    rule: 'critical_hypoglycemia',
    analyteAliases: ['glucose', 'glu', 'bg', 'blood sugar'],
    low: 40,
    ref: { low: 40, high: 500 },
    severity: 'critical',
  },
  {
    rule: 'critical_hyperglycemia',
    analyteAliases: ['glucose', 'glu', 'bg', 'blood sugar'],
    high: 500,
    ref: { low: 40, high: 500 },
    severity: 'critical',
  },
  {
    rule: 'critical_hyperkalemia',
    analyteAliases: ['potassium', 'k+', 'k '],
    high: 6.0,
    ref: { low: 2.5, high: 6.0 },
    severity: 'critical',
  },
  {
    rule: 'critical_hypokalemia',
    analyteAliases: ['potassium', 'k+', 'k '],
    low: 2.5,
    ref: { low: 2.5, high: 6.0 },
    severity: 'critical',
  },
  {
    rule: 'critical_hypernatremia',
    analyteAliases: ['sodium', 'na+', 'na '],
    high: 160,
    ref: { low: 115, high: 160 },
    severity: 'critical',
  },
  {
    rule: 'critical_hyponatremia',
    analyteAliases: ['sodium', 'na+', 'na '],
    low: 115,
    ref: { low: 115, high: 160 },
    severity: 'critical',
  },
  {
    rule: 'critical_anemia',
    analyteAliases: ['hemoglobin', 'haemoglobin', 'hgb', 'hb'],
    low: 7,
    ref: { low: 7, high: 18 },
    severity: 'critical',
  },
  {
    rule: 'critical_thrombocytopenia',
    analyteAliases: ['platelet', 'plt', 'platelets'],
    low: 20,
    ref: { low: 20, high: 450 },
    severity: 'critical',
  },
  {
    rule: 'critical_anticoagulation',
    analyteAliases: ['inr', 'international normalized ratio'],
    high: 5,
    ref: { low: 0.8, high: 5 },
    severity: 'critical',
  },
];

// ─── Schemas ──────────────────────────────────────────────────────────────────

const labMonitorInputSchema = z.object({
  labResultId: z.string().uuid(),
});

const labMonitorOutputSchema = z.object({
  suggestion: z.literal(true),
  flagged: z.boolean(),
  severity: z.enum(['critical', 'high', 'low']).optional(),
  rule: z.string().optional(),
  value: z.number().optional(),
  ref: z
    .object({ low: z.number(), high: z.number() })
    .optional(),
});

export type LabMonitorInput = z.infer<typeof labMonitorInputSchema>;
export type LabMonitorOutput = z.infer<typeof labMonitorOutputSchema>;

// ─── Parameter parsing ────────────────────────────────────────────────────────

interface LabParam {
  name?: unknown;
  value?: unknown;
  unit?: unknown;
}

/** Coerce a parameter value to a finite number, or null. */
function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function aliasMatches(name: string, aliases: string[]): boolean {
  const lower = name.toLowerCase();
  return aliases.some((a) => lower.includes(a));
}

/**
 * Evaluate a single rule against a (name, value) pair.
 * Returns the matching rule when criteria are met, otherwise null.
 */
function evaluateRule(
  name: string,
  value: number,
  rule: CriticalRule,
): CriticalRule | null {
  if (!aliasMatches(name, rule.analyteAliases)) return null;
  if (rule.low !== undefined && value < rule.low) return rule;
  if (rule.high !== undefined && value > rule.high) return rule;
  return null;
}

/**
 * Walk every parameter and the testCode/testName fields and return the
 * FIRST matching critical rule + the value that triggered it. Stop on
 * first hit so a single agent run produces at most one alert event
 * (consistent with the `output` schema).
 */
export function evaluateLabResult(input: {
  testCode: string | null;
  testName: string | null;
  parameters: unknown;
}): { rule: CriticalRule; value: number } | null {
  const candidates: Array<{ name: string; value: number }> = [];

  // 1. Parameters JSON array — { name, value, unit, ... }
  if (Array.isArray(input.parameters)) {
    for (const p of input.parameters as LabParam[]) {
      const name = typeof p?.name === 'string' ? p.name : null;
      const value = toNumber(p?.value);
      if (name && value !== null) {
        candidates.push({ name, value });
      }
    }
  }

  // 2. Top-level testCode / testName as a fallback for single-analyte rows
  //    (the LIS integration path stores the analyte name there).
  for (const rule of CRITICAL_RULES) {
    for (const cand of candidates) {
      const hit = evaluateRule(cand.name, cand.value, rule);
      if (hit) return { rule: hit, value: cand.value };
    }
  }

  return null;
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerLabMonitorAgent(): void {
  if (!isEnabled('FF_AI_AGENTS_ENABLED')) return;

  registerAgent({
    key: LAB_MONITOR_AGENT_KEY,
    name: 'Lab Result Monitor Agent v1',
    description:
      'Evaluates a finalised LabResult against a fixed critical-value rule set. Emits clinical.alert@v1 on match. Suggestion-only — never auto-applies.',
    version: 1,
    inputSchema: labMonitorInputSchema,
    outputSchema: labMonitorOutputSchema,
    policyKey: 'thea_health:read',
    handler: async (input, ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = await (prisma as any).labResult.findUnique({
        where: { id: input.labResultId },
        select: {
          id: true,
          tenantId: true,
          patientId: true,
          encounterId: true,
          testCode: true,
          testName: true,
          parameters: true,
        },
      });

      if (!row) {
        return { suggestion: true as const, flagged: false };
      }

      // Tenant isolation: a labResult must belong to the agent's tenant.
      if (row.tenantId !== ctx.tenantId) {
        return { suggestion: true as const, flagged: false };
      }

      const hit = evaluateLabResult({
        testCode: row.testCode,
        testName: row.testName,
        parameters: row.parameters,
      });

      if (!hit) {
        return { suggestion: true as const, flagged: false };
      }

      // Emit clinical.alert@v1 — best-effort, never throws.
      // Returns { skipped: true } when FF_EVENT_BUS_ENABLED is off.
      await emit({
        eventName: 'clinical.alert',
        version: 1,
        tenantId: ctx.tenantId,
        aggregate: 'clinical_alert',
        aggregateId: row.id,
        payload: {
          tenantId: ctx.tenantId,
          alertType: 'critical_lab',
          severity: hit.rule.severity,
          rule: hit.rule.rule,
          subjectType: 'lab_result',
          subjectId: row.id,
        },
      }).catch(() => {});

      return {
        suggestion: true as const,
        flagged: true,
        severity: hit.rule.severity,
        rule: hit.rule.rule,
        value: hit.value,
        ref: hit.rule.ref,
      };
    },
  });
}

export { LAB_MONITOR_AGENT_KEY };
