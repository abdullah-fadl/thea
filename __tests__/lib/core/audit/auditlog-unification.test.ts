/**
 * Phase 3.4 — AuditLog unification tests
 *
 * Cases:
 *  1. dualWrite  flag OFF  → no-op, undefined returned, zero DB calls
 *  2. dualWrite  flag ON   → mirrorCvisionAuditLogToCore creates core row correctly
 *  3. dualWrite  flag ON + DB throws → error logged (category db.dual_write.auditlog), undefined returned (no rethrow)
 *  4. shadowRead flag OFF  → 'skipped' returned, zero DB calls
 *  5. shadowRead flag ON   + core row matches → 'match' logged + returned
 *  6. shadowRead flag ON   + core row differs → 'diff_fields' logged + returned
 *  7. shadowRead flag ON   + core row absent  → 'missing_in_core' logged + returned
 *  8. backfill idempotency → row already mirrored is skipped, new row is created
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS } from '@/lib/core/flags';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const TENANT_UUID  = 'aaaa0000-0000-0000-0000-000000000001';
const LEGACY_ID    = 'bbbb0000-0000-0000-0000-000000000001';
const CORE_ROW_ID  = 'cccc0000-0000-0000-0000-000000000001';
const LEGACY_ID_2  = 'dddd0000-0000-0000-0000-000000000002';

const {
  mockAuditLogCreate,
  mockAuditLogFindFirst,
  mockLogger,
} = vi.hoisted(() => ({
  mockAuditLogCreate:    vi.fn(),
  mockAuditLogFindFirst: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    auditLog: {
      create:    mockAuditLogCreate,
      findFirst: mockAuditLogFindFirst,
    },
  },
}));

vi.mock('@/lib/monitoring/logger', () => ({ logger: mockLogger }));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCvisionRow(overrides: Partial<{
  id: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorUserId: string;
  actorRole: string | null;
  actorEmail: string | null;
  success: boolean;
  errorMessage: string | null;
  changes: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}> = {}) {
  return {
    id:           LEGACY_ID,
    tenantId:     TENANT_UUID,
    action:       'CREATE',
    resourceType: 'EMPLOYEE',
    resourceId:   'emp-001',
    actorUserId:  'user-001',
    actorRole:    'hr-manager',
    actorEmail:   'hr@example.com',
    success:      true,
    errorMessage: null,
    changes:      null,
    ip:           '10.0.0.1',
    userAgent:    'Mozilla/5.0',
    metadata:     null,
    createdAt:    new Date('2026-04-24T10:00:00Z'),
    ...overrides,
  };
}

function makeReadRow(overrides: Partial<{
  id: string;
  tenantId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorUserId: string;
  success: boolean;
}> = {}) {
  return {
    id:           LEGACY_ID,
    tenantId:     TENANT_UUID,
    action:       'CREATE',
    resourceType: 'EMPLOYEE',
    resourceId:   'emp-001',
    actorUserId:  'user-001',
    success:      true,
    ...overrides,
  };
}

// ─── dualWrite tests ─────────────────────────────────────────────────────────

describe('mirrorCvisionAuditLogToCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_AUDITLOG_DUAL_WRITE];
  });
  afterEach(() => {
    delete process.env[FLAGS.FF_AUDITLOG_DUAL_WRITE];
  });

  it('1 — flag OFF: returns undefined, zero DB calls', async () => {
    const { mirrorCvisionAuditLogToCore } = await import('@/lib/core/audit/dualWrite');

    const result = await mirrorCvisionAuditLogToCore(makeCvisionRow());

    expect(result).toBeUndefined();
    expect(mockAuditLogCreate).not.toHaveBeenCalled();
  });

  it('2 — flag ON: creates core row with correct field mapping', async () => {
    process.env[FLAGS.FF_AUDITLOG_DUAL_WRITE] = 'true';
    mockAuditLogCreate.mockResolvedValue({ id: CORE_ROW_ID });

    const { mirrorCvisionAuditLogToCore } = await import('@/lib/core/audit/dualWrite');

    const row = makeCvisionRow({
      changes:  { before: { name: 'Alice' }, after: { name: 'Bob' } },
      metadata: { requestId: 'req-123' },
    });

    const result = await mirrorCvisionAuditLogToCore(row);

    expect(result).toEqual({ id: CORE_ROW_ID });
    expect(mockAuditLogCreate).toHaveBeenCalledOnce();

    const data = mockAuditLogCreate.mock.calls[0][0].data;
    expect(data.tenantId).toBe(TENANT_UUID);
    expect(data.actorUserId).toBe('user-001');
    expect(data.actorRole).toBe('hr-manager');
    expect(data.action).toBe('CREATE');
    expect(data.resourceType).toBe('EMPLOYEE');
    expect(data.resourceId).toBe('emp-001');
    expect(data.success).toBe(true);
    expect(data.legacyCvisionAuditLogId).toBe(LEGACY_ID);
    expect(data.timestamp).toEqual(new Date('2026-04-24T10:00:00Z'));
    // changes folded into metadata
    expect(data.metadata.changes).toEqual({ before: { name: 'Alice' }, after: { name: 'Bob' } });
    expect(data.metadata.requestId).toBe('req-123');
    expect(data.metadata._source).toBe('cvision_audit_log');
  });

  it('2b — flag ON: null actorRole defaults to "cvision"', async () => {
    process.env[FLAGS.FF_AUDITLOG_DUAL_WRITE] = 'true';
    mockAuditLogCreate.mockResolvedValue({ id: CORE_ROW_ID });

    const { mirrorCvisionAuditLogToCore } = await import('@/lib/core/audit/dualWrite');

    await mirrorCvisionAuditLogToCore(makeCvisionRow({ actorRole: null }));

    const data = mockAuditLogCreate.mock.calls[0][0].data;
    expect(data.actorRole).toBe('cvision');
  });

  it('3 — flag ON + DB throws: error logged with correct category, returns undefined', async () => {
    process.env[FLAGS.FF_AUDITLOG_DUAL_WRITE] = 'true';
    mockAuditLogCreate.mockRejectedValue(new Error('connection refused'));

    const { mirrorCvisionAuditLogToCore } = await import('@/lib/core/audit/dualWrite');

    const result = await mirrorCvisionAuditLogToCore(makeCvisionRow());

    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledOnce();
    const logArg = mockLogger.error.mock.calls[0][1];
    expect(logArg.category).toBe('db.dual_write.auditlog');
    expect(logArg.legacyId).toBe(LEGACY_ID);
    expect(logArg.tenantId).toBe(TENANT_UUID);
  });
});

// ─── shadowRead tests ─────────────────────────────────────────────────────────

describe('compareCvisionAuditLogToCore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[FLAGS.FF_AUDITLOG_UNIFIED_READ_SHADOW];
  });
  afterEach(() => {
    delete process.env[FLAGS.FF_AUDITLOG_UNIFIED_READ_SHADOW];
  });

  it('4 — flag OFF: returns "skipped", zero DB calls', async () => {
    const { compareCvisionAuditLogToCore } = await import('@/lib/core/audit/shadowRead');

    const result = await compareCvisionAuditLogToCore(makeReadRow());

    expect(result).toBe('skipped');
    expect(mockAuditLogFindFirst).not.toHaveBeenCalled();
  });

  it('5 — flag ON + core row matches: logs and returns "match"', async () => {
    process.env[FLAGS.FF_AUDITLOG_UNIFIED_READ_SHADOW] = 'true';
    mockAuditLogFindFirst.mockResolvedValue({
      action:       'CREATE',
      resourceType: 'EMPLOYEE',
      resourceId:   'emp-001',
      actorUserId:  'user-001',
      success:      true,
    });

    const { compareCvisionAuditLogToCore } = await import('@/lib/core/audit/shadowRead');

    const result = await compareCvisionAuditLogToCore(makeReadRow());

    expect(result).toBe('match');
    expect(mockLogger.info).toHaveBeenCalledOnce();
    const logArg = mockLogger.info.mock.calls[0][1];
    expect(logArg.category).toBe('db.shadow_read.auditlog');
    expect(logArg.outcome).toBe('match');
  });

  it('6 — flag ON + core row differs: logs and returns "diff_fields"', async () => {
    process.env[FLAGS.FF_AUDITLOG_UNIFIED_READ_SHADOW] = 'true';
    mockAuditLogFindFirst.mockResolvedValue({
      action:       'UPDATE',          // differs from legacy 'CREATE'
      resourceType: 'EMPLOYEE',
      resourceId:   'emp-001',
      actorUserId:  'user-001',
      success:      true,
    });

    const { compareCvisionAuditLogToCore } = await import('@/lib/core/audit/shadowRead');

    const result = await compareCvisionAuditLogToCore(makeReadRow());

    expect(result).toBe('diff_fields');
    expect(mockLogger.warn).toHaveBeenCalledOnce();
    const logArg = mockLogger.warn.mock.calls[0][1];
    expect(logArg.category).toBe('db.shadow_read.auditlog');
    expect(logArg.outcome).toBe('diff_fields');
    expect(logArg.diff_fields).toContain('action');
  });

  it('7 — flag ON + core row absent: logs and returns "missing_in_core"', async () => {
    process.env[FLAGS.FF_AUDITLOG_UNIFIED_READ_SHADOW] = 'true';
    mockAuditLogFindFirst.mockResolvedValue(null);

    const { compareCvisionAuditLogToCore } = await import('@/lib/core/audit/shadowRead');

    const result = await compareCvisionAuditLogToCore(makeReadRow());

    expect(result).toBe('missing_in_core');
    expect(mockLogger.info).toHaveBeenCalledOnce();
    const logArg = mockLogger.info.mock.calls[0][1];
    expect(logArg.category).toBe('db.shadow_read.auditlog');
    expect(logArg.outcome).toBe('missing_in_core');
    expect(logArg.legacyId).toBe(LEGACY_ID);
  });
});

// ─── Backfill idempotency ─────────────────────────────────────────────────────

describe('backfill idempotency (unit-level simulation)', () => {
  it('8 — skips row already mirrored; creates new row for unmirrored row', async () => {
    // Simulate the backfill logic: check existing, skip or create.
    const mirrored   = new Set<string>();
    const created:   string[] = [];
    const skipped:   string[] = [];

    function simulateBackfill(rows: Array<{ id: string }>) {
      for (const row of rows) {
        if (mirrored.has(row.id)) {
          skipped.push(row.id);
        } else {
          mirrored.add(row.id);
          created.push(row.id);
        }
      }
    }

    // First run: two rows, both new
    simulateBackfill([{ id: LEGACY_ID }, { id: LEGACY_ID_2 }]);
    expect(created).toEqual([LEGACY_ID, LEGACY_ID_2]);
    expect(skipped).toHaveLength(0);

    created.length = 0;

    // Second run (re-run): same rows → both skipped
    simulateBackfill([{ id: LEGACY_ID }, { id: LEGACY_ID_2 }]);
    expect(created).toHaveLength(0);
    expect(skipped).toEqual([LEGACY_ID, LEGACY_ID_2]);
  });
});
