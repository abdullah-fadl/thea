/**
 * Stage B T3 — shared helpers for cvision route smoke tests.
 *
 * The smoke tests exercise the *shim path* (Mongo→Prisma translation in
 * lib/cvision/prisma-db.ts + prisma-helpers.ts) by:
 *   1. mocking @/lib/db/prisma with a Proxy that hands out per-model fakes
 *   2. letting cvisionDb.collection(...) translate Mongo-style filters
 *      through the real shim and call the mocked Prisma model methods
 *   3. asserting the *translated* call shape on the mocked model
 *
 * This is the "tenant boundary" mock the task spec calls for: we do not
 * stub the shim itself — we stub the layer below it.
 */

import { vi } from 'vitest';
import type { NextRequest } from 'next/server';

export const TENANT_ID = '11111111-1111-1111-1111-111111111111';
export const USER_ID = '22222222-2222-2222-2222-222222222222';
export const DEPT_ID = '33333333-3333-3333-3333-333333333333';

export type ModelMock = ReturnType<typeof makeModelMock>;

export function makeModelMock() {
  return {
    findMany: vi.fn(async () => [] as any[]),
    findFirst: vi.fn(async () => null as any),
    findUnique: vi.fn(async () => null as any),
    create: vi.fn(async (args: any) => args.data),
    createMany: vi.fn(async () => ({ count: 0 })),
    update: vi.fn(async (args: any) => args.data),
    updateMany: vi.fn(async () => ({ count: 0 })),
    upsert: vi.fn(async (args: any) => args.create || args.update),
    delete: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    count: vi.fn(async () => 0),
    aggregate: vi.fn(async () => ({})),
    groupBy: vi.fn(async () => [] as any[]),
  };
}

/**
 * Build a Proxy-wrapped Prisma stub. Every model access yields the same
 * cached ModelMock per key, so the test can grab `models.cvisionEmployee`
 * to assert against. Add raw query stubs as the routes need them.
 */
export function makePrismaStub(): {
  prisma: any;
  models: Record<string, ModelMock>;
  getModel: (name: string) => ModelMock;
} {
  const models: Record<string, ModelMock> = {};
  function getModel(name: string): ModelMock {
    if (!(name in models)) models[name] = makeModelMock();
    return models[name];
  }
  const target: any = {
    $queryRaw: vi.fn(async () => []),
    $queryRawUnsafe: vi.fn(async () => []),
    $executeRaw: vi.fn(async () => 0),
    $executeRawUnsafe: vi.fn(async () => 0),
    $transaction: vi.fn(async (arg: any) => {
      if (typeof arg === 'function') return arg(prismaProxy);
      if (Array.isArray(arg)) return Promise.all(arg);
      return undefined;
    }),
    $connect: vi.fn(async () => undefined),
    $disconnect: vi.fn(async () => undefined),
  };
  const prismaProxy: any = new Proxy(target, {
    get(t, key: string) {
      if (key in t) return t[key];
      if (typeof key !== 'string') return undefined;
      return getModel(key);
    },
  });
  return { prisma: prismaProxy, models, getModel };
}

/**
 * Mock factory for @/lib/cvision/infra. The route's withAuthTenant becomes a
 * pass-through that injects a baseline auth context. Returned context can be
 * overridden per-test by calling `setAuthContext`.
 */
export interface AuthCtx {
  tenantId: string;
  userId: string;
  role: string;
  user: { id: string; email: string; name: string; role: string };
  permissions: string[];
}

export const defaultAuthCtx: AuthCtx = {
  tenantId: TENANT_ID,
  userId: USER_ID,
  role: 'admin',
  user: {
    id: USER_ID,
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
  },
  permissions: ['*'],
};

/**
 * Mirrors the real withAuthTenant's params-unwrapping: Next.js passes
 * `(request, { params })` where params may be a Promise; the wrapper
 * unwraps and forwards the unwrapped params as the 3rd handler arg.
 */
export function makeWithAuthTenant(ctx: AuthCtx = defaultAuthCtx) {
  return (handler: any, _opts?: any) =>
    async (req: NextRequest, secondArg?: { params?: any }) => {
      const params = secondArg?.params instanceof Promise
        ? await secondArg.params
        : secondArg?.params;
      return handler(req, ctx, params);
    };
}
