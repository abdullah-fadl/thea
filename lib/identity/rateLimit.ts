import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/monitoring/logger';

export async function consumeIdentityRateLimit(options: {
  collection?: any; // ignored — kept for call-site compat
  tenantId: string;
  userId: string;
  capacity: number;
  refillPerMin: number;
  now?: Date;
}): Promise<{ allowed: boolean; remaining: number }> {
  const now = options.now ?? new Date();

  // Known limitation: No dedicated Prisma model for identity_rate_limits exists.
  // The table is created via raw migration with columns:
  //   tenantId, userId, capacity, refillPerMin, tokens, refilledAt, createdAt, updatedAt
  //   UNIQUE(tenantId, userId)
  // Raw SQL is used here; to add a Prisma model, define IdentityRateLimit in
  // prisma/schema/core.prisma and run prisma migrate.

  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT tokens, "refilledAt"
      FROM identity_rate_limits
      WHERE "tenantId" = ${options.tenantId} AND "userId" = ${options.userId}
      LIMIT 1
    `;

    const existing = rows[0] || null;
    const lastRefill = existing?.refilledAt ? new Date(existing.refilledAt) : now;
    const elapsedMs = Math.max(0, now.getTime() - lastRefill.getTime());
    const refillTokens = (elapsedMs / 60000) * options.refillPerMin;
    const startingTokens = typeof existing?.tokens === 'number' ? existing.tokens : options.capacity;
    const nextTokens = Math.min(options.capacity, startingTokens + refillTokens);

    if (nextTokens < 1) {
      await prisma.$executeRaw`
        INSERT INTO identity_rate_limits ("tenantId", "userId", capacity, "refillPerMin", tokens, "refilledAt", "createdAt", "updatedAt")
        VALUES (${options.tenantId}, ${options.userId}, ${options.capacity}, ${options.refillPerMin}, ${nextTokens}, ${now}, ${now}, ${now})
        ON CONFLICT ("tenantId", "userId")
        DO UPDATE SET tokens = ${nextTokens}, "refilledAt" = ${now}, "updatedAt" = ${now}
      `;
      return { allowed: false, remaining: 0 };
    }

    const remaining = Math.max(0, nextTokens - 1);
    await prisma.$executeRaw`
      INSERT INTO identity_rate_limits ("tenantId", "userId", capacity, "refillPerMin", tokens, "refilledAt", "createdAt", "updatedAt")
      VALUES (${options.tenantId}, ${options.userId}, ${options.capacity}, ${options.refillPerMin}, ${remaining}, ${now}, ${now}, ${now})
      ON CONFLICT ("tenantId", "userId")
      DO UPDATE SET tokens = ${remaining}, "refilledAt" = ${now}, "updatedAt" = ${now}
    `;

    return { allowed: true, remaining };
  } catch (error) {
    // If table doesn't exist yet, allow the request
    logger.warn('Rate limit check failed (table may not exist)', { category: 'auth', error });
    return { allowed: true, remaining: options.capacity };
  }
}
