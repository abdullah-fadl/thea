/**
 * Phase 7.6 — Source-inspection of platform-route shadow-eval wiring.
 *
 * For each of the 12 wired HTTP method × file combinations, assert that the
 * file imports `shadowEvaluate` from `@/lib/policy` AND contains at least one
 * `void shadowEvaluate(...)` call site. Wiring is fire-and-forget — there is
 * no enforcement layer added in this phase.
 *
 * Static inspection (no Next.js harness) is enough to guarantee Cedar
 * shadow-eval is reachable on each path; runtime behavior is covered by
 * cedar.test.ts / shadowEval.test.ts / per-platform policy tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

interface Wiring {
  platform: string;
  method: string;
  relPath: string;
}

const WIRINGS: Wiring[] = [
  // Thea Health — 3
  { platform: 'thea-health', method: 'GET',   relPath: 'app/api/opd/encounters/[encounterCoreId]/route.ts' },
  { platform: 'thea-health', method: 'PATCH', relPath: 'app/api/opd/encounters/[encounterCoreId]/route.ts' },
  { platform: 'thea-health', method: 'GET',   relPath: 'app/api/lab/results/route.ts' },
  // CVision — 3
  { platform: 'cvision',     method: 'GET',   relPath: 'app/api/cvision/employees/[id]/route.ts' },
  { platform: 'cvision',     method: 'GET',   relPath: 'app/api/cvision/employees/route.ts' },
  { platform: 'cvision',     method: 'POST',  relPath: 'app/api/cvision/payroll/runs/[id]/approve/route.ts' },
  // Imdad — 3
  { platform: 'imdad',       method: 'POST',  relPath: 'app/api/imdad/procurement/purchase-orders/route.ts' },
  { platform: 'imdad',       method: 'GET',   relPath: 'app/api/imdad/procurement/purchase-orders/[id]/route.ts' },
  { platform: 'imdad',       method: 'PATCH', relPath: 'app/api/imdad/procurement/purchase-orders/[id]/route.ts' },
  // SAM — 3
  { platform: 'sam',         method: 'POST',  relPath: 'app/api/sam/drafts/[draftId]/publish/route.ts' },
  { platform: 'sam',         method: 'GET',   relPath: 'app/api/sam/policies/[policyId]/acknowledge/route.ts' },
  { platform: 'sam',         method: 'POST',  relPath: 'app/api/sam/policies/[policyId]/acknowledge/route.ts' },
];

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}

describe('Phase 7.6 — platform shadow-eval wiring (source inspection)', () => {
  // 12 it-cases — one per wired HTTP method × file
  for (const w of WIRINGS) {
    it(`${w.platform} ${w.method} ${w.relPath} imports + calls shadowEvaluate`, () => {
      const src = read(w.relPath);
      // (1) imports shadowEvaluate from @/lib/policy
      expect(src).toMatch(/from\s+['"]@\/lib\/policy['"]/);
      expect(src).toMatch(/import\s*\{[^}]*\bshadowEvaluate\b[^}]*\}/);
      // (2) contains at least one fire-and-forget call site
      expect(countOccurrences(src, 'void shadowEvaluate(')).toBeGreaterThanOrEqual(1);
    });
  }
});
