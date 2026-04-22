import { prisma } from '@/lib/db/prisma';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function checkAccountLocked(
  _db: any,
  email: string
): Promise<{ locked: boolean; remainingMs?: number }> {
  const record = await prisma.loginAttempt.findFirst({
    where: { email },
  });

  if (record?.lockedUntil && new Date() < record.lockedUntil) {
    return {
      locked: true,
      remainingMs: record.lockedUntil.getTime() - Date.now(),
    };
  }

  return { locked: false };
}

export async function recordFailedLogin(_db: any, email: string): Promise<void> {
  const now = new Date();

  // Upsert: create or increment
  const existing = await prisma.loginAttempt.findFirst({ where: { email } });

  if (existing) {
    const newCount = existing.failedCount + 1;
    await prisma.loginAttempt.update({
      where: { id: existing.id },
      data: {
        failedCount: newCount,
        updatedAt: now,
        lockedUntil: newCount >= MAX_FAILED_ATTEMPTS
          ? new Date(now.getTime() + LOCKOUT_DURATION_MS)
          : existing.lockedUntil,
      },
    });
  } else {
    await prisma.loginAttempt.create({
      data: {
        email,
        ip: null,
        success: false,
        failedCount: 1,
        lockedUntil: null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

export async function clearFailedLogins(_db: any, email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}
