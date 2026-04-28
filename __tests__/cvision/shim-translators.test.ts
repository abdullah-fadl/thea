/**
 * Stage B T2 — Mongo→Prisma shim translator audit.
 *
 * Comprehensive coverage of the four pure translators in
 * lib/cvision/prisma-helpers.ts:
 *   - mongoFilterToPrisma  (filter ops:  $eq, $ne, $gt/gte/lt/lte, $in/nin,
 *                          $exists, $or/and/nor, $not, $regex)
 *   - mongoUpdateToPrisma  ($set, $unset, $inc, $setOnInsert; gap: $push/$pull)
 *   - mongoSortToPrisma    (asc/desc translation)
 *   - mongoProjectToPrisma (whitelist projection)
 *
 * Real-world operator usage (counted across app/api/cvision + lib/cvision):
 *   $set:705 $in:329 $or:239 $ne:216 $gte:175 $lte:101 $push:76 $exists:76
 *   $sum:73 $inc:52 $group:51 $regex:48 $match:48 $lt:45 $gt:35 $sort:23
 *   $setOnInsert:20 $and:18 $nin:16 $pull:10 $addToSet:10 $unset:7 $eq:4
 *
 * Known gaps (documented as `it.todo` or `it('gap: ...', ...)`) are surfaced
 * to the user in the Stage B T2 report rather than silently fixed where the
 * fix would change runtime semantics meaningfully.
 */

import { describe, it, expect } from 'vitest';
import {
  mongoFilterToPrisma,
  mongoUpdateToPrisma,
  mongoSortToPrisma,
  mongoProjectToPrisma,
} from '@/lib/cvision/prisma-helpers';

// ════════════════════════════════════════════════════════════════════════════
// mongoFilterToPrisma
// ════════════════════════════════════════════════════════════════════════════

describe('mongoFilterToPrisma — equality + comparison operators', () => {
  it('plain value → bare equality', () => {
    expect(mongoFilterToPrisma({ name: 'Sara' })).toEqual({ name: 'Sara' });
  });

  it('plain number value → bare equality', () => {
    expect(mongoFilterToPrisma({ age: 30 })).toEqual({ age: 30 });
  });

  it('plain null → null equality', () => {
    expect(mongoFilterToPrisma({ deletedAt: null })).toEqual({ deletedAt: null });
  });

  it('Date value → passes through', () => {
    const d = new Date('2026-01-01');
    expect(mongoFilterToPrisma({ createdAt: d })).toEqual({ createdAt: d });
  });

  it('$eq is recognized as equality (post-fix)', () => {
    // Mongo: { name: { $eq: 'x' } } === { name: 'x' }
    // Prisma: { name: { equals: 'x' } } also works.
    const out = mongoFilterToPrisma({ name: { $eq: 'Sara' } });
    expect(out).toEqual({ name: { equals: 'Sara' } });
  });

  it('$ne → not', () => {
    expect(mongoFilterToPrisma({ status: { $ne: 'TERMINATED' } })).toEqual({
      status: { not: 'TERMINATED' },
    });
  });

  it('$gt, $gte, $lt, $lte → gt/gte/lt/lte', () => {
    expect(mongoFilterToPrisma({ age: { $gt: 18 } })).toEqual({ age: { gt: 18 } });
    expect(mongoFilterToPrisma({ age: { $gte: 18 } })).toEqual({ age: { gte: 18 } });
    expect(mongoFilterToPrisma({ age: { $lt: 65 } })).toEqual({ age: { lt: 65 } });
    expect(mongoFilterToPrisma({ age: { $lte: 65 } })).toEqual({ age: { lte: 65 } });
  });

  it('combined range $gte + $lte', () => {
    expect(
      mongoFilterToPrisma({ createdAt: { $gte: new Date('2026-01-01'), $lte: new Date('2026-12-31') } })
    ).toEqual({
      createdAt: { gte: new Date('2026-01-01'), lte: new Date('2026-12-31') },
    });
  });
});

describe('mongoFilterToPrisma — set membership', () => {
  it('$in → in', () => {
    expect(mongoFilterToPrisma({ id: { $in: ['a', 'b', 'c'] } })).toEqual({
      id: { in: ['a', 'b', 'c'] },
    });
  });

  it('$nin → notIn', () => {
    expect(mongoFilterToPrisma({ id: { $nin: ['x', 'y'] } })).toEqual({
      id: { notIn: ['x', 'y'] },
    });
  });

  it('$in filters undefined values', () => {
    expect(mongoFilterToPrisma({ id: { $in: ['a', undefined, 'b'] } })).toEqual({
      id: { in: ['a', 'b'] },
    });
  });

  it('$in normalizes enum-typed string values to UPPER_CASE', () => {
    // 'status' is in ENUM_FIELDS — values uppercased + de-duped.
    expect(mongoFilterToPrisma({ status: { $in: ['active', 'ACTIVE', 'pending'] } })).toEqual({
      status: { in: ['ACTIVE', 'PENDING'] },
    });
  });
});

describe('mongoFilterToPrisma — existence + nullability', () => {
  it('$exists: true → not: null', () => {
    expect(mongoFilterToPrisma({ email: { $exists: true } })).toEqual({
      email: { not: null },
    });
  });

  it('$exists: false → null equality', () => {
    expect(mongoFilterToPrisma({ deletedAt: { $exists: false } })).toEqual({
      deletedAt: null,
    });
  });
});

describe('mongoFilterToPrisma — logical operators', () => {
  it('$or → OR', () => {
    expect(
      mongoFilterToPrisma({
        $or: [{ status: 'active' }, { status: 'pending' }],
      })
    ).toEqual({
      OR: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
    });
  });

  it('$and → AND', () => {
    expect(
      mongoFilterToPrisma({
        $and: [{ tenantId: 't1' }, { isActive: true }],
      })
    ).toEqual({
      AND: [{ tenantId: 't1' }, { isActive: true }],
    });
  });

  it('$nor → NOT { OR }', () => {
    expect(
      mongoFilterToPrisma({
        $nor: [{ status: 'TERMINATED' }, { isActive: false }],
      })
    ).toEqual({
      NOT: { OR: [{ status: 'TERMINATED' }, { isActive: false }] },
    });
  });

  it('mixed top-level keys + $or compose correctly', () => {
    expect(
      mongoFilterToPrisma({
        tenantId: 't1',
        $or: [{ a: 1 }, { b: 2 }],
      })
    ).toEqual({
      tenantId: 't1',
      OR: [{ a: 1 }, { b: 2 }],
    });
  });

  it('$not with a comparison operator', () => {
    // Mongo: { age: { $not: { $gt: 18 } } } → not greater than 18
    const out = mongoFilterToPrisma({ age: { $not: { $gt: 18 } } });
    expect(out).toEqual({ age: { not: { gt: 18 } } });
  });
});

describe('mongoFilterToPrisma — string regex', () => {
  it('$regex with case-insensitive flag → contains + mode insensitive', () => {
    expect(mongoFilterToPrisma({ name: { $regex: 'sara', $options: 'i' } })).toEqual({
      name: { contains: 'sara', mode: 'insensitive' },
    });
  });

  it('$regex without options → contains', () => {
    expect(mongoFilterToPrisma({ name: { $regex: 'sara' } })).toEqual({
      name: { contains: 'sara' },
    });
  });

  it('$regex with RegExp instance → use source', () => {
    expect(mongoFilterToPrisma({ name: { $regex: /sara/i } })).toEqual({
      name: { contains: 'sara' },
    });
  });
});

describe('mongoFilterToPrisma — _id and field aliasing', () => {
  it('_id translates to id', () => {
    expect(mongoFilterToPrisma({ _id: 'abc' })).toEqual({ id: 'abc' });
  });

  it('legacy field alias joinDate → hiredAt', () => {
    expect(mongoFilterToPrisma({ joinDate: { $gte: new Date('2026-01-01') } })).toEqual({
      hiredAt: { gte: new Date('2026-01-01') },
    });
  });

  it('legacy field alias employeeNumber → employeeNo', () => {
    expect(mongoFilterToPrisma({ employeeNumber: 'EMP-001' })).toEqual({
      employeeNo: 'EMP-001',
    });
  });

  it('skipped fields drop silently (iqamaExpiry has no Prisma column)', () => {
    expect(mongoFilterToPrisma({ iqamaExpiry: 'x', tenantId: 't1' })).toEqual({
      tenantId: 't1',
    });
  });
});

describe('mongoFilterToPrisma — enum auto-normalization', () => {
  it('lowercase status normalized to UPPER_CASE', () => {
    expect(mongoFilterToPrisma({ status: 'active' })).toEqual({ status: 'ACTIVE' });
  });

  it('lowercase priority normalized to UPPER_CASE', () => {
    expect(mongoFilterToPrisma({ priority: 'high' })).toEqual({ priority: 'HIGH' });
  });

  it('non-enum string passes through untouched', () => {
    expect(mongoFilterToPrisma({ firstName: 'sara' })).toEqual({ firstName: 'sara' });
  });
});

describe('mongoFilterToPrisma — empty + edge cases', () => {
  it('empty filter → empty where', () => {
    expect(mongoFilterToPrisma({})).toEqual({});
  });

  it('null/undefined filter → empty where', () => {
    expect(mongoFilterToPrisma(null as any)).toEqual({});
    expect(mongoFilterToPrisma(undefined as any)).toEqual({});
  });

  it('non-object filter → empty where', () => {
    expect(mongoFilterToPrisma('garbage' as any)).toEqual({});
  });

  it('array value passed at top level (rare) → bare assignment', () => {
    expect(mongoFilterToPrisma({ tags: ['a', 'b'] })).toEqual({ tags: ['a', 'b'] });
  });
});

describe('mongoFilterToPrisma — KNOWN GAPS (documented for review)', () => {
  it.todo('GAP: nested-path filters like { "address.city": "X" } pass through unchanged — Prisma rejects');
  it.todo('GAP: $elemMatch on array fields (Mongo subdocument array match) is unhandled');
  it.todo('GAP: scalar array element match like { tags: "javascript" } needs Prisma { has: ... } translation');
  it.todo('GAP: $type, $expr, $size are unhandled (low usage: $type=2, $expr=3 in route code)');
});

// ════════════════════════════════════════════════════════════════════════════
// mongoUpdateToPrisma
// ════════════════════════════════════════════════════════════════════════════

describe('mongoUpdateToPrisma', () => {
  it('$set spreads into data', () => {
    expect(mongoUpdateToPrisma({ $set: { name: 'Sara', age: 30 } })).toEqual({
      name: 'Sara',
      age: 30,
    });
  });

  it('$unset sets fields to null', () => {
    expect(mongoUpdateToPrisma({ $unset: { managerId: 1, expiresAt: 1 } })).toEqual({
      managerId: null,
      expiresAt: null,
    });
  });

  it('$inc → { increment: amount }', () => {
    expect(mongoUpdateToPrisma({ $inc: { loginCount: 1, points: -5 } })).toEqual({
      loginCount: { increment: 1 },
      points: { increment: -5 },
    });
  });

  it('$setOnInsert spreads into data (Prisma upsert handles split)', () => {
    expect(mongoUpdateToPrisma({ $setOnInsert: { createdAt: 'now' } })).toEqual({
      createdAt: 'now',
    });
  });

  it('combined $set + $inc compose without conflict', () => {
    expect(
      mongoUpdateToPrisma({
        $set: { lastLogin: 'today' },
        $inc: { loginCount: 1 },
      })
    ).toEqual({
      lastLogin: 'today',
      loginCount: { increment: 1 },
    });
  });

  it('direct field assignment (no $-prefix) is preserved', () => {
    expect(mongoUpdateToPrisma({ name: 'Sara' })).toEqual({ name: 'Sara' });
  });

  it('GAP: $push silently dropped (76 call sites in cvision routes)', () => {
    // Current behaviour: $push is not in the switch, and the trailing direct-field
    // loop only touches non-$ keys, so this returns {}. Documented for follow-up.
    expect(mongoUpdateToPrisma({ $push: { messages: { text: 'hello' } } })).toEqual({});
  });

  it('GAP: $pull silently dropped (10 call sites)', () => {
    expect(mongoUpdateToPrisma({ $pull: { likes: 'user-1' } })).toEqual({});
  });

  it('GAP: $addToSet silently dropped (10 call sites)', () => {
    expect(mongoUpdateToPrisma({ $addToSet: { readBy: 'user-1' } })).toEqual({});
  });

  it('GAP: combined $push + $set keeps $set, drops $push', () => {
    expect(
      mongoUpdateToPrisma({
        $push: { interviews: { id: 'int-1' } },
        $set: { updatedAt: 'now' },
      })
    ).toEqual({ updatedAt: 'now' });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// mongoSortToPrisma
// ════════════════════════════════════════════════════════════════════════════

describe('mongoSortToPrisma', () => {
  it('1 → asc, -1 → desc', () => {
    expect(mongoSortToPrisma({ createdAt: -1 })).toEqual([{ createdAt: 'desc' }]);
    expect(mongoSortToPrisma({ name: 1 })).toEqual([{ name: 'asc' }]);
  });

  it('multi-key sort preserves order', () => {
    expect(mongoSortToPrisma({ createdAt: -1, name: 1 })).toEqual([
      { createdAt: 'desc' },
      { name: 'asc' },
    ]);
  });

  it('non-1/-1 numeric directions still treated (non--1 → asc)', () => {
    // Defensive: anything not -1 maps to asc.
    expect(mongoSortToPrisma({ priority: 0 })).toEqual([{ priority: 'asc' }]);
    expect(mongoSortToPrisma({ priority: 2 })).toEqual([{ priority: 'asc' }]);
  });

  it('empty sort → empty array', () => {
    expect(mongoSortToPrisma({})).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// mongoProjectToPrisma
// ════════════════════════════════════════════════════════════════════════════

describe('mongoProjectToPrisma', () => {
  it('1 → true, drops 0', () => {
    expect(mongoProjectToPrisma({ id: 1, name: 1, secret: 0 })).toEqual({
      id: true,
      name: true,
    });
  });

  it('strips _id (Prisma uses id)', () => {
    expect(mongoProjectToPrisma({ _id: 1, name: 1 })).toEqual({ name: true });
  });

  it('empty projection → empty select', () => {
    expect(mongoProjectToPrisma({})).toEqual({});
  });

  it('only-exclusions yields empty select (not equivalent to "all-but-X" in Mongo — known gap)', () => {
    expect(mongoProjectToPrisma({ password: 0, secret: 0 })).toEqual({});
  });
});
