/**
 * Phase 3.3 — Staff Identity FK tests
 *
 * Cases:
 *  1. Migration SQL shape: has NOT VALID, DEFERRABLE INITIALLY DEFERRED, no VALIDATE CONSTRAINT
 *  2. Manual SQL (validate_staff_fk.sql): contains VALIDATE CONSTRAINT, no NOT VALID
 *  3. Flag OFF: FF_STAFF_FK_ENFORCED unset → isEnabled returns false, existing code path unchanged
 *  4. Flag ON + mocked Prisma: user relation accessor resolves linked User row
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FLAGS, isEnabled } from '@/lib/core/flags';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIGRATION_SQL_PATH = path.resolve(
  __dirname,
  '../../../../prisma/schema/migrations/20260424000004_staff_identity_fk_not_valid/migration.sql',
);

const MANUAL_SQL_PATH = path.resolve(
  __dirname,
  '../../../../prisma/schema/migrations/manual/validate_staff_fk.sql',
);

const USER_ID   = 'bbbb0000-0000-0000-0000-000000000001';
const EMP_ID    = 'eeee0000-0000-0000-0000-000000000001';
const TENANT_ID = 'tttt0000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFindUnique } = vi.hoisted(() => {
  const mockFindUnique = vi.fn();
  return { mockFindUnique };
});

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    cvisionEmployee: {
      findUnique: mockFindUnique,
    },
  },
}));

// ---------------------------------------------------------------------------
// Case 1 — Migration SQL shape
// ---------------------------------------------------------------------------

describe('Phase 3.3 migration SQL — 20260424000004_staff_identity_fk_not_valid', () => {
  let sql: string;

  beforeEach(() => {
    sql = readFileSync(MIGRATION_SQL_PATH, 'utf-8');
  });

  it('1a — contains ADD CONSTRAINT clause', () => {
    expect(sql).toMatch(/ADD CONSTRAINT\s+"cvision_employees_userId_fkey"/i);
  });

  it('1b — constraint references users(id)', () => {
    expect(sql).toMatch(/REFERENCES\s+"users"\s*\(\s*"id"\s*\)/i);
  });

  it('1c — constraint is NOT VALID (skips table scan, no lock)', () => {
    expect(sql).toMatch(/\bNOT\s+VALID\b/i);
  });

  it('1d — constraint is DEFERRABLE INITIALLY DEFERRED', () => {
    expect(sql).toMatch(/\bDEFERRABLE\s+INITIALLY\s+DEFERRED\b/i);
  });

  it('1e — does NOT contain VALIDATE CONSTRAINT (must stay in manual file)', () => {
    expect(sql).not.toMatch(/\bVALIDATE\s+CONSTRAINT\b/i);
  });

  it('1f — does NOT contain DROP, RENAME, TRUNCATE, DELETE FROM in executable SQL', () => {
    // Strip comment lines before checking — comments documenting what we avoid are fine.
    const executableLines = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(executableLines).not.toMatch(/\bDROP\b/i);
    expect(executableLines).not.toMatch(/\bRENAME\b/i);
    expect(executableLines).not.toMatch(/\bTRUNCATE\b/i);
    expect(executableLines).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});

// ---------------------------------------------------------------------------
// Case 2 — Manual VALIDATE SQL shape
// ---------------------------------------------------------------------------

describe('Phase 3.3 manual SQL — validate_staff_fk.sql', () => {
  let sql: string;

  beforeEach(() => {
    sql = readFileSync(MANUAL_SQL_PATH, 'utf-8');
  });

  it('2a — contains VALIDATE CONSTRAINT', () => {
    expect(sql).toMatch(/\bVALIDATE\s+CONSTRAINT\b/i);
  });

  it('2b — references the correct constraint name', () => {
    expect(sql).toMatch(/"cvision_employees_userId_fkey"/);
  });

  it('2c — does NOT contain NOT VALID (that belongs in migration 1 only)', () => {
    // Comments are allowed; check only non-comment lines.
    const nonCommentLines = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'));
    const joined = nonCommentLines.join('\n');
    expect(joined).not.toMatch(/\bNOT\s+VALID\b/i);
  });
});

// ---------------------------------------------------------------------------
// Case 3 — Flag OFF: FF_STAFF_FK_ENFORCED unset → isEnabled returns false
// ---------------------------------------------------------------------------

describe('Phase 3.3 flag — FF_STAFF_FK_ENFORCED', () => {
  afterEach(() => {
    delete process.env[FLAGS.FF_STAFF_FK_ENFORCED];
  });

  it('3a — flag absent → isEnabled returns false', () => {
    delete process.env[FLAGS.FF_STAFF_FK_ENFORCED];
    expect(isEnabled('FF_STAFF_FK_ENFORCED')).toBe(false);
  });

  it('3b — flag set to "false" → isEnabled returns false', () => {
    process.env[FLAGS.FF_STAFF_FK_ENFORCED] = 'false';
    expect(isEnabled('FF_STAFF_FK_ENFORCED')).toBe(false);
  });

  it('3c — flag set to "true" → isEnabled returns true', () => {
    process.env[FLAGS.FF_STAFF_FK_ENFORCED] = 'true';
    expect(isEnabled('FF_STAFF_FK_ENFORCED')).toBe(true);
  });

  it('3d — flag key exists in FLAGS registry', () => {
    expect(FLAGS.FF_STAFF_FK_ENFORCED).toBe('THEA_FF_STAFF_FK_ENFORCED');
  });
});

// ---------------------------------------------------------------------------
// Case 4 — Flag ON + mocked Prisma: user relation accessor returns linked User
// ---------------------------------------------------------------------------

describe('Phase 3.3 relation smoke test — user accessor (flag ON)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env[FLAGS.FF_STAFF_FK_ENFORCED] = 'true';
  });

  afterEach(() => {
    delete process.env[FLAGS.FF_STAFF_FK_ENFORCED];
  });

  it('4a — findUnique with include:user returns populated user field', async () => {
    const mockUser = {
      id:        USER_ID,
      email:     'jane@thea.com.sa',
      firstName: 'Jane',
      lastName:  'Smith',
      role:      'staff',
      tenantId:  TENANT_ID,
      isActive:  true,
    };

    const mockEmployee = {
      id:        EMP_ID,
      tenantId:  TENANT_ID,
      employeeNo: 'EMP-001',
      firstName: 'Jane',
      lastName:  'Smith',
      status:    'ACTIVE',
      userId:    USER_ID,
      user:      mockUser,
    };

    mockFindUnique.mockResolvedValueOnce(mockEmployee);

    const { prisma } = await import('@/lib/db/prisma');

    const result = await prisma.cvisionEmployee.findUnique({
      where: { id: EMP_ID },
      include: { user: isEnabled('FF_STAFF_FK_ENFORCED') },
    });

    expect(result).not.toBeNull();
    expect(result?.user).toBeDefined();
    expect(result?.user?.id).toBe(USER_ID);
    expect(result?.user?.email).toBe('jane@thea.com.sa');
    expect(mockFindUnique).toHaveBeenCalledOnce();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: EMP_ID },
      include: { user: true },
    });
  });

  it('4b — findUnique when flag OFF → include:false, user field absent', async () => {
    process.env[FLAGS.FF_STAFF_FK_ENFORCED] = 'false';

    const mockEmployeeNoUser = {
      id:         EMP_ID,
      tenantId:   TENANT_ID,
      employeeNo: 'EMP-001',
      firstName:  'Jane',
      lastName:   'Smith',
      status:     'ACTIVE',
      userId:     USER_ID,
      // no `user` field — flag was OFF when the query ran
    };

    mockFindUnique.mockResolvedValueOnce(mockEmployeeNoUser);

    const { prisma } = await import('@/lib/db/prisma');

    const result = await prisma.cvisionEmployee.findUnique({
      where: { id: EMP_ID },
      include: { user: isEnabled('FF_STAFF_FK_ENFORCED') },
    });

    expect(result).not.toBeNull();
    expect((result as Record<string, unknown>)['user']).toBeUndefined();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: EMP_ID },
      include: { user: false },
    });
  });
});
