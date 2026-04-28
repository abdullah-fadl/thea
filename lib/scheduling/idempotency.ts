import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type StoredResponse = {
  status: number;
  body: any;
  createdAt: string;
};

export async function withSchedulingIdempotency(args: {
  db?: any; // ignored — kept for call-site compat
  tenantId: string;
  method: string;
  pathname: string;
  clientRequestId?: string | null;
  handler: () => Promise<NextResponse>;
}): Promise<NextResponse> {
  const { tenantId, method, pathname, clientRequestId, handler } = args;
  const key = String(clientRequestId || '').trim();
  if (!key) return handler();

  // Known limitation: No dedicated Prisma model for scheduling_idempotency exists.
  // The table is created via raw migration with columns:
  //   tenantId, key, method, pathname, response (jsonb), createdAt
  //   UNIQUE(tenantId, key, method, pathname)
  // Raw SQL is used here; to add a Prisma model, define SchedulingIdempotencyKey in
  // prisma/schema/scheduling.prisma and run prisma migrate.

  try {
    const existing: { response: any }[] = await prisma.$queryRaw`
      SELECT response FROM scheduling_idempotency
      WHERE "tenantId" = ${tenantId} AND key = ${key} AND method = ${method} AND pathname = ${pathname}
      LIMIT 1
    `;

    if (existing.length > 0 && existing[0].response) {
      const r = existing[0].response as StoredResponse;
      return NextResponse.json(r.body, { status: r.status, headers: { 'x-idempotent-replay': '1' } });
    }
  } catch {
    // Table may not exist yet — fall through to handler
  }

  const res = await handler();
  let body: any = null;
  try {
    body = await res.clone().json();
  } catch {
    body = null;
  }

  const stored: StoredResponse = {
    status: res.status,
    body,
    createdAt: new Date().toISOString(),
  };

  // Best-effort store; if duplicate/race, ignore.
  try {
    await prisma.$executeRaw`
      INSERT INTO scheduling_idempotency ("tenantId", key, method, pathname, response, "createdAt")
      VALUES (${tenantId}, ${key}, ${method}, ${pathname}, ${JSON.stringify(stored)}::jsonb, NOW())
      ON CONFLICT DO NOTHING
    `;
  } catch {
    // ignore duplicates/races
  }

  return res;
}
