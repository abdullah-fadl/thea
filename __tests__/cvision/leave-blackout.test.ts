/**
 * CVision Leave Blackout & Carry-Over Tests
 *
 * Tests for blackout period validation schemas and carry-over logic.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ─── Blackout Schema (from blackout/route.ts) ───────────────────────────────

const createBlackoutSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  nameAr: z.string().max(200).trim().default(''),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(1000).trim().default(''),
  reasonAr: z.string().max(1000).trim().default(''),
  scope: z.enum(['ALL', 'DEPARTMENT', 'UNIT']).default('ALL'),
  scopeIds: z.array(z.string()).default([]),
  exemptRoles: z.array(z.string()).default([]),
  leaveTypes: z.array(z.string()).default([]),
});

// ─── Carry-Over Schema (from carry-over/route.ts) ───────────────────────────

const carryOverSchema = z.object({
  action: z.enum(['preview', 'execute']),
  fromYear: z.number().int().min(2020).max(2040),
  toYear: z.number().int().min(2021).max(2041),
}).refine(d => d.toYear === d.fromYear + 1, { message: 'toYear must be fromYear + 1' });

// ─── Carry-Over Logic ───────────────────────────────────────────────────────

function calculateCarryOver(entitled: number, used: number, maxCarryOver = 15): number {
  return Math.min(Math.max(entitled - used, 0), maxCarryOver);
}

// ─── Blackout Overlap Check ─────────────────────────────────────────────────

function isBlackoutBlocking(
  blackout: { startDate: Date; endDate: Date; scope: string; scopeIds: string[]; exemptRoles: string[]; leaveTypes: string[]; isActive: boolean },
  leaveStart: Date,
  leaveEnd: Date,
  employeeDeptId: string,
  employeeRole: string,
  leaveType: string,
): boolean {
  if (!blackout.isActive) return false;
  // Date overlap check
  if (blackout.endDate < leaveStart || blackout.startDate > leaveEnd) return false;
  // Exempt role check
  if (blackout.exemptRoles.includes(employeeRole)) return false;
  // Leave type check (empty = all types blocked)
  if (blackout.leaveTypes.length > 0 && !blackout.leaveTypes.includes(leaveType)) return false;
  // Scope check
  if (blackout.scope === 'ALL') return true;
  if (blackout.scope === 'DEPARTMENT') return blackout.scopeIds.includes(employeeDeptId);
  return false;
}

// ─── Blackout Schema Tests ──────────────────────────────────────────────────

describe('createBlackoutSchema', () => {
  it('should accept valid blackout with minimal fields', () => {
    const result = createBlackoutSchema.safeParse({
      name: 'Ramadan Freeze',
      startDate: '2026-03-01',
      endDate: '2026-03-30',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scope).toBe('ALL');
      expect(result.data.exemptRoles).toEqual([]);
      expect(result.data.leaveTypes).toEqual([]);
    }
  });

  it('should accept full blackout with all fields', () => {
    const result = createBlackoutSchema.safeParse({
      name: 'Year-End Freeze',
      nameAr: 'تجميد نهاية السنة',
      startDate: '2026-12-20',
      endDate: '2026-12-31',
      reason: 'Year-end closing',
      reasonAr: 'إغلاق نهاية السنة',
      scope: 'DEPARTMENT',
      scopeIds: ['dept-1', 'dept-2'],
      exemptRoles: ['HR_ADMIN'],
      leaveTypes: ['ANNUAL'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = createBlackoutSchema.safeParse({
      name: '',
      startDate: '2026-03-01',
      endDate: '2026-03-30',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing startDate', () => {
    const result = createBlackoutSchema.safeParse({
      name: 'Test',
      endDate: '2026-03-30',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid scope', () => {
    const result = createBlackoutSchema.safeParse({
      name: 'Test',
      startDate: '2026-03-01',
      endDate: '2026-03-30',
      scope: 'GLOBAL',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Carry-Over Schema Tests ────────────────────────────────────────────────

describe('carryOverSchema', () => {
  it('should accept valid carry-over request', () => {
    const result = carryOverSchema.safeParse({ action: 'preview', fromYear: 2025, toYear: 2026 });
    expect(result.success).toBe(true);
  });

  it('should reject non-consecutive years', () => {
    const result = carryOverSchema.safeParse({ action: 'execute', fromYear: 2025, toYear: 2028 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid action', () => {
    const result = carryOverSchema.safeParse({ action: 'delete', fromYear: 2025, toYear: 2026 });
    expect(result.success).toBe(false);
  });

  it('should reject fromYear below 2020', () => {
    const result = carryOverSchema.safeParse({ action: 'preview', fromYear: 2019, toYear: 2020 });
    expect(result.success).toBe(false);
  });
});

// ─── Carry-Over Calculation Tests ───────────────────────────────────────────

describe('calculateCarryOver', () => {
  it('should carry over remaining days up to max 15', () => {
    expect(calculateCarryOver(30, 10)).toBe(15); // 20 remaining, capped at 15
  });

  it('should carry over exact remaining when under cap', () => {
    expect(calculateCarryOver(21, 15)).toBe(6); // 6 remaining
  });

  it('should return 0 when all days used', () => {
    expect(calculateCarryOver(21, 21)).toBe(0);
  });

  it('should return 0 when used exceeds entitled', () => {
    expect(calculateCarryOver(21, 25)).toBe(0);
  });

  it('should cap at 15 days per Saudi labor law', () => {
    expect(calculateCarryOver(30, 0)).toBe(15); // 30 remaining, capped
  });

  it('should handle custom max carry-over', () => {
    expect(calculateCarryOver(30, 10, 10)).toBe(10); // Custom cap of 10
  });
});

// ─── Blackout Blocking Logic Tests ──────────────────────────────────────────

describe('isBlackoutBlocking', () => {
  const baseBlackout = {
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-31'),
    scope: 'ALL' as const,
    scopeIds: [],
    exemptRoles: [],
    leaveTypes: [],
    isActive: true,
  };

  it('should block leave that overlaps with blackout', () => {
    expect(isBlackoutBlocking(
      baseBlackout,
      new Date('2026-03-10'), new Date('2026-03-15'),
      'dept-1', 'EMPLOYEE', 'ANNUAL',
    )).toBe(true);
  });

  it('should NOT block leave outside blackout dates', () => {
    expect(isBlackoutBlocking(
      baseBlackout,
      new Date('2026-04-01'), new Date('2026-04-10'),
      'dept-1', 'EMPLOYEE', 'ANNUAL',
    )).toBe(false);
  });

  it('should NOT block exempt roles', () => {
    const blackout = { ...baseBlackout, exemptRoles: ['HR_ADMIN'] };
    expect(isBlackoutBlocking(
      blackout,
      new Date('2026-03-10'), new Date('2026-03-15'),
      'dept-1', 'HR_ADMIN', 'ANNUAL',
    )).toBe(false);
  });

  it('should NOT block non-targeted leave types', () => {
    const blackout = { ...baseBlackout, leaveTypes: ['ANNUAL'] };
    expect(isBlackoutBlocking(
      blackout,
      new Date('2026-03-10'), new Date('2026-03-15'),
      'dept-1', 'EMPLOYEE', 'SICK',
    )).toBe(false);
  });

  it('should block targeted leave type', () => {
    const blackout = { ...baseBlackout, leaveTypes: ['ANNUAL'] };
    expect(isBlackoutBlocking(
      blackout,
      new Date('2026-03-10'), new Date('2026-03-15'),
      'dept-1', 'EMPLOYEE', 'ANNUAL',
    )).toBe(true);
  });

  it('should only block scoped department', () => {
    const blackout = { ...baseBlackout, scope: 'DEPARTMENT' as const, scopeIds: ['dept-finance'] };
    expect(isBlackoutBlocking(
      blackout,
      new Date('2026-03-10'), new Date('2026-03-15'),
      'dept-finance', 'EMPLOYEE', 'ANNUAL',
    )).toBe(true);
    expect(isBlackoutBlocking(
      blackout,
      new Date('2026-03-10'), new Date('2026-03-15'),
      'dept-hr', 'EMPLOYEE', 'ANNUAL',
    )).toBe(false);
  });

  it('should NOT block when inactive', () => {
    const blackout = { ...baseBlackout, isActive: false };
    expect(isBlackoutBlocking(
      blackout,
      new Date('2026-03-10'), new Date('2026-03-15'),
      'dept-1', 'EMPLOYEE', 'ANNUAL',
    )).toBe(false);
  });

  it('should block partial overlap (leave starts before blackout ends)', () => {
    expect(isBlackoutBlocking(
      baseBlackout,
      new Date('2026-03-28'), new Date('2026-04-05'),
      'dept-1', 'EMPLOYEE', 'ANNUAL',
    )).toBe(true);
  });
});
