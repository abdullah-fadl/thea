import { describe, expect, it } from 'vitest';
import { computePxKpis, type PxCaseRow } from '@/lib/patient-experience/kpis';

const NOW = new Date('2026-04-27T12:00:00Z');

function caseRow(overrides: Partial<PxCaseRow>): PxCaseRow {
  return {
    id: 'c-' + Math.random().toString(36).slice(2, 8),
    status: 'OPEN',
    createdAt: '2026-04-20T10:00:00Z',
    ...overrides,
  };
}

describe('computePxKpis', () => {
  it('returns zeroed KPIs for an empty input', () => {
    const k = computePxKpis([], NOW);
    expect(k.total).toBe(0);
    expect(k.totalOpen).toBe(0);
    expect(k.totalInProgress).toBe(0);
    expect(k.totalResolved).toBe(0);
    expect(k.totalEscalated).toBe(0);
    expect(k.avgResolutionMinutes).toBeNull();
    expect(k.slaCompliancePct).toBeNull();
    expect(k.satisfactionScore).toBeNull();
    expect(k.satisfactionCount).toBe(0);
    expect(k.pendingEscalations).toBe(0);
    expect(k.trendingCategories).toEqual([]);
  });

  it('counts cases by status', () => {
    const rows: PxCaseRow[] = [
      caseRow({ status: 'OPEN' }),
      caseRow({ status: 'OPEN' }),
      caseRow({ status: 'IN_PROGRESS' }),
      caseRow({ status: 'RESOLVED' }),
      caseRow({ status: 'CLOSED' }),
      caseRow({ status: 'ESCALATED' }),
    ];
    const k = computePxKpis(rows, NOW);
    expect(k.total).toBe(6);
    expect(k.totalOpen).toBe(2);
    expect(k.totalInProgress).toBe(1);
    expect(k.totalResolved).toBe(1);
    expect(k.totalClosed).toBe(1);
    expect(k.totalEscalated).toBe(1);
  });

  it('averages resolutionMinutes only over rows that have one', () => {
    const k = computePxKpis(
      [
        caseRow({ resolutionMinutes: 60 }),
        caseRow({ resolutionMinutes: 120 }),
        caseRow({ resolutionMinutes: null }),
        caseRow({ resolutionMinutes: 30 }),
      ],
      NOW,
    );
    expect(k.avgResolutionMinutes).toBe(70); // (60+120+30)/3 = 70
  });

  it('computes SLA compliance: resolved on-time, resolved late, still-open within window', () => {
    const rows: PxCaseRow[] = [
      // resolved before due → compliant
      caseRow({
        dueAt: '2026-04-21T12:00:00Z',
        resolvedAt: '2026-04-21T10:00:00Z',
        status: 'RESOLVED',
      }),
      // resolved after due → breach
      caseRow({
        dueAt: '2026-04-21T12:00:00Z',
        resolvedAt: '2026-04-22T12:00:00Z',
        status: 'RESOLVED',
      }),
      // still open, due in the future → compliant (so far)
      caseRow({
        dueAt: '2026-04-30T12:00:00Z',
        resolvedAt: null,
        status: 'OPEN',
      }),
      // still open, past due → breach
      caseRow({
        dueAt: '2026-04-25T12:00:00Z',
        resolvedAt: null,
        status: 'OPEN',
      }),
      // no dueAt → excluded from SLA calc entirely
      caseRow({ dueAt: null, resolvedAt: null }),
    ];
    const k = computePxKpis(rows, NOW);
    // 4 had dueAt, 2 compliant → 50.0%
    expect(k.slaCompliancePct).toBe(50);
  });

  it('returns null SLA compliance when no rows have dueAt', () => {
    const k = computePxKpis([caseRow({ dueAt: null }), caseRow({ dueAt: null })], NOW);
    expect(k.slaCompliancePct).toBeNull();
  });

  it('averages satisfactionScore (rounded to 2 decimals)', () => {
    const k = computePxKpis(
      [
        caseRow({ satisfactionScore: 4 }),
        caseRow({ satisfactionScore: 5 }),
        caseRow({ satisfactionScore: 3 }),
        caseRow({ satisfactionScore: null }),
        caseRow({ satisfactionScore: 0 }), // 0 is treated as missing
      ],
      NOW,
    );
    // (4+5+3) / 3 = 4
    expect(k.satisfactionScore).toBe(4);
    expect(k.satisfactionCount).toBe(3);
  });

  it('counts pending escalations only for OPEN/IN_PROGRESS with escalationLevel > 0', () => {
    const k = computePxKpis(
      [
        caseRow({ status: 'OPEN', escalationLevel: 1 }),
        caseRow({ status: 'IN_PROGRESS', escalationLevel: 2 }),
        caseRow({ status: 'OPEN', escalationLevel: 0 }),
        caseRow({ status: 'RESOLVED', escalationLevel: 3 }), // resolved doesn't count
        caseRow({ status: 'ESCALATED', escalationLevel: 3 }), // already escalated, not "pending"
      ],
      NOW,
    );
    expect(k.pendingEscalations).toBe(2);
  });

  it('top-5s the trending categories by count, descending', () => {
    const rows: PxCaseRow[] = [
      ...Array(4).fill(0).map(() => caseRow({ categoryKey: 'billing' })),
      ...Array(2).fill(0).map(() => caseRow({ categoryKey: 'wait_time' })),
      caseRow({ categoryKey: 'food' }),
      caseRow({ categoryKey: 'food' }),
      caseRow({ categoryKey: 'food' }),
      caseRow({ categoryKey: null }),
    ];
    const k = computePxKpis(rows, NOW);
    expect(k.trendingCategories[0]).toEqual({ category: 'billing', count: 4 });
    expect(k.trendingCategories[1]).toEqual({ category: 'food', count: 3 });
    expect(k.trendingCategories[2]).toEqual({ category: 'wait_time', count: 2 });
    expect(k.trendingCategories.length).toBeLessThanOrEqual(5);
  });
});
