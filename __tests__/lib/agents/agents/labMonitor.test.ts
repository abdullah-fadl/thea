/**
 * Phase 8.3 — LabResultMonitorAgent tests (8 cases)
 *
 *  1. Flag OFF → registerLabMonitorAgent() is a no-op (registry empty)
 *  2. Critical hypoglycemia (glucose 30) flags + emits clinical.alert@v1
 *  3. Critical hyperkalemia (K 6.8) flags
 *  4. Critical hyponatremia (Na 110) flags
 *  5. Critical anemia (Hgb 5.5) flags
 *  6. Critical thrombocytopenia (Plt 12) flags
 *  7. Negative case: glucose 95 within range → flagged: false, no event
 *  8. Negative case: testCode unrelated to any rule → flagged: false
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockRunCreate = vi.fn().mockResolvedValue({ id: 'lab-mon-run-1' });
const mockRunUpdate = vi.fn().mockResolvedValue({});
const mockLabResultFindUnique = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    agentRun: {
      create: (...a: unknown[]) => mockRunCreate(...a),
      update: (...a: unknown[]) => mockRunUpdate(...a),
    },
    agentToolCall: { create: vi.fn().mockResolvedValue({ id: 'tc-lm' }) },
    labResult: {
      findUnique: (...a: unknown[]) => mockLabResultFindUnique(...a),
    },
  },
}));

const mockEmit = vi.fn().mockResolvedValue({ skipped: true });
vi.mock('@/lib/events/emit', () => ({ emit: (...a: unknown[]) => mockEmit(...a) }));

vi.mock('@/lib/policy/shadowEval', () => ({
  shadowEvaluate: vi.fn().mockResolvedValue(undefined),
}));

import { runAgent } from '@/lib/agents/framework/run';
import { listAgents, _resetRegistryForTest } from '@/lib/agents/framework/registry';
import { _resetToolsForTest } from '@/lib/agents/framework/tools';
import {
  registerLabMonitorAgent,
  LAB_MONITOR_AGENT_KEY,
} from '@/lib/agents/agents/labMonitor';

function enableFlag()  { process.env[FLAGS.FF_AI_AGENTS_ENABLED] = 'true'; }
function disableFlag() { delete process.env[FLAGS.FF_AI_AGENTS_ENABLED]; }

const TENANT = '11111111-2222-4333-8444-555555555555';
const LAB_RESULT_ID = '99999999-aaaa-4bbb-8ccc-dddddddddddd';

function mockResult(parameters: Array<{ name: string; value: number; unit?: string }>): void {
  mockLabResultFindUnique.mockResolvedValue({
    id: LAB_RESULT_ID,
    tenantId: TENANT,
    patientId: '12345678-1234-4234-8234-123456789012',
    encounterId: null,
    testCode: parameters[0]?.name ?? 'unknown',
    testName: parameters[0]?.name ?? 'unknown',
    parameters,
  });
}

describe('LabResultMonitorAgent', () => {
  beforeEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    vi.clearAllMocks();
    enableFlag();
    registerLabMonitorAgent();
  });

  afterEach(() => {
    _resetRegistryForTest();
    _resetToolsForTest();
    disableFlag();
  });

  it('1. flag OFF — registerLabMonitorAgent() is a no-op (registry empty)', () => {
    _resetRegistryForTest();
    disableFlag();
    registerLabMonitorAgent();
    enableFlag();
    expect(listAgents().some((a) => a.key === LAB_MONITOR_AGENT_KEY)).toBe(false);
  });

  it('2. critical hypoglycemia (glucose 30) flags + emits clinical.alert@v1', async () => {
    mockResult([{ name: 'Glucose', value: 30, unit: 'mg/dL' }]);

    const result = await runAgent({
      agentKey: LAB_MONITOR_AGENT_KEY,
      input: { labResultId: LAB_RESULT_ID },
      tenantId: TENANT,
    });

    expect(result.status).toBe('success');
    const out = result.output as { flagged: boolean; rule: string; severity: string; value: number };
    expect(out.flagged).toBe(true);
    expect(out.rule).toBe('critical_hypoglycemia');
    expect(out.severity).toBe('critical');
    expect(out.value).toBe(30);

    const alertCall = mockEmit.mock.calls.find((c) => {
      const [arg] = c as [{ eventName?: string }];
      return arg?.eventName === 'clinical.alert';
    });
    expect(alertCall).toBeDefined();
    const [alertArgs] = alertCall as [
      { payload: { alertType: string; severity: string; rule: string; subjectType: string } },
    ];
    expect(alertArgs.payload.alertType).toBe('critical_lab');
    expect(alertArgs.payload.severity).toBe('critical');
    expect(alertArgs.payload.rule).toBe('critical_hypoglycemia');
    expect(alertArgs.payload.subjectType).toBe('lab_result');
  });

  it('3. critical hyperkalemia (K 6.8) flags', async () => {
    mockResult([{ name: 'Potassium', value: 6.8, unit: 'mmol/L' }]);
    const result = await runAgent({
      agentKey: LAB_MONITOR_AGENT_KEY,
      input: { labResultId: LAB_RESULT_ID },
      tenantId: TENANT,
    });
    const out = result.output as { flagged: boolean; rule: string };
    expect(out.flagged).toBe(true);
    expect(out.rule).toBe('critical_hyperkalemia');
  });

  it('4. critical hyponatremia (Na 110) flags', async () => {
    mockResult([{ name: 'Sodium', value: 110, unit: 'mmol/L' }]);
    const result = await runAgent({
      agentKey: LAB_MONITOR_AGENT_KEY,
      input: { labResultId: LAB_RESULT_ID },
      tenantId: TENANT,
    });
    const out = result.output as { flagged: boolean; rule: string };
    expect(out.flagged).toBe(true);
    expect(out.rule).toBe('critical_hyponatremia');
  });

  it('5. critical anemia (Hgb 5.5) flags', async () => {
    mockResult([{ name: 'Hemoglobin', value: 5.5, unit: 'g/dL' }]);
    const result = await runAgent({
      agentKey: LAB_MONITOR_AGENT_KEY,
      input: { labResultId: LAB_RESULT_ID },
      tenantId: TENANT,
    });
    const out = result.output as { flagged: boolean; rule: string };
    expect(out.flagged).toBe(true);
    expect(out.rule).toBe('critical_anemia');
  });

  it('6. critical thrombocytopenia (Plt 12) flags', async () => {
    mockResult([{ name: 'Platelets', value: 12, unit: '10^3/uL' }]);
    const result = await runAgent({
      agentKey: LAB_MONITOR_AGENT_KEY,
      input: { labResultId: LAB_RESULT_ID },
      tenantId: TENANT,
    });
    const out = result.output as { flagged: boolean; rule: string };
    expect(out.flagged).toBe(true);
    expect(out.rule).toBe('critical_thrombocytopenia');
  });

  it('7. glucose 95 within normal range → flagged: false, no clinical.alert event', async () => {
    mockResult([{ name: 'Glucose', value: 95, unit: 'mg/dL' }]);
    const result = await runAgent({
      agentKey: LAB_MONITOR_AGENT_KEY,
      input: { labResultId: LAB_RESULT_ID },
      tenantId: TENANT,
    });
    const out = result.output as { flagged: boolean; suggestion: boolean };
    expect(out.suggestion).toBe(true);
    expect(out.flagged).toBe(false);

    const alertCall = mockEmit.mock.calls.find((c) => {
      const [arg] = c as [{ eventName?: string }];
      return arg?.eventName === 'clinical.alert';
    });
    expect(alertCall).toBeUndefined();
  });

  it('8. unrelated analyte (Cholesterol 220) → flagged: false, no event', async () => {
    mockResult([{ name: 'Cholesterol Total', value: 220, unit: 'mg/dL' }]);
    const result = await runAgent({
      agentKey: LAB_MONITOR_AGENT_KEY,
      input: { labResultId: LAB_RESULT_ID },
      tenantId: TENANT,
    });
    const out = result.output as { flagged: boolean };
    expect(out.flagged).toBe(false);

    const alertCall = mockEmit.mock.calls.find((c) => {
      const [arg] = c as [{ eventName?: string }];
      return arg?.eventName === 'clinical.alert';
    });
    expect(alertCall).toBeUndefined();
  });
});
